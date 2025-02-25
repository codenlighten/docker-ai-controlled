#!/bin/bash

# Exit on any error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit 1
fi

# Create installation directory
INSTALL_DIR="/opt/ai-system"
mkdir -p $INSTALL_DIR

# Install Node.js and npm if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Copy files to installation directory
cp -r . $INSTALL_DIR/
cd $INSTALL_DIR

# Install dependencies
npm install

# Set up environment file
if [ ! -f .env ]; then
    echo "OPENAI_API_KEY=your-api-key-here" > .env
    echo "Please edit /opt/ai-system/.env and add your OpenAI API key"
fi

# Set up systemd service
cp ai-system.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ai-system

# Create log directory
mkdir -p /var/log/ai-system
chown -R root:root /var/log/ai-system

echo "Installation complete!"
echo "1. Edit /opt/ai-system/.env to add your OpenAI API key"
echo "2. Start the service with: systemctl start ai-system"
echo "3. View logs with: journalctl -u ai-system -f"
