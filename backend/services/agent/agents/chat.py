from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from configs.llm import get_llm
from configs.models import CHAT_MODEL
from utils.content import extract_text
import traceback

load_dotenv()

SYSTEM_PROMPT = """
You are the Chat Agent of OmniMindAI.

You are responsible for generating clear, natural, and user-friendly responses.

Guidelines:
- Be helpful, accurate, and professional.
- Remember preceding conversation context and answer questions about chat history when asked.
- Remember names, facts, and topics mentioned earlier in the conversation.
- Write well-structured responses using Markdown when appropriate.
- Use headings, bullet points, and tables whenever they improve readability.
- If the user writes in Hindi or Hinglish, reply in the same language.
- If the user writes in English, reply in English.
"""

def chat_agent(state):
    print("===== Chat Agent =====")

    try:
        messages = [SystemMessage(content=SYSTEM_PROMPT)]
        
        # Add conversation history (up to last 30 messages) for deep conversational memory
        history = state.get("history", [])
        if history:
            current_q = state.get("query", "").strip()
            # Exclude current message if it's already recorded at the tail of history
            recent_history = history[:-1] if (history and extract_text(history[-1].get("content")).strip() == current_q) else history
            
            # Use last 30 messages (approx 15 turns) to retain names, facts, and context
            for msg in recent_history[-30:]:
                role = msg.get("role")
                text = extract_text(msg.get("content"))
                if not text or not text.strip():
                    continue
                if role == "user":
                    messages.append(HumanMessage(content=text))
                elif role == "assistant":
                    messages.append(AIMessage(content=text))

        # Add current user query (or search result augmented query)
        if state.get("search_result"):
            user_input = f"User Query:\n{state['query']}\n\nSearch Results:\n{state['search_result']}\n\nUsing the above search results, generate the final response for the user."
        else:
            user_input = state["query"]

        messages.append(HumanMessage(content=user_input))

        chat_llm = get_llm(model=CHAT_MODEL, temperature=0.7)

        response = chat_llm.invoke(messages)

        final_response = extract_text(response.content)

        print("===== Chat Agent Response Generated with Deep Memory =====")

        return {
            "final_response": final_response
        }

    except Exception as e:
        print(f"Chat Agent Error: {e}")
        traceback.print_exc()

        return {
            "final_response": "Sorry, something went wrong."
        }
