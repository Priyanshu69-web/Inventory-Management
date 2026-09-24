import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
}
