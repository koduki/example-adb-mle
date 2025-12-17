set serveroutput on
set feedback on

-- Reset Data
DELETE FROM orders;
UPDATE sneakers SET data = JSON('{"model": "Air Jordan 1", "price": 200, "is_collab": 0, "sizes": {"US10": 5}}') WHERE id = 1;
COMMIT;

DECLARE
    v_status VARCHAR2(100);
    v_json JSON;
    v_stock NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('Initial Stock Check:');
    SELECT data INTO v_json FROM sneakers WHERE id = 1;
    DBMS_OUTPUT.PUT_LINE(JSON_SERIALIZE(v_json));

    DBMS_OUTPUT.PUT_LINE('Calling buy_kicks...');
    buy_kicks(
        p_id => 1,
        p_size => 'US10',
        p_user => 'debug_plsql',
        p_premium => 0,
        p_status => v_status
    );
    
    DBMS_OUTPUT.PUT_LINE('Status Return: ' || v_status);
    
    DBMS_OUTPUT.PUT_LINE('Post Stock Check:');
    SELECT data INTO v_json FROM sneakers WHERE id = 1;
    v_stock := JSON_VALUE(v_json, '$.sizes.US10');
    DBMS_OUTPUT.PUT_LINE('Current Stock: ' || v_stock);
    
    IF v_stock < 5 THEN
        DBMS_OUTPUT.PUT_LINE('SUCCESS: Stock Decremented');
    ELSE
        DBMS_OUTPUT.PUT_LINE('FAIL: Stock Unchanged');
    END IF;
    
    ROLLBACK; -- Clean up
END;
/
exit
