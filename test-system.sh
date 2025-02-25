#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    echo "OPENAI_API_KEY=your-api-key-here" > .env
    echo "Please edit .env and add your OpenAI API key before proceeding."
    exit 1
fi

# Build and start the container
echo "Building and starting AI system container..."
docker-compose up --build -d

# Wait for system to initialize
echo "Waiting for system to initialize..."
sleep 5

# Display logs
echo "Displaying system logs (Ctrl+C to exit)..."
docker-compose logs -f
