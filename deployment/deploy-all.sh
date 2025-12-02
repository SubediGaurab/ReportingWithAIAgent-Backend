#!/bin/bash
set -eo pipefail

# ReportingWithAIAgent Deployment Pipeline
# Modern build system using tsup bundler with dependencies bundled directly into function
# No separate Lambda Layer - simplified single-artifact deployment

echo "=== ReportingWithAIAgent Full Deployment Pipeline ==="
echo "This script will:"
echo "1. Create S3 bucket for artifacts"
echo "2. Build Lambda function with bundled dependencies (no layer)"
echo "3. Export environment variables"
echo "4. Deploy CloudFormation stack"
echo "5. Clean up S3 artifacts"
echo "6. Wait for user confirmation"
echo "7. Test deployed function"
echo ""

# Step 1: Create S3 bucket
echo "=== Step 1: Creating S3 bucket ==="
./1-create-bucket.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create S3 bucket"
    exit 1
fi
echo "✓ S3 bucket created successfully"
echo ""

# Step 2: Build Lambda function
echo "=== Step 2: Building Lambda function ==="
./2-build-function.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Lambda function"
    exit 1
fi
echo "✓ Lambda function built successfully"
echo ""

# Step 3: Export environment variables
echo "=== Step 3: Exporting environment variables ==="
source ./3-export-env.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to export environment variables"
    exit 1
fi
echo "✓ Environment variables exported successfully"
echo ""

# Step 4: Deploy CloudFormation stack
echo "=== Step 4: Deploying CloudFormation stack ==="
source ./4-deploy.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to deploy CloudFormation stack"
    exit 1
fi
echo "✓ CloudFormation stack deployed successfully"
echo ""

# Step 5: Clean up S3 artifacts
echo "=== Step 5: Cleaning up S3 artifacts ==="
./6-cleanup.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to clean up S3 artifacts"
    exit 1
fi
echo "✓ S3 artifacts cleaned up successfully"
echo ""

# Step 6: Wait for user confirmation before testing
echo "=== Step 6: Ready for Testing ==="
echo "Deployment completed successfully!"
echo "The Lambda function is now deployed and ready for testing."
echo ""
echo "Press ENTER to proceed with testing the deployed function, or Ctrl+C to exit..."
read -r

# Step 7: Test deployed function
echo "=== Step 7: Testing deployed function ==="
./5-invoke.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Function test failed"
    exit 1
fi
echo "✓ Function test completed successfully"
echo ""

echo "=== Deployment Pipeline Completed Successfully ==="
echo "Your ReportingWithAIAgent Lambda function is deployed and tested!"