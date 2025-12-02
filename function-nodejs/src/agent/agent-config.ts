/**
 * LangGraph agent configuration for chart generation
 * Migrated from Claude Agent SDK to LangGraph for AWS Lambda compatibility
 */

import { createAgent } from 'langchain';
import { ChatAnthropic } from '@langchain/anthropic';
import { CHART_GENERATION_SYSTEM_PROMPT } from './system-prompt.js';
import { createMCPClient } from './mcp-client.js';
import { logger } from '../utils/logger.js';

/**
 * Create a LangGraph agent for chart generation
 * Returns an agent stream that can be consumed for real-time responses
 */
export async function createChartGenerationAgent(userPrompt: string) {
  logger.info('Creating chart generation agent with LangGraph', {
    promptLength: userPrompt.length,
  });

  // Validate required environment variable
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable');
  }

  // Initialize MCP client and get tools
  const mcpClient = createMCPClient();

  logger.info('Retrieving MCP tools from Supabase');
  const tools = await mcpClient.getTools();

  logger.info('MCP tools loaded successfully', {
    toolCount: tools.length,
    toolNames: tools.map(t => t.name),
  });

  logger.info('Creating Anthropic model');

  // Initialize Anthropic model
  const model = new ChatAnthropic({
    model: 'claude-haiku-4-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
    streaming: true,
    temperature: 0,
  });

  logger.info('Creating LangGraph agent with tools and system prompt');

  // Create agent with MCP tools and system prompt
  const agent = createAgent({
    model,
    tools,
    systemPrompt: CHART_GENERATION_SYSTEM_PROMPT,
  });

  logger.info('Agent created successfully, starting stream');

  // Stream the agent response
  const agentStream = agent.stream(
    {
      messages: [{ role: 'user', content: userPrompt }],
    },
    { streamMode: "updates" },
  );

  return agentStream;
}
