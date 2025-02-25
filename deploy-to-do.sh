#!/bin/bash

# Exit on error
set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo ".env file not found"
    exit 1
fi

# Check if DO token is set
if [ -z "$DO" ]; then
    echo "DigitalOcean token not found in .env file"
    exit 1
fi

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "OpenAI API key not found in .env file"
    exit 1
fi

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "doctl not found. Installing..."
    sudo snap install doctl
fi

# Authenticate with DigitalOcean using token from .env
echo "Authenticating with DigitalOcean..."
doctl auth init -t $DO

# Create temporary spec file with secrets
echo "Preparing deployment configuration..."
TMP_SPEC="temp_deployment_spec.yaml"
cp do-deployment.yaml "$TMP_SPEC"
sed -i "s|\${OPENAI_API_KEY}|$OPENAI_API_KEY|g" "$TMP_SPEC"

# Create app
echo "Creating DigitalOcean App..."
APP_CREATE_OUTPUT=$(doctl apps create --spec "$TMP_SPEC" --format ID --no-header)
APP_ID=$(echo "$APP_CREATE_OUTPUT" | tr -d '\n')

echo "App created with ID: $APP_ID"

# Clean up temporary file
rm "$TMP_SPEC"

# Deploy the app
echo "Deploying the application..."
doctl apps create-deployment $APP_ID

# Wait for deployment to complete
echo "Waiting for deployment to complete..."
sleep 10

# Get the app URL
APP_URL=$(doctl apps get $APP_ID --format DefaultIngress --no-header)
echo "Application deployed successfully!"
echo "Monitor interface available at: https://$APP_URL"
echo "API endpoint available at: https://$APP_URL/api"

# Show deployment logs
echo -e "\nShowing recent deployment logs:"
doctl apps logs $APP_ID
