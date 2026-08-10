# Respaldo y recuperación de consolidación de álbumes

Antes de aplicar `022_consolidate_lots_by_departure_activity.sql`, crear un dump de PostgreSQL fuera del repositorio:

```powershell
New-Item -ItemType Directory -Force -Path C:\Users\beker\Backups\galeria-recrear
docker compose exec -T db pg_dump -U postgres -d galeria_recrear --format=custom --file=/tmp/galeria-recrear-pre-lot-consolidation.dump
docker cp galeria-recrear-db-1:/tmp/galeria-recrear-pre-lot-consolidation.dump C:\Users\beker\Backups\galeria-recrear\galeria-recrear-pre-lot-consolidation.dump
```

Para restaurarlo, detener las aplicaciones que escriben en la base y ejecutar:

```powershell
docker cp C:\Users\beker\Backups\galeria-recrear\galeria-recrear-pre-lot-consolidation.dump galeria-recrear-db-1:/tmp/restore.dump
docker compose exec -T db pg_restore -U postgres -d galeria_recrear --clean --if-exists /tmp/restore.dump
```

La migración además guarda una instantánea JSON de cada grupo consolidado en `lot_consolidation_backups`. Conservá el dump y esas instantáneas durante 30 días; después de validar la operación, se pueden borrar los dumps manualmente y eliminar las filas vencidas con:

```sql
DELETE FROM lot_consolidation_backups WHERE expires_at < now();
```
