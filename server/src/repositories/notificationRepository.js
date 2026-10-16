function mapNotification(row) {
  if (!row) return null;
  return {
    createdAt: row.created_at,
    id: String(row.id),
    isRead: row.is_read,
    message: row.message,
    readAt: row.read_at,
    scheduledFor: row.scheduled_for,
    subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
    targetEventDate: row.target_event_date ?? null,
    title: row.title,
    type: row.notification_type,
  };
}

export function createNotificationRepository(database) {
  return {
    async countUnread(userId) {
      const result = await database.query(
        `SELECT count(*)::INTEGER AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
        [userId],
      );
      return result.rows[0].count;
    },

    /**
     * Active subscriptions whose owner wants renewal reminders, in (user_id, subscription_id)
     * order. Keyset pagination: pass the last row's key as `after` to get the next page.
     */
    async findReminderCandidates({ after = null, limit }) {
      const result = await database.query(
        `
          SELECT
            s.subscription_id,
            s.user_id,
            s.service_name,
            s.renewal_date::text AS renewal_date,
            p.timezone,
            p.renewal_reminder_days
          FROM subscription AS s
          INNER JOIN user_preferences AS p ON p.user_id = s.user_id
          WHERE s.archived_at IS NULL
            AND s.status = 'Active'
            AND p.notifications_enabled = TRUE
            AND p.renewal_reminders_enabled = TRUE
            AND ($2::int IS NULL OR (s.user_id, s.subscription_id) > ($2::int, $3::int))
          ORDER BY s.user_id, s.subscription_id
          LIMIT $1
        `,
        [limit, after?.userId ?? null, after?.subscriptionId ?? null],
      );
      return result.rows.map((row) => ({
        renewalDate: row.renewal_date,
        renewalReminderDays: row.renewal_reminder_days,
        serviceName: row.service_name,
        subscriptionId: String(row.subscription_id),
        timezone: row.timezone,
        userId: String(row.user_id),
      }));
    },

    async insertReminder(reminder) {
      const result = await database.query(
        `
          INSERT INTO notifications (
            user_id, subscription_id, notification_type, title, message,
            scheduled_for, target_event_date, deduplication_key
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
          RETURNING id
        `,
        [
          reminder.userId,
          reminder.subscriptionId,
          reminder.type,
          reminder.title,
          reminder.message,
          reminder.scheduledFor,
          reminder.targetEventDate,
          reminder.deduplicationKey,
        ],
      );
      return result.rowCount === 1;
    },

    async list({ limit, offset, type, unreadOnly, userId }) {
      const values = [userId];
      const conditions = ['user_id = $1'];
      if (unreadOnly) conditions.push('is_read = FALSE');
      if (type) {
        values.push(type);
        conditions.push(`notification_type = $${values.length}`);
      }
      values.push(limit, offset);
      const result = await database.query(
        `
          SELECT id, subscription_id, notification_type, title, message, target_event_date,
                 scheduled_for, is_read, read_at, created_at,
                 count(*) OVER()::INTEGER AS total_count
          FROM notifications
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC, id DESC
          LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
      );
      return {
        items: result.rows.map(mapNotification),
        total: result.rows[0]?.total_count ?? 0,
      };
    },

    async markAllRead(userId, readAt) {
      const result = await database.query(
        `UPDATE notifications SET is_read = TRUE, read_at = $2 WHERE user_id = $1 AND is_read = FALSE`,
        [userId, readAt],
      );
      return result.rowCount;
    },

    async markRead({ id, readAt, userId }) {
      const result = await database.query(
        `
          UPDATE notifications
          SET is_read = TRUE, read_at = COALESCE(read_at, $3)
          WHERE id = $1 AND user_id = $2
          RETURNING id, subscription_id, notification_type, title, message, target_event_date,
                    scheduled_for, is_read, read_at, created_at
        `,
        [id, userId, readAt],
      );
      return mapNotification(result.rows[0]);
    },
  };
}
