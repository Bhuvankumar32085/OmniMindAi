import uuid
from utils.billing_service import check_and_reserve_credits, finalize_credit_charge

from agents.manager import manager_agent
from agents.clarification import clarification_agent
from agents.chat import chat_agent
from agents.search import search_agent
from agents.coding import coding_agent
from agents.pdf import pdf_agent
from agents.ppt import ppt_agent
from agents.ppt_test import ppt_test_agent
from agents.image import image_agent
from agents.review import review_agent
from agents.rag import rag_agent


def create_billed_node(agent_name: str, agent_fn):
    def billed_node(state):
        if state.get("task_status") == "failed" and state.get("insufficient_credits"):
            return state

        user_id = state.get("user_id")
        task_id = state.get("task_id", "")
        conversation_id = state.get("conversation_id", "")
        attempt = state.get("review_attempt", 0)
        execution_id = f"{task_id}_{agent_name}_{attempt}_{uuid.uuid4().hex[:6]}"

        ok, detail = check_and_reserve_credits(user_id, agent_name, task_id, execution_id)
        if not ok:
            return {
                "task_status": "failed",
                "insufficient_credits": True,
                "insufficient_credit_data": detail,
                "final_response": {
                    "success": False,
                    "code": "INSUFFICIENT_CREDITS",
                    "message": "You don't have enough AI Credits for this operation.",
                    "data": detail
                }
            }

        try:
            result = agent_fn(state)
            finalize_credit_charge(user_id, agent_name, task_id, conversation_id, execution_id, success=True)
            return result
        except Exception as e:
            finalize_credit_charge(user_id, agent_name, task_id, conversation_id, execution_id, success=False)
            raise e

    return billed_node


def register_nodes(builder):
    builder.add_node("manager", create_billed_node("manager", manager_agent))
    builder.add_node("clarification", create_billed_node("clarification", clarification_agent))
    builder.add_node("chat", create_billed_node("chat", chat_agent))
    builder.add_node("search", create_billed_node("search", search_agent))
    builder.add_node("coding", create_billed_node("coding", coding_agent))
    builder.add_node("pdf", create_billed_node("pdf", pdf_agent))
    builder.add_node("ppt", create_billed_node("ppt", ppt_agent))
    builder.add_node("ppt_test", create_billed_node("ppt_test", ppt_test_agent))
    builder.add_node("image", create_billed_node("image", image_agent))
    builder.add_node("rag", create_billed_node("rag", rag_agent))
    builder.add_node("review", create_billed_node("review", review_agent))