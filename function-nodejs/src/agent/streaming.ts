/**
 * WebSocket streaming handler for agent responses
 */

import { WebSocketClient } from '../utils/websocket-client';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';
import { createChartGenerationAgent } from './agent-config';

/**
 * Process agent stream and send messages via WebSocket
 */
export async function streamAgentResponseToWebSocket(
  connectionId: string,
  prompt: string,
  wsClient: WebSocketClient
): Promise<void> {
  try {
    logger.info('Starting agent stream processing', {
      connectionId,
      promptLength: prompt.length,
    });

    const agentStream = await createChartGenerationAgent(prompt);

    let messageCount = 0;
    let thoughtCount = 0;
    let hasResult = false;

    for await (const message of agentStream) {
      messageCount++;

      if (message.type === 'assistant') {
        thoughtCount += await processAssistantMessage(connectionId, message, wsClient);
      } else if (message.type === 'result') {
        hasResult = true;
        await processResultMessage(connectionId, message, wsClient);
      }
    }

    logger.info('Agent stream processing completed', {
      connectionId,
      messageCount,
      thoughtCount,
      hasResult,
    });

  } catch (error) {
    logger.error('Error during agent stream processing', {
      connectionId,
      error: error instanceof Error ? error.message : error,
    });

    const errorMessage = handleError(error, { connectionId });
    await wsClient.sendError(connectionId, errorMessage.message);
  }
}

async function processAssistantMessage(
  connectionId: string,
  message: any,
  wsClient: WebSocketClient
): Promise<number> {
  let count = 0;
  if (message.message?.content) {
    for (const contentBlock of message.message.content) {
      if (contentBlock.type === 'text' && contentBlock.text) {
        count++;
        await wsClient.sendThought(connectionId, contentBlock.text);
        logger.debug('Sent thought to client', {
          connectionId,
          thoughtNumber: count,
          textLength: contentBlock.text.length,
        });
      }
    }
  }
  return count;
}

async function processResultMessage(
  connectionId: string,
  message: any,
  wsClient: WebSocketClient
): Promise<void> {
  if (message.subtype === 'success') {
    const resultData = parseResultData(message.result);

    await wsClient.sendResult(connectionId, resultData);

    logger.info('Sent final result to client', {
      connectionId,
      resultType: typeof resultData,
    });
  } else {
    logger.error('Agent processing failed', {
      connectionId,
      message: message,
    });

    await wsClient.sendResult(
      connectionId,
      { error: 'Agent processing failed: ' + (message.error || 'Unknown error') }
    );
  }
}

function parseResultData(resultData: any): any {
  if (typeof resultData !== 'string') {
    return resultData;
  }

  try {
    // Try simple parse first
    return JSON.parse(resultData);
  } catch {
    // If that fails, try to extract JSON from string
    const startIdx = resultData.indexOf('{');
    const endIdx = resultData.lastIndexOf('}') + 1;

    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(resultData.slice(startIdx, endIdx));
      } catch {
        // Fall through to error return
      }
    }

    return {
      type: 'error',
      message: 'Failed to parse agent response as JSON',
      original: resultData
    };
  }
}
