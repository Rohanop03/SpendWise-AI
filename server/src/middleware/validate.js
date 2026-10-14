import { AppError } from '../errors/AppError.js';

export function validateBody(schema) {
  return function validateRequestBody(request, _response, next) {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));

      next(new AppError(400, 'Request validation failed.', { code: 'VALIDATION_ERROR', details }));
      return;
    }

    request.validatedBody = result.data;
    next();
  };
}
