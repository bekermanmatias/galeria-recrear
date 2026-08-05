DO $$
DECLARE
    coordinator_role uuid;
    uid uuid;
BEGIN
    SELECT id INTO coordinator_role FROM roles WHERE is_system_admin = false LIMIT 1;
    
    FOR uid IN SELECT id FROM users WHERE role_id = coordinator_role LOOP
        -- departures: view
        INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete) 
        VALUES (uid, 'departures', true, false, false, false)
        ON CONFLICT (user_id, module) DO UPDATE SET can_view = true;
        
        -- lots: view, create, edit
        INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete) 
        VALUES (uid, 'lots', true, true, true, false)
        ON CONFLICT (user_id, module) DO UPDATE SET can_view = true, can_create = true, can_edit = true;
        
        -- gallery: view
        INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete) 
        VALUES (uid, 'gallery', true, false, false, false)
        ON CONFLICT (user_id, module) DO UPDATE SET can_view = true;
        
        -- passengers: view, edit
        INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete) 
        VALUES (uid, 'passengers', true, false, true, false)
        ON CONFLICT (user_id, module) DO UPDATE SET can_view = true, can_edit = true;
        
        -- activities: view
        INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete) 
        VALUES (uid, 'activities', true, false, false, false)
        ON CONFLICT (user_id, module) DO UPDATE SET can_view = true;
        
        -- schools: view
        INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete) 
        VALUES (uid, 'schools', true, false, false, false)
        ON CONFLICT (user_id, module) DO UPDATE SET can_view = true;
    END LOOP;
END $$;
