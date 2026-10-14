export function errorHandler(error, _request, response, _next) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error(error);
  }

  response.status(statusCode).json({
    status: 'error',
    message: statusCode === 500 || isProduction ? 'Internal server error' : error.message,
  });
}
