export function createNotificationController(service) {
  return {
    countUnread: async (request, response) => {
      response.status(200).json({ count: await service.countUnread(request.user.id) });
    },
    list: async (request, response) => {
      response.status(200).json(await service.list(request.user.id, request.validatedQuery));
    },
    markAllRead: async (request, response) => {
      response.status(200).json(await service.markAllRead(request.user.id));
    },
    markRead: async (request, response) => {
      response.status(200).json({
        notification: await service.markRead(request.user.id, request.params.id),
      });
    },
  };
}
