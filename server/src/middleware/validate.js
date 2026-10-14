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

export function validateQuery(schema) {
  return function validateRequestQuery(request, _response, next) {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message,
      }));

      next(new AppError(400, 'Query validation failed.', { code: 'VALIDATION_ERROR', details }));
      return;
    }

    request.validatedQuery = result.data;
    next();
  };
}
