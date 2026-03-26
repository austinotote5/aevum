const jwt = require('jsonwebtoken');

const JWT_ISSUER = process.env.JWT_ISSUER || 'aevum-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'aevum-client';

const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return secret;
};

const signAuthToken = (user) => jwt.sign(
  {
    sub: user.id,
    email: user.email,
    plan: user.plan,
  },
  getJwtSecret(),
  {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256',
  }
);

const verifyAuthToken = (token) => jwt.verify(token, getJwtSecret(), {
  algorithms: ['HS256'],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
});

module.exports = {
  signAuthToken,
  verifyAuthToken,
};
