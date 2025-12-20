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

3.  **スキーマのデプロイと初期データの投入**

    付属のスクリプトを使用して、テーブルの作成と初期データの投入（シードデータ）を一括で行うことができます。
    環境変数を設定後、以下のコマンドを実行してください。

    ```bash
    # web-app ディレクトリに移動
    cd web-app

    # 環境変数の設定 (例)
    export DB_HOST=<ALLOYDB_IP>
    export DB_USER=sneaker_user
    export DB_PASSWORD=password

    # 初期化スクリプトの実行
    npm run db:init
    ```

    または、手動で `db/schema/tables.sql` を実行してテーブルのみを作成することも可能です。

### 2. Cloud Run へのデプロイ (Sidecar パターン)

AlloyDB への安全な接続には、**AlloyDB Auth Proxy** の使用が推奨されます。
Cloud Run Functions (第2世代) は Cloud Run 上で動作するため、サイドカーコンテナとして Auth Proxy を配置する構成（Cloud Run Service としてデプロイ）を採用します。

1.  **サービスの定義 (service.yaml)**
    以下の `service.yaml` を作成します。`<PROJECT_ID>`, `<REGION>`, `<ALLOYDB_INSTANCE_URI>` などを適切に置き換えてください。

    ```yaml
    apiVersion: serving.knative.dev/v1
    kind: Service
    metadata:
      name: sneaker-api
      annotations:
        run.googleapis.com/launch-stage: BETA
    spec:
      template:
        metadata:
          annotations:
            run.googleapis.com/execution-environment: gen2
            autoscaling.knative.dev/minScale: "1"
        spec:
          containers:
          - image: us-docker.pkg.dev/cloudrun/container/hello # 実際にはビルドしたアプリのイメージを指定
            env:
            - name: DB_HOST
              value: "127.0.0.1"
            - name: DB_USER
              value: "sneaker_user"
            - name: DB_PASSWORD
              value: "password"
            ports:
            - containerPort: 8080
          - image: gcr.io/alloydb-connectors/alloydb-auth-proxy:latest
            args:
            - "<ALLOYDB_INSTANCE_URI>" # 例: projects/my-project/locations/asia-northeast1/clusters/my-cluster/instances/my-instance
            - "--address=0.0.0.0"
    ```

    *アプリのコンテナイメージは、事前に `gcloud builds submit --tag ...` 等でビルドしておく必要があります。*

2.  **デプロイ**

    ```bash
    gcloud run services replace service.yaml --region asia-northeast1
    ```

**補足:**
もっと手軽に Cloud Run Functions のままデプロイしたい場合は、Node.js の **AlloyDB Connector ライブラリ** (`@google-cloud/alloydb-connector`) をコード内で使用する方法もありますが、Auth Proxy サイドカーパターンは言語に依存せず汎用的に利用可能です。

## GCE からの低レイテンシ接続について

GCE (Load Generator 等) から可能な限り低レイテンシで接続するため、以下の構成を推奨します。

1.  **Direct VPC Egress の使用**:
    上記のデプロイコマンドのように、`--network` と `--subnet` を指定して Direct VPC Egress を使用します。これにより、Serverless VPC Connector を経由せず、より高速に AlloyDB へアクセスできます。

2.  **同一リージョン・同一 VPC**:
    GCE、Cloud Run Functions、AlloyDB を全て同一リージョン (例: `asia-northeast1`) かつ同一 VPC 内に配置します。

3.  **最小インスタンス数**:
    `--min-instances=1` を指定して、コールドスタートによる遅延を回避します。

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
