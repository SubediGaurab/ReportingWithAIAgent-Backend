#!/bin/bash
set -eo pipefail

# Generate unique bucket name
BUCKET_NAME=lambda-artifacts-reportingwithaiagent-$(date +%s)
echo $BUCKET_NAME > artifacts/bucket-name.txt

# Create S3 bucket for deployment artifacts
if [ "$AWS_DEFAULT_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket $BUCKET_NAME
else
    aws s3api create-bucket --bucket $BUCKET_NAME --create-bucket-configuration LocationConstraint=$AWS_DEFAULT_REGION
fi

echo "Created S3 bucket: $BUCKET_NAME"