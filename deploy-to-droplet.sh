#!/bin/bash

# Configuration
DROPLET_NAME="ai-system"
REGION="nyc1"
SIZE="s-2vcpu-4gb"
IMAGE="ubuntu-22-04-x64"

# Create the droplet
echo "Creating droplet..."
DROPLET_ID=$(doctl compute droplet create $DROPLET_NAME \
  --region $REGION \
  --size $SIZE \
  --image $IMAGE \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header) \
  --wait \
  --format ID \
  --no-header)

echo "Waiting for droplet to be ready..."
sleep 60

# Get droplet IP
DROPLET_IP=$(doctl compute droplet get $DROPLET_ID --format PublicIPv4 --no-header)

# Copy files to droplet
echo "Copying files to droplet..."
scp -o StrictHostKeyChecking=no -r ../ai-communication root@$DROPLET_IP:/root/

# Install Docker and deploy
echo "Setting up Docker and deploying..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << 'EOF'
  # Install Docker
  apt-get update
  apt-get install -y docker.io
  systemctl start docker
  systemctl enable docker

  # Build and run the container
  cd /root/ai-communication
  docker build -t ai-system .
  docker run -d \
    --name ai-system \
    --privileged \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /sys:/sys \
    -v /var/log:/var/log \
    -p 8080:8080 \
    --restart always \
    ai-system
EOF

echo "Deployment complete!"
echo "AI System is available at: http://$DROPLET_IP:8080"
