const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const files = {
    envExample: path.join(root, '.env.example'),
    envJs: path.join(root, 'src', 'config', 'env.js'),
    authRoutes: path.join(root, 'src', 'auth', 'auth.routes.js'),
    authController: path.join(root, 'src', 'auth', 'auth.controller.js'),
};

# patch .env.example
const envExampleText = fs.readFileSync(files.envExample, 'utf8');
fs.writeFileSync(files.envExample, envExampleText.replace(
    'JWT_SECRET=your_super_secret_jwt_key_change_this\nANTHROPIC_API_KEY=your_anthropic_api_key\n',
    'JWT_SECRET=your_super_secret_jwt_key_change_this\nJWT_REFRESH_SECRET=your_refresh_token_secret\nGOOGLE_CLIENT_ID=your_google_client_id\nANTHROPIC_API_KEY=your_anthropic_api_key\n'
), 'utf8');

# patch env.js
const envJsText = fs.readFileSync(files.envJs, 'utf8');
fs.writeFileSync(files.envJs, envJsText.replace(
    "const required = ['DATABASE_URL', 'JWT_SECRET', 'ANTHROPIC_API_KEY'];\nrequired.forEach((key) => {\n  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);\n});\n\nmodule.exports = {\n  port: process.env.PORT || 3000,\n  databaseUrl: process.env.DATABASE_URL,\n  redisUrl: process.env.REDIS_URL,\n  jwtSecret: process.env.JWT_SECRET,\n  anthropicKey: process.env.ANTHROPIC_API_KEY,\n};\n",
    "const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ANTHROPIC_API_KEY'];\nrequired.forEach((key) => {\n  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);\n});\n\nmodule.exports = {\n  port: process.env.PORT || 3000,\n  databaseUrl: process.env.DATABASE_URL,\n  redisUrl: process.env.REDIS_URL,\n  jwtSecret: process.env.JWT_SECRET,\n  refreshSecret: process.env.JWT_REFRESH_SECRET,\n  googleClientId: process.env.GOOGLE_CLIENT_ID,\n  anthropicKey: process.env.ANTHROPIC_API_KEY,\n};\n"
), 'utf8');

# patch auth.routes.js
text = files['auth_routes'].read_text()
text = text.replace("router.post('/signup', authController.signup);\nrouter.post('/login',  authController.login);\n",
                    "router.post('/signup', authController.signup);\nrouter.post('/login',  authController.login);\nrouter.post('/google', authController.googleLogin);\n")
fs.writeFileSync(files.authRoutes, text, 'utf8');

# patch auth.controller.js
text = files['auth_controller'].read_text()
text = text.replace("async function login(req, res, next) {\n  try {\n    const { email, password } = req.body;\n\n    if (!email || !password) {\n      return res.status(400).json({ error: 'email and password are required' });\n    }\n\n    const data = await authService.login(email, password);\n    res.json(data);\n  } catch (err) {\n    next(err);\n  }\n}\n\nmodule.exports = { signup, login };\n",
                    "async function login(req, res, next) {\n  try {\n    const { email, password } = req.body;\n\n    if (!email || !password) {\n      return res.status(400).json({ error: 'email and password are required' });\n    }\n\n    const data = await authService.login(email, password);\n    res.json(data);\n  } catch (err) {\n    next(err);\n  }\n}\n\nasync function googleLogin(req, res, next) {\n  try {\n    const { idToken } = req.body;\n    if (!idToken) {\n      return res.status(400).json({ error: 'idToken is required' });\n    }\n\n    const data = await authService.loginWithGoogle(idToken);\n    res.json(data);\n  } catch (err) {\n    next(err);\n  }\n}\n\nmodule.exports = { signup, login, googleLogin };\n")
fs.writeFileSync(files.authController, text, 'utf8');

console.log('patched files successfully');

print('patched files successfully')
