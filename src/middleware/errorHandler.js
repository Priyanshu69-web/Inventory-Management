import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Internal server error';
  let errors = error.errors;

  if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${error.path}`;
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
  } else if (error instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = error.issues.map(({ path, message: issueMessage }) => ({
      field: path.join('.'),
      message: issueMessage,
    }));
  } else if (error.code === 11000) {
    statusCode = 409;
    message = `${Object.keys(error.keyPattern || {})[0] || 'Resource'} already exists`;
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
  } else if (!(error instanceof ApiError) && statusCode === 500) {
    message = 'Internal server error';
  }

  const response = { success: false, message };
  if (errors) response.errors = errors;
  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}
