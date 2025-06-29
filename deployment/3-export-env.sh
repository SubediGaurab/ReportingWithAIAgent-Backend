#!/bin/bash
# Note: Don't use 'set -e' when this script is meant to be sourced

# This script loads environment variables from the .env file
# located in the project root directory (one level above this script).
# Usage: source ./3-export-env.sh

# Determine the directory where this script is located to reliably find the .env file.
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Construct the path to the .env file, assuming it's in the parent directory.
ENV_FILE="$SCRIPT_DIR/../.env"

# Check if the .env file exists at the calculated path.
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at the expected location: $ENV_FILE"
  if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    # Script is being sourced
    return 1
  else
    # Script is being executed
    exit 1
  fi
fi

# Export variables from .env file, handling special characters properly
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  if [[ ! "$key" =~ ^#.*$ ]] && [[ -n "$key" ]]; then
    # Remove quotes if present and export
    value="${value%\'}"
    value="${value#\'}"
    value="${value%\"}"
    value="${value#\"}"
    export "$key=$value"
    echo "Exported: $key"
  fi
done < <(grep -v '^#' "$ENV_FILE" | grep -v '^$')

echo "Environment variables from '$ENV_FILE' have been exported."