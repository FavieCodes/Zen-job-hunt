const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = {
  envExample: path.join(root, '.env.example'),
  envJs: path.join(root, 'src', 'config', 'env.js'),
  authRoutes: path.join(root, 'src', 'auth', 'auth.routes.js'),
  authController: path.join(root, 'src', 'auth', 'auth.controller.js'),
};

function patchFile(filePath, transform) {
  const text = fs.readFileSync(filePath, 'utf8');
  const updated = transform(text);
  if (updated !== text) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`Patched ${filePath}`);
  } else {
    console.log(`No changes required for ${filePath}`);
  }
}

patchFile(files.envExample, (text) => text.replace(
  'JWT_SECRET=your_super_secret_jwt_key_change_this\nGOOGLE_CLIENT_ID=your_google_client_id\nANTHROPIC_API_KEY=your_anthropic_api_key\n',
  'JWT_SECRET=your_super_secret_jwt_key_change_this\nJWT_REFRESH_SECRET=your_refresh_token_secret\nGOOGLE_CLIENT_ID=your_google_client_id\nANTHROPIC_API_KEY=your_anthropic_api_key\n'
));

patchFile(files.envJs, (text) => text.replace(
  "const { jwtSecret, googleClientId } = require('../config/env');\n",
  "const { jwtSecret, refreshSecret, googleClientId } = require('../config/env');\n"
).replace(
  '  jwtSecret: process.env.JWT_SECRET,\n  googleClientId: process.env.GOOGLE_CLIENT_ID,\n',
  '  jwtSecret: process.env.JWT_SECRET,\n  refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,\n  googleClientId: process.env.GOOGLE_CLIENT_ID,\n'
));

patchFile(files.authRoutes, (text) => text.replace(
  "router.post('/signup', authController.signup);\nrouter.post('/login',  authController.login);\n",
  "router.post('/signup', authController.signup);\nrouter.post('/login',  authController.login);\nrouter.post('/google', authController.googleLogin);\n"
));

patchFile(files.authController, (text) => text.replace(
  "module.exports = { signup, login };\n",
  "module.exports = { signup, login, googleLogin };\n"
));

console.log('patch_google_auth.js finished');