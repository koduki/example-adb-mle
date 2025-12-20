-- Setup Test Data for API Verification
DELETE FROM orders;
DELETE FROM sneakers;

INSERT INTO sneakers (id, data) VALUES (1, '{"model": "Air Jordan 1", "price": 200, "is_collab": 0, "sizes": {"US9": 99999, "US10": 99999, "US11": 99999}}');
INSERT INTO sneakers (id, data) VALUES (2, '{"model": "Travis Scott x AJ1", "price": 1000, "is_collab": 1, "sizes": {"US9": 99999, "US10": 99999, "US11": 99999}}');
COMMIT;
PROMPT Test Data Initialized.
exit
