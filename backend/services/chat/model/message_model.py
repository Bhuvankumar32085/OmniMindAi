from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Message:
    conversation_id: str

    role: str          # user | assistant
    content: str

    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)