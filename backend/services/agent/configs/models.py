from dotenv import load_dotenv
import os

load_dotenv()

CHAT_MODEL = os.getenv("CHAT_MODEL")

CODING_MODEL = os.getenv("CODING_MODEL")

REVIEW_MODEL = os.getenv("REVIEW_MODEL")

PDF_MODEL = os.getenv("PDF_MODEL")

PPT_MODEL = os.getenv("PPT_MODEL")

RAG_MODEL = os.getenv("RAG_MODEL")

MANAGER_MODEL = os.getenv("MANAGER_MODEL")

IMAGE_MODEL = os.getenv("IMAGE_MODEL") 

CLARIFICATION_MODEL = os.getenv("CLARIFICATION_MODEL") 

SEARCH_MODEL = os.getenv("SEARCH_MODEL")

PPT_TEST_MODEL = os.getenv("PPT_TEST_MODEL")