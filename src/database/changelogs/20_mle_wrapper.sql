--liquibase formatted sql

--changeset sneaker_dev:mle_deploy_v1 runAlways:true
--comment Deploy MLE Module (Source in src/mle/sneaker_logic.js)
-- Usage: script <loader_script> <source_file> <module_name>

CREATE OR REPLACE MLE MODULE SNEAKER_LOGIC LANGUAGE JAVASCRIPT AS
export function hello() {
    return "Hello from MLE";
}
/

-- Check for errors and Raise if Invalid
DECLARE
    v_status VARCHAR2(20);
    v_err_msg VARCHAR2(4000);
BEGIN
    SELECT status INTO v_status FROM user_objects WHERE object_name = 'SNEAKER_LOGIC';
    
    IF v_status <> 'VALID' THEN
        FOR r IN (SELECT text, line, position FROM user_errors WHERE name = 'SNEAKER_LOGIC' ORDER BY sequence) LOOP
            v_err_msg := v_err_msg || 'Line ' || r.line || ': ' || r.text || CHR(10);
        END LOOP;
        raise_application_error(-20001, 'SNEAKER_LOGIC is INVALID: ' || CHR(10) || v_err_msg);
    END IF;
END;
/


--rollback DROP MLE MODULE sneaker_logic;
