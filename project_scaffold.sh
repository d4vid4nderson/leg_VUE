#!/usr/bin/env bash
set -e

# --------------------------------------------------------------------------
# project_scaffold.sh: Scaffold PoliticalVue project (backend, frontend, Docker)
# Usage:
#   chmod +x project_scaffold.sh
#   ./project_scaffold.sh
# --------------------------------------------------------------------------

# Create directory structure
mkdir -p backend frontend/src/components

# Backend: Poetry config
cat > backend/pyproject.toml << 'EOF'
[tool.poetry]
name = "politicalvue-backend"
version = "0.1.0"
description = "Backend API for PoliticalVue"
authors = ["David Anderson <david.anderson@moregroup-inc.com>"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.95.1"
uvicorn = "^0.23.1"
pydantic = "^2.0"
httpx = "^0.24.0"
azure-core = "^1.30.0"
azure-ai-openai = "^1.0.0"

[tool.poetry.dev-dependencies]
# Add tests or linters here
EOF

# Backend: models.py
cat > backend/models.py << 'EOF'
from datetime import date
from pydantic import BaseModel, HttpUrl, Field
from typing import Literal, List, Optional

Category = Literal["civic", "education", "healthcare", "engineering", "not-applicable"]

class ExecutiveOrder(BaseModel):
    document_number: str
    executive_order_number: str
    title: str
    signing_date: date
    publication_date: date
    html_url: HttpUrl
    pdf_url: HttpUrl
    type: str
    subtype: str
    category: Category = Field(..., description="Auto-assigned tag based on content")

class PageMeta(BaseModel):
    page: int
    per_page: int
    total_results: Optional[int]
    total_pages: Optional[int]

class ExecutiveOrderResponse(BaseModel):
    results: List[ExecutiveOrder]
    meta: PageMeta
EOF

# Backend: utils.py
cat > backend/utils.py << 'EOF'
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
EOF

# Backend: fetcher.py
cat > backend/fetcher.py << 'EOF'
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
EOF

# Backend: ai.py
cat > backend/ai.py << 'EOF'
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
EOF

# Backend: main.py
cat > backend/main.py << 'EOF'
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
EOF

# Backend: state data
cat > backend/state_orders.json << 'EOF'
{ "California": [ { "document_number":"CA-2025-001","executive_order_number":"N-01-25","title":"Executive Order to Accelerate California's Clean Energy Transition","signing_date":"2025-01-15","publication_date":"2025-01-16","html_url":"https://gov.ca.gov/clean-energy","pdf_url":"https://gov.ca.gov/clean-energy.pdf","type":"State Document","subtype":"Executive Order" } ] }
EOF

# Frontend: package.json
cat > frontend/package.json << 'EOF'
{ "name":"politicalvue-frontend","version":"0.1.0","private":true,"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0","lucide-react":"^0.248.0"},"scripts":{"start":"vite","build":"vite build"},"devDependencies":{"vite":"^4.0.0","tailwindcss":"^3.3.0","postcss":"^8.4.0","autoprefixer":"^10.4.0"} }
EOF

# Frontend: Tailwind & PostCSS
cat > frontend/tailwind.config.js << 'EOF'
module.exports={content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{}},plugins:[]} 
EOF
cat > frontend/postcss.config.js << 'EOF'
module.exports={plugins:[require('tailwindcss'),require('autoprefixer')]} 
EOF

# Frontend: src/index.js & CSS
cat > frontend/src/index.js << 'EOF'
import React from 'react';import ReactDOM from 'react-dom/client';import App from './App';import './index.css';ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
EOF
cat > frontend/src/index.css << 'EOF'
@tailwind base;@tailwind components;@tailwind utilities;
EOF

# Frontend: App.jsx
cat > frontend/src/App.jsx << 'EOF'
import {useState,useEffect,useMemo} from 'react';import OrderCard from './components/OrderCard';const App=()=>{const[executiveOrders,setExecutiveOrders]=useState([]);const[loading,setLoading]=useState(false);const[error,setError]=useState(null);const[selectedState,setSelectedState]=useState(null);const[activeFilter,setActiveFilter]=useState(null);const[searchTerm,setSearchTerm]=useState('');const[expandedOrderId,setExpandedOrderId]=useState(null);useEffect(()=>{fetchData();},[selectedState]);const fetchData=async()=>{setLoading(true);setError(null);try{const url=selectedState?`/api/legislation?state=${encodeURIComponent(selectedState)}`:`/api/executive-orders?page=1&per_page=25`;const res=await fetch(url);if(!res.ok)throw new Error(res.statusText);const{results}=await res.json();setExecutiveOrders(results);}catch(err){setError(err.message);}finally{setLoading(false);}};const filteredOrders=useMemo(()=>{let list=executiveOrders;if(searchTerm){const term=searchTerm.toLowerCase();list=list.filter(o=>o.title.toLowerCase().includes(term));}if(activeFilter){list=list.filter(o=>o.category===activeFilter);}return list;},[executiveOrders,searchTerm,activeFilter]);return(<div className="p-6">{loading&&<p>Loading...</p>}{error&&<p className="text-red-600">Error: {error}</p>}{!loading&&!error&&filteredOrders.length===0&&<p>No results found.</p>}<div className="space-y-4">{filteredOrders.map(order=><OrderCard key={order.document_number} order={order} isExpanded={expandedOrderId===order.document_number} onToggle={()=>setExpandedOrderId(expandedOrderId===order.document_number?null:order.document_number)}/>)} </div></div>);}export default App;
EOF

# Frontend: OrderCard.jsx
cat > frontend/src/components/OrderCard.jsx << 'EOF'
import React from 'react';const OrderCard=({order,isExpanded,onToggle})=>(<div className="bg-white border rounded-md shadow-sm"><div className="p-4 flex justify-between items-center"><h3 className="font-medium">{order.executive_order_number} - {order.title}</h3><button onClick={onToggle} className=
