set serveroutput on
set linesize 200
set pagesize 100

PROMPT === CHECKING OBJECT STATUS ===
SELECT object_name, object_type, status 
FROM user_objects 
WHERE object_name = 'SNEAKER_LOGIC';

PROMPT === CHECKING COMPILATION ERRORS ===
SELECT line, position, text 
FROM user_errors 
WHERE name = 'SNEAKER_LOGIC' 
ORDER BY sequence;

PROMPT === CHECKING MODULE SOURCE (FIRST 10 LINES) ===
SELECT substr(text, 1, 100) 
FROM user_source 
WHERE name = 'SNEAKER_LOGIC' 
AND type = 'MLE MODULE' 
AND line <= 10;
exit
