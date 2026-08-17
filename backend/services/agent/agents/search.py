from langchain_tavily import TavilySearch
from configs.llm import get_llm
from configs.models import SEARCH_MODEL
from utils.content import extract_text
import os

search_tool = TavilySearch(
    api_key=os.getenv("TAVILY_API_KEY"),
    max_results=5,
    search_depth="advanced",
    topic="general",
)

def resolve_search_query(user_query: str, history: list) -> str:
    """
    If user_query is a follow-up command (e.g. 'web pe search karke batao', 'search on web'),
    infer what topic they want to search from the preceding conversation history.
    """
    if not history:
        return user_query

    recent_messages = history[-6:]
    formatted_history = "\n".join([f"{m.get('role', 'user')}: {extract_text(m.get('content'))}" for m in recent_messages if extract_text(m.get('content')).strip()])

    if not formatted_history.strip():
        return user_query

    prompt = f"""
Given the following conversation history and the latest user query, generate a single, highly optimized web search query in English.
If the user's query is a follow-up command (e.g. "search on web", "web pe search karke batao", "google it", "batao net pe dekh ke"), infer the target topic from the conversation history.

Conversation History:
{formatted_history}

Latest User Query: "{user_query}"

Output ONLY the search query string without any quotes, preambles, or markdown formatting.
"""
    try:
        llm = get_llm(model=SEARCH_MODEL, temperature=0.0)
        response = llm.invoke(prompt)
        resolved_q = extract_text(response.content).strip().strip('"').strip("'")
        if resolved_q:
            print(f"[SEARCH] Resolved contextual search query: '{resolved_q}' (Original: '{user_query}')")
            return resolved_q
    except Exception as e:
        print(f"[SEARCH] Error resolving search query: {e}")

    return user_query


def search_agent(state):
    print("===== Search Agent =====")
    user_query = state.get("query", "")
    history = state.get("history", [])

    effective_query = resolve_search_query(user_query, history)

    try:
        results = search_tool.invoke(
            {"query": effective_query}
        )

        return {
            "search_result": results
        }

    except Exception as e:
        print(f"Search Agent Error: {e}")

        return {
            "search_result": None
        }