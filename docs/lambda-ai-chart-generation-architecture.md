# **Design & Implementation: AI-Driven Chart Generation (Code-Centric)**

## **1. Overview**

This document details the architecture and implementation plan for a Lambda endpoint that generates chart data from a PostgreSQL database in response to natural language prompts.

This revised design adopts a **fully code-centric approach**. The Amazon Bedrock Inline Agent and its tools (the "MCP" layer) are defined and managed programmatically within the AWS Lambda function's deployment package. This eliminates the need for a separate web server for tools, resulting in a simpler, faster, and more cost-effective architecture.

The updated architecture is as follows:

```
+-------------------------------------------------+  
|              AWS Lambda Function                |  
[Client] -> [API Gateway] -> |                                         |  
| [lambda_handler.py] -> [agent.py] -> [tools.py] | ----> [Postgres DB]  
|      (Orchestrator)   (Agent Logic)  (DB Tools)   |  
+-------------------------------------------------+
```

## **2. Architectural Decisions & Assumptions**

- **Charting Library:** **Chart.js** will be the target JavaScript charting library. The final JSON output will be structured to be directly consumable by Chart.js.  
- **API Gateway:** An **Amazon API Gateway** will expose the Lambda function as a RESTful endpoint.  
- **Authentication:** **AWS IAM authentication** will be enabled on the API Gateway.  
- **Database:** A **Supabase PostgreSQL** database is the data source. All interactions are limited to the ReportingWithAIAgent schema.  
- **Security:** Database credentials will be securely stored in **AWS Secrets Manager** and accessed by the Lambda function at runtime. The database tools will enforce **read-only** access.

## **3. Component Deep-Dive**

### **a. Project Structure**

The function's code will be organized into modular Python files:

```
function/  
|-- lambda_function.py   # Main handler, API Gateway interface  
|-- agent.py             # Defines and invokes the Bedrock Inline Agent  
|-- tools.py             # Contains functions for DB interaction (get_schema, execute_sql)  
|-- requirements.txt
```

### **b. AWS Lambda Function (lambda_function.py)**

- **Trigger:** API Gateway.  
- **Runtime:** Python 3.11.  
- **Core Responsibilities:**  
  1. Parse the user's prompt from the API Gateway event.  
  2. Call the invoke_agent function in the agent.py module.  
  3. Format the agent's response (either Chart.js JSON or a text message) into a proper HTTP response for API Gateway.  
  4. Handle exceptions and return appropriate error codes.

### **c. Tool Module (tools.py)**

- This module replaces the concept of an external MCP server. It contains the Python functions that the Bedrock Agent will invoke directly.  
- **Functions:**  
  - `get_db_connection()`: Retrieves credentials from AWS Secrets Manager and establishes a connection to the PostgreSQL database.  
  - `get_schema(schema_name)`: Queries the information_schema to get table and column details for the specified schema.  
  - `execute_sql(query)`: Validates that a given SQL query is read-only (SELECT) and executes it against the database.  
- **Dependencies:** psycopg2-binary, boto3.

### **d. Inline Agent Module (agent.py)**

- This is the core of the AI logic. It programmatically defines and interacts with the Bedrock Agent.  
- **Core Components:**  
  1. **Tool Specification:** An OpenAPI schema, defined as a Python dictionary, that describes the functions available in tools.py. This tells the agent what tools it has and how to use them.  
  2. **Instruction Prompt:** A detailed prompt string that instructs the agent on its personality, goals, and rules of engagement (e.g., only create one chart, use tools in a specific order, format output as Chart.js JSON).  
  3. **Invocation Logic:** A function, `invoke_agent(prompt)`, that calls the bedrock-agent-runtime.invoke_agent API. It will pass the user prompt, the instruction prompt, and the tool specification in the request. It will then process the streaming response from the agent.

## **4. Step-by-Step Implementation Guide**

### **Step 1: Set Up the PostgreSQL Database & Secrets**

1. **Create Schema and Tables:** Follow the instructions in the previous version of this document to create the ReportingWithAIAgent schema and populate it with sample data.  
2. **Store Credentials in AWS Secrets Manager:** Create a secret in Secrets Manager containing your PostgreSQL connection details (host, port, user, password, dbname). Note the ARN of the secret.

### **Step 2: Create the Tool Module (tools.py)**

Create a file named `function/tools.py` with the following code:

```python
import boto3  
import json  
import psycopg2  
import os

# Initialize a Secrets Manager client  
secrets_manager = boto3.client('secretsmanager')

def get_db_connection():  
    """
    Retrieves DB credentials from AWS Secrets Manager and connects to the database.  
    """
    secret_name = os.environ.get("DB_SECRET_NAME") # Get secret name from environment variable  
    if not secret_name:  
        raise ValueError("DB_SECRET_NAME environment variable not set.")

    try:  
        get_secret_value_response = secrets_manager.get_secret_value(SecretId=secret_name)  
        secret = json.loads(get_secret_value_response['SecretString'])  
        
        conn = psycopg2.connect(  
            host=secret['host'],  
            database=secret['dbname'],  
            user=secret['username'],  
            password=secret['password'],  
            port=secret.get('port', 5432)  
        )  
        return conn  
    except Exception as e:  
        print(f"Error connecting to database: {e}")  
        raise

def get_schema(schema_name: str = 'ReportingWithAIAgent') -> str:  
    """
    Fetches the schema of all tables and columns within a specified database schema.  
    Tool description for the agent: "Use this function to get the database schema. The input is the schema name."  
    """
    conn = get_db_connection()  
    try:  
        with conn.cursor() as cur:  
            query = """
                SELECT table_name, column_name, data_type  
                FROM information_schema.columns  
                WHERE table_schema = %s;  
            """  
            cur.execute(query, (schema_name,))  
            schema_info = cur.fetchall()  
            return json.dumps(schema_info)  
    finally:  
        conn.close()

def execute_sql(query: str) -> str:  
    """
    Executes a read-only SQL query against the database.  
    Tool description for the agent: "Use this function to execute a SELECT SQL query on the database."  
    """
    if not query.strip().upper().startswith('SELECT'):  
        return json.dumps({"error": "Invalid query. Only SELECT queries are allowed."})  
    
    conn = get_db_connection()  
    try:  
        with conn.cursor() as cur:  
            cur.execute(query)  
            columns = [desc[0] for desc in cur.description]  
            results = [dict(zip(columns, row)) for row in cur.fetchall()]  
            return json.dumps(results)  
    except Exception as e:  
        return json.dumps({"error": f"Query execution failed: {str(e)}"})  
    finally:  
        conn.close()
```

### **Step 3: Create the Inline Agent Module (agent.py)**

Create a file named `function/agent.py`. This file defines the agent's behavior and its knowledge of the tools.

```python
import json  
import boto3  
from function import tools

# Bedrock Agent Runtime client  
bedrock_agent_runtime_client = boto3.client("bedrock-agent-runtime")

# Define the tools in OpenAPI format for the agent  
TOOL_SPEC = {  
    "openapi": "3.0.0",  
    "info": {  
        "title": "Database Tools for Chart Generation",  
        "version": "1.0"  
    },  
    "paths": {  
        "/get_schema": {  
            "get": {  
                "summary": "Get the database schema",  
                "description": "Fetches the schema of all tables and columns within the 'ReportingWithAIAgent' database schema.",  
                "operationId": "get_schema",  
                "responses": { "200": { "description": "Schema information" } }  
            }  
        },  
        "/execute_sql": {  
            "post": {  
                "summary": "Execute a SQL query",  
                "description": "Executes a read-only SELECT SQL query against the database.",  
                "operationId": "execute_sql",  
                "requestBody": {  
                    "content": { "application/json": { "schema": {  
                        "type": "object", "properties": { "query": { "type": "string" } }  
                    } } }  
                },  
                "responses": { "200": { "description": "Query results" } }  
            }  
        }  
    }  
}

# The instruction prompt for the agent  
AGENT_INSTRUCTION = """
You are a data analyst assistant. Your primary function is to generate a single chart based on user requests by querying a PostgreSQL database. You must adhere to the following rules:  
1. You will only ever create ONE chart per request. If the user asks for multiple charts, politely decline and ask them to make a new request for each chart.  
2. If the user's request is not about creating a chart from data, politely decline.  
3. You have two tools available: `get_schema` to understand the database structure and `execute_sql` to query the data.  
4. You must use the `get_schema` tool first to see what tables and columns are available in the 'ReportingWithAIAgent' schema.  
5. Based on the schema and the user's request, formulate a read-only SQL `SELECT` query to retrieve the necessary data.  
6. Execute the query using the `execute_sql` tool.  
7. Analyze the results and determine the best chart type (e.g., 'bar', 'line', 'pie').  
8. Your final response must be a single, valid JSON object formatted for the Chart.js library. The JSON should include 'type', 'data', and 'options' keys. Do not include any other text or explanation outside of the JSON object.  
"""

def invoke_agent(prompt: str, session_id: str):  
    """
    Invokes the Bedrock agent programmatically with the defined tools and instructions.  
    """
    response = bedrock_agent_runtime_client.invoke_agent(  
        agentId="THIS_IS_IGNORED", # Placeholder, not used in inline agents  
        agentAliasId="THIS_IS_IGNORED", # Placeholder, not used in inline agents  
        sessionId=session_id,  
        inputText=prompt,  
        inlineAgentConfiguration={  
            "inferenceConfiguration": { "temperature": 0.0 },  
            "agentInstruction": AGENT_INSTRUCTION,  
            "toolSpecification": { "text": json.dumps(TOOL_SPEC) }  
        }  
    )

    # The response is a generator. We need to iterate over it to get the full response.  
    # This example shows a simple concatenation, but in a real app you might stream this.  
    completion = ""  
    for event in response.get("completion"):  
        chunk = event.get("chunk", {})  
        completion += chunk.get("bytes", b"").decode()  
    
    return completion
```

### **Step 4: Update the Lambda Handler (lambda_function.py)**

Modify your main `function/lambda_function.py` to use the new agent module.

```python
import json  
import logging  
import uuid  
from function import agent

logger = logging.getLogger()  
logger.setLevel(logging.INFO)

def lambda_handler(event, context):  
    """
    Main Lambda handler function.  
    """
    logger.info('## EVENT\r' + json.dumps(event))

    try:  
        body = json.loads(event.get("body", "{}"))  
        prompt = body.get("prompt")

        if not prompt:  
            return {  
                "statusCode": 400,  
                "body": json.dumps({"error": "Request body must be JSON and contain a 'prompt' key."}),  
            }

        # Generate a unique session ID for each invocation  
        session_id = str(uuid.uuid4())  
        
        # Invoke the agent  
        agent_response = agent.invoke_agent(prompt, session_id)

        # The agent is instructed to return either a valid JSON or a string message.  
        # We try to parse it as JSON. If it fails, we treat it as a plain text message.  
        try:  
            chart_params = json.loads(agent_response)  
            response_body = json.dumps(chart_params)  
            content_type = "application/json"  
        except json.JSONDecodeError:  
            response_body = json.dumps({"message": agent_response})  
            content_type = "application/json"

        return {  
            "statusCode": 200,  
            "body": response_body,  
            "headers": {"Content-Type": content_type},  
        }

    except Exception as e:  
        logger.error(f"An error occurred: {e}")  
        return {  
            "statusCode": 500,  
            "body": json.dumps({"error": "An internal server error occurred."}),  
        }
```

### **Step 5: Update Dependencies and Deploy**

1. **Update `function/requirements.txt`:**  
   boto3  
   aws-xray-sdk  
   psycopg2-binary

2. **Deploy the Lambda Function:**  
   - Set an environment variable on your Lambda function named `DB_SECRET_NAME` with the name/ARN of your secret in Secrets Manager.  
   - Ensure the Lambda function's IAM role has permissions for:  
     - bedrock:InvokeAgent  
     - secretsmanager:GetSecretValue  
     - Writing logs to CloudWatch.  
   - Package all the files (`lambda_function.py`, `agent.py`, `tools.py`, and dependencies) into a deployment zip file.  
   - Deploy the function and configure API Gateway as described previously.