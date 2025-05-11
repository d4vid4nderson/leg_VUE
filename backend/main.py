from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from .models import ExecutiveOrderResponse, PageMeta, ExecutiveOrder
from .fetcher import fetch_executive_orders
from .ai import summarize_text
from .utils import categorize_text

app = FastAPI(title="PoliticalVue API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
_state_data = json.loads(Path(__file__).parent / "state_orders.json".read_text())

@app.get("/api/executive-orders", response_model=ExecutiveOrderResponse)
async def get_executive_orders(page: int=1, per_page: int=25):
    try:
        orders, total = await fetch_executive_orders(page=page, per_page=per_page)
        meta = PageMeta(page=page, per_page=per_page, total_results=total,
                         total_pages=(total+per_page-1)//per_page)
        return {"results": orders, "meta": meta}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.get("/api/legislation", response_model=ExecutiveOrderResponse)
async def get_legislation(state: str=Query(...)):
    raw = _state_data.get(state)
    if raw is None:
        raise HTTPException(404, f"No legislation for {state}")
    items = [ExecutiveOrder(**{**item, "category": categorize_text(item.get("title",""))}) for item in raw]
    meta = PageMeta(page=1, per_page=len(items), total_results=len(items), total_pages=1)
    return {"results": items, "meta": meta}

@app.post("/api/analysis")
async def ai_analysis(order_text: str):
    try:
        summary = await summarize_text(order_text)
        return {"analysis": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
