/**
 * MCP client configuration using official @langchain/mcp-adapters
 * Connects to Supabase MCP HTTP server
 */

import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { logger } from '../utils/logger';

/**
 * Create and configure MCP client for Supabase
 * Returns a client that can discover and provide tools
 */
export function createMCPClient(): MultiServerMCPClient {
  // Validate required environment variables
  if (!process.env.SUPABASE_PROJECT_REF || !process.env.SUPABASE_ACCESS_TOKEN) {
    throw new Error('Missing Supabase MCP configuration. Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN environment variables.');
  }

  const supabaseUrl = `https://mcp.supabase.com/mcp?project_ref=${process.env.SUPABASE_PROJECT_REF}`;

  logger.info('Initializing Supabase MCP client', {
    project_ref: process.env.SUPABASE_PROJECT_REF,
    url: supabaseUrl,
  });

  // Create multi-server MCP client with Supabase configuration
  // Using Streamable HTTP transport (default) - no need to specify transport type
  const client = new MultiServerMCPClient({
    supabase: {
      url: supabaseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      },
      // Streamable HTTP is the default transport
      // SSE fallback is enabled automatically
    },
  });

  logger.info('MCP client initialized successfully');

  return client;
}
