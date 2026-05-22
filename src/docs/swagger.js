const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JobHunt Backend API',
      version: '1.0.0',
      description: 'API documentation for JobHunt backend',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' }
          }
        },
        ComponentStatus: {
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
            url: { type: 'string' },
            error: { type: 'string' }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'overall status: ok|degraded' },
            checks: { type: 'object', properties: { database: { $ref: '#/components/schemas/ComponentStatus' }, redis: { $ref: '#/components/schemas/ComponentStatus' } } },
            uptime: { type: 'number' },
            timestamp: { type: 'string' },
            responseTimeMs: { type: 'number' }
          }
        },
        SignupRequest: {
          type: 'object',
          properties: { email: { type: 'string' }, username: { type: 'string' }, password: { type: 'string' } },
          required: ['email','username','password']
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' }
              }
            }
          }
        },
        ForgotPasswordRequest: {
          type: 'object',
          properties: { email: { type: 'string' } },
          required: ['email']
        },
        ForgotPasswordResponse: { type: 'object', properties: { message: { type: 'string' } } },
        ResetPasswordOldRequest: {
          type: 'object',
          properties: { oldPassword: { type: 'string' }, newPassword: { type: 'string' }, confirmNewPassword: { type: 'string' } },
          required: ['oldPassword','newPassword','confirmNewPassword']
        },
        ResetPasswordTokenRequest: {
          type: 'object',
          properties: { token: { type: 'string' }, newPassword: { type: 'string' }, confirmNewPassword: { type: 'string' } },
          required: ['token','newPassword','confirmNewPassword']
        },
        ConfirmRegistrationResponse: { type: 'object', properties: { message: { type: 'string' } } },
        JobsList: {
          type: 'object',
          properties: {
            jobs: { type: 'array', items: { type: 'object' } },
            page: { type: 'number' },
            count: { type: 'number' }
          }
        },
        Job: { type: 'object' },
        ScholarshipsList: {
          type: 'object',
          properties: {
            scholarships: { type: 'array', items: { type: 'object' } },
            page: { type: 'number' },
            count: { type: 'number' }
          }
        },
        TriggerResponse: { type: 'object', properties: { message: { type: 'string' } } }
      }
    }
    ,
    tags: [
      { name: 'Authentication', description: 'Signup, login, social login and password management' },
      { name: 'Jobs', description: 'Job search and retrieval' },
      { name: 'Scholarships', description: 'Scholarship search' },
      { name: 'Scraper', description: 'Scraper control endpoints' },
      { name: 'Health', description: 'Health and status checks' }
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description: 'Returns health of the app and integrations',
          responses: {
            '200': { description: 'Healthy', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/signup': {
        post: {
          tags: ['Authentication'],
          summary: 'Create user',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } } },
          responses: {
            '201': { description: 'User created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/confirm': {
        get: {
          tags: ['Authentication'],
          summary: 'Confirm registration',
          description: 'Confirm a new registration using a token (e.g. link sent by email). Provide token as a query parameter `?token=...` or in Authorization header.',
          parameters: [{ name: 'token', in: 'query', required: true, schema: { type: 'string' }, description: 'Confirmation token sent via email' }],
          responses: {
            '200': { description: 'Confirmed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ConfirmRegistrationResponse' } } } },
            '400': { description: 'Invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/resend-confirmation': {
        post: {
          tags: ['Authentication'],
          summary: 'Resend confirmation email',
          description: 'Resend the email confirmation token to the given email if not already confirmed.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } } } },
          responses: {
            '200': { description: 'Confirmation email resent', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
            '400': { description: 'Validation error (e.g. already confirmed)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email','password'] } } } },
          responses: {
            '200': { description: 'Authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/google': {
        post: {
          tags: ['Authentication'],
          summary: 'Google social login',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { idToken: { type: 'string', description: 'Google ID token from client' } }, required: ['idToken'] } } } },
          responses: {
            '200': { description: 'Authenticated with Google', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Request password reset',
          description: 'Submit an email address. If an account exists an email with a reset link/token will be sent. Response does not reveal whether the account exists.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } } },
          responses: {
            '200': { description: 'Reset email queued', content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Change password (authenticated)',
          description: 'Change password by providing current (old) password and a new password. Old and new password must not be the same. This endpoint requires a valid Bearer token.',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordOldRequest' } } } },
          responses: {
            '200': { description: 'Password changed', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
            '400': { description: 'Validation error (e.g. new passwords do not match or are same as old)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/auth/reset-password/token': {
        post: {
          tags: ['Authentication'],
          summary: 'Reset password with token',
          description: 'Reset password using a token from email (for users who forgot password). Token + new password required. New password and confirm must match.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordTokenRequest' } } } },
          responses: {
            '200': { description: 'Password reset', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
            '400': { description: 'Invalid token or validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/jobs': {
        get: {
          tags: ['Jobs'],
          summary: 'Search jobs',
          parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Jobs list', content: { 'application/json': { schema: { $ref: '#/components/schemas/JobsList' } } } },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/jobs/{id}': {
        get: {
          tags: ['Jobs'],
          summary: 'Get job',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Job', content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/scholarships': {
        get: {
          tags: ['Scholarships'],
          summary: 'Search scholarships',
          parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Scholarships list', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScholarshipsList' } } } },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      },
      '/api/scraper/trigger': {
        post: {
          tags: ['Scraper'],
          summary: 'Trigger scraper (protected)',
          responses: {
            '200': { description: 'Triggered', content: { 'application/json': { schema: { $ref: '#/components/schemas/TriggerResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
          }
        }
      }
    }
  },
  apis: []
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
