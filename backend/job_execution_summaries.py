#!/usr/bin/env python3
"""
Job Execution Summaries Module
Handles storing and retrieving job execution summaries for automation report
"""

import logging
from datetime import datetime
from typing import Optional, Dict
from database_config import get_db_connection

logger = logging.getLogger(__name__)

def create_job_summaries_table():
    """Create the job execution summaries table if it doesn't exist"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Create table for storing job execution summaries
            cursor.execute("""
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'job_execution_summaries')
                BEGIN
                    CREATE TABLE dbo.job_execution_summaries (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        execution_name NVARCHAR(255) NOT NULL UNIQUE,
                        job_name NVARCHAR(255) NOT NULL,
                        job_type NVARCHAR(50) NOT NULL,  -- 'executive-orders' or 'state-bills'
                        status NVARCHAR(50) NOT NULL,    -- 'Succeeded', 'Failed', 'Running'
                        summary NVARCHAR(MAX),           -- Summary message like "Updated 2 executive orders"
                        items_processed INT DEFAULT 0,   -- Number of items processed
                        items_total INT DEFAULT 0,       -- Total items in batch
                        states_count INT DEFAULT 0,      -- For state bills: number of states
                        is_manual BIT DEFAULT 0,         -- Manual vs scheduled execution
                        start_time DATETIME2,
                        end_time DATETIME2,
                        created_at DATETIME2 DEFAULT GETDATE(),
                        updated_at DATETIME2 DEFAULT GETDATE()
                    )

                    CREATE INDEX idx_execution_name ON dbo.job_execution_summaries(execution_name)
                    CREATE INDEX idx_job_type ON dbo.job_execution_summaries(job_type)
                    CREATE INDEX idx_created_at ON dbo.job_execution_summaries(created_at DESC)
                END
            """)

            conn.commit()
            logger.info("✅ Job execution summaries table created/verified")
            return True

    except Exception as e:
        logger.error(f"❌ Error creating job summaries table: {e}")
        return False


def save_job_summary(
    execution_name: str,
    job_name: str,
    job_type: str,
    status: str,
    summary: str,
    items_processed: int = 0,
    items_total: int = 0,
    states_count: int = 0,
    is_manual: bool = False,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None
) -> bool:
    """
    Save or update a job execution summary

    Args:
        execution_name: Unique execution identifier (e.g., 'job-executive-orders-nightly--fge53z1')
        job_name: Job name (e.g., 'job-executive-orders-nightly')
        job_type: 'executive-orders' or 'state-bills'
        status: 'Succeeded', 'Failed', 'Running'
        summary: Human-readable summary (e.g., "Updated 2 executive orders" or "Nothing to update at this time")
        items_processed: Number of items processed
        items_total: Total items in batch
        states_count: For state bills, number of states processed
        is_manual: Whether this was a manual execution
        start_time: Job start time
        end_time: Job end time
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Check if record exists
            cursor.execute("""
                SELECT id FROM dbo.job_execution_summaries
                WHERE execution_name = ?
            """, (execution_name,))

            existing = cursor.fetchone()

            if existing:
                # Update existing record
                cursor.execute("""
                    UPDATE dbo.job_execution_summaries
                    SET job_name = ?,
                        job_type = ?,
                        status = ?,
                        summary = ?,
                        items_processed = ?,
                        items_total = ?,
                        states_count = ?,
                        is_manual = ?,
                        start_time = ?,
                        end_time = ?,
                        updated_at = GETDATE()
                    WHERE execution_name = ?
                """, (
                    job_name, job_type, status, summary,
                    items_processed, items_total, states_count, is_manual,
                    start_time, end_time, execution_name
                ))
                logger.info(f"✅ Updated job summary for {execution_name}")
            else:
                # Insert new record
                cursor.execute("""
                    INSERT INTO dbo.job_execution_summaries (
                        execution_name, job_name, job_type, status, summary,
                        items_processed, items_total, states_count, is_manual,
                        start_time, end_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    execution_name, job_name, job_type, status, summary,
                    items_processed, items_total, states_count, is_manual,
                    start_time, end_time
                ))
                logger.info(f"✅ Saved new job summary for {execution_name}")

            conn.commit()
            return True

    except Exception as e:
        logger.error(f"❌ Error saving job summary for {execution_name}: {e}")
        return False


def get_job_summary(execution_name: str) -> Optional[Dict]:
    """
    Retrieve a job execution summary by execution name

    Returns:
        Dictionary with summary data or None if not found
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    execution_name, job_name, job_type, status, summary,
                    items_processed, items_total, states_count, is_manual,
                    start_time, end_time, created_at, updated_at
                FROM dbo.job_execution_summaries
                WHERE execution_name = ?
            """, (execution_name,))

            row = cursor.fetchone()
            if row:
                return {
                    'execution_name': row[0],
                    'job_name': row[1],
                    'job_type': row[2],
                    'status': row[3],
                    'summary': row[4],
                    'items_processed': row[5],
                    'items_total': row[6],
                    'states_count': row[7],
                    'is_manual': bool(row[8]),
                    'start_time': row[9],
                    'end_time': row[10],
                    'created_at': row[11],
                    'updated_at': row[12]
                }

            return None

    except Exception as e:
        logger.error(f"❌ Error retrieving job summary for {execution_name}: {e}")
        return None


def get_recent_job_summaries(job_type: Optional[str] = None, limit: int = 10) -> list:
    """
    Get recent job execution summaries

    Args:
        job_type: Optional filter by job type ('executive-orders' or 'state-bills')
        limit: Maximum number of records to return

    Returns:
        List of summary dictionaries
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if job_type:
                query = f"""
                    SELECT TOP {limit}
                        execution_name, job_name, job_type, status, summary,
                        items_processed, items_total, states_count, is_manual,
                        start_time, end_time, created_at, updated_at
                    FROM dbo.job_execution_summaries
                    WHERE job_type = ?
                    ORDER BY created_at DESC
                """
                cursor.execute(query, (job_type,))
            else:
                query = f"""
                    SELECT TOP {limit}
                        execution_name, job_name, job_type, status, summary,
                        items_processed, items_total, states_count, is_manual,
                        start_time, end_time, created_at, updated_at
                    FROM dbo.job_execution_summaries
                    ORDER BY created_at DESC
                """
                cursor.execute(query)

            results = []
            for row in cursor.fetchall():
                results.append({
                    'execution_name': row[0],
                    'job_name': row[1],
                    'job_type': row[2],
                    'status': row[3],
                    'summary': row[4],
                    'items_processed': row[5],
                    'items_total': row[6],
                    'states_count': row[7],
                    'is_manual': bool(row[8]),
                    'start_time': row[9],
                    'end_time': row[10],
                    'created_at': row[11],
                    'updated_at': row[12]
                })

            return results

    except Exception as e:
        logger.error(f"❌ Error retrieving recent job summaries: {e}")
        return []


def generate_summary_message(job_type: str, items_processed: int, states_count: int = 0) -> str:
    """
    Generate a human-readable summary message

    Args:
        job_type: 'executive-orders' or 'state-bills'
        items_processed: Number of items processed
        states_count: For state bills, number of states

    Returns:
        Formatted summary message
    """
    if items_processed == 0:
        return "Nothing to update at this time"

    if job_type == 'executive-orders':
        order_word = "executive order" if items_processed == 1 else "executive orders"
        return f"Updated {items_processed} {order_word}"

    elif job_type == 'state-bills':
        bill_word = "bill" if items_processed == 1 else "bills"
        if states_count > 0:
            state_word = "state" if states_count == 1 else "states"
            return f"Updated {items_processed} {bill_word} across {states_count} {state_word}"
        else:
            return f"Updated {items_processed} {bill_word}"

    return f"Processed {items_processed} items"


if __name__ == "__main__":
    # Create table and run tests
    logging.basicConfig(level=logging.INFO)

    print("🔧 Creating job execution summaries table...")
    create_job_summaries_table()

    print("\n🧪 Testing save and retrieve...")

    # Test saving a summary
    test_execution = f"job-executive-orders-nightly--test-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    summary_msg = generate_summary_message('executive-orders', 2)

    save_job_summary(
        execution_name=test_execution,
        job_name="job-executive-orders-nightly",
        job_type="executive-orders",
        status="Succeeded",
        summary=summary_msg,
        items_processed=2,
        items_total=2,
        is_manual=True,
        start_time=datetime.now(),
        end_time=datetime.now()
    )

    # Test retrieving
    result = get_job_summary(test_execution)
    if result:
        print(f"\n✅ Retrieved summary: {result['summary']}")
    else:
        print("\n❌ Failed to retrieve summary")

    # Test recent summaries
    print("\n📋 Recent summaries:")
    recent = get_recent_job_summaries(limit=5)
    for s in recent:
        print(f"  - {s['job_type']}: {s['summary']} ({s['status']})")
