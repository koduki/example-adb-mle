--liquibase formatted sql

--changeset sneaker_dev:mle_deploy_v1 runAlways:true
--comment Deploy MLE Module (Source in src/mle/sneaker_logic.js)
-- Usage: script <loader_script> <source_file> <module_name>

script src/scripts/install_mle.js src/mle/sneaker_logic.js sneaker_logic
/

--rollback DROP MLE MODULE sneaker_logic;
