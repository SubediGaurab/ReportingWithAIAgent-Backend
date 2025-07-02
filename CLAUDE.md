# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AWS Lambda-based AI agent that generates Chart.js-compatible JSON from natural language prompts by querying a PostgreSQL database. The system uses Amazon Bedrock's inline agent functionality with real-time WebSocket streaming to interpret user requests and generate data visualizations. Additionally, it includes a Gemini API proxy for chart insights and title suggestions with dynamic CORS support.

## Architecture

The application follows a serverless architecture with these key components:

- **Lambda Handler** (`function/lambda_function.py`): Main entry point handling WebSocket API Gateway requests with real-time streaming
- **Inline Agent** (`function/agent/inline_agent.py`): Bedrock agent orchestration with tool specifications and streaming support
- **SQL Tools** (`function/tools/sql_tools.py`): Database interaction layer with schema discovery and query execution
- **Agent Instructions** (`function/agent/agent_instructions.md`): Detailed instructions for the AI agent behavior
- **Gemini Proxy** (`function-gemini/index.js`): Node.js Lambda proxy for Gemini API with dynamic CORS handling
- **Manual Runner** (`manual_run.py`): Local testing utility for database operations
- **CloudFormation Template** (`deployment/template.yml`): Complete AWS infrastructure as code

### WebSocket Architecture

The system implements real-time streaming through AWS API Gateway WebSocket API:
- **WebSocket Routes**: `$connect`, `$disconnect`, and `$default` for connection management
- **Real-time Streaming**: Agent thoughts and final results streamed to clients
- **Connection Management**: Automatic handling of connection lifecycle
- **Thought Streaming**: Intermediate reasoning steps visible to users in real-time

The agent is configured to:
1. Only create one chart per request
2. Use `get_schema` tool first to understand database structure
3. Execute read-only SELECT queries via `execute_sql` tool
4. Return Chart.js-compatible JSON or error messages
5. Stream intermediate thoughts during processing via WebSocket

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
BedrockRegion=us-west-2  # Optional: Override default Bedrock region
GeminiApiKey=your_google_gemini_api_key  # Required for chart insights and title suggestions
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

The application connects to a PostgreSQL database and external APIs using environment variables:
- `user`: Database username
- `password`: Database password  
- `host`: Database host
- `port`: Database port (default: 5432)
- `dbname`: Database name
- `BedrockRegion`: AWS Bedrock region (optional, defaults to us-west-2)
- `GeminiApiKey`: Google Gemini API key for chart insights and title suggestions

For local development, create a `.env` file with these variables. In AWS, these are configured as Lambda environment variables via CloudFormation template parameters.

## Key Dependencies

- `boto3==1.38.42`: AWS SDK for Bedrock agent runtime
- `psycopg2-binary==2.9.10`: PostgreSQL database adapter
- `jsonpickle==4.1.1`: JSON serialization for logging
- **InlineAgent Library**: Custom Bedrock agent wrapper with observability and streaming support
- `termcolor` & `rich`: Enhanced logging and console output for agent traces

## Agent Behavior

The Bedrock agent is instructed to:
- Only process chart generation requests
- Always query the 'ReportingWithAIAgent' schema
- Enforce read-only database access (SELECT queries only)
- Use PostgreSQL syntax with double-quoted identifiers
- Return Chart.js-formatted JSON with 'type', 'data', and 'options' keys
- Handle errors gracefully with JSON error responses
- Follow a 4-step mandatory workflow: analyze → inspect schema → execute SQL → construct JSON
- Stream intermediate thoughts via WebSocket for real-time user feedback

## File Structure

```
function/
├── lambda_function.py     # WebSocket API Gateway handler with streaming
├── agent/
│   ├── inline_agent.py   # Bedrock agent configuration with streaming
│   ├── agent_instructions.md  # Detailed AI agent behavior instructions
│   └── src/              # InlineAgent library source code
│       └── InlineAgent/
│           ├── src/InlineAgent/
│           │   ├── agent/           # Core agent functionality
│           │   ├── observability/   # Tracing and monitoring
│           │   ├── tools/           # Tool integrations
│           │   └── types/           # Type definitions
│           └── examples/            # Example implementations
├── tools/
│   └── sql_tools.py      # Database interaction tools
└── requirements.txt      # Python dependencies
function-gemini/          # Gemini API proxy Lambda function
├── index.js             # Node.js handler with dynamic CORS
└── package.json         # Node.js dependencies
deployment/               # AWS deployment scripts
├── deploy-all.sh         # Combined deployment pipeline
├── template.yml          # CloudFormation infrastructure template
├── 1-create-bucket.sh
├── 2-build-layer.sh
├── 3-export-env.sh
├── 4-deploy.sh
├── 5-invoke.sh
└── 6-cleanup.sh
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
    "domainName": "hqmrrdbtqd.execute-api.us-west-1.amazonaws.com",
    "stage": "prod"
  },
  "body": "{\"prompt\": \"Generate chart of patient age and cancer risk.\"}"
}
```

### WebSocket Testing with Postman (Recommended)
Postman is the best way to test as it allows you to see all streamed responses in real-time.

1. Create a new WebSocket connection to:
   ```
   wss://hqmrrdbtqd.execute-api.us-west-1.amazonaws.com/prod
   ```

2. After the WebSocket is connected, send this message:
   ```json
   {
       "prompt": "Show me sales data as bar chart"
   }
   ```

Returns Chart.js JSON or error messages in standardized format.

### Gemini Proxy API Testing
The Gemini API proxy is available at a separate endpoint for chart insights and title suggestions.

**Endpoint URL:**
```
https://6alcfdn1q1.execute-api.us-west-1.amazonaws.com/prod
```

**Request Format:**
```json
{
  "contents": [{
    "parts": [{
      "text": "Explain how AI works in a few words"
    }]
  }]
}
```

**Response Format:**
Returns Gemini API-compatible response with generated content and metadata.

## Advanced Features

### Real-time Streaming
- **Thought Streaming**: Agent reasoning steps are streamed in real-time via WebSocket
- **Response Types**: 
  - `{'type': 'thought', 'content': 'Agent thinking...'}` - Intermediate thoughts
  - `{'type': 'result', 'data': {...}}` - Final Chart.js JSON or error response
- **Connection Management**: Automatic handling of WebSocket lifecycle events

### Observability & Tracing
- **Rich Console Output**: Colored terminal output for agent traces and tool invocations
- **Token Usage Tracking**: Input/output token consumption monitoring
- **LLM Call Tracking**: Count and trace all model invocations
- **Error Handling**: Comprehensive error tracking and reporting

### Infrastructure as Code
- **Complete AWS Stack**: CloudFormation template defines all resources
- **WebSocket API**: API Gateway WebSocket API with proper routing
- **REST API Proxy**: Gemini API proxy with dynamic CORS handling
- **Rate Limiting**: Both APIs limited to 50 requests/second with 100 burst capacity
- **Lambda Layer**: Optimized dependency packaging for faster cold starts
- **Multi-Runtime Support**: Python 3.11 for main agent, Node.js 18 for Gemini proxy
- **IAM Permissions**: Least-privilege security model
- **Environment Variables**: Secure parameter passing via CloudFormation

### SQL Security Features
- **Read-only Access**: Only SELECT queries are permitted
- **Schema Isolation**: Restricted to 'ReportingWithAIAgent' schema
- **Query Validation**: SQL injection protection through parameterized queries
- **Connection Management**: Proper database connection lifecycle handling

### Rate Limiting
- **Chart Generation API**: 50 requests/second with 100 burst capacity
- **Gemini Proxy API**: 50 requests/second with 100 burst capacity
- **Throttling Response**: HTTP 429 (Too Many Requests) when limits exceeded
- **Automatic Recovery**: Rate limits reset automatically after the time window