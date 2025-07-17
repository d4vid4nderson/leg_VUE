"""
Rate Limiter Utility
Implements rate limiting for API calls to prevent exceeding limits
"""

import asyncio
import time
from typing import Dict, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class RateLimitedClient:
    """
    Rate limiter for API calls with sliding window approach
    """
    
    def __init__(self, requests_per_minute: int = 60, requests_per_hour: int = 3600):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.requests_this_minute = []
        self.requests_this_hour = []
        self.last_request_time = 0
        self.min_interval = 60 / requests_per_minute  # Minimum seconds between requests
        
    async def wait_if_needed(self):
        """Wait if necessary to respect rate limits"""
        current_time = time.time()
        
        # Clean old requests from tracking
        self._clean_old_requests()
        
        # Check if we're hitting minute limit
        if len(self.requests_this_minute) >= self.requests_per_minute:
            wait_time = 60 - (current_time - self.requests_this_minute[0])
            if wait_time > 0:
                logger.info(f"Rate limit: waiting {wait_time:.2f}s for minute limit")
                await asyncio.sleep(wait_time)
                self._clean_old_requests()
        
        # Check if we're hitting hour limit
        if len(self.requests_this_hour) >= self.requests_per_hour:
            wait_time = 3600 - (current_time - self.requests_this_hour[0])
            if wait_time > 0:
                logger.info(f"Rate limit: waiting {wait_time:.2f}s for hour limit")
                await asyncio.sleep(wait_time)
                self._clean_old_requests()
        
        # Ensure minimum interval between requests
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_interval:
            wait_time = self.min_interval - time_since_last
            await asyncio.sleep(wait_time)
        
        # Record this request
        current_time = time.time()
        self.requests_this_minute.append(current_time)
        self.requests_this_hour.append(current_time)
        self.last_request_time = current_time
    
    def _clean_old_requests(self):
        """Remove requests older than the time window"""
        current_time = time.time()
        
        # Remove requests older than 1 minute
        self.requests_this_minute = [
            req_time for req_time in self.requests_this_minute
            if current_time - req_time < 60
        ]
        
        # Remove requests older than 1 hour
        self.requests_this_hour = [
            req_time for req_time in self.requests_this_hour
            if current_time - req_time < 3600
        ]
    
    def get_stats(self) -> Dict:
        """Get current rate limiting statistics"""
        self._clean_old_requests()
        
        return {
            'requests_this_minute': len(self.requests_this_minute),
            'requests_this_hour': len(self.requests_this_hour),
            'minute_limit': self.requests_per_minute,
            'hour_limit': self.requests_per_hour,
            'time_to_next_minute_reset': 60 - (time.time() - min(self.requests_this_minute)) if self.requests_this_minute else 0,
            'time_to_next_hour_reset': 3600 - (time.time() - min(self.requests_this_hour)) if self.requests_this_hour else 0
        }


class LegiScanRateLimiter:
    """
    Specialized rate limiter for LegiScan API with known limits
    """
    
    def __init__(self):
        # LegiScan API limits (adjust based on your subscription)
        self.client = RateLimitedClient(
            requests_per_minute=60,  # Typical free tier limit
            requests_per_hour=1000   # Typical free tier limit
        )
        
    async def wait_if_needed(self):
        """Wait if necessary to respect LegiScan rate limits"""
        await self.client.wait_if_needed()
    
    def get_stats(self) -> Dict:
        """Get current rate limiting statistics"""
        return self.client.get_stats()


class BatchProcessor:
    """
    Process items in batches with rate limiting
    """
    
    def __init__(self, rate_limiter: RateLimitedClient, batch_size: int = 10):
        self.rate_limiter = rate_limiter
        self.batch_size = batch_size
        
    async def process_batch(self, items: list, process_func, progress_callback=None):
        """
        Process items in batches with rate limiting
        
        Args:
            items: List of items to process
            process_func: Async function to process each item
            progress_callback: Optional callback to report progress
            
        Returns:
            List of processing results
        """
        results = []
        total_items = len(items)
        
        for i in range(0, total_items, self.batch_size):
            batch = items[i:i + self.batch_size]
            batch_results = []
            
            for item in batch:
                try:
                    # Wait for rate limiting
                    await self.rate_limiter.wait_if_needed()
                    
                    # Process the item
                    result = await process_func(item)
                    batch_results.append(result)
                    
                    # Report progress if callback provided
                    if progress_callback:
                        progress = ((i + len(batch_results)) / total_items) * 100
                        await progress_callback(progress)
                        
                except Exception as e:
                    logger.error(f"Error processing item {item}: {str(e)}")
                    batch_results.append(None)
            
            results.extend(batch_results)
            
            # Small delay between batches
            await asyncio.sleep(0.1)
        
        return results


# Global rate limiter instance
legiscan_rate_limiter = LegiScanRateLimiter()