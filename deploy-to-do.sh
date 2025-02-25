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

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "doctl not found. Installing..."
    sudo snap install doctl
fi

# Authenticate with DigitalOcean using token from .env
echo "Authenticating with DigitalOcean..."
doctl auth init -t $DO

# Create app
echo "Creating DigitalOcean App..."
doctl apps create --spec do-deployment.yaml

# Get the app ID
APP_ID=$(doctl apps list --format ID --no-header | head -n 1)

# Add secrets
echo "Adding secrets..."
read -p "Enter your OpenAI API key: " OPENAI_API_KEY
doctl apps update $APP_ID --spec do-deployment.yaml --set-secret OPENAI_API_KEY=$OPENAI_API_KEY

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
