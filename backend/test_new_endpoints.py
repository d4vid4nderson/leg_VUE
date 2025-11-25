#!/usr/bin/env python3
"""
Test the new order tracking endpoints
"""

from fastapi import FastAPI, Query
from typing import Optional
from database_config import get_db_connection
import logging

logger = logging.getLogger(__name__)

def add_new_order_endpoints(app: FastAPI):
    """Add the new order tracking endpoints to the FastAPI app"""
    
    @app.get("/api/executive-orders/new-count")
    async def get_new_orders_count():
        """Get count of new executive orders that haven't been viewed"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders WHERE is_new = 1")
                result = cursor.fetchone()
                new_count = result[0] if result else 0
                
            return {
                "success": True,
                "new_count": new_count
            }
        except Exception as e:
            logger.error(f"❌ Error getting new orders count: {e}")
            return {
                "success": False,
                "error": str(e),
                "new_count": 0
            }

    @app.get("/api/executive-orders/new")
    async def get_new_orders(limit: int = Query(10, ge=1, le=50)):
        """Get list of new executive orders"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT TOP (?) eo_number, title, signing_date, created_at, category
                    FROM dbo.executive_orders 
                    WHERE is_new = 1
                    ORDER BY created_at DESC
                """, (limit,))
                orders = cursor.fetchall()
                
            order_list = []
            for order in orders:
                order_list.append({
                    "eo_number": order[0],
                    "title": order[1],
                    "signing_date": order[2].isoformat() if order[2] else None,
                    "created_at": order[3].isoformat() if order[3] else None,
                    "category": order[4]
                })
                
            return {
                "success": True,
                "new_orders": order_list,
                "count": len(order_list)
            }
        except Exception as e:
            logger.error(f"❌ Error getting new orders: {e}")
            return {
                "success": False,
                "error": str(e),
                "new_orders": [],
                "count": 0
            }

    @app.post("/api/executive-orders/mark-viewed/{eo_number}")
    async def mark_order_as_viewed(eo_number: str, user_id: Optional[str] = Query(None)):
        """Mark an executive order as viewed (no longer new)"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE dbo.executive_orders 
                    SET is_new = 0,
                        first_viewed_at = CASE 
                            WHEN first_viewed_at IS NULL THEN GETDATE() 
                            ELSE first_viewed_at 
                        END,
                        last_updated = GETDATE()
                    WHERE eo_number = ?
                """, (eo_number,))
                conn.commit()
                
            return {
                "success": True,
                "message": f"Order {eo_number} marked as viewed"
            }
        except Exception as e:
            logger.error(f"❌ Error marking order as viewed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    print("✅ New order tracking endpoints added to FastAPI app")

if __name__ == "__main__":
    # Test the endpoints directly
    import asyncio
    from fastapi.testclient import TestClient
    
    app = FastAPI()
    add_new_order_endpoints(app)
    
    client = TestClient(app)
    
    # Test the endpoints
    print("🧪 Testing new order endpoints...")
    
    # Test count endpoint
    response = client.get("/api/executive-orders/new-count")
    print(f"Count endpoint: {response.status_code} - {response.json()}")
    
    # Test list endpoint
    response = client.get("/api/executive-orders/new?limit=5")
    print(f"List endpoint: {response.status_code} - {response.json()}")
    
    print("✅ Testing completed")