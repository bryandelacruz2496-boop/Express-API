import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json({ limit: '2mb' }));

// CORS — allow requests from any origin (for local dev)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const DATA_FILE = './data.json';

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

// WebSocket — clients connect to get real-time updates
wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected' }));
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Storage server running on http://0.0.0.0:${PORT}`);
});
