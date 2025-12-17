--changeset sneaker_dev:wrappers_v1 runOnChange:true
--comment Create PL/SQL Wrappers linking to MLE
-- force retry minimal v1

CREATE OR REPLACE FUNCTION hello_mle RETURN VARCHAR2
AS MLE MODULE sneaker_logic
SIGNATURE 'hello()';
/
--rollback DROP PROCEDURE buy_kicks; DROP FUNCTION buy_kicks_internal; DROP FUNCTION get_price_js;
