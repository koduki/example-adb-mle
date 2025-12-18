-- Setup Test Data for API Verification
DELETE FROM orders;
DELETE FROM sneakers;

INSERT INTO sneakers (id, data) VALUES (1, '{"model": "Air Jordan 1", "price": 200, "is_collab": 0, "sizes": {"US10": 5}}');
INSERT INTO sneakers (id, data) VALUES (2, '{"model": "Travis Scott x AJ1", "price": 1000, "is_collab": 1, "sizes": {"US10": 2}}');
COMMIT;
PROMPT Test Data Initialized.
exit
