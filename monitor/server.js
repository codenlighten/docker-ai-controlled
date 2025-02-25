import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

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
const bots = {
    SecGuard: { active: true, lastAction: Date.now() },
    PkgMaster: { active: true, lastAction: Date.now() },
    NetConfig: { active: true, lastAction: Date.now() },
    SvcControl: { active: true, lastAction: Date.now() },
    SysWatch: { active: true, lastAction: Date.now() }
};

// Update system stats
async function updateSystemStats() {
    try {
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

        io.emit('systemStats', systemStats);
    } catch (error) {
        console.error('Error updating system stats:', error);
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send initial data
    socket.emit('systemStats', systemStats);
    socket.emit('botStatus', {
        bots: Object.entries(bots).map(([name, status]) => ({
            name,
            active: status.active
        }))
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Update stats every 5 seconds
setInterval(updateSystemStats, 5000);

// Start server
const PORT = process.env.MONITOR_PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Monitor server running on port ${PORT}`);
});
