# SneakerHeadz Blitz (MLE Edition)

このプロジェクトは、**Oracle Database 23ai MLE (Multilingual Engine)** を活用し、JavaScriptとORDSを用いてデータベース内で完結する高性能なWebアプリケーションロジックを実装したサンプルです。

主な特徴:
- **ハイブリッド・データモデル**: JSON (`SNEAKERS`) + リレーショナル (`ORDERS`)。
- **データベース内 JavaScript**: 価格計算や在庫管理などのビジネスロジックを、MLEを介してDB内部で実行します。
- **REST API**: ORDSにより直接APIを公開（外部のAPサーバーは不要）。

## 前提条件
- Oracle Database 23ai (Always Free, BaseDB, または ATP)
- `ADMIN` 権限を持つユーザー、もしくは `DB_DEVELOPER_ROLE` を持つユーザー。

## インストール手順

### 1. データベース・オブジェクトのセットアップ
**SQL*Plus** または **SQLcl** を使用し、以下のスクリプトを順に実行してください。
*注: `ADMIN` ユーザーでの実行を推奨します。*

```sql
-- 1. テーブル作成
@src/sql/01_ddl.sql

-- 2. MLE JavaScriptモジュール (ビジネスロジック) のデプロイ
-- *23ai向けのIterable対応および配列バインド修正済み*
@src/sql/02_mle_module.sql

-- 3. PL/SQLラッパーと関数インデックスの作成
@src/sql/03_plsql_wrappers.sql

-- 4. ORDS REST API の設定
@src/sql/04_ords_rest.sql
```

> **ヒント**: `SP2-0310` (ファイルが見つかりません) エラーが出る場合は、`@` コマンドでファイルの**絶対パス**を指定してください。

### 2. テストデータの投入
動作確認用にスニーカーのサンプルデータを登録します。

```sql
TRUNCATE TABLE orders;
TRUNCATE TABLE sneakers;

-- 1. 通常商品 (Air Jordan 1)
INSERT INTO sneakers (data) VALUES ('{"model": "Air Jordan 1", "price": 200, "sizes": {"US10": 10, "US9": 1}, "is_collab": false}');

-- 2. コラボ商品 (割引対象外)
INSERT INTO sneakers (data) VALUES ('{"model": "Yeezy Boost", "price": 300, "sizes": {"US10": 5}, "is_collab": true}');

-- 3. 希少商品 (在庫僅少)
INSERT INTO sneakers (data) VALUES ('{"model": "Rare Air", "price": 1000, "sizes": {"US10": 1}, "is_collab": false}');

COMMIT;
```

## 使用方法 (API動作確認)

`<your-db-hostname>` の部分は、実際のADBのホスト名 (例: `nbi1xuni.adb.ap-tokyo-1.oraclecloud.com`) に置き換えてください。
ADMINユーザーのデフォルトORDSベースパスは通常 `/ords/admin` です。

### 1. スニーカー検索 (GET)
**ロジック**: MLEを使用して動的に価格を計算します。プレミアム会員には非コラボ商品に対して10%の割引が適用されます。

```bash
# ケース A: 通常ユーザー (予算: 100,000円)
# 期待される価格: 30,000円 (200ドル * 150円)
curl -X GET "https://nbi1xuni.adb.ap-tokyo-1.oraclecloud.com/ords/admin/api/search?premium=0&budget=100000"

# ケース B: プレミアムユーザー
# 期待される価格: 27,000円 (10%割引適用)
curl -X GET "https://nbi1xuni.adb.ap-tokyo-1.oraclecloud.com/ords/admin/api/search?premium=1&budget=100000"
```

### 2. スニーカー購入 (POST)
**ロジック**: 在庫チェック、在庫の減算(アトミック処理)、注文記録を一括で行います。

```bash
# ケース C: 通常商品の購入 (ID: 1)
curl -X POST "https://nbi1xuni.adb.ap-tokyo-1.oraclecloud.com/ords/admin/api/buy" \
     -H "Content-Type: application/json" \
     -d '{"id": 1, "size": "US10", "user": "test_user", "premium": 0}'

# ケース D: 在庫切れテスト (ID: 3, 在庫: 1)
# 2回実行してください。2回目は失敗するはずです。
curl -X POST "https://nbi1xuni.adb.ap-tokyo-1.oraclecloud.com/ords/admin/api/buy" \
     -H "Content-Type: application/json" \
     -d '{"id": 3, "size": "US10", "user": "late_user", "premium": 0}'
```

## トラブルシューティング

### ORA-04161 と result.next のエラー
Oracle Database 23ai の MLE では、`session.execute` の戻り値は従来の ResultSet ではなく **Iterable** となっています。そのため `.next()` メソッドではなく、`Array.from(result)` や `for..of` ループを使用する必要があります。本プロジェクトでは修正済みのコードを使用しています。

### ORA-04163 や バインドエラー
JavaScriptオブジェクト越しに名前付きバインド変数（例: `:id`）を使用すると、ドライバのバージョンによっては型不一致や「Not Found」エラーが発生することがあります。本プロジェクトでは、より堅牢な **位置指定バインド (Positional Binds, `:1`)** と **配列渡し (`[value]`)** を採用しています。

### ORDS で 404 Not Found が出る場合
1. URLに正しいスキーマエイリアス（デフォルトは `admin`）が含まれているか確認してください。
2. もしスキーママッピングがおかしくなった場合は、以下のSQLでリセットできます:
   ```sql
   BEGIN
     ORDS.ENABLE_SCHEMA(p_enabled => TRUE, p_schema => 'ADMIN', p_url_mapping_pattern => 'admin', ...);
   END;
   ```
