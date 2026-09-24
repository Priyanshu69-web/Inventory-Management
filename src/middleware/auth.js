import User from '../modules/auth/auth.model.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';

export async function authenticate(req, _res, next) {
  const authorization = req.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }

  const payload = verifyToken(token);
  const user = await User.findById(payload.sub).select('_id name email');
  if (!user) {
    return next(new ApiError(401, 'User for this token no longer exists'));
  }

  req.user = user;
  return next();
}
