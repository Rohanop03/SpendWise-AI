// Fictional demo data. Every recommendation rule fires on it:
//   rule 1 unused_subscription     Aarav's gym and Maya's course platform (last used > 60 days ago)
//   rule 2 above_category_average  Aarav's Netflix vs. his other Entertainment subscriptions
//   rule 3 duplicate_category      two Entertainment (Aarav) and two Productivity (Maya)
// Dates are relative to the day the seed runs. Payments are recorded on each renewal date
// through the renewal trigger, so renewal dates end up in the future like a paying user's.

const demoPasswordHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const demoDatabaseNames = new Set(['smart_subscription', 'spendwise_dev']);

const demoUsers = [
  {
    currency: 'INR',
    email: 'aarav.demo@example.invalid',
    name: 'Aarav Demo',
    subscriptions: [
      { category: 'Entertainment', cost: '649.00', cycle: 'Monthly', lastUsedDaysAgo: 3, months: 6, name: 'Netflix' },
      { category: 'Entertainment', cost: '299.00', cycle: 'Monthly', lastUsedDaysAgo: 20, months: 4, name: 'Prime Video' },
      { category: 'Fitness', cost: '1499.00', cycle: 'Monthly', lastUsedDaysAgo: 74, months: 5, name: 'City Gym' },
      { category: 'Utilities', cost: '999.00', cycle: 'Monthly', lastUsedDaysAgo: 0, months: 8, name: 'Home Broadband' },
      { category: 'Productivity', cost: '6199.00', cycle: 'Yearly', lastUsedDaysAgo: 1, months: 12, name: 'Microsoft 365' },
      { category: 'Cloud Storage', cost: '130.00', cycle: 'Monthly', lastUsedDaysAgo: null, months: 3, name: 'Google One' },
    ],
  },
  {
    currency: 'USD',
    email: 'maya.demo@example.invalid',
    name: 'Maya Demo',
    subscriptions: [
      { category: 'Productivity', cost: '10.00', cycle: 'Monthly', lastUsedDaysAgo: 2, months: 6, name: 'Notion' },
      { category: 'Productivity', cost: '8.75', cycle: 'Monthly', lastUsedDaysAgo: 9, months: 3, name: 'Slack Pro' },
      { category: 'Education', cost: '199.00', cycle: 'Yearly', lastUsedDaysAgo: 95, months: 12, name: 'Course Platform' },
      { category: 'Entertainment', cost: '11.99', cycle: 'Monthly', lastUsedDaysAgo: 1, months: 9, name: 'Spotify' },
    ],
  },
];

function assertDemoSeedAllowed({ allowDemoSeed, databaseName, nodeEnv }) {
  if (nodeEnv !== 'development' || allowDemoSeed !== true) {
    throw new Error('Demo seeding requires NODE_ENV=development and ALLOW_DEMO_SEED=true.');
  }

  if (!demoDatabaseNames.has(databaseName)) {
    throw new Error('Demo seeding is restricted to the smart_subscription development database.');
  }
}

async function findOrCreateDemoUser(transaction, { currency, email, name }) {
  const inserted = await transaction.query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT ((lower(email))) DO NOTHING
      RETURNING user_id
    `,
    [name, email, demoPasswordHash],
  );

  const userId =
    inserted.rows[0]?.user_id ??
    (await transaction.query('SELECT user_id FROM users WHERE lower(email) = lower($1)', [email]))
      .rows[0].user_id;

  await transaction.query(
    `
      INSERT INTO user_preferences (user_id, preferred_currency, timezone)
      VALUES ($1, $2, 'Asia/Kolkata')
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId, currency],
  );

  return userId;
}

async function seedSubscription(transaction, userId, currency, subscription) {
  const created = await transaction.query(
    `
      INSERT INTO subscription (
        user_id, category_id, service_name, cost, currency_code, billing_cycle,
        start_date, renewal_date, last_used_date, notes
      )
      SELECT $1, c.category_id, $3, $4, $5, $6::billing_cycle_type,
             (CURRENT_DATE - make_interval(months => $7))::date,
             (CURRENT_DATE - make_interval(months => $7))::date,
             CASE WHEN $8::int IS NULL THEN NULL ELSE CURRENT_DATE - $8::int END,
             'Fictional demonstration record.'
      FROM category c
      WHERE lower(c.category_name) = lower($2)
      RETURNING subscription_id
    `,
    [
      userId,
      subscription.category,
      subscription.name,
      subscription.cost,
      currency,
      subscription.cycle,
      subscription.months,
      subscription.lastUsedDaysAgo,
    ],
  );

  if (created.rowCount !== 1) {
    throw new Error(`Required category not found: ${subscription.category}. Run the catalog seed first.`);
  }

  const subscriptionId = created.rows[0].subscription_id;

  // Pay every renewal that has come due; the trigger moves renewal_date forward each time.
  for (let guard = 0; guard < 400; guard += 1) {
    const paid = await transaction.query(
      `
        INSERT INTO payment_history (subscription_id, amount, currency_code, payment_date, payment_status, notes)
        SELECT subscription_id, cost, currency_code, renewal_date, 'completed', 'Fictional demonstration payment.'
        FROM subscription
        WHERE subscription_id = $1 AND renewal_date <= CURRENT_DATE
        RETURNING payment_id
      `,
      [subscriptionId],
    );
    if (paid.rowCount === 0) break;
  }

  return subscriptionId;
}

export async function seedDemoData(database, options) {
  const databaseResult = await database.query('SELECT current_database() AS database_name');
  assertDemoSeedAllowed({ ...options, databaseName: databaseResult.rows[0].database_name });

  return database.withTransaction(async (transaction) => {
    let subscriptions = 0;

    for (const demoUser of demoUsers) {
      const userId = await findOrCreateDemoUser(transaction, demoUser);
      const existing = await transaction.query(
        'SELECT count(*)::int AS count FROM subscription WHERE user_id = $1',
        [userId],
      );

      // Idempotent: a demo user's subscriptions are created once.
      if (existing.rows[0].count === 0) {
        for (const subscription of demoUser.subscriptions) {
          await seedSubscription(transaction, userId, demoUser.currency, subscription);
          subscriptions += 1;
        }
      }

      await transaction.query('CALL generate_recommendations($1)', [userId]);
    }

    return { subscriptions, users: demoUsers.length };
  });
}

export { assertDemoSeedAllowed };
