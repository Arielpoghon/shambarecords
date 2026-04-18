require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'smartseason_secret_2024';
const STAGES = ['planted', 'growing', 'ready', 'harvested'];

// Auth middleware
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

const getFieldById = async (fieldId) => {
  const result = await pool.query(
    `SELECT f.*, u.name AS agent_name
     FROM fields f
     LEFT JOIN users u ON f.assigned_agent_id = u.id
     WHERE f.id = $1`,
    [fieldId]
  );
  return result.rows[0];
};

const canAccessField = (user, field) => {
  if (user.role === 'admin') return true;
  return field.assigned_agent_id === user.id;
};

const isValidStage = (stage) => STAGES.includes(stage);

// Compute field status
const computeStatus = (field) => {
  if (field.stage === 'harvested') return 'completed';
  const planted = new Date(field.planting_date);
  const now = new Date();
  const daysSincePlanting = Math.floor((now - planted) / (1000 * 60 * 60 * 24));
  if (field.stage === 'planted' && daysSincePlanting > 30) return 'at_risk';
  if (field.stage === 'growing' && daysSincePlanting > 90) return 'at_risk';
  return 'active';
};

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  let step = 'query';
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    step = 'compare';
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    step = 'sign';
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(`Login error during ${step}:`, err);
    res.status(500).json({ error: `${step}: ${err?.message || String(err) || 'unknown error'}` });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashed, role || 'agent']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// USERS ROUTES
app.get('/api/users', auth, adminOnly, async (req, res) => {
  const result = await pool.query('SELECT id, name, email, role FROM users ORDER BY name');
  res.json(result.rows);
});

app.get('/api/users/agents', auth, adminOnly, async (req, res) => {
  const result = await pool.query("SELECT id, name, email FROM users WHERE role = 'agent' ORDER BY name");
  res.json(result.rows);
});

// FIELDS ROUTES
app.get('/api/fields', auth, async (req, res) => {
  try {
    let query;
    let params = [];
    if (req.user.role === 'admin') {
      query = `SELECT f.*, u.name as agent_name 
               FROM fields f 
               LEFT JOIN users u ON f.assigned_agent_id = u.id 
               ORDER BY f.created_at DESC`;
    } else {
      query = `SELECT f.*, u.name as agent_name 
               FROM fields f 
               LEFT JOIN users u ON f.assigned_agent_id = u.id 
               WHERE f.assigned_agent_id = $1 
               ORDER BY f.created_at DESC`;
      params = [req.user.id];
    }
    const result = await pool.query(query, params);
    const fields = result.rows.map(f => ({ ...f, status: computeStatus(f) }));
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fields', auth, adminOnly, async (req, res) => {
  const { name, crop_type, planting_date, assigned_agent_id, stage } = req.body;
  try {
    if (stage && !isValidStage(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    const result = await pool.query(
      'INSERT INTO fields (name, crop_type, planting_date, assigned_agent_id, created_by, stage) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, crop_type, planting_date, assigned_agent_id || null, req.user.id, stage || 'planted']
    );
    res.json({ ...result.rows[0], status: computeStatus(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/fields/:id', auth, async (req, res) => {
  const { stage, name, crop_type, planting_date, assigned_agent_id } = req.body;
  try {
    const field = await getFieldById(req.params.id);
    if (!field) return res.status(404).json({ error: 'Field not found' });
    if (!canAccessField(req.user, field)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (stage && !isValidStage(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(
        'UPDATE fields SET name=$1, crop_type=$2, planting_date=$3, assigned_agent_id=$4, stage=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
        [
          name || field.name,
          crop_type || field.crop_type,
          planting_date || field.planting_date,
          assigned_agent_id === '' ? null : (assigned_agent_id ?? field.assigned_agent_id),
          stage || field.stage,
          req.params.id
        ]
      );
    } else {
      if (!stage) {
        return res.status(400).json({ error: 'Stage is required' });
      }
      result = await pool.query(
        'UPDATE fields SET stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
        [stage, req.params.id]
      );
    }
    res.json({ ...result.rows[0], status: computeStatus(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fields/:id', auth, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM fields WHERE id = $1', [req.params.id]);
  res.json({ message: 'Field deleted' });
});

// FIELD UPDATES ROUTES
app.get('/api/fields/:id/updates', auth, async (req, res) => {
  try {
    const field = await getFieldById(req.params.id);
    if (!field) return res.status(404).json({ error: 'Field not found' });
    if (!canAccessField(req.user, field)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const result = await pool.query(
      'SELECT fu.*, u.name as agent_name FROM field_updates fu JOIN users u ON fu.agent_id = u.id WHERE fu.field_id = $1 ORDER BY fu.created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fields/:id/updates', auth, async (req, res) => {
  const { stage, notes } = req.body;
  try {
    const field = await getFieldById(req.params.id);
    if (!field) return res.status(404).json({ error: 'Field not found' });
    if (req.user.role !== 'agent' || !canAccessField(req.user, field)) {
      return res.status(403).json({ error: 'Only the assigned field agent can submit updates' });
    }
    if (!isValidStage(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    await pool.query('UPDATE fields SET stage=$1, updated_at=NOW() WHERE id=$2', [stage, req.params.id]);
    const result = await pool.query(
      'INSERT INTO field_updates (field_id, agent_id, stage, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, req.user.id, stage, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DASHBOARD ROUTE
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    let fields;
    if (req.user.role === 'admin') {
      const result = await pool.query('SELECT f.*, u.name as agent_name FROM fields f LEFT JOIN users u ON f.assigned_agent_id = u.id');
      fields = result.rows;
    } else {
      const result = await pool.query('SELECT * FROM fields WHERE assigned_agent_id = $1', [req.user.id]);
      fields = result.rows;
    }
    const fieldsWithStatus = fields.map(f => ({ ...f, status: computeStatus(f) }));
    const summary = {
      total: fieldsWithStatus.length,
      active: fieldsWithStatus.filter(f => f.status === 'active').length,
      at_risk: fieldsWithStatus.filter(f => f.status === 'at_risk').length,
      completed: fieldsWithStatus.filter(f => f.status === 'completed').length,
      by_stage: {
        planted: fieldsWithStatus.filter(f => f.stage === 'planted').length,
        growing: fieldsWithStatus.filter(f => f.stage === 'growing').length,
        ready: fieldsWithStatus.filter(f => f.stage === 'ready').length,
        harvested: fieldsWithStatus.filter(f => f.stage === 'harvested').length,
      }
    };
    res.json({ summary, fields: fieldsWithStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`SmartSeason API running on port ${PORT}`));
