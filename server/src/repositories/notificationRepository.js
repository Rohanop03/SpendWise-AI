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

    async findReminderCandidates({ limit, offset }) {
      const result = await database.query(
        `
          SELECT
            s.id AS subscription_id,
            s.user_id,
            COALESCE(svc.name, s.custom_service_name) AS service_name,
            s.status,
            s.next_renewal_date::text AS next_renewal_date,
            s.trial_end_date::text AS trial_end_date,
            p.timezone,
            p.renewal_reminder_days,
            p.trial_reminder_days
          FROM subscriptions AS s
          INNER JOIN user_preferences AS p ON p.user_id = s.user_id
          LEFT JOIN services AS svc ON svc.id = s.service_id
          WHERE s.archived_at IS NULL
            AND p.notifications_enabled = TRUE
            AND (
              (s.status = 'active' AND p.renewal_reminders_enabled = TRUE AND s.next_renewal_date IS NOT NULL)
              OR
              (s.status = 'trial' AND p.trial_reminders_enabled = TRUE AND s.trial_end_date IS NOT NULL)
            )
          ORDER BY s.user_id, s.id
          LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      );
      return result.rows.map((row) => ({
        nextRenewalDate: row.next_renewal_date,
        renewalReminderDays: row.renewal_reminder_days,
        serviceName: row.service_name,
        status: row.status,
        subscriptionId: String(row.subscription_id),
        timezone: row.timezone,
        trialEndDate: row.trial_end_date,
        trialReminderDays: row.trial_reminder_days,
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
