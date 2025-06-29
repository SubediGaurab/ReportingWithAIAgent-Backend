#!/bin/bash
set -eo pipefail

# Check if bucket name exists
if [ ! -f artifacts/bucket-name.txt ]; then
    echo "Error: bucket-name.txt not found."
    exit 1
fi

ARTIFACT_BUCKET=$(cat artifacts/bucket-name.txt)

# Empty S3 bucket
echo "Emptying S3 bucket: $ARTIFACT_BUCKET"
aws s3 rm s3://$ARTIFACT_BUCKET --recursive

# Delete S3 bucket
echo "Deleting S3 bucket: $ARTIFACT_BUCKET"
aws s3 rb s3://$ARTIFACT_BUCKET

echo "Bucket cleanup complete!"