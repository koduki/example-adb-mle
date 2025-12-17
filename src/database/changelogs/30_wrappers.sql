--changeset sneaker_dev:wrappers_v1 runOnChange:true
--comment Create PL/SQL Wrappers linking to MLE
-- force retry step-by-step echo v1

CREATE OR REPLACE FUNCTION hello_mle RETURN VARCHAR2
AS MLE MODULE sneaker_logic
SIGNATURE 'hello()';
/

CREATE OR REPLACE FUNCTION echo_mle(p_msg VARCHAR2) RETURN VARCHAR2
AS MLE MODULE sneaker_logic
SIGNATURE 'echo(string)';
/
--rollback DROP PROCEDURE buy_kicks; DROP FUNCTION buy_kicks_internal; DROP FUNCTION get_price_js;
