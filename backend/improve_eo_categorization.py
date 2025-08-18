#!/usr/bin/env python3
"""
Improved Executive Order Categorization System
Analyzes titles and AI summaries to better categorize executive orders
"""

from database_config import get_db_connection
import re

def get_improved_category(title, ai_summary=""):
    """
    Comprehensive categorization based on title and AI summary
    """
    if not title:
        return 'government-operations'
    
    # Combine title and summary for analysis
    text = f"{title} {ai_summary or ''}".lower()
    
    # Define comprehensive keyword mappings
    category_keywords = {
        'healthcare': [
            'health', 'medical', 'medicare', 'medicaid', 'hospital', 'patient', 'disease',
            'vaccine', 'public health', 'health care', 'healthcare', 'mental health', 
            'drug', 'pharmaceutical', 'nutrition', 'fitness', 'wellness', 'opioid'
        ],
        'education': [
            'education', 'school', 'student', 'teacher', 'university', 'college', 
            'academic', 'learning', 'curriculum', 'scholarship', 'educational',
            'literacy', 'graduation', 'classroom'
        ],
        'transportation': [
            'transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit',
            'airline', 'aviation', 'airport', 'railway', 'railroad', 'shipping',
            'infrastructure', 'bridge', 'tunnel', 'port'
        ],
        'environment': [
            'environment', 'climate', 'pollution', 'renewable', 'conservation',
            'energy', 'emission', 'carbon', 'solar', 'wind', 'clean energy',
            'sustainability', 'green', 'ecosystem', 'wildlife', 'water quality'
        ],
        'economics': [
            'economic', 'economy', 'trade', 'tariff', 'business', 'commerce', 
            'finance', 'financial', 'banking', 'investment', 'tax', 'fiscal',
            'budget', 'market', 'inflation', 'employment', 'job', 'unemployment',
            'wage', 'salary', 'economic development', 'recession', 'growth'
        ],
        'technology': [
            'technology', 'digital', 'cyber', 'internet', 'data', 'artificial intelligence',
            'ai', 'computer', 'software', 'innovation', 'research', 'science',
            'cybersecurity', 'privacy', 'telecommunications', 'broadband'
        ],
        'criminal-justice': [
            'crime', 'criminal', 'justice', 'police', 'law enforcement', 'prison',
            'jail', 'court', 'prosecution', 'drug enforcement', 'safety', 'security',
            'violence', 'terrorism', 'investigation', 'enforcement'
        ],
        'labor': [
            'labor', 'worker', 'employment', 'workplace', 'union', 'wage', 'overtime',
            'benefits', 'retirement', 'pension', 'worker safety', 'occupational',
            'collective bargaining', 'discrimination'
        ],
        'housing': [
            'housing', 'home', 'rent', 'mortgage', 'real estate', 'property',
            'affordable housing', 'homelessness', 'shelter', 'residential',
            'community development', 'urban planning'
        ],
        'agriculture': [
            'agriculture', 'farm', 'farmer', 'crop', 'livestock', 'food',
            'rural', 'agricultural', 'harvest', 'grain', 'dairy', 'beef',
            'agriculture policy', 'farm bill'
        ],
        'tax': [
            'tax', 'taxation', 'revenue', 'irs', 'deduction', 'tax credit',
            'tax relief', 'tax code', 'income tax', 'corporate tax', 'payroll tax'
        ],
        'civic': [
            'citizen', 'civic', 'community', 'public service', 'volunteer',
            'democracy', 'voting', 'election', 'participation', 'engagement',
            'civil rights', 'civil liberties', 'constitutional'
        ]
    }
    
    # Special patterns for government operations
    government_patterns = [
        r'establish.*task force', r'establish.*commission', r'establish.*council',
        r'federal.*agency', r'government.*efficiency', r'administrative',
        r'federal.*oversight', r'regulatory', r'compliance', r'federal.*grant',
        r'executive.*branch', r'federal.*coordination', r'interagency'
    ]
    
    # Check for government operations patterns first
    for pattern in government_patterns:
        if re.search(pattern, text):
            return 'government-operations'
    
    # Check each category for keyword matches
    category_scores = {}
    for category, keywords in category_keywords.items():
        score = 0
        for keyword in keywords:
            # Count occurrences (more matches = higher score)
            score += text.count(keyword)
            
        if score > 0:
            category_scores[category] = score
    
    # Return category with highest score, or government-operations as default
    if category_scores:
        best_category = max(category_scores.items(), key=lambda x: x[1])[0]
        return best_category
    
    # Default for unmatched executive orders
    return 'government-operations'

def analyze_and_update_categories():
    """Analyze all executive orders and update their categories"""
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get all executive orders
            cursor.execute("""
                SELECT id, eo_number, title, ai_summary, category 
                FROM executive_orders 
                ORDER BY eo_number DESC
            """)
            
            orders = cursor.fetchall()
            print(f"📊 Analyzing {len(orders)} executive orders...")
            
            updates = []
            category_changes = {}
            
            for order_id, eo_number, title, ai_summary, current_category in orders:
                # Get improved category
                new_category = get_improved_category(title, ai_summary)
                
                # Track changes
                if current_category != new_category:
                    updates.append((new_category, order_id))
                    
                    old_cat = current_category or 'None'
                    if old_cat not in category_changes:
                        category_changes[old_cat] = {}
                    if new_category not in category_changes[old_cat]:
                        category_changes[old_cat][new_category] = []
                    category_changes[old_cat][new_category].append(f"EO {eo_number}")
            
            print(f"\n🔄 Found {len(updates)} orders to recategorize:")
            
            # Show sample changes
            for old_cat, new_cats in list(category_changes.items())[:5]:
                for new_cat, examples in new_cats.items():
                    print(f"  {old_cat} → {new_cat}: {len(examples)} orders")
                    if len(examples) <= 3:
                        print(f"    Examples: {', '.join(examples)}")
            
            if len(category_changes) > 5:
                print(f"  ... and {len(category_changes) - 5} more category transitions")
            
            # Apply updates
            if updates:
                print(f"\n💾 Updating {len(updates)} executive orders...")
                cursor.executemany("""
                    UPDATE executive_orders 
                    SET category = ? 
                    WHERE id = ?
                """, updates)
                
                print(f"✅ Updated {len(updates)} executive orders with better categories")
            else:
                print("✅ All categories are already optimal")
            
            # Show final distribution
            cursor.execute("""
                SELECT 
                    category,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
                FROM executive_orders 
                WHERE category IS NOT NULL
                GROUP BY category
                ORDER BY COUNT(*) DESC
            """)
            
            print(f"\n📈 Updated Practice Area Distribution:")
            for row in cursor.fetchall():
                category, count, percentage = row
                print(f"  • {category}: {count:,} orders ({percentage}%)")
                
    except Exception as e:
        print(f"❌ Error updating categories: {e}")
        import traceback
        traceback.print_exc()

def show_sample_recategorizations():
    """Show examples of how specific orders would be recategorized"""
    
    samples = [
        ("Further Modifying Reciprocal Tariff Rates To Reflect Ongoing Discussions With the People's Republic", ""),
        ("Declaring a Crime Emergency in the District of Columbia", ""),
        ("Improving Oversight of Federal Grantmaking", ""),
        ("Guaranteeing Fair Banking for All Americans", ""),
        ("Democratizing Access to Alternative Assets for 401(k) Investors", ""),
        ("President's Council on Sports, Fitness, and Nutrition", ""),
        ("Establishing the White House Task Force on the 2028 Summer Olympics", ""),
    ]
    
    print("🔍 SAMPLE RECATEGORIZATIONS:")
    print("=" * 60)
    
    for title, summary in samples:
        category = get_improved_category(title, summary)
        print(f"📄 \"{title[:50]}...\"")
        print(f"   → {category}")
        print()

if __name__ == "__main__":
    print("🎯 EXECUTIVE ORDERS CATEGORIZATION IMPROVEMENT")
    print("=" * 60)
    
    # Show examples first
    show_sample_recategorizations()
    
    # Then update all orders
    analyze_and_update_categories()