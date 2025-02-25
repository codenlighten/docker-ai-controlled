import { CompressedAICommunicator } from './CompressedAICommunication.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateCompressedCommunication() {
    const communicator = new CompressedAICommunicator(process.env.OPENAI_API_KEY);

    // Example 1: Simple command processing
    console.log("\nExample 1: Processing simple commands");
    const response1 = await communicator.communicate("Activate Status Report");
    console.log("Response:", JSON.stringify(response1, null, 2));

    // Example 2: Hierarchical command processing
    console.log("\nExample 2: Processing hierarchical commands");
    const response2 = await communicator.processCommand(["C", "S", "R"]);
    console.log("Response:", JSON.stringify(response2, null, 2));
}

demonstrateCompressedCommunication().catch(console.error);
