import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
// Dedicated path so it doesn't clash with Vite's HMR socket in local dev.
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json({ limit: '2mb' }));

// CORS — allow requests from any origin (harmless when served same-origin).
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Data file location. Override with DATA_FILE (e.g. a Render persistent disk
// path like /var/data/data.json) to keep the game config across restarts.
const DATA_FILE = process.env.DATA_FILE || join(__dirname, 'data.json');

// Load or initialize data
let store = {};
if (existsSync(DATA_FILE)) {
    try { store = JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { store = {}; }
}

function persist() {
    try { writeFileSync(DATA_FILE, JSON.stringify(store), 'utf8'); } catch (e) { console.error('persist error:', e); }
}

// Broadcast to all connected WebSocket clients
function broadcast(msg) {
    const data = JSON.stringify(msg);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(data);
    });
}

// REST API — mimics window.storage interface
app.get('/api/storage/:key', (req, res) => {
    const val = store[req.params.key];
    if (val !== undefined) {
        res.json({ value: val });
    } else {
        res.json(null);
    }
});

app.post('/api/storage/:key', (req, res) => {
    const { value } = req.body;
    store[req.params.key] = value;
    persist();
    broadcast({ type: 'set', key: req.params.key, value });
    res.json({ ok: true });
});

app.delete('/api/storage/:key', (req, res) => {
    delete store[req.params.key];
    persist();
    broadcast({ type: 'delete', key: req.params.key });
    res.json({ ok: true });
});

app.get('/api/storage-list/:prefix', (req, res) => {
    const prefix = req.params.prefix;
    const keys = Object.keys(store).filter((k) => k.startsWith(prefix));
    res.json({ keys });
});

// The server's LAN IPv4 — used to build a phone-scannable guest QR URL when
// the dashboard is opened on localhost during local testing.
function getLanIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return null;
}

app.get('/api/lan-ip', (req, res) => {
    res.json({ ip: getLanIp() });
});

// WebSocket — clients connect to get real-time updates
wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected' }));
});

// Serve the built frontend (only present after `vite build`). In local dev the
// frontend is served by Vite, so this block is skipped.
const distDir = join(__dirname, 'dist');
if (existsSync(join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    // SPA fallback for any non-API route.
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(join(distDir, 'index.html'));
    });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
