#!/bin/bash
set -eo pipefail

echo "Building Node.js Lambda layer..."

# Clean up any existing artifacts
rm -rf artifacts/package artifacts/layer.zip artifacts/function.zip

# Create layer package directory
mkdir -p artifacts/package/nodejs

# Install dependencies and build
echo "Installing Node.js dependencies..."
cd ../function-nodejs
npm install

# Build TypeScript code
echo "Building Lambda function code..."
npm run build

# Prune dev dependencies for layer
echo "Pruning dev dependencies..."
npm prune --production
cd ../deployment

# Copy node_modules to layer package
cp -r ../function-nodejs/node_modules artifacts/package/nodejs/

# Create layer zip file
cd artifacts/package
zip -r -q ../layer.zip .
cd ../..

echo "Layer package created: artifacts/layer.zip"
echo "Layer size: $(du -h artifacts/layer.zip | cut -f1)"

# Create function deployment package
cd ../deployment
mkdir -p artifacts/function-package
cp ../function-nodejs/dist/index.js artifacts/function-package/
cp ../function-nodejs/package.json artifacts/function-package/
cp ../function-nodejs/src/agent/system-prompt.md artifacts/function-package/
cd artifacts/function-package
zip -r -q ../function.zip .
cd ../..

echo "Function package created: artifacts/function.zip"
echo "Function size: $(du -h artifacts/function.zip | cut -f1)"

# Clean up temporary directories
rm -rf artifacts/package artifacts/function-package

echo ""
echo "Build complete!"
echo "Layer: deployment/artifacts/layer.zip"
echo "Function: deployment/artifacts/function.zip"
