# 👨‍💼 ADMIN PARA DYNAMODB - PARDOS

## 📋 DATOS DEL ADMIN

### Tabla: `TablaStaff`

**Clave de Partición (HASH):** `tenant_id_sede`  
**Clave de Ordenación (RANGE):** `email`

---

## 📝 OBJETO COMPLETO PARA COPIAR EN DYNAMODB

```json
{
  "tenant_id_sede": "pardo_miraflores",
  "email": "admin@pardos.com",
  "user_id": "00000000-0000-0000-0000-000000000001",
  "password": "$2a$10$rC3lBCDI5qa6lyaBmVnD.eBlFcQ/0OhDvU5ym0NtEi1YeiSbESmgi",
  "name": "Admin Principal",
  "user_type": "staff",
  "staff_tier": "admin",
  "permissions": [
    "view_products",
    "view_orders",
    "update_order_status",
    "view_customers",
    "manage_products",
    "manage_orders",
    "manage_staff_trabajador",
    "view_reports",
    "manage_inventory",
    "generate_invitation_codes",
    "manage_all_profiles"
  ],
  "is_active": true,
  "is_verified": true,
  "phone": "999999999",
  "created_at": "2025-11-29T00:00:00.000Z",
  "updated_at": "2025-11-29T00:00:00.000Z",
  "last_login": null
}
```

---

## 🔑 CREDENCIALES

- **Email:** `admin@pardos.com`
- **Password:** `123456` (hasheada con bcrypt)
- **Tenant ID Sede:** `pardo_miraflores`
- **Staff Tier:** `admin`

---

## 📊 PERMISOS DEL ADMIN

El admin tiene los siguientes permisos:
- ✅ Ver productos
- ✅ Ver pedidos (de TODAS las sedes)
- ✅ Actualizar estado de pedidos
- ✅ Ver clientes
- ✅ Gestionar productos
- ✅ Gestionar pedidos
- ✅ Gestionar staff trabajador
- ✅ Ver reportes
- ✅ Gestionar inventario
- ✅ Generar códigos de invitación
- ✅ Gestionar todos los perfiles

---

## 🔍 COMPORTAMIENTO ACTUAL DEL SISTEMA

### ✅ **ADMIN:**
- **Puede ver pedidos de TODAS las sedes** (pardo_miraflores y pardo_surco)
- Cuando consulta `/pedido/consultar` sin parámetros, recibe pedidos de ambas sedes
- Puede generar códigos de invitación
- Puede gestionar productos, inventario, y asignaciones

### ✅ **STAFF TRABAJADOR:**
- **Solo ve pedidos asignados a él** de su sede
- Solo puede ver pedidos donde está asignado como `chef_id` o `motorizado_id`
- No puede ver pedidos de otras sedes
- No puede generar códigos de invitación

---

## 📥 INSTRUCCIONES PARA AGREGAR EN DYNAMODB

1. Ve a la consola de AWS DynamoDB
2. Selecciona la tabla `TablaStaff-dev` (o `TablaStaff` según tu stage)
3. Haz clic en "Explorar elementos de tabla"
4. Haz clic en "Crear elemento"
5. Copia y pega el JSON de arriba
6. **IMPORTANTE:** Asegúrate de que:
   - `tenant_id_sede` = `pardo_miraflores` (Clave de partición)
   - `email` = `admin@pardos.com` (Clave de ordenación)
7. Haz clic en "Crear elemento"

---

## ✅ VERIFICACIÓN

Después de agregar el admin, puedes probarlo:

1. **Login:**
   ```
   POST /auth/login
   {
     "email": "admin@pardos.com",
     "password": "123456",
     "frontend_type": "staff",
     "tenant_id_sede": "pardo_miraflores"
   }
   ```

2. **Consultar pedidos (verá TODAS las sedes):**
   ```
   GET /pedido/consultar
   Headers:
     Authorization: Bearer <token>
     x-tenant-id: pardo_miraflores (o cualquier sede, admin verá todas)
   ```

3. **Generar código de invitación:**
   ```
   POST /auth/generate-invitation
   {
     "tenant_id_sede": "pardo_miraflores",
     "staff_tier": "trabajador"
   }
   ```

---

## 🔄 CAMBIOS IMPLEMENTADOS

### Modificación en `consultarPedido.js`:

**ANTES:**
- Admin solo veía pedidos de la sede especificada en `x-tenant-id`

**AHORA:**
- Admin ve pedidos de **TODAS las sedes** (pardo_miraflores y pardo_surco)
- Trabajador sigue viendo solo sus asignaciones de su sede

---

## 📝 NOTAS

- El admin está asignado a `pardo_miraflores` pero puede ver ambas sedes
- La contraseña `123456` está hasheada con bcrypt (10 rounds)
- El `user_id` es fijo para facilitar pruebas: `00000000-0000-0000-0000-000000000001`
- Puedes cambiar el `tenant_id_sede` si quieres que el admin esté en otra sede, pero igual podrá ver todas

