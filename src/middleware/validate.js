import { ApiError } from '../utils/ApiError.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const errors = result.error.issues.map(({ path, message }) => ({
        field: path.slice(1).join('.'),
        message,
      }));
      return next(new ApiError(422, 'Validation failed', errors));
    }

    req.validated = result.data;
    return next();
  };
}
