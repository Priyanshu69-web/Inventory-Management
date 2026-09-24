import jwt from 'jsonwebtoken';

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
