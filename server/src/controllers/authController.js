import {
  createClearRefreshCookieOptions,
  createRefreshCookieOptions,
  refreshCookieName,
} from '../utils/authCookie.js';

function sendAuthentication(response, result, cookieSecure, statusCode = 200) {
  response.cookie(
    refreshCookieName,
    result.refreshToken,
    createRefreshCookieOptions({ maxAge: result.refreshTokenMaxAge, secure: cookieSecure }),
  );
  response.status(statusCode).json({ accessToken: result.accessToken, user: result.user });
}

export function createAuthController({ authService, cookieSecure }) {
  return {
    changePassword: async (request, response) => {
      const result = await authService.changePassword(request.user.id, request.validatedBody);
      response.clearCookie(
        refreshCookieName,
        createClearRefreshCookieOptions({ secure: cookieSecure }),
      );
      response.status(200).json(result);
    },

    login: async (request, response) => {
      const result = await authService.login(request.validatedBody);
      sendAuthentication(response, result, cookieSecure);
    },

    logout: async (request, response) => {
      await authService.logout(request.cookies[refreshCookieName]);
      response.clearCookie(
        refreshCookieName,
        createClearRefreshCookieOptions({ secure: cookieSecure }),
      );
      response.status(200).json({ message: 'Logged out.' });
    },

    me: async (request, response) => {
      response.status(200).json({ user: request.user });
    },

    refresh: async (request, response) => {
      const result = await authService.refresh(request.cookies[refreshCookieName]);
      sendAuthentication(response, result, cookieSecure);
    },

    register: async (request, response) => {
      const result = await authService.register(request.validatedBody);
      sendAuthentication(response, result, cookieSecure, 201);
    },
  };
}
