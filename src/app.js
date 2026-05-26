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
const adminRoutes        = require('./admin/admin.routes');
const errorHandler       = require('./common/errorHandler');

const app = express();
const cors = require('cors');

// Security and parsing
app.use(cors());
app.use(helmet());
app.use(express.json());

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting —
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
app.use('/api/admin',        adminRoutes);


app.use(errorHandler);

module.exports = app;