FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and essential packages
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    net-tools \
    iputils-ping \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash node

# Create app directory and set permissions
WORKDIR /opt/ai-system
RUN chown -R node:node /opt/ai-system

# Switch to non-root user
USER node

# Copy package files with correct ownership
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm install

# Copy application files with correct ownership
COPY --chown=node:node . .

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
