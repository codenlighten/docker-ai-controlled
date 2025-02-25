import { StructuredResponseGenerator } from './StructuredResponseGenerator.js';

class CompressedLanguage {
    constructor() {
        // Initialize with basic command tokens
        this.tokenDictionary = {
            "A": { command: "Activate", priority: 1 },
            "D": { command: "Deactivate", priority: 1 },
            "S": { command: "Status", priority: 1 },
            "R": { command: "Report", priority: 2 },
            "C": { command: "Command", priority: 1 },
            "E": { command: "Execute", priority: 2 },
            "I": { command: "Inform", priority: 3 },
            "U": { command: "Update", priority: 2 },
            "L": { command: "List", priority: 1 },
            "M": { command: "Monitor", priority: 2 },
            "CH": { command: "Check", priority: 1 }
        };

        // Track usage for adaptive learning
        this.usageFrequency = {};

        // Hierarchical structure
        this.hierarchy = {
            "C": { "Command": { "A": "Activate", "D": "Deactivate", "E": "Execute" } },
            "S": { "Status": { "R": "Report", "CH": "Check" } },
            "M": { "Monitor": { "L": "List", "CH": "Check" } }
        };
    }

    compress(command) {
        // Handle shell commands directly
        if (command.includes(' ')) {
            return command;
        }

        // Find token for a given command
        for (const [token, data] of Object.entries(this.tokenDictionary)) {
            if (data.command.toLowerCase() === command.toLowerCase()) {
                this.trackUsage(token);
                return token;
            }
        }
        return command;  // Return original if no compression found
    }

    decompress(token) {
        if (this.tokenDictionary[token]) {
            this.trackUsage(token);
            return this.tokenDictionary[token].command;
        }
        return token;  // Return original if no decompression found
    }

    trackUsage(token) {
        if (this.tokenDictionary[token]) {
            this.usageFrequency[token] = (this.usageFrequency[token] || 0) + 1;
            this.optimizeTokens();
        }
    }

    optimizeTokens() {
        Object.entries(this.usageFrequency).forEach(([token, frequency]) => {
            if (frequency > 5 && this.tokenDictionary[token]) {
                this.tokenDictionary[token].priority = 
                    Math.max(1, this.tokenDictionary[token].priority - 1);
            }
        });
    }

    processHierarchicalCommand(tokens) {
        const results = [];
        tokens.forEach(token => {
            // Skip processing for shell commands
            if (token.includes(' ')) {
                results.push({
                    category: "Shell",
                    commands: [token]
                });
                return;
            }

            if (this.hierarchy[token]) {
                const commandGroup = this.hierarchy[token];
                for (const [category, subCommands] of Object.entries(commandGroup)) {
                    results.push({
                        category,
                        commands: Object.values(subCommands)
                    });
                }
            }
        });
        return results;
    }

    addNewToken(token, command, priority = 3) {
        if (!this.tokenDictionary[token]) {
            this.tokenDictionary[token] = { command, priority };
            return true;
        }
        return false;
    }
}

class CompressedAICommunicator {
    constructor(apiKey) {
        this.language = new CompressedLanguage();
        this.responseGenerator = new StructuredResponseGenerator(apiKey);
    }

    async processCommand(tokens) {
        // Handle shell commands
        const commands = tokens.map(t => this.language.decompress(t));
        
        // Get hierarchical interpretation
        const hierarchicalCommands = this.language.processHierarchicalCommand(tokens);

        // Create schema for AI response
        const schema = {
            type: "object",
            properties: {
                commands: {
                    type: "array",
                    items: { type: "string" }
                },
                hierarchical_interpretation: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            category: { type: "string" },
                            commands: { 
                                type: "array",
                                items: { type: "string" }
                            }
                        }
                    }
                },
                response_action: { type: "string" }
            },
            required: ["commands", "hierarchical_interpretation", "response_action"]
        };

        // Generate AI response
        const response = await this.responseGenerator.generateStructuredResponse(
            commands.join(" "),
            schema,
            { hierarchicalCommands }
        );

        return response;
    }

    compressMessage(message) {
        if (!message) return [];
        
        // Handle shell commands
        if (message.includes('ls -') || message.includes('uname') || 
            message.includes('df -') || message.includes('ps ')) {
            return [message];
        }

        const words = message.toLowerCase().split(" ");
        const tokens = [];
        
        let i = 0;
        while (i < words.length) {
            // Try to match multi-word commands first
            let found = false;
            for (let len = 3; len > 0; len--) {
                const phrase = words.slice(i, i + len).join(" ");
                const token = this.language.compress(phrase);
                if (token) {
                    tokens.push(token);
                    i += len;
                    found = true;
                    break;
                }
            }
            if (!found) {
                i++;
            }
        }
        return tokens;
    }

    async communicate(message) {
        if (!message) {
            throw new Error("Message is required");
        }
        
        const compressedTokens = this.compressMessage(message);
        return await this.processCommand(compressedTokens);
    }
}

export { CompressedLanguage, CompressedAICommunicator };
