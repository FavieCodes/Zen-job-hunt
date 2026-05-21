const router = require('express').Router();
const authController = require('./auth.controller');

router.post('/signup', authController.signup);
router.post('/login',  authController.login);
router.post('/google', authController.googleLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPasswordAuthenticated);
router.post('/reset-password/token', authController.resetPasswordWithToken);
router.get('/confirm', authController.confirmRegistration);

module.exports = router;