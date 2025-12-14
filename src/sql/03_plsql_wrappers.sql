-- 03_plsql_wrappers.sql
-- PL/SQL Call Specifications and Wrappers for MLE

-- 1. Function Wrapper for calculatePrice
CREATE OR REPLACE FUNCTION get_price_js(p_data JSON, p_is_premium NUMBER) 
RETURN NUMBER 
DETERMINISTIC
AS MLE MODULE sneaker_logic
SIGNATURE 'calculatePrice(any, number)';
/

-- 2. Functional Indexes for High Performance Search
-- Indexing both Standard (0) and Premium (1) prices allows the optimizer to pick the right index based on the bind variable value or via query rewrites if applicable.
-- Ideally, the app passes 0 or 1.
CREATE INDEX idx_sneaker_price_std ON sneakers (get_price_js(data, 0));
CREATE INDEX idx_sneaker_price_prm ON sneakers (get_price_js(data, 1));

-- 3. Procedure Wrapper for Purchase Transaction
-- First, define a function to bridge to JS
CREATE OR REPLACE FUNCTION buy_kicks_internal(p_id NUMBER, p_size VARCHAR2, p_user VARCHAR2, p_premium NUMBER)
RETURN JSON
AS MLE MODULE sneaker_logic
SIGNATURE 'purchase(number, string, string, number)';
/

-- Then, the user-facing procedure compatible with ORDS (OUT parameter)
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
    -- Call the MLE function
    v_result := buy_kicks_internal(p_id, p_size, p_user, p_premium);
    
    -- Extract status using JSON_VALUE
    v_status := JSON_VALUE(v_result, '$.status');
    p_status := v_status;
END;
/
