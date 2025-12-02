# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AWS Lambda-based AI agent that generates Chart.js-compatible JSON from natural language prompts by querying a Supabase PostgreSQL database. The system uses **Anthropic SDK** with a **custom MCP (Model Context Protocol) client** for database access and real-time WebSocket streaming to interpret user requests and generate data visualizations. Additionally, it includes a Gemini API proxy for chart insights and title suggestions with dynamic CORS support.

## Architecture

The application follows a serverless architecture with these key components:

- **Lambda Handler** (`function-nodejs/src/index.ts`): Main entry point handling WebSocket API Gateway requests with real-time streaming
- **Agent Implementation** (`function-nodejs/src/agent/`): Anthropic SDK-based agent with custom MCP integration
- **Agent Config** (`function-nodejs/src/agent/agent-config.ts`): Anthropic SDK configuration with custom Supabase MCP client
- **Streaming Handler** (`function-nodejs/src/agent/streaming.ts`): Real-time response streaming to WebSocket clients
- **System Prompt** (`function-nodejs/src/agent/system-prompt.md`): Detailed instructions for the AI agent behavior
- **Gemini Proxy** (`function-gemini/index.js`): Node.js Lambda proxy for Gemini API with dynamic CORS handling
- **Manual Runner** (`function-nodejs/src/manual_run.ts`): Local testing utility for development
- **CloudFormation Template** (`deployment/template.yml`): Complete AWS infrastructure as code

### Technology Stack

**Runtime:** Node.js 24 (LTS) + TypeScript
**Agent Framework:** @anthropic-ai/sdk (official Anthropic SDK)
**Database Access:** Custom MCP client for Supabase HTTP server
**Streaming:** AWS API Gateway WebSocket
**Build Tool:** tsup (modern bundler based on esbuild)
**Type System:** TypeScript 5.7+
**Linting:** ESLint 9 with TypeScript support

### Migration History

**Migration 1:** Python + AWS InlineAgent + Custom PostgreSQL Tools → Node.js/TypeScript + LangGraph + MCP Servers

**Migration 2 (Latest):** LangGraph + @langchain/mcp-adapters → Anthropic SDK + Custom MCP Client

**Key Benefits:**
1. **Anthropic SDK** is the official SDK with direct Claude API access
2. **Custom MCP Client** eliminates framework overhead and provides direct control
3. **Simplified Architecture** with minimal dependencies and cleaner code
4. **Better Reliability** with official SDK and direct HTTP communication
5. **Node.js 24 LTS** provides latest runtime features and long-term support until 2028
6. **No CLI Dependencies** - pure SDK implementation works perfectly in Lambda

### WebSocket Architecture

The system implements real-time streaming through AWS API Gateway WebSocket API:
- **WebSocket Routes**: `$connect`, `$disconnect`, and `$default` for connection management
- **Real-time Streaming**: Agent responses and errors streamed to clients
- **Connection Management**: Automatic handling of connection lifecycle
- **Fire-and-Forget Pattern**: Lambda returns immediately while agent processes in background

The agent is configured to:
1. Only create one chart per request
2. Use Supabase MCP server to inspect database schema
3. Execute read-only SELECT queries via MCP
4. Return Chart.js-compatible JSON or error messages
5. Stream responses in real-time via WebSocket

## Development Commands

### Environment Setup

```bash
# Navigate to function-nodejs directory
cd function-nodejs

# Install Node.js dependencies
npm install

# Build TypeScript code (development build)
npm run build

# Build for production (with minification)
npm run build:prod

# Lint code
npm run lint

# Lint and auto-fix
npm run lint:fix

# Create .env file with required credentials (REQUIRED)
# Copy the template below and add your actual values
```

**Create `.env` file in project root with these keys:**
```bash
# Anthropic API (for Claude SDK)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase Database Connection (for MCP server)
SUPABASE_PROJECT_REF=your_supabase_project_id
SUPABASE_ACCESS_TOKEN=your_supabase_access_token

# Gemini API (for chart insights and title suggestions)
GeminiApiKey=your_google_gemini_api_key

# Optional: Logging Level
LOG_LEVEL=INFO
```

### Local Development

```bash
# Run development server (uses ts-node for TypeScript execution)
cd function-nodejs
npm run dev

# Or test the built version
npm run build
npm run dev:dist

# Clean build artifacts
npm run clean
```

### AWS Deployment

**Prerequisites:**
- Ensure `zip` and `jq` commands are installed on your system:
  - Ubuntu/Debian: `sudo apt install zip jq`
  - RHEL/CentOS/Amazon Linux: `sudo yum install zip jq`
  - macOS: `brew install zip jq`
- AWS CLI configured with appropriate permissions

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

# Build Lambda function with bundled dependencies
./2-build-function.sh

# Export environment variables from .env file (MUST use source)
source ./3-export-env.sh

# Deploy CloudFormation stack (MUST use source)
source ./4-deploy.sh

# Test deployed function
./5-invoke.sh

# Clean up resources (MANDATORY after testing)
./6-cleanup.sh
```

## Database Configuration

The application connects to Supabase PostgreSQL database via MCP server using these environment variables:

- `ANTHROPIC_API_KEY`: API key for Claude model (Anthropic SDK)
- `SUPABASE_PROJECT_REF`: Supabase project reference ID
- `SUPABASE_ACCESS_TOKEN`: Supabase access token for MCP authentication
- `GeminiApiKey`: Google Gemini API key for chart insights
- `LOG_LEVEL`: Logging level (optional, defaults to INFO)

For local development, create a `.env` file with these variables. In AWS, these are configured as Lambda environment variables via CloudFormation template parameters.

## Key Dependencies

### Main Lambda Function (Node.js/TypeScript)
- `@anthropic-ai/sdk ^0.71.0`: Official Anthropic SDK for Claude API
- `@aws-sdk/client-apigatewaymanagementapi ^3.700.0`: AWS SDK for WebSocket API management
- `dotenv ^16.4.5`: Environment variable management

### Development Dependencies
- `typescript ^5.7.2`: TypeScript compiler
- `tsup ^8.5.1`: Modern bundler built on esbuild with optimized defaults
- `ts-node ^10.9.2`: TypeScript execution for development
- `eslint ^9.39.1`: Code linting
- `@typescript-eslint/eslint-plugin ^8.48.0`: TypeScript linting rules
- `@typescript-eslint/parser ^8.48.0`: TypeScript parser for ESLint
- `@types/node`: Node.js type definitions (Node 24+)
- `@types/aws-lambda ^8.10.145`: AWS Lambda type definitions

## Agent Behavior

The agent is configured to:
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
│   ├── agent/               # Agent implementation with Anthropic SDK
│   │   ├── agent-config.ts  # Anthropic SDK configuration with custom MCP client
│   │   ├── streaming.ts     # Real-time streaming handler for agent responses
│   │   ├── system-prompt.md # AI agent instructions
│   │   └── system-prompt.ts # System prompt loader
│   ├── utils/              # Utility modules
│   │   ├── websocket-client.ts  # WebSocket communication
│   │   ├── logger.ts           # Structured logging
│   │   └── error-handler.ts    # Error handling
│   └── types/              # TypeScript type definitions
│       ├── environment.ts   # Environment variable types
│       └── websocket.ts     # WebSocket message types
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
├── 2-build-function.sh    # Builds Lambda function with bundled dependencies
├── 3-export-env.sh
├── 4-deploy.sh
├── 5-invoke.sh
└── 6-cleanup.sh

.env.example              # Environment variable template
```

## Testing

### Local Testing
```bash
# Navigate to function-nodejs directory
cd function-nodejs

# Run local development server
npm run dev

# The manual_run.ts script will:
# 1. Load environment variables from .env
# 2. Initialize the Anthropic SDK with custom MCP client
# 3. Process a test prompt
# 4. Display results
```

### AWS Lambda Console Testing
Use this event JSON in AWS Lambda console to test the deployed function:
```json
{
  "requestContext": {
    "routeKey": "$default",
    "connectionId": "test-connection-123",
    "domainName": "<your-api-id>.execute-api.<region>.amazonaws.com",
    "stage": "prod"
  },
  "body": "{\"prompt\": \"Generate chart of sales by region.\"}"
}
```

Note: When testing in the Lambda console, you'll see API Gateway connection errors (this is expected since we're bypassing the gateway), but the chart generation logic will work correctly.

### WebSocket Testing with Postman (Recommended)
Postman is the best way to test as it allows you to see all streamed responses in real-time.

1. Create a new WebSocket connection to:
   ```
   wss://<your-api-id>.execute-api.<region>.amazonaws.com/prod
   ```

2. After the WebSocket is connected, send this message:
   ```json
   {
       "prompt": "Show me sales data as bar chart"
   }
   ```

3. Watch for real-time responses:
   - Agent processes the request
   - Returns Chart.js JSON or error object

### Gemini Proxy API Testing
The Gemini API proxy is available at a separate endpoint for chart insights and title suggestions.

**Endpoint URL:**
```
https://<your-gemini-api-id>.execute-api.<region>.amazonaws.com/prod
```

**Request Format:**
```json
{
  "contents": [{
    "parts": [{
      "text": "Suggest a catchy title for a sales performance chart"
    }]
  }]
}
```

**Response Format:**
Returns Gemini API-compatible response with generated content and metadata.

## Advanced Features

### Anthropic SDK Integration
- **Official SDK**: Anthropic's official SDK for Claude API
- **Custom MCP Client**: Direct HTTP communication with Supabase MCP server
- **Type Safety**: Full TypeScript support for better developer experience
- **Simplified Architecture**: Minimal dependencies and cleaner code structure
- **No CLI Dependencies**: Pure SDK implementation without subprocess overhead

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
- **Optimized Bundling**: Dependencies bundled directly into function package
- **Node.js 24 Runtime**: Latest LTS runtime with support until April 2028
- **IAM Permissions**: Scoped security model with specific resource ARNs
- **Environment Variables**: Secure parameter passing via CloudFormation
- **API Gateway Logging**: CloudWatch logs for WebSocket API monitoring
- **Resource Tags**: Cost tracking and resource management tags

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

## Code Editing Guidelines for Claude

When working with this codebase:

1. **TypeScript First**: All agent code is in TypeScript. Use proper types from `src/types/`.

2. **Environment Variables**: Load from `.env` locally, CloudFormation parameters in AWS. See `src/types/environment.ts` for type definitions.

3. **MCP Integration**: Database access is via custom MCP client that communicates directly with Supabase MCP HTTP server. See `src/agent/agent-config.ts` for implementation.

4. **Error Handling**: Use structured logging via `src/utils/logger.ts`. All errors should return JSON format.

5. **Build Process**: Run `npm run build` before deployment. tsup bundles everything into `dist/`.

6. **Testing**: Use `npm run dev` for local testing with `.env` file.

7. **Deployment**: Always test locally before running `./deploy-all.sh`.

## Troubleshooting

### Common Issues

**Issue:** "Cannot find module '@anthropic-ai/sdk'"
**Solution:** Run `npm install` in `function-nodejs/` directory

**Issue:** "ANTHROPIC_API_KEY not found"
**Solution:** Create `.env` file in project root with required credentials

**Issue:** "MCP connection failed"
**Solution:** Check `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` in `.env`

**Issue:** Agent fails to connect to MCP server
**Solution:** Check `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` environment variables, verify Supabase MCP server is accessible

**Issue:** Lambda cold start timeout
**Solution:** Increase Lambda timeout in `deployment/template.yml` (currently 60 seconds)

**Issue:** ESLint errors during lint
**Solution:** Run `npm run lint:fix` to auto-fix formatting issues

## Migration Notes

This project has undergone two major migrations:

### Migration 1: Python → Node.js/TypeScript + LangGraph
Migrated from Python + AWS InlineAgent to Node.js/TypeScript + LangGraph for better tooling, TypeScript support, and standardization.

### Migration 2: LangGraph → Anthropic SDK + Custom MCP Client (December 2024)
**Why Anthropic SDK with Custom MCP Client?**
- **Official Solution**: Anthropic's official SDK for Claude API
- **Direct Control**: Custom MCP client with direct HTTP communication
- **Simplified Architecture**: Minimal dependencies (just the SDK + AWS SDK)
- **Better Performance**: No framework overhead or adapter layers
- **Lambda-Optimized**: No CLI dependencies or subprocess overhead
- **Future-proof**: Official SDK support and updates from Anthropic
- **Cleaner Code**: Straightforward agentic loop implementation

**Key Changes:**
- Replaced `langchain`, `@langchain/anthropic`, `@langchain/mcp-adapters`
- Added `@anthropic-ai/sdk` (official Claude API SDK)
- Implemented custom MCP client for Supabase (direct JSON-RPC over HTTP)
- Simplified streaming handler (direct SDK message types)
- Updated to Node.js 24 LTS (support until April 2028)
- Maintained CommonJS build for Lambda compatibility
- Reduced to minimal dependencies for maximum reliability

**What Stayed the Same:**
- tsup build system with optimized bundling
- WebSocket streaming architecture
- All utility modules (logger, error-handler, websocket-client)
- System prompt and agent behavior
- CloudFormation infrastructure (no Lambda layer needed)
- Bundled deployment approach

**Results:**
- Simpler codebase with fewer moving parts
- Better maintainability with official SDK
- Future-ready with Node.js 24 LTS