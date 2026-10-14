function mapSubscription(row) {
  if (!row) {
    return null;
  }

  return {
    archivedAt: row.archived_at,
    billingCycle: row.billing_cycle,
    cancelledAt: row.cancelled_at,
    categoryId: String(row.category_id),
    categoryName: row.category_name ?? null,
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    customServiceName: row.custom_service_name ?? null,
    id: String(row.id),
    nextRenewalDate: row.next_renewal_date ?? null,
    notes: row.notes ?? null,
    planName: row.plan_name ?? null,
    price: Number(row.price),
    serviceId: row.service_id ? String(row.service_id) : null,
    serviceName: row.service_name ?? row.custom_service_name,
    serviceWebsiteUrl: row.service_website_url ?? null,
    startDate: row.start_date,
    status: row.status,
    trialEndDate: row.trial_end_date ?? null,
    updatedAt: row.updated_at,
    userId: String(row.user_id),
  };
}

const baseSubscriptionSelect = `
  SELECT
    s.id,
    s.user_id,
    s.service_id,
    s.custom_service_name,
    COALESCE(svc.name, s.custom_service_name) AS service_name,
    s.category_id,
    cat.name AS category_name,
    svc.website_url AS service_website_url,
    s.plan_name,
    s.price,
    s.currency_code,
    s.billing_cycle,
    s.status,
    s.start_date::text AS start_date,
    s.next_renewal_date::text AS next_renewal_date,
    s.trial_end_date::text AS trial_end_date,
    s.cancelled_at,
    s.archived_at,
    s.notes,
    s.created_at,
    s.updated_at
  FROM subscriptions AS s
  LEFT JOIN services AS svc ON svc.id = s.service_id
  JOIN categories AS cat ON cat.id = s.category_id
`;

const sortFieldMap = {
  createdAt: 's.created_at',
  nextRenewalDate: 's.next_renewal_date',
  price: 's.price',
  serviceName: 'LOWER(COALESCE(svc.name, s.custom_service_name))',
  startDate: 's.start_date',
};

export function createSubscriptionRepository(database) {
  return {
    async categoryExists(categoryId) {
      const result = await database.query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
      return result.rowCount > 0;
    },

    async serviceExists(serviceId) {
      const result = await database.query(
        'SELECT 1 FROM services WHERE id = $1 AND is_active = TRUE',
        [serviceId],
      );
      return result.rowCount > 0;
    },

    async createSubscription(input) {
      const isCancelled = input.status === 'cancelled';
      const result = await database.query(
        `
          INSERT INTO subscriptions (
            user_id,
            service_id,
            custom_service_name,
            category_id,
            plan_name,
            price,
            currency_code,
            billing_cycle,
            status,
            start_date,
            next_renewal_date,
            trial_end_date,
            cancelled_at,
            notes
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            CASE WHEN $13 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
            $14
          )
          RETURNING id
        `,
        [
          input.userId,
          input.serviceId ?? null,
          input.customServiceName ?? null,
          input.categoryId,
          input.planName ?? null,
          input.price,
          input.currencyCode,
          input.billingCycle,
          input.status ?? 'active',
          input.startDate,
          input.nextRenewalDate ?? null,
          input.trialEndDate ?? null,
          isCancelled,
          input.notes ?? null,
        ],
      );

      return this.findById({ id: result.rows[0].id, userId: input.userId });
    },

    async findById({ id, userId }) {
      const result = await database.query(
        `
          ${baseSubscriptionSelect}
          WHERE s.id = $1 AND s.user_id = $2
        `,
        [id, userId],
      );

      return mapSubscription(result.rows[0]);
    },

    async listSubscriptions({
      archived = 'false',
      billingCycle,
      categoryId,
      limit = 10,
      page = 1,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      userId,
    }) {
      const conditions = ['s.user_id = $1'];
      const params = [userId];

      if (archived === 'false') {
        conditions.push('s.archived_at IS NULL');
      } else if (archived === 'true') {
        conditions.push('s.archived_at IS NOT NULL');
      }

      if (status) {
        params.push(status);
        conditions.push(`s.status = $${params.length}`);
      }

      if (categoryId) {
        params.push(categoryId);
        conditions.push(`s.category_id = $${params.length}`);
      }

      if (billingCycle) {
        params.push(billingCycle);
        conditions.push(`s.billing_cycle = $${params.length}`);
      }

      if (search && search.trim().length > 0) {
        params.push(`%${search.trim()}%`);
        conditions.push(
          `(COALESCE(svc.name, s.custom_service_name) ILIKE $${params.length} OR s.plan_name ILIKE $${params.length})`,
        );
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Count query
      const countResult = await database.query(
        `
          SELECT COUNT(*)::int AS total
          FROM subscriptions AS s
          LEFT JOIN services AS svc ON svc.id = s.service_id
          ${whereClause}
        `,
        params,
      );

      const totalCount = countResult.rows[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const validatedPage = Math.min(Math.max(1, page), totalPages);
      const offset = (validatedPage - 1) * limit;

      const orderColumn = sortFieldMap[sortBy] || 's.created_at';
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const nullsOrdering = orderColumn === 's.next_renewal_date' ? ` NULLS LAST` : '';

      const queryParams = [...params, limit, offset];
      const dataQuery = `
        ${baseSubscriptionSelect}
        ${whereClause}
        ORDER BY ${orderColumn} ${orderDirection}${nullsOrdering}, s.id ${orderDirection}
        LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
      `;

      const dataResult = await database.query(dataQuery, queryParams);

      return {
        items: dataResult.rows.map(mapSubscription),
        pagination: {
          limit,
          page: validatedPage,
          totalCount,
          totalPages,
        },
      };
    },

    async updateSubscription({ id, updates, userId }) {
      const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
      const params = [id, userId];

      const addClause = (column, value) => {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      };

      if (updates.categoryId !== undefined) {
        addClause('category_id', updates.categoryId);
      }
      if (updates.planName !== undefined) {
        addClause('plan_name', updates.planName ?? null);
      }
      if (updates.price !== undefined) {
        addClause('price', updates.price);
      }
      if (updates.currencyCode !== undefined) {
        addClause('currency_code', updates.currencyCode);
      }
      if (updates.billingCycle !== undefined) {
        addClause('billing_cycle', updates.billingCycle);
      }
      if (updates.startDate !== undefined) {
        addClause('start_date', updates.startDate);
      }
      if (updates.nextRenewalDate !== undefined) {
        addClause('next_renewal_date', updates.nextRenewalDate ?? null);
      }
      if (updates.trialEndDate !== undefined) {
        addClause('trial_end_date', updates.trialEndDate ?? null);
      }
      if (updates.notes !== undefined) {
        addClause('notes', updates.notes ?? null);
      }

      // Handle service switching
      if (updates.serviceId !== undefined || updates.customServiceName !== undefined) {
        if (updates.serviceId) {
          addClause('service_id', updates.serviceId);
          addClause('custom_service_name', null);
        } else if (updates.customServiceName) {
          addClause('custom_service_name', updates.customServiceName);
          addClause('service_id', null);
        }
      }

      // Handle status and cancellation timestamp
      if (updates.status !== undefined) {
        addClause('status', updates.status);
        if (updates.status === 'cancelled') {
          setClauses.push('cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP)');
        } else {
          setClauses.push('cancelled_at = NULL');
        }
      }

      const updateQuery = `
        UPDATE subscriptions
        SET ${setClauses.join(', ')}
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      const result = await database.query(updateQuery, params);
      if (result.rowCount === 0) {
        return null;
      }

      return this.findById({ id, userId });
    },

    async archiveSubscription({ id, userId }) {
      const result = await database.query(
        `
          UPDATE subscriptions
          SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
          RETURNING id
        `,
        [id, userId],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return this.findById({ id, userId });
    },

    async restoreSubscription({ id, userId }) {
      const result = await database.query(
        `
          UPDATE subscriptions
          SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND user_id = $2 AND archived_at IS NOT NULL
          RETURNING id
        `,
        [id, userId],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return this.findById({ id, userId });
    },
  };
}
