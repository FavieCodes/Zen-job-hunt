# JobHunt Backend API

The JobHunt Backend is a comprehensive REST API built with Node.js and Express. It powers a platform designed for job hunting, scholarship searching, and AI-powered interview preparation. The application is designed to be highly scalable and can be deployed easily on Vercel or any standard Node.js hosting platform.

## Features

- **Authentication**: JWT-based secure authentication including email/password login, Google OAuth integration, and password recovery.
- **Job Aggregation**: Browse, search, and manage job listings with support for web scraping external job sources.
- **Scholarships**: Discover and filter scholarship opportunities from around the globe.
- **AI Interview Coach**: Generate custom technical and behavioral interview preparation materials tailored to specific job roles using Anthropic's Claude AI.
- **Admin Dashboard APIs**: Full CRUD operations for managing platform content securely.
- **Swagger Documentation**: Interactive API documentation for easy frontend integration and testing.

## Technologies Used

- **Framework**: Express.js (Node.js)
- **Database**: PostgreSQL (using `pg` driver)
- **Authentication**: JWT & Google Auth Library
- **AI Integration**: Anthropic SDK (Claude 3)
- **Documentation**: Swagger UI & Swagger JSDoc
- **Deployment**: Vercel ready

## Prerequisites

Before running the project locally, ensure you have the following installed:
- Node.js (v18+)
- PostgreSQL (v14+)
- An active [Anthropic API](https://console.anthropic.com/) account for the interview feature.

## Environment Variables

Copy the `.env.example` file to `.env` and fill in the required values:

```env
# Server
PORT=8000

# Database
DATABASE_URL=postgres://user:password@localhost:5432/jobhunt

# JWT Auth
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1d

# AI Providers (Required for Interview Prep Module - Uses Fallback Cascade)
GROQ_API_KEY=gsk_xxxxxx
GEMINI_API_KEY=AIzaSyxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxx

# Google OAuth (Optional but recommended)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Email Service (For Confirmations & Resets)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_user
SMTP_PASS=your_pass
EMAIL_FROM=noreply@jobhunt.com
```

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run database migrations:**
   This will set up all required tables including `users`, `jobs`, `scholarships`, and `interview_prep`.
   ```bash
   npm run migrate
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server will start at `http://localhost:8000`.

## API Documentation

Once the server is running, you can access the interactive Swagger UI documentation at:
**[http://localhost:8000/docs](http://localhost:8000/docs)**

### Key Endpoints:
- `POST /api/auth/signup` - Register a new account
- `POST /api/auth/login` - Login to receive a JWT
- `GET /api/jobs` - Fetch paginated job listings
- `POST /api/interview/generate` - Generate AI interview questions (Requires Auth)

## AI Interview Preparation Module

The new Interview Prep module allows users to generate tailored practice questions. 

**Endpoint**: `POST /api/interview/generate`
**Payload Example**:
```json
{
  "job_role": "Frontend Developer",
  "interview_type": "Technical"
}
```
**Response**: Returns 5-7 specialized practice questions with tips, along with YouTube search URLs to find relevant mock interviews.

## License

This project is licensed under the ISC License.
