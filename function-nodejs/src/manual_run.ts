import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { handler } from './index.js';
import { WebSocketClient } from './utils/websocket-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root directory
config({ path: resolve(__dirname, '../../.env') });

// Mock WebSocketClient prototype to intercept messages
const originalSendMessage = WebSocketClient.prototype.sendMessage;

WebSocketClient.prototype.sendMessage = async function (connectionId: string, data: any): Promise<void> {
  // Intercept and log messages instead of sending to API Gateway
  if (typeof data === 'object') {
    if (data.type === 'thought') {
      console.log(`\n[Thought]\n${data.content}`);
    } else if (data.type === 'result') {
      console.log(`\n[Result]\n${JSON.stringify(data.data, null, 2)}`);
    } else if (data.type === 'error') {
      console.error(`\n[Error]\n${data.message}`);
    } else {
      console.log(`\n[Message]\n${JSON.stringify(data, null, 2)}`);
    }
  } else {
    console.log(`\n[Raw Message]\n${data}`);
  }
};

function createMockEvent(prompt: string, routeKey: string = '$default'): APIGatewayProxyWebsocketEventV2 {
  const body = routeKey === '$default' ? JSON.stringify({ prompt }) : undefined;

  return {
    requestContext: {
      routeKey,
      connectionId: 'mock-connection-id',
      domainName: 'mock-api.example.com',
      stage: 'dev',
      requestId: 'mock-request-id',
      apiId: 'mock-api-id',
      accountId: '123456789012',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      http: {
        method: 'POST',
        path: '/dev',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'mock-client'
      }
    },
    body,
    isBase64Encoded: false
  } as unknown as APIGatewayProxyWebsocketEventV2;
}

async function main() {
  const prompt = process.argv[2] || 'Generate a bar chart showing patient age and cancer risk.';

  console.log('ReportingWithAIAgent - Node.js Lambda Manual Run');
  console.log('='.repeat(60));
  console.log(`Prompt: "${prompt}"`);
  console.log('='.repeat(60));

  try {
    // 1. Simulate Connect
    console.log('\n[Connecting...]');
    await handler(createMockEvent('', '$connect'));

    // 2. Simulate Message (The actual request)
    console.log('\n[Sending Request...]');
    const response = await handler(createMockEvent(prompt, '$default'));

    if (typeof response === 'string') {
      console.log(`\n[Lambda Response] ${response}`);
    } else {
      console.log(`\n[Lambda Response] StatusCode: ${response.statusCode}`);
      if (response.body) {
        console.log(`[Lambda Body] ${response.body}`);
      }
    }

    // Note: The actual streaming happens asynchronously. 
    // In a real Lambda, we'd wait for the promise, but here the handler returns "Processing" immediately.
    // Since we're running locally, we need to keep the process alive long enough for the async operations to complete.
    // However, since we're importing the handler which imports the agent, and the agent logic is awaited *inside* the fire-and-forget promise in handleMessage,
    // we might miss logs if we exit too early.

    // To properly wait, we'd need to hook into the promise chain, but `handler` returns early.
    // For this manual script, we can just wait a bit or rely on the fact that Node won't exit if there are pending promises 
    // (unless they are unref'd or we explicitly exit).
    // Let's add a small delay to ensure we see the output if it's fast, but mostly we rely on Node's event loop.

    // A better way for manual testing might be to expose the promise, but we want to test the `handler` interface.
    // So we'll just wait for a reasonable timeout or until we see a result (which we can't easily detect without more complex mocking).
    // For now, let's just wait a few seconds to allow streaming to finish.

    await new Promise(resolve => setTimeout(resolve, 60000));

    // 3. Simulate Disconnect
    console.log('\n[Disconnecting...]');
    await handler(createMockEvent('', '$disconnect'));

  } catch (error) {
    console.error('Error during manual run:', error);
  } finally {
    // Restore original method (not strictly necessary for a script, but good practice)
    // WebSocketClient.prototype.sendMessage = originalSendMessage;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}