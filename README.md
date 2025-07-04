# ReportingWithAIAgent Backend

An AWS Lambda-based AI agent that generates Chart.js-compatible JSON from natural language prompts by querying a PostgreSQL database. The system uses Amazon Bedrock's inline agent functionality with real-time WebSocket streaming to interpret user requests and generate data visualizations. Additionally, it includes a Gemini API proxy for chart insights and title suggestions with dynamic CORS support.

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

## Prerequisites

- **System Dependencies**: 
  - Ubuntu/Debian: `sudo apt install zip jq`
  - RHEL/CentOS/Amazon Linux: `sudo yum install zip jq`
  - macOS: `brew install zip jq`
- **Docker Desktop** must be running (required for building Lambda layer)
- **AWS CLI** configured with appropriate permissions
- **Python 3.11** or compatible version

## Environment Setup

### Create Conda Environment
```bash
# Create conda environment
conda env create -f environment.yml

# Activate environment
conda activate ReportingWithAIAgent_env

# Install Python dependencies locally for development
pip install -r function/requirements.txt python-dotenv
```

### Database Configuration

Create a `.env` file in the project root with these keys:
```bash
user=your_db_username
password=your_db_password
host=your_db_host
port=5432
dbname=your_database_name
BedrockRegion=us-west-2  # Optional: Override default Bedrock region
GeminiApiKey=your_google_gemini_api_key  # Required for chart insights and title suggestions
```

The application connects to a PostgreSQL database and external APIs using these environment variables. For local development, use the `.env` file. In AWS, these are configured as Lambda environment variables via CloudFormation template parameters.

## Deployment

### Quick Deployment (Recommended)
```bash
# Navigate to deployment directory
cd deployment

# Run complete deployment pipeline
./deploy-all.sh
```

### Manual Deployment Steps
```bash
# Create S3 bucket for deployment artifacts
./1-create-bucket.sh

# Build Lambda layer with dependencies
./2-build-layer.sh

# Export environment variables from .env file (MUST use source)
source ./3-export-env.sh

# Deploy CloudFormation stack (MUST use source)
source ./4-deploy.sh

# Test deployed function
./5-invoke.sh

# Clean up resources when done (MANDATORY after testing)
./6-cleanup.sh
```

## Local Development

```bash
# Test database connectivity locally
python manual_run.py
```

## Testing

### WebSocket Testing with Postman (Recommended)
Postman provides the best testing experience for real-time streaming responses.

1. Create a new WebSocket connection to your deployed endpoint:
   ```
   wss://your-api-id.execute-api.region.amazonaws.com/prod
   ```

2. After the WebSocket connects, send this message:
   ```json
   {
       "prompt": "Show me sales data as bar chart"
   }
   ```

3. Watch for real-time streaming responses:
   - `{'type': 'thought', 'content': 'Agent thinking...'}` - Intermediate thoughts
   - `{'type': 'result', 'data': {...}}` - Final Chart.js JSON

### AWS Lambda Console Testing

Use this event JSON in AWS Lambda console:
```json
{
  "requestContext": {
    "routeKey": "sendmessage",
    "connectionId": "test-connection-123",
    "domainName": "your-api-id.execute-api.region.amazonaws.com",
    "stage": "prod"
  },
  "body": "{\"prompt\": \"Generate chart of sales by region.\"}"
}
```
Returns Chart.js JSON or error messages in standardized format.

### Gemini Proxy API Testing

The Gemini API proxy is deployed as a separate Lambda function for chart insights and title suggestions.

**Endpoint URL:**
```
https://<your-gemini-api-id>.execute-api.<region>.amazonaws.com/prod
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

**Usage Example:**
```bash
curl -X POST https://<your-gemini-api-id>.execute-api.<region>.amazonaws.com/prod \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Suggest a catchy title for a sales performance chart"
      }]
    }]
  }'
```

## Key Dependencies

- `boto3==1.38.42`: AWS SDK for Bedrock agent runtime
- `psycopg2-binary==2.9.10`: PostgreSQL database adapter
- `jsonpickle==4.1.1`: JSON serialization for logging
- **InlineAgent Library**: Custom Bedrock agent wrapper with observability and streaming support (source code copied and modified from [AWS InlineAgent samples](https://github.com/awslabs/amazon-bedrock-agent-samples/tree/main/src/InlineAgent))
- `termcolor` & `rich`: Enhanced logging and console output for agent traces

## Agent Behavior

The Bedrock agent is configured to:
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

## License

This project is licensed under the MIT License - see the LICENSE file for details.