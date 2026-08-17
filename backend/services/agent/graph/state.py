from typing import Any, TypedDict, Literal


class AgentState(TypedDict):
    query: str
    user_id: str
    user_name: str
    user_email: str
    selected_agent: Literal[
        "chat",
        "search",
        "coding",
        "pdf",
        "ppt",
        "image",
        "rag",
    ] | None

    review_status: Literal[
        "approved",
        "needs_fix",
    ] | None

    review_feedback: str | None
    search_result: str | None
    review_attempt: int
    final_response: str | dict[str, Any] | None
    review_score: float | None
    history: list[dict]
    
    # Task Orchestration Fields
    task_id: str | None
    task_status: Literal[
        "pending",
        "waiting_for_clarification",
        "running",
        "reviewing",
        "completed",
        "failed",
        "cancelled"
    ] | None
    pending_agent: str | None
    pending_task: str | None
    pending_question: str | None
    clarification_attempts: int
    collected_requirements: dict
    
    # Billing & Credit Protection Fields
    insufficient_credits: bool | None
    insufficient_credit_data: dict | None

