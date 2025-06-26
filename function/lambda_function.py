import os
import logging
import jsonpickle
import boto3
import json  
import uuid
import asyncio
from function.agent import inline_agent

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client = boto3.client('lambda')
client.get_account_settings()

def lambda_handler(event, context):  
    """
    Main Lambda handler function.  
    """
    logger.info('## ENVIRONMENT VARIABLES\r' + jsonpickle.encode(dict(**os.environ)))
    logger.info('## EVENT\r' + jsonpickle.encode(event))
    logger.info('## CONTEXT\r' + jsonpickle.encode(context))

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
        agent_response = asyncio.run(inline_agent.invoke_agent(prompt, session_id))

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
