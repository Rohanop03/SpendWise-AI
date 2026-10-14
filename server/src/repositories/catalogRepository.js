export function createCatalogRepository(database) {
  return {
    async listCategories() {
      const result = await database.query(
        `
          SELECT id, name, description, created_at
          FROM categories
          ORDER BY name ASC
        `,
      );

      return result.rows.map((row) => ({
        createdAt: row.created_at,
        description: row.description,
        id: String(row.id),
        name: row.name,
      }));
    },

    async listServices({ search } = {}) {
      const trimmedSearch = typeof search === 'string' ? search.trim() : '';
      const params = [];
      let query = `
        SELECT
          s.id,
          s.name,
          s.default_category_id,
          c.name AS category_name,
          s.website_url,
          s.is_active,
          s.created_at
        FROM services AS s
        LEFT JOIN categories AS c ON c.id = s.default_category_id
        WHERE s.is_active = TRUE
      `;

      if (trimmedSearch.length > 0) {
        params.push(`%${trimmedSearch}%`);
        query += ` AND s.name ILIKE $${params.length}`;
      }

      query += ` ORDER BY s.name ASC`;

      const result = await database.query(query, params);

      return result.rows.map((row) => ({
        categoryName: row.category_name ?? null,
        createdAt: row.created_at,
        defaultCategoryId: row.default_category_id ? String(row.default_category_id) : null,
        id: String(row.id),
        isActive: row.is_active,
        name: row.name,
        websiteUrl: row.website_url,
      }));
    },
  };
}
