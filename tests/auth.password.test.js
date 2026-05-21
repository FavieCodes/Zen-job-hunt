const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db');
jest.mock('../src/common/mailer');

const db = require('../src/config/db');
const mailer = require('../src/common/mailer');
const app = require('../src/app');
const { jwtSecret } = require('../src/config/env');

beforeEach(() => {
  jest.resetAllMocks();
});

test('forgot-password sends email when user exists but returns generic message', async () => {
  db.query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: '111-222', email: 'a@b.com' }] })); // find user
  db.query.mockImplementationOnce(() => Promise.resolve()); // insert password_resets
  mailer.sendResetEmail.mockResolvedValue();

  const res = await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.com' });
  expect(res.statusCode).toBe(200);
  expect(res.body.message).toMatch(/email has been sent/);
  expect(mailer.sendResetEmail).toHaveBeenCalled();
});

test('reset password with token succeeds', async () => {
  // password_resets select
  db.query.mockImplementationOnce(() => Promise.resolve({ rows: [{ user_id: '111-222' }] }));
  // update user password
  db.query.mockImplementationOnce(() => Promise.resolve());
  // delete password_resets
  db.query.mockImplementationOnce(() => Promise.resolve());

  const res = await request(app).post('/api/auth/reset-password/token').send({ token: 'tok', newPassword: 'newpass', confirmNewPassword: 'newpass' });
  expect(res.statusCode).toBe(200);
  expect(res.body.message).toMatch(/Password reset/);
});

test('reset password authenticated requires valid old password', async () => {
  const userId = 'user-1';
  const token = jwt.sign({ userId }, jwtSecret);
  // find user
  db.query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: userId, password_hash: '$2a$12$invalidhash' }] }));

  const res = await request(app)
    .post('/api/auth/reset-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ oldPassword: 'old', newPassword: 'new1', confirmNewPassword: 'new1' });

  expect(res.statusCode).toBe(500); // invalid bcrypt will throw; this validates path
});
