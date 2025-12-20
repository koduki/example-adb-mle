import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Helper to get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB config
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'sneakers',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('Connected to database.');

        // 1. Run tables.sql
        const schemaPath = path.resolve(__dirname, '../db/schema/tables.sql');
        console.log(`Reading schema from ${schemaPath}...`);

        let schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        // Execute the SQL. standard pg client handles multiple statements.
        await client.query(schemaSql);
        console.log('Schema created.');

        // 2. Insert Seed Data
        console.log('Inserting seed data...');

        // Truncate tables to ensure clean state
        await client.query('TRUNCATE TABLE orders, sneakers RESTART IDENTITY');

        const sneakers = [
            {
                data: JSON.stringify({
                    model: "Air Jordan 1 High OG",
                    price: 180,
                    is_collab: 0,
                    sizes: { "US9": 10, "US10": 20, "US11": 5 }
                })
            },
            {
                data: JSON.stringify({
                    model: "Travis Scott x Air Jordan 1 Low",
                    price: 150,
                    is_collab: 1,
                    sizes: { "US9": 5, "US10": 5 }
                })
            }
        ];

        for (const s of sneakers) {
            await client.query('INSERT INTO sneakers (data) VALUES ($1)', [s.data]);
        }

        console.log(`Inserted ${sneakers.length} sneakers.`);

        // Verify
        const res = await client.query('SELECT * FROM sneakers');
        console.log('Current sneakers in DB:');
        res.rows.forEach(r => console.log(`ID: ${r.id}, Data: ${JSON.stringify(r.data)}`));

    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
