#!/usr/bin/env python3
"""
Script to update existing executive order categories using improved logic
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database_config import get_db_connection

def categorize_title(title):
    """Improved categorization logic"""
    title_lower = title.lower()
    
    # Healthcare keywords
    healthcare_terms = [
        'health', 'medical', 'care', 'healthcare', 'medicare', 'medicaid', 
        'drug', 'prescription', 'hospital', 'patient', 'vaccine', 'opioid',
        'mental health', 'public health', 'disease', 'treatment'
    ]
    
    # Education keywords  
    education_terms = [
        'education', 'school', 'student', 'university', 'college', 'campus',
        'academic', 'learning', 'teaching', 'curriculum', 'classroom',
        'scholarship', 'student loan', 'educational', 'accreditation'
    ]
    
    # Engineering/Infrastructure keywords
    engineering_terms = [
        'infrastructure', 'transport', 'engineering', 'construction', 'bridge',
        'road', 'highway', 'energy', 'power', 'grid', 'nuclear', 'oil', 'gas',
        'renewable', 'electric', 'mining', 'mineral', 'technology', 'digital',
        'cybersecurity', 'broadband', 'telecommunications', 'aerospace', 'drone'
    ]
    
    # Check categories in order of specificity
    if any(term in title_lower for term in healthcare_terms):
        return 'healthcare'
    elif any(term in title_lower for term in education_terms):
        return 'education'
    elif any(term in title_lower for term in engineering_terms):
        return 'engineering'
    else:
        return 'civic'

def update_categories():
    """Update categories for all executive orders"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get all orders
            cursor.execute("SELECT id, title, category FROM executive_orders")
            orders = cursor.fetchall()
            
            print(f"🔍 Found {len(orders)} executive orders to recategorize")
            
            updates = []
            category_counts = {'healthcare': 0, 'education': 0, 'engineering': 0, 'civic': 0}
            
            for order_id, title, old_category in orders:
                new_category = categorize_title(title)
                category_counts[new_category] += 1
                
                if new_category != old_category:
                    updates.append((new_category, order_id, title))
            
            print(f"\n📊 New category distribution:")
            for cat, count in category_counts.items():
                print(f"   {cat}: {count}")
            
            print(f"\n🔄 Need to update {len(updates)} orders:")
            
            # Show some examples of changes
            for i, (new_cat, order_id, title) in enumerate(updates[:10]):
                print(f"   {order_id}: {title[:60]}... → {new_cat}")
            
            if len(updates) > 10:
                print(f"   ... and {len(updates) - 10} more")
            
            # Perform updates automatically (no confirmation needed)
            if updates:
                print(f"\n🔄 Proceeding with update of {len(updates)} categories...")
                # Perform updates
                for new_category, order_id, title in updates:
                    cursor.execute(
                        "UPDATE executive_orders SET category = %s WHERE id = %s",
                        (new_category, order_id)
                    )
                
                print(f"✅ Updated {len(updates)} executive order categories")
            else:
                print("ℹ️ No updates needed - all categories are already correct")
                
            cursor.close()
            
    except Exception as e:
        print(f"❌ Error updating categories: {e}")

if __name__ == "__main__":
    print("🚀 Executive Order Category Update Script")
    print("=" * 50)
    update_categories()