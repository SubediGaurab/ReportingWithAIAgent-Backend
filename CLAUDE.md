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

# For Claude Code: Use conda shell hook to enable conda in bash session
eval "$(/home/gaura/miniconda3/bin/conda shell.bash hook)" && conda activate ReportingWithAIAgent_env

# Install Python dependencies locally for development
pip install -r function/requirements.txt python-dotenv

# Create .env file with database credentials (REQUIRED)
# Copy the template below and add your actual database values
```

**Create `.env` file in project root with these keys:**
```bash
user=your_db_username
password=your_db_password
host=your_db_host
port=5432
dbname=your_database_name
```

### AWS Deployment

**Prerequisites:** 
- Ensure `zip` and `jq` commands are installed on your system:
  - Ubuntu/Debian: `sudo apt install zip jq`
  - RHEL/CentOS/Amazon Linux: `sudo yum install zip jq`
  - macOS: `brew install zip jq`
- Docker Desktop must be running (required for building Lambda layer)

```bash
# Navigate to deployment directory
cd deployment

# Run complete deployment pipeline (recommended)
./deploy-all.sh
```

**Alternative: Run individual scripts**
```bash
# Create S3 bucket for deployment artifacts
./1-create-bucket.sh

# Build Lambda layer with dependencies
./2-build-layer.sh

# Export environment variables from .env file (MUST use source)
source ./3-export-env.sh

# Deploy CloudFormation stack (MUST use source)
source ./4-deploy.sh

# Clean up resources (MANDATORY after testing)
./6-cleanup.sh

# Test deployed function
./5-invoke.sh
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
├── deploy-all.sh         # Combined deployment pipeline
├── 1-create-bucket.sh
├── 2-build-layer.sh
├── 3-export-env.sh
├── 4-deploy.sh
├── 5-invoke.sh
└── 6-cleanup.sh
docs/                     # Additional documentation
manual_run.py            # Local testing utility
environment.yml          # Conda environment specification
```

## Testing

### Local Testing
```bash
# Test database connectivity and Lambda function locally
python manual_run.py
```

### AWS Lambda Console Testing
Use this event JSON in AWS Lambda console to test the deployed function. Note that API Gateway errors will be raised since we're bypassing the gateway, but the Lambda function will continue to work:
```json
{
  "requestContext": {
    "routeKey": "sendmessage",
    "connectionId": "test-connection-123",
    "domainName": "15fdvwkqa7.execute-api.us-west-1.amazonaws.com",
    "stage": "prod"
  },
  "body": "{\"prompt\": \"Generate chart of patient age and cancer risk.\"}"
}
```

### WebSocket Testing with Postman (Recommended)
Postman is the best way to test as it allows you to see all streamed responses in real-time.

1. Create a new WebSocket connection to:
   ```
   wss://15fdvwkqa7.execute-api.us-west-1.amazonaws.com/prod
   ```

2. After the WebSocket is connected, send this message:
   ```json
   {
       "prompt": "Show me sales data as bar chart"
   }
   ```

### API Gateway Testing
The function expects POST requests with JSON body containing a 'prompt' field:
```json
{
  "prompt": "Show me sales by region as a bar chart"
}
```

Returns either Chart.js JSON or error messages in standardized format.