const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JobHunt Backend API',
      version: '1.0.0',
      description: 'API documentation for JobHunt backend',
    },
    servers: [
      { url: 'http://localhost:8000', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        MessageResponse: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        User: {
          type: 'object',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            email:        { type: 'string', format: 'email' },
            username:     { type: 'string' },
            is_confirmed: { type: 'boolean' },
            role:         { type: 'string', enum: ['user', 'admin'] },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string' },
            refreshToken: { type: 'string' },
            user:         { $ref: '#/components/schemas/User' },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            title:       { type: 'string' },
            company:     { type: 'string' },
            description: { type: 'string' },
            country:     { type: 'string' },
            state:       { type: 'string' },
            city:        { type: 'string' },
            job_type:    { type: 'string', enum: ['full-time','part-time','contract','remote','internship'] },
            salary:      { type: 'string' },
            apply_url:   { type: 'string', format: 'uri' },
            source_url:  { type: 'string', format: 'uri' },
            source_name: { type: 'string' },
            posted_at:   { type: 'string', format: 'date-time' },
            scraped_at:  { type: 'string', format: 'date-time' },
            is_active:   { type: 'boolean' },
          },
        },
        JobInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title:       { type: 'string' },
            company:     { type: 'string' },
            description: { type: 'string' },
            country:     { type: 'string' },
            state:       { type: 'string' },
            city:        { type: 'string' },
            job_type:    { type: 'string', enum: ['full-time','part-time','contract','remote','internship'] },
            salary:      { type: 'string' },
            apply_url:   { type: 'string', format: 'uri' },
            source_url:  { type: 'string', format: 'uri' },
            posted_at:   { type: 'string', format: 'date-time' },
            is_active:   { type: 'boolean' },
          },
        },
        Scholarship: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            title:       { type: 'string' },
            provider:    { type: 'string' },
            description: { type: 'string' },
            country:     { type: 'string' },
            field:       { type: 'string' },
            deadline:    { type: 'string', format: 'date' },
            amount:      { type: 'string' },
            apply_url:   { type: 'string', format: 'uri' },
            source_url:  { type: 'string', format: 'uri' },
            posted_at:   { type: 'string', format: 'date-time' },
            is_active:   { type: 'boolean' },
          },
        },
        ScholarshipInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title:       { type: 'string' },
            provider:    { type: 'string' },
            description: { type: 'string' },
            country:     { type: 'string' },
            field:       { type: 'string' },
            deadline:    { type: 'string', format: 'date' },
            amount:      { type: 'string' },
            apply_url:   { type: 'string', format: 'uri' },
            source_url:  { type: 'string', format: 'uri' },
            posted_at:   { type: 'string', format: 'date-time' },
            is_active:   { type: 'boolean' },
          },
        },
        BulkCreateResponse: {
          type: 'object',
          properties: {
            created: { type: 'integer' },
            skipped: { type: 'integer' },
            errors:  { type: 'array', items: { type: 'object' } },
          },
        },
        PaginatedJobs: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page:  { type: 'integer' },
            limit: { type: 'integer' },
            pages: { type: 'integer' },
            jobs:  { type: 'array', items: { $ref: '#/components/schemas/Job' } },
          },
        },
        PaginatedScholarships: {
          type: 'object',
          properties: {
            total:        { type: 'integer' },
            page:         { type: 'integer' },
            limit:        { type: 'integer' },
            pages:        { type: 'integer' },
            scholarships: { type: 'array', items: { $ref: '#/components/schemas/Scholarship' } },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',         description: 'Signup, login, social login and password management' },
      { name: 'Jobs',         description: 'Public job search and retrieval' },
      { name: 'Scholarships', description: 'Public scholarship search' },
      { name: 'Admin/Jobs',         description: 'Admin — job management (requires admin token)' },
      { name: 'Admin/Scholarships', description: 'Admin — scholarship management (requires admin token)' },
      { name: 'Scraper',      description: 'Scraper control (requires auth)' },
      { name: 'Health',       description: 'Health and status checks' },
    ],
  },
  // ← THIS is what makes it auto-update: point at all route files.
  // swagger-jsdoc scans these for /** @swagger */ JSDoc comments.
  apis: [
    path.join(__dirname, '../auth/auth.routes.js'),
    path.join(__dirname, '../jobs/jobs.routes.js'),
    path.join(__dirname, '../scholarships/scholarships.routes.js'),
    path.join(__dirname, '../admin/admin.routes.js'),
    path.join(__dirname, '../scraper/scraper.routes.js'),
    path.join(__dirname, '../common/health.controller.js'),
  ],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;