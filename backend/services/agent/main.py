from flask import Flask, request, Response, stream_with_context
from dotenv import load_dotenv
from utils.api_response import send_error,send_success
from utils.chat_service import save_message, get_messages, update_message_in_db
from utils.content import extract_text
from utils.try_catch import try_catch
from flask_cors import CORS
from configs.db import db
from graph.workflow import graph
from langchain_core.runnables.graph import MermaidDrawMethod
from graph.edges import MAX_REVIEW_ATTEMPTS
from datetime import datetime, timezone
import os
import json
import time
import uuid
import threading
import queue
from bson.objectid import ObjectId


load_dotenv()

app = Flask(__name__)
PORT=os.getenv("PORT")
CORS(app)

def register_nodes(builder):
    pass

TEXT_STREAM_NODES = {"chat", "coding", "rag"}
SSE_HEARTBEAT_INTERVAL = int(os.getenv("SSE_HEARTBEAT_INTERVAL", "10"))


def sse(payload):
    return f"data: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def attach_agent_trace(final_response, agent_trace):
    """
    Store trace metadata with the assistant message without changing media payloads.
    """
    if isinstance(final_response, dict):
        content = dict(final_response)
        content["agent_trace"] = agent_trace
        return content

    return {
        "type": "text",
        "text": extract_text(final_response),
        "agent_trace": agent_trace,
    }

@app.get("/check")
def check():

    user = {
        "_id": request.headers.get("x-user-id"),
        "name": request.headers.get("x-user-name"),
        "email": request.headers.get("x-user-email"),
    }

    return send_success(
        "Agent Service Running",
        user,
    )



@app.post("/call-agent") 
def call_agent():
    body = request.get_json() or {}
    conversation_id = body.get("conversation_id")
    user_message = body.get("user_message")
    target_message_id = body.get("target_message_id")
    user_id = request.headers.get("x-user-id")
    
    print(f"[CODE UPDATE]\nmessageId: {target_message_id}\nuserId: {user_id}\nrequirement: {user_message[:80]}...")
    
    chat_service_url = os.getenv('CHAT_SERVICE')
    
    # 1. Save User Message (only if not refining an existing message in-place)
    if not target_message_id:
        save_message(
            chat_service_url=chat_service_url,
            conversation_id=conversation_id,
            content=user_message,
            role="user",
        )
    else:
        print(f"[CODE UPDATE]\nExisting message found: {target_message_id}\nSkipping new user message creation to preserve in-place update.")
    
    # 2. Prepare Graph State
    user_id = request.headers.get("x-user-id")
    history = get_messages(chat_service_url, conversation_id, user_id)
    
    # Check active task in MongoDB
    conversation = None
    if conversation_id:
        try:
            conversation = db["conversations"].find_one({"_id": ObjectId(conversation_id)})
        except Exception:
            conversation = None
        
    active_task = conversation.get("active_task", {}) if conversation else {}
    
    # If there's an active task, we resume it. Otherwise, create a new task_id.
    task_id = active_task.get("task_id", uuid.uuid4().hex)
    task_status = active_task.get("task_status", "pending")
    pending_agent = active_task.get("pending_agent")
    
    state = {
        "query": user_message,
        "user_id": user_id,
        "user_name": request.headers.get("x-user-name"),
        "user_email": request.headers.get("x-user-email"),
        "selected_agent": pending_agent if task_status == "waiting_for_clarification" else None,
        "review_status": None,
        "review_feedback": None,
        "review_attempt": 0,
        "search_result": None,
        "final_response": None,
        "review_score": None,
        "history": history,
        
        # New robust task state
        "task_id": task_id,
        "task_status": task_status,
        "pending_agent": pending_agent,
        "pending_task": active_task.get("pending_task"),
        "pending_question": active_task.get("pending_question"),
        "clarification_attempts": active_task.get("clarification_attempts", 0),
        "collected_requirements": active_task.get("collected_requirements", {}),
    }
    
    print(f"[TASK] task_id={task_id}")
    print(f"[TASK] task_status={task_status}")
    print(f"[TASK] pending_agent={pending_agent}")
    print(f"[TASK] selected_agent={state['selected_agent']}")
    
    # 3. Generator Function for Streaming with Background Worker and Heartbeat
    _SENTINEL = object()
    event_queue = queue.Queue()
    stop_event = threading.Event()

    def worker():
        final_response = None
        selected_agent = None
        streamed_text = ""
        workflow_started_at = utc_now_iso()
        workflow_started_perf = time.perf_counter()
        agent_runs = []
        active_runs = {}
        run_counts = {}
        current_agent = None

        def elapsed_ms():
            return int((time.perf_counter() - workflow_started_perf) * 1000)

        def current_trace(completed=False):
            return {
                "workflow_started_at": workflow_started_at,
                "workflow_completed_at": utc_now_iso() if completed else None,
                "total_duration_ms": elapsed_ms(),
                "selected_agent": selected_agent,
                "current_agent": current_agent,
                "steps": [dict(run) for run in agent_runs],
            }

        def start_agent(agent_name, detail=None):
            nonlocal current_agent

            if not agent_name or agent_name in active_runs:
                return []

            run_counts[agent_name] = run_counts.get(agent_name, 0) + 1
            run = {
                "id": f"{agent_name}-{run_counts[agent_name]}",
                "name": agent_name,
                "status": "running",
                "started_at": utc_now_iso(),
                "started_offset_ms": elapsed_ms(),
                "duration_ms": None,
            }

            if detail:
                run["detail"] = detail

            active_runs[agent_name] = run
            agent_runs.append(run)
            current_agent = agent_name

            return [
                sse({
                    "success": True,
                    "type": "agent",
                    "data": {
                        "event": "start",
                        "agent": dict(run),
                        "agent_trace": current_trace(),
                    },
                })
            ]

        def complete_agent(agent_name, node_state=None):
            nonlocal current_agent, selected_agent

            events = []

            if not agent_name:
                return events

            if agent_name not in active_runs:
                events.extend(
                    start_agent(
                        agent_name,
                        "Started before a streamable token was available.",
                    )
                )

            run = active_runs.get(agent_name)

            if not run:
                return events

            completed_offset_ms = elapsed_ms()
            run["status"] = "completed"
            run["completed_at"] = utc_now_iso()
            run["completed_offset_ms"] = completed_offset_ms
            run["duration_ms"] = max(
                0,
                completed_offset_ms - int(run.get("started_offset_ms", 0)),
            )

            if node_state:
                if node_state.get("selected_agent"):
                    selected_agent = node_state["selected_agent"]
                    run["selected_agent"] = selected_agent

                if node_state.get("review_status"):
                    run["review_status"] = node_state["review_status"]

                if node_state.get("review_score") is not None:
                    run["review_score"] = node_state["review_score"]

            active_runs.pop(agent_name, None)
            current_agent = next(reversed(active_runs), None) if active_runs else None

            events.append(
                sse({
                    "success": True,
                    "type": "agent",
                    "data": {
                        "event": "complete",
                        "agent": dict(run),
                        "agent_trace": current_trace(),
                    },
                })
            )

            return events

        def fail_active_agents(error_message):
            nonlocal current_agent

            events = []

            for agent_name, run in list(active_runs.items()):
                completed_offset_ms = elapsed_ms()
                run["status"] = "error"
                run["completed_at"] = utc_now_iso()
                run["completed_offset_ms"] = completed_offset_ms
                run["duration_ms"] = max(
                    0,
                    completed_offset_ms - int(run.get("started_offset_ms", 0)),
                )
                run["error"] = error_message
                active_runs.pop(agent_name, None)
                events.append(
                    sse({
                        "success": True,
                        "type": "agent",
                        "data": {
                            "event": "error",
                            "agent": dict(run),
                            "agent_trace": current_trace(),
                        },
                    })
                )

            current_agent = None
            return events

        def next_agents_after(node_name, node_state):
            if node_name == "manager":
                return ["clarification"]

            if node_name == "clarification":
                if node_state.get("task_status") == "waiting_for_clarification":
                    return []
                return [node_state.get("selected_agent") or selected_agent or "chat"]

            if node_name == "search":
                return ["chat"]

            if node_name == "coding":
                return ["review"]

            if node_name == "ppt":
                return ["ppt_test"]

            if node_name == "review":
                review_attempt = node_state.get("review_attempt", 0)
                needs_fix = node_state.get("review_status") == "needs_fix"

                if needs_fix and review_attempt < MAX_REVIEW_ATTEMPTS:
                    return ["coding"]

            if node_name == "ppt_test":
                review_attempt = node_state.get("review_attempt", 0)
                needs_fix = node_state.get("review_status") != "approved"
                if needs_fix and review_attempt < MAX_REVIEW_ATTEMPTS:
                    return ["ppt"]

            return []

        def emit(event):
            event_queue.put(event)

        try:
            for event in start_agent("manager"):
                emit(event)

            emit(sse({
                "success": True,
                "type": "start",
                "data": {
                    "agent_trace": current_trace(),
                },
            }))

            # "messages" mode LLM tokens ko realtime stream karta hai.
            # "updates" mode final state deta hai, jisse DB me exact final response save hota hai.
            for mode, data in graph.stream(state, stream_mode=["updates", "messages"]):
                if stop_event.is_set():
                    print("[SSE WORKER] Stop event detected (client disconnected), exiting stream loop.")
                    return

                if mode == "messages":
                    message, metadata = data
                    node_name = metadata.get("langgraph_node")

                    if node_name not in TEXT_STREAM_NODES:
                        continue

                    if node_name not in active_runs:
                        for event in start_agent(node_name):
                            emit(event)

                    text_delta = extract_text(getattr(message, "content", ""))

                    if text_delta:
                        streamed_text += text_delta
                        emit(sse({
                            "success": True,
                            "type": "delta",
                            "data": {
                                "text": text_delta,
                                "node": node_name,
                                "current_agent": current_agent,
                            },
                        }))

                    continue

                if mode != "updates":
                    continue

                for node_name, node_state in data.items():
                    if not isinstance(node_state, dict):
                        continue

                    if node_state.get("insufficient_credits"):
                        emit(sse({
                            "success": False,
                            "code": "INSUFFICIENT_CREDITS",
                            "message": "You don't have enough AI Credits for this operation.",
                            "data": node_state.get("insufficient_credit_data", {})
                        }))
                        return

                    if "task_status" in node_state and conversation_id:
                        status = node_state["task_status"]
                        if status == "waiting_for_clarification":
                            db["conversations"].update_one(
                                {"_id": ObjectId(conversation_id)},
                                {"$set": {
                                    "active_task": {
                                        "task_id": node_state.get("task_id"),
                                        "task_status": "waiting_for_clarification",
                                        "pending_agent": selected_agent or node_state.get("selected_agent"),
                                        "pending_task": node_state.get("pending_task", selected_agent or node_state.get("selected_agent")),
                                        "pending_question": node_state.get("pending_question") or node_state.get("final_response"),
                                        "clarification_attempts": node_state.get("clarification_attempts", 0),
                                        "collected_requirements": node_state.get("collected_requirements", {})
                                    }
                                }}
                            )
                        elif status in ["completed", "cancelled", "failed"]:
                            db["conversations"].update_one(
                                {"_id": ObjectId(conversation_id)},
                                {"$unset": {"active_task": ""}}
                            )

                    if node_state.get("selected_agent"):
                        selected_agent = node_state["selected_agent"]

                    if node_state.get("final_response"):
                        final_response = node_state["final_response"]
                        if node_state.get("task_status") == "waiting_for_clarification":
                            final_response = {
                                "type": "clarification",
                                "task_id": node_state.get("task_id"),
                                "text": final_response,
                                "pending_agent": selected_agent,
                                "question": {
                                    "text": final_response,
                                    "field": node_state.get("pending_question") # can be the field name if we parse it, for now just reuse
                                }
                            }

                    for event in complete_agent(node_name, node_state):
                        emit(event)

                    for next_agent in next_agents_after(node_name, node_state):
                        for event in start_agent(next_agent):
                            emit(event)

                emit(sse({
                    "success": True,
                    "type": "status",
                    "data": {
                        "selected_agent": selected_agent,
                        "agent_trace": current_trace(),
                    }
                }))

            # 4. Stream poori tarah khatam hone ke baad Assistant ka message DB me save karein
            if final_response is None and streamed_text:
                final_response = streamed_text

            if final_response is not None:
                final_trace = current_trace(completed=True)
                final_content = attach_agent_trace(final_response, final_trace)

                print("[CODE UPDATE]\nCoding Agent & Review Agent completed successfully.\nFinal code generated.")

                saved_id = target_message_id
                if target_message_id:
                    print(f"[CODE UPDATE]\nUpdating existing message: {target_message_id}")
                    updated_res = update_message_in_db(
                        chat_service_url=chat_service_url,
                        message_id=target_message_id,
                        content=final_content,
                        user_id=user_id,
                        conversation_id=conversation_id,
                    )
                    if isinstance(updated_res, dict) and updated_res.get("data", {}).get("_id"):
                        saved_id = str(updated_res["data"]["_id"])
                    print(f"[CODE UPDATE]\nDatabase update successful: {saved_id}")
                else:
                    print("[CODE UPDATE]\nCreating new assistant message in DB.")
                    saved_msg = save_message(
                        chat_service_url=chat_service_url,
                        conversation_id=conversation_id,
                        content=final_content,
                        role="assistant",
                    )
                    if isinstance(saved_msg, dict) and saved_msg.get("data", {}).get("_id"):
                        saved_id = str(saved_msg["data"]["_id"])
                
                print(f"[CODE UPDATE]\nReturning updated message: {saved_id}")
                emit(sse({
                    "success": True, 
                    "type": "end", 
                    "data": {
                        "selected_agent": selected_agent,
                        "final_response": final_content,
                        "agent_trace": final_trace,
                        "saved_message_id": saved_id,
                    }
                }))

        except Exception as e:
            error_message = str(e)

            for event in fail_active_agents(error_message):
                emit(event)

            # Agar stream ke beech error aaye toh use SSE format me bhejein
            emit(sse({
                "success": False,
                "type": "error",
                "message": error_message,
                "data": {
                    "agent_trace": current_trace(completed=True),
                },
            }))
        finally:
            event_queue.put(_SENTINEL)

    # Start background worker thread
    worker_thread = threading.Thread(target=worker, daemon=True)
    worker_thread.start()

    def generate_stream():
        try:
            while True:
                try:
                    event = event_queue.get(timeout=SSE_HEARTBEAT_INTERVAL)
                    if event is _SENTINEL:
                        break
                    yield event
                except queue.Empty:
                    # Heartbeat when no event arrived within SSE_HEARTBEAT_INTERVAL
                    yield sse({
                        "success": True,
                        "type": "heartbeat",
                        "data": {
                            "message": "Workflow is still processing...",
                        }
                    })
        except GeneratorExit:
            # Client closed SSE connection
            pass
        finally:
            stop_event.set()

    # 5. Return Streaming Response with standard SSE mimetype
    return Response(
        stream_with_context(generate_stream()),
        mimetype='text/event-stream',
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )



if __name__ == "__main__":
    # graph.get_graph().draw_mermaid_png(
    #     output_file_path="workflow.png",
    #     draw_method=MermaidDrawMethod.API,
    # )
    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=True,
        use_reloader=False
    )
