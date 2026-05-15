class NewsletterModel {
    constructor(db) {
        this.db = db;
    }

    async subscribe(email) {
        try {
            const result = await this.db.query(
                'INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET is_active = true RETURNING *',
                [email]
            );
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async unsubscribe(email) {
        const result = await this.db.query(
            'UPDATE newsletter_subscribers SET is_active = false WHERE email = $1 RETURNING *',
            [email]
        );
        return result.rows[0];
    }

    async getAllActive() {
        const result = await this.db.query(
            'SELECT * FROM newsletter_subscribers WHERE is_active = true ORDER BY subscribed_at DESC'
        );
        return result.rows;
    }
}

module.exports = NewsletterModel;