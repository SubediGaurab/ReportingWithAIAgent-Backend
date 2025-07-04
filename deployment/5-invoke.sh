#!/bin/bash
set -eo pipefail

STACK_NAME=ReportingWithAIAgent-Backend
FUNCTION=$(aws cloudformation describe-stack-resource --stack-name $STACK_NAME --logical-resource-id ReportingAgentFunction --query 'StackResourceDetail.PhysicalResourceId' --output text)

# Create test event if it doesn't exist
if [ ! -f artifacts/test-event.json ]; then
    cat > artifacts/test-event.json << 'EOF'
{
  "requestContext": {
    "routeKey": "sendmessage",
    "connectionId": "test-connection-123",
    "domainName": "<your-api-id>.execute-api.<region>.amazonaws.com",
    "stage": "prod"
  },
  "body": "{\"prompt\": \"Generate chart of patient age and cancer risk.\"}"
}
EOF
    echo "Created test event: artifacts/test-event.json"
fi

echo "Invoking function: $FUNCTION"
aws lambda invoke --function-name $FUNCTION --payload fileb://artifacts/test-event.json artifacts/response.json

echo "Response:"
cat artifacts/response.json | jq .
echo ""
