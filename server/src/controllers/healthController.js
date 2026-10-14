export function getHealth(_request, response) {
  response.status(200).json({
    status: 'ok',
    service: 'spendwise-api',
  });
}

export function createDatabaseHealthHandler(healthService) {
  return async function getDatabaseHealth(_request, response) {
    try {
      await healthService.checkDatabase();

      response.status(200).json({
        status: 'ok',
        database: 'connected',
      });
    } catch {
      response.status(503).json({
        status: 'error',
        database: 'unavailable',
      });
    }
  };
}
