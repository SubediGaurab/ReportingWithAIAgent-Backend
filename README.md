# ReportingWithAIAgent-Backend

An AWS Lambda-based AI agent that generates Chart.js-compatible JSON from natural language prompts by querying a PostgreSQL database. The system uses Amazon Bedrock's inline agent functionality to interpret user requests and generate data visualizations.

## Architecture

The application follows a serverless architecture with these key components:

- **Lambda Handler** (`function/lambda_function.py`): Main entry point handling API Gateway requests
- **Inline Agent** (`function/agent/inline_agent.py`): Bedrock agent orchestration with tool specifications
- **SQL Tools** (`function/tools/sql_tools.py`): Database interaction layer with schema discovery and query execution
- **Manual Runner** (`manual_run.py`): Local testing utility for database operations

## Quick Start

### Environment Setup
```bash
# Create conda environment
conda env create -f environment.yml
conda activate ReportingWithAIAgent_env

# Install Python dependencies locally for development
pip install -r function/requirements.txt python-dotenv
```

### AWS Deployment
```bash
# Create S3 bucket for deployment artifacts
./deployment/1-create-bucket.sh

# Build Lambda layer with dependencies
./deployment/2-build-layer.sh

# Deploy CloudFormation stack
./deployment/3-deploy.sh
```

## Database Configuration

The application connects to a PostgreSQL database using environment variables:
- `user`: Database username
- `password`: Database password  
- `host`: Database host
- `port`: Database port
- `dbname`: Database name

For local development, create a `.env` file with these variables. In AWS, these should be configured as Lambda environment variables.

## Documentation

For detailed documentation, please refer to:
- [Architecture Documentation](docs/lambda-ai-chart-generation-architecture.md)
- [Product Requirements](docs/lambda-chart-generation-prd.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
