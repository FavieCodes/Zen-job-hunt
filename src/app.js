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

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors());

// ── Helmet  ────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'],
        styleSrc:    ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
        fontSrc:     ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
        imgSrc:      ["'self'", 'data:', 'validator.swagger.io', 'cdn.jsdelivr.net', '*.ui-avatars.com'],
        connectSrc:  ["'self'"],
        workerSrc:   ["'self'", 'blob:'],
      },
    },
  })
);

// ── Body parsing ─────────────────
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(morgan('combined', { stream: logger.stream }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip,
});
app.use(limiter);

// ── Health check ──────────────────────────────────────────────────────────────
const { health } = require('./common/health.controller');
app.get('/health', health);

app.get('/api-spec.json', (_req, res) => res.json(swaggerSpec));

// ── Swagger UI at /docs ───────────────────────────────────────────────────────
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: { persistAuthorization: true },
    customCss: '.swagger-ui .topbar { display: none }',
  })
);

// ── Static landing page ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/jobs',         jobsRoutes);
app.use('/api/scholarships', scholarshipsRoutes);
app.use('/api/scraper',      scraperRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/user',         userRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;