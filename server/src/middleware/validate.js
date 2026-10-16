import { AppError } from '../errors/AppError.js';

export function validateBody(schema) {
  return function validateRequestBody(request, _response, next) {
    // Express 5 leaves `body` undefined when no JSON was sent; treat that as an empty object.
    const result = schema.safeParse(request.body ?? {});

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

/** Route parameters (e.g. `/:id`): malformed or out-of-range values are a 400, never a 500. */
export function validateParams(schema) {
  return function validateRequestParams(request, _response, next) {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'params',
        message: issue.message,
      }));

      next(
        new AppError(400, 'Identifier must be an integer between 1 and 2147483647.', {
          code: 'INVALID_ID',
          details,
        }),
      );
      return;
    }

    request.validatedParams = result.data;
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
