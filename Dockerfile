FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive \
    NEEDRESTART_MODE=a \
    UCF_FORCE_CONFOLD=1 \
    NEEDRESTART_SUSPEND=1 \
    APT_LISTCHANGES_FRONTEND=none

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
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold" \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up system configurations and log files
RUN mkdir -p /etc/ai-system/configs \
    && mkdir -p /var/log/ai-system \
    && mkdir -p /opt/ai-system/scripts \
    && touch /var/log/ai-system/system-setup.log \
    && chmod 777 /var/log/ai-system \
    && chmod 666 /var/log/ai-system/system-setup.log

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
    MONITOR_PORT=3000

# Create a script to start the application
RUN echo '#!/bin/bash\n\
echo "Starting AI system with OpenAI API key: $OPENAI_API_KEY"\n\
touch /var/log/ai-system/system-setup.log\n\
chmod 666 /var/log/ai-system/system-setup.log\n\
exec npm start' > /opt/ai-system/start.sh && \
    chmod +x /opt/ai-system/start.sh

# Set the entrypoint
ENTRYPOINT ["/opt/ai-system/start.sh"]
