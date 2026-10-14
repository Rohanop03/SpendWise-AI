import { AppError } from '../errors/AppError.js';

export function createAccountService(repository) {
  return {
    async getPreferences(userId) {
      const preferences = await repository.getPreferences(userId);

      if (!preferences) {
        throw new AppError(404, 'Account preferences were not found.', {
          code: 'PREFERENCES_NOT_FOUND',
        });
      }

      return preferences;
    },

    async updatePreferences(userId, updates) {
      const preferences = await repository.updatePreferences(userId, updates);

      if (!preferences) {
        throw new AppError(404, 'Account preferences were not found.', {
          code: 'PREFERENCES_NOT_FOUND',
        });
      }

      return preferences;
    },

    async updateProfile(userId, updates) {
      const user = await repository.updateProfile(userId, updates);

      if (!user) {
        throw new AppError(404, 'Active account was not found.', { code: 'ACCOUNT_NOT_FOUND' });
      }

      return user;
    },
  };
}
