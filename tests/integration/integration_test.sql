SET SERVEROUTPUT ON
SET FEEDBACK OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT ======================================
PROMPT [1] PRE-CHECK: Checking Stock
PROMPT ======================================

SELECT s.data.model as model, s.data.sizes as sizes FROM sneakers s WHERE id = 1;

PROMPT ======================================
PROMPT [2] EXECUTE: Buying Sneaker (ID:1, Size:US10)
PROMPT ======================================

VAR status VARCHAR2(4000);
DECLARE
    v_status VARCHAR2(4000);
BEGIN
    buy_kicks(
        p_id      => 1,
        p_size    => 'US10',
        p_user    => 'it_tester',
        p_premium => 0,
        p_status  => :status
    );
END;
/
PRINT status;

PROMPT ======================================
PROMPT [3] POST-CHECK: Verifying Stock Decrement
PROMPT ======================================

SELECT s.data.model as model, s.data.sizes as sizes FROM sneakers s WHERE id = 1;

-- Assertion Block
DECLARE
    v_stock NUMBER;
BEGIN
    SELECT s.data.sizes."US10" INTO v_stock
    FROM sneakers s
    WHERE id = 1;
    
    IF v_stock < 10 THEN
        DBMS_OUTPUT.PUT_LINE('SUCCESS: Stock was decremented.');
    ELSE
        RAISE_APPLICATION_ERROR(-20001, 'FAILURE: Stock was NOT decremented. Current: ' || v_stock);
    END IF;

    -- Clean up (optional, to allow re-run without reset)
    -- ROLLBACK; -- Do not rollback to verify persistence
END;
/

EXIT;
