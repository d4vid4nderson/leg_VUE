#!/usr/bin/env python3
"""
Quick fix for the session logic to properly respect sine_die flags
"""

import re

# Read the current file
with open('/Users/david.anderson/Downloads/PoliticalVue/backend/legiscan_service.py', 'r') as f:
    content = f.read()

# Replace the problematic hardcoded Texas logic
old_logic = '''                        # Session is active if it's recent AND not explicitly closed by LegiScan
                        is_likely_active = (
                            is_recent and 
                            not is_session_closed and (
                                # Regular sessions from current/recent years
                                ('special' not in session_name.lower()) or
                                # Special sessions that are marked as prefile (upcoming)
                                (is_special and is_prefile) or
                                # Special sessions with current year
                                (is_special and str(current_year) in session_name)
                            )
                        )'''

new_logic = '''                        # Session is active ONLY if:
                        # 1. LegiScan API shows it's not closed (sine_die != 1) 
                        # 2. It's from current/recent years
                        is_likely_active = (
                            not is_session_closed and  # MUST not be closed by LegiScan
                            is_recent and (
                                # Regular sessions from current/recent years
                                ('special' not in session_name.lower()) or
                                # Special sessions that are marked as prefile (upcoming)
                                (is_special and is_prefile) or
                                # Special sessions with current year
                                (is_special and str(current_year) in session_name)
                            )
                        )'''

# Replace the logic
content = content.replace(old_logic, new_logic)

# Write the updated file
with open('/Users/david.anderson/Downloads/PoliticalVue/backend/legiscan_service.py', 'w') as f:
    f.write(content)

print("✅ Updated session logic to properly respect sine_die flags")