/**
 * Claude Agent SDK configuration for chart generation
 */

import { CHART_GENERATION_SYSTEM_PROMPT } from './system-prompt';
import { logger } from '../utils/logger';
import path from 'path';

const chartSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        type: { type: "string" },
        data: { type: "object" },
        options: { type: "object" }
      },
      required: ["type", "data", "options"],
      additionalProperties: false
    },
    {
      type: "object",
      properties: {
        error: { type: "string" }
      },
      required: ["error"],
      additionalProperties: false
    }
  ]
} as const;



/**
 * MCP server configuration based on environment variables
 * Uses Supabase MCP HTTP server
*/
function getMcpServerConfig() {
  const mcpServers: any = {};

  // Supabase MCP HTTP Server (like working example)
  if (process.env.SUPABASE_PROJECT_REF && process.env.SUPABASE_ACCESS_TOKEN) {
    const supabaseUrl = `https://mcp.supabase.com/mcp?project_ref=${process.env.SUPABASE_PROJECT_REF}`;

    logger.info('Using Supabase MCP HTTP server', {
      project_ref: process.env.SUPABASE_PROJECT_REF,
    });

    mcpServers.supabase = {
      type: 'http',
      url: supabaseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      },
    };
  } else {
    throw new Error('Missing Supabase MCP configuration. Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN environment variables.');
  }

  return mcpServers;
}

/**
 * Create an agent query stream for chart generation
 */
export async function createChartGenerationAgent(userPrompt: string) {
  logger.info('Creating chart generation agent', {
    promptLength: userPrompt.length,
  });

  const mcpServers = getMcpServerConfig();

  // In Lambda, layers are mounted at /opt/nodejs/node_modules
  // Locally, it's in node_modules
  const isLambda = process.env.AWS_EXECUTION_ENV !== undefined;
  const cliPath = isLambda
    ? '/opt/nodejs/node_modules/@anthropic-ai/claude-agent-sdk/cli.js'
    : path.join(process.cwd(), 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js');

  logger.info('CLI path configuration', {
    isLambda,
    cliPath,
  });

  // Use dynamic import to load ESM SDK from CommonJS code
  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  const agentStream = query({
    prompt: userPrompt,
    options: {
      systemPrompt: CHART_GENERATION_SYSTEM_PROMPT,
      mcpServers,
      permissionMode: 'bypassPermissions', // Lambda automation mode
      model: 'claude-haiku-4-5',

      // FIX: Provide explicit path to cli.js from Lambda layer
      pathToClaudeCodeExecutable: cliPath,
      // commenting out since it's expecting this format for tool call also
      // outputFormat: {
      //   type: 'json_schema',
      //   schema: chartSchema
      // },
    },
  });

  return agentStream;
}
