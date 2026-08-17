from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Conversation:
    user_id: str

    title: str = "New Chat"

    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)