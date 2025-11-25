"""
Update Logs Model
Tracks batch update operations for bills
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class UpdateLogs(Base):
    __tablename__ = 'update_logs'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(50), nullable=True)
    state_code = Column(String(5), nullable=True)
    update_started = Column(DateTime, default=datetime.utcnow, nullable=False)
    update_completed = Column(DateTime, nullable=True)
    bills_updated = Column(Integer, default=0)
    bills_added = Column(Integer, default=0)
    status = Column(String(20), default='running', nullable=False)  # 'running', 'completed', 'failed'
    error_message = Column(Text, nullable=True)
    update_type = Column(String(20), default='nightly', nullable=False)  # 'nightly', 'manual', 'incremental'
    
    def __repr__(self):
        return f"<UpdateLog(id={self.id}, session_id={self.session_id}, status={self.status})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'state_code': self.state_code,
            'update_started': self.update_started.isoformat() if self.update_started else None,
            'update_completed': self.update_completed.isoformat() if self.update_completed else None,
            'bills_updated': self.bills_updated,
            'bills_added': self.bills_added,
            'status': self.status,
            'error_message': self.error_message,
            'update_type': self.update_type
        }
    
    @property
    def duration_seconds(self):
        """Calculate duration of update in seconds"""
        if self.update_started and self.update_completed:
            return (self.update_completed - self.update_started).total_seconds()
        return None
    
    @property
    def is_completed(self):
        """Check if update is completed (successfully or failed)"""
        return self.status in ['completed', 'failed']
    
    @property
    def is_successful(self):
        """Check if update completed successfully"""
        return self.status == 'completed'