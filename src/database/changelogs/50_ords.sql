--liquibase formatted sql

--changeset sneaker_dev:ords_v1 runOnChange:true
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
  
  -- 1. GET /api/search
  ORDS.DEFINE_SERVICE(
    p_module_name => 'sneaker_v1',
    p_base_path   => '/api/',
    p_pattern     => 'search',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source      => 
      'SELECT id, 
              s.data.model, 
              get_price_js(s.data, :premium) as price,
              s.data.sizes 
       FROM sneakers s 
       WHERE get_price_js(s.data, :premium) <= :budget
       ORDER BY price ASC'
  );

  -- 2. POST /api/buy
  ORDS.DEFINE_SERVICE(
    p_module_name => 'sneaker_v1',
    p_base_path   => '/api/',
    p_pattern     => 'buy',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => 'BEGIN buy_kicks(:id, :size, :user, :premium, :status); END;'
  );
  
  COMMIT;
END;
/
--rollback BEGIN ORDS.DELETE_MODULE(p_module_name => 'sneaker_v1'); END;
