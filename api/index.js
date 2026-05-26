const express = require('express');
const path = require('path');
const app = require('../src/app');
const logger = require('../src/common/logger');

// Serve static files from public directory
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

const { databaseUrl } = require('../src/config/env');

if (!databaseUrl) {
  logger.error('[Vercel] DATABASE_URL environment variable is missing!');
  logger.error('[Vercel] Please add it in your Vercel project settings');
}

// Health check endpoints
app.get('/api/vercel-health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    hasDbUrl: !!databaseUrl
  });
});

app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); 
});

module.exports = app;