import { AppError } from '../errors/AppError.js';

// PostgreSQL errors that reach the handler are mapped to client errors with fixed wording;
// driver messages (which can contain SQL or values) are never sent to the client.
const constraintMessages = {
  fk_payment_history_subscription_currency:
    'The currency of a subscription cannot change once payments are recorded.',
};

function fromDatabaseError(error) {
  switch (error.code) {
    case '23001':
    case '23503':
      return new AppError(
        400,
        constraintMessages[error.constraint] ?? 'A referenced record does not exist.',
        { code: 'INVALID_REFERENCE' },
      );
    case '23505':
      return new AppError(409, 'That record already exists.', { code: 'CONFLICT' });
    case '23514':
    case '23502':
      return new AppError(400, 'A value does not satisfy the data rules.', {
        code: 'CONSTRAINT_VIOLATION',
      });
    case '22P02':
    case '22003':
    case '22007':
    case '22008':
      return new AppError(400, 'A value has an invalid format or is out of range.', {
        code: 'INVALID_VALUE',
      });
    default:
      return null;
  }
}

function fromBodyParserError(error) {
  if (error.type === 'entity.parse.failed') {
    return new AppError(400, 'Malformed JSON body.', { code: 'MALFORMED_JSON' });
  }
  if (error.type === 'entity.too.large') {
    return new AppError(413, 'Request body is too large.', { code: 'PAYLOAD_TOO_LARGE' });
  }
  if (typeof error.type === 'string' && Number.isInteger(error.status) && error.status < 500) {
    return new AppError(error.status, 'The request body could not be read.', {
      code: 'INVALID_BODY',
    });
  }
  return null;
}

export function errorHandler(error, _request, response, _next) {
  const mapped =
    error instanceof AppError ? error : (fromBodyParserError(error) ?? fromDatabaseError(error));
  const statusCode = mapped?.statusCode ?? 500;

  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    console.error(error);
  }

  const body = {
    status: 'error',
    message: statusCode >= 500 ? 'Internal server error' : mapped.message,
  };

  if (mapped?.code && statusCode < 500) {
    body.code = mapped.code;
  }

  if (mapped?.details && statusCode < 500) {
    body.details = mapped.details;
  }

  response.status(statusCode).json(body);
}
