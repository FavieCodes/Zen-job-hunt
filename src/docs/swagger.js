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
      { url: 'https://zen-job-hunt.vercel.app', description: 'Production' },
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
            id:             { type: 'string', format: 'uuid' },
            email:          { type: 'string', format: 'email' },
            username:       { type: 'string' },
            is_confirmed:   { type: 'boolean' },
            role:           { type: 'string', enum: ['user', 'admin'] },
            avatar:         { type: 'string', nullable: true },
            is_google_user: { type: 'boolean', description: 'True if the account was created via Google OAuth' },
            created_at:     { type: 'string', format: 'date-time' },
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
            job_type:    { type: 'string', enum: ['full-time', 'part-time', 'contract', 'remote', 'internship'] },
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
            job_type:    { type: 'string', enum: ['full-time', 'part-time', 'contract', 'remote', 'internship'] },
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
            scraped_at:  { type: 'string', format: 'date-time' },
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
            jobs:  { type: 'array', items: { $ref: '#/components/schemas/Job' } },
            total: { type: 'integer', description: 'Total number of matching jobs' },
            page:  { type: 'integer', description: 'Current page number' },
            limit: { type: 'integer', description: 'Items per page' },
            pages: { type: 'integer', description: 'Total number of pages' },
          },
        },
        PaginatedScholarships: {
          type: 'object',
          properties: {
            scholarships: { type: 'array', items: { $ref: '#/components/schemas/Scholarship' } },
            total: { type: 'integer', description: 'Total number of matching scholarships' },
            page:  { type: 'integer', description: 'Current page number' },
            limit: { type: 'integer', description: 'Items per page' },
            pages: { type: 'integer', description: 'Total number of pages' },
          },
        },
        Application: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            job_id:     { type: 'string', format: 'uuid' },
            status:     { type: 'string', enum: ['pending', 'reviewed', 'accepted', 'rejected'] },
            created_at: { type: 'string', format: 'date-time' },
            title:      { type: 'string' },
            company:    { type: 'string' },
            country:    { type: 'string' },
            job_type:   { type: 'string' },
          },
        },
        ApplicationStats: {
          type: 'object',
          properties: {
            total:    { type: 'integer' },
            pending:  { type: 'integer' },
            reviewed: { type: 'integer' },
            accepted: { type: 'integer' },
            rejected: { type: 'integer' },
          },
        },
        InterviewPrep: {
          type: 'object',
          properties: {
            id:             { type: 'string', format: 'uuid' },
            user_id:        { type: 'string', format: 'uuid' },
            job_role:       { type: 'string' },
            interview_type: { type: 'string' },
            questions:      { type: 'array', items: { type: 'object' } },
            videos:         { type: 'array', items: { type: 'object' } },
            created_at:     { type: 'string', format: 'date-time' },
          },
        },
        InterviewPrepInput: {
          type: 'object',
          required: ['job_role', 'interview_type'],
          properties: {
            job_role:       { type: 'string', example: 'Frontend Developer' },
            interview_type: { type: 'string', example: 'Technical' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',                   description: 'Signup, login, social login and password management' },
      { name: 'User',                   description: 'User profile, applications, and saved jobs management' },
      { name: 'Jobs',                   description: 'Public job search and retrieval' },
      { name: 'Scholarships',           description: 'Public scholarship search' },
      { name: 'Admin/Jobs',             description: 'Admin — job management (requires admin token)' },
      { name: 'Admin/Scholarships',     description: 'Admin — scholarship management (requires admin token)' },
      { name: 'Scraper',                description: 'Scraper control (requires auth)' },
      { name: 'Interview',              description: 'AI Interview preparation generation and history (Groq, Gemini, Anthropic)' },
      { name: 'Health',                 description: 'Health and status checks' },
    ],
  },
  apis: [
    path.join(__dirname, '../auth/auth.routes.js'),
    path.join(__dirname, '../user/user.routes.js'),
    path.join(__dirname, '../jobs/jobs.routes.js'),
    path.join(__dirname, '../scholarships/scholarships.routes.js'),
    path.join(__dirname, '../admin/admin.routes.js'),
    path.join(__dirname, '../scraper/scraper.routes.js'),
    path.join(__dirname, '../interview/interview.routes.js'),
    path.join(__dirname, '../common/health.controller.js'),
  ],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;