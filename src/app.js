const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const logger = require('./common/logger');

const authRoutes         = require('./auth/auth.routes');
const jobsRoutes         = require('./jobs/jobs.routes');
const scholarshipsRoutes = require('./scholarships/scholarships.routes');
const scraperRoutes      = require('./scraper/scraper.routes');
const adminRoutes        = require('./admin/admin.routes');
const userRoutes         = require('./user/user.routes');
const errorHandler       = require('./common/errorHandler');

const app = express();
const cors = require('cors');

// Security and parsing
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com'],
        styleSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com'],
        fontSrc:    ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
        imgSrc:     ["'self'", 'data:', 'validator.swagger.io'],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(express.json({ limit: '3mb' })); 

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip;
  },
});
app.use(limiter);

// Health check
const { health } = require('./common/health.controller');
app.get('/health', health);

app.get('/api-spec.json', (req, res) => {
  res.json(swaggerSpec);
});

// Swagger UI 
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

// Serve the static landing page
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth',         authRoutes);
app.use('/api/jobs',         jobsRoutes);
app.use('/api/scholarships', scholarshipsRoutes);
app.use('/api/scraper',      scraperRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/user',         userRoutes);

app.use(errorHandler);

module.exports = app;