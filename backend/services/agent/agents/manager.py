from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from typing import Literal
from pydantic import BaseModel
from configs.llm import get_llm
from configs.models import MANAGER_MODEL
from utils.content import extract_text
import os

SYSTEM_PROMPT = """
You are the Manager Agent of OmniMindAI.

Your ONLY responsibility is to analyze the current user query and select the single most appropriate agent to handle it.

Select strictly from these 7 agents:

1. chat
Use for:
- Greetings (hello, hi, hey)
- Casual conversation and general Q&A
- Explanations, brainstorming, essay/email writing, translation
- General educational or life discussions

2. search
Use for:
- Live data, current sports, cricket/football matches, live scores
- Today's matches, ongoing games, sports results
- Latest news, current events, live weather, real-time internet search
- Current stock/crypto prices, recent developments
- Queries asking "which match is going on", "live score", "today news"

3. coding
Use for:
- Writing code, programming scripts, building apps, components
- Debugging errors, refactoring code, explaining code logic
- Software architecture, API design, database queries, algorithms

4. pdf
Use for:
- Creating/generating PDF documents or reports
- PDF summarization, extraction, modification

5. ppt
Use for:
- Creating PowerPoint presentations or slide decks

6. image
Use for:
- Generating images, logos, posters, digital art, illustrations

7. rag
Use for:
- Questions requiring knowledge specifically from user-uploaded private documents/files

CRITICAL RULES:
- Always select exactly ONE agent from ["chat", "search", "coding", "pdf", "ppt", "image", "rag"].
- Conversation history is provided ONLY for context. DO NOT get biased by previous messages (such as old coding or pdf requests). Evaluate the current query independently.
- Questions about current matches, live scores, news, or real-time info MUST be classified as 'search', even if the user previously worked on coding.
- Return ONLY valid JSON matching the schema.
"""

manager_llm = get_llm(model=MANAGER_MODEL, temperature=0.0)

class ManagerDecision(BaseModel):
    selected_agent: Literal[
        "chat",
        "search",
        "coding",
        "pdf",
        "ppt",
        "image",
        "rag",
    ]

manager_chain = manager_llm.with_structured_output(ManagerDecision)

GREETINGS_AND_CANCEL = {
    "hi", "hello", "hey", "hlo", "helo", "hiii", "heyya", "good morning", 
    "good afternoon", "good evening", "how are you", "who are you", "what can you do",
    "cancel", "stop", "never mind", "nevermind", "forget it", "no", "exit", "thanks", "thank you"
}

def is_greeting_or_cancel(query: str) -> bool:
    q = query.lower().strip()
    if q in GREETINGS_AND_CANCEL:
        return True
    return any(q.startswith(g) for g in ["hi ", "hello ", "hey ", "hlo ", "cancel ", "stop "])


def fast_intent_match(query: str) -> str | None:
    q = query.lower().strip()
    
    # Search intent (live sports, matches, current events, weather, news, explicit search requests)
    search_keywords = [
        "live match", "cricket match", "football match", "live score", "current score", 
        "today match", "ongoing match", "latest news", "current news", "weather today", 
        "ipl match", "ipl score", "current price", "today news", "which match",
        "search", "serch", "web pe search", "net pe search", "google search",
        "search karke", "search on web", "google it", "web search"
    ]
    if any(k in q for k in search_keywords):
        return "search"
        
    # PDF intent
    if any(k in q for k in ["pdf banao", "pdf generate", "genrate pdf", "create pdf", "make pdf"]):
        return "pdf"
        
    # PPT intent
    if any(k in q for k in ["powerpoint", "presentation", "slides deck", "slide banao", "create ppt", "genrate ppt"]):
        return "ppt"
        
    # Coding intent (explicit coding requests or typos)
    coding_phrases = [
        "write code", "genrate code", "code banao", "create code", "make code", 
        "code write", "write python", "write javascript", "react component", 
        "express api", "debug error", "fix bug", "build app"
    ]
    if any(k in q for k in coding_phrases):
        return "coding"
        
    # Image intent
    if any(k in q for k in ["generate image", "genrate image", "image banao", "draw image", "create image"]):
        return "image"
        
    return None


def manager_agent(state):
    query = state["query"]
    task_status = state.get("task_status")
    pending_agent = state.get("pending_agent")
    pending_question = state.get("pending_question")
    
    print(f"\n[MANAGER] Processing Query: '{query}'")
    print(f"[MANAGER] Active Task Status: {task_status}, Pending Agent: {pending_agent}")

    # 1. Handle Greetings / Cancellations instantly
    if is_greeting_or_cancel(query):
        print(f"[MANAGER] Greeting or Cancel detected ('{query}'). Clearing pending task & routing to chat.")
        state["task_status"] = "cancelled"
        state["pending_agent"] = None
        state["pending_task"] = None
        state["pending_question"] = None
        state["clarification_attempts"] = 0
        state["collected_requirements"] = {}
        state["selected_agent"] = "chat"
        return state

    # 2. Fast Intent Check for deterministic requests
    matched_fast = fast_intent_match(query)

    # 3. Handle Active Pending Clarification Tasks
    if task_status == "waiting_for_clarification" and pending_agent:
        # If fast intent match detects a completely different agent request (e.g. user asks for search while coding pending)
        if matched_fast and matched_fast != pending_agent:
            print(f"[MANAGER] New Intent Detected ('{matched_fast}'). Cancelling old '{pending_agent}' clarification task.")
            state["task_status"] = "cancelled"
            state["pending_agent"] = None
            state["pending_task"] = None
            state["pending_question"] = None
            state["clarification_attempts"] = 0
            state["collected_requirements"] = {}
            state["selected_agent"] = matched_fast
            return state

        # Use LLM to check if query answers pending_question OR is a NEW request
        try:
            eval_prompt = f"""
{SYSTEM_PROMPT}

-------------------------------------------------
ACTIVE PENDING TASK EVALUATION
-------------------------------------------------
There is currently a pending task:
- Pending Agent: {pending_agent}
- Pending Question Asked To User: "{pending_question}"

The user has now sent: "{query}"

Determine whether this user query is:
A) An ANSWER or details for the pending question above -> Select "{pending_agent}".
B) A NEW UNRELATED request (e.g. asking about sports, search, a new topic) -> Select the appropriate agent for the new query.
"""
            messages_to_send = [
                SystemMessage(content=eval_prompt),
                HumanMessage(content=f"User Query: {query}"),
            ]
            result = manager_chain.invoke(messages_to_send)
            selected = result.selected_agent

            if selected != pending_agent:
                print(f"[MANAGER] Query is a NEW request ({selected}). Cancelling pending '{pending_agent}' task.")
                state["task_status"] = "cancelled"
                state["pending_agent"] = None
                state["pending_task"] = None
                state["pending_question"] = None
                state["clarification_attempts"] = 0
                state["collected_requirements"] = {}
            else:
                print(f"[MANAGER] Query is an ANSWER for pending '{pending_agent}' task. Continuing.")

            state["selected_agent"] = selected
            return state

        except Exception as e:
            print(f"[MANAGER] Pending task evaluation error: {e}")
            # Fallback: if fast match exists use it, else keep pending_agent
            state["selected_agent"] = matched_fast or pending_agent
            return state

    # 4. Standard Manager Routing (No active pending clarification)
    if matched_fast:
        print(f"[MANAGER] Fast Keyword Selected Agent: {matched_fast}")
        state["selected_agent"] = matched_fast
        return state

    try:
        recent_history = state.get("history", [])[-10:]
        history_text = "No recent history."
        if recent_history:
            history_text = "\n".join([f"{msg.get('role', 'user')}: {extract_text(msg.get('content'))}" for msg in recent_history])

        messages_to_send = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"Recent History Context:\n{history_text}\n\nCurrent User Query: {query}"),
        ]

        result = manager_chain.invoke(messages_to_send)
        state["selected_agent"] = result.selected_agent
        print(f"[MANAGER] LLM Selected Agent: {state['selected_agent']}")

    except Exception as e:
        print(f"[MANAGER] Error in Manager Agent: {e}")
        state["selected_agent"] = "chat"

    return state