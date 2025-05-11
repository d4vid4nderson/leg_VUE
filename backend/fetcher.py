import httpx
from typing import Tuple
from .models import ExecutiveOrder
from .utils import categorize_text

FEDREG_BASE = "https://api.federalregister.gov/v1/documents"

async def fetch_executive_orders(year: int=2025, page: int=1, per_page: int=25) -> Tuple[list[ExecutiveOrder], int]:
    params = {
        "conditions[publication_type]": "Presidential Document",
        "subtype[]": "Executive Order",
        "year": year,
        "page": page,
        "per_page": per_page
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(FEDREG_BASE, params=params)
        resp.raise_for_status()
        data = resp.json()

    raw = data.get("results", [])
    total = data.get("count", 0)
    orders = []
    for item in raw:
        blob = f"{item.get('title','')} {item.get('abstract','')} {item.get('summary','')}"
        cat = categorize_text(blob)
        orders.append(ExecutiveOrder(**{
            **item,
            "category": cat
        }))
    return orders, total
