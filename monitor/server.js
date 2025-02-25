import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as si from 'systeminformation';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const logFile = '/var/log/ai-system/system-setup.log';
const port = process.env.MONITOR_PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

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

async function getSystemStats() {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const disk = await si.fsSize();
        const network = await si.networkInterfaces();

        return {
            cpu: cpu.currentLoad.toFixed(1),
            memory: ((mem.used / mem.total) * 100).toFixed(1),
            disk: disk[0] ? `${Math.round(disk[0].use)}%` : 'N/A',
            network: network[0] && network[0].operstate === 'up' ? 'Connected' : 'Disconnected'
        };
    } catch (error) {
        console.error('Error getting system stats:', error);
        return { error: 'Failed to get system stats' };
    }
}

async function readLatestLogs() {
    try {
        // Get all log files (current and rotated)
        const dir = path.dirname(logFile);
        const files = await fs.readdir(dir);
        const logFiles = [logFile, ...files
            .filter(f => f.startsWith(path.basename(logFile) + '.'))
            .map(f => path.join(dir, f))
            .sort()
            .reverse()
        ];

        let combinedContent = '';
        let totalSize = 0;
        const maxSize = 100 * 1024; // Read up to 100KB of logs

        // Read from each log file until we reach maxSize
        for (const file of logFiles) {
            if (fsSync.existsSync(file)) {
                const content = await fs.readFile(file, 'utf8');
                combinedContent = content + '\n' + combinedContent;
                totalSize += content.length;
                
                if (totalSize >= maxSize) {
                    break;
                }
            }
        }

        console.log('Log content length:', combinedContent.length);
        return combinedContent;
    } catch (error) {
        console.error('Error reading AI log:', error);
        return '';
    }
}

async function updateSystemStats() {
    try {
        console.log('Updating system stats...');
        const stats = await getSystemStats();
        const logs = await readLatestLogs();
        console.log('Reading AI logs...');
        console.log('Log content length:', logs.length);
        console.log('Emitting system stats:', stats);
        io.emit('systemStats', stats);
        io.emit('newLog', { 
            timestamp: new Date().toISOString(),
            message: logs || 'No log content available'
        });
    } catch (error) {
        console.error('Error updating system stats:', error);
    }
}

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
httpServer.listen(port, () => {
    console.log(`Monitor server running on port ${port}`);
});

// Update stats every 5 seconds
setInterval(updateSystemStats, 5000);
