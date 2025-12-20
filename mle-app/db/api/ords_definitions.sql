--liquibase formatted sql

--changeset sneaker_dev:ords_v3_fix_json runOnChange:true
--preconditions onFail:MARK_RAN onError:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM all_synonyms WHERE synonym_name = 'ORDS' AND owner = 'PUBLIC'
--comment ORDS Services Definition

BEGIN
  -- Enable ORDS for the current schema if not already enabled
  DECLARE
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_ords_schemas WHERE status = 'ENABLED';
    IF v_count = 0 THEN
        ORDS.ENABLE_SCHEMA(
            p_enabled             => TRUE,
            p_schema              => USER,
            p_url_mapping_type    => 'BASE_PATH',
            p_url_mapping_pattern => 'sneakerheadz',
            p_auto_rest_auth      => FALSE
        );
    END IF;
  END;

  -- MODULE: sneaker_v1
  ORDS.DEFINE_MODULE(
    p_module_name    => 'sneaker_v1',
    p_base_path      => '/api/',
    p_items_per_page => 25,
    p_status         => 'PUBLISHED',
    p_comments       => 'SneakerHeadz API'
  );

  -- 1. GET /api/search
  ORDS.DEFINE_TEMPLATE(
    p_module_name    => 'sneaker_v1',
    p_pattern        => 'search'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name    => 'sneaker_v1',
    p_pattern        => 'search',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_query,
    p_source         => 'SELECT search_sneakers_js(:premium, :budget) FROM dual'
  );

  -- 2. POST /api/buy
  ORDS.DEFINE_TEMPLATE(
    p_module_name    => 'sneaker_v1',
    p_pattern        => 'buy'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name    => 'sneaker_v1',
    p_pattern        => 'buy',
    p_method         => 'POST',
    p_source_type    => ORDS.source_type_plsql,
    p_source         => 'DECLARE
                           v_status VARCHAR2(32767);
                         BEGIN
                           buy_kicks(:id, :size, :user_id, :premium, v_status);
                           OWA_UTIL.MIME_HEADER(''application/json'');
                           HTP.P(v_status);
                         END;'
  );
  
  COMMIT;
END;
/
--rollback BEGIN ORDS.DELETE_MODULE(p_module_name => 'sneaker_v1'); END;
