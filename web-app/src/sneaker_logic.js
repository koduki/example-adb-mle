// 設定
const RATE_USD_JPY = 150;

/**
 * USD価格とプレミアムステータスに基づいて、円換算価格を計算します。
 * 
 * @param {object} data - スニーカーのJSONオブジェクト
 * @param {boolean|number} isPremium - プレミアムユーザーの場合は1またはtrue
 */
export function calculatePrice(data, isPremium) {
    if (!data || typeof data !== 'object') return null;

    const priceUsd = Number(data.price) || 0;
    const isCollab = !!data.is_collab;

    // SQLからのブーリアン入力（通常0 または 1）を正規化
    // Also handle string "true"/"false" from query params
    const premiumFlag = (isPremium === true || isPremium === 1 || isPremium === 'true' || isPremium === '1');

    let priceJpy = priceUsd * RATE_USD_JPY;

    /* ロジック: プレミアムユーザーかつ非コラボモデルの場合、10%割引 */
    if (premiumFlag && !isCollab) {
        priceJpy = priceJpy * 0.9;
    }

    return Math.floor(priceJpy);
}

/**
 * トランザクションを伴う購入ロジック。
 * ワンショット・トランザクションとしてカプセル化されています。
 * 
 * @param {object} pool - Database pool/client
 * @param {number} sneakerId
 * @param {string} size
 * @param {string} userId
 * @param {boolean|number} isPremium
 */
export async function purchase(pool, sneakerId, size, userId, isPremium) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        /* 0. Bot対策: 過去1分間の購入回数をチェック */
        const recentOrdersRes = await client.query(
            "SELECT count(*) as cnt FROM orders WHERE user_id = $1 AND ordered_at > NOW() - INTERVAL '1 minute'",
            [userId]
        );

        const purchaseCount = parseInt(recentOrdersRes.rows[0].cnt || 0, 10);

        if (purchaseCount >= 3) {
            await client.query('ROLLBACK');
            return { status: "REJECTED", message: `Bot検知: 短時間に購入が集中しています (購入回数: ${purchaseCount})` };
        }

        /* 1. 行ロック (SELECT ... FOR UPDATE) */
        const rowsRes = await client.query(
            "SELECT data FROM sneakers WHERE id = $1 FOR UPDATE",
            [sneakerId]
        );

        if (rowsRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return { status: "FAIL", message: "スニーカーが見つかりません" };
        }

        // JSONデータの取得
        let snkData = rowsRes.rows[0].data;
        if (typeof snkData === 'string') {
            snkData = JSON.parse(snkData);
        }

        // 2. 在庫チェック
        if (!snkData.sizes || snkData.sizes[size] === undefined) {
             await client.query('ROLLBACK');
            return { status: "FAIL", message: "無効なサイズです" };
        }

        if (snkData.sizes[size] <= 0) {
             await client.query('ROLLBACK');
            return { status: "FAIL", message: "在庫切れです" };
        }

        // 3. 在庫を減らす (メモリ内)
        snkData.sizes[size] = Number(snkData.sizes[size]) - 1;

        // 4. 最終価格の計算
        const finalPrice = calculatePrice(snkData, isPremium);

        /* 5. SNEAKERSテーブルの更新 (JSONの書き戻し) */
        await client.query(
            "UPDATE sneakers SET data = $1 WHERE id = $2",
            [snkData, sneakerId]
        );

        /* 6. 注文情報の挿入 */
        await client.query(
            "INSERT INTO orders (sneaker_id, user_id, amount) VALUES ($1, $2, $3)",
            [sneakerId, userId, finalPrice]
        );

        await client.query('COMMIT');
        return { status: "SUCCESS", message: "購入完了", price: finalPrice };

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

/**
 * 予算内のスニーカーをJavaScript側でフィルタリングして検索します。
 * 
 * @param {object} pool - Database pool
 * @param {boolean|number} isPremium
 * @param {number} budget
 */
export async function searchSneakers(pool, isPremium, budget) {
    // 全スニーカーを取得
    const res = await pool.query("SELECT id, data FROM sneakers");

    return res.rows
        .map(row => {
            let snkData = row.data;
            if (typeof snkData === 'string') {
                snkData = JSON.parse(snkData);
            }

            const price = calculatePrice(snkData, isPremium);
            return {
                id: row.id,
                model: snkData.model,
                price: price,
                sizes: snkData.sizes
            };
        })
        .filter(item => item.price <= budget)
        .sort((a, b) => a.price - b.price);
}
