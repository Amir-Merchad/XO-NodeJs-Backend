const fs = require('fs');
const path = require('path');

class SocialStore {
    constructor(filePath) {
        const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '.data');
        this.filePath = filePath || process.env.SOCIAL_STORE_PATH || path.join(dataDir, 'social-store.json');
        this.state = this._emptyState();
        this.pool = null;
        this.saveTimer = null;
        this.mode = 'file';
    }

    async init() {
        if (process.env.DATABASE_URL) {
            await this._initPostgres();
        } else {
            this._loadFile();
        }

        return this;
    }

    getState() {
        return this.state;
    }

    save() {
        if (this.mode === 'postgres') {
            this._schedulePostgresSave();
            return;
        }

        this._saveFile();
    }

    _emptyState() {
        return {
            profiles: {},
            parties: {},
            dmThreads: {},
        };
    }

    async _initPostgres() {
        let Pool;
        try {
            ({ Pool } = require('pg'));
        } catch (error) {
            throw new Error('DATABASE_URL is set, but the pg package is not installed. Run npm install pg.');
        }

        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: this._postgresSslConfig(),
        });
        this.mode = 'postgres';

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS social_state (
                id TEXT PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await this.pool.query(
            `
            INSERT INTO social_state (id, data)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (id) DO NOTHING
            `,
            ['main', JSON.stringify(this._emptyState())],
        );

        const result = await this.pool.query('SELECT data FROM social_state WHERE id = $1', ['main']);
        this.state = this._normalizeState(result.rows[0]?.data);
        console.log('[SOCIAL_STORE] Using PostgreSQL persistence');
    }

    _postgresSslConfig() {
        const mode = String(process.env.PGSSLMODE || '').toLowerCase();
        if (mode === 'require' || process.env.DATABASE_SSL === 'true') {
            return { rejectUnauthorized: false };
        }
        return false;
    }

    _schedulePostgresSave() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this._savePostgres().catch((error) => {
                console.error('[SOCIAL_STORE] PostgreSQL save failed:', error.message);
            });
        }, 50);
    }

    async _savePostgres() {
        if (!this.pool) return;
        await this.pool.query(
            `
            UPDATE social_state
            SET data = $2::jsonb, updated_at = NOW()
            WHERE id = $1
            `,
            ['main', JSON.stringify(this.state)],
        );
    }

    _loadFile() {
        try {
            if (!fs.existsSync(this.filePath)) {
                this._saveFile();
                return;
            }

            const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            this.state = this._normalizeState(parsed);
            console.log('[SOCIAL_STORE] Using file persistence');
        } catch (error) {
            console.error(`[SOCIAL_STORE] Could not load ${this.filePath}:`, error.message);
        }
    }

    _saveFile() {
        const dir = path.dirname(this.filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    }

    _normalizeState(value) {
        return {
            profiles: value?.profiles || {},
            parties: value?.parties || {},
            dmThreads: value?.dmThreads || {},
        };
    }
}

module.exports = SocialStore;
