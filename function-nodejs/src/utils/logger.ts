/**
 * Structured JSON logger for CloudWatch Logs compatibility
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: Record<string, any>;
}

const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL as LogLevel];
}

function formatLog(level: LogLevel, message: string, context: Record<string, any> = {}): string {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
  return JSON.stringify(logEntry);
}

export const logger = {
  info: (message: string, context: Record<string, any> = {}) => {
    if (shouldLog('INFO')) {
      console.log(formatLog('INFO', message, context));
    }
  },

  warn: (message: string, context: Record<string, any> = {}) => {
    if (shouldLog('WARN')) {
      console.warn(formatLog('WARN', message, context));
    }
  },

  error: (message: string, context: Record<string, any> = {}) => {
    if (shouldLog('ERROR')) {
      console.error(formatLog('ERROR', message, context));
    }
  },

  debug: (message: string, context: Record<string, any> = {}) => {
    if (shouldLog('DEBUG')) {
      console.debug(formatLog('DEBUG', message, context));
    }
  },
};
