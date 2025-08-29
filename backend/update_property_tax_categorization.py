#!/usr/bin/env python3
"""
Update Property Tax Categorization Script
Updates existing bills and executive orders that mention property taxes to be tagged as education.
"""

import asyncio
import logging
from database_config import get_db_connection

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_property_tax_categories():
    """Update categories for bills/orders mentioning property taxes"""
    
    property_tax_keywords = [
        'property tax', 'property taxes', 'ad valorem', 'school district', 
        'school funding', 'maintenance and operations', 'M&O tax',
        'school district tax', 'property tax rate', 'tax rate'
    ]
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        logger.info("🔍 Updating state legislation with property tax keywords...")
        
        # Update state legislation
        bills_updated = 0
        for keyword in property_tax_keywords:
            cursor.execute("""
                UPDATE dbo.state_legislation
                SET category = 'education',
                    last_updated = GETDATE()
                WHERE (title LIKE ? OR description LIKE ? OR ai_executive_summary LIKE ?)
                AND category != 'education'
            """, (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'))
            
            updated = cursor.rowcount
            bills_updated += updated
            
            if updated > 0:
                logger.info(f"   Updated {updated} bills for keyword: '{keyword}'")
        
        logger.info("🔍 Updating executive orders with property tax keywords...")
        
        # Update executive orders
        orders_updated = 0
        for keyword in property_tax_keywords:
            cursor.execute("""
                UPDATE dbo.executive_orders
                SET category = 'education',
                    last_updated = GETDATE()
                WHERE (title LIKE ? OR summary LIKE ? OR ai_executive_summary LIKE ?)
                AND category != 'education'
            """, (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'))
            
            updated = cursor.rowcount
            orders_updated += updated
            
            if updated > 0:
                logger.info(f"   Updated {updated} executive orders for keyword: '{keyword}'")
        
        conn.commit()
        
        logger.info(f"\n✅ Categorization update complete!")
        logger.info(f"   State bills updated: {bills_updated}")
        logger.info(f"   Executive orders updated: {orders_updated}")
        logger.info(f"   Total updated: {bills_updated + orders_updated}")
        
        return {
            'bills_updated': bills_updated,
            'orders_updated': orders_updated,
            'total_updated': bills_updated + orders_updated
        }

def preview_property_tax_items():
    """Preview items that would be updated"""
    
    property_tax_keywords = ['property tax', 'property taxes', 'ad valorem', 'school district']
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        logger.info("🔍 Preview: State bills mentioning property taxes...")
        
        for keyword in property_tax_keywords[:2]:  # Check first 2 keywords for preview
            cursor.execute("""
                SELECT TOP 5 bill_number, state, title, category
                FROM dbo.state_legislation
                WHERE (title LIKE ? OR description LIKE ?)
                AND category != 'education'
                ORDER BY last_updated DESC
            """, (f'%{keyword}%', f'%{keyword}%'))
            
            bills = cursor.fetchall()
            if bills:
                logger.info(f"\n   Bills containing '{keyword}':")
                for bill_num, state, title, category in bills:
                    title_preview = (title[:60] + '...') if title and len(title) > 60 else title
                    logger.info(f"     {state} {bill_num}: {title_preview} (current: {category})")
        
        logger.info("\n🔍 Preview: Executive orders mentioning property taxes...")
        
        cursor.execute("""
            SELECT TOP 3 eo_number, title, category
            FROM dbo.executive_orders
            WHERE (title LIKE '%property tax%' OR summary LIKE '%property tax%')
            AND category != 'education'
            ORDER BY signing_date DESC
        """)
        
        orders = cursor.fetchall()
        if orders:
            logger.info("   Executive orders containing property tax references:")
            for eo_num, title, category in orders:
                title_preview = (title[:60] + '...') if title and len(title) > 60 else title
                logger.info(f"     {eo_num}: {title_preview} (current: {category})")
        else:
            logger.info("   No executive orders found with property tax references")

if __name__ == "__main__":
    print("🏷️ Property Tax Categorization Update Tool")
    print("=" * 60)
    
    # Preview what would be updated
    preview_property_tax_items()
    
    print("\n" + "=" * 60)
    
    # Ask for confirmation
    response = input("\n🤔 Do you want to proceed with the updates? (y/N): ").strip().lower()
    
    if response in ['y', 'yes']:
        result = update_property_tax_categories()
        print(f"\n🎉 Update completed successfully!")
    else:
        print("\n❌ Update cancelled.")