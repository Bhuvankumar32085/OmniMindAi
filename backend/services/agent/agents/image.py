import base64
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

from configs.models import IMAGE_MODEL

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def image_agent(state):
    print("===== Image Agent =====")

    try:
        prompt = state["query"]

        response = client.models.generate_content(
            model=IMAGE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio="16:9",
                    image_size="2K",
                ),
            ),
        )

        # Find generated image in the response
        image_parts = [
            part
            for part in response.parts
            if part.inline_data
        ]

        if not image_parts:
            print("No image was returned by the model.")

            return {
                "final_response": {
                    "type": "error",
                    "message": "The image model did not return an image."
                }
            }

        generated_image = image_parts[0]

        image_bytes = generated_image.inline_data.data

        base64_string = base64.b64encode(
            image_bytes
        ).decode("utf-8")

        mime_type = (
            generated_image.inline_data.mime_type
            or "image/png"
        )

        print("✅ Image generated successfully.")

        return {
            "final_response": {
                "type": "image",
                "base64_data": base64_string,
                "mime_type": mime_type,
            }
        }

    except Exception as e:

        print(f" Image Agent Error: {e}")

        return {
            "final_response": {
                "type": "error",
                "message": f"Something went wrong: {str(e)}"
            }
        }