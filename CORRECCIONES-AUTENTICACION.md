# 🔒 Correcciones de Autenticación - Handlers

## Problema Identificado
Se encontraron handlers que usaban `isStaff` y `authenticatedUserId` sin tener implementado el middleware de autenticación.

## Archivos Corregidos

### 1. ✅ `handlers/pedidos/consultarPedido.js`
**Problema:** Variables `isStaff` y `authenticatedUserId` no definidas
**Solución:**
- Agregado `requireAuth(event)` al inicio del handler
- Obtención de `isStaff` y `authenticatedUserId` del payload del JWT
- Mejora: usuarios pueden ver sus pedidos de todas las sedes (multi-tenant)

**Cambios clave:**
```javascript
const auth = requireAuth(event);
if (auth.error) return auth.error;

const { payload } = auth;
const authenticatedUserId = payload.user_id;
const isStaff = payload.user_type === 'staff';
```

### 2. ✅ `handlers/pedidos/actualizarPedido.js`
**Problema:** No tenía autenticación
**Solución:**
- Agregado `requireAuth(event)` al inicio
- Verificación de permisos: solo el dueño o staff puede actualizar
- Solo staff puede cambiar el estado del pedido directamente

**Permisos:**
- Cliente: puede actualizar dirección, teléfono, notas (solo si está en estado "pendiente")
- Staff: puede actualizar cualquier campo incluido el estado

### 3. ✅ `handlers/inventario/consultarInventario.js`
**Problema:** No tenía autenticación
**Solución:**
- Agregado `requireStaff(event)` - solo staff puede consultar inventario
- Clientes no tienen acceso a la información de inventario

## Handlers que ya tenían autenticación correctamente implementada

### Pedidos
- ✅ `crearPedido.js` - `requireAuth`

### Productos
- ✅ `crearProducto.js` - `requireStaff`
- ✅ `actualizarProducto.js` - `requireStaff`
- ✅ `eliminarProducto.js` - `requireStaff`

### Inventario
- ✅ `ajustarInventario.js` - `requireStaff`

### Workflow
- ✅ `chefConfirma.js` - `requireStaff`
- ✅ `pedidoDespachado.js` - `requireStaff`
- ✅ `pedidoRecogido.js` - `requireStaff`

### Auth
- ✅ `generarInvitationCode.js` - `requireStaff`

## Endpoints Públicos (sin autenticación requerida)

### Productos
- ✅ `obtenerProductos.js` - Público (cualquiera puede ver productos)
- ✅ `obtenerProducto.js` - Público (cualquiera puede ver un producto específico)

### Workflow (invocados por Step Functions)
- ✅ `preparandoComida.js` - Invocado por Step Functions
- ✅ `despachandoComida.js` - Invocado por Step Functions
- ✅ `recogidaDelivery.js` - Invocado por Step Functions
- ✅ `pedidoEnCamino.js` - Invocado por Step Functions
- ✅ `clienteRecibeComida.js` - Invocado por Step Functions

### Otros
- ✅ `procesarEventoPedido.js` - Invocado por SQS
- ✅ `actualizarInventario.js` - Invocado por EventBridge

## Resumen de Permisos por Endpoint

| Endpoint | Método | Autenticación | Permisos |
|----------|--------|---------------|----------|
| `/auth/registro` | POST | No | Público |
| `/auth/login` | POST | No | Público |
| `/auth/logout` | POST | Sí | Cualquier usuario autenticado |
| `/auth/generate-invitation` | POST | Sí | Solo staff |
| `/producto/obtener` | GET | No | Público |
| `/producto/{id}` | GET | No | Público |
| `/producto` | POST | Sí | Solo staff |
| `/producto/{id}` | PUT | Sí | Solo staff |
| `/producto/{id}` | DELETE | Sí | Solo staff |
| `/pedido/crear` | POST | Sí | Cualquier usuario autenticado |
| `/pedido/consultar` | GET | Sí | Usuario ve sus pedidos, staff ve todos |
| `/pedido/{id}` | PUT | Sí | Dueño o staff |
| `/inventario/consultar` | POST | Sí | Solo staff |
| `/inventario/ajustar` | POST | Sí | Solo staff |
| `/chef/confirma` | POST | Sí | Solo staff |
| `/despachado/confirma` | POST | Sí | Solo staff |
| `/motorizado/confirma` | POST | Sí | Solo staff |

## Headers Requeridos

### Todos los endpoints
- `x-tenant-id`: ID de la sede (`pardo_miraflores` o `pardo_surco`)

### Endpoints protegidos (requieren autenticación)
- `Authorization`: Bearer token JWT

## Estructura del JWT

```javascript
{
  user_id: "uuid",
  email: "user@example.com",
  user_type: "cliente" | "staff",
  staff_tier: "admin" | "trabajador", // solo para staff
  permissions: [], // array de permisos (solo para staff)
  tenant_id_sede: "pardo_miraflores", // sede del staff (solo para staff)
  iat: timestamp,
  exp: timestamp
}
```

## Testing de Autenticación

### Probar autenticación de cliente
```bash
# 1. Registrar usuario
curl -X POST https://API_URL/dev/auth/registro \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@test.com",
    "password": "password123",
    "frontend_type": "client",
    "user_type": "cliente"
  }'

# 2. Login
curl -X POST https://API_URL/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "password123",
    "frontend_type": "client"
  }'

# 3. Usar el token en endpoints protegidos
curl -X POST https://API_URL/dev/pedido/crear \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-tenant-id: pardo_miraflores" \
  -d '{...}'
```

## Errores Comunes

### 1. Token faltante o inválido
```json
{
  "message": "Token de autenticación requerido"
}
```
**Solución:** Incluir header `Authorization: Bearer <token>`

### 2. Token expirado
```json
{
  "message": "Token inválido o expirado"
}
```
**Solución:** Hacer login nuevamente para obtener un nuevo token

### 3. Permisos insuficientes
```json
{
  "message": "Acceso denegado. Solo para personal autorizado."
}
```
**Solución:** El endpoint requiere permisos de staff

### 4. No autorizado para ver el recurso
```json
{
  "message": "No tienes permiso para ver este pedido"
}
```
**Solución:** Solo el dueño del pedido o staff puede verlo

## Próximos Pasos

1. Redesplegar el backend:
   ```bash
   cd AwsProyecto
   sls deploy
   ```

2. Verificar que todos los endpoints protegidos requieren token

3. Probar en el frontend que:
   - Los endpoints públicos funcionan sin token
   - Los endpoints protegidos requieren token
   - Los errores de autenticación se manejan correctamente

