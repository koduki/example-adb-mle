# SneakerHeadz Blitz (MLE Edition)

このプロジェクトは、**Oracle Database 23ai MLE (Multilingual Engine)** を活用し、JavaScriptとORDSを用いてデータベース内で完結する高性能なWebアプリケーションロジックを実装したサンプルです。

## アーキテクチャ解説

本アプリケーションは、**「在庫管理」における厳密な整合性** と **「Web API」としての使いやすさ** を両立するために、以下のハイブリッド構成を採用しています。

### 1. データフローとコンポーネント

```mermaid
graph TD
    User((User)) -->|POST /api/buy| ORDS[ORDS (REST API)]
    subgraph Oracle Database 23ai
        ORDS -->|Binds :id, :user| PLSQL[PL/SQL Wrapper (buy_kicks)]
        PLSQL -->|Call| MLE[JavaScript Logic (purchase)]
        
        MLE -->|1. Lock & Get| Sneakers[(Sneakers Table / JSON)]
        MLE -->|2. Calc Price| Logic{Pricing Logic}
        MLE -->|3. Update Stock| Sneakers
        MLE -->|4. Record Order| Orders[(Orders Table / Relational)]
    end
    MLE -->|Return Result| PLSQL
    PLSQL -->|JSON Response| User
```

### 2. 具体的なコードの振る舞い (購入処理の例)

ユーザーが `POST /api/buy` を叩いたとき、システム内部では以下のようにバトンが渡されます。

#### A. 入り口: ORDS (src/ords/sneaker_api.sql)
HTTPリクエストを受け取り、JSONボディの値（`id`, `size` 等）を自動的にバインド変数に変換して PL/SQL を呼び出します。
```sql
ORDS.DEFINE_SERVICE(
  p_pattern => 'buy',
  p_source  => 'BEGIN buy_kicks(:id, :size, :user, :premium, :status); END;'
);
```

#### B. 橋渡し: PL/SQL Wrapper (src/plsql/wrappers.sql)
プロシージャ `buy_kicks` は、単なる「土管」として機能し、実際の処理をJavaScript関数 `purchase` へ委譲します。
```sql
-- JSの 'purchase' 関数へマッピング
SIGNATURE 'purchase(number, string, string, number)';
```

#### C. コアロジック: MLE JavaScript (src/mle/sneaker_logic.js)
ここが心臓部です。GraalVM上で動作するJavaScriptが、データベースと直結してビジネスロジックを実行します。

1.  **行ロックによる同時実行制御**:
    ```javascript
    // SELECT ... FOR UPDATE で対象のスニーカー行をロック。
    // 他の人が同時に買おうとしても、この処理が終わるまで待たされます（在庫の矛盾を防ぐ）。
    const rows = session.execute(..., "SELECT data FROM sneakers ... FOR UPDATE", [id]);
    ```
2.  **インメモリでの在庫チェック & 減算**:
    ```javascript
    // DBから取得したJSONオブジェクトをメモリ上で操作
    if (snkData.sizes[size] <= 0) return { status: "FAIL", message: "Out of stock" };
    snkData.sizes[size] -= 1; // 在庫を減らす
    ```
3.  **データベースへの書き戻し**:
    ```javascript
    // 更新後のJSONをDBに保存
    session.execute("UPDATE sneakers SET data = :1 ...", [JSON.stringify(snkData), id]);
    // 注文履歴も同時に記録（同一トランザクション）
    session.execute("INSERT INTO orders ...", ...);
    ```

この一連の流れが **1つのデータベーストランザクション** として完結するため、ネットワーク遅延も発生せず、データの不整合も起きません。これが "SmartDB" アーキテクチャの強みです。

---

## 前提条件
- Oracle Database 23ai (Always Free, BaseDB, または ATP)
- `ADMIN` 権限を持つユーザー、もしくは `DB_DEVELOPER_ROLE` を持つユーザー
- Linux 環境 または GitHub Actions (CI/CD)
- **SQLcl** がインストールされていること

## ディレクトリ構成
```text
/
├── .github/workflows/   # GitHub Actions (CI/CD) 定義
├── deploy.sh            # デプロイ用スクリプト (Bash)
├── src/
│   ├── database/        # テーブル定義 (DDL)
│   ├── mle/             # MLE JavaScript ロジック (.js)
│   ├── plsql/           # PL/SQL ラッパー
│   └── ords/            # ORDS API 定義
```

## ディレクトリ構成
```text
/
├── .github/workflows/   # GitHub Actions (CI/CD) 定義
├── src/
│   └── database/
│       ├── controller.xml       # Root Changelog (ここから全て実行)
│       └── changelogs/          # Liquibase 定義ファイル
│           ├── mle_logic.sql    # MLE JavaScript ロジック (SQLラップ)
│           ├── tables_lb.sql    # テーブル定義
│           ├── wrappers.sql     # PL/SQL ラッパー
│           └── ords.sql         # ORDS API 定義
```

## デプロイ手順 (SQLcl & Liquibase)

本プロジェクトでは **Liquibase** を使用してデータベースの状態を管理します。
SQLcl がインストールされた環境であれば、以下のコマンド一発で最新の状態へ移行できます。

```bash
# Liquibase update コマンドを実行
sql -silent "ADMIN/your_password@host:port/service_name" lb update -changelog src/controller.xml
```

このコマンドは `src/controller.xml` を読み込み、変更が必要な部分（差分）のみをデータベースに適用します。
JavaScriptロジックやPL/SQLを修正した場合は、自動的に再デプロイされます (`runOnChange:true` 設定済み)。

### GitHub Actions での実行
`.github/workflows/deploy.yml` はこの `script` コマンドを直接実行するように設定されています。
Githubの設定(Secrets)に `ORACLE_DB_CONNECTION` を追加してください。

## 動作確認 (Verification)

デプロイ完了後、以下の `curl` コマンドで動作を確認できます。

### 1. 検索 (GET)
```bash
# 通常ユーザー検索 (30,000 JPY)
curl -X GET "https://nbi1xuni.adb.ap-tokyo-1.oraclecloud.com/ords/admin/api/search?premium=0&budget=100000"

# プレミアムユーザー検索 (27,000 JPY)
curl -X GET "https://nbi1xuni.adb.ap-tokyo-1.oraclecloud.com/ords/admin/api/search?premium=1&budget=100000"
```

### 2. 購入 (POST)
```bash
# 購入実行
curl -X POST "https://nbi1xuni.adb.ap-tokyo-1.oraclecloud.com/ords/admin/api/buy" \
     -H "Content-Type: application/json" \
     -d '{"id": 1, "size": "US10", "user": "test_linux", "premium": 0}'
```
