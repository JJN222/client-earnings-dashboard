import express from 'express';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // internal Railway connection doesn't need SSL
});

// Create table on startup
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Database table ready');
  } catch (err) {
    console.error('❌ Database init error:', err.message);
  }
}

// ===== API ROUTES =====

// GET /api/data/:key - Read a config value
app.get('/api/data/:key', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM config WHERE key = $1', [req.params.key]);
    if (result.rows.length > 0) {
      res.json({ value: result.rows[0].value });
    } else {
      res.json({ value: null });
    }
  } catch (err) {
    console.error('GET error:', err.message);
    res.status(500).json({ error: 'Database read failed' });
  }
});

// POST /api/data/:key - Write a config value
app.post('/api/data/:key', async (req, res) => {
  try {
    const { value } = req.body;
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(value)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST error:', err.message);
    res.status(500).json({ error: 'Database write failed' });
  }
});

// DELETE /api/data/:key - Delete a config value
app.delete('/api/data/:key', async (req, res) => {
  try {
    await pool.query('DELETE FROM config WHERE key = $1', [req.params.key]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.status(500).json({ error: 'Database delete failed' });
  }
});

// ===== SERVE REACT APP =====
app.use(express.static(join(__dirname, 'dist')));

// All other routes serve the React app
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// ===== START =====
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
