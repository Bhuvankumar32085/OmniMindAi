import requests


def save_message(
    chat_service_url: str,
    conversation_id: str,
    content: str,
    role: str,
):
    response = requests.post(
        f"{chat_service_url}/message",
        json={
            "conversation_id": conversation_id,
            "content": content,
            "role": role,
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def get_messages(
    chat_service_url: str,
    conversation_id: str,
    user_id: str,
):
    if not conversation_id or not user_id:
        return []
        
    try:
        response = requests.get(
            f"{chat_service_url}/message/{conversation_id}",
            headers={"x-user-id": user_id},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return []


def update_message_in_db(
    chat_service_url: str,
    message_id: str,
    content: any,
    user_id: str = None,
    conversation_id: str = None,
):
    headers = {"x-user-id": user_id} if user_id else {}
    payload = {"content": content}
    if conversation_id:
        payload["conversation_id"] = conversation_id

    target_id = message_id if (message_id and message_id != "undefined" and message_id != "null") else "latest"

    response = requests.patch(
        f"{chat_service_url}/message/{target_id}",
        json=payload,
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()