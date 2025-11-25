"""
AI Processor Service
Handles AI analysis and categorization of legislative bills
"""

import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.db_setup import get_db_session
from models.bills import Bills
import openai
import json

logger = logging.getLogger(__name__)

class BillAnalyzer:
    """
    AI-powered bill analysis and categorization
    """
    
    def __init__(self):
        # Initialize OpenAI client (you may want to use a different AI service)
        self.openai_client = openai.AsyncOpenAI()
        
    async def analyze_bill(self, bill_data: Dict) -> Dict:
        """
        Analyze a bill using AI to extract key information
        
        Args:
            bill_data: Dictionary containing bill information
            
        Returns:
            Dictionary containing analysis results
        """
        try:
            # Prepare bill text for analysis
            bill_text = self._prepare_bill_text(bill_data)
            
            # Generate AI analysis
            analysis = await self._generate_ai_analysis(bill_text)
            
            # Process and validate results
            processed_analysis = self._process_analysis_results(analysis)
            
            return processed_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing bill {bill_data.get('bill_id', 'unknown')}: {str(e)}")
            return self._get_default_analysis()
    
    def _prepare_bill_text(self, bill_data: Dict) -> str:
        """Prepare bill text for AI analysis"""
        text_parts = []
        
        # Add title
        if bill_data.get('title'):
            text_parts.append(f"Title: {bill_data['title']}")
        
        # Add description
        if bill_data.get('description'):
            text_parts.append(f"Description: {bill_data['description']}")
        
        # Add summary if available
        if bill_data.get('summary'):
            text_parts.append(f"Summary: {bill_data['summary']}")
        
        # Add full text if available (truncate if too long)
        if bill_data.get('text'):
            text = bill_data['text']
            if len(text) > 10000:  # Truncate to avoid token limits
                text = text[:10000] + "..."
            text_parts.append(f"Full Text: {text}")
        
        return "\n\n".join(text_parts)
    
    async def _generate_ai_analysis(self, bill_text: str) -> Dict:
        """Generate AI analysis of bill text"""
        system_prompt = """
        You are a legislative bill analyzer. Analyze the provided bill text and return a JSON response with the following structure:
        
        {
            "category": "category_name",
            "subcategory": "subcategory_name",
            "key_provisions": ["provision1", "provision2", "provision3"],
            "affected_groups": ["group1", "group2"],
            "fiscal_impact": "high|medium|low|none",
            "controversy_level": "high|medium|low",
            "summary": "brief summary of the bill",
            "tags": ["tag1", "tag2", "tag3"]
        }
        
        Categories should be one of: healthcare, education, transportation, environment, economy, civil_rights, criminal_justice, government, technology, other
        
        Provide a concise but comprehensive analysis.
        """
        
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze this bill:\n\n{bill_text}"}
                ],
                max_tokens=1000,
                temperature=0.3
            )
            
            # Parse JSON response
            content = response.choices[0].message.content
            analysis = json.loads(content)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error generating AI analysis: {str(e)}")
            return self._get_default_analysis()
    
    def _process_analysis_results(self, analysis: Dict) -> Dict:
        """Process and validate AI analysis results"""
        # Validate required fields
        required_fields = ['category', 'summary', 'tags']
        for field in required_fields:
            if field not in analysis:
                analysis[field] = self._get_default_value(field)
        
        # Validate category
        valid_categories = [
            'healthcare', 'education', 'transportation', 'environment', 
            'economy', 'civil_rights', 'criminal_justice', 'government', 
            'technology', 'other'
        ]
        if analysis['category'] not in valid_categories:
            analysis['category'] = 'other'
        
        # Ensure tags is a list
        if not isinstance(analysis.get('tags'), list):
            analysis['tags'] = []
        
        # Limit tags to reasonable number
        analysis['tags'] = analysis['tags'][:10]
        
        # Add metadata
        analysis['analysis_timestamp'] = datetime.utcnow().isoformat()
        analysis['analysis_version'] = '1.0'
        
        return analysis
    
    def _get_default_analysis(self) -> Dict:
        """Get default analysis when AI analysis fails"""
        return {
            'category': 'other',
            'subcategory': 'unknown',
            'key_provisions': [],
            'affected_groups': [],
            'fiscal_impact': 'unknown',
            'controversy_level': 'unknown',
            'summary': 'Analysis not available',
            'tags': [],
            'analysis_timestamp': datetime.utcnow().isoformat(),
            'analysis_version': '1.0'
        }
    
    def _get_default_value(self, field: str):
        """Get default value for a field"""
        defaults = {
            'category': 'other',
            'subcategory': 'unknown',
            'key_provisions': [],
            'affected_groups': [],
            'fiscal_impact': 'unknown',
            'controversy_level': 'unknown',
            'summary': 'No summary available',
            'tags': []
        }
        return defaults.get(field, '')
    
    async def process_pending_bills(self, batch_size: int = 50) -> Dict:
        """
        Process bills that need AI analysis
        
        Args:
            batch_size: Number of bills to process in one batch
            
        Returns:
            Dictionary with processing statistics
        """
        stats = {
            'processed': 0,
            'failed': 0,
            'skipped': 0
        }
        
        try:
            # Get bills that need AI processing
            pending_bills = await self._get_pending_bills(batch_size)
            
            logger.info(f"Processing {len(pending_bills)} bills for AI analysis")
            
            for bill in pending_bills:
                try:
                    # Convert bill to dict for analysis
                    bill_data = self._bill_to_dict(bill)
                    
                    # Analyze the bill
                    analysis = await self.analyze_bill(bill_data)
                    
                    # Save analysis results
                    await self._save_analysis_results(bill.id, analysis)
                    
                    # Mark as processed
                    await self._mark_bill_processed(bill.id)
                    
                    stats['processed'] += 1
                    
                    # Small delay to avoid overwhelming the AI service
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Error processing bill {bill.id}: {str(e)}")
                    stats['failed'] += 1
                    
        except Exception as e:
            logger.error(f"Error in process_pending_bills: {str(e)}")
            
        return stats
    
    async def _get_pending_bills(self, limit: int) -> List[Bills]:
        """Get bills that need AI processing"""
        async with get_db_session() as session:
            query = select(Bills).where(
                Bills.needs_ai_processing == True
            ).limit(limit)
            
            result = await session.execute(query)
            return result.scalars().all()
    
    def _bill_to_dict(self, bill: Bills) -> Dict:
        """Convert bill model to dictionary for analysis"""
        return {
            'bill_id': bill.bill_id,
            'title': bill.title,
            'description': bill.description,
            'summary': getattr(bill, 'summary', ''),
            'text': getattr(bill, 'text', ''),
            'status': bill.status,
            'session_id': bill.session_id,
            'state_code': bill.state_code
        }
    
    async def _save_analysis_results(self, bill_id: str, analysis: Dict):
        """Save AI analysis results to database"""
        async with get_db_session() as session:
            # Update bill with analysis results
            update_query = update(Bills).where(Bills.id == bill_id).values(
                ai_category=analysis.get('category'),
                ai_summary=analysis.get('summary'),
                ai_tags=json.dumps(analysis.get('tags', [])),
                ai_analysis_data=json.dumps(analysis),
                ai_analysis_timestamp=datetime.utcnow()
            )
            
            await session.execute(update_query)
            await session.commit()
    
    async def _mark_bill_processed(self, bill_id: str):
        """Mark bill as processed for AI analysis"""
        async with get_db_session() as session:
            update_query = update(Bills).where(Bills.id == bill_id).values(
                needs_ai_processing=False
            )
            
            await session.execute(update_query)
            await session.commit()


# Global AI processor instance
bill_analyzer = BillAnalyzer()