import { escapeLikePattern } from '../utils/sql.js';

export function mapSubscription(row) {
  if (!row) {
    return null;
  }

  return {
    archivedAt: row.archived_at,
    billingCycle: row.billing_cycle,
    cancelledAt: row.cancelled_at,
    categoryId: String(row.category_id),
    categoryName: row.category_name ?? null,
    cost: Number(row.cost),
    createdAt: row.created_at,
    currencyCode: row.currency_code,
    daysSinceLastUse: row.days_since_last_use ?? null,
    id: String(row.subscription_id),
    lastUsedDate: row.last_used_date ?? null,
    monthlyEquivalent:
      row.monthly_equivalent === undefined ? undefined : Number(row.monthly_equivalent),
    notes: row.notes ?? null,
    planName: row.plan_name ?? null,
    renewalDate: row.renewal_date,
    serviceName: row.service_name,
    startDate: row.start_date,
    status: row.status,
    updatedAt: row.updated_at,
    userId: String(row.user_id),
  };
}

const baseSubscriptionSelect = `
  SELECT
    s.subscription_id,
    s.user_id,
    s.service_name,
    s.category_id,
    cat.category_name,
    s.plan_name,
    s.cost,
    spendwise_monthly_equivalent(s.cost, s.billing_cycle) AS monthly_equivalent,
    s.currency_code,
    s.billing_cycle,
    s.status,
    s.start_date::text AS start_date,
    s.renewal_date::text AS renewal_date,
    s.last_used_date::text AS last_used_date,
    CURRENT_DATE - s.last_used_date AS days_since_last_use,
    s.cancelled_at,
    s.archived_at,
    s.notes,
    s.created_at,
    s.updated_at
  FROM subscription AS s
  JOIN category AS cat ON cat.category_id = s.category_id
`;

const sortFieldMap = {
  cost: 's.cost',
  createdAt: 's.created_at',
  lastUsedDate: 's.last_used_date',
  renewalDate: 's.renewal_date',
  serviceName: 'LOWER(s.service_name)',
  startDate: 's.start_date',
};

export function createSubscriptionRepository(database) {
  return {
    async categoryExists(categoryId) {
      const result = await database.query('SELECT 1 FROM category WHERE category_id = $1', [
        categoryId,
      ]);
      return result.rowCount > 0;
    },

    async createSubscription(input) {
      const result = await database.query(
        `
          INSERT INTO subscription (
            user_id,
            service_name,
            category_id,
            plan_name,
            cost,
            currency_code,
            billing_cycle,
            start_date,
            renewal_date,
            last_used_date,
            notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING subscription_id
        `,
        [
          input.userId,
          input.serviceName,
          input.categoryId,
          input.planName ?? null,
          input.cost,
          input.currencyCode,
          input.billingCycle,
          input.startDate,
          input.renewalDate,
          input.lastUsedDate ?? null,
          input.notes ?? null,
        ],
      );

      return this.findById({ id: result.rows[0].subscription_id, userId: input.userId });
    },

    async findById({ client = database, id, userId }) {
      const result = await client.query(
        `
          ${baseSubscriptionSelect}
          WHERE s.subscription_id = $1 AND s.user_id = $2
        `,
        [id, userId],
      );

      return mapSubscription(result.rows[0]);
    },

    async lockForUpdate({ client, id, userId }) {
      const result = await client.query(
        `
          SELECT subscription_id, status, currency_code, archived_at
          FROM subscription
          WHERE subscription_id = $1 AND user_id = $2
          FOR UPDATE
        `,
        [id, userId],
      );

      return result.rows[0] ?? null;
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
      unusedDays,
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

      if (unusedDays) {
        params.push(unusedDays);
        conditions.push(`s.last_used_date < CURRENT_DATE - $${params.length}::int`);
      }

      if (search && search.trim().length > 0) {
        params.push(`%${escapeLikePattern(search.trim())}%`);
        conditions.push(
          `(s.service_name ILIKE $${params.length} OR s.plan_name ILIKE $${params.length})`,
        );
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      const orderColumn = sortFieldMap[sortBy] || 's.created_at';
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const nullsOrdering = orderColumn === 's.last_used_date' ? ' NULLS LAST' : '';
      const offset = (Math.max(1, page) - 1) * limit;

      const queryParams = [...params, limit, offset];
      // Page and total run concurrently on separate pool connections.
      const [dataResult, countResult] = await Promise.all([
        database.query(
          `
            ${baseSubscriptionSelect}
            ${whereClause}
            ORDER BY ${orderColumn} ${orderDirection}${nullsOrdering}, s.subscription_id ${orderDirection}
            LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
          `,
          queryParams,
        ),
        database.query(
          `SELECT COUNT(*)::int AS total FROM subscription AS s ${whereClause}`,
          params,
        ),
      ]);

      const totalCount = countResult.rows[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      return {
        items: dataResult.rows.map(mapSubscription),
        pagination: {
          limit,
          page: Math.min(Math.max(1, page), totalPages),
          totalCount,
          totalPages,
        },
      };
    },

    async updateSubscription({ client = database, id, updates, userId }) {
      const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
      const params = [id, userId];

      const addClause = (column, value) => {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      };

      if (updates.serviceName !== undefined) addClause('service_name', updates.serviceName);
      if (updates.categoryId !== undefined) addClause('category_id', updates.categoryId);
      if (updates.planName !== undefined) addClause('plan_name', updates.planName ?? null);
      if (updates.cost !== undefined) addClause('cost', updates.cost);
      if (updates.currencyCode !== undefined) addClause('currency_code', updates.currencyCode);
      if (updates.billingCycle !== undefined) addClause('billing_cycle', updates.billingCycle);
      if (updates.startDate !== undefined) addClause('start_date', updates.startDate);
      if (updates.renewalDate !== undefined) addClause('renewal_date', updates.renewalDate);
      if (updates.lastUsedDate !== undefined) {
        addClause('last_used_date', updates.lastUsedDate ?? null);
      }
      if (updates.notes !== undefined) addClause('notes', updates.notes ?? null);

      if (updates.status !== undefined) {
        addClause('status', updates.status);
        setClauses.push(
          updates.status === 'Cancelled'
            ? 'cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP)'
            : 'cancelled_at = NULL',
        );
      }

      const result = await client.query(
        `
          UPDATE subscription
          SET ${setClauses.join(', ')}
          WHERE subscription_id = $1 AND user_id = $2
          RETURNING subscription_id
        `,
        params,
      );

      if (result.rowCount === 0) {
        return null;
      }

      return this.findById({ client, id, userId });
    },

    async deleteSubscription({ client = database, id, userId }) {
      const result = await client.query(
        'DELETE FROM subscription WHERE subscription_id = $1 AND user_id = $2',
        [id, userId],
      );
      return result.rowCount === 1;
    },

    async archiveSubscription({ id, userId }) {
      const result = await database.query(
        `
          UPDATE subscription
          SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE subscription_id = $1 AND user_id = $2 AND archived_at IS NULL
          RETURNING subscription_id
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
          UPDATE subscription
          SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE subscription_id = $1 AND user_id = $2 AND archived_at IS NOT NULL
          RETURNING subscription_id
        `,
        [id, userId],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return this.findById({ id, userId });
    },

    async listHistory({ id, limit, userId }) {
      const result = await database.query(
        `
          SELECT id, changed_fields, old_values, new_values, changed_at
          FROM subscription_audit_events
          WHERE subscription_id = $1 AND user_id = $2
          ORDER BY changed_at DESC, id DESC
          LIMIT $3
        `,
        [id, userId, limit],
      );

      return result.rows.map((row) => ({
        changedAt: row.changed_at,
        changedFields: row.changed_fields,
        id: String(row.id),
        newValues: row.new_values,
        oldValues: row.old_values,
      }));
    },
  };
}
