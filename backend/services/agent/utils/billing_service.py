from dotenv import load_dotenv
load_dotenv()
from datetime import datetime, timezone
import uuid
from pymongo import ReturnDocument
from configs.db import db
import os

try:
    import redis
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    r_client = redis.Redis(host=redis_host, port=redis_port, db=0, decode_responses=True)
except Exception:
    r_client = None

def clear_user_credit_cache(user_id: str):
    if not user_id or not r_client:
        return
    try:
        r_client.delete(f"user:credits:{user_id}")
    except Exception as e:
        print(f"Failed to clear user credit cache in Redis: {e}")

def _get_credit_cost(env_key: str, default_cost: int) -> int:
    val = os.getenv(env_key)
    if val is None:
        return default_cost
    try:
        return int(str(val).strip())
    except (ValueError, TypeError):
        return default_cost

AGENT_CREDIT_COSTS = {
    "manager": _get_credit_cost("MANAGER_CREDIT_COST", 0),
    "clarification": _get_credit_cost("CLARIFICATION_CREDIT_COST", 0),
    "chat": _get_credit_cost("CHAT_CREDIT_COST", 2),
    "search": _get_credit_cost("SEARCH_CREDIT_COST", 5),
    "rag": _get_credit_cost("RAG_CREDIT_COST", 5),
    "coding": _get_credit_cost("CODING_CREDIT_COST", 5),
    "ppt": _get_credit_cost("PPT_CREDIT_COST", 10),
    "image": _get_credit_cost("IMAGE_CREDIT_COST", 10),
    "pdf": _get_credit_cost("PDF_CREDIT_COST", 10),
    "ppt_test": _get_credit_cost("PPT_TEST_CREDIT_COST", 2),
    "review": _get_credit_cost("REVIEW_CREDIT_COST", 2)
}

def ensure_credit_account(user_id: str):
    """
    Idempotently creates a CreditAccount with 100 free credits if one does not exist for user_id.
    """
    if not user_id:
        return None

    col = db["creditaccounts"]
    account = col.find_one({"userId": user_id})
    if not account:
        now = datetime.now(timezone.utc)
        try:
            account = {
                "userId": user_id,
                "balance": 100,
                "totalGranted": 100,
                "totalPurchased": 0,
                "totalConsumed": 0,
                "reserved": 0,
                "createdAt": now,
                "updatedAt": now
            }
            col.insert_one(account)

            db["credittransactions"].insert_one({
                "userId": user_id,
                "type": "FREE_GRANT",
                "amount": 100,
                "balanceBefore": 0,
                "balanceAfter": 100,
                "source": "WELCOME_BONUS",
                "referenceId": f"welcome_{user_id}",
                "description": "Initial 100 Free AI Credits",
                "createdAt": now,
                "updatedAt": now
            })
        except Exception:
            account = col.find_one({"userId": user_id})

    return account


def check_and_reserve_credits(user_id: str, agent_name: str, task_id: str = "", execution_id: str = "") -> tuple[bool, dict]:
    """
    Checks if user has sufficient credits and atomically reserves cost from balance.
    Returns (True, detail) if sufficient (or cost == 0), or (False, detail) if insufficient.
    """
    if not user_id:
        return True, {"balance": 0, "required": 0}

    cost = AGENT_CREDIT_COSTS.get(agent_name, 0)
    col = db["creditaccounts"]

    if cost == 0:
        account = col.find_one({"userId": user_id})
        current_balance = account.get("balance", 100) if account else 100
        return True, {"balance": current_balance, "required": 0}

    ensure_credit_account(user_id)

    account = col.find_one_and_update(
        {"userId": user_id, "balance": {"$gte": cost}},
        {"$inc": {"balance": -cost, "reserved": cost}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER
    )

    if not account:
        current_acc = col.find_one({"userId": user_id})
        current_balance = current_acc.get("balance", 0) if current_acc else 0
        return False, {
            "balance": current_balance,
            "required": cost,
            "agent": agent_name
        }

    clear_user_credit_cache(user_id)

    return True, {
        "balance": account.get("balance", 0),
        "reserved": account.get("reserved", 0),
        "cost": cost,
        "execution_id": execution_id
    }


def finalize_credit_charge(
    user_id: str,
    agent_name: str,
    task_id: str,
    conversation_id: str,
    execution_id: str,
    success: bool,
    model: str = "gemini-model"
) -> dict:
    """
    Permanently charges credits if success == True, or releases reserved credits if success == False.
    Always records AIUsage entry and (if charge finalized) a CreditTransaction.
    Idempotent on execution_id.
    """
    if not user_id:
        return {}

    cost = AGENT_CREDIT_COSTS.get(agent_name, 0)
    now = datetime.now(timezone.utc)
    col = db["creditaccounts"]

    if cost == 0:
        db["aiusages"].insert_one({
            "userId": user_id,
            "conversationId": conversation_id,
            "taskId": task_id,
            "agent": agent_name,
            "model": model,
            "creditCost": 0,
            "status": "success" if success else "failed",
            "createdAt": now,
            "updatedAt": now
        })
        return {"status": "zero_cost"}

    # Idempotency check: Has this execution_id already been charged?
    if execution_id:
        existing_tx = db["credittransactions"].find_one({"referenceId": execution_id})
        if existing_tx:
            account = col.find_one({"userId": user_id})
            return {"status": "already_processed", "cost": cost, "balance": account.get("balance", 0) if account else 0}

    if success:
        updated_acc = col.find_one_and_update(
            {"userId": user_id, "reserved": {"$gte": cost}},
            {"$inc": {"reserved": -cost, "totalConsumed": cost}, "$set": {"updatedAt": now}},
            return_document=ReturnDocument.AFTER
        )
        if not updated_acc:
            updated_acc = col.find_one_and_update(
                {"userId": user_id},
                {"$inc": {"totalConsumed": cost}, "$set": {"updatedAt": now}},
                return_document=ReturnDocument.AFTER
            )

        balance_after = updated_acc.get("balance", 0) if updated_acc else 0

        try:
            db["credittransactions"].insert_one({
                "userId": user_id,
                "type": "USAGE",
                "amount": -cost,
                "balanceBefore": balance_after + cost,
                "balanceAfter": balance_after,
                "source": "AI_WORKFLOW",
                "referenceId": execution_id or f"{task_id}_{agent_name}_{uuid.uuid4().hex[:6]}",
                "description": f"Used {agent_name} agent ({cost} credits)",
                "createdAt": now,
                "updatedAt": now
            })
        except Exception:
            pass

        db["aiusages"].insert_one({
            "userId": user_id,
            "conversationId": conversation_id,
            "taskId": task_id,
            "agent": agent_name,
            "model": model,
            "creditCost": cost,
            "status": "success",
            "createdAt": now,
            "updatedAt": now
        })
        clear_user_credit_cache(user_id)
        return {"status": "charged", "cost": cost}
    else:
        col.update_one(
            {"userId": user_id, "reserved": {"$gte": cost}},
            {"$inc": {"balance": cost, "reserved": -cost}, "$set": {"updatedAt": now}}
        )

        db["aiusages"].insert_one({
            "userId": user_id,
            "conversationId": conversation_id,
            "taskId": task_id,
            "agent": agent_name,
            "model": model,
            "creditCost": 0,
            "status": "failed",
            "createdAt": now,
            "updatedAt": now
        })
        clear_user_credit_cache(user_id)
        return {"status": "released", "cost": 0}
