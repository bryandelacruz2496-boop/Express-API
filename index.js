const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files (UI)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from EKS! Thankyouawdaawdawdawdawdwdawd' });
});

app.listen(port, () => {
    console.log(`API running on port ${port}`);
});
