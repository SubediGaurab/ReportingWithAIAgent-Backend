#!/bin/bash
set -eo pipefail

echo "Building Lambda function package..."

# Clean up artifacts
rm -rf artifacts/function.zip artifacts/function-package

# Navigate to function directory
cd ../function-nodejs

# Install all dependencies
echo "Installing dependencies..."
npm install

# Build with tsup (includes minification)
echo "Building function code..."
npm run build:prod

# Install only production dependencies
echo "Pruning dev dependencies..."
npm prune --production

# Create deployment package
echo "Creating function deployment package..."
cd ../deployment
mkdir -p artifacts/function-package

# Copy bundled code
cp ../function-nodejs/dist/index.js artifacts/function-package/
cp ../function-nodejs/dist/system-prompt.md artifacts/function-package/

# Copy package.json (required for ES modules)
cp ../function-nodejs/package.json artifacts/function-package/

# Copy node_modules (bundled approach)
cp -r ../function-nodejs/node_modules artifacts/function-package/

# Zip everything
cd artifacts/function-package
zip -r -q ../function.zip .
cd ../..

echo "Function package created: artifacts/function.zip"
echo "Function size: $(du -h artifacts/function.zip | cut -f1)"

# Cleanup
rm -rf artifacts/function-package

echo ""
echo "Build complete!"
