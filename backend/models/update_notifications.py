"""
Update Notifications Model
Tracks notifications for users about bill updates
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class UpdateNotifications(Base):
    __tablename__ = 'update_notifications'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(50), nullable=True)  # For future user-specific notifications
    session_id = Column(String(50), nullable=True)
    state_code = Column(String(5), nullable=True)
    new_bills_count = Column(Integer, default=0)
    updated_bills_count = Column(Integer, default=0)
    notification_created = Column(DateTime, default=datetime.utcnow, nullable=False)
    notification_read = Column(Boolean, default=False, nullable=False)
    notification_type = Column(String(20), default='bill_update', nullable=False)  # 'bill_update', 'session_change'
    
    def __repr__(self):
        return f"<UpdateNotification(id={self.id}, session_id={self.session_id}, read={self.notification_read})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'session_id': self.session_id,
            'state_code': self.state_code,
            'new_bills_count': self.new_bills_count,
            'updated_bills_count': self.updated_bills_count,
            'notification_created': self.notification_created.isoformat() if self.notification_created else None,
            'notification_read': self.notification_read,
            'notification_type': self.notification_type
        }
    
    @property
    def total_changes(self):
        """Total number of changes (new + updated bills)"""
        return self.new_bills_count + self.updated_bills_count
    
    @property
    def is_significant(self):
        """Check if notification represents significant changes"""
        return self.new_bills_count > 0 or self.updated_bills_count > 5
    
    @property
    def age_hours(self):
        """Age of notification in hours"""
        if self.notification_created:
            return (datetime.utcnow() - self.notification_created).total_seconds() / 3600
        return None
    
    def mark_as_read(self):
        """Mark notification as read"""
        self.notification_read = True
        
    def get_display_message(self):
        """Get human-readable message for notification"""
        if self.notification_type == 'bill_update':
            if self.new_bills_count > 0 and self.updated_bills_count > 0:
                return f"{self.new_bills_count} new bills and {self.updated_bills_count} updated bills"
            elif self.new_bills_count > 0:
                return f"{self.new_bills_count} new bills"
            elif self.updated_bills_count > 0:
                return f"{self.updated_bills_count} updated bills"
            else:
                return "Bill updates available"
        else:
            return f"Session update: {self.notification_type}"