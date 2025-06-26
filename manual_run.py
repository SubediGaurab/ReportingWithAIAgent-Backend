import sys
import os
import json
from dotenv import load_dotenv
from function.lambda_function import lambda_handler

# Load environment variables from .env in the current directory
load_dotenv()

# Test prompt for chart generation
test_prompt = "Show me sales data as a bar chart"

def main():
    print("Testing lambda function with prompt:", test_prompt)
    print("=" * 50)
    
    # Create mock event that mimics API Gateway request
    mock_event = {
        "body": json.dumps({"prompt": test_prompt}),
        "headers": {"Content-Type": "application/json"},
        "httpMethod": "POST"
    }
    
    # Create mock context
    class MockContext:
        def __init__(self):
            self.function_name = "test-function"
            self.function_version = "1"
            self.invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:test-function"
            self.memory_limit_in_mb = "128"
            self.remaining_time_in_millis = lambda: 30000
            self.log_group_name = "/aws/lambda/test-function"
            self.log_stream_name = "2023/01/01/test-stream"
            self.aws_request_id = "test-request-id"
    
    mock_context = MockContext()
    
    # Invoke the lambda handler
    result = lambda_handler(mock_event, mock_context)
    
    print("Lambda response:")
    print(f"Status Code: {result['statusCode']}")
    print(f"Headers: {result.get('headers', {})}")
    print("Body:")
    print(result['body'])

if __name__ == "__main__":
    main()