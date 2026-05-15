class FormationModel {
    constructor(db) {
        this.db = db;
    }

    async getAll() {
        const result = await this.db.query('SELECT * FROM formations ORDER BY id');
        return result.rows;
    }

    async getById(id) {
        const result = await this.db.query('SELECT * FROM formations WHERE id = $1', [id]);
        return result.rows[0];
    }

    async getByCategory(category) {
        const result = await this.db.query(
            'SELECT * FROM formations WHERE category = $1 ORDER BY id',
            [category]
        );
        return result.rows;
    }

    async create(formationData) {
        const { title, description, duration, level, category, availability, image_url, price } = formationData;
        const result = await this.db.query(
            'INSERT INTO formations (title, description, duration, level, category, availability, image_url, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [title, description, duration, level, category, availability, image_url, price]
        );
        return result.rows[0];
    }

    async update(id, formationData) {
        const { title, description, duration, level, category, availability, image_url, price } = formationData;
        const result = await this.db.query(
            'UPDATE formations SET title = $1, description = $2, duration = $3, level = $4, category = $5, availability = $6, image_url = $7, price = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
            [title, description, duration, level, category, availability, image_url, price, id]
        );
        return result.rows[0];
    }

    async delete(id) {
        await this.db.query('DELETE FROM formations WHERE id = $1', [id]);
        return true;
    }
}

module.exports = FormationModel;