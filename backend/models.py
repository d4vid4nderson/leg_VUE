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
