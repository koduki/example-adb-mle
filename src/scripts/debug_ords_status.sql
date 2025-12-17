set serveroutput on
set linesize 200

PROMPT === CHECKING ORDS SCHEMA STATUS ===
SELECT status, pattern, type 
FROM user_ords_schemas;

PROMPT === CHECKING ORDS MODULES ===
SELECT name, uri_prefix, status 
FROM user_ords_modules;

PROMPT === CHECKING ORDS SERVICES (TEMPLATES) ===
SELECT m.name AS module_name, t.uri_template, h.method 
FROM user_ords_modules m
JOIN user_ords_templates t ON m.id = t.module_id
JOIN user_ords_handlers h ON t.id = h.template_id
ORDER BY m.name, t.uri_template;

exit
