/**
 * AWS Lambda handler for WebSocket API Gateway
 * Handles chart generation requests with real-time streaming
 */

import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { WebSocketClient } from './utils/websocket-client.js';
import { logger } from './utils/logger.js';
import { handleError } from './utils/error-handler.js';
import { streamAgentResponseToWebSocket } from './agent/streaming.js';
import { WebSocketRequest } from './types/websocket.js';

/**
 * WebSocket connection handler
 */
async function handleConnect(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;

  logger.info('WebSocket connection established', {
    connectionId,
    sourceIp: (event.requestContext as any).identity?.sourceIp,
  });

  return {
    statusCode: 200,
    body: 'Connected.',
  };
}

/**
 * WebSocket disconnection handler
 */
async function handleDisconnect(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;

  logger.info('WebSocket connection closed', {
    connectionId,
  });

  return {
    statusCode: 200,
    body: 'Disconnected.',
  };
}

/**
 * WebSocket message handler (default route)
 */
async function handleMessage(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  // Create WebSocket client for sending responses
  const endpoint = `https://${domainName}/${stage}`;
  const wsClient = new WebSocketClient(endpoint);

  try {
    // Parse request body
    if (!event.body) {
      logger.warn('Received message with empty body', { connectionId });
      await wsClient.sendError(connectionId, 'Request body is required');
      return { statusCode: 400, body: 'Bad Request' };
    }

    let request: WebSocketRequest;
    try {
      const bodyString = event.body;
      const startIdx = bodyString.indexOf('{');
      const endIdx = bodyString.lastIndexOf('}') + 1;

      if (startIdx === -1 || endIdx <= startIdx) {
        throw new Error('No valid JSON object found in body');
      }
      const jsonStr = bodyString.slice(startIdx, endIdx);
      request = JSON.parse(jsonStr);
    } catch (error) {
      logger.warn('Failed to parse request body as JSON', {
        connectionId,
        body: event.body,
      });
      await wsClient.sendError(connectionId, 'Invalid JSON in request body');
      return { statusCode: 400, body: 'Bad Request' };
    }

    // Validate prompt field
    if (!request.prompt || typeof request.prompt !== 'string') {
      logger.warn('Missing or invalid prompt field', {
        connectionId,
        request,
      });
      await wsClient.sendError(connectionId, 'Request must include a "prompt" field');
      return { statusCode: 400, body: 'Bad Request' };
    }

    if (request.prompt.trim().length === 0) {
      logger.warn('Empty prompt received', { connectionId });
      await wsClient.sendError(connectionId, 'Prompt cannot be empty');
      return { statusCode: 400, body: 'Bad Request' };
    }

    logger.info('Processing chart generation request', {
      connectionId,
      promptLength: request.prompt.length,
    });

    // Stream agent response to WebSocket
    // This is a fire-and-forget operation - we return immediately
    // while the agent continues processing and streaming results
    streamAgentResponseToWebSocket(connectionId, request.prompt, wsClient).catch(error => {
      logger.error('Unhandled error in agent streaming', {
        connectionId,
        error: error instanceof Error ? error.message : error,
      });
    });

    return {
      statusCode: 200,
      body: '',
    };

  } catch (error) {
    logger.error('Error handling WebSocket message', {
      connectionId,
      error: error instanceof Error ? error.message : error,
    });

    const errorMessage = handleError(error, { connectionId });
    try {
      await wsClient.sendError(connectionId, errorMessage.message);
    } catch (sendError) {
      logger.error('Failed to send error message to client', {
        connectionId,
        sendError: sendError instanceof Error ? sendError.message : sendError,
      });
    }

    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
}

/**
 * Main Lambda handler
 */
export const handler = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
  const routeKey = event.requestContext.routeKey;

  logger.debug('Lambda invoked', {
    routeKey,
    connectionId: event.requestContext.connectionId,
  });

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(event);

      case '$disconnect':
        return await handleDisconnect(event);

      case '$default':
        return await handleMessage(event);

      default:
        logger.warn('Unknown route key', { routeKey });
        return {
          statusCode: 400,
          body: `Unknown route: ${routeKey}`,
        };
    }
  } catch (error) {
    logger.error('Unhandled error in Lambda handler', {
      routeKey,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    });

    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
};
