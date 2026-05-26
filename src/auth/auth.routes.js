const router = require('express').Router();
const authController = require('./auth.controller');
const requireAuth = require('../common/authMiddleware');

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               username: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: Confirmation email sent, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Email or username already taken, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/signup', authController.signup);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Authenticated, content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       401: { description: Invalid credentials, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout (revoke tokens)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Logged out, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       400: { description: Access token required, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Login with Google
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: Google ID token from client }
 *     responses:
 *       200: { description: Authenticated, content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       401: { description: Invalid Google token, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/google', authController.googleLogin);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     description: Does not reveal whether the account exists.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Reset email sent if account exists, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password while authenticated
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword, confirmNewPassword]
 *             properties:
 *               oldPassword:        { type: string }
 *               newPassword:        { type: string, minLength: 8 }
 *               confirmNewPassword: { type: string }
 *     responses:
 *       200: { description: Password changed, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       400: { description: Passwords do not match or same as old, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/reset-password', requireAuth, authController.resetPasswordAuthenticated);

/**
 * @swagger
 * /api/auth/reset-password/token:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using email token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword, confirmNewPassword]
 *             properties:
 *               token:              { type: string }
 *               newPassword:        { type: string, minLength: 8 }
 *               confirmNewPassword: { type: string }
 *     responses:
 *       200: { description: Password reset, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       400: { description: Invalid or expired token, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/reset-password/token', authController.resetPasswordWithToken);

/**
 * @swagger
 * /api/auth/confirm:
 *   get:
 *     tags: [Auth]
 *     summary: Confirm email registration
 *     parameters:
 *       - { name: token, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Account confirmed + tokens returned, content: { application/json: { schema: { $ref: '#/components/schemas/AuthResponse' } } } }
 *       400: { description: Invalid or expired token, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/confirm', authController.confirmRegistration);

/**
 * @swagger
 * /api/auth/resend-confirmation:
 *   post:
 *     tags: [Auth]
 *     summary: Resend confirmation email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Confirmation email resent, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       400: { description: Already confirmed, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: User not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/resend-confirmation', authController.resendConfirmation);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user, content: { application/json: { schema: { $ref: '#/components/schemas/User' } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/me', requireAuth, authController.getMe);

module.exports = router;