/**
 * WebSocket streaming handler for agent responses
 * Compatible with direct Anthropic SDK implementation
 */

import { WebSocketClient } from '../utils/websocket-client';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';
import { createChartGenerationAgent, AgentMessage } from './agent-config';

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

    // createChartGenerationAgent now returns AsyncGenerator directly (no await needed)
    const agentStream = createChartGenerationAgent(prompt);

    let messageCount = 0;
    let thoughtCount = 0;
    let toolCallCount = 0;
    let hasResult = false;

    for await (const message of agentStream) {
      messageCount++;

      switch (message.type) {
        case 'assistant':
          thoughtCount += await processAssistantMessage(connectionId, message, wsClient);
          break;

        case 'tool_use':
          toolCallCount++;
          // Optionally send tool usage updates to client
          logger.debug('Tool being called', {
            connectionId,
            tool: message.name,
            toolCallNumber: toolCallCount,
          });
          break;

        case 'tool_result':
          logger.debug('Tool completed', {
            connectionId,
            tool: message.name,
          });
          break;

        case 'result':
          hasResult = true;
          await processResultMessage(connectionId, message, wsClient);
          break;
      }
    }

    logger.info('Agent stream processing completed', {
      connectionId,
      messageCount,
      thoughtCount,
      toolCallCount,
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

/**
 * Process assistant message and extract text content
 */
async function processAssistantMessage(
  connectionId: string,
  message: AgentMessage & { type: 'assistant' },
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
      // Skip tool_use blocks - they're handled separately
    }
  }
  
  return count;
}

/**
 * Process final result message
 */
async function processResultMessage(
  connectionId: string,
  message: AgentMessage & { type: 'result' },
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
      error: message.error,
    });

    await wsClient.sendResult(
      connectionId,
      { error: 'Agent processing failed: ' + (message.error || 'Unknown error') }
    );
  }
}

/**
 * Parse result data, attempting JSON extraction if needed
 */
function parseResultData(resultData: any): any {
  if (typeof resultData !== 'string') {
    return resultData;
  }

  // Try direct JSON parse
  try {
    return JSON.parse(resultData);
  } catch {
    // Try to extract JSON object from string
    const startIdx = resultData.indexOf('{');
    const endIdx = resultData.lastIndexOf('}') + 1;

    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(resultData.slice(startIdx, endIdx));
      } catch {
        // Fall through
      }
    }

    // Return as content wrapper if not JSON
    return {
      type: 'text',
      content: resultData,
    };
  }
}