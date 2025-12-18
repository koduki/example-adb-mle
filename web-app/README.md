# SneakerHeadz Web App (Cloud Run Functions + AlloyDB)

このディレクトリには、SneakerHeadz アプリケーションの Node.js 版が含まれています。Oracle MLE 版と同等の機能を Cloud Run Functions と AlloyDB (PostgreSQL) で提供します。

## 前提条件

* Google Cloud Project
* gcloud CLI
* PostgreSQL クライアント (psql など)
* k6 (負荷テスト用)

## セットアップ手順

### 1. AlloyDB (PostgreSQL) のセットアップ

1.  **AlloyDB クラスターとインスタンスの作成**
    Google Cloud Console または `gcloud` コマンドを使用して、AlloyDB for PostgreSQL クラスターとプライマリインスタンスを作成します。

2.  **データベースとユーザーの作成**
    インスタンスに接続し、アプリケーション用のデータベースとユーザーを作成します。
    ```sql
    CREATE DATABASE sneakers;
    CREATE USER sneaker_user WITH PASSWORD 'password';
    GRANT ALL PRIVILEGES ON DATABASE sneakers TO sneaker_user;
    -- データベースに接続後、スキーマ権限も付与
    \c sneakers
    GRANT ALL ON SCHEMA public TO sneaker_user;
    ```

3.  **スキーマのデプロイ**
    `db/schema/tables.sql` を使用してテーブルを作成します。
    ```bash
    # プロジェクトルートから実行する場合
    psql -h <ALLOYDB_IP> -U postgres -d sneakers -f web-app/db/schema/tables.sql
    ```
    ※ Liquibase 形式のコメントが含まれていますが、標準的な SQL クライアントでも DDL 部分は実行可能です。

### 2. Cloud Run Functions のデプロイ

Cloud Run Functions (第2世代) としてデプロイします。AlloyDB はプライベート IP を持つため、VPC コネクタまたは Direct VPC Egress の設定が必要です。

```bash
# web-app ディレクトリに移動
cd web-app

# デプロイコマンド例
gcloud functions deploy sneakerApi \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=sneakerApi \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars DB_HOST=<ALLOYDB_IP>,DB_USER=sneaker_user,DB_PASSWORD=password,DB_NAME=sneakers,DB_PORT=5432
```
※ `<ALLOYDB_IP>` は AlloyDB インスタンスのプライベート IP アドレスに置き換えてください。
※ VPC 接続設定 (`--vpc-connector` など) を環境に合わせて追加してください。

## テスト方法

デプロイ完了後、発行された URL (例: `https://asia-northeast1-myproject.cloudfunctions.net/sneakerApi`) を使用してテストします。

### curl による動作確認

**1. スニーカー検索 (GET)**

```bash
FUNCTION_URL="https://<YOUR_FUNCTION_URL>"

# 予算 20000円以内、プレミアム会員なし
curl "${FUNCTION_URL}/api/search?budget=20000&premium=false"
```

**2. スニーカー購入 (POST)**

```bash
# ID:1 のスニーカーをサイズ US10 で購入
curl -X POST "${FUNCTION_URL}/api/buy" \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "size": "US10", "user": "test_user_01", "premium": false}'
```

### k6 による負荷テスト

リポジトリのルートにある `k6/load_test.js` を使用して、負荷テストを実行できます。

1.  **データ準備**
    テストを実行する前に、初期データ (ID: 1 のスニーカーなど) が投入されていることを確認してください。
    ```sql
    INSERT INTO sneakers (id, data) VALUES (1, '{"model": "AJ1", "price": 100, "is_collab": 0, "sizes": {"US10": 100, "US9": 50}}');
    ```

2.  **テスト実行**
    `BASE_URL` 環境変数に Functions の URL を指定して k6 を実行します。

    ```bash
    # プロジェクトルートディレクトリで実行
    k6 run -e BASE_URL="https://<YOUR_FUNCTION_URL>" k6/load_test.js
    ```

    `load_test.js` は、`/api/search` と `/api/buy` に対してリクエストを送信し、ボット対策 (短時間の連続購入拒否) の挙動などを検証します。
