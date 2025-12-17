set serveroutput on
set linesize 200

PROMPT === CHECKING ORDS SCHEMA STATUS ===
SELECT status, pattern, type 
FROM user_ords_schemas;

PROMPT === CHECKING ORDS MODULES ===
SELECT name, uri_prefix, status 
FROM user_ords_modules;

PROMPT === CHECKING ORDS SERVICES (TEMPLATES) ===
SELECT module_name, uri_template, method 
FROM user_ords_templates t
JOIN user_ords_handlers h ON t.id = h.template_id
ORDER BY module_name, uri_template;

exit
