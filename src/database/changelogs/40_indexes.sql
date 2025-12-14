--liquibase formatted sql

--changeset sneaker_dev:indexes_v1 runOnChange:true
--comment Functional Indexes for Performance
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM user_indexes WHERE index_name = 'IDX_SNEAKER_PRICE_STD'
CREATE INDEX idx_sneaker_price_std ON sneakers (get_price_js(data, 0));

--changeset sneaker_dev:indexes_v2 runOnChange:true
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM user_indexes WHERE index_name = 'IDX_SNEAKER_PRICE_PRM'
CREATE INDEX idx_sneaker_price_prm ON sneakers (get_price_js(data, 1));

--rollback DROP INDEX idx_sneaker_price_std; DROP INDEX idx_sneaker_price_prm;
