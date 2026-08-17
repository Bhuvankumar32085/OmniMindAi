import os
from langgraph.graph import START, END

MAX_REVIEW_ATTEMPTS = int(
    os.getenv("MAX_REVIEW_ATTEMPTS", 3)
)

"""
REVIEW ROUTE SEMANTICS:
- review_attempt < MAX_REVIEW_ATTEMPTS and status == "needs_fix": Route back to "coding"
- review_attempt >= MAX_REVIEW_ATTEMPTS or status == "approved": Route to END (approved/accepted)
"""

def clarification_router(state):
    if state.get("task_status") in ["waiting_for_clarification", "failed"] or state.get("insufficient_credits"):
        return "end"

    agent = state.get("selected_agent", "chat")
    if agent not in ["chat", "search", "coding", "pdf", "ppt", "image", "rag"]:
        return "chat"
    return agent


def review_route(state):
    if state.get("task_status") == "failed" or state.get("insufficient_credits"):
        return "approved"

    status = state.get("review_status")
    attempt = state.get("review_attempt", 0)

    print(f"\n[REVIEW_ROUTE] Evaluating: Status='{status}', Attempts={attempt}/{MAX_REVIEW_ATTEMPTS}")

    if status == "approved":
        print("[REVIEW_ROUTE] Solution Approved -> Routing to END.")
        return "approved"

    if attempt >= MAX_REVIEW_ATTEMPTS:
        print(f"[REVIEW_ROUTE] Maximum review attempts ({MAX_REVIEW_ATTEMPTS}) reached -> Halting revision & Routing to END.")
        return "approved"

    print(f"[REVIEW_ROUTE] Revision Needed -> Routing back to 'coding' (Next Attempt: {attempt + 1}).")
    return "coding"


def ppt_review_route(state):
    if state.get("task_status") == "failed" or state.get("insufficient_credits"):
        return "approved"

    status = state.get("review_status")
    attempt = state.get("review_attempt", 0)

    if status == "approved":
        return "approved"
    
    if attempt >= MAX_REVIEW_ATTEMPTS:
        print(f"[PPT_REVIEW_ROUTE] Maximum PPT review attempts ({MAX_REVIEW_ATTEMPTS}) reached -> Routing to END.")
        return "approved"
        
    return "ppt"


def register_edges(builder):

    builder.add_edge(START, "manager")
    
    # Manager always goes to clarification
    builder.add_edge("manager", "clarification")

    # Clarification either asks a question (END) or goes to the target agent
    builder.add_conditional_edges(
        "clarification",
        clarification_router,
        {
            "end": END,
            "chat": "chat",
            "search": "search",
            "coding": "coding",
            "pdf": "pdf",
            "ppt": "ppt",
            "image": "image",
            "rag": "rag",
        },
    )

    builder.add_edge("search", "chat")

    builder.add_edge("chat", END)

    builder.add_edge("coding", "review")
    builder.add_edge("pdf", END)
    builder.add_edge("ppt", "ppt_test")
    builder.add_edge("image", END)
    builder.add_edge("rag", END)

    builder.add_conditional_edges(
        "review",
        review_route,
        {
            "approved": END,
            "coding": "coding",
        },
    )

    builder.add_conditional_edges(
        "ppt_test",
        ppt_review_route,
        {
            "approved": END,
            "ppt": "ppt",
        },
    )