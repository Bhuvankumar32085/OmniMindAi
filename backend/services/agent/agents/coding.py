from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from configs.llm import get_llm
from configs.models import CODING_MODEL
from utils.content import text_content, extract_text
import os

load_dotenv()

coding_llm = get_llm(
    model=CODING_MODEL,
)

SYSTEM_PROMPT = """
You are the Coding Agent of OmniMindAI.

You are a senior software engineer responsible for writing high-quality production-ready code.

You may receive requests in two modes:

1. Initial Coding Mode
- Generate clean, readable, production-ready code fulfilling the user request.

2. Revision Mode
- The Review Agent provided feedback describing specific issues.
- Improve your previous solution based on that feedback.
- Fix every issue mentioned in the feedback while preserving all correct parts of the code.

3. User Refinement / Modification Mode
- The user has provided an existing code snippet and requested modifications, enhancements, or fixes.
- Retain all working logic and structure from the user's provided code.
- Implement the requested improvements cleanly.
- Output the complete, production-ready updated code in a clean Markdown code block so it can be previewed/run live.

Guidelines:
- Produce clean, readable, and maintainable code.
- Follow language-specific best practices.
- For web projects (HTML/CSS/JS), combine them cleanly or provide a complete single runnable HTML file with embedded <style> and <script> tags when appropriate so it runs seamlessly in live preview.
- Use Markdown code blocks.
- Explain important architectural decisions briefly after the code.
"""

def coding_agent(state):
    print("\n===== Coding Agent =====")

    try:
        if state.get("review_status") == "needs_fix":
            prev_code = extract_text(state.get("final_response", ""))
            print(f"[CODING] Revision Mode (Review Attempt {state.get('review_attempt', 0)})")
            user_input = f"""
Original User Request:
{state['query']}

Previous Solution:
{prev_code}

Review Feedback:
{state.get('review_feedback', '')}

Improve the previous solution according to the review feedback.
Preserve all correct parts of the existing solution.
Only modify what is necessary.
"""
        else:
            print("[CODING] Initial Generation Mode")
            user_input = state["query"]
            collected = state.get("collected_requirements", {})
            if collected:
                req_details = "\n".join([f"- {k}: {v}" for k, v in collected.items() if v])
                user_input = f"{user_input}\n\nProject Requirements:\n{req_details}"

        response = coding_llm.invoke(
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=user_input),
            ]
        )

        return {
            "final_response": text_content(response.content)
        }

    except Exception as e:
        print(f"[CODING] Error in Coding Agent: {e}")
        return {
            "final_response": text_content("Sorry, an error occurred while generating code.")
        }
