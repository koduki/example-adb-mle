SET SERVEROUTPUT ON
SET FEEDBACK ON

PROMPT === OBJECT STATUS ===
SELECT object_name, object_type, status 
FROM user_objects 
WHERE object_name IN ('SNEAKER_LOGIC', 'GET_PRICE_JS');

PROMPT === SNEAKER_LOGIC ERRORS ===
SELECT text 
FROM user_errors 
WHERE name = 'SNEAKER_LOGIC';

PROMPT === SNEAKER_LOGIC SOURCE HEAD ===
-- Try to retrieve first few lines of source to check for quotes/garbage
SELECT text 
FROM user_source 
WHERE name = 'SNEAKER_LOGIC' 
AND type = 'MLE MODULE'
AND line <= 5;

PROMPT === TEST COMPILE WRAPPER MANUAL ===
CREATE OR REPLACE FUNCTION debug_get_price(p_data JSON, p_is_premium NUMBER) 
RETURN NUMBER 
AS MLE MODULE sneaker_logic
SIGNATURE 'calculatePrice(object, number)';
/
SHOW ERRORS

EXIT
