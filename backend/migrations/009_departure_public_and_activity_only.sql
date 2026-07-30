-- Acceso público global de salidas y retiro operativo de turnos.
ALTER TABLE departures
  ALTER COLUMN public_code SET DEFAULT ('SAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

CREATE UNIQUE INDEX IF NOT EXISTS lots_departure_activity_date_current_idx
  ON lots (departure_id, event_date, COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE shift_id IS NULL;

INSERT INTO activities (name, bot_code)
VALUES
  ('Día de Campo', 'DIA_CAMPO'),
  ('Parque Aéreo', 'PARQUE_AEREO'),
  ('Estancia', 'ESTANCIA'),
  ('Fiesta Flúo', 'FIESTA_FLUO'),
  ('Fiesta de Disfraces', 'FIESTA_DISFRACES'),
  ('Excursión Nocturna', 'EXCURSION_NOCTURNA'),
  ('Multiparque', 'MULTIPARQUE'),
  ('Piscina', 'PISCINA'),
  ('Cena Show', 'CENA_SHOW')
ON CONFLICT (bot_code) DO NOTHING;