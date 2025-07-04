import os
import asyncio
import json
import boto3
from dotenv import load_dotenv
import sys
import os

# Add function directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'function'))

from tools.sql_tools import get_schema, execute_sql
from lambda_function import lambda_handler

# Load environment variables from .env file
load_dotenv()

# Global list to capture streamed thoughts
streamed_thoughts = []

def create_mock_event(prompt: str, route_key: str = 'sendmessage'):
    """Create a mock API Gateway WebSocket event"""
    return {
        'requestContext': {
            'routeKey': route_key,
            'connectionId': 'mock-connection-123',
            'domainName': 'mock-api.execute-api.<region>.amazonaws.com',
            'stage': 'dev'
        },
        'body': json.dumps({"prompt": prompt}) if route_key != '$connect' and route_key != '$disconnect' else '{}'
    }

def create_mock_context():
    """Create a mock Lambda context"""
    class MockContext:
        def __init__(self):
            self.function_name = 'test-function'
            self.aws_request_id = 'mock-request-id'
            self.remaining_time_in_millis = lambda: 30000
            
    return MockContext()

# Mock the API Gateway Management API client
class MockAPIGatewayClient:
    def post_to_connection(self, ConnectionId, Data):
        data = json.loads(Data.decode('utf-8'))
        print(f"[STREAM] ConnectionId: {ConnectionId}")
        print(f"[STREAM] Data: {data}")
        
        if data.get('type') == 'thought':
            streamed_thoughts.append(data['content'])
            print(f"[THOUGHT] {data['content']}")
        elif data.get('type') == 'result':
            print(f"[RESULT] {json.dumps(data['data'], indent=2)}")
        elif 'error' in data:
            print(f"[ERROR] {data['error']}")
    
    @property
    def exceptions(self):
        class Exceptions:
            class GoneException(Exception):
                pass
        return Exceptions()

# Store original boto3.client
original_boto3_client = boto3.client

def mock_boto3_client(service_name, **kwargs):
    """Mock boto3 client to intercept API Gateway calls"""
    if service_name == 'apigatewaymanagementapi':
        return MockAPIGatewayClient()
    else:
        # Return real client for other services (like Bedrock)
        return original_boto3_client(service_name, **kwargs)

def test_lambda_streaming(prompt: str, route_key: str = 'sendmessage'):
    """Test the Lambda function with streaming"""
    global streamed_thoughts
    streamed_thoughts = []  # Reset thoughts list
    
    # Patch boto3.client to use our mock
    boto3.client = mock_boto3_client
    
    try:
        print(f"\n=== Testing Lambda with Route: '{route_key}' ===")
        if route_key not in ['$connect', '$disconnect']:
            print(f"Prompt: '{prompt}'")
        print("=" * 60)
        
        # Create mock event and context
        event = create_mock_event(prompt, route_key)
        context = create_mock_context()
        
        # Call the Lambda handler (it's synchronous, not async)
        result = lambda_handler(event, context)
        
        print("=" * 60)
        print(f"Lambda Status Code: {result['statusCode']}")
        
        if streamed_thoughts:
            print(f"\nCaptured {len(streamed_thoughts)} thoughts:")
            for i, thought in enumerate(streamed_thoughts, 1):
                print(f"  {i}. {thought}")
        else:
            print("No thoughts captured (this is expected for connect/disconnect)")
            
    except Exception as e:
        print(f"Error during Lambda execution: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Restore original boto3.client
        boto3.client = original_boto3_client

def test_database_connection():
    """Test database connection directly"""
    try:
        print("=== Testing Database Connection ===")
        schema = get_schema()
        print(f"Retrieved schema: {schema}")
        
        print("\nTesting simple query...")
        test_query = "SELECT COUNT(*) as total_records FROM information_schema.tables WHERE table_schema = 'ReportingWithAIAgent'"
        result = execute_sql(test_query)
        print(f"Query result: {result}")
        
    except Exception as e:
        print(f"Database Error: {e}")

def main():
    """Main test function"""
    print("ReportingWithAIAgent - Lambda Streaming Test")
    print("=" * 60)
    
    # Test database connection first
    #test_database_connection()
    
    # Test WebSocket connection events
    #test_lambda_streaming("", "$connect")
    
    # Test actual chart generation with streaming
    test_lambda_streaming("Generate chart of patient age and cancer risk.")
    
    # Test disconnect
    #test_lambda_streaming("", "$disconnect")
    
    print(f"\n=== Test Summary ===")
    print(f"Total thoughts captured across all tests: {len(streamed_thoughts)}")

if __name__ == "__main__":
    main()