set serveroutput on
set feedback on
set linesize 200

PROMPT ======================================
PROMPT   VERIFYING SNEAKERHEADZ LOGIC
PROMPT ======================================

-- 1. Setup Test Data (Clean & Insert)
PROMPT [1] Setting up Test Data...
DELETE FROM orders;
DELETE FROM sneakers;

INSERT INTO sneakers (id, data) VALUES (1, '{"model": "Air Jordan 1", "price": 200, "is_collab": 0, "sizes": {"US10": 5}}');
INSERT INTO sneakers (id, data) VALUES (2, '{"model": "Travis Scott x AJ1", "price": 1000, "is_collab": 1, "sizes": {"US10": 2}}');
COMMIT;
PROMPT Done.

-- 2. Test Price Calculation via MLE
PROMPT [2] Testing Price Calculation (get_price_js)...

DECLARE
    v_price NUMBER;
BEGIN
    -- Scenario A: Normal User, Normal Shoe
    -- Price: $200 * 150 JPY/USD = 30,000 JPY
    v_price := get_price_js(JSON('{"price": 200, "is_collab": 0}'), 0);
    DBMS_OUTPUT.PUT_LINE('  Test A (Normal User): Expected 30000, Got ' || v_price);
    IF v_price = 30000 THEN DBMS_OUTPUT.PUT_LINE('    -> PASS'); ELSE DBMS_OUTPUT.PUT_LINE('    -> FAIL'); END IF;
    
    -- Scenario B: Premium User, Normal Shoe
    -- Price: 30,000 * 0.9 (10% off) = 27,000 JPY
    v_price := get_price_js(JSON('{"price": 200, "is_collab": 0}'), 1);
    DBMS_OUTPUT.PUT_LINE('  Test B (Premium User): Expected 27000, Got ' || v_price);
    IF v_price = 27000 THEN DBMS_OUTPUT.PUT_LINE('    -> PASS'); ELSE DBMS_OUTPUT.PUT_LINE('    -> FAIL'); END IF;

    -- Scenario C: Premium User, Collab Shoe
    -- Price: $1000 * 150 = 150,000 JPY (No Discount for Collab)
    v_price := get_price_js(JSON('{"price": 1000, "is_collab": 1}'), 1);
    DBMS_OUTPUT.PUT_LINE('  Test C (Premium Collab): Expected 150000, Got ' || v_price);
    IF v_price = 150000 THEN DBMS_OUTPUT.PUT_LINE('    -> PASS'); ELSE DBMS_OUTPUT.PUT_LINE('    -> FAIL'); END IF;
END;
/

-- 3. Test Purchase Transaction via Wrapper
PROMPT [3] Testing Purchase Transaction (buy_kicks)...
DECLARE
    v_status VARCHAR2(20);
    v_stock_json JSON;
    v_remaining NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('  Attempting to buy Sneaker ID 1 (Size US10)...');
    
    -- Buy Sneaker 1 as Premium User
    buy_kicks(p_id => 1, p_size => 'US10', p_user => 'test_user', p_premium => 1, p_status => v_status);
    
    DBMS_OUTPUT.PUT_LINE('  Purchase Status: ' || v_status);
    IF v_status = 'SUCCESS' THEN DBMS_OUTPUT.PUT_LINE('    -> PASS'); ELSE DBMS_OUTPUT.PUT_LINE('    -> FAIL'); END IF;
    
    -- Verify Stock Decrement
    SELECT data INTO v_stock_json FROM sneakers WHERE id = 1;
    v_remaining := JSON_VALUE(v_stock_json, '$.sizes.US10');
    DBMS_OUTPUT.PUT_LINE('  Stock After Purchase: ' || v_remaining);
    
    -- Initial was 5, should be 4
    IF v_remaining = 4 THEN DBMS_OUTPUT.PUT_LINE('    -> PASS'); ELSE DBMS_OUTPUT.PUT_LINE('    -> FAIL (Expected 4)'); END IF;
END;
/

-- 4. Check Orders Table
PROMPT [4] Verifying Orders Table...
SELECT * FROM orders;

exit
