/**
 * WebSocket client for API Gateway postToConnection
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { logger } from './logger.js';

export class WebSocketClient {
  private client: ApiGatewayManagementApiClient;

  constructor(endpoint: string) {
    this.client = new ApiGatewayManagementApiClient({
      endpoint,
    });
  }

  /**
   * Send a message to a WebSocket connection
   */
  async sendMessage(connectionId: string, data: any): Promise<void> {
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);

      const command = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(message),
      });

      await this.client.send(command);

      logger.debug('Message sent to connection', {
        connectionId,
        messageLength: message.length,
      });
    } catch (error) {
      logger.error('Failed to send message to connection', {
        connectionId,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Send an error message to a WebSocket connection
   */
  async sendError(connectionId: string, message: string): Promise<void> {
    await this.sendMessage(connectionId, {
      error: message,
    });
  }

  /**
   * Send a thought message (streaming intermediate result)
   */
  async sendThought(connectionId: string, content: string): Promise<void> {
    await this.sendMessage(connectionId, {
      type: 'thought',
      content,
    });
  }

  /**
   * Send a final result message
   */
  async sendResult(connectionId: string, data: any): Promise<void> {
    await this.sendMessage(connectionId, {
      type: 'result',
      data,
    });
  }
}
