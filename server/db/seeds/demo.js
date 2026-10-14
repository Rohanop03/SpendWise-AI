const demoPasswordHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const demoUsers = [
  ['Aarav Demo', 'aarav.demo@example.invalid', 'INR'],
  ['Maya Demo', 'maya.demo@example.invalid', 'USD'],
];

function assertDemoSeedAllowed({ allowDemoSeed, databaseName, nodeEnv }) {
  if (nodeEnv !== 'development' || allowDemoSeed !== true) {
    throw new Error('Demo seeding requires NODE_ENV=development and ALLOW_DEMO_SEED=true.');
  }

  if (databaseName !== 'spendwise_dev') {
    throw new Error('Demo seeding is restricted to the spendwise_dev database.');
  }
}

async function findOrCreateDemoUser(transaction, [displayName, email, preferredCurrency]) {
  const inserted = await transaction.query(
    `
      INSERT INTO users (display_name, email, password_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT ((lower(email))) DO NOTHING
      RETURNING id
    `,
    [displayName, email, demoPasswordHash],
  );

  const userId =
    inserted.rows[0]?.id ??
    (await transaction.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email]))
      .rows[0].id;

  await transaction.query(
    `
      INSERT INTO user_preferences (user_id, preferred_currency, timezone)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId, preferredCurrency, 'Asia/Kolkata'],
  );

  return userId;
}

async function findCategoryId(transaction, name) {
  const result = await transaction.query(
    'SELECT id FROM categories WHERE lower(name) = lower($1)',
    [name],
  );

  if (result.rowCount !== 1) {
    throw new Error(`Required category not found: ${name}. Run the catalog seed first.`);
  }

  return result.rows[0].id;
}

async function findServiceId(transaction, name) {
  const result = await transaction.query('SELECT id FROM services WHERE lower(name) = lower($1)', [
    name,
  ]);

  if (result.rowCount !== 1) {
    throw new Error(`Required service not found: ${name}. Run the catalog seed first.`);
  }

  return result.rows[0].id;
}

async function findOrCreateSubscription(transaction, subscription) {
  const result = await transaction.query(
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
        notes
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11
      WHERE NOT EXISTS (
        SELECT 1
        FROM subscriptions
        WHERE user_id = $1
          AND service_id IS NOT DISTINCT FROM $2
          AND custom_service_name IS NOT DISTINCT FROM $3
          AND plan_name IS NOT DISTINCT FROM $5
          AND start_date = $9
      )
      RETURNING id
    `,
    [
      subscription.userId,
      subscription.serviceId,
      subscription.customServiceName,
      subscription.categoryId,
      subscription.planName,
      subscription.price,
      subscription.currencyCode,
      subscription.billingCycle,
      subscription.startDate,
      subscription.nextRenewalDate,
      'Fictional Stage 3 demonstration record.',
    ],
  );

  if (result.rows[0]?.id) {
    return result.rows[0].id;
  }

  const existing = await transaction.query(
    `
      SELECT id
      FROM subscriptions
      WHERE user_id = $1
        AND service_id IS NOT DISTINCT FROM $2
        AND custom_service_name IS NOT DISTINCT FROM $3
        AND plan_name IS NOT DISTINCT FROM $4
        AND start_date = $5
    `,
    [
      subscription.userId,
      subscription.serviceId,
      subscription.customServiceName,
      subscription.planName,
      subscription.startDate,
    ],
  );

  return existing.rows[0].id;
}

async function seedPayment(transaction, payment) {
  await transaction.query(
    `
      INSERT INTO payments (
        subscription_id,
        amount,
        currency_code,
        payment_date,
        payment_status,
        billing_period_start,
        billing_period_end,
        notes
      )
      SELECT $1, $2, $3, $4, 'completed', $5, $6, $7
      WHERE NOT EXISTS (
        SELECT 1
        FROM payments
        WHERE subscription_id = $1
          AND payment_date = $4
          AND amount = $2
          AND currency_code = $3
          AND payment_status = 'completed'
      )
    `,
    [
      payment.subscriptionId,
      payment.amount,
      payment.currencyCode,
      payment.paymentDate,
      payment.periodStart,
      payment.periodEnd,
      'Fictional Stage 3 demonstration payment.',
    ],
  );
}

export async function seedDemoData(database, options) {
  const databaseResult = await database.query('SELECT current_database() AS database_name');
  const databaseName = databaseResult.rows[0].database_name;
  assertDemoSeedAllowed({ ...options, databaseName });

  return database.withTransaction(async (transaction) => {
    const aaravUserId = await findOrCreateDemoUser(transaction, demoUsers[0]);
    const mayaUserId = await findOrCreateDemoUser(transaction, demoUsers[1]);
    const entertainmentId = await findCategoryId(transaction, 'Entertainment');
    const productivityId = await findCategoryId(transaction, 'Productivity');
    const netflixId = await findServiceId(transaction, 'Netflix');
    const notionId = await findServiceId(transaction, 'Notion');

    const netflixSubscriptionId = await findOrCreateSubscription(transaction, {
      billingCycle: 'monthly',
      categoryId: entertainmentId,
      currencyCode: 'INR',
      customServiceName: null,
      nextRenewalDate: '2026-11-05',
      planName: 'Demo Streaming Plan',
      price: '649.00',
      serviceId: netflixId,
      startDate: '2026-01-05',
      userId: aaravUserId,
    });
    const notionSubscriptionId = await findOrCreateSubscription(transaction, {
      billingCycle: 'yearly',
      categoryId: productivityId,
      currencyCode: 'USD',
      customServiceName: null,
      nextRenewalDate: '2027-02-10',
      planName: 'Demo Workspace Plan',
      price: '96.00',
      serviceId: notionId,
      startDate: '2026-02-10',
      userId: mayaUserId,
    });

    await seedPayment(transaction, {
      amount: '649.00',
      currencyCode: 'INR',
      paymentDate: '2026-10-05',
      periodEnd: '2026-11-04',
      periodStart: '2026-10-05',
      subscriptionId: netflixSubscriptionId,
    });
    await seedPayment(transaction, {
      amount: '96.00',
      currencyCode: 'USD',
      paymentDate: '2026-02-10',
      periodEnd: '2027-02-09',
      periodStart: '2026-02-10',
      subscriptionId: notionSubscriptionId,
    });

    await transaction.query(
      `
        INSERT INTO notifications (
          user_id,
          subscription_id,
          notification_type,
          title,
          message,
          scheduled_for,
          deduplication_key
        )
        VALUES ($1, $2, 'renewal', $3, $4, $5, $6)
        ON CONFLICT (user_id, deduplication_key) DO NOTHING
      `,
      [
        aaravUserId,
        netflixSubscriptionId,
        'Fictional renewal reminder',
        'Demo subscription renewal is approaching.',
        '2026-11-01T09:00:00+05:30',
        'demo:renewal:netflix:2026-11-05',
      ],
    );

    return { subscriptions: 2, users: 2 };
  });
}

export { assertDemoSeedAllowed };
