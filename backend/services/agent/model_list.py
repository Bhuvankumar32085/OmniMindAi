from dotenv import load_dotenv
import os
import requests

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("GEMINI_API_KEY environment variable was not found.")
    print("Please set your Gemini API key first.")
    exit(1)

url = "https://generativelanguage.googleapis.com/v1beta/models"

headers = {
    "x-goog-api-key": API_KEY
}

params = {
    "pageSize": 1000
}

try:
    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=30
    )

    if response.status_code != 200:
        print("API Error")
        print("Status:", response.status_code)
        print("Response:", response.text)
        exit(1)

    data = response.json()

    models = data.get("models", [])

    print("\n" + "=" * 80)
    print("        GEMINI MODELS AVAILABLE FOR YOUR API KEY")
    print("=" * 80)

    generate_models = []

    for model in models:
        name = model.get("name", "")
        display_name = model.get("displayName", "")
        description = model.get("description", "")
        supported_methods = model.get("supportedGenerationMethods", [])

        # Only include models that support generateContent
        if "generateContent" in supported_methods:
            generate_models.append(model)

    if not generate_models:
        print("\n No models supporting generateContent were found.")
    else:
        for i, model in enumerate(generate_models, 1):

            name = model.get("name", "")
            display_name = model.get("displayName", "")
            description = model.get("description", "")
            input_token_limit = model.get("inputTokenLimit", "N/A")
            output_token_limit = model.get("outputTokenLimit", "N/A")
            methods = model.get("supportedGenerationMethods", [])

            print(f"\n{i}. {name}")
            print(f"   Display Name       : {display_name}")
            print(f"   Input Token Limit  : {input_token_limit}")
            print(f"   Output Token Limit : {output_token_limit}")
            print(f"   Methods            : {', '.join(methods)}")

            if description:
                print(f"   Description        : {description}")

    print("\n" + "=" * 80)
    print(f"TOTAL GENERATECONTENT MODELS: {len(generate_models)}")
    print("=" * 80)

except requests.exceptions.RequestException as e:
    print("Network/API request failed:")
    print(e)

except Exception as e:
    print("Unexpected error:")
    print(e)