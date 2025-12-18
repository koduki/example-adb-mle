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
    const premiumFlag = (isPremium === true || isPremium === 1);

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
 * @param {number} sneakerId
 * @param {string} size
 * @param {string} userId
 * @param {boolean|number} isPremium
 */
export function purchase(sneakerId, size, userId, isPremium) {
    if (!session) throw new Error("データベースセッションが利用できません");

    /* 0. Bot対策: 過去1分間の購入回数をチェック */
    const recentOrders = Array.from(session.execute(
        "SELECT count(*) as cnt FROM orders WHERE user_id = :1 AND ordered_at > SYSDATE - 1/1440",
        [userId]
    ).rows || []);

    // カラム名は通常大文字 ('CNT')。念のため Object.values でも取得
    const purchaseCount = (recentOrders.length > 0) ? (recentOrders[0].CNT || Object.values(recentOrders[0])[0] || 0) : 0;

    if (purchaseCount >= 3) {
        return { status: "REJECTED", message: `Bot検知: 短時間に購入が集中しています (購入回数: ${purchaseCount})` };
    }

    /* 1. 行ロック (SELECT ... FOR UPDATE) */
    /* 23ai MLEのsession.executeはIterableを返します */
    const rows = Array.from(session.execute(
        "SELECT data FROM sneakers WHERE id = :1 FOR UPDATE",
        [sneakerId]
    ).rows || []);

    if (rows.length === 0) {
        return { status: "FAIL", message: "スニーカーが見つかりません" };
    }

    // JSONデータの取得 (カラム名は通常大文字の 'DATA' だが、念のため小文字もチェック)
    let colVal = rows[0].DATA || rows[0].data;
    let snkData = (typeof colVal === 'string') ? JSON.parse(colVal) : colVal;

    // 2. 在庫チェック
    if (!snkData.sizes || snkData.sizes[size] === undefined) {
        return { status: "FAIL", message: "無効なサイズです" };
    }

    if (snkData.sizes[size] <= 0) {
        return { status: "FAIL", message: "在庫切れです" };
    }

    // 3. 在庫を減らす (メモリ内)
    snkData.sizes[size] = Number(snkData.sizes[size]) - 1;

    // 4. 最終価格の計算
    const finalPrice = calculatePrice(snkData, isPremium);

    /* 5. SNEAKERSテーブルの更新 (JSONの書き戻し) */
    session.execute(
        "UPDATE sneakers SET data = :1 WHERE id = :2",
        [JSON.stringify(snkData), sneakerId]
    );

    /* 6. 注文情報の挿入 */
    session.execute(
        "INSERT INTO orders (sneaker_id, user_id, amount) VALUES (:1, :2, :3)",
        [sneakerId, userId, finalPrice]
    );

    return { status: "SUCCESS", message: "購入完了", price: finalPrice };
}

/**
 * 予算内のスニーカーをJavaScript側でフィルタリングして検索します。
 * 検索結果に対してビジネスロジックを適用するMLEの能力を示しています。
 * 
 * @param {boolean|number} isPremium
 * @param {number} budget
 */
export function searchSneakers(isPremium, budget) {
    if (!session) throw new Error("データベースセッションが利用できません");

    // 全スニーカーを取得
    // 大規模なアプリではSQL側での基本的な絞り込みを併用しますが、
    // ここではJSによる完全なフィルタリングのデモを行います。
    const rows = Array.from(session.execute("SELECT id, data FROM sneakers").rows || []);

    return rows
        .map(row => {
            // カラム名のケース（大文字/小文字）に対応
            const id = row.ID || row.id;
            const dataStr = row.DATA || row.data;

            const snkData = (typeof dataStr === 'string') ? JSON.parse(dataStr) : (dataStr || {});
            const price = calculatePrice(snkData, isPremium);
            return {
                id: id,
                model: snkData.model,
                price: price,
                sizes: snkData.sizes
            };
        })
        .filter(item => item.price <= budget)
        .sort((a, b) => a.price - b.price);
}
