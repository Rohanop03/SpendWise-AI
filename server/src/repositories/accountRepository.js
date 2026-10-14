function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    accountStatus: row.account_status,
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.email,
    id: String(row.id),
    updatedAt: row.updated_at,
  };
}

function mapPreferences(row) {
  if (!row) {
    return null;
  }

  return {
    notificationsEnabled: row.notifications_enabled,
    preferredCurrency: row.preferred_currency,
    renewalReminderDays: row.renewal_reminder_days,
    renewalRemindersEnabled: row.renewal_reminders_enabled,
    timezone: row.timezone,
    trialReminderDays: row.trial_reminder_days,
    trialRemindersEnabled: row.trial_reminders_enabled,
    updatedAt: row.updated_at,
  };
}

export function createAccountRepository(database) {
  return {
    async createUserWithPreferencesAndSession(transaction, input) {
      const userResult = await transaction.query(
        `
          INSERT INTO users (display_name, email, password_hash)
          VALUES ($1, $2, $3)
          RETURNING id, display_name, email, account_status, created_at, updated_at
        `,
        [input.displayName, input.email, input.passwordHash],
      );
      const user = mapUser(userResult.rows[0]);

      await transaction.query(`INSERT INTO user_preferences (user_id) VALUES ($1)`, [user.id]);
      await transaction.query(
        `
          INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
          VALUES ($1, $2, $3, $4)
        `,
        [input.sessionId, user.id, input.refreshTokenHash, input.sessionExpiresAt],
      );

      return user;
    },

    async createSession(input) {
      await database.query(
        `
          INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
          VALUES ($1, $2, $3, $4)
        `,
        [input.sessionId, input.userId, input.refreshTokenHash, input.expiresAt],
      );
    },

    async findCredentialsByEmail(email) {
      const result = await database.query(
        `
          SELECT id, display_name, email, password_hash, account_status, created_at, updated_at
          FROM users
          WHERE lower(email) = lower($1)
        `,
        [email],
      );

      return result.rows[0]
        ? { passwordHash: result.rows[0].password_hash, user: mapUser(result.rows[0]) }
        : null;
    },

    async findUserById(userId) {
      const result = await database.query(
        `
          SELECT id, display_name, email, account_status, created_at, updated_at
          FROM users
          WHERE id = $1
        `,
        [userId],
      );

      return mapUser(result.rows[0]);
    },

    async findActiveIdentity({ sessionId, userId }) {
      const result = await database.query(
        `
          SELECT u.id, u.display_name, u.email, u.account_status, u.created_at, u.updated_at
          FROM auth_sessions AS session
          INNER JOIN users AS u ON u.id = session.user_id
          WHERE session.id = $1
            AND session.user_id = $2
            AND session.revoked_at IS NULL
            AND session.expires_at > CURRENT_TIMESTAMP
        `,
        [sessionId, userId],
      );

      return mapUser(result.rows[0]);
    },

    async findSessionForUpdate(transaction, sessionId) {
      const result = await transaction.query(
        `
          SELECT
            session.id,
            session.user_id,
            session.refresh_token_hash,
            session.expires_at,
            session.revoked_at,
            u.account_status,
            u.display_name,
            u.email,
            u.created_at,
            u.updated_at
          FROM auth_sessions AS session
          INNER JOIN users AS u ON u.id = session.user_id
          WHERE session.id = $1
          FOR UPDATE OF session
        `,
        [sessionId],
      );

      if (!result.rows[0]) {
        return null;
      }

      return {
        expiresAt: result.rows[0].expires_at,
        refreshTokenHash: result.rows[0].refresh_token_hash.trim(),
        revokedAt: result.rows[0].revoked_at,
        sessionId: result.rows[0].id,
        user: mapUser({ ...result.rows[0], id: result.rows[0].user_id }),
      };
    },

    async getPasswordHash(userId) {
      const result = await database.query(
        `SELECT password_hash FROM users WHERE id = $1 AND account_status = 'active'`,
        [userId],
      );

      return result.rows[0]?.password_hash ?? null;
    },

    async getPreferences(userId) {
      const result = await database.query(
        `
          SELECT
            preferred_currency,
            timezone,
            notifications_enabled,
            renewal_reminders_enabled,
            renewal_reminder_days,
            trial_reminders_enabled,
            trial_reminder_days,
            updated_at
          FROM user_preferences
          WHERE user_id = $1
        `,
        [userId],
      );

      return mapPreferences(result.rows[0]);
    },

    async revokeAllSessionsAndChangePassword(transaction, { passwordHash, userId }) {
      await transaction.query(
        `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [passwordHash, userId],
      );
      await transaction.query(
        `
          UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
          WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [userId],
      );
    },

    async revokeSession(transaction, sessionId) {
      await transaction.query(
        `
          UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
          WHERE id = $1
        `,
        [sessionId],
      );
    },

    async rotateSession(transaction, { refreshTokenHash, sessionId }) {
      await transaction.query(
        `
          UPDATE auth_sessions
          SET refresh_token_hash = $1, last_rotated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [refreshTokenHash, sessionId],
      );
    },

    async updatePreferences(userId, preferences) {
      const result = await database.query(
        `
          UPDATE user_preferences
          SET
            preferred_currency = COALESCE($2, preferred_currency),
            timezone = COALESCE($3, timezone),
            notifications_enabled = COALESCE($4, notifications_enabled),
            renewal_reminders_enabled = COALESCE($5, renewal_reminders_enabled),
            renewal_reminder_days = COALESCE($6, renewal_reminder_days),
            trial_reminders_enabled = COALESCE($7, trial_reminders_enabled),
            trial_reminder_days = COALESCE($8, trial_reminder_days),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
          RETURNING
            preferred_currency,
            timezone,
            notifications_enabled,
            renewal_reminders_enabled,
            renewal_reminder_days,
            trial_reminders_enabled,
            trial_reminder_days,
            updated_at
        `,
        [
          userId,
          preferences.preferredCurrency ?? null,
          preferences.timezone ?? null,
          preferences.notificationsEnabled ?? null,
          preferences.renewalRemindersEnabled ?? null,
          preferences.renewalReminderDays ?? null,
          preferences.trialRemindersEnabled ?? null,
          preferences.trialReminderDays ?? null,
        ],
      );

      return mapPreferences(result.rows[0]);
    },

    async updateProfile(userId, { displayName }) {
      const result = await database.query(
        `
          UPDATE users
          SET display_name = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND account_status = 'active'
          RETURNING id, display_name, email, account_status, created_at, updated_at
        `,
        [userId, displayName],
      );

      return mapUser(result.rows[0]);
    },
  };
}
