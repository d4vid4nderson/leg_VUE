#!/usr/bin/env python3
"""
Fix HTML Tags in AI Summaries
Removes HTML tags from AI summaries and converts them to clean plain text
"""

import re
import logging
from database_config import get_db_connection
from html import unescape

# Setup logging
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

def fix_state_legislation_html():
    """Fix HTML tags in state legislation summaries"""
    
    logger.info("🔧 Fixing HTML tags in state legislation summaries...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills with HTML tags
        cursor.execute('''
            SELECT id, bill_number, state, ai_executive_summary, ai_talking_points, ai_business_impact
            FROM dbo.state_legislation
            WHERE ai_executive_summary LIKE '%<p>%' 
            OR ai_executive_summary LIKE '%</p>%'
            OR ai_talking_points LIKE '%<p>%'
            OR ai_business_impact LIKE '%<p>%'
        ''')
        
        bills_to_fix = cursor.fetchall()
        logger.info(f"Found {len(bills_to_fix)} state bills to fix")
        
        updated_count = 0
        
        for id_val, bill_number, state, summary, talking_points, business_impact in bills_to_fix:
            # Clean each field
            clean_summary = strip_html_tags(summary) if summary else summary
            clean_talking_points = strip_html_tags(talking_points) if talking_points else talking_points
            clean_business_impact = strip_html_tags(business_impact) if business_impact else business_impact
            
            # Update record
            cursor.execute('''
                UPDATE dbo.state_legislation
                SET ai_executive_summary = ?,
                    ai_talking_points = ?,
                    ai_business_impact = ?,
                    ai_summary = ?,
                    last_updated = GETDATE()
                WHERE id = ?
            ''', (clean_summary, clean_talking_points, clean_business_impact, clean_summary, id_val))
            
            updated_count += 1
            
            if updated_count % 100 == 0:
                logger.info(f"  Updated {updated_count} bills...")
        
        conn.commit()
        logger.info(f"✅ Fixed {updated_count} state bills")
        
        return updated_count

def fix_executive_orders_html():
    """Fix HTML tags in executive order summaries"""
    
    logger.info("🔧 Fixing HTML tags in executive order summaries...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get orders with HTML tags
        cursor.execute('''
            SELECT id, eo_number, ai_executive_summary, ai_talking_points, ai_business_impact
            FROM dbo.executive_orders
            WHERE ai_executive_summary LIKE '%<p>%' 
            OR ai_executive_summary LIKE '%</p>%'
            OR ai_talking_points LIKE '%<p>%'
            OR ai_business_impact LIKE '%<p>%'
        ''')
        
        orders_to_fix = cursor.fetchall()
        logger.info(f"Found {len(orders_to_fix)} executive orders to fix")
        
        updated_count = 0
        
        for id_val, eo_number, summary, talking_points, business_impact in orders_to_fix:
            # Clean each field
            clean_summary = strip_html_tags(summary) if summary else summary
            clean_talking_points = strip_html_tags(talking_points) if talking_points else talking_points
            clean_business_impact = strip_html_tags(business_impact) if business_impact else business_impact
            
            # Update record
            cursor.execute('''
                UPDATE dbo.executive_orders
                SET ai_executive_summary = ?,
                    ai_talking_points = ?,
                    ai_business_impact = ?,
                    ai_summary = ?,
                    last_updated = GETDATE()
                WHERE id = ?
            ''', (clean_summary, clean_talking_points, clean_business_impact, clean_summary, id_val))
            
            updated_count += 1
            
            if updated_count % 50 == 0:
                logger.info(f"  Updated {updated_count} executive orders...")
        
        conn.commit()
        logger.info(f"✅ Fixed {updated_count} executive orders")
        
        return updated_count

def preview_html_fixes():
    """Preview what would be fixed"""
    
    logger.info("🔍 Previewing HTML tag fixes...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Sample state bills
        cursor.execute('''
            SELECT TOP 3 bill_number, state, 
                   SUBSTRING(ai_executive_summary, 1, 150) as summary_preview
            FROM dbo.state_legislation
            WHERE ai_executive_summary LIKE '%<p>%'
        ''')
        
        bills = cursor.fetchall()
        
        logger.info("📋 Sample state bills with HTML:")
        for bill_num, state, preview in bills:
            logger.info(f"  {state} {bill_num}:")
            logger.info(f"    Before: {preview[:100]}...")
            clean_preview = strip_html_tags(preview)
            logger.info(f"    After:  {clean_preview[:100]}...")
            logger.info("")
        
        # Sample executive orders
        cursor.execute('''
            SELECT TOP 2 eo_number, 
                   SUBSTRING(ai_executive_summary, 1, 150) as summary_preview
            FROM dbo.executive_orders
            WHERE ai_executive_summary LIKE '%<p>%'
        ''')
        
        orders = cursor.fetchall()
        
        if orders:
            logger.info("📋 Sample executive orders with HTML:")
            for eo_num, preview in orders:
                logger.info(f"  {eo_num}:")
                logger.info(f"    Before: {preview[:100]}...")
                clean_preview = strip_html_tags(preview)
                logger.info(f"    After:  {clean_preview[:100]}...")
                logger.info("")

def main():
    """Main execution function"""
    
    print("🧹 HTML Tag Cleanup Tool for AI Summaries")
    print("=" * 60)
    
    # Show preview
    preview_html_fixes()
    
    print("\n" + "=" * 60)
    
    # Ask for confirmation
    response = input("\n🤔 Do you want to proceed with cleaning HTML tags? (y/N): ").strip().lower()
    
    if response in ['y', 'yes']:
        bills_fixed = fix_state_legislation_html()
        orders_fixed = fix_executive_orders_html()
        
        print(f"\n🎉 HTML cleanup completed!")
        print(f"   State bills fixed: {bills_fixed}")
        print(f"   Executive orders fixed: {orders_fixed}")
        print(f"   Total records fixed: {bills_fixed + orders_fixed}")
        
        return {
            'bills_fixed': bills_fixed,
            'orders_fixed': orders_fixed,
            'total_fixed': bills_fixed + orders_fixed
        }
    else:
        print("\n❌ HTML cleanup cancelled.")
        return None

if __name__ == "__main__":
    main()