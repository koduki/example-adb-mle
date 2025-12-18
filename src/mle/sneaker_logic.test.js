import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculatePrice, purchase } from './sneaker_logic.js';

describe('calculatePrice', () => {
    it('should calculate basic price correctly', () => {
        const data = { price: 100, is_collab: 0 };
        const price = calculatePrice(data, false); // 100 * 150 = 15000
        expect(price).toBe(15000);
    });

    it('should apply 10% discount for premium users on non-collab items', () => {
        const data = { price: 100, is_collab: 0 };
        const price = calculatePrice(data, true); // 15000 * 0.9 = 13500
        expect(price).toBe(13500);
    });

    it('should NOT apply discount for premium users on collab items', () => {
        const data = { price: 100, is_collab: 1 };
        const price = calculatePrice(data, true); // 15000 (no discount)
        expect(price).toBe(15000);
    });
});

describe('purchase', () => {
    let mockSession;
    let mockExecutable;

    beforeEach(() => {
        // Mock the global session object
        mockExecutable = vi.fn();
        mockSession = {
            execute: mockExecutable
        };
        vi.stubGlobal('session', mockSession);
    });

    it('should return FAIL if sneaker not found', () => {
        // Mock empty result
        mockExecutable.mockReturnValue({ rows: [] });

        const result = purchase(1, 'US10', 'user1', false);
        expect(result.status).toBe('FAIL');
        expect(result.message).toContain('Sneaker not found');
    });

    it('should return SUCCESS when stock is available', () => {
        // Mock data found
        const sneakerData = {
            id: 1,
            price: 100,
            sizes: { 'US10': 5 }
        };

        // Mock first call (SELECT)
        // Oracle MLE returns rows as array of objects, usually uppercase columns for SQL
        mockExecutable.mockReturnValueOnce({
            rows: [{ DATA: JSON.stringify(sneakerData) }]
        });

        // Mock subsequent calls (UPDATE, INSERT) - return value doesn't matter much for void
        mockExecutable.mockReturnValue({});

        const result = purchase(1, 'US10', 'user1', false);

        expect(result.status).toBe('SUCCESS');
        expect(result.price).toBe(15000);

        // Verify Update was called with decremented stock
        // Update call is the 2nd call (index 1)
        const updateCall = mockExecutable.mock.calls[1];
        expect(updateCall[0]).toContain('UPDATE sneakers');

        const updatedJsonParam = JSON.parse(updateCall[1][0]);
        expect(updatedJsonParam.sizes['US10']).toBe(4);
    });
});
