# ReportingWithAIAgent Backend

An AWS Lambda-based AI agent that generates Chart.js-compatible JSON from natural language prompts by querying a Supabase PostgreSQL database. The system uses **LangGraph** with **MCP (Model Context Protocol) servers** for database access and real-time WebSocket streaming to interpret user requests and generate data visualizations. Additionally, it includes a Gemini API proxy for chart insights and title suggestions with dynamic CORS support.

## Architecture

The application follows a serverless architecture with these key components:

- **Lambda Handler** (`function-nodejs/src/index.ts`): Main entry point handling WebSocket API Gateway requests with real-time streaming
- **LangGraph Agent** (`function-nodejs/src/agent/`): Modern agent orchestration using LangGraph framework
- **MCP Client** (`function-nodejs/src/agent/mcp-client.ts`): Model Context Protocol integration for database access via Supabase MCP server
- **Streaming Handler** (`function-nodejs/src/agent/streaming.ts`): Real-time response streaming to WebSocket clients
- **System Prompt** (`function-nodejs/src/agent/system-prompt.md`): Detailed instructions for the AI agent behavior
- **Gemini Proxy** (`function-gemini/index.js`): Node.js Lambda proxy for Gemini API with dynamic CORS handling
- **Manual Runner** (`function-nodejs/src/manual_run.ts`): Local testing utility for development
- **CloudFormation Template** (`deployment/template.yml`): Complete AWS infrastructure as code

### WebSocket Architecture

The system implements real-time streaming through AWS API Gateway WebSocket API:
- **WebSocket Routes**: `$connect`, `$disconnect`, and `$default` for connection management
- **Real-time Streaming**: Agent responses and errors streamed to clients
- **Connection Management**: Automatic handling of connection lifecycle
- **Fire-and-Forget Pattern**: Lambda returns immediately while agent processes in background

### Technology Migration

**From:** Python + AWS InlineAgent + Custom PostgreSQL Tools  
**To:** Node.js/TypeScript + LangGraph + MCP Servers

### Key Benefits:
1. **LangGraph** is a more standard and widely adopted agentic framework
2. **MCP Servers** eliminate custom database tools and platform-dependent libraries
3. **TypeScript** provides type safety and better developer experience
4. **Cleaner Architecture** with better separation of concerns

The agent is configured to:
1. Only create one chart per request
2. Use Supabase MCP server to inspect database schema
3. Execute read-only SELECT queries via MCP
4. Return Chart.js-compatible JSON or error messages
5. Stream responses in real-time via WebSocket

## Prerequisites

- **System Dependencies**: 
  - Ubuntu/Debian: `sudo apt install zip jq`
  - RHEL/CentOS/Amazon Linux: `sudo yum install zip jq`
  - macOS: `brew install zip jq`
- **AWS CLI** configured with appropriate permissions
- **Node.js 18+** for local development
- **npm** or **yarn** package manager

## Environment Setup

### Install Node.js Dependencies

```bash
# Navigate to function-nodejs directory
cd function-nodejs

# Install dependencies
npm install

# Build TypeScript code (for local testing)
npm run build
```

### Database Configuration

Create a `.env` file in the project root with these keys:
```bash
# Anthropic API (for Claude model via LangGraph)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase Database Connection (for MCP server)
SUPABASE_PROJECT_REF=your_supabase_project_id
SUPABASE_ACCESS_TOKEN=your_supabase_access_token

# Gemini API (for chart insights and title suggestions)
GeminiApiKey=your_google_gemini_api_key

# Optional: AWS Bedrock Region
BedrockRegion=us-west-2

# Optional: Logging Level
LOG_LEVEL=INFO
```

The application connects to Supabase PostgreSQL database via MCP server using these environment variables. For local development, use the `.env` file. In AWS, these are configured as Lambda environment variables via CloudFormation template parameters.

## Deployment

### Quick Deployment (Recommended)
```bash
# Navigate to deployment directory
cd deployment

# Run complete deployment pipeline
./deploy-all.sh
```

The script will:
1. Create S3 bucket for artifacts
2. Build Lambda layer with Node.js dependencies
3. Export environment variables from `.env` file
4. Deploy CloudFormation stack
5. Clean up S3 artifacts
6. Prompt for testing

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
# Navigate to function-nodejs directory
cd function-nodejs

# Run development server with local .env
npm run dev

# Or test the built version
npm run build
npm run dev:dist
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
   - Agent processes the request
   - Returns Chart.js JSON or error object

### AWS Lambda Console Testing

Use this event JSON in AWS Lambda console:
```json
{
  "requestContext": {
    "routeKey": "$default",
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

### Main Lambda Function (Node.js/TypeScript)
- `langchain ^1.1.1`: LangGraph framework for agent orchestration
- `@langchain/anthropic ^1.1.3`: Anthropic Claude integration
- `@langchain/mcp-adapters ^1.0.1`: Model Context Protocol adapters for tool integration
- `@aws-sdk/client-apigatewaymanagementapi ^3.700.0`: AWS SDK for WebSocket API management
- `dotenv ^16.4.5`: Environment variable management

### Development Dependencies
- `typescript ^5.7.2`: TypeScript compiler
- `esbuild ^0.24.0`: Fast bundler for Lambda deployment
- `tsx ^4.19.2`: TypeScript execution for development
- `@types/node ^18.19.59`: Node.js type definitions
- `@types/aws-lambda ^8.10.145`: AWS Lambda type definitions

## Agent Behavior

The LangGraph agent is configured to:
- Only process chart generation requests
- Always query the 'ReportingWithAIAgent' schema via Supabase MCP
- Enforce read-only database access (SELECT queries only)
- Use PostgreSQL syntax with double-quoted identifiers
- Return Chart.js-formatted JSON with 'type', 'data', and 'options' keys
- Handle errors gracefully with JSON error responses
- Follow a 4-step mandatory workflow: analyze → inspect schema → execute SQL → construct JSON
- Stream responses via WebSocket for real-time user feedback

## File Structure

```
function-nodejs/               # Main Lambda function (Node.js/TypeScript)
├── src/
│   ├── index.ts              # WebSocket API Gateway handler
│   ├── manual_run.ts         # Local development testing utility
│   ├── agent/               # LangGraph agent implementation
│   │   ├── agent-config.ts  # LangGraph agent configuration
│   │   ├── streaming.ts     # Real-time streaming handler
│   │   ├── mcp-client.ts    # MCP server client for Supabase
│   │   ├── system-prompt.md # AI agent instructions
│   │   └── system-prompt.ts # System prompt loader
│   ├── utils/              # Utility modules
│   │   ├── websocket-client.ts  # WebSocket communication
│   │   ├── logger.ts           # Structured logging
│   │   └── error-handler.ts    # Error handling
│   └── types/              # TypeScript type definitions
│       ├── environment.ts   # Environment variable types
│       ├── websocket.ts     # WebSocket message types
│       └── langchain.ts     # LangGraph-related types
├── package.json            # Node.js dependencies
├── tsconfig.json           # TypeScript configuration
└── dist/                   # Built JavaScript (generated)

function-gemini/            # Gemini API proxy Lambda function
├── index.js               # Node.js handler with dynamic CORS
└── package.json           # Node.js dependencies

deployment/                # AWS deployment scripts
├── deploy-all.sh          # Combined deployment pipeline
├── template.yml           # CloudFormation infrastructure template
├── 1-create-bucket.sh
├── 2-build-layer.sh       # Builds Node.js Lambda layer
├── 3-export-env.sh
├── 4-deploy.sh
├── 5-invoke.sh
└── 6-cleanup.sh

.env.example              # Environment variable template
```

## Advanced Features

### LangGraph Integration
- **Modern Agent Framework**: Industry-standard agentic framework with graph-based orchestration
- **MCP Protocol**: Standardized tool integration via Model Context Protocol
- **Type Safety**: Full TypeScript support for better developer experience
- **Extensibility**: Easy to add new tools and capabilities via MCP servers

### Real-time Streaming
- **WebSocket Streaming**: Agent responses streamed in real-time to clients
- **Response Format**: Single JSON response (Chart.js or error object)
- **Connection Management**: Automatic handling of WebSocket lifecycle events
- **Fire-and-Forget**: Lambda returns immediately, agent processes asynchronously

### Infrastructure as Code
- **Complete AWS Stack**: CloudFormation template defines all resources
- **WebSocket API**: API Gateway WebSocket API with proper routing
- **REST API Proxy**: Gemini API proxy with dynamic CORS handling
- **Rate Limiting**: Both APIs limited to 50 requests/second with 100 burst capacity
- **Lambda Layer**: Optimized Node.js dependency packaging for faster cold starts
- **Node.js 18 Runtime**: Modern runtime for both Lambda functions
- **IAM Permissions**: Least-privilege security model
- **Environment Variables**: Secure parameter passing via CloudFormation

### MCP Server Integration
- **Supabase MCP Server**: Direct database access via standardized protocol
- **No Custom Tools**: Eliminates platform-dependent database libraries
- **Schema Introspection**: Automatic schema discovery via MCP
- **Query Execution**: Safe, read-only SQL execution
- **Portable**: MCP servers can be reused across different projects

### Security Features
- **Read-only Access**: Only SELECT queries are permitted via MCP
- **Schema Isolation**: Restricted to 'ReportingWithAIAgent' schema
- **Managed Connections**: MCP server handles connection pooling and security
- **Environment Variables**: Sensitive credentials managed via AWS Systems Manager

### Rate Limiting
- **Chart Generation API**: 50 requests/second with 100 burst capacity
- **Gemini Proxy API**: 50 requests/second with 100 burst capacity
- **Throttling Response**: HTTP 429 (Too Many Requests) when limits exceeded
- **Automatic Recovery**: Rate limits reset automatically after the time window

## Migration Notes

This project was migrated from Python + AWS InlineAgent to Node.js/TypeScript + LangGraph:

### Why LangGraph?
- **Industry Standard**: More widely adopted than AWS InlineAgent
- **Better Tooling**: Excellent TypeScript support and developer experience
- **Flexibility**: Easier to customize and extend agent behavior
- **Community**: Larger ecosystem and better documentation

### Why MCP Servers?
- **Standardization**: MCP is an emerging standard for AI tool integration
- **Portability**: Same MCP server can be used with different agents/frameworks
- **No Platform Lock-in**: Eliminates dependency on platform-specific libraries
- **Better Abstraction**: Clean separation between agent logic and database access

## License

This project is licensed under the MIT License - see the LICENSE file for details.