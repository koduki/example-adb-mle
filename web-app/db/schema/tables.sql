--liquibase formatted sql

--changeset sneaker_dev:tables_v1_sneakers
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_name = 'sneakers'
CREATE TABLE sneakers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    data JSONB
);

--changeset sneaker_dev:tables_v1_orders
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_name = 'orders'
CREATE TABLE orders (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sneaker_id INTEGER,
    user_id VARCHAR(100),
    amount INTEGER,
    ordered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

--rollback DROP TABLE orders; DROP TABLE sneakers;
