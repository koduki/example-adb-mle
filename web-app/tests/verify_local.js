import { newDb } from 'pg-mem';
import { purchase, searchSneakers } from '../src/sneaker_logic.js';
import assert from 'assert';

// Custom pg-mem setup
const db = newDb();

// Register public schema if needed (pg-mem has public by default)

// Create schema
db.public.none(`
    CREATE TABLE sneakers (
        id SERIAL PRIMARY KEY,
        data JSONB
    );
    CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        sneaker_id INTEGER,
        user_id VARCHAR(100),
        amount INTEGER,
        ordered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
`);

// Insert test data
const sneakerData = {
    model: "Air Jordan 1",
    price: 100,
    is_collab: 0,
    sizes: { "US10": 5, "US9": 0 }
};

db.public.none(`
    INSERT INTO sneakers (data) VALUES ('${JSON.stringify(sneakerData)}');
`);

// Mock connection pool
const { Pool } = db.adapters.createPg();
const pool = new Pool();

async function runTests() {
    console.log("Starting tests...");

    // Test 1: Search Sneakers
    console.log("Test 1: Search Sneakers");
    const searchRes = await searchSneakers(pool, false, 20000);
    assert.strictEqual(searchRes.length, 1);
    assert.strictEqual(searchRes[0].model, "Air Jordan 1");
    assert.strictEqual(searchRes[0].price, 15000); // 100 * 150
    console.log("  Search OK");

    // Test 2: Purchase - Success
    console.log("Test 2: Purchase Success");
    const buyRes = await purchase(pool, 1, "US10", "user1", false);
    assert.strictEqual(buyRes.status, "SUCCESS");
    assert.strictEqual(buyRes.price, 15000);
    console.log("  Purchase OK");

    // Verify stock reduced
    const res = db.public.one("SELECT data FROM sneakers WHERE id = 1");
    const data = res.data;
    assert.strictEqual(data.sizes["US10"], 4);
    console.log("  Stock Reduced OK");

    // Test 3: Purchase - Out of Stock
    console.log("Test 3: Purchase Out of Stock");
    const failRes = await purchase(pool, 1, "US9", "user2", false);
    assert.strictEqual(failRes.status, "FAIL");
    assert.strictEqual(failRes.message, "在庫切れです");
    console.log("  Out of Stock OK");

    // Test 4: Bot Check (Rapid purchase)
    console.log("Test 4: Bot Check");
    // Insert 3 orders for user 'bot_user'
    // pg-mem might need explicit time mocking if tests run super fast,
    // but default NOW() should be current time.
    // logic checks ordered_at > NOW() - 1 minute.
    // If we insert now, it is > now - 1 minute.
    await pool.query("INSERT INTO orders (user_id, ordered_at) VALUES ('bot_user', NOW())");
    await pool.query("INSERT INTO orders (user_id, ordered_at) VALUES ('bot_user', NOW())");
    await pool.query("INSERT INTO orders (user_id, ordered_at) VALUES ('bot_user', NOW())");

    const botRes = await purchase(pool, 1, "US10", "bot_user", false);
    assert.strictEqual(botRes.status, "REJECTED");
    console.log("  Bot Check OK");

    console.log("All tests passed!");
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
