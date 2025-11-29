/**
 * WebSocket event and message type definitions
 */

import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';

export type WebSocketEvent = APIGatewayProxyWebsocketEventV2;

export interface WebSocketRequest {
  prompt: string;
}

export interface ThoughtMessage {
  type: 'thought';
  content: string;
}

export interface ResultMessage {
  type: 'result';
  data: any;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WebSocketMessage = ThoughtMessage | ResultMessage | ErrorMessage;
