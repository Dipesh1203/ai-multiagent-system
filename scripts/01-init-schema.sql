-- Nexus-Agent: Core Database Schema
-- Initialize all tables for the agent orchestration system

-- Agents table: Stores agent definitions and metadata
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  agent_type VARCHAR(50) NOT NULL, -- 'research', 'analysis', 'decision', 'execution'
  model_config JSONB DEFAULT '{}', -- LLM configuration
  tools JSONB DEFAULT '[]', -- Array of tool IDs available to this agent
  system_prompt TEXT,
  max_retries INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflows table: Stores workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  definition JSONB NOT NULL, -- Workflow graph definition
  creator_id VARCHAR(255),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Executions table: Tracks workflow execution instances
CREATE TABLE IF NOT EXISTS executions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES workflows(id),
  execution_id UUID DEFAULT gen_random_uuid(),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'paused'
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent States table: Stores agent state for resumability
CREATE TABLE IF NOT EXISTS agent_states (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER REFERENCES executions(id),
  agent_id INTEGER REFERENCES agents(id),
  step_number INTEGER,
  state JSONB NOT NULL, -- Complete agent state for checkpointing
  memory JSONB DEFAULT '{}', -- Agent memory/context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log table: Complete audit trail of all operations
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER REFERENCES executions(id),
  agent_id INTEGER REFERENCES agents(id),
  action VARCHAR(100), -- 'tool_call', 'decision', 'error', 'completion'
  details JSONB,
  user_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tools table: Registry of available tools
CREATE TABLE IF NOT EXISTS tools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50), -- 'search', 'api', 'computation', 'file', 'custom'
  schema JSONB NOT NULL, -- JSON schema for tool parameters
  handler_function VARCHAR(255), -- Python function path
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_states_execution ON agent_states(execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_execution ON audit_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent ON audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
