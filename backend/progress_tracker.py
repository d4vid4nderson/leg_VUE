#!/usr/bin/env python3
"""
Progress Tracker for Background Bill Fetching
Tracks the progress of long-running fetch operations
"""

import json
import time
from datetime import datetime
from typing import Dict, Optional

class ProgressTracker:
    """Simple in-memory progress tracker for background operations"""
    
    def __init__(self):
        self.tasks = {}
    
    def start_task(self, task_id: str, task_name: str, total_items: int = 0) -> None:
        """Start tracking a new task"""
        self.tasks[task_id] = {
            'task_name': task_name,
            'status': 'running',
            'start_time': datetime.now().isoformat(),
            'end_time': None,
            'total_items': total_items,
            'processed_items': 0,
            'current_step': 'Initializing...',
            'error': None,
            'details': {}
        }
    
    def update_progress(self, task_id: str, processed_items: int, current_step: str, details: Dict = None) -> None:
        """Update task progress"""
        if task_id in self.tasks:
            self.tasks[task_id]['processed_items'] = processed_items
            self.tasks[task_id]['current_step'] = current_step
            if details:
                self.tasks[task_id]['details'].update(details)
    
    def complete_task(self, task_id: str, success: bool = True, error: str = None) -> None:
        """Mark task as completed"""
        if task_id in self.tasks:
            self.tasks[task_id]['status'] = 'completed' if success else 'failed'
            self.tasks[task_id]['end_time'] = datetime.now().isoformat()
            if error:
                self.tasks[task_id]['error'] = error
    
    def get_task_status(self, task_id: str) -> Optional[Dict]:
        """Get current status of a task"""
        return self.tasks.get(task_id)
    
    def get_all_active_tasks(self) -> Dict:
        """Get all running tasks"""
        return {k: v for k, v in self.tasks.items() if v['status'] == 'running'}
    
    def cleanup_old_tasks(self, max_age_hours: int = 24) -> None:
        """Remove old completed tasks"""
        cutoff_time = time.time() - (max_age_hours * 3600)
        to_remove = []
        
        for task_id, task in self.tasks.items():
            if task['status'] != 'running' and task['end_time']:
                end_time = datetime.fromisoformat(task['end_time']).timestamp()
                if end_time < cutoff_time:
                    to_remove.append(task_id)
        
        for task_id in to_remove:
            del self.tasks[task_id]

# Global progress tracker instance
progress_tracker = ProgressTracker()