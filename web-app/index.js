import functions from '@google-cloud/functions-framework';
import pg from 'pg';
import express from 'express';
import { purchase, searchSneakers } from './src/sneaker_logic.js';

const { Pool } = pg;

// DB connection config from environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'sneakers',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const app = express();
app.use(express.json());

// 1. GET /api/search
// Parameters: premium (query), budget (query)
app.get('/api/search', async (req, res) => {
  try {
    const premium = req.query.premium;
    const budget = Number(req.query.budget) || 0;

    const result = await searchSneakers(pool, premium, budget);
    res.json(result);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/buy
// Parameters: id, size, user, premium (body)
app.post('/api/buy', async (req, res) => {
  try {
    const { id, size, user, premium } = req.body;

    // Validate inputs
    if (!id || !size || !user) {
      return res.status(400).json({ status: "FAIL", message: "Missing required parameters: id, size, user" });
    }

    const result = await purchase(pool, id, size, user, premium);
    res.json(result);
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ status: "ERROR", message: err.message });
  }
});

// Register the function
functions.http('sneakerApi', app);
