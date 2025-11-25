#!/usr/bin/env python3
"""Check recent executive orders and their AI status"""

from database_config import get_db_connection

with get_db_connection() as conn:
    cursor = conn.cursor()

    # Check the two most recent EOs
    cursor.execute('''
        SELECT
            eo_number,
            document_number,
            title,
            publication_date,
            CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END as has_summary,
            CASE WHEN ai_talking_points IS NOT NULL AND ai_talking_points != '' THEN 1 ELSE 0 END as has_talking_points,
            CASE WHEN ai_business_impact IS NOT NULL AND ai_business_impact != '' THEN 1 ELSE 0 END as has_business_impact,
            category,
            is_new,
            processing_status
        FROM dbo.executive_orders
        WHERE eo_number IN (14357, 14358)
        ORDER BY eo_number DESC
    ''')

    results = cursor.fetchall()

    print('Checking EO 14357 and 14358:')
    print('=' * 80)

    for row in results:
        (eo_num, doc_num, title, pub_date, has_sum, has_talk,
         has_impact, category, is_new, status) = row

        print()
        print(f'EO {eo_num} (Doc: {doc_num})')
        print(f'Title: {title[:60] if title else "No title"}...')
        print(f'Published: {pub_date}')
        print(f'Category: {category}')
        print(f'Is New: {is_new}')
        print(f'Status: {status}')
        print(f'AI Analysis:')
        print(f'  - Executive Summary: {"YES" if has_sum else "NO"}')
        print(f'  - Talking Points: {"YES" if has_talk else "NO"}')
        print(f'  - Business Impact: {"YES" if has_impact else "NO"}')
