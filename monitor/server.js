import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static(path.join(__dirname)));

// System monitoring data
let systemStats = {
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 'Connected'
};

// Bot status tracking
const botStatus = {
    SecGuard: { active: true, lastAction: Date.now() },
    PkgMaster: { active: true, lastAction: Date.now() },
    NetConfig: { active: true, lastAction: Date.now() },
    SvcControl: { active: true, lastAction: Date.now() },
    SysWatch: { active: true, lastAction: Date.now() }
};

// Update system stats
async function updateSystemStats() {
    try {
        console.log('Updating system stats...');
        
        // CPU Usage
        const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
        systemStats.cpu = cpuUsage.toFixed(1);

        // Memory Usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
        systemStats.memory = memUsage;

        // Disk Usage
        exec('df -h / | tail -n 1 | awk \'{print $5}\'', (error, stdout) => {
            if (!error) {
                systemStats.disk = stdout.trim();
            }
        });

        // Network Status
        exec('ping -c 1 8.8.8.8', (error) => {
            systemStats.network = error ? 'Disconnected' : 'Connected';
        });

        // Read AI logs
        try {
            console.log('Reading AI logs...');
            const logContent = await fs.readFile('/var/log/ai-system/system-setup.log', 'utf8');
            console.log('Log content length:', logContent.length);
            io.emit('newLog', { 
                timestamp: new Date().toISOString(),
                message: logContent || 'No log content available'
            });
        } catch (error) {
            console.error('Error reading AI log:', error);
            io.emit('newLog', {
                timestamp: new Date().toISOString(),
                message: `Error reading logs: ${error.message}`
            });
        }

        // Emit updated stats
        console.log('Emitting system stats:', systemStats);
        io.emit('systemStats', systemStats);
    } catch (error) {
        console.error('Error updating system stats:', error);
    }
}

// Update stats every 5 seconds
setInterval(updateSystemStats, 5000);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send initial stats
    socket.emit('systemStats', systemStats);

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Monitor server running on port ${PORT}`);
});
