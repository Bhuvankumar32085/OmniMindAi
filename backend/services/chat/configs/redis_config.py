import os
import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

redis_client = None

try:
    client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    # Test connection
    client.ping()
    redis_client = client
    print("Chat Service Redis Connected Successfully")
except Exception as e:
    print(f"Chat Service Redis Warning: Connection failed ({e}). Falling back to direct MongoDB queries.")
    redis_client = None
