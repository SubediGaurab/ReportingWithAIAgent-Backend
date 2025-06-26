# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AWS Lambda-based AI agent that generates Chart.js-compatible JSON from natural language prompts by querying a PostgreSQL database. The system uses Amazon Bedrock's inline agent functionality to interpret user requests and generate data visualizations.

## Architecture

The application follows a serverless architecture with these key components:

- **Lambda Handler** (`function/lambda_function.py`): Main entry point handling API Gateway requests
- **Inline Agent** (`function/agent/inline_agent.py`): Bedrock agent orchestration with tool specifications
- **SQL Tools** (`function/tools/sql_tools.py`): Database interaction layer with schema discovery and query execution
- **Manual Runner** (`manual_run.py`): Local testing utility for database operations

The agent is configured to:
1. Only create one chart per request
2. Use `get_schema` tool first to understand database structure
3. Execute read-only SELECT queries via `execute_sql` tool
4. Return Chart.js-compatible JSON or error messages

## Development Commands

### Environment Setup
```bash
# Create conda environment
conda env create -f environment.yml
conda activate ReportingWithAIAgent_env

# Install Python dependencies locally for development
pip install -r function/requirements.txt python-dotenv
```

### AWS Deployment
```bash
# Create S3 bucket for deployment artifacts
./deployment/1-create-bucket.sh

# Build Lambda layer with dependencies
./deployment/2-build-layer.sh

# Deploy CloudFormation stack
./deployment/3-deploy.sh

# Test deployed function
./deployment/4-invoke.sh

# Clean up resources
./deployment/5-cleanup.sh
```

### Local Development
```bash
# Test database connectivity locally
python manual_run.py
```

## Database Configuration

The application connects to a PostgreSQL database using environment variables:
- `user`: Database username
- `password`: Database password  
- `host`: Database host
- `port`: Database port
- `dbname`: Database name

For local development, create a `.env` file with these variables. In AWS, these should be configured as Lambda environment variables.

## Key Dependencies

- `boto3==1.38.42`: AWS SDK for Bedrock agent runtime
- `psycopg2-binary==2.9.10`: PostgreSQL database adapter
- `jsonpickle==4.1.1`: JSON serialization for logging

## Agent Behavior

The Bedrock agent is instructed to:
- Only process chart generation requests
- Always query the 'ReportingWithAIAgent' schema
- Enforce read-only database access
- Return Chart.js-formatted JSON with 'type', 'data', and 'options' keys
- Handle errors gracefully with JSON error responses

## File Structure

```
function/
├── lambda_function.py     # API Gateway handler
├── agent/
│   └── inline_agent.py   # Bedrock agent configuration
├── tools/
│   └── sql_tools.py      # Database interaction tools
└── requirements.txt      # Python dependencies
deployment/               # AWS deployment scripts
├── 1-create-bucket.sh
├── 2-build-layer.sh
├── 3-deploy.sh
├── 4-invoke.sh
└── 5-cleanup.sh
docs/                     # Additional documentation
manual_run.py            # Local testing utility
environment.yml          # Conda environment specification
```

## Testing

The function expects POST requests with JSON body containing a 'prompt' field:
```json
{
  "prompt": "Show me sales by region as a bar chart"
}
```

Returns either Chart.js JSON or error messages in standardized format.