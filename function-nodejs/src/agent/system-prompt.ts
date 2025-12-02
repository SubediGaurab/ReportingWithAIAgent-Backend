/**
 * System prompt for Chart.js generation agent
 * Dynamically loaded from system-prompt.md for easy editing
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve path to system-prompt.md file
 * Handles both Lambda and local development environments
 */
const getSystemPromptPath = (): string => {
  // Lambda environment: files are deployed to /var/task
  const lambdaPath = '/var/task/system-prompt.md';
  if (fs.existsSync(lambdaPath)) {
    return lambdaPath;
  }

  // Alternative Lambda path (in agent subdirectory)
  const lambdaAgentPath = '/var/task/agent/system-prompt.md';
  if (fs.existsSync(lambdaAgentPath)) {
    return lambdaAgentPath;
  }

  // Local development: relative to this file
  const localPath = path.join(__dirname, 'system-prompt.md');
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  // Fallback: check project root
  const rootPath = path.join(process.cwd(), 'system-prompt.md');
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }

  throw new Error(
    'system-prompt.md not found. Checked paths:\n' +
    `  - ${lambdaPath}\n` +
    `  - ${lambdaAgentPath}\n` +
    `  - ${localPath}\n` +
    `  - ${rootPath}`
  );
};

/**
 * Load and export the system prompt
 */
export const CHART_GENERATION_SYSTEM_PROMPT: string = fs.readFileSync(
  getSystemPromptPath(),
  'utf-8'
).trim();