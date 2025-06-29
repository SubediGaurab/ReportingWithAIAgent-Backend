#!/bin/bash
set -eo pipefail

# Copy requirements.txt to current directory
cp ../function/requirements.txt .

# Clean up any existing artifacts
rm -rf artifacts/package artifacts/layer.zip

# Create layer package directory
mkdir -p artifacts/package/python

# Install dependencies into layer package
docker run \
    --platform linux/amd64 \
    --rm \
    -v "$(pwd)":/var/task \
    -w /var/task \
    --user "$(id -u):$(id -g)" \
    --entrypoint bash \
    amazon/aws-lambda-python:3.11-x86_64 \
    -c "pip install --target artifacts/package/python -r requirements.txt"

# Create layer zip file
cd artifacts/package
zip -r ../layer.zip .
cd ../..

# Clean up package directory after successful zip creation
rm -rf artifacts/package

# Remove copied requirements.txt to avoid confusion
rm -f requirements.txt

echo "Layer package created: artifacts/layer.zip"
