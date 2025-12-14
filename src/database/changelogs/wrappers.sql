--liquibase formatted sql

--changeset sneaker_dev:wrappers_v1 runOnChange:true
--comment Create PL/SQL Wrappers linking to MLE

-- 1. Function Wrapper for calculatePrice
CREATE OR REPLACE FUNCTION get_price_js(p_data JSON, p_is_premium NUMBER) 
RETURN NUMBER 
DETERMINISTIC
AS MLE MODULE sneaker_logic
SIGNATURE 'calculatePrice(any, number)';
/

-- 2. Procedure Wrapper for Purchase Transaction
CREATE OR REPLACE FUNCTION buy_kicks_internal(p_id NUMBER, p_size VARCHAR2, p_user VARCHAR2, p_premium NUMBER)
RETURN JSON
AS MLE MODULE sneaker_logic
SIGNATURE 'purchase(number, string, string, number)';
/

CREATE OR REPLACE PROCEDURE buy_kicks(
    p_id IN NUMBER, 
    p_size IN VARCHAR2, 
    p_user IN VARCHAR2, 
    p_premium IN NUMBER,
    p_status OUT VARCHAR2
)
AS
    v_result JSON;
    v_status VARCHAR2(20);
BEGIN
    v_result := buy_kicks_internal(p_id, p_size, p_user, p_premium);
    v_status := JSON_VALUE(v_result, '$.status');
    p_status := v_status;
END;
/
--rollback DROP PROCEDURE buy_kicks; DROP FUNCTION buy_kicks_internal; DROP FUNCTION get_price_js;
