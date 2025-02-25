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
}

export { SystemOrchestrator, SystemBot, SystemCommand };
