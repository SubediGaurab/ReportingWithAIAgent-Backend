import json  
import boto3  
import sys
import os
import time
import random
from tools.sql_tools import get_schema, execute_sql

# Add the InlineAgent package to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'InlineAgent', 'src'))

from InlineAgent import InlineAgent, ActionGroup

def load_agent_instructions():
    """Load agent instructions from markdown file"""
    instructions_path = os.path.join(os.path.dirname(__file__), 'agent_instructions.md')
    try:
        with open(instructions_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        raise FileNotFoundError(f"Agent instructions file not found at: {instructions_path}")
    except Exception as e:
        raise Exception(f"Error loading agent instructions: {str(e)}")

# Load instructions from external file
AGENT_INSTRUCTION = load_agent_instructions()

# Create action group with SQL tools
sql_action_group = ActionGroup(
    name="SQLActionGroup",
    description="Action group for database operations",
    tools=[get_schema, execute_sql]
)

# Create inline agent
agent = InlineAgent(
    foundation_model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    instruction=AGENT_INSTRUCTION,
    agent_name="ChartGeneratorAgent",
    action_groups=[sql_action_group],
    api_call_delay=2.0  # 2 second delay between API calls to prevent throttling
)

async def invoke_agent(prompt: str, session_id: str = None):  
    """
    Invokes the inline agent with the provided prompt.
    Args:
        prompt: The user prompt
        session_id: Optional session ID
    """
    if session_id is None:
        session_id = f"session_{hash(prompt) % 100000}"
    
    # Check for BedrockRegion environment variable
    bedrock_region = os.environ.get('BedrockRegion')
    agent_instance = agent
    
    if bedrock_region:
        # Create a new agent instance with the specified Bedrock region
        agent_instance = InlineAgent(
            foundation_model="anthropic.claude-3-5-sonnet-20241022-v2:0",
            instruction=AGENT_INSTRUCTION,
            agent_name="ChartGeneratorAgent",
            action_groups=[sql_action_group],
            api_call_delay=2.0,
            _override_region=bedrock_region
        )
        
        # Preserve thought_callback from original agent if it exists
        if hasattr(agent, 'thought_callback') and agent.thought_callback:
            agent_instance.thought_callback = agent.thought_callback
    
    try:
        # Enable streaming for intermediate responses
        streaming_config = {"streamFinalResponse": True}
        response = await agent_instance.invoke(
            prompt, 
            session_id=session_id,
            streaming_configurations=streaming_config
        )
        return response
    except Exception as e:
        return json.dumps({"error": f"Agent invocation failed: {str(e)}"})
