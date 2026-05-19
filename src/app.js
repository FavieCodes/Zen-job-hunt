const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes         = require('./auth/auth.routes');
const jobsRoutes         = require('./jobs/jobs.routes');
const scholarshipsRoutes = require('./scholarships/scholarships.routes');
const scraperRoutes      = require('./scraper/scraper.routes');
const errorHandler       = require('./common/errorHandler');

const app = express();

// Security and parsing
app.use(helmet());
app.use(express.json());

// Rate limiting — 100 requests per 15 minutes per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth',         authRoutes);
app.use('/api/jobs',         jobsRoutes);
app.use('/api/scholarships', scholarshipsRoutes);
app.use('/api/scraper',      scraperRoutes);

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;