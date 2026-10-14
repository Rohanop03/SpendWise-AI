export function createHealthService(database) {
  return {
    async checkDatabase() {
      await database.query('SELECT 1');
    },
  };
}
