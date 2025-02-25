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

# Create necessary directories and files with proper permissions
echo "Setting up directories and log files..."
mkdir -p /var/log/ai-system
touch /var/log/ai-system/system-setup.log
chmod 777 /var/log/ai-system
chmod 666 /var/log/ai-system/system-setup.log

# Check for .env file and OpenAI API key
if [ ! -f .env ]; then
    echo "Creating .env file..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        echo "OPENAI_API_KEY=" > .env
        echo "NODE_ENV=production" >> .env
        echo "MONITOR_PORT=3000" >> .env
    fi
fi

# Prompt for OpenAI API key if not set
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    echo ""
    echo "OpenAI API key is required!"
    echo "Please enter your OpenAI API key (starts with 'sk-'):"
    read -r api_key
    if [[ $api_key == sk-* ]]; then
        # Export the API key to environment
        export OPENAI_API_KEY=$api_key
        # Update .env file
        sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$api_key/" .env
        echo "API key has been set!"
    else
        echo "Error: Invalid API key format. Must start with 'sk-'"
        exit 1
    fi
else
    # Export existing API key from .env
    export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d= -f2)
fi

# Build and start containers with environment variables
echo "Building and starting services..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check if services are running
echo "Checking services..."
sleep 5
if docker-compose ps | grep -q "ai-system"; then
    echo "AI System is running!"
    echo "Monitor available at: http://localhost:3000"
    echo "Dashboard available at: http://localhost:8080"
    echo ""
    echo "To view logs, run: sudo docker-compose logs -f"
    echo "To restart services, run: sudo docker-compose restart"
    echo "To stop services, run: sudo docker-compose down"
else
    echo "Error: Services failed to start. Check logs with: docker-compose logs"
fi
