const router = require('express').Router();
const authController = require('./auth.controller');
const requireAuth = require('../common/authMiddleware');

router.post('/signup',                authController.signup);
router.post('/login',                 authController.login);
router.post('/logout',                authController.logout);   // ← new
router.post('/google',                authController.googleLogin);
router.post('/forgot-password',       authController.forgotPassword);
router.post('/reset-password',        requireAuth, authController.resetPasswordAuthenticated);
router.post('/reset-password/token',  authController.resetPasswordWithToken);
router.get('/confirm',                authController.confirmRegistration);
router.post('/resend-confirmation',   authController.resendConfirmation);
router.get('/me',                     requireAuth, authController.getMe);

module.exports = router;