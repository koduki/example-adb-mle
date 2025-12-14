-- 04_ords_rest.sql
-- ORDS REST API Definitions

BEGIN
  -- Disable ORDS first to allow re-mapping
  BEGIN
      ORDS.ENABLE_SCHEMA(
        p_enabled => FALSE,
        p_schema  => USER
      );
  EXCEPTION WHEN OTHERS THEN NULL; -- Ignore if already disabled
  END;

  -- Enable ORDS for the current schema
  -- Replace 'sneakerheadz' with your desired base path mapping if needed
  ORDS.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => USER,
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'sneakerheadz',
    p_auto_rest_auth      => FALSE
  );

  -- MODULE: sneaker_v1
  
  -- 1. GET /api/search
  -- Uses FBI for fast filtering ensuring 'One-Shot' read performance
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
              s.data.sizes -- returning sizes for UI
       FROM sneakers s 
       WHERE get_price_js(s.data, :premium) <= :budget
       ORDER BY price ASC'
  );

  -- 2. POST /api/buy
  -- Invokes the MLE Transaction Logic
  -- Input (Body JSON) is mapped to Bind Variables by ORDS automatically if names match?
  -- Wait, for source_type_plsql with POST, we usually map parameters explicitly or rely on JSON body mapping?
  -- ORDS 22+ supports implicit mapping if content-type is application/json.
  -- Binds :id, :size, :user, :premium will be extracted from JSON body.
  -- :status will be returned in the response headers or body.
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
