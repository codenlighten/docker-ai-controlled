# AI System Monitor

A Docker-based AI system monitoring solution that provides system analysis, security recommendations, and real-time monitoring capabilities.

## Prerequisites

- Ubuntu (20.04 or later)
- Sudo privileges
- OpenAI API key (starts with 'sk-')

## Quick Start

1. Download and extract the package:
   ```bash
   unzip ai-system-dist.zip
   cd ai-system
   ```

2. Run the setup script:
   ```bash
   sudo ./setup.sh
   ```
   The script will:
   - Install Docker and Docker Compose if needed
   - Set up necessary directories and permissions
   - Prompt for your OpenAI API key
   - Build and start the services

## System Components

The system consists of two main services:
1. **AI System** (Port 3000):
   - Handles AI analysis and system monitoring
   - Generates security recommendations
   - Processes system events

2. **Monitor Dashboard** (Port 8080):
   - Real-time system statistics
   - Log viewing and analysis
   - Service status monitoring

## Directory Structure

```
.
├── Dockerfile              # Main AI system container
├── Dockerfile.monitor      # Monitor service container
├── docker-compose.yml      # Service orchestration
├── monitor/               # Monitor service code
├── .env                   # Environment configuration
└── /var/log/ai-system/    # System logs (created during setup)
```

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `NODE_ENV`: Environment (production/development)
- `MONITOR_PORT`: Port for the monitor service

### Log Management

The system implements automatic log rotation with these features:
- Maximum log file size: 1MB
- Retains 5 most recent log archives
- Preserves 75% of most recent log content during rotation
- Log files are stored in `/var/log/ai-system/`
- Rotated logs are named: `system-setup.log.<timestamp>`

## Common Commands

1. View logs:
   ```bash
   sudo docker-compose logs -f
   ```

2. Restart services:
   ```bash
   sudo docker-compose restart
   ```

3. Stop services:
   ```bash
   sudo docker-compose down
   ```

4. Start services:
   ```bash
   sudo docker-compose up -d
   ```

5. View system logs:
   ```bash
   sudo ls -l /var/log/ai-system/
   sudo cat /var/log/ai-system/system-setup.log
   ```

## Troubleshooting

### OpenAI API Key Issues

If you see "OpenAI API key is required":
1. Check your .env file:
   ```bash
   cat .env
   ```
2. Make sure the key starts with 'sk-'
3. Restart the services:
   ```bash
   sudo docker-compose restart
   ```

### Log File Issues

If you see "Error reading AI log":
1. Check log directory permissions:
   ```bash
   ls -l /var/log/ai-system/
   ```
2. Recreate log file with proper permissions:
   ```bash
   sudo touch /var/log/ai-system/system-setup.log
   sudo chmod 666 /var/log/ai-system/system-setup.log
   ```
3. View available log archives:
   ```bash
   ls -l /var/log/ai-system/system-setup.log.*
   ```

### Container Issues

If containers keep restarting:
1. Check container logs:
   ```bash
   sudo docker-compose logs
   ```
2. Verify API key is set correctly
3. Check log file permissions
4. Try rebuilding:
   ```bash
   sudo docker-compose down
   sudo docker-compose build --no-cache
   sudo docker-compose up -d
   ```

## Security Notes

1. The system requires privileged access for some features
2. Log files are world-readable/writable (666)
3. Secure your OpenAI API key
4. Consider network security when exposing ports
5. Log rotation helps prevent disk space issues

## Maintenance

1. Update the system:
   ```bash
   git pull
   sudo docker-compose build --no-cache
   sudo docker-compose up -d
   ```

2. Clean up:
   ```bash
   sudo docker-compose down
   sudo docker system prune
   ```

3. Manage logs:
   ```bash
   # View current log size
   ls -lh /var/log/ai-system/system-setup.log

   # List archived logs
   ls -lh /var/log/ai-system/system-setup.log.*

   # Clean up old archives (if needed)
   sudo rm /var/log/ai-system/system-setup.log.*
   ```

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Review container logs
3. Verify all prerequisites are met
4. Ensure proper permissions
5. Check log rotation status

## License

[Your chosen license]
