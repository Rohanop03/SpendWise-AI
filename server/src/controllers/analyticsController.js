export function createAnalyticsController(analyticsService) {
  return {
    async getOverview(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getFinancialOverview({
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        startDate: query.startDate,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getTrends(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getSpendingTrends({
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        interval: query.interval,
        startDate: query.startDate,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getCategories(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getCategoryAnalytics({
        categoryId: query.categoryId,
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        minAmount: query.minAmount,
        startDate: query.startDate,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getSubscriptions(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getSubscriptionAnalytics({
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        startDate: query.startDate,
        subscriptionId: query.subscriptionId,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getTopSubscriptions(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getTopSubscriptions({
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        limit: query.limit,
        startDate: query.startDate,
        type: query.type,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getBillingCycles(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getBillingCycleAnalytics({
        currencyCode: query.currencyCode,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getPaymentStatus(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getPaymentStatusAnalytics({
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        startDate: query.startDate,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getRefunds(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getRefundAnalytics({
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        limit: query.limit,
        startDate: query.startDate,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async getReport(request, response) {
      const query = request.validatedQuery || request.query;
      const result = await analyticsService.getCustomReport({
        categoryId: query.categoryId,
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        startDate: query.startDate,
        subscriptionId: query.subscriptionId,
        userId: request.user.id,
      });
      response.status(200).json(result);
    },

    async exportReportCsv(request, response) {
      const query = request.validatedQuery || request.query;
      const csv = await analyticsService.exportCustomReportCsv({
        categoryId: query.categoryId,
        currencyCode: query.currencyCode,
        endDate: query.endDate,
        startDate: query.startDate,
        subscriptionId: query.subscriptionId,
        userId: request.user.id,
      });

      const filename = `spendwise-report-${new Date().toISOString().slice(0, 10)}.csv`;
      response.setHeader('Content-Type', 'text/csv');
      response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      response.status(200).send(csv);
    },
  };
}
