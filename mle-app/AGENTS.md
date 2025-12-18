# Oracle MLE & Liquibase Deployment Tips

This document collects important lessons learned and debugging tips for deploying Oracle MLE (JavaScript) modules using Liquibase and SQLcl.

## 1. MLE Module Syntax (`CREATE MLE MODULE`)

When embedding JavaScript code directly in a SQL changelog, follow these rules strictly:

*   **No Quotes**: Do not use `q'~...~'` or invalid quoting mechanisms for the body. Use the `AS` keyword followed immediately by the raw JavaScript code.
*   **Terminator is Mandatory**: You **MUST** end the module definition with a forward slash (`/`) on a new line after the JavaScript code.
*   **Avoid Single-Line Comments**: Do **NOT** use `//` comments in your JavaScript code if you are using `/` as the delimiter in Liquibase. Liquibase (and SQLcl) may confuse the slashes in `//` with the terminator. Use `/* ... */` block comments instead.

**Bad:**
```javascript
// This comment might break the parser!
export function test() { return 1; }
```

**Good:**
```javascript
/* Safe comment */
export function test() { return 1; }
```

**Good:**
```sql
CREATE MLE MODULE my_mod LANGUAGE JAVASCRIPT AS
export function test() { return 1; }
/ 
-- Slash is critical!
```

### Advanced: Custom Delimiters
If you absolutely must use `//` comments or need alternative termination, you can configure the delimiter in the changeset header:

```sql
--changeset user:id runAlways:true endDelimiter:;;
CREATE MLE MODULE ...
;;
```
*Note: This requires inconsistent usage of `;` vs `;;` vs `/` across your files, so using standard `/` with sanitized comments is generally preferred for consistency.*

## 2. PL/SQL Wrapper Signatures (`SIGNATURE`)

Mapping PL/SQL types to JavaScript types requires specific signatures.

*   **JSON Handling**: Oracle's native `JSON` type maps to the generic `any` type in the MLE signature (it appears as a JS object or string at runtime).
    *   ❌ `SIGNATURE 'calculate(object)'` -> Causes `ORA-04163: invalid mapping`
    *   ✅ `SIGNATURE 'calculate(any)'`

## 3. Liquibase Formatted SQL Headers

Any SQL file used as a changelog (included via `include file=...`) **MUST** start with the Liquibase header.

```sql
--liquibase formatted sql
```

If this header is missing, Liquibase treats it as a "Raw SQL File". Raw SQL files:
1.  Do not support `runOnChange:true`.
2.  Will fail checksum validation if modified (Liquibase expects them to be immutable).
3.  Might be skipped entirely if Liquibase thinks the "Raw File" was already run.

## 4. ORDS Enablement Idempotency

`ORDS.ENABLE_SCHEMA` throws `ORA-20049` if the schema is already enabled. Always wrap it in an idempotency check:

```sql
SELECT COUNT(*) INTO v_count FROM user_ords_schemas WHERE status = 'ENABLED';
IF v_count = 0 THEN
    ORDS.ENABLE_SCHEMA(...);
END IF;
```

## 5. Troubleshooting "No Changes Found"

If Liquibase says "Update Successful" but your verification fails (e.g., function missing):
1.  **Check Git on Target**: Did you run `git pull` on the VM/Client?
2.  **Check Changeset ID**: If `runOnChange` fails to trigger, change the `id` of the changeset (e.g., `v1` -> `v2`) to force a re-run.

## 6. MLE JavaScript `session.execute` API

In Oracle Database 23ai MLE, `session.execute()` returns a **Result Object**, not an Iterable directly.
*   **Incorrect**: `const rows = Array.from(session.execute(...));` // Returns [] or fails
*   **Correct**: `const rows = session.execute(...).rows;` // Access .rows property

The result object structure is approximately:
```json
{
  "metaData": [...],
  "rows": [...]
}
```

## 7. Deployment Tool Consistency & SQLcl Parsing Quirks

If your CI/CD pipeline uses a different tool (e.g., direct `node-oracledb` connection) than your production deployment (e.g., `SQLcl`), you may encounter **"Works on My Machine (or CI)"** issues.

### The `//` Comment Trap
*   **Behavior**: SQLcl (and SQLPlus) can misinterpret JavaScript single-line comments (`//`) as command terminators or invalid syntax, especially when they appear near SQL keywords or delimiters like `/`. This causes code truncation and cryptic `SyntaxError` compilation failures in the database.
*   **Node.js Driver**: The Node.js driver (`oracledb`) sends the entire string to the DB engine, which handles JS parsing correctly, masking this issue during CI tests if you are not using SQLcl there.
*   **Solution**: Always favor block comments (`/* ... */`) inside MLE JavaScript modules embedded in SQL files. This is the safest, most portable approach across all deployment tools.

```javascript
// BAD: May break SQLcl deployment
// const x = 1; 

/* GOOD: Safe everywhere */
/* const x = 1; */
```
