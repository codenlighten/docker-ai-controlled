FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and essential packages
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    software-properties-common \
    sudo \
    vim \
    net-tools \
    iputils-ping \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /opt/ai-system

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create log directory
RUN mkdir -p /var/log/ai-system && \
    chmod 755 /var/log/ai-system

# Create a non-root user for running the application
RUN useradd -m -s /bin/bash aiuser && \
    echo "aiuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Switch to non-root user
USER aiuser

# Set environment variables
ENV NODE_ENV=production
ENV PATH=/opt/ai-system/node_modules/.bin:$PATH

# Command to run the application
CMD ["node", "system-startup.js"]
