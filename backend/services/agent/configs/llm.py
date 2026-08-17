import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()


def get_llm(
    model: str,
    temperature: float = 0,
    streaming: bool = False,
):
    api_key = os.getenv("GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        streaming=streaming,
        google_api_key=api_key,
    )