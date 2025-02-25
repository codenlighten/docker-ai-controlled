import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class SandboxEnvironment {
    constructor(sandboxDir) {
        this.sandboxDir = sandboxDir;
        this.commandHistory = [];
        this.fileOperations = [];
    }

    async initialize() {
        try {
            await fs.mkdir(this.sandboxDir, { recursive: true });
            await fs.writeFile(
                path.join(this.sandboxDir, 'README.md'),
                'Sandbox Environment\n===================\n\nThis is a controlled environment for AI bot operations.'
            );
        } catch (error) {
            console.error('Failed to initialize sandbox:', error);
            throw error;
        }
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            // Add basic safety checks
            if (command.includes('rm -rf') || command.includes('sudo')) {
                reject(new Error('Unsafe command detected'));
                return;
            }

            // Add command validation
            const allowedCommands = ['ls', 'ps', 'df', 'uname', 'cat', 'echo', 'grep', 'head', 'tail', 'wc'];
            const commandBase = command.split(' ')[0];
            if (!allowedCommands.includes(commandBase)) {
                reject(new Error(`Command '${commandBase}' is not allowed in sandbox`));
                return;
            }

            exec(command, { cwd: this.sandboxDir }, (error, stdout, stderr) => {
                const result = {
                    command,
                    timestamp: new Date().toISOString(),
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    error: error ? error.message : null,
                    success: !error && !stderr.trim()
                };

                this.commandHistory.push(result);
                
                if (error && !result.stdout) {
                    reject(error);
                    return;
                }
                
                resolve(result);
            });
        });
    }

    async writeFile(filename, content) {
        const filePath = path.join(this.sandboxDir, filename);
        try {
            await fs.writeFile(filePath, content);
            this.fileOperations.push({
                operation: 'write',
                filename,
                timestamp: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error(`Failed to write file ${filename}:`, error);
            throw error;
        }
    }

    async readFile(filename) {
        const filePath = path.join(this.sandboxDir, filename);
        try {
            const content = await fs.readFile(filePath, 'utf8');
            this.fileOperations.push({
                operation: 'read',
                filename,
                timestamp: new Date().toISOString()
            });
            return content;
        } catch (error) {
            console.error(`Failed to read file ${filename}:`, error);
            throw error;
        }
    }

    async listFiles() {
        try {
            const files = await fs.readdir(this.sandboxDir);
            return files;
        } catch (error) {
            console.error('Failed to list files:', error);
            throw error;
        }
    }

    getCommandHistory() {
        return this.commandHistory;
    }

    getFileOperations() {
        return this.fileOperations;
    }
}

export { SandboxEnvironment };
