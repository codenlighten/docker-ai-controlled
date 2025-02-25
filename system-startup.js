import { SystemOrchestrator } from './SystemManager.js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';

dotenv.config();

async function setupLogging() {
    const logDir = '/var/log/ai-system';
    const logFile = path.join(logDir, 'system-setup.log');
    
    try {
        await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
        console.error('Error creating log directory:', error);
    }

    return logFile;
}

async function main() {
    const logFile = await setupLogging();
    console.log(`Logging to ${logFile}`);

    const orchestrator = new SystemOrchestrator(process.env.OPENAI_API_KEY);
    
    try {
        // Initialize and analyze system
        console.log("Starting system analysis...");
        const analyses = await orchestrator.initialize();
        
        // Log initial analyses
        await fs.writeFile(
            logFile,
            `Initial System Analysis:\n${JSON.stringify(analyses, null, 2)}\n`,
            { flag: 'a' }
        );

        // Execute recommended commands
        console.log("Executing system setup commands...");
        await orchestrator.executeQueuedCommands();

        // Generate and log final report
        const report = await orchestrator.generateReport();
        await fs.writeFile(
            logFile,
            `\nFinal System Report:\n${JSON.stringify(report, null, 2)}\n`,
            { flag: 'a' }
        );

        console.log("System setup complete. Check logs at:", logFile);
    } catch (error) {
        console.error("Error during system setup:", error);
        await fs.writeFile(
            logFile,
            `\nError during setup:\n${error.stack}\n`,
            { flag: 'a' }
        );
    }
}

// Run the system setup
main().catch(console.error);
