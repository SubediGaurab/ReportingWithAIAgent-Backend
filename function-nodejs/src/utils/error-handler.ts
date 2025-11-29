/**
 * Error handling utilities for WebSocket responses
 */

import { logger } from './logger';

export interface ErrorMessage {
  type: 'error';
  message: string;
}

/**
 * Format an error for WebSocket transmission
 */
export function formatError(error: unknown): ErrorMessage {
  let message = 'An unexpected error occurred';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message);
  }

  return {
    type: 'error',
    message,
  };
}

/**
 * Log and format an error
 */
export function handleError(error: unknown, context: Record<string, any> = {}): ErrorMessage {
  logger.error('Error occurred', {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    ...context,
  });

  return formatError(error);
}

/**
 * Retry an async operation with exponential backoff
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn('Operation failed, retrying', {
        attempt: attempt + 1,
        maxRetries,
        nextDelayMs: delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}
