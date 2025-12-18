-- Run in PDB
ALTER SESSION SET CONTAINER=FREEPDB1;

BEGIN
   FOR idx IN (SELECT 1 FROM dba_users WHERE username = 'SNEAKERHEADZ') LOOP
      RETURN; -- User already exists
   END LOOP;
   
   EXECUTE IMMEDIATE 'CREATE USER sneakerheadz IDENTIFIED BY Welcome12345 QUOTA UNLIMITED ON USERS';
   EXECUTE IMMEDIATE 'GRANT CONNECT, RESOURCE, DBA TO sneakerheadz';
   
   -- 23ai / MLE specific grants
   EXECUTE IMMEDIATE 'GRANT EXECUTE ON JAVASCRIPT TO sneakerheadz';
   EXECUTE IMMEDIATE 'GRANT DB_DEVELOPER_ROLE TO sneakerheadz';
END;
/

-- Enable ORDS for the schema (Metadata setup)
BEGIN
  ORDS.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'SNEAKERHEADZ',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'sneakerheadz',
    p_auto_rest_auth      => FALSE
  );
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ORDS Package not found or error enabling schema. Continuing...');
END;
/
