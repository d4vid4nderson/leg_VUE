import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.openai import OpenAIClient

AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_OPENAI_KEY")
MODEL_NAME = "summarize-gpt-4.1"

client = OpenAIClient(AZURE_ENDPOINT, AzureKeyCredential(AZURE_KEY))

async def summarize_text(text: str) -> str:
    prompt = ("Summarize the following executive order, list key points, "
              "potential impacts, and historical context:

" + text)
    response = client.get_chat_completion(
        MODEL_NAME,
        messages=[{"role":"user","content":prompt}],
        temperature=0.2
    )
    return response.choices[0].message.content
