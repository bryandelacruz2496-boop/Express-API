import './storage-mock.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import PartyGuessLeaderboard from './PartyGuessLeaderboard.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <PartyGuessLeaderboard />
    </React.StrictMode>
);
