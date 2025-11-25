#!/usr/bin/env python3
"""
Clean CSV files for Supabase import by removing null characters and other problematic content.
Run this before importing to Supabase.

Usage:
    python clean_csv_for_supabase.py
"""

import os
import re

EXPORTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'exports')

def clean_file(filepath):
    """Remove null characters and other problematic content from a file."""
    print(f"  Cleaning {os.path.basename(filepath)}...")

    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        original_size = len(content)

        # Remove null characters (\x00 or \u0000)
        content = content.replace('\x00', '')
        content = content.replace('\u0000', '')

        # Remove other problematic control characters (except newline, carriage return, tab)
        content = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', content)

        # Fix common escape sequence issues
        content = content.replace('\\u0000', '')
        content = content.replace('\\x00', '')

        new_size = len(content)
        removed = original_size - new_size

        # Write cleaned content back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        if removed > 0:
            print(f"    ✅ Removed {removed} problematic characters")
        else:
            print(f"    ✅ File is clean")

        return removed

    except Exception as e:
        print(f"    ❌ Error: {e}")
        return 0

def main():
    print("=" * 60)
    print("🧹 CSV Cleaner for Supabase Import")
    print("=" * 60)

    if not os.path.exists(EXPORTS_DIR):
        print(f"\n❌ Exports directory not found: {EXPORTS_DIR}")
        return

    print(f"\n📁 Processing files in: {EXPORTS_DIR}\n")

    csv_files = [f for f in os.listdir(EXPORTS_DIR) if f.endswith('.csv')]

    if not csv_files:
        print("No CSV files found.")
        return

    total_removed = 0
    for filename in sorted(csv_files):
        filepath = os.path.join(EXPORTS_DIR, filename)
        removed = clean_file(filepath)
        total_removed += removed

    print("\n" + "=" * 60)
    print(f"✅ Cleaned {len(csv_files)} files")
    print(f"🗑️  Removed {total_removed} total problematic characters")
    print("=" * 60)
    print("\n📋 Your CSV files are now ready for Supabase import!")

if __name__ == "__main__":
    main()
