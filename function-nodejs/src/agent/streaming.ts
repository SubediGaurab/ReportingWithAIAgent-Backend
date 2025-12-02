/**
 * WebSocket streaming handler for LangGraph agent responses
 * Updated to handle LangGraph stream format (messages and updates)
 */

import { WebSocketClient } from '../utils/websocket-client.js';
import { logger } from '../utils/logger.js';
import { handleError } from '../utils/error-handler.js';
import { createChartGenerationAgent } from './agent-config.js';

/**
 * Process LangGraph agent stream and send messages via WebSocket
 */
export async function streamAgentResponseToWebSocket(
  connectionId: string,
  prompt: string,
  wsClient: WebSocketClient
): Promise<void> {
  try {
    logger.info('Starting LangGraph agent stream processing', {
      connectionId,
      promptLength: prompt.length,
    });

    const agentStream = await createChartGenerationAgent(prompt);

    let messageCount = 0;
    let thoughtCount = 0;
    let hasResult = false;

    // LangGraph streams as step objects with nested updates
    for await (const step of agentStream) {
      messageCount++;

      logger.debug('Received stream step', {
        connectionId,
        stepKeys: Object.keys(step),
      });

      // Process each update in the step
      for (const update of Object.values(step)) {
        if (update && typeof update === 'object' && 'messages' in update) {
          const messages = update.messages as any[];

          if (messages && Array.isArray(messages) && messages.length > 0) {
            // Process each message in the update
            for (const message of messages) {
              const messageType = await processMessage(connectionId, message, wsClient);
              if (messageType === 'thought') {
                thoughtCount++;
              } else if (messageType === 'result') {
                hasResult = true;
              }
            }
          }
        }
      }
    }

    logger.info('LangGraph agent stream processing completed', {
      connectionId,
      messageCount,
      thoughtCount,
      hasResult,
    });

  } catch (error) {
    logger.error('Error during LangGraph agent stream processing', {
      connectionId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorMessage = handleError(error, { connectionId });
    await wsClient.sendError(connectionId, errorMessage.message);
  }
}

/**
 * Process individual messages from LangGraph stream
 */
async function processMessage(
  connectionId: string,
  message: any,
  wsClient: WebSocketClient
): Promise<'thought' | 'result' | 'skipped'> {
  if (!message || !message.content) {
    return 'skipped';
  }

  // Skip tool messages (outputs from tool executions)
  if (
    message.type === 'tool' ||
    message.constructor?.name === 'ToolMessage' ||
    (typeof message.content === 'string' && message.content.startsWith('[{"schema":')) // Fallback for raw schema dumps
  ) {
    logger.debug('Skipping tool message', { connectionId, type: message.type });
    return 'skipped';
  }

  let content = '';

  if (typeof message.content === 'string') {
    content = message.content;
  } else if (Array.isArray(message.content)) {
    // Handle array of content blocks (common in Anthropic)
    content = message.content
      .map((block: any) => {
        if (typeof block === 'string') return block;
        if (block && block.type === 'text' && block.text) return block.text;
        return '';
      })
      .join('');
  } else if (typeof message.content === 'object' && message.content !== null) {
    // Handle single content block object
    if (message.content.text) {
      content = message.content.text;
    } else {
      content = JSON.stringify(message.content);
    }
  } else {
    content = JSON.stringify(message.content);
  }

  if (!content || !content.trim()) {
    return 'skipped';
  }

  // Try to extract JSON from the content (handles markdown code blocks)
  const extractedJson = extractJsonFromContent(content);

  if (extractedJson) {
    // This looks like a final result - send as result
    const resultData = parseResultData(extractedJson);

    await wsClient.sendResult(connectionId, resultData);

    logger.info('Sent final result to client', {
      connectionId,
      resultType: typeof resultData,
      hasError: 'error' in resultData,
    });

    return 'result'; // Not a thought, it's a result
  } else {
    // This is a thought/reasoning step - send as thought
    await wsClient.sendThought(connectionId, content);

    logger.debug('Sent thought to client', {
      connectionId,
      contentLength: content.length,
    });

    return 'thought'; // It's a thought
  }
}

/**
 * Process individual messages from LangGraph stream
 */
function extractJsonFromContent(content: string): string | null {
  const trimmed = content.trim();

  // Check for markdown code blocks with json
  const jsonCodeBlockMatch = trimmed.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonCodeBlockMatch) {
    return jsonCodeBlockMatch[1].trim();
  }

  // Check for plain code blocks
  const codeBlockMatch = trimmed.match(/```\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Check if it's plain JSON (starts with { and ends with })
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    // Try to validate it's actually JSON
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }

  // Check if it contains a Chart.js-like structure
  if (trimmed.includes('"type"') && trimmed.includes('"data"')) {
    // Try to extract the JSON object
    const startIdx = trimmed.indexOf('{');
    const endIdx = trimmed.lastIndexOf('}') + 1;
    if (startIdx !== -1 && endIdx > startIdx) {
      const jsonStr = trimmed.slice(startIdx, endIdx);
      try {
        JSON.parse(jsonStr);
        return jsonStr;
      } catch {
        return null;
      }
    }
  }

  // Check if it contains an error object
  if (trimmed.includes('"error"')) {
    // Try to extract the JSON object
    const startIdx = trimmed.indexOf('{');
    const endIdx = trimmed.lastIndexOf('}') + 1;
    if (startIdx !== -1 && endIdx > startIdx) {
      const jsonStr = trimmed.slice(startIdx, endIdx);
      try {
        JSON.parse(jsonStr);
        return jsonStr;
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Parse result data from agent output
 * Handles both string JSON and object formats
 */
function parseResultData(resultData: any): any {
  // If it's already an object, return it
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

    // If we still can't parse it, return as error
    return {
      error: 'Failed to parse agent response as JSON',
      original: resultData
    };
  }
}
