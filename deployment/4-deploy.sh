#!/bin/bash
# Note: set -e disabled when sourced to avoid issues with deploy-all.sh
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    set -eo pipefail
fi

# Check if bucket name exists
if [ ! -f artifacts/bucket-name.txt ]; then
    echo "Error: bucket-name.txt not found. Run 1-create-bucket.sh first."
    exit 1
fi

ARTIFACT_BUCKET=$(cat artifacts/bucket-name.txt)
STACK_NAME=ReportingWithAIAgent-Backend

# Package CloudFormation template
aws cloudformation package \
    --template-file template.yml \
    --s3-bucket $ARTIFACT_BUCKET \
    --output-template-file artifacts/packaged-template.yml

# Deploy CloudFormation stack
aws cloudformation deploy \
    --template-file artifacts/packaged-template.yml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        DBUser="${user}" \
        DBPassword="${password}" \
        DBHost="${host}" \
        DBPort="${port}" \
        DBName="${dbname}" \
        BedrockRegion="${BedrockRegion}"

echo "Stack deployed successfully: $STACK_NAME"
aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs'
