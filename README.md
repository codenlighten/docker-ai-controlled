# AI System Monitor

A Docker-based AI system monitoring solution that provides system analysis, security recommendations, and real-time monitoring capabilities.

## Prerequisites

- Ubuntu (20.04 or later)
- Docker and Docker Compose
- OpenAI API key

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ai-communication.git
   cd ai-communication
   ```

2. Create and configure the environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

3. Start the system:
   ```bash
   docker-compose up -d
   ```

The system will be available at:
- AI System Monitor: http://localhost:3000
- System Analysis Dashboard: http://localhost:8080

## Directory Structure

```
.
├── Dockerfile              # Main AI system Dockerfile
├── Dockerfile.monitor      # Monitor service Dockerfile
├── docker-compose.yml      # Docker Compose configuration
├── monitor/               # Monitor service code
├── logs/                  # System logs directory
└── .env                   # Environment configuration
```

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `NODE_ENV`: Environment (production/development)
- `MONITOR_PORT`: Port for the monitor service (default: 3000)

### Docker Compose Configuration

The system uses two services:
1. `ai-system`: Main AI analysis system
2. `monitor`: Real-time monitoring dashboard

## Features

- Real-time system monitoring
- AI-powered system analysis
- Security recommendations
- Service management
- Resource usage tracking
- Bot status monitoring

## Logs

System logs are stored in the `logs` directory and mounted to `/var/log/ai-system` in the container.

## Security Notes

1. The system requires privileged access for some features
2. Secure your OpenAI API key
3. Consider network security when exposing ports

## Troubleshooting

1. If services fail to start:
   ```bash
   docker-compose logs
   ```

2. To restart services:
   ```bash
   docker-compose restart
   ```

3. To completely reset:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

## Maintenance

1. Update the system:
   ```bash
   git pull
   docker-compose build --no-cache
   docker-compose up -d
   ```

2. Clean up old containers:
   ```bash
   docker-compose down
   docker system prune
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

[Your chosen license]
