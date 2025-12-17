set serveroutput on
set linesize 200
set pagesize 100

PROMPT === CHECKING OBJECT STATUS ===
SELECT object_name, object_type, status 
FROM user_objects 
WHERE object_name IN ('SNEAKER_LOGIC', 'GET_PRICE_JS', 'BUY_KICKS', 'BUY_KICKS_INTERNAL')
ORDER BY object_type, object_name;

PROMPT === CHECKING COMPILATION ERRORS ===
SELECT name, line, position, text 
FROM user_errors 
WHERE name IN ('SNEAKER_LOGIC', 'GET_PRICE_JS', 'BUY_KICKS', 'BUY_KICKS_INTERNAL')
ORDER BY name, sequence;

PROMPT === CHECKING MODULE SOURCE (FIRST 10 LINES) ===
SELECT substr(text, 1, 100) 
FROM user_source 
WHERE name = 'SNEAKER_LOGIC' 
AND type = 'MLE MODULE' 
AND line <= 10;
exit
