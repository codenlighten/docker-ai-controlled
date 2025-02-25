FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and system administration packages
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    sudo \
    net-tools \
    iputils-ping \
    iproute2 \
    procps \
    htop \
    iotop \
    sysstat \
    dstat \
    lsof \
    tcpdump \
    strace \
    linux-tools-generic \
    python3 \
    python3-pip \
    ufw \
    iptables \
    systemd \
    docker.io \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up system configurations
RUN mkdir -p /etc/ai-system/configs \
    && mkdir -p /var/log/ai-system \
    && mkdir -p /opt/ai-system/scripts

# Set up application directory
WORKDIR /opt/ai-system

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Environment variables for configuration
ENV NODE_ENV=production \
    AI_SYSTEM_CONFIG=/etc/ai-system/configs \
    AI_SYSTEM_LOGS=/var/log/ai-system \
    AI_SYSTEM_SCRIPTS=/opt/ai-system/scripts \
    PATH="/opt/ai-system/scripts:${PATH}"

# Expose port
EXPOSE 8080

# Start the application with full privileges
USER root
CMD ["npm", "start"]
