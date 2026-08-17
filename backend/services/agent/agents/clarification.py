from dotenv import load_dotenv
load_dotenv()
import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from configs.llm import get_llm
from configs.models import CLARIFICATION_MODEL
from utils.content import extract_text

MODEL_TO_USE = CLARIFICATION_MODEL
print("clarification model:", MODEL_TO_USE)

MAX_CLARIFICATION_ATTEMPTS = 3

AGENT_REQUIREMENTS = {
    "ppt": {
        "required": ["topic_or_description"],
        "optional": ["audience", "slide_count", "style"]
    },
    "image": {
        "required": ["subject_or_description"],
        "optional": ["style", "aspect_ratio"]
    },
    "coding": {
        "required": ["project_or_task_description"],
        "optional": ["language", "framework"]
    },
    "search": {
        "required": ["query"],
        "optional": []
    },
    "rag": {
        "required": ["question"],
        "optional": []
    },
    "pdf": {
        "required": ["topic_or_content"],
        "optional": ["document_type", "sections"]
    }
}

SYSTEM_PROMPT = """
You are the Requirement Validator Agent for OmniMindAI.
Your job is to evaluate whether the user has provided the required information for the {selected_agent} agent.

AGENT REQUIREMENTS:
{agent_requirements}

CURRENTLY COLLECTED REQUIREMENTS:
{collected_requirements}

INSTRUCTIONS:
1. Extract any newly provided requirements from the User Query (or History).
2. Merge them with the CURRENTLY COLLECTED REQUIREMENTS.
3. Check if all "required" fields for this agent are now fulfilled with specific information.
4. CRITICAL RULE FOR GENERIC REQUESTS:
   Generic commands or short intent phrases like "generate pdf", "make a pdf", "pdf banao", "create ppt", "write code", "generate image", "create document" ONLY express the action request — they DO NOT specify the actual topic, subject, project, or content!
   If the user query is generic (e.g. "generate pdf") and NO specific topic, subject, or content details are provided yet in the query or history, you MUST set `ready` to false, specify the missing field (e.g., `topic_or_content`), and generate EXACTLY ONE clear, friendly question asking the user for those details (e.g., "What topic, project, or content should the PDF document be about?").
5. If ALL required fields are fulfilled with real specific details, set `ready` to true, leave `missing_field` and `question` null.
6. If ANY required field is still missing, set `ready` to false, specify the FIRST `missing_field`, and ask EXACTLY ONE clear question to get it.
7. DO NOT ask for "optional" fields. If only optional fields are missing, set `ready` to true.

Output the final merged requirements in `extracted_requirements`.
"""

class RequirementDecision(BaseModel):
    ready: bool = Field(description="True if all required fields are provided with specific details.")
    missing_field: str | None = Field(description="The name of the missing required field, if any.", default=None)
    question: str | None = Field(description="The EXACTLY ONE question to ask the user, if ready is false.", default=None)
    extracted_requirements: dict = Field(description="The full key-value dictionary of all collected requirements so far.", default_factory=dict)

GENERIC_PATTERNS = {
    "coding": {
        "phrases": ["genrate code", "generate code", "code banao", "write code", "make code", "create code", "code write", "code", "write program", "make app", "create app", "write script"],
        "missing_field": "project_or_task_description",
        "question": "What specific project, feature, or programming task would you like me to write code for? (e.g. A React authentication form, a Python file parser, an Express REST API, etc.)"
    },
    "pdf": {
        "phrases": ["genrate pdf", "generate pdf", "pdf banao", "make pdf", "create pdf", "pdf generate", "pdf"],
        "missing_field": "topic_or_content",
        "question": "What topic, project, or content details should the PDF document be about?"
    },
    "ppt": {
        "phrases": ["genrate ppt", "generate ppt", "ppt banao", "make ppt", "create ppt", "make presentation", "create presentation", "slides banao", "ppt"],
        "missing_field": "topic_or_description",
        "question": "What topic or project would you like the presentation to cover?"
    },
    "image": {
        "phrases": ["genrate image", "generate image", "image banao", "make image", "create image", "draw image", "make photo", "image"],
        "missing_field": "subject_or_description",
        "question": "What subject, scene, or image description would you like me to generate?"
    }
}

clarification_llm = get_llm(model=MODEL_TO_USE)
clarification_chain = clarification_llm.with_structured_output(RequirementDecision)

def clarification_agent(state):
    print("===== Clarification Agent =====")

    selected_agent = state.get("selected_agent")

    # If chat or an agent without requirements, skip clarification
    if not selected_agent or selected_agent not in AGENT_REQUIREMENTS:
        if state.get("task_status") != "cancelled":
            state["task_status"] = "running"
        return state

    # If the task was cancelled by the manager (user changed request), don't override
    if state.get("task_status") == "cancelled":
        state["task_status"] = "running"
        state["collected_requirements"] = {}
        return state

    attempts = state.get("clarification_attempts", 0)
    
    if attempts >= MAX_CLARIFICATION_ATTEMPTS:
        print(f"Max clarification attempts reached ({MAX_CLARIFICATION_ATTEMPTS}). Forcing execution.")
        state["task_status"] = "running"
        return state

    collected = state.get("collected_requirements", {})
    query_clean = state.get("query", "").lower().strip()

    # Fast Instant Check for Generic Incomplete Requests (0.001s)
    if not collected and selected_agent in GENERIC_PATTERNS:
        pattern = GENERIC_PATTERNS[selected_agent]
        if query_clean in pattern["phrases"] or len(query_clean.split()) <= 2:
            print(f"Fast Clarification Triggered for {selected_agent}: Incomplete request detected.")
            state["task_status"] = "waiting_for_clarification"
            state["pending_question"] = pattern["question"]
            state["pending_task"] = state.get("pending_task", state["query"])
            state["clarification_attempts"] = attempts + 1
            state["final_response"] = pattern["question"]
            state["collected_requirements"] = {}
            return state

    try:
        recent_history = state.get("history", [])[-5:]
        history_text = "No recent history."
        if recent_history:
            history_text = "\n".join([f"{msg.get('role', 'user')}: {extract_text(msg.get('content'))}" for msg in recent_history])

        requirements_json = json.dumps(AGENT_REQUIREMENTS[selected_agent], indent=2)
        collected_json = json.dumps(collected, indent=2)

        prompt = SYSTEM_PROMPT.format(
            selected_agent=selected_agent,
            agent_requirements=requirements_json,
            collected_requirements=collected_json
        )

        messages_to_send = [
            SystemMessage(content=prompt),
            HumanMessage(content=f"History:\n{history_text}\n\nUser Query: {state['query']}"),
        ]

        result = clarification_chain.invoke(messages_to_send)
        
        # Merge newly extracted requirements with existing collected_requirements
        existing_reqs = state.get("collected_requirements", {}) or {}
        new_reqs = result.extracted_requirements or {}
        merged_reqs = {**existing_reqs, **new_reqs}
        state["collected_requirements"] = merged_reqs

        print(f"[CLARIFICATION] Agent={selected_agent}, Ready={result.ready}, MissingField={result.missing_field}")
        print(f"[CLARIFICATION] Merged Requirements: {json.dumps(merged_reqs)}")

        if not result.ready and result.question:
            state["task_status"] = "waiting_for_clarification"
            state["pending_question"] = result.question
            state["pending_task"] = state.get("pending_task", state["query"])
            state["clarification_attempts"] = attempts + 1
            state["final_response"] = result.question
            print(f"[CLARIFICATION] Question Asked (Attempt {attempts + 1}): {result.question}")
        else:
            state["task_status"] = "running"
            print("[CLARIFICATION] All requirements met. Proceeding to target agent.")

    except Exception as e:
        print(f"[CLARIFICATION] Error: {e}")
        # On error, safely fallback to execution
        state["task_status"] = "running"

    return state
