/**
 * Environment variable type definitions
 */

export interface EnvironmentConfig {
  // Supabase MCP Server
  SUPABASE_PROJECT_REF: string;
  SUPABASE_ACCESS_TOKEN: string;

  // AWS Configuration
  AWS_REGION?: string;

  // Logging
  LOG_LEVEL?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Get environment variable or throw error if required and missing
 */
export function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];

  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || '';
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    SUPABASE_PROJECT_REF: getEnvVar('SUPABASE_PROJECT_REF', true),
    SUPABASE_ACCESS_TOKEN: getEnvVar('SUPABASE_ACCESS_TOKEN', true),
    AWS_REGION: getEnvVar('AWS_REGION', false) || 'us-west-2',
    LOG_LEVEL: (getEnvVar('LOG_LEVEL', false) || 'INFO') as any,
  };
}
