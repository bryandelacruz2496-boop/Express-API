const express = require('express');
const app = express();
const port = 3000;

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from EKS! Thankyouawdawdawd' });
});

app.listen(port, () => {
    console.log(`API running on port ${port}`);
});
