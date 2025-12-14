--liquibase formatted sql

--changeset sneaker_dev:mle_v1 runOnChange:true
--comment Deploy MLE Module (JavaScript Logic)
CREATE OR REPLACE MLE MODULE sneaker_logic LANGUAGE JAVASCRIPT AS

// Configuration
const RATE_USD_JPY = 150;

/**
 * Calculates the price in JPY based on USD price and premium status.
 */
export function calculatePrice(data, isPremium) {
    if (!data || typeof data !== 'object') return null;
    
    const priceUsd = Number(data.price) || 0;
    const isCollab = !!data.is_collab;
    const premiumFlag = (isPremium === true || isPremium === 1);

    let priceJpy = priceUsd * RATE_USD_JPY;

    if (premiumFlag && !isCollab) {
        priceJpy = priceJpy * 0.9;
    }

    return Math.floor(priceJpy);
}

/**
 * Transactional purchase logic.
 */
export function purchase(sneakerId, size, userId, isPremium) {
    if (!session) throw new Error("No database session available");

    // 1. Lock Row (SELECT ... FOR UPDATE)
    const rows = Array.from(session.execute(
        "SELECT data FROM sneakers WHERE id = :1 FOR UPDATE",
        [sneakerId]
    ));

    if (rows.length === 0) {
        return { status: "FAIL", message: "Sneaker not found" };
    }

    // Retrieve JSON data
    let colVal = rows[0].DATA;
    let snkData = (typeof colVal === 'string') ? JSON.parse(colVal) : colVal;

    // 2. Check Stock
    if (!snkData.sizes || snkData.sizes[size] === undefined) {
        return { status: "FAIL", message: "Invalid size" };
    }

    if (snkData.sizes[size] <= 0) {
        return { status: "FAIL", message: "Out of stock" };
    }

    // 3. Decrement Stock (In Memory)
    snkData.sizes[size] = Number(snkData.sizes[size]) - 1;

    // 4. Calculate Final Price
    const finalPrice = calculatePrice(snkData, isPremium);

    // 5. Update SNEAKERS table
    session.execute(
        "UPDATE sneakers SET data = :1 WHERE id = :2",
        [JSON.stringify(snkData), sneakerId]
    );

    // 6. Insert Order
    session.execute(
        "INSERT INTO orders (sneaker_id, user_id, amount) VALUES (:1, :2, :3)",
        [sneakerId, userId, finalPrice]
    );

    return { status: "SUCCESS", message: "Purchased", price: finalPrice };
}
/
--rollback DROP MLE MODULE sneaker_logic;
