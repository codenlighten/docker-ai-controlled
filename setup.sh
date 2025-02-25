#!/bin/bash

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (use sudo)"
  exit 1
fi

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    apt-get update
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.5.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create necessary directories
echo "Setting up directories..."
mkdir -p logs
chmod 755 logs

# Check for .env file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Please edit .env and add your OpenAI API key"
    else
        echo "OPENAI_API_KEY=" > .env
        echo "NODE_ENV=production" >> .env
        echo "MONITOR_PORT=3000" >> .env
        echo "Please edit .env and add your OpenAI API key"
    fi
fi

# Build and start containers
echo "Building and starting services..."
docker-compose build
docker-compose up -d

# Check if services are running
echo "Checking services..."
sleep 5
if docker-compose ps | grep -q "ai-system"; then
    echo "AI System is running!"
    echo "Monitor available at: http://localhost:3000"
    echo "Dashboard available at: http://localhost:8080"
else
    echo "Error: Services failed to start. Check logs with: docker-compose logs"
fi
