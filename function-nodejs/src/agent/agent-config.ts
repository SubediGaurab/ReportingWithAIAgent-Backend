/**
 * Claude Agent using Anthropic SDK directly (Lambda-compatible)
 * Replaces claude-agent-sdk which requires Claude Code CLI
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { CHART_GENERATION_SYSTEM_PROMPT } from './system-prompt';
import { logger } from '../utils/logger';

/**
 * MCP Client for communicating with Supabase MCP HTTP server
 */
class MCPClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(projectRef: string, accessToken: string) {
    this.baseUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}`;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': randomUUID(),
    };
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  private async rpcCall(method: string, params: Record<string, any> = {}): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MCP request failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const result: any = await response.json();

    if (result.error) {
      throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`);
    }

    return result.result;
  }

  /**
   * Fetch available tools from MCP server and convert to Anthropic format
   */
  async getTools(): Promise<Anthropic.Tool[]> {
    const result = await this.rpcCall('tools/list');

    const tools: Anthropic.Tool[] = (result?.tools || []).map((tool: any) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema || { type: 'object', properties: {} },
    }));

    logger.info('Fetched MCP tools', {
      toolCount: tools.length,
      toolNames: tools.map(t => t.name),
    });

    return tools;
  }

  /**
   * Execute a tool via MCP server
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    logger.info('Calling MCP tool', { toolName, args });

    const result = await this.rpcCall('tools/call', {
      name: toolName,
      arguments: args,
    });

    logger.info('MCP tool result received', {
      toolName,
      resultType: typeof result,
    });

    return result;
  }
}

/**
 * Create MCP client from environment variables
 */
function createMCPClient(): MCPClient {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!projectRef || !accessToken) {
    throw new Error(
      'Missing Supabase MCP configuration. ' +
      'Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN environment variables.'
    );
  }

  logger.info('Creating MCP client', { project_ref: projectRef });

  return new MCPClient(projectRef, accessToken);
}

/**
 * Message types emitted by the agent stream
 * Matches the interface expected by streaming.ts
 */
export type AgentMessage =
  | { type: 'assistant'; message: { content: Anthropic.ContentBlock[] } }
  | { type: 'tool_use'; name: string; input: any }
  | { type: 'tool_result'; name: string; result: any }
  | { type: 'result'; subtype: 'success' | 'error'; result?: any; error?: string };

/**
 * Create an async generator that yields agent messages
 * This is a drop-in replacement for the claude-agent-sdk query() function
 */
export async function* createChartGenerationAgent(
  userPrompt: string
): AsyncGenerator<AgentMessage> {
  logger.info('Creating chart generation agent', {
    promptLength: userPrompt.length,
  });

  // Initialize Anthropic client (uses ANTHROPIC_API_KEY env var automatically)
  // We initialize it here to ensure env vars are loaded (e.g. by manual_run.ts)
  const anthropic = new Anthropic();

  // Initialize MCP client and fetch available tools
  const mcpClient = createMCPClient();
  const tools = await mcpClient.getTools();

  // Conversation history for multi-turn tool use
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  const MAX_ITERATIONS = 15; // Prevent infinite loops
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    logger.debug('Agent iteration', { iteration, messageCount: messages.length });

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20000,
      system: CHART_GENERATION_SYSTEM_PROMPT,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });

    logger.debug('Claude response received', {
      stopReason: response.stop_reason,
      contentBlocks: response.content.length,
    });

    // Yield the assistant message (for thought/text streaming)
    yield {
      type: 'assistant',
      message: { content: response.content },
    };

    // Check if we have tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    // If no tool use or stop_reason is end_turn, we're done
    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // Extract final text result
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      const finalText = textBlocks.map(b => b.text).join('\n');

      yield {
        type: 'result',
        subtype: 'success',
        result: finalText,
      };
      return;
    }

    // Add assistant message to conversation history
    messages.push({ role: 'assistant', content: response.content });

    // Process each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      yield {
        type: 'tool_use',
        name: toolUse.name,
        input: toolUse.input,
      };

      try {
        const result = await mcpClient.callTool(
          toolUse.name,
          toolUse.input as Record<string, any>
        );

        yield {
          type: 'tool_result',
          name: toolUse.name,
          result,
        };

        // Format result for Claude
        let resultContent: string;
        if (typeof result === 'string') {
          resultContent = result;
        } else if (result?.content) {
          // MCP often returns { content: [...] }
          resultContent = Array.isArray(result.content)
            ? result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
            : JSON.stringify(result.content);
        } else {
          resultContent = JSON.stringify(result, null, 2);
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultContent,
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Tool execution failed', {
          tool: toolUse.name,
          error: errorMsg,
        });

        yield {
          type: 'tool_result',
          name: toolUse.name,
          result: { error: errorMsg },
        };

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error executing tool: ${errorMsg}`,
          is_error: true,
        });
      }
    }

    // Add tool results to conversation
    messages.push({ role: 'user', content: toolResults });
  }

  // Max iterations reached
  logger.warn('Agent reached max iterations', { iterations: MAX_ITERATIONS });

  yield {
    type: 'result',
    subtype: 'error',
    error: `Agent did not complete within ${MAX_ITERATIONS} iterations`,
  };
}