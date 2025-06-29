import os
import logging
import jsonpickle
import boto3
import json
import uuid
import asyncio
from agent import inline_agent

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    route_key = event.get('requestContext', {}).get('routeKey')
    connection_id = event.get('requestContext', {}).get('connectionId')

    if route_key == '$connect':
        logger.info(f"New connection: {connection_id}")
        return {'statusCode': 200, 'body': 'Connected.'}
    elif route_key == '$disconnect':
        logger.info(f"Connection closed: {connection_id}")
        return {'statusCode': 200, 'body': 'Disconnected.'}

    apigw_management_client = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=f"https://{event['requestContext']['domainName']}/{event['requestContext']['stage']}"
    )

    def post_to_connection(connection_id, data):
        try:
            apigw_management_client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(data).encode('utf-8')
            )
        except apigw_management_client.exceptions.GoneException:
            logger.warning(f"Connection {connection_id} is gone.")
        except Exception as e:
            logger.error(f"Error sending message to {connection_id}: {e}")

    def thought_callback(thought):
        post_to_connection(connection_id, {'type': 'thought', 'content': thought})

    try:
        body = json.loads(event.get("body", "{}"))
        prompt = body.get("prompt")

        if not prompt:
            post_to_connection(connection_id, {'error': 'Request body must be JSON and contain a "prompt" key.'})
            return {'statusCode': 400}

        session_id = str(uuid.uuid4())

        # Update the agent to accept the callback
        inline_agent.agent.thought_callback = thought_callback

        agent_response = asyncio.run(inline_agent.invoke_agent(prompt, session_id))

        try:
            # Trim JSON response to remove any extraneous content before parsing
            # This handles cases where the model includes thinking or other text
            # outside the JSON structure due to library or model processing bugs
            first_brace = agent_response.find('{')
            last_brace = agent_response.rfind('}')
            
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                trimmed_response = agent_response[first_brace:last_brace + 1]
            else:
                trimmed_response = agent_response
            
            chart_params = json.loads(trimmed_response)
            response_data = {'type': 'result', 'data': chart_params}
        except json.JSONDecodeError:
            # If agent didn't return valid JSON, format as proper error response
            response_data = {'type': 'result', 'data': {'error': agent_response}}

        post_to_connection(connection_id, response_data)

        return {'statusCode': 200}

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        post_to_connection(connection_id, {'error': 'An internal server error occurred.'})
        return {'statusCode': 500}
