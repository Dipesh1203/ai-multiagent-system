#!/usr/bin/env node

/**
 * Nexus-Agent Setup Validation Script
 * Tests that all components are properly configured
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description} (missing: ${filePath})`, 'red');
    return false;
  }
}

function checkEnvVariable(variable) {
  if (process.env[variable]) {
    log(`✓ Environment variable ${variable} is set`, 'green');
    return true;
  } else {
    log(`✗ Environment variable ${variable} is NOT set`, 'yellow');
    return false;
  }
}

async function main() {
  log('\n=== Nexus-Agent Setup Validation ===\n', 'blue');

  let passed = 0;
  let failed = 0;

  // Check project files
  log('Checking project structure...', 'blue');
  const files = [
    ['package.json', 'Package configuration'],
    ['app/layout.tsx', 'React layout'],
    ['app/page.tsx', 'Home page'],
    ['app/api/agents/execute/route.ts', 'Agent execution API'],
    ['app/api/agents/status/route.ts', 'Status API'],
    ['app/api/agents/workflow/route.ts', 'Workflow API'],
    ['app/api/agents/audit-logs/route.ts', 'Audit logs API'],
    ['components/dashboard/agent-dashboard.tsx', 'Dashboard component'],
    ['scripts/agents/pyproject.toml', 'Python project config'],
    ['scripts/agents/agent_builder.py', 'LangGraph agent builder'],
    ['scripts/agents/executor.py', 'Agent executor'],
    ['scripts/agents/database.py', 'Database manager'],
    ['scripts/agents/tools.py', 'Tool system'],
    ['scripts/01-init-schema.sql', 'Database schema'],
  ];

  files.forEach(([file, desc]) => {
    if (checkFile(file, desc)) {
      passed++;
    } else {
      failed++;
    }
  });

  // Check environment variables
  log('\nChecking environment variables...', 'blue');
  const envVars = ['DATABASE_URL', 'GOOGLE_API_KEY'];

  envVars.forEach(envVar => {
    if (checkEnvVariable(envVar)) {
      passed++;
    } else {
      failed++;
    }
  });

  // Summary
  log('\n=== Validation Summary ===\n', 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  if (failed > 0) {
    log('\nSetup Issues Detected:', 'yellow');
    if (!process.env.DATABASE_URL) {
      log('1. Set DATABASE_URL environment variable with your Neon PostgreSQL connection string', 'yellow');
    }
    if (!process.env.GOOGLE_API_KEY) {
      log('2. Set GOOGLE_API_KEY environment variable for Google Gemini API access', 'yellow');
    }
    log('\nTo set variables in v0:', 'blue');
    log('1. Click Settings (top right)', 'blue');
    log('2. Go to "Vars" tab', 'blue');
    log('3. Add environment variables', 'blue');
  } else {
    log('\n✓ All checks passed! Ready to test.', 'green');
  }

  log('\nNext Steps:', 'blue');
  log('1. Run: npm run dev', 'blue');
  log('2. Visit: http://localhost:3000', 'blue');
  log('3. Test the dashboard and API endpoints', 'blue');
  log('4. Check TESTING.md for detailed test instructions', 'blue');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  log(`Error: ${err.message}`, 'red');
  process.exit(1);
});
