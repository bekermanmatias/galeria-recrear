DO $$ 
DECLARE
  coord_role_id UUID;
BEGIN
  -- Find the global "Coordinador" role
  SELECT id INTO coord_role_id FROM roles WHERE name = 'Coordinador';
  
  IF coord_role_id IS NOT NULL THEN
    -- Ensure all necessary modules exist in role_permissions for this role
    INSERT INTO role_permissions(role_id, module)
    SELECT coord_role_id, pm.module FROM permission_modules pm
    ON CONFLICT DO NOTHING;

    -- Update the permissions according to the new requirements:
    -- gallery: view
    -- departures: view
    -- lots (Carga manual): view, create, edit
    -- passengers: view, edit (for assigning QR)
    UPDATE role_permissions 
    SET 
      can_view = (module IN ('gallery', 'departures', 'lots', 'passengers')),
      can_create = (module = 'lots'),
      can_edit = (module IN ('lots', 'passengers')),
      can_delete = false
    WHERE role_id = coord_role_id;
  END IF;
END $$;
