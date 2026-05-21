const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const logger = require('./common/logger');

const authRoutes         = require('./auth/auth.routes');
const jobsRoutes         = require('./jobs/jobs.routes');
const scholarshipsRoutes = require('./scholarships/scholarships.routes');
const scraperRoutes      = require('./scraper/scraper.routes');
const errorHandler       = require('./common/errorHandler');

const app = express();

// Security and parsing
app.use(helmet());
app.use(express.json());

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting — 100 requests per 15 minutes per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Health check (detailed)
const { health } = require('./common/health.controller');
app.get('/health', health);

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth',         authRoutes);
app.use('/api/jobs',         jobsRoutes);
app.use('/api/scholarships', scholarshipsRoutes);
app.use('/api/scraper',      scraperRoutes);

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;