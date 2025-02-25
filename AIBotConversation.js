import { CompressedAICommunicator } from './CompressedAICommunication.js';
import { SandboxEnvironment } from './SandboxEnvironment.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

class AIBot {
    constructor(name, role, apiKey, sandbox) {
        this.name = name;
        this.role = role;
        this.communicator = new CompressedAICommunicator(apiKey);
        this.sandbox = sandbox;
    }

    async executeInSandbox(command) {
        try {
            console.log(`\n${this.name} executing command: ${command}`);
            const result = await this.sandbox.executeCommand(command);
            
            // Process the command output
            const outputContext = {
                command: command,
                stdout: result.stdout,
                stderr: result.stderr,
                error: result.error,
                previous_commands: this.sandbox.getCommandHistory()
            };

            // Generate a response based on the command output
            const schema = {
                type: "object",
                properties: {
                    interpretation: { type: "string" },
                    success: { type: "boolean" },
                    next_action: { 
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["command", "write", "read", "none"] },
                            command: { type: "string" },
                            filename: { type: "string" },
                            content: { type: "string" },
                            reason: { type: "string" }
                        },
                        required: ["type", "reason"]
                    }
                },
                required: ["interpretation", "success", "next_action"]
            };

            const prompt = `As ${this.role} ${this.name}, analyze this command output:
            Command: ${command}
            Output: ${result.stdout}
            Errors: ${result.stderr || 'None'}
            
            Provide:
            1. A clear interpretation of the command results
            2. Whether the command was successful
            3. What action should be taken next, if any
            
            Consider:
            - If the output shows expected data
            - If there are any errors to address
            - If the data should be saved for reference
            - If additional commands would provide more context`;

            const analysis = await this.communicator.responseGenerator.generateStructuredResponse(
                prompt,
                schema,
                outputContext
            );

            console.log(`\n${this.name}'s analysis:`, JSON.stringify(analysis, null, 2));

            // Execute any follow-up actions
            if (analysis.success && analysis.next_action.type !== 'none') {
                switch (analysis.next_action.type) {
                    case 'command':
                        if (analysis.next_action.command) {
                            await this.executeInSandbox(analysis.next_action.command);
                        }
                        break;
                    case 'write':
                        if (analysis.next_action.filename && analysis.next_action.content) {
                            const logContent = `
Command: ${command}
Timestamp: ${new Date().toISOString()}
Output: ${result.stdout}
Analysis: ${analysis.interpretation}
Next Action: ${analysis.next_action.reason}
`;
                            await this.writeToSandbox(analysis.next_action.filename, logContent);
                        }
                        break;
                    case 'read':
                        if (analysis.next_action.filename) {
                            try {
                                await this.readFromSandbox(analysis.next_action.filename);
                            } catch (error) {
                                console.log(`Note: Could not read file ${analysis.next_action.filename}. This might be expected if the file doesn't exist yet.`);
                            }
                        }
                        break;
                }
            }

            return {
                ...result,
                analysis: analysis
            };
        } catch (error) {
            console.error(`${this.name} command execution error:`, error);
            // Return a structured error response
            return {
                stdout: '',
                stderr: error.message,
                error: error,
                analysis: {
                    interpretation: `Command execution failed: ${error.message}`,
                    success: false,
                    next_action: {
                        type: 'none',
                        reason: 'Error occurred, no further actions recommended until error is resolved.'
                    }
                }
            };
        }
    }

    async processResponse(response) {
        const schema = {
            type: "object",
            properties: {
                understanding: { type: "string" },
                action_taken: { type: "string" },
                reply: { type: "string" },
                sandbox_operations: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["command", "write", "read"] },
                            command: { type: "string" },
                            filename: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["type"]
                    }
                }
            },
            required: ["understanding", "action_taken", "reply"]
        };

        const context = {
            bot_name: this.name,
            bot_role: this.role,
            received_commands: response.commands,
            hierarchical_data: response.hierarchical_interpretation,
            sandbox_available: true,
            command_history: this.sandbox.getCommandHistory()
        };

        const prompt = `As ${this.role} ${this.name}, process these commands: ${JSON.stringify(response.commands)}. 
        Previous command history: ${JSON.stringify(context.command_history)}
        
        You have access to a sandbox environment where you can:
        1. Execute commands using type: "command"
        2. Write files using type: "write"
        3. Read files using type: "read"
        
        Based on the command history and current commands, generate appropriate sandbox operations.`;
        
        const aiResponse = await this.communicator.responseGenerator.generateStructuredResponse(
            prompt,
            schema,
            context
        );

        // Execute any sandbox operations specified in the response
        if (aiResponse.sandbox_operations) {
            for (const operation of aiResponse.sandbox_operations) {
                try {
                    switch (operation.type) {
                        case 'command':
                            if (operation.command) {
                                const result = await this.executeInSandbox(operation.command);
                                aiResponse.command_results = aiResponse.command_results || [];
                                aiResponse.command_results.push(result);
                            }
                            break;
                        case 'write':
                            if (operation.filename && operation.content) {
                                await this.writeToSandbox(operation.filename, operation.content);
                            }
                            break;
                        case 'read':
                            if (operation.filename) {
                                const content = await this.readFromSandbox(operation.filename);
                                aiResponse.sandbox_read_result = content;
                            }
                            break;
                    }
                } catch (error) {
                    console.error(`Failed to execute sandbox operation:`, error);
                    aiResponse.sandbox_error = error.message;
                }
            }
        }

        return aiResponse;
    }

    async writeToSandbox(filename, content) {
        try {
            await this.sandbox.writeFile(filename, content);
            console.log(`\n${this.name} wrote to file: ${filename}`);
        } catch (error) {
            console.error(`${this.name} file write error:`, error);
            throw error;
        }
    }

    async readFromSandbox(filename) {
        try {
            const content = await this.sandbox.readFile(filename);
            console.log(`\n${this.name} read from file: ${filename}`);
            return content;
        } catch (error) {
            console.error(`${this.name} file read error:`, error);
            throw error;
        }
    }

    async sendMessage(message) {
        console.log(`\n${this.name} (${this.role}) sends: "${message}"`);
        const response = await this.communicator.communicate(message);
        return response;
    }
}

class BotConversation {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        this.sandbox = new SandboxEnvironment(path.join(process.cwd(), 'sandbox'));
        this.commander = new AIBot("Alpha", "Commander", apiKey, this.sandbox);
        this.worker = new AIBot("Beta", "Worker", apiKey, this.sandbox);
    }

    async simulateConversation() {
        // Initialize sandbox
        await this.sandbox.initialize();
        
        console.log("\n=== Starting Bot Conversation with Sandbox Access ===");
        
        const initialCommands = [
            "Execute ls -la and analyze output",
            "Run system check using uname -a",
            "Check disk space with df -h",
            "Monitor processes with ps aux | head -n 5"
        ];

        for (const command of initialCommands) {
            const commanderResponse = await this.commander.sendMessage(command);
            console.log("Commander's structured output:", JSON.stringify(commanderResponse, null, 2));

            const workerProcessing = await this.worker.processResponse(commanderResponse);
            console.log("\nWorker's response:", JSON.stringify(workerProcessing, null, 2));

            const acknowledgment = await this.commander.processResponse({
                commands: [workerProcessing.reply],
                hierarchical_interpretation: [{
                    category: "Response",
                    commands: [workerProcessing.action_taken]
                }]
            });
            console.log("\nCommander's acknowledgment:", JSON.stringify(acknowledgment, null, 2));
            
            // Display sandbox state after each interaction
            console.log("\nSandbox State:");
            console.log("Files:", await this.sandbox.listFiles());
            console.log("Recent Commands:", this.sandbox.getCommandHistory().slice(-2));
            
            console.log("\n---");
        }
        
        console.log("\n=== Conversation Ended ===");
    }
}

// Run the conversation
const conversation = new BotConversation();
conversation.simulateConversation().catch(console.error);
