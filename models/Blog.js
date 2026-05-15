class BlogModel {
    constructor(db) {
        this.db = db;
    }

    async getAll(limit = null, offset = 0) {
        let query = 'SELECT * FROM blog_posts ORDER BY created_at DESC';
        const params = [];
        
        if (limit) {
            query += ' LIMIT $1 OFFSET $2';
            params.push(limit, offset);
        }
        
        const result = await this.db.query(query, params);
        return result.rows;
    }

    async getById(id) {
        await this.db.query('UPDATE blog_posts SET views = views + 1 WHERE id = $1', [id]);
        const result = await this.db.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
        return result.rows[0];
    }

    async getByCategory(category) {
        const result = await this.db.query(
            'SELECT * FROM blog_posts WHERE category = $1 ORDER BY created_at DESC',
            [category]
        );
        return result.rows;
    }

    async getRecent(limit = 3) {
        const result = await this.db.query(
            'SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT $1',
            [limit]
        );
        return result.rows;
    }

    async getCategoriesWithCount() {
        const result = await this.db.query(
            'SELECT category, COUNT(*) as count FROM blog_posts GROUP BY category'
        );
        return result.rows;
    }

    async create(blogData) {
        const { title, content, excerpt, author, category, image_url } = blogData;
        const result = await this.db.query(
            'INSERT INTO blog_posts (title, content, excerpt, author, category, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, content, excerpt, author, category, image_url]
        );
        return result.rows[0];
    }

    async update(id, blogData) {
        const { title, content, excerpt, author, category, image_url } = blogData;
        const result = await this.db.query(
            'UPDATE blog_posts SET title = $1, content = $2, excerpt = $3, author = $4, category = $5, image_url = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
            [title, content, excerpt, author, category, image_url, id]
        );
        return result.rows[0];
    }

    async delete(id) {
        await this.db.query('DELETE FROM blog_posts WHERE id = $1', [id]);
        return true;
    }
}

module.exports = BlogModel;