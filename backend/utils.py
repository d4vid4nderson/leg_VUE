from typing import Dict
from .models import Category

_KEYWORD_MAP: Dict[Category, list[str]] = {
    "education": ["education", "school", "university", "student"],
    "healthcare": ["health", "medical", "hospital"],
    "engineering": ["infrastructure", "technology", "cybersecurity"],
    "civic": ["government", "policy", "legislature"],
}

def categorize_text(text: str) -> Category:
    lower = text.lower()
    for cat, keywords in _KEYWORD_MAP.items():
        for kw in keywords:
            if kw in lower:
                return cat
    return "not-applicable"
