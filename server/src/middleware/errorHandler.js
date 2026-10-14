export function errorHandler(error, _request, response, _next) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : Number.isInteger(error.status)
      ? error.status
      : 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error(error);
  }

  const body = {
    status: 'error',
    message: statusCode === 500 ? 'Internal server error' : error.message,
  };

  if (error.code && statusCode < 500) {
    body.code = error.code;
  }

  if (error.details && statusCode < 500) {
    body.details = error.details;
  }

  response.status(statusCode).json(body);
}
