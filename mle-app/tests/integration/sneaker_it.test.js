import { GenericContainer, Wait } from "testcontainers";
import oracledb from "oracledb";
import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { describe, it, beforeAll, afterAll, expect } from "vitest";

// Set timeout to 5 minutes as Oracle container takes time to start
describe("SneakerHeadz Integration Test", { timeout: 300000 }, () => {
    let container;
    let dbPort;
    let connectionString;
    const dbPassword = "Welcome12345";
    const sysPassword = "Welcome12345"; // Default for the image used if manually set or default

    // Increase timeout for beforeAll specifically as DB startup is slow
    beforeAll(async () => {
        console.log("Starting Oracle Database container...");

        container = await new GenericContainer("gvenzl/oracle-free:23.26.0")
            .withExposedPorts(1521)
            .withEnvironment({ "ORACLE_PASSWORD": sysPassword })
            .withWaitStrategy(Wait.forLogMessage("DATABASE IS READY TO USE"))
            .start();

        dbPort = container.getMappedPort(1521);
        const host = container.getHost();
        connectionString = `${host}:${dbPort}/freepdb1`;

        console.log(`Oracle Database started at ${connectionString}`);

        // 1. Setup User and Grants using SYS account
        await setupDatabase(host, dbPort, sysPassword);

        // 2. Deploy Schema using existing deploy_db.js
        await deployDatabase(connectionString);
    }, 300000); // 5 minutes timeout

    afterAll(async () => {
        if (container) {
            await container.stop();
        }
    });

    it("should process a purchase successfully", async () => {
        const connection = await oracledb.getConnection({
            user: "sneakerheadz",
            password: dbPassword,
            connectString: connectionString,
        });

        try {
            // [1] 初期在庫の確認
            const initialResult = await connection.execute(
                `SELECT s.data.sizes."US10" as stock FROM sneakers s WHERE id = 1`
            );
            const initialStock = initialResult.rows[0][0];
            console.log(`Initial Stock: ${initialStock}`);
            expect(initialStock).toBeGreaterThan(0);

            // [2] 購入実行
            const bindVars = {
                p_id: 1,
                p_size: "US10",
                p_user: "normal_user",
                p_premium: 0,
                p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
            };

            await connection.execute(
                `BEGIN buy_kicks(:p_id, :p_size, :p_user, :p_premium, :p_status); END;`,
                bindVars
            );

            console.log("Purchase executed.");

            // [3] 在庫減少の確認
            const finalResult = await connection.execute(
                `SELECT s.data.sizes."US10" as stock FROM sneakers s WHERE id = 1`
            );
            const finalStock = finalResult.rows[0][0];
            console.log(`Final Stock: ${finalStock}`);

            expect(finalStock).toBe(initialStock - 1);

        } finally {
            await connection.close();
        }
    });

    it("should reject the 4th purchase attempt from the same user (Bot Protection)", async () => {
        const connection = await oracledb.getConnection({
            user: "sneakerheadz",
            password: dbPassword,
            connectString: connectionString,
        });

        try {
            const userId = "bot_user";
            let results = [];

            // 5回連続で購入を試みる
            for (let i = 1; i <= 5; i++) {
                const bindVars = {
                    p_id: 1,
                    p_size: "US10",
                    p_user: userId,
                    p_premium: 0,
                    p_status: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
                };

                const result = await connection.execute(
                    `BEGIN buy_kicks(:p_id, :p_size, :p_user, :p_premium, :p_status); END;`,
                    bindVars,
                    { autoCommit: true }
                );
                const response = JSON.parse(result.outBinds.p_status);
                results.push(response.status);
            }

            console.log(`Purchase attempts statuses: ${results.join(", ")}`);

            // 最初の3回は成功、4回目以降はREJECTED
            expect(results[0]).toBe("SUCCESS");
            expect(results[1]).toBe("SUCCESS");
            expect(results[2]).toBe("SUCCESS");
            expect(results[3]).toBe("REJECTED");
            expect(results[4]).toBe("REJECTED");

        } finally {
            await connection.close();
        }
    });

    async function setupDatabase(host, port, sysPwd) {
        console.log("Setting up database user...");
        const validConnString = `${host}:${port}/freepdb1`;

        const connection = await oracledb.getConnection({
            user: "sys",
            password: sysPwd,
            connectString: validConnString,
            privilege: oracledb.SYSDBA,
        });

        try {
            await connection.execute(`
                BEGIN
                   EXECUTE IMMEDIATE 'CREATE USER sneakerheadz IDENTIFIED BY Welcome12345 QUOTA UNLIMITED ON USERS';
                   EXECUTE IMMEDIATE 'GRANT CONNECT, RESOURCE, DBA TO sneakerheadz';
                   EXECUTE IMMEDIATE 'GRANT EXECUTE ON JAVASCRIPT TO sneakerheadz';
                   EXECUTE IMMEDIATE 'GRANT DB_DEVELOPER_ROLE TO sneakerheadz';
                END;
            `);

            /*
            // Enable ORDS (Metadata only, for context match)
            await connection.execute(`
                BEGIN
                  ORDS.ENABLE_SCHEMA(
                    p_enabled             => TRUE,
                    p_schema              => 'SNEAKERHEADZ',
                    p_url_mapping_type    => 'BASE_PATH',
                    p_url_mapping_pattern => 'sneakerheadz',
                    p_auto_rest_auth      => FALSE
                  );
                EXCEPTION
                  WHEN OTHERS THEN NULL;
                END;
            `);
            */

            console.log("User 'sneakerheadz' created and configured.");
        } finally {
            await connection.close();
        }
    }

    async function deployDatabase(connStr) {
        console.log("Running deployment directly via Node.js...");

        // 1. Build MLE module (generates 20_mle_wrapper.sql)
        console.log("Building MLE module...");
        const projectRoot = path.resolve(__dirname, "../../");
        execSync("npm run build", { cwd: projectRoot, stdio: 'inherit' });

        const connection = await oracledb.getConnection({
            user: "sneakerheadz",
            password: "Welcome12345",
            connectString: connStr,
        });

        const changelogDir = path.join(projectRoot, "dist/db");

        try {
            // Helper to execute script file
            const executeFile = async (fileName, type) => {
                const filePath = path.join(changelogDir, fileName);
                console.log(`Executing ${fileName}...`);
                let content = fs.readFileSync(filePath, 'utf8');

                // Remove Liquibase comments and formatted sql headers
                content = content.replace(/^--liquibase formatted sql.*$/m, '');
                content = content.replace(/^--changeset.*$/gm, '');
                content = content.replace(/^--preconditions.*$/gm, '');
                content = content.replace(/^--precondition-sql-check.*$/gm, '');
                content = content.replace(/^--rollback.*$/gm, '');
                content = content.replace(/^--comment.*$/gm, '');

                let statements = [];
                if (type === 'sql') {
                    // Split by semicolon, filter empty
                    statements = content.split(';').map(s => s.trim()).filter(s => s.length > 0);
                } else if (type === 'plsql') {
                    // Split by slash on a new line
                    statements = content.split(/\n\/\s*($|\n)/).map(s => s.trim()).filter(s => s.length > 0);
                }

                for (const sql of statements) {
                    if (!sql) continue;
                    try {
                        await connection.execute(sql);
                    } catch (err) {
                        // Ignore "name is start used" errors if any, but clean DB shouldn't have them
                        if (err.errorNum !== 955) { // ORA-00955: name is already in use
                            console.error(`Error executing SQL in ${fileName}:`, sql.substring(0, 100) + "...");
                            throw err;
                        }
                    }
                }
            };

            await executeFile("schema/tables.sql", "sql");
            await executeFile("logic/mle_module.sql", "plsql");
            await executeFile("logic/plsql_wrappers.sql", "plsql");
            // Skipping api/ords_definitions.sql as ORDS is not in the container

            console.log("Deployment execution code finished.");

            // Seed Initial Data for Test
            console.log("Seeding initial data...");
            await connection.execute(`
                INSERT INTO sneakers (id, data) 
                VALUES (1, '{"model": "AJ1", "price": 150, "sizes": {"US10": 10}}')
            `);
            await connection.commit();

        } finally {
            await connection.close();
        }
    }
});
