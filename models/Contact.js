class ContactModel {
    constructor(db) {
        this.db = db;
    }

    async createMessage(messageData) {
        const { name, email, phone, subject, message } = messageData;
        const result = await this.db.query(
            'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, email, phone, subject, message]
        );
        return result.rows[0];
    }

    async getAllMessages() {
        const result = await this.db.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        return result.rows;
    }

    async updateStatus(id, status) {
        const result = await this.db.query(
            'UPDATE contact_messages SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    }
}

module.exports = ContactModel;