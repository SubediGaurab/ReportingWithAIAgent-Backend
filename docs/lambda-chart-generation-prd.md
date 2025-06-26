# Lambda Endpoint for AI-Driven Chart Generation from Postgres DB – PRD

## Overview
This document outlines the product requirements for a new Lambda endpoint that leverages Amazon Bedrock Inline Agent and a custom MCP server to generate a single, AI-selected chart based on data from a Supabase Postgres database. The endpoint will interpret user prompts, query the database, and return chart parameters suitable for a popular JavaScript charting library. The system will gracefully decline requests that are not chart-related or that request multiple charts.

---

## Goals
- Enable users to request a single chart (any type) based on data in the `Test` schema of a Postgres DB via a Lambda endpoint.
- Use Bedrock Inline Agent to interpret prompts and orchestrate data retrieval and chart parameter generation.
- Integrate with a custom MCP server exposing two tools: table structure fetch and readonly SQL execution.
- Return chart parameters in JSON format compatible with a standard JS charting library.
- Decline non-chart or multi-chart requests politely.

---

## User Stories

### 1. As a user, I want to request a chart (e.g., "provide chart of sales over last week") and receive a JSON response with parameters for a relevant chart, so I can visualize my data easily.

### 2. As a user, if I ask for something unrelated to charting or request multiple charts, I want the system to politely decline and explain why my request cannot be fulfilled.

### 3. As a developer, I want the Lambda to use Bedrock Inline Agent and a custom MCP server for Postgres, so the solution is modular, secure, and leverages AI for chart selection and data querying.

---

## Functional Requirements
- **Lambda Endpoint**
  - Accepts a prompt from the user (e.g., "show a bar chart of sales by region last month").
  - Passes the prompt to a Bedrock Inline Agent.
- **Bedrock Inline Agent**
  - Interprets the prompt and determines if it is a valid single-chart request.
  - If valid, orchestrates data retrieval and chart parameter generation.
  - If invalid (not chart-related or requests multiple charts), returns a polite decline message.
- **Custom MCP Server for Supabase Postgres**
  - Tool 1: Fetches structure of all tables under the `ReportingWithAIAgent` schema.
  - Tool 2: Executes readonly SQL queries on the `ReportingWithAIAgent` schema.
- **Chart Parameter Generation**
  - Agent returns a JSON object with parameters for a single chart (type, data, labels, etc.) compatible with a popular JS charting library (e.g., Chart.js, ECharts, etc.).
  - The chart type is selected by the agent based on the prompt and data.
- **Security & Compliance**
  - Only readonly queries are allowed.
  - No sensitive data is exposed.
- **Error Handling**
  - Polite, user-friendly error messages for unsupported requests.

---

## Non-Functional Requirements
- **Performance:** Response time under 5 seconds for typical queries.
- **Scalability:** Lambda should handle concurrent requests efficiently.
- **Reliability:** High availability and robust error handling.
- **Security:** No write access to DB; credentials managed securely.

---

## Acceptance Criteria
- [ ] Lambda endpoint accepts user prompt and returns chart parameters as JSON for a single, relevant chart.
- [ ] If the prompt is not chart-related or requests multiple charts, the response is a polite decline.
- [ ] Only readonly SQL queries are executed on the `Test` schema.
- [ ] The agent uses the MCP server's tools to fetch table structure and execute queries as needed.
- [ ] The returned JSON is compatible with a standard JS charting library and includes all necessary parameters for rendering.
- [ ] No sensitive or write operations are possible through the endpoint.
- [ ] System logs all requests and responses for audit and debugging.

---

## Open Questions
- Which JavaScript charting library should be the default (e.g., Chart.js, ECharts)?
- Should there be a limit on query complexity or result size?
- What authentication (if any) is required for the Lambda endpoint?

---

## Appendix
- Example prompt: `"Provide a line chart of daily sales for the last 7 days."`
- Example response:
```json
{
  "type": "line",
  "data": {
    "labels": ["2025-06-15", "2025-06-16", ...],
    "datasets": [{"label": "Sales", "data": [120, 150, ...]}]
  },
  "options": {"title": {"display": true, "text": "Daily Sales (Last 7 Days)"}}
}
```
- Example decline: `"Sorry, I can only generate one chart per request. Please rephrase your request."`
