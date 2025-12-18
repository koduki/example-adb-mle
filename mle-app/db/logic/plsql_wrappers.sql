--liquibase formatted sql

--changeset sneaker_dev:wrappers_v5_get_price runOnChange:true
CREATE OR REPLACE FUNCTION get_price_js(p_data JSON, p_is_premium NUMBER) 
RETURN NUMBER 
DETERMINISTIC
AS MLE MODULE sneaker_logic
SIGNATURE 'calculatePrice(any, number)';
/

--changeset sneaker_dev:wrappers_v5_buy_internal runOnChange:true
CREATE OR REPLACE FUNCTION buy_kicks_internal(p_id NUMBER, p_size VARCHAR2, p_user VARCHAR2, p_premium NUMBER)
RETURN JSON
AS MLE MODULE sneaker_logic
SIGNATURE 'purchase(number, string, string, number)';
/

--changeset sneaker_dev:wrappers_v6_search_js runOnChange:true
CREATE OR REPLACE FUNCTION search_sneakers_js(p_premium NUMBER, p_budget NUMBER)
RETURN JSON
AS MLE MODULE sneaker_logic
SIGNATURE 'searchSneakers(number, number)';
/

--changeset sneaker_dev:wrappers_v7_buy_proc runOnChange:true
CREATE OR REPLACE PROCEDURE buy_kicks(
    p_id IN NUMBER, 
    p_size IN VARCHAR2, 
    p_user IN VARCHAR2, 
    p_premium IN NUMBER,
    p_status OUT VARCHAR2
)
AS
    v_result JSON;
BEGIN
    v_result := buy_kicks_internal(p_id, p_size, p_user, p_premium);
    p_status := JSON_SERIALIZE(v_result);
END;
/
--rollback DROP PROCEDURE buy_kicks; DROP FUNCTION search_sneakers_js; DROP FUNCTION buy_kicks_internal; DROP FUNCTION get_price_js;
