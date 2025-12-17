--liquibase formatted sql

--changeset sneaker_dev:wrappers_v2_echo runOnChange:true
--comment Create PL/SQL Wrappers linking to MLE
-- force retry echo v3 (explicit force)

CREATE OR REPLACE FUNCTION hello_mle RETURN VARCHAR2
AS MLE MODULE sneaker_logic
SIGNATURE 'hello()';
/

CREATE OR REPLACE FUNCTION echo_mle(p_msg VARCHAR2) RETURN VARCHAR2
AS MLE MODULE sneaker_logic
SIGNATURE 'echo(string)';
/
--rollback DROP PROCEDURE buy_kicks; DROP FUNCTION buy_kicks_internal; DROP FUNCTION get_price_js;
