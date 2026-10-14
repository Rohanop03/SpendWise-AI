export function createAccountController(accountService) {
  return {
    getPreferences: async (request, response) => {
      const preferences = await accountService.getPreferences(request.user.id);
      response.status(200).json({ preferences });
    },
    updatePreferences: async (request, response) => {
      const preferences = await accountService.updatePreferences(
        request.user.id,
        request.validatedBody,
      );
      response.status(200).json({ preferences });
    },
    updateProfile: async (request, response) => {
      const user = await accountService.updateProfile(request.user.id, request.validatedBody);
      response.status(200).json({ user });
    },
  };
}
