/**
 * System prompt for Chart.js generation agent
 * Dynamically loaded from system-prompt.md for easy editing
 */

import * as fs from 'fs';
import * as path from 'path';

// In Lambda, files are in /var/task directory
// In local dev, __dirname works fine
const getSystemPromptPath = (): string => {
  // Try Lambda path first
  const lambdaPath = '/var/task/system-prompt.md';
  if (fs.existsSync(lambdaPath)) {
    return lambdaPath;
  }

  // Fallback to local development path
  return path.join(__dirname, 'system-prompt.md');
};

export const CHART_GENERATION_SYSTEM_PROMPT = fs.readFileSync(
  getSystemPromptPath(),
  'utf-8'
).trim();
