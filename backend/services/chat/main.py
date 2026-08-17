from flask import Flask ,jsonify,Response,request
from flask_cors import CORS 
from dotenv import load_dotenv
from bson import json_util,ObjectId
from configs.db import db
from configs.redis_config import redis_client
from utils.api_response import send_success,send_error
from model.conversation_model import Conversation
from model.message_model import Message
from dataclasses import asdict
from utils.try_catch import try_catch

import os
import json
from datetime import datetime, timezone
load_dotenv()

app = Flask(__name__)
PORT=os.getenv("PORT")


def clear_chat_cache(user_id=None, conversation_id=None):
    if not redis_client:
        return
    try:
        if user_id:
            redis_client.delete(f"chat:conversations:{user_id}")
        if conversation_id:
            redis_client.delete(f"chat:messages:{conversation_id}")
    except Exception as e:
        print(f"Failed to clear Redis chat cache: {e}")


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


@app.post("/conversation")
@try_catch
def create_conversation():
    user_id = request.headers.get("x-user-id")

    if not user_id:
        return send_error("Unauthorized", None, 401)

    conversation = Conversation(
        user_id=user_id,
        title="New Title",
    )

    conversation_dict = asdict(conversation)

    result = db["conversations"].insert_one(conversation_dict)

    conversation_dict["_id"] = str(result.inserted_id)

    # Invalidate conversations list cache for user
    clear_chat_cache(user_id=user_id)

    return send_success(
        "Conversation Created Successfully",
        conversation_dict,
        201,
    )
    
    
@app.get("/conversation")
@try_catch
def get_conversations():

    user_id = request.headers.get("x-user-id")

    if not user_id:
        return send_error("Unauthorized", None, 401)

    cache_key = f"chat:conversations:{user_id}"

    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return send_success(
                    "Conversations fetched successfully (cached)",
                    json.loads(cached_data),
                    200,
                )
        except Exception as e:
            print(f"Redis get conversations error: {e}")

    conversations = list(
        db["conversations"]
        .find({"user_id": user_id})
        .sort("updated_at", -1)
    )

    for conversation in conversations:
        conversation["_id"] = str(conversation["_id"])

    if redis_client:
        try:
            redis_client.set(cache_key, json.dumps(conversations), ex=300) # Cache 5 mins
        except Exception as e:
            print(f"Redis set conversations error: {e}")

    return send_success(
        "Conversations fetched successfully",
        conversations,
        200,
    )
    
    
@app.post("/message")
@try_catch
def create_message():

    body = request.get_json()

    conversation_id = body.get("conversation_id")
    content = body.get("content")
    role = body.get("role", "user")


    print(body)
    if not conversation_id:
        return send_error("Conversation ID is required", None, 400)

    if not content:
        return send_error("Content is required", None, 400)

    # Verify conversation belongs to current user
    conversation = db["conversations"].find_one({
        "_id": ObjectId(conversation_id),
    })

    if not conversation:
        return send_error("Conversation not found", None, 404)

    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
    )

    message_dict = asdict(message)

    result = db["messages"].insert_one(message_dict)

    message_dict["_id"] = str(result.inserted_id)

    # Conversation updated time
    db["conversations"].update_one(
        {"_id": ObjectId(conversation_id)},
        {
            "$set": {
                "updated_at": message.created_at
            }
        },
    )

    # Invalidate cache for messages and conversations list
    user_id = conversation.get("user_id")
    clear_chat_cache(user_id=user_id, conversation_id=conversation_id)

    return send_success(
        "Message saved successfully",
        message_dict,
        201,
    )


@app.get("/message/<conversation_id>")
@try_catch
def get_messages(conversation_id):

    user_id = request.headers.get("x-user-id")

    if not user_id:
        return send_error("Unauthorized", None, 401)

    # Verify conversation belongs to current user
    conversation = db["conversations"].find_one({
        "_id": ObjectId(conversation_id),
        "user_id": user_id,
    })

    if not conversation:
        return send_error("Conversation not found", None, 404)

    cache_key = f"chat:messages:{conversation_id}"

    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return send_success(
                    "Messages fetched successfully (cached)",
                    json.loads(cached_data),
                    200,
                )
        except Exception as e:
            print(f"Redis get messages error: {e}")

    messages = list(
        db["messages"]
        .find({
            "conversation_id": conversation_id
        })
        .sort("created_at", 1)
    )

    for message in messages:
        message["_id"] = str(message["_id"])

    if redis_client:
        try:
            redis_client.set(cache_key, json.dumps(messages), ex=300) # Cache 5 mins
        except Exception as e:
            print(f"Redis set messages error: {e}")

    return send_success(
        "Messages fetched successfully",
        messages,
        200,
    )


@app.patch("/conversation/<conversation_id>")
@try_catch
def update_conversation_title(conversation_id):

    user_id = request.headers.get("x-user-id")

    if not user_id:
        return send_error("Unauthorized", None, 401)

    body = request.get_json()

    title = body.get("title", "").strip()

    if not title:
        return send_error("Title is required", None, 400)

    result = db["conversations"].update_one(
        {
            "_id": ObjectId(conversation_id),
            "user_id": user_id,
        },
        {
            "$set": {
                "title": title,
            }
        },
    )

    if result.matched_count == 0:
        return send_error("Conversation not found", None, 404)

    conversation = db["conversations"].find_one({
        "_id": ObjectId(conversation_id)
    })

    conversation["_id"] = str(conversation["_id"])

    # Invalidate cache for conversations list
    clear_chat_cache(user_id=user_id, conversation_id=conversation_id)

    return send_success(
        "Conversation title updated successfully",
        conversation,
        200,
    )


@app.route("/message/<message_id>", methods=["PATCH", "PUT"])
@try_catch
def update_message_content(message_id):
    user_id = request.headers.get("x-user-id")
    body = request.get_json() or {}
    content = body.get("content")
    conversation_id = body.get("conversation_id")

    if not content:
        return send_error("Content is required", None, 400)

    print(f"[CODE UPDATE]\nmessageId: {message_id}\nuserId: {user_id}")

    message = None
    if message_id and message_id != "undefined" and message_id != "null":
        query = {"_id": message_id}
        try:
            query = {"$or": [{"_id": ObjectId(message_id)}, {"_id": message_id}]}
        except Exception:
            query = {"_id": message_id}
        message = db["messages"].find_one(query)

    if message:
        print(f"[CODE UPDATE]\nExisting message found: {message['_id']}")
    elif conversation_id:
        print(f"[CODE UPDATE]\nMessage {message_id} not found by ID. Attempting fallback for conversationId: {conversation_id}")
        message = db["messages"].find_one(
            {"conversation_id": conversation_id, "role": "assistant"},
            sort=[("created_at", -1)]
        )
        if message:
            print(f"[CODE UPDATE]\nFallback found assistant message ID: {message['_id']}")

    if not message:
        print(f"[CODE UPDATE]\nFAILED: Message {message_id} not found in database.")
        return send_error("Message not found to update", None, 404)

    target_conv_id = message.get("conversation_id") or conversation_id

    # Verify conversation ownership if user_id is supplied
    if user_id:
        conversation = db["conversations"].find_one({
            "_id": ObjectId(target_conv_id),
            "user_id": user_id
        })
        if not conversation:
            print(f"[CODE UPDATE]\nFAILED: Conversation {target_conv_id} does not belong to user {user_id}")
            return send_error("Unauthorized to edit message in this conversation", None, 403)

    now_iso = datetime.now(timezone.utc).isoformat()

    print(f"[CODE UPDATE]\nUpdating existing message: {message['_id']}")
    db["messages"].update_one(
        {"_id": message["_id"]},
        {
            "$set": {
                "content": content,
                "updated_at": now_iso,
            }
        },
    )

    updated_message = db["messages"].find_one({"_id": message["_id"]})
    updated_message["_id"] = str(updated_message["_id"])

    clear_chat_cache(user_id=user_id, conversation_id=target_conv_id)
    print(f"[CODE UPDATE]\nDatabase update successful: {updated_message['_id']}")
    print(f"[CODE UPDATE]\nReturning updated message: {updated_message['_id']}")

    return send_success("Message updated successfully", updated_message, 200)
    
    
    
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=True,
    )
    
    
#  uv run watchfiles "uv run main.py"