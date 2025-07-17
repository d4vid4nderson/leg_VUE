"""
Enhanced LegiScan Service with Incremental Updates
Extended version of the LegiScan service with incremental update capabilities
"""

import os
import asyncio
import aiohttp
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import json

# Import original service
from legiscan_service import EnhancedLegiScanClient, LEGISCAN_API_KEY
from utils.rate_limiter import LegiScanRateLimiter

class LegiScanService(EnhancedLegiScanClient):
    """
    Enhanced LegiScan service with incremental update capabilities
    Extends the original EnhancedLegiScanClient with new update methods
    """
    
    def __init__(self, api_key: str = None, rate_limit_delay: float = 0.5):
        super().__init__(api_key, rate_limit_delay)
        self.rate_limiter = LegiScanRateLimiter()
        
    async def get_updated_bills(self, 
                              session_id: str, 
                              since: Optional[datetime] = None,
                              state_code: Optional[str] = None) -> List[Dict]:
        """
        Get bills updated since a specific timestamp
        
        Args:
            session_id: Legislative session ID
            since: Only get bills updated after this timestamp
            state_code: State code for filtering
            
        Returns:
            List of updated bills
        """
        try:
            # If no timestamp provided, get all bills from last 24 hours
            if since is None:
                since = datetime.utcnow() - timedelta(hours=24)
                
            # Get session information
            session_info = await self.get_session_info(session_id, state_code)
            if not session_info:
                return []
                
            # Get bill list for session
            bills = await self.get_session_bills(session_id, state_code)
            
            # Filter bills updated since timestamp
            updated_bills = []
            for bill in bills:
                if await self.is_bill_updated_since(bill, since):
                    # Get detailed bill information
                    detailed_bill = await self.get_bill_detailed(bill['bill_id'])
                    if detailed_bill:
                        updated_bills.append(detailed_bill)
                        
                    # Rate limiting
                    await self.rate_limiter.wait_if_needed()
                    
            return updated_bills
            
        except Exception as e:
            print(f"Error getting updated bills: {str(e)}")
            return []
    
    async def get_session_info(self, session_id: str, state_code: str) -> Optional[Dict]:
        """
        Get detailed session information
        
        Args:
            session_id: Legislative session ID
            state_code: State code
            
        Returns:
            Session information or None if not found
        """
        try:
            # Build URL for session info
            url = self._build_url('getSession', {
                'id': session_id,
                'state': state_code
            })
            
            # Make API request
            await self.rate_limiter.wait_if_needed()
            response = await self._api_request(url)
            
            if response and 'session' in response:
                return response['session']
                
            return None
            
        except Exception as e:
            print(f"Error getting session info: {str(e)}")
            return None
    
    async def get_session_bills(self, session_id: str, state_code: str) -> List[Dict]:
        """
        Get all bills for a session
        
        Args:
            session_id: Legislative session ID
            state_code: State code
            
        Returns:
            List of bills in the session
        """
        try:
            # Build URL for session bills
            url = self._build_url('getMasterList', {
                'id': session_id,
                'state': state_code
            })
            
            # Make API request
            await self.rate_limiter.wait_if_needed()
            response = await self._api_request(url)
            
            if response and 'masterlist' in response:
                return response['masterlist']
                
            return []
            
        except Exception as e:
            print(f"Error getting session bills: {str(e)}")
            return []
    
    async def is_bill_updated_since(self, bill: Dict, since: datetime) -> bool:
        """
        Check if a bill has been updated since a specific timestamp
        
        Args:
            bill: Bill information
            since: Timestamp to compare against
            
        Returns:
            True if bill was updated since the timestamp
        """
        try:
            # Get last action timestamp
            last_action = bill.get('last_action')
            if not last_action:
                return False
                
            # Parse timestamp (LegiScan uses Unix timestamp)
            if isinstance(last_action, (int, float)):
                last_action_dt = datetime.utcfromtimestamp(last_action)
            elif isinstance(last_action, str):
                # Try to parse as ISO format
                try:
                    last_action_dt = datetime.fromisoformat(last_action.replace('Z', '+00:00'))
                except:
                    return False
            else:
                return False
                
            # Compare timestamps
            return last_action_dt > since
            
        except Exception as e:
            print(f"Error checking bill update timestamp: {str(e)}")
            return False
    
    async def get_bill_changes(self, bill_id: str, since: Optional[datetime] = None) -> Dict:
        """
        Get detailed changes for a specific bill
        
        Args:
            bill_id: Bill ID
            since: Only get changes after this timestamp
            
        Returns:
            Dictionary containing bill changes
        """
        try:
            # Get detailed bill information
            bill_details = await self.get_bill_detailed(bill_id)
            if not bill_details:
                return {}
                
            # Get bill text versions
            text_versions = await self.get_bill_text_versions(bill_id)
            
            # Get bill amendments
            amendments = await self.get_bill_amendments(bill_id)
            
            # Get bill votes
            votes = await self.get_bill_votes(bill_id)
            
            # Filter by timestamp if provided
            if since:
                text_versions = [v for v in text_versions if self._is_after_timestamp(v, since)]
                amendments = [a for a in amendments if self._is_after_timestamp(a, since)]
                votes = [v for v in votes if self._is_after_timestamp(v, since)]
            
            return {
                'bill_details': bill_details,
                'text_versions': text_versions,
                'amendments': amendments,
                'votes': votes
            }
            
        except Exception as e:
            print(f"Error getting bill changes: {str(e)}")
            return {}
    
    async def get_bill_text_versions(self, bill_id: str) -> List[Dict]:
        """
        Get all text versions for a bill
        
        Args:
            bill_id: Bill ID
            
        Returns:
            List of text versions
        """
        try:
            url = self._build_url('getBillText', {'id': bill_id})
            
            await self.rate_limiter.wait_if_needed()
            response = await self._api_request(url)
            
            if response and 'text' in response:
                return response['text'] if isinstance(response['text'], list) else [response['text']]
                
            return []
            
        except Exception as e:
            print(f"Error getting bill text versions: {str(e)}")
            return []
    
    async def get_bill_amendments(self, bill_id: str) -> List[Dict]:
        """
        Get amendments for a bill
        
        Args:
            bill_id: Bill ID
            
        Returns:
            List of amendments
        """
        try:
            url = self._build_url('getBillAmendments', {'id': bill_id})
            
            await self.rate_limiter.wait_if_needed()
            response = await self._api_request(url)
            
            if response and 'amendments' in response:
                return response['amendments'] if isinstance(response['amendments'], list) else [response['amendments']]
                
            return []
            
        except Exception as e:
            print(f"Error getting bill amendments: {str(e)}")
            return []
    
    async def get_bill_votes(self, bill_id: str) -> List[Dict]:
        """
        Get votes for a bill
        
        Args:
            bill_id: Bill ID
            
        Returns:
            List of votes
        """
        try:
            url = self._build_url('getBillVotes', {'id': bill_id})
            
            await self.rate_limiter.wait_if_needed()
            response = await self._api_request(url)
            
            if response and 'votes' in response:
                return response['votes'] if isinstance(response['votes'], list) else [response['votes']]
                
            return []
            
        except Exception as e:
            print(f"Error getting bill votes: {str(e)}")
            return []
    
    def _is_after_timestamp(self, item: Dict, timestamp: datetime) -> bool:
        """
        Check if an item is after a specific timestamp
        
        Args:
            item: Item to check
            timestamp: Timestamp to compare against
            
        Returns:
            True if item is after timestamp
        """
        try:
            # Look for common timestamp fields
            item_timestamp = None
            timestamp_fields = ['date', 'timestamp', 'created', 'updated', 'last_action']
            
            for field in timestamp_fields:
                if field in item:
                    item_timestamp = item[field]
                    break
                    
            if not item_timestamp:
                return False
                
            # Parse timestamp
            if isinstance(item_timestamp, (int, float)):
                item_dt = datetime.utcfromtimestamp(item_timestamp)
            elif isinstance(item_timestamp, str):
                try:
                    item_dt = datetime.fromisoformat(item_timestamp.replace('Z', '+00:00'))
                except:
                    return False
            else:
                return False
                
            return item_dt > timestamp
            
        except Exception as e:
            print(f"Error checking timestamp: {str(e)}")
            return False
    
    async def get_recent_bill_actions(self, state_code: str, days: int = 1) -> List[Dict]:
        """
        Get recent bill actions for a state
        
        Args:
            state_code: State code
            days: Number of days to look back
            
        Returns:
            List of recent actions
        """
        try:
            # Calculate cutoff date
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Get active sessions for the state
            sessions = await self.get_session_list(state_code)
            
            recent_actions = []
            for session in sessions.get('sessions', []):
                # Get bills for this session
                bills = await self.get_session_bills(session['session_id'], state_code)
                
                for bill in bills:
                    if await self.is_bill_updated_since(bill, cutoff_date):
                        # Get detailed bill info
                        detailed_bill = await self.get_bill_detailed(bill['bill_id'])
                        if detailed_bill:
                            recent_actions.append({
                                'bill': detailed_bill,
                                'session': session,
                                'action_date': bill.get('last_action')
                            })
                            
                        # Rate limiting
                        await self.rate_limiter.wait_if_needed()
                        
            # Sort by action date
            recent_actions.sort(key=lambda x: x.get('action_date', 0), reverse=True)
            
            return recent_actions
            
        except Exception as e:
            print(f"Error getting recent bill actions: {str(e)}")
            return []
    
    async def get_batch_bill_updates(self, 
                                   bill_ids: List[str], 
                                   include_full_text: bool = False) -> List[Dict]:
        """
        Get updates for multiple bills in batch
        
        Args:
            bill_ids: List of bill IDs
            include_full_text: Whether to include full text versions
            
        Returns:
            List of updated bills
        """
        try:
            updated_bills = []
            
            for bill_id in bill_ids:
                try:
                    # Get detailed bill information
                    bill_details = await self.get_bill_detailed(bill_id)
                    if not bill_details:
                        continue
                        
                    # Add full text if requested
                    if include_full_text:
                        text_versions = await self.get_bill_text_versions(bill_id)
                        bill_details['text_versions'] = text_versions
                    
                    updated_bills.append(bill_details)
                    
                    # Rate limiting
                    await self.rate_limiter.wait_if_needed()
                    
                except Exception as e:
                    print(f"Error getting bill {bill_id}: {str(e)}")
                    continue
                    
            return updated_bills
            
        except Exception as e:
            print(f"Error in batch bill updates: {str(e)}")
            return []
    
    async def get_session_statistics(self, session_id: str, state_code: str) -> Dict:
        """
        Get statistics for a legislative session
        
        Args:
            session_id: Legislative session ID
            state_code: State code
            
        Returns:
            Session statistics
        """
        try:
            # Get session info
            session_info = await self.get_session_info(session_id, state_code)
            if not session_info:
                return {}
                
            # Get all bills in session
            bills = await self.get_session_bills(session_id, state_code)
            
            # Calculate statistics
            stats = {
                'session_id': session_id,
                'state_code': state_code,
                'total_bills': len(bills),
                'status_breakdown': {},
                'recent_activity': 0,
                'session_info': session_info
            }
            
            # Calculate status breakdown
            for bill in bills:
                status = bill.get('status', 'unknown')
                stats['status_breakdown'][status] = stats['status_breakdown'].get(status, 0) + 1
                
            # Count recent activity (last 7 days)
            week_ago = datetime.utcnow() - timedelta(days=7)
            for bill in bills:
                if await self.is_bill_updated_since(bill, week_ago):
                    stats['recent_activity'] += 1
                    
            return stats
            
        except Exception as e:
            print(f"Error getting session statistics: {str(e)}")
            return {}


# Create global service instance
legiscan_service = LegiScanService()