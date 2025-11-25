"""
Database Connection Pool Implementation
Optimizes database connections for better performance
"""

import pyodbc
import threading
import time
import logging
from queue import Queue, Empty
from typing import Optional
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ConnectionPoolConfig:
    """Configuration for database connection pool"""
    max_connections: int = 10
    min_connections: int = 2
    connection_timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    pool_timeout: int = 10
    
class DatabaseConnection:
    """Wrapper for database connection with metadata"""
    def __init__(self, connection, pool):
        self.connection = connection
        self.pool = pool
        self.created_at = time.time()
        self.last_used = time.time()
        self.in_use = False
        self.transaction_count = 0
    
    def __enter__(self):
        self.in_use = True
        self.last_used = time.time()
        return self.connection
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.in_use = False
        self.transaction_count += 1
        # Return connection to pool
        self.pool._return_connection(self)

class DatabaseConnectionPool:
    """Thread-safe database connection pool"""
    
    def __init__(self, connection_string: str, config: ConnectionPoolConfig = None):
        self.connection_string = connection_string
        self.config = config or ConnectionPoolConfig()
        self._pool = Queue(maxsize=self.config.max_connections)
        self._active_connections = set()
        self._lock = threading.Lock()
        self._total_connections = 0
        self._closed = False
        
        # Initialize minimum connections
        self._initialize_pool()
        
        logger.info(f"Database connection pool initialized with {self.config.min_connections} connections")
    
    def _create_connection(self) -> pyodbc.Connection:
        """Create a new database connection"""
        try:
            connection = pyodbc.connect(
                self.connection_string,
                timeout=self.config.connection_timeout,
                autocommit=True
            )
            logger.debug("Created new database connection")
            return connection
        except Exception as e:
            logger.error(f"Failed to create database connection: {e}")
            raise
    
    def _initialize_pool(self):
        """Initialize the pool with minimum connections"""
        with self._lock:
            for _ in range(self.config.min_connections):
                try:
                    conn = self._create_connection()
                    wrapped_conn = DatabaseConnection(conn, self)
                    self._pool.put(wrapped_conn, block=False)
                    self._total_connections += 1
                except Exception as e:
                    logger.error(f"Failed to initialize connection: {e}")
                    break
    
    def get_connection(self) -> DatabaseConnection:
        """Get a connection from the pool"""
        if self._closed:
            raise RuntimeError("Connection pool is closed")
        
        # Try to get an existing connection
        try:
            wrapped_conn = self._pool.get(timeout=self.config.pool_timeout)
            
            # Test connection validity
            try:
                wrapped_conn.connection.execute("SELECT 1")
                with self._lock:
                    self._active_connections.add(wrapped_conn)
                return wrapped_conn
            except Exception:
                # Connection is invalid, close it and create a new one
                logger.warning("Invalid connection found in pool, creating new one")
                self._close_connection(wrapped_conn)
                
        except Empty:
            # Pool is empty or timeout occurred
            pass
        
        # Create new connection if pool allows
        with self._lock:
            if self._total_connections < self.config.max_connections:
                try:
                    conn = self._create_connection()
                    wrapped_conn = DatabaseConnection(conn, self)
                    self._total_connections += 1
                    self._active_connections.add(wrapped_conn)
                    logger.debug(f"Created new connection (total: {self._total_connections})")
                    return wrapped_conn
                except Exception as e:
                    logger.error(f"Failed to create new connection: {e}")
                    raise
        
        raise RuntimeError(f"Unable to get database connection within {self.config.pool_timeout} seconds")
    
    def _return_connection(self, wrapped_conn: DatabaseConnection):
        """Return a connection to the pool"""
        if self._closed:
            self._close_connection(wrapped_conn)
            return
        
        with self._lock:
            self._active_connections.discard(wrapped_conn)
        
        # Test connection before returning to pool
        try:
            wrapped_conn.connection.execute("SELECT 1")
            self._pool.put(wrapped_conn, block=False)
        except Exception:
            logger.warning("Connection failed health check, closing")
            self._close_connection(wrapped_conn)
        except Exception:
            # Pool is full, close connection
            logger.debug("Pool full, closing excess connection")
            self._close_connection(wrapped_conn)
    
    def _close_connection(self, wrapped_conn: DatabaseConnection):
        """Close a database connection"""
        try:
            wrapped_conn.connection.close()
        except Exception:
            pass
        
        with self._lock:
            self._total_connections -= 1
            self._active_connections.discard(wrapped_conn)
    
    def close_all(self):
        """Close all connections in the pool"""
        self._closed = True
        
        # Close active connections
        with self._lock:
            for wrapped_conn in list(self._active_connections):
                self._close_connection(wrapped_conn)
        
        # Close pooled connections
        while not self._pool.empty():
            try:
                wrapped_conn = self._pool.get_nowait()
                self._close_connection(wrapped_conn)
            except Empty:
                break
        
        logger.info("All database connections closed")
    
    def get_stats(self) -> dict:
        """Get connection pool statistics"""
        with self._lock:
            return {
                "total_connections": self._total_connections,
                "active_connections": len(self._active_connections),
                "pooled_connections": self._pool.qsize(),
                "max_connections": self.config.max_connections,
                "pool_closed": self._closed
            }

# Global connection pool instance
_connection_pool: Optional[DatabaseConnectionPool] = None
_pool_lock = threading.Lock()

def initialize_connection_pool(connection_string: str = None, config: ConnectionPoolConfig = None):
    """Initialize the global connection pool"""
    global _connection_pool
    
    if connection_string is None:
        # Get from environment or use default
        connection_string = os.getenv('DATABASE_CONNECTION_STRING')
        if not connection_string:
            raise ValueError("Database connection string not provided")
    
    with _pool_lock:
        if _connection_pool is not None:
            _connection_pool.close_all()
        
        _connection_pool = DatabaseConnectionPool(connection_string, config)
        logger.info("Global database connection pool initialized")

def get_pooled_connection() -> DatabaseConnection:
    """Get a connection from the global pool"""
    if _connection_pool is None:
        raise RuntimeError("Connection pool not initialized. Call initialize_connection_pool() first.")
    
    return _connection_pool.get_connection()

def get_pool_stats() -> dict:
    """Get statistics for the global connection pool"""
    if _connection_pool is None:
        return {"error": "Connection pool not initialized"}
    
    return _connection_pool.get_stats()

def close_connection_pool():
    """Close the global connection pool"""
    global _connection_pool
    
    with _pool_lock:
        if _connection_pool is not None:
            _connection_pool.close_all()
            _connection_pool = None
            logger.info("Global database connection pool closed")