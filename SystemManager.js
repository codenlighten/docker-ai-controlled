import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { CompressedAICommunicator } from './CompressedAICommunication.js';
import dotenv from 'dotenv';
import path from 'path';
import io from 'socket.io-client';

class SystemCommand {
    constructor(command, requiresSudo = false, category = 'general') {
        this.command = command;
        this.requiresSudo = requiresSudo;
        this.category = category;
        this.timestamp = new Date().toISOString();
        this.status = 'pending';
    }
}

class SystemBot {
    constructor(name, role, apiKey, specialization) {
        this.name = name;
        this.role = role;
        this.specialization = specialization;
        this.communicator = new CompressedAICommunicator(apiKey);
        this.commandHistory = [];
        this.lastAction = Date.now();
        this.active = true;
    }

    async analyzeSystem(context) {
        this.lastAction = Date.now();
        const schema = {
            type: "object",
            properties: {
                analysis: { type: "string" },
                recommendations: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            command: { type: "string" },
                            purpose: { type: "string" },
                            priority: { type: "integer" },
                            requires_sudo: { type: "boolean" },
                            category: { type: "string" }
                        }
                    }
                }
            },
            required: ["analysis", "recommendations"]
        };

        const prompt = `As ${this.role} specialized in ${this.specialization}, analyze the current system state:
        ${JSON.stringify(context, null, 2)}
        
        Provide:
        1. Analysis of the current state
        2. Recommended actions to improve or configure the system
        
        Focus on your specialization: ${this.specialization}`;

        const response = await this.communicator.responseGenerator.generateStructuredResponse(
            prompt,
            schema,
            context
        );

        // Emit the analysis to the monitoring interface
        if (this.monitor) {
            this.monitor.emit('newAction', {
                bot: this.name,
                timestamp: new Date().toISOString(),
                description: response.analysis
            });
        }

        return response;
    }
}

class SystemOrchestrator {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.bots = {
            security: new SystemBot("SecGuard", "Security Officer", apiKey, "system security"),
            packages: new SystemBot("PkgMaster", "Package Manager", apiKey, "package management"),
            network: new SystemBot("NetConfig", "Network Administrator", apiKey, "network configuration"),
            services: new SystemBot("SvcControl", "Service Manager", apiKey, "system services"),
            monitor: new SystemBot("SysWatch", "System Monitor", apiKey, "system monitoring")
        };
        this.commandQueue = [];
        this.systemState = {};
        
        // Connect to monitoring interface
        const monitorPort = process.env.MONITOR_PORT || 3000;
        this.monitor = io(`http://localhost:${monitorPort}`);
        
        // Set up monitoring for each bot
        Object.values(this.bots).forEach(bot => {
            bot.monitor = this.monitor;
        });

        // Start periodic status updates
        this.startStatusUpdates();
    }

    async startStatusUpdates() {
        setInterval(async () => {
            const systemInfo = await this.gatherSystemInfo();
            this.monitor.emit('systemStats', {
                cpu: systemInfo.cpu_info,
                memory: systemInfo.memory,
                disk: systemInfo.disk,
                network: systemInfo.network
            });

            // Update bot status
            const botStatus = Object.entries(this.bots).map(([name, bot]) => ({
                name,
                active: bot.active,
                lastAction: bot.lastAction
            }));
            this.monitor.emit('botStatus', { bots: botStatus });
        }, 5000);
    }

    async gatherSystemInfo() {
        const commands = {
            os_info: "cat /etc/os-release",
            kernel: "uname -a",
            memory: "free -h",
            disk: "df -h",
            network: "ip addr show",
            packages: "dpkg -l | wc -l",
            services: "systemctl list-units --type=service --state=running",
            users: "who",
            cpu_info: "lscpu | grep 'Model name'",
            load_avg: "uptime"
        };

        const info = {};
        for (const [key, cmd] of Object.entries(commands)) {
            try {
                const { stdout } = await this.executeCommand(cmd);
                info[key] = stdout;
                
                // Log command execution
                this.monitor.emit('newLog', {
                    timestamp: new Date().toISOString(),
                    message: `Gathered ${key} information`
                });
            } catch (error) {
                info[key] = `Error: ${error.message}`;
                
                // Log error
                this.monitor.emit('newLog', {
                    timestamp: new Date().toISOString(),
                    message: `Error gathering ${key}: ${error.message}`
                });
            }
        }
        return info;
    }

    async executeCommand(command, requiresSudo = false) {
        return new Promise((resolve, reject) => {
            const cmd = requiresSudo ? `sudo ${command}` : command;
            exec(cmd, (error, stdout, stderr) => {
                if (error && !stdout) {
                    this.monitor.emit('newLog', {
                        timestamp: new Date().toISOString(),
                        message: `Command error: ${error.message}`
                    });
                    reject(error);
                    return;
                }
                
                this.monitor.emit('newLog', {
                    timestamp: new Date().toISOString(),
                    message: `Executed: ${command}`
                });
                
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
            });
        });
    }

    async initialize() {
        console.log("Initializing System Orchestrator...");
        
        // Gather initial system state
        this.systemState = await this.gatherSystemInfo();
        
        // Have each bot analyze the system
        const analyses = {};
        for (const [role, bot] of Object.entries(this.bots)) {
            const analysis = await bot.analyzeSystem(this.systemState);
            analyses[role] = analysis;
            
            // Add recommended commands to the queue
            if (analysis.recommendations) {
                analysis.recommendations.forEach(rec => {
                    this.commandQueue.push(
                        new SystemCommand(rec.command, rec.requires_sudo, rec.category)
                    );
                });
            }
        }

        // Sort command queue by priority
        this.commandQueue.sort((a, b) => a.priority - b.priority);
        
        return analyses;
    }

    async executeQueuedCommands() {
        console.log("Executing queued commands...");
        
        for (const cmd of this.commandQueue) {
            try {
                console.log(`\nExecuting: ${cmd.command}`);
                const result = await this.executeCommand(cmd.command, cmd.requiresSudo);
                cmd.status = 'completed';
                cmd.result = result;
                
                // Update system state
                this.systemState = await this.gatherSystemInfo();
                
                // Have relevant bot analyze the result
                const bot = this.getBotForCategory(cmd.category);
                if (bot) {
                    const analysis = await bot.analyzeSystem({
                        ...this.systemState,
                        last_command: cmd,
                        last_result: result
                    });
                    console.log(`\n${bot.name}'s analysis:`, JSON.stringify(analysis, null, 2));
                }
            } catch (error) {
                console.error(`Error executing ${cmd.command}:`, error);
                cmd.status = 'failed';
                cmd.error = error.message;
                
                this.monitor.emit('newLog', {
                    timestamp: new Date().toISOString(),
                    message: `Command failed: ${cmd.command} - ${error.message}`
                });
            }
        }
    }

    getBotForCategory(category) {
        const categoryMap = {
            security: this.bots.security,
            packages: this.bots.packages,
            network: this.bots.network,
            services: this.bots.services,
            monitoring: this.bots.monitor,
            general: this.bots.monitor
        };
        return categoryMap[category] || this.bots.monitor;
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            system_state: this.systemState,
            executed_commands: this.commandQueue,
            bot_analyses: {}
        };

        for (const [role, bot] of Object.entries(this.bots)) {
            report.bot_analyses[role] = await bot.analyzeSystem({
                ...this.systemState,
                command_history: this.commandQueue
            });
        }

        // Log report generation
        this.monitor.emit('newLog', {
            timestamp: new Date().toISOString(),
            message: 'Generated system report'
        });

        return report;
    }

    async logToFile(message) {
        try {
            const logFile = '/var/log/ai-system/system-setup.log';
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] ${message}\n`;
            
            await this.rotateLogsIfNeeded(logFile);
            await fs.appendFile(logFile, logMessage);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    async rotateLogsIfNeeded(logFile) {
        try {
            const stats = await fs.stat(logFile);
            if (stats.size >= 1024 * 1024) { // 1MB
                // Read the current log content
                const content = await fs.readFile(logFile, 'utf8');
                
                // Split into lines and keep the most recent 75% of the content
                const lines = content.split('\n');
                const linesToKeep = Math.floor(lines.length * 0.75);
                const newContent = lines.slice(-linesToKeep).join('\n');

                // Backup the old log
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = `${logFile}.${timestamp}`;
                await fs.rename(logFile, backupFile);

                // Create new log file with the most recent content
                await fs.writeFile(logFile, newContent, { mode: 0o666 });

                // Clean up old rotated logs
                const dir = path.dirname(logFile);
                const files = await fs.readdir(dir);
                const rotatedLogs = files
                    .filter(f => f.startsWith(path.basename(logFile) + '.'))
                    .map(f => path.join(dir, f))
                    .sort()
                    .reverse();

                // Keep only the specified number of rotated logs
                for (let i = 5; i < rotatedLogs.length; i++) {
                    await fs.unlink(rotatedLogs[i]);
                }
            }
        } catch (error) {
            console.error('Error rotating logs:', error);
        }
    }

    async ensureLogFileExists() {
        try {
            const logFile = '/var/log/ai-system/system-setup.log';
            if (!(await fs.exists(logFile))) {
                await fs.writeFile(logFile, '', { mode: 0o666 });
            }
            // Ensure proper permissions even if file exists
            await fs.chmod(logFile, 0o666);
        } catch (error) {
            console.error('Error creating/setting permissions for log file:', error);
        }
    }
}

class SystemManager {
    constructor(apiKey) {
        this.communicator = new CompressedAICommunicator(apiKey);
        this.logFile = '/var/log/ai-system/system-setup.log';
        this.maxLogSize = 1024 * 1024; // 1MB
        this.rotatedLogsToKeep = 5;
        this.ensureLogFileExists();
    }

    async ensureLogFileExists() {
        try {
            if (!fsSync.existsSync(this.logFile)) {
                await fs.writeFile(this.logFile, '', { mode: 0o666 });
            }
            await fs.chmod(this.logFile, 0o666);
        } catch (error) {
            console.error('Error creating/setting permissions for log file:', error);
        }
    }

    async rotateLogsIfNeeded() {
        try {
            const stats = await fs.stat(this.logFile);
            if (stats.size >= this.maxLogSize) {
                const content = await fs.readFile(this.logFile, 'utf8');
                const lines = content.split('\n');
                const linesToKeep = Math.floor(lines.length * 0.75);
                const newContent = lines.slice(-linesToKeep).join('\n');

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = `${this.logFile}.${timestamp}`;
                await fs.rename(this.logFile, backupFile);
                await fs.writeFile(this.logFile, newContent, { mode: 0o666 });

                const dir = path.dirname(this.logFile);
                const files = await fs.readdir(dir);
                const rotatedLogs = files
                    .filter(f => f.startsWith(path.basename(this.logFile) + '.'))
                    .map(f => path.join(dir, f))
                    .sort()
                    .reverse();

                for (let i = this.rotatedLogsToKeep; i < rotatedLogs.length; i++) {
                    await fs.unlink(rotatedLogs[i]);
                }
            }
        } catch (error) {
            console.error('Error rotating logs:', error);
        }
    }

    async logToFile(message) {
        try {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] ${message}\n`;
            await this.rotateLogsIfNeeded();
            await fs.appendFile(this.logFile, logMessage);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    async handleInteractivePrompt(prompt, command, previousOutput) {
        try {
            // Prepare context for AI analysis
            const context = {
                prompt: prompt,
                command: command,
                previousOutput: previousOutput,
                systemState: {
                    command_history: this.commandHistory || [],
                    current_operation: command.split(' ')[0],
                    is_package_management: command.includes('apt') || command.includes('dpkg'),
                    is_system_update: command.includes('upgrade') || command.includes('update'),
                    is_service_management: command.includes('service') || command.includes('systemctl'),
                }
            };

            // Get AI recommendation
            const response = await this.communicator.getPromptResponse({
                role: "system",
                content: `You are a system administrator reviewing an interactive prompt from a terminal command. 
                         Based on the context, determine the appropriate response.
                         Context: ${JSON.stringify(context, null, 2)}
                         
                         Respond with one of:
                         1. "y" - Yes, proceed with the action
                         2. "n" - No, do not proceed
                         3. "d" - Use default option
                         4. "k" - Keep existing configuration
                         5. null - No response needed
                         
                         Only respond with one of these exact values.`
            });

            await this.logToFile(`AI analyzed prompt "${prompt}" for command "${command}" and recommended: ${response}`);
            return response;
        } catch (error) {
            await this.logToFile(`Error getting AI recommendation: ${error.message}`);
            return 'y'; // Default to yes if AI analysis fails
        }
    }

    async executeCommand(command) {
        await this.logToFile(`Executing: ${command}`);
        
        return new Promise((resolve, reject) => {
            // Track command history
            this.commandHistory = this.commandHistory || [];
            this.commandHistory.push(command);
            if (this.commandHistory.length > 10) {
                this.commandHistory.shift();
            }

            // Set environment variables to prevent most interactive prompts
            const env = {
                ...process.env,
                DEBIAN_FRONTEND: 'noninteractive',
                NEEDRESTART_MODE: 'a',
                UCF_FORCE_CONFOLD: '1',
                NEEDRESTART_SUSPEND: '1',
                APT_LISTCHANGES_FRONTEND: 'none'
            };

            // Add options to prevent common interactive prompts
            const modifiedCommand = command.replace(
                /apt\s+(update|upgrade|install|dist-upgrade)/,
                '$& -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"'
            );

            const proc = spawn('bash', ['-c', modifiedCommand], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env
            });

            let output = '';
            let error = '';
            let currentPrompt = '';

            proc.stdout.on('data', async (data) => {
                const text = data.toString();
                output += text;
                await this.logToFile(`Output: ${text}`);
                
                // Check for prompts in stdout
                if (text.includes('[Y/n]') || text.includes('[y/N]') || 
                    text.includes('(Y/I/N/O/D/Z)') || text.includes('[default=N]')) {
                    currentPrompt = text;
                    const response = await this.handleInteractivePrompt(text, command, output);
                    if (response) {
                        proc.stdin.write(`${response}\n`);
                    }
                }
            });

            proc.stderr.on('data', async (data) => {
                const text = data.toString();
                error += text;
                await this.logToFile(`Error: ${text}`);

                // Check for prompts in stderr
                if (text.includes('[Y/n]') || text.includes('[y/N]') || 
                    text.includes('(Y/I/N/O/D/Z)') || text.includes('[default=N]')) {
                    currentPrompt = text;
                    const response = await this.handleInteractivePrompt(text, command, error);
                    if (response) {
                        proc.stdin.write(`${response}\n`);
                    }
                }
            });

            proc.on('close', async (code) => {
                await this.logToFile(`Command completed with code: ${code}`);
                if (code === 0) {
                    resolve({ output, error });
                } else {
                    reject(new Error(`Command failed with code ${code}: ${error}`));
                }
            });
        });
    }

    async analyzeSystem() {
        try {
            await this.logToFile('Starting system analysis...');
            await this.logToFile('Initializing System Orchestrator...');
            
            const commands = [
                'DEBIAN_FRONTEND=noninteractive apt update',
                'DEBIAN_FRONTEND=noninteractive apt upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"',
                'ufw enable',
                'DEBIAN_FRONTEND=noninteractive apt install fail2ban -y'
            ];

            await this.logToFile('Executing system setup commands...');
            await this.logToFile('Executing queued commands...\n');

            for (const command of commands) {
                try {
                    await this.logToFile(`\nExecuting: ${command}\n`);
                    const response = await this.communicator.getSystemAnalysis();
                    await this.logToFile(`\nSysWatch's analysis: ${JSON.stringify(response, null, 2)}\n`);
                } catch (error) {
                    await this.logToFile(`Error executing command ${command}: ${error.message}`);
                }
            }
        } catch (error) {
            await this.logToFile(`Error in system analysis: ${error.message}`);
            throw error;
        }
    }
}

export { SystemOrchestrator, SystemBot, SystemCommand, SystemManager };
