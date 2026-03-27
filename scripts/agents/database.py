"""Database connection and operations for Nexus-Agent."""
import os
import json
from datetime import datetime
from typing import Any, Dict, Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor


class DatabaseManager:
    """Manages database connections and queries."""

    def __init__(self):
        """Initialize database manager with connection from environment."""
        self.connection_string = os.getenv('PYTHON_DATABASE_URL') or os.getenv('DATABASE_URL')
        if not self.connection_string:
            raise ValueError("PYTHON_DATABASE_URL or DATABASE_URL environment variable not set")

    def get_connection(self):
        """Get database connection."""
        return psycopg2.connect(self.connection_string)

    def create_execution(self, agent_id: str, workflow_id: str, input_data: Dict[str, Any]) -> str:
        """Create a new execution record."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """
                INSERT INTO executions (agent_id, workflow_id, status, input_data, created_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (agent_id, workflow_id, 'pending', json.dumps(input_data), datetime.utcnow())
            )
            execution_id = cursor.fetchone()[0]
            conn.commit()
            return execution_id
        finally:
            cursor.close()
            conn.close()

    def update_execution(
        self,
        execution_id: str,
        status: str,
        output: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> None:
        """Update execution record."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """
                UPDATE executions
                SET status = %s, output_data = %s, error = %s, updated_at = %s
                WHERE id = %s
                """,
                (
                    status,
                    json.dumps(output) if output else None,
                    error,
                    datetime.utcnow(),
                    execution_id
                )
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def save_agent_state(self, execution_id: str, agent_id: str, state_data: Dict[str, Any]) -> None:
        """Save agent state."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """
                INSERT INTO agent_states (execution_id, agent_id, state_data, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (execution_id, agent_id) DO UPDATE
                SET state_data = %s, updated_at = %s
                """,
                (
                    execution_id,
                    agent_id,
                    json.dumps(state_data),
                    datetime.utcnow(),
                    json.dumps(state_data),
                    datetime.utcnow()
                )
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def log_audit_entry(
        self,
        execution_id: str,
        agent_id: str,
        action: str,
        details: Dict[str, Any]
    ) -> None:
        """Log audit trail entry."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """
                INSERT INTO audit_logs (execution_id, agent_id, action, details, created_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    execution_id,
                    agent_id,
                    action,
                    json.dumps(details),
                    datetime.utcnow()
                )
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def get_execution(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get execution record."""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("SELECT * FROM executions WHERE id = %s", (execution_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

    def get_agent_state(self, execution_id: str, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get agent state."""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute(
                "SELECT state_data FROM agent_states WHERE execution_id = %s AND agent_id = %s",
                (execution_id, agent_id)
            )
            result = cursor.fetchone()
            return result['state_data'] if result else None
        finally:
            cursor.close()
            conn.close()
