# Scripts para Insertar Productos Fake

Este directorio contiene scripts para insertar productos de prueba en el sistema.

## Scripts Disponibles

### 1. `insertar-productos-fake.sh` (Linux/Mac)
Script bash para sistemas Unix.

**Uso:**
```bash
chmod +x insertar-productos-fake.sh
./insertar-productos-fake.sh
```

### 2. `insertar-productos-fake.ps1` (Windows)
Script PowerShell para Windows.

**Uso:**
```powershell
.\insertar-productos-fake.ps1
```

## Productos que se Crean

### Productos Individuales (single)
1. Hamburguesa Clásica - S/ 15.50
2. Hamburguesa BBQ - S/ 18.90
3. Papas Fritas - S/ 8.50
4. Coca Cola 500ml - S/ 5.00
5. Inca Kola 500ml - S/ 5.00
6. Nuggets de Pollo (6 unidades) - S/ 12.00
7. Alitas de Pollo (6 unidades) - S/ 16.50
8. Ensalada César - S/ 14.00

### Combos
1. Combo Hamburguesa Clásica - S/ 25.00
   - Hamburguesa + Papas + Bebida

### Promociones
1. Promo 2x1 Hamburguesas - S/ 15.50
2. Promo Familiar - S/ 85.00

## Notas Importantes

- Los scripts usan el tenant_id `pardo` por defecto
- Los combo_items usan IDs de ejemplo. En producción, deberías obtener los IDs reales de los productos creados
- Las URLs de imágenes son ejemplos. Reemplázalas con URLs reales de S3 o tu CDN
- El script hace pausas de 500ms entre requests para evitar rate limiting

## Personalización

Para cambiar el tenant_id o la base URL, edita las variables al inicio del script:

**Bash:**
```bash
BASE_URL="https://tu-api.execute-api.us-east-1.amazonaws.com/dev"
TENANT_ID="tu-tenant-id"
```

**PowerShell:**
```powershell
$BASE_URL = "https://tu-api.execute-api.us-east-1.amazonaws.com/dev"
$TENANT_ID = "tu-tenant-id"
```

