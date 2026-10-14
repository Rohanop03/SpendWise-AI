export const categorySeeds = [
  ['Entertainment', 'Streaming, music, gaming, and other leisure subscriptions.'],
  ['Productivity', 'Tools for organization, collaboration, and professional work.'],
  ['Education', 'Learning platforms, courses, and academic resources.'],
  ['Cloud Storage', 'Cloud file storage, backup, and synchronization services.'],
  ['Fitness', 'Exercise, wellness, and fitness membership services.'],
  ['News', 'Digital newspapers, magazines, and journalism subscriptions.'],
  ['Other', 'Subscriptions that do not fit another shared category.'],
];

export const serviceSeeds = [
  ['Netflix', 'Entertainment', 'https://www.netflix.com'],
  ['Spotify', 'Entertainment', 'https://www.spotify.com'],
  ['YouTube Premium', 'Entertainment', 'https://www.youtube.com/premium'],
  ['Amazon Prime', 'Entertainment', 'https://www.amazon.com/prime'],
  ['Google One', 'Cloud Storage', 'https://one.google.com'],
  ['Microsoft 365', 'Productivity', 'https://www.microsoft.com/microsoft-365'],
  ['Notion', 'Productivity', 'https://www.notion.so'],
];

export async function seedCatalog(database) {
  return database.withTransaction(async (transaction) => {
    const categoriesByName = new Map();

    for (const [name, description] of categorySeeds) {
      const result = await transaction.query(
        `
          INSERT INTO categories (name, description)
          VALUES ($1, $2)
          ON CONFLICT ((lower(name)))
          DO UPDATE SET description = EXCLUDED.description
          RETURNING id, name
        `,
        [name, description],
      );

      categoriesByName.set(result.rows[0].name, result.rows[0].id);
    }

    for (const [name, categoryName, websiteUrl] of serviceSeeds) {
      await transaction.query(
        `
          INSERT INTO services (name, default_category_id, website_url)
          VALUES ($1, $2, $3)
          ON CONFLICT ((lower(name)))
          DO UPDATE SET
            default_category_id = EXCLUDED.default_category_id,
            website_url = EXCLUDED.website_url,
            is_active = TRUE
        `,
        [name, categoriesByName.get(categoryName), websiteUrl],
      );
    }

    return {
      categories: categorySeeds.length,
      services: serviceSeeds.length,
    };
  });
}
