import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculatePrice, purchase } from '../../src/sneaker_logic.js';

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
        // Mock 1回目 (Botチェック): 購入回数 0
        mockExecutable.mockReturnValueOnce({ rows: [{ CNT: 0 }] });
        // Mock 2回目 (スニーカー検索): 結果なし
        mockExecutable.mockReturnValueOnce({ rows: [] });

        const result = purchase(1, 'US10', 'user1', false);
        expect(result.status).toBe('FAIL');
        expect(result.message).toContain('スニーカーが見つかりません');
    });

    it('should return SUCCESS when stock is available', () => {
        // スニーカーデータ
        const sneakerData = {
            id: 1,
            price: 100,
            sizes: { 'US10': 5 }
        };

        // Mock 1回目 (Botチェック): 購入回数 0
        mockExecutable.mockReturnValueOnce({ rows: [{ CNT: 0 }] });

        // Mock 2回目 (スニーカー検索): データあり
        mockExecutable.mockReturnValueOnce({
            rows: [{ DATA: JSON.stringify(sneakerData) }]
        });

        // Mock 以降 (UPDATE, INSERT)
        mockExecutable.mockReturnValue({});

        const result = purchase(1, 'US10', 'user1', false);

        expect(result.status).toBe('SUCCESS');
        expect(result.price).toBe(15000);

        // Updateが正しい在庫数で呼ばれたか確認
        // SQL実行の順番: 
        // 0: SELECT count(*) (Bot対策)
        // 1: SELECT data (行ロック)
        // 2: UPDATE sneakers
        const updateCall = mockExecutable.mock.calls[2];
        expect(updateCall[0]).toContain('UPDATE sneakers');

        const updatedJsonParam = JSON.parse(updateCall[1][0]);
        expect(updatedJsonParam.sizes['US10']).toBe(4);
    });
});
