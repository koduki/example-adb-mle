# Local Oracle 23ai Free Environment

This directory contains the Docker configuration to run Oracle Database 23ai Free locally for development and testing.

## Prerequisites

- Docker Desktop / Docker Engine
- Node.js (for deployment script)
- SQLcl (optional, for manual verification)

## Quick Start

### 1. Start the Database

Run the following command from the `infra` directory:

```powershell
docker-compose up -d
```

This will:
- Start the Oracle 23ai Free container.
- Expose the database on port `1521`.
- Automatically create the `SNEAKERHEADZ` user and grant necessary privileges (via `scripts/01_setup.sql`).

**Note:** The database may take a few minutes to fully initialize on the first run. You can check status with `docker logs -f oracle23ai`. Wait until you see "DATABASE IS READY TO USE".

### 2. Deploy Application

Once the database is ready, run the deployment script from the project root:

```powershell
./scripts/deploy_local.ps1
```

This script will run Liquibase updates against the local container using the `SNEAKERHEADZ` schema.

### 3. Verify Connection (疎通テスト)

You can verify the connection using SQLcl:

```bash
sql sneakerheadz/Welcome12345@localhost:1521/freepdb1
```

Or check the deployment:

```sql
SELECT count(*) FROM databasechangelog;
```

## API Testing (ORDS)

This setup runs the database. To test the API endpoints (`/api/search`, `/api/buy`) which rely on Oracle REST Data Services (ORDS):

1.  **If you have ORDS installed locally:**
    Configure it to connect to `localhost:1521/freepdb1` and start standalone mode.
2.  **Using SQL Verification:**
    You can verify the MLE logic directly via SQL without ORDS:
    
    ```sql
    -- Test Pricing Logic
    SELECT get_price_js(json('{"price":100}'), 0) FROM dual;
    
    -- Test Purchase Procedure
    VAR status VARCHAR2(4000);
    EXEC buy_kicks(1, 'US10', 'test_user', 0, :status);
    PRINT status;
    ```
