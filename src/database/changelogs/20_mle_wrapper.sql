--liquibase formatted sql

--changeset sneaker_dev:mle_deploy_v1 runAlways:true endDelimiter:/
--comment Deploy MLE Module (Source in src/mle/sneaker_logic.js)
-- Usage: script <loader_script> <source_file> <module_name>

CREATE OR REPLACE MLE MODULE SNEAKER_LOGIC LANGUAGE JAVASCRIPT AS

/* Configuration */
const RATE_USD_JPY = 150;

/**
 * Calculates the price in JPY based on USD price and premium status.
 * Used for Functional Indexes and final price calculation.
 * 
 * @param {object} data - The JSON object of the sneaker (from JSON column)
 * @param {boolean|number} isPremium - 1/true if premium user, 0/false otherwise
 */
export function calculatePrice(data, isPremium) {
    if (!data || typeof data !== 'object') return null;

    const priceUsd = Number(data.price) || 0;
    const isCollab = !!data.is_collab;

    /* Normalize boolean input from SQL (often comes as number 0/1) */
    const premiumFlag = (isPremium === true || isPremium === 1);

    let priceJpy = priceUsd * RATE_USD_JPY;

    /* Logic: 10% off for Premium users on Non-Collab models */
    if (premiumFlag && !isCollab) {
        priceJpy = priceJpy * 0.9;
    }

    return Math.floor(priceJpy);
}

/**
 * Transactional purchase logic.
 * Encapsulates the "One-Shot" transaction.
 * 
 * @param {number} sneakerId
 * @param {string} size
 * @param {string} userId
 * @param {boolean|number} isPremium
 */
export function purchase(sneakerId, size, userId, isPremium) {
    if (!session) throw new Error("No database session available");

    /* 1. Lock Row (SELECT ... FOR UPDATE) */
    /* Using simple concatenation for ID is safe as it's number, but binds are better. */
    /* 23ai MLE session.execute returns an Iterable (not a legacy result set with .next()) */
    const rows = Array.from(session.execute(
        "SELECT data FROM sneakers WHERE id = :1 FOR UPDATE",
        [sneakerId]
    ));

    if (rows.length === 0) {
        return { status: "FAIL", message: "Sneaker not found. ID=" + sneakerId + ", Type=" + typeof sneakerId };
    }

    /* Retrieve JSON data (Column name is usually uppercase 'DATA') */
    let colVal = rows[0].DATA;
    let snkData = (typeof colVal === 'string') ? JSON.parse(colVal) : colVal;

    /* 2. Check Stock */
    if (!snkData.sizes || snkData.sizes[size] === undefined) {
        return { status: "FAIL", message: "Invalid size" };
    }

    if (snkData.sizes[size] <= 0) {
        return { status: "FAIL", message: "Out of stock" };
    }

    /* 3. Decrement Stock (In Memory) */
    snkData.sizes[size] = Number(snkData.sizes[size]) - 1;

    /* 4. Calculate Final Price */
    const finalPrice = calculatePrice(snkData, isPremium);

    /* 5. Update SNEAKERS table (Write back JSON) */
    /* We must serialize back to string or pass object depending on driver. */
    /* JSON.stringify is safest for 'data' bind usually. */
    session.execute(
        "UPDATE sneakers SET data = :1 WHERE id = :2",
        [JSON.stringify(snkData), sneakerId]
    );

    /* 6. Insert Order */
    session.execute(
        "INSERT INTO orders (sneaker_id, user_id, amount) VALUES (:1, :2, :3)",
        [sneakerId, userId, finalPrice]
    );

    return { status: "SUCCESS", message: "Purchased", price: finalPrice };
}

/

-- Check for errors and Raise if Invalid
DECLARE
    v_status VARCHAR2(20);
    v_err_msg VARCHAR2(4000);
BEGIN
    SELECT status INTO v_status FROM user_objects WHERE object_name = 'SNEAKER_LOGIC';
    
    IF v_status <> 'VALID' THEN
        FOR r IN (SELECT text, line, position FROM user_errors WHERE name = 'SNEAKER_LOGIC' ORDER BY sequence) LOOP
            v_err_msg := v_err_msg || 'Line ' || r.line || ': ' || r.text || CHR(10);
        END LOOP;
        raise_application_error(-20001, 'SNEAKER_LOGIC is INVALID: ' || CHR(10) || v_err_msg);
    END IF;
END;
/


--rollback DROP MLE MODULE sneaker_logic;
