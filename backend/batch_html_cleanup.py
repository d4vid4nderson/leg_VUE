#!/usr/bin/env python3
"""
Batch HTML Cleanup - More efficient version
"""

import re
import logging
from database_config import get_db_connection
from html import unescape

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def strip_html_tags(text):
    """Remove HTML tags and convert to clean plain text"""
    if not text:
        return text
    
    # First, unescape HTML entities
    text = unescape(text)
    
    # Remove HTML tags but preserve content
    text = re.sub(r'<[^>]+>', '', text)
    
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    # Remove any remaining HTML entities
    text = re.sub(r'&[a-zA-Z0-9]+;', '', text)
    
    return text

def batch_cleanup_bills(batch_size=500):
    """Clean HTML tags in batches"""
    
    logger.info(f"🔧 Starting batch cleanup of state bills (batch size: {batch_size})")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        total_updated = 0
        
        while True:
            # Get next batch
            cursor.execute(f'''
                SELECT TOP {batch_size} id, ai_executive_summary, ai_talking_points, ai_business_impact
                FROM dbo.state_legislation
                WHERE ai_executive_summary LIKE '%<p>%' 
                OR ai_executive_summary LIKE '%</p>%'
                OR ai_talking_points LIKE '%<p>%'
                OR ai_business_impact LIKE '%<p>%'
            ''')
            
            batch = cursor.fetchall()
            
            if not batch:
                logger.info("✅ No more bills to process")
                break
            
            logger.info(f"Processing batch of {len(batch)} bills...")
            
            # Process batch
            for id_val, summary, talking_points, business_impact in batch:
                clean_summary = strip_html_tags(summary) if summary else summary
                clean_talking_points = strip_html_tags(talking_points) if talking_points else talking_points
                clean_business_impact = strip_html_tags(business_impact) if business_impact else business_impact
                
                cursor.execute('''
                    UPDATE dbo.state_legislation
                    SET ai_executive_summary = ?,
                        ai_talking_points = ?,
                        ai_business_impact = ?,
                        ai_summary = ?
                    WHERE id = ?
                ''', (clean_summary, clean_talking_points, clean_business_impact, clean_summary, id_val))
            
            conn.commit()
            total_updated += len(batch)
            logger.info(f"  Updated {total_updated} bills so far...")
        
        logger.info(f"✅ Completed! Updated {total_updated} state bills")
        return total_updated

def batch_cleanup_orders(batch_size=100):
    """Clean HTML tags in executive orders"""
    
    logger.info(f"🔧 Starting batch cleanup of executive orders (batch size: {batch_size})")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        total_updated = 0
        
        while True:
            # Get next batch
            cursor.execute(f'''
                SELECT TOP {batch_size} id, ai_executive_summary, ai_talking_points, ai_business_impact
                FROM dbo.executive_orders
                WHERE ai_executive_summary LIKE '%<p>%' 
                OR ai_executive_summary LIKE '%</p>%'
                OR ai_talking_points LIKE '%<p>%'
                OR ai_business_impact LIKE '%<p>%'
            ''')
            
            batch = cursor.fetchall()
            
            if not batch:
                logger.info("✅ No more executive orders to process")
                break
            
            logger.info(f"Processing batch of {len(batch)} executive orders...")
            
            # Process batch
            for id_val, summary, talking_points, business_impact in batch:
                clean_summary = strip_html_tags(summary) if summary else summary
                clean_talking_points = strip_html_tags(talking_points) if talking_points else talking_points
                clean_business_impact = strip_html_tags(business_impact) if business_impact else business_impact
                
                cursor.execute('''
                    UPDATE dbo.executive_orders
                    SET ai_executive_summary = ?,
                        ai_talking_points = ?,
                        ai_business_impact = ?,
                        ai_summary = ?
                    WHERE id = ?
                ''', (clean_summary, clean_talking_points, clean_business_impact, clean_summary, id_val))
            
            conn.commit()
            total_updated += len(batch)
            logger.info(f"  Updated {total_updated} executive orders so far...")
        
        logger.info(f"✅ Completed! Updated {total_updated} executive orders")
        return total_updated

if __name__ == "__main__":
    print("🧹 Starting batch HTML cleanup...")
    
    bills_fixed = batch_cleanup_bills(batch_size=1000)
    orders_fixed = batch_cleanup_orders(batch_size=200)
    
    print(f"\n🎉 Batch cleanup completed!")
    print(f"   State bills fixed: {bills_fixed}")
    print(f"   Executive orders fixed: {orders_fixed}")
    print(f"   Total records fixed: {bills_fixed + orders_fixed}")