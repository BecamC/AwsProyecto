# Guía de Integración API - Sistema de Pedidos Pardo

## 📋 Tabla de Contenidos

1. [Configuración Base](#configuración-base)
2. [Endpoints de Productos](#endpoints-de-productos)
3. [Endpoints de Pedidos](#endpoints-de-pedidos)
4. [Endpoints de Inventario](#endpoints-de-inventario)
5. [Endpoints de Workflow (Step Functions)](#endpoints-de-workflow-step-functions)
6. [Flujo Completo de Pedidos](#flujo-completo-de-pedidos)
7. [Errores Comunes y Soluciones](#errores-comunes-y-soluciones)
8. [Mejores Prácticas](#mejores-prácticas)

---

## 🔧 Configuración Base

### URL Base de la API

```
https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev
```

**⚠️ IMPORTANTE:** Esta URL puede cambiar después de cada despliegue. Siempre verifica la URL actual ejecutando:
```bash
cd AwsProyecto
sls info
```

### Headers Requeridos

Todos los endpoints requieren el header `x-tenant-id`:

```javascript
headers: {
  'Content-Type': 'application/json',
  'x-tenant-id': 'pardo'  // o el tenant_id correspondiente
}
```

### Formato de Respuestas

Todas las respuestas siguen este formato:

**Éxito (200/201):**
```json
{
  "message": "Mensaje descriptivo",
  "data": { ... }  // Datos específicos del endpoint
}
```

**Error (400/404/409/500):**
```json
{
  "message": "Mensaje de error",
  "errors": ["Error específico 1", "Error específico 2"]
}
```

---

## 📦 Endpoints de Productos

### 1. Obtener Lista de Productos (con Paginación, Filtrado y Ordenamiento)

**Endpoint:** `GET /producto/obtener`

**Query Parameters:**
- `tenant_id` (requerido): ID del tenant
- `limit` (opcional): Número de productos por página (default: 20, max: 100)
- `cursor` (opcional): Token de paginación para la siguiente página
- `tipo_producto` (opcional): Filtrar por tipo (ej: "sanguches", "bebidas", "promociones")
- `sort_by` (opcional): Campo para ordenar (`nombre_producto`, `precio_producto`, `fecha_creacion`, `fecha_actualizacion`)
- `sort_order` (opcional): Orden (`asc` o `desc`, default: `asc`)

**Ejemplo de Request:**
```javascript
const response = await fetch(
  'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/producto/obtener?tenant_id=pardo&limit=20&tipo_producto=sanguches&sort_by=precio_producto&sort_order=asc',
  {
    method: 'GET',
    headers: {
      'x-tenant-id': 'pardo'
    }
  }
);
```

**Ejemplo de Response:**
```json
{
  "productos": [
    {
      "producto_id": "550e8400-e29b-41d4-a716-446655440000",
      "nombre_producto": "Hamburguesa Clásica",
      "tipo_producto": "sanguches",
      "precio_producto": 15.5,
      "currency": "PEN",
      "descripcion_producto": "Hamburguesa con carne, lechuga, tomate y queso",
      "image_url": "https://...",
      "is_active": true,
      "fecha_creacion": "2025-11-22T10:00:00.000Z",
      "fecha_actualizacion": "2025-11-22T10:00:00.000Z",
      "tenant_id": "pardo"
    }
  ],
  "metadata": {
    "limit": 20,
    "has_more": true,
    "next_cursor": "eyJ0ZW5hbnRfaWQiOiJwYXJkbyIsInByb2R1Y3RvX2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0="
  }
}
```

**⚠️ IMPORTANTE - Paginación:**
- Usa `cursor` para obtener la siguiente página
- Si `has_more` es `false`, no hay más páginas
- Guarda el `next_cursor` para la siguiente petición

**Ejemplo de Paginación:**
```javascript
let cursor = null;
let allProducts = [];

do {
  const url = cursor 
    ? `https://.../producto/obtener?tenant_id=pardo&limit=20&cursor=${cursor}`
    : `https://.../producto/obtener?tenant_id=pardo&limit=20`;
  
  const response = await fetch(url, {
    headers: { 'x-tenant-id': 'pardo' }
  });
  const data = await response.json();
  
  allProducts = [...allProducts, ...data.productos];
  cursor = data.metadata.has_more ? data.metadata.next_cursor : null;
} while (cursor);
```

---

### 2. Obtener Producto por ID

**Endpoint:** `GET /producto/{producto_id}`

**Path Parameters:**
- `producto_id` (requerido): UUID del producto

**Query Parameters:**
- `tenant_id` (requerido): ID del tenant

**Ejemplo:**
```javascript
const productoId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(
  `https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/producto/${productoId}?tenant_id=pardo`,
  {
    method: 'GET',
    headers: {
      'x-tenant-id': 'pardo'
    }
  }
);
```

---

### 3. Crear Producto

**Endpoint:** `POST /producto`

**Body:**
```json
{
  "tenant_id": "pardo",
  "nombre_producto": "Hamburguesa Clásica",
  "tipo_producto": "sanguches",
  "precio_producto": 15.5,
  "currency": "PEN",
  "descripcion_producto": "Hamburguesa con carne, lechuga, tomate y queso",
  "image_url": "https://images-frontent-user-pardos.s3.us-east-1.amazonaws.com/imagen.jpg",
  "is_active": true,
  "sku": "HAMB-001",
  "combo_items": []  // Solo si tipo_producto es "combo"
}
```

**⚠️ IMPORTANTE:**
- `producto_id` NO se envía (se genera automáticamente)
- `tipo_producto` puede ser cualquier string (no solo "combo", "single", "promotion")
- Si `tipo_producto` es "combo", `combo_items` es requerido y debe tener al menos un item
- `image_url` debe ser una URL válida (http:// o https://)
- El inventario se inicializa automáticamente con `stock_actual: 0`

**Ejemplo de Combo:**
```json
{
  "tenant_id": "pardo",
  "nombre_producto": "Combo Hamburguesa",
  "tipo_producto": "combo",
  "precio_producto": 25.0,
  "currency": "PEN",
  "descripcion_producto": "Hamburguesa + Papas + Bebida",
  "image_url": "https://...",
  "is_active": true,
  "combo_items": [
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "sku": "HAMB-001",
      "quantity": 1
    },
    {
      "product_id": "660e8400-e29b-41d4-a716-446655440001",
      "sku": "PAP-001",
      "quantity": 1
    }
  ]
}
```

---

### 4. Actualizar Producto

**Endpoint:** `PUT /producto/{producto_id}`

**Path Parameters:**
- `producto_id` (requerido): UUID del producto

**Body:** (todos los campos son opcionales, solo envía los que quieres actualizar)
```json
{
  "tenant_id": "pardo",
  "nombre_producto": "Hamburguesa Clásica Actualizada",
  "precio_producto": 16.5,
  "is_active": false
}
```

---

### 5. Eliminar Producto

**Endpoint:** `DELETE /producto/{producto_id}`

**Path Parameters:**
- `producto_id` (requerido): UUID del producto

**Query Parameters:**
- `tenant_id` (requerido): ID del tenant

**Ejemplo:**
```javascript
const response = await fetch(
  `https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/producto/${productoId}?tenant_id=pardo`,
  {
    method: 'DELETE',
    headers: {
      'x-tenant-id': 'pardo'
    }
  }
);
```

---

## 🛒 Endpoints de Pedidos

### 1. Crear Pedido

**Endpoint:** `POST /pedido/crear`

**⚠️ CRÍTICO:** Este endpoint inicia automáticamente Step Functions. No necesitas llamar ningún otro endpoint para iniciar el flujo.

**Body:**
```json
{
  "tenant_id": "pardo",
  "usuario_id": "550e8400-e29b-41d4-a716-446655440000",
  "productos": [
    {
      "producto_id": "550e8400-e29b-41d4-a716-446655440000",
      "cantidad": 2
    }
  ],
  "direccion_entrega": "Calle Test 123, Lima",
  "telefono": "999999999",
  "medio_pago": "efectivo",
  "notas": "Sin cebolla"
}
```

**Validaciones:**
- `usuario_id` debe ser un UUID válido
- `productos` debe ser un array con al menos un item
- Cada producto debe tener `producto_id` (UUID) y `cantidad` (número > 0)
- `direccion_entrega` y `telefono` son requeridos
- `medio_pago` es opcional (default: "efectivo")
- `notas` es opcional

**Response:**
```json
{
  "message": "Pedido creado",
  "pedido": {
    "pedido_id": "70a96920-05c1-4dcc-adf9-8c64fa09d323",
    "tenant_id": "pardo",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "productos": [
      {
        "product_id": "550e8400-e29b-41d4-a716-446655440000",
        "sku": "HAMB-001",
        "price": 15.5,
        "quantity": 2
      }
    ],
    "precio_total": 31.0,
    "estado": "pendiente",
    "direccion_entrega": "Calle Test 123, Lima",
    "telefono": "999999999",
    "medio_pago": "efectivo",
    "fecha_inicio": "2025-11-22T18:50:00.000Z",
    "chef_id": null,
    "motorizado_id": null
  }
}
```

**⚠️ IMPORTANTE:**
- El `precio_producto` se obtiene automáticamente del producto
- El `sku` se genera automáticamente si no existe en el producto
- Step Functions se inicia automáticamente después de crear el pedido
- El estado inicial es siempre `"pendiente"`

---

### 2. Consultar Pedido

**Endpoint:** `GET /pedido/consultar`

**Query Parameters:**
- `pedido_id` (requerido): UUID del pedido
- `tenant_id` (requerido): ID del tenant

**Ejemplo:**
```javascript
const response = await fetch(
  `https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/pedido/consultar?pedido_id=${pedidoId}&tenant_id=pardo`,
  {
    method: 'GET',
    headers: {
      'x-tenant-id': 'pardo'
    }
  }
);
```

**Response:**
```json
{
  "pedido": {
    "pedido_id": "70a96920-05c1-4dcc-adf9-8c64fa09d323",
    "estado": "preparando",
    "precio_total": 31.0,
    "fecha_inicio": "2025-11-22T18:50:00.000Z",
    "fecha_actualizacion": "2025-11-22T18:51:00.000Z",
    "chef_id": "chef-550e8400-e29b-41d4-a716-446655440000",
    "motorizado_id": null,
    "productos": [...],
    "direccion_entrega": "Calle Test 123, Lima",
    "telefono": "999999999"
  }
}
```

---

### 3. Actualizar Pedido

**Endpoint:** `PUT /pedido/{pedido_id}`

**Path Parameters:**
- `pedido_id` (requerido): UUID del pedido

**Body:**
```json
{
  "tenant_id": "pardo",
  "estado": "cancelado"  // Opcional: solo si quieres cambiar el estado manualmente
}
```

**⚠️ NOTA:** Generalmente NO necesitas actualizar pedidos manualmente. El flujo de Step Functions maneja los cambios de estado automáticamente.

---

## 📊 Endpoints de Inventario

### 1. Consultar Inventario

**Endpoint:** `POST /inventario/consultar`

**Body:**
```json
{
  "tenant_id": "pardo",
  "producto_id": "550e8400-e29b-41d4-a716-446655440000"  // Opcional: si no se envía, retorna todos
}
```

**Response:**
```json
{
  "inventario": [
    {
      "producto_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "pardo",
      "stock_actual": 50,
      "stock_minimo": 10,
      "stock_maximo": 9999,
      "ultima_actualizacion": "2025-11-22T18:50:00.000Z"
    }
  ]
}
```

---

### 2. Ajustar Inventario (Manual)

**Endpoint:** `POST /inventario/ajustar`

**Body:**
```json
{
  "tenant_id": "pardo",
  "producto_id": "550e8400-e29b-41d4-a716-446655440000",
  "cantidad": 20,  // Cantidad a agregar o restar
  "tipo_movimiento": "entrada"  // "entrada" para agregar, "salida" para restar
}
```

**Alternativa (acepta ambos formatos):**
```json
{
  "tenant_id": "pardo",
  "producto_id": "550e8400-e29b-41d4-a716-446655440000",
  "cantidad_ajuste": 20,
  "tipo_ajuste": "entrada"
}
```

**Response:**
```json
{
  "message": "Inventario ajustado",
  "inventario": {
    "stock_actual": 70,  // 50 + 20
    "stock_anterior": 50
  }
}
```

---

## 🔄 Endpoints de Workflow (Step Functions)

Estos endpoints son parte del flujo de Step Functions. **NO los llames directamente** a menos que sepas lo que estás haciendo. El flujo se maneja automáticamente, pero puedes usarlos para confirmar pasos manualmente.

### 1. Chef Confirma Preparación

**Endpoint:** `POST /chef/confirma`

**Body:**
```json
{
  "tenant_id": "pardo",
  "pedido_id": "70a96920-05c1-4dcc-adf9-8c64fa09d323",
  "chef_id": "chef-550e8400-e29b-41d4-a716-446655440000",
  "aprobado": true  // true para aprobar, false para rechazar
}
```

**⚠️ IMPORTANTE:**
- Solo funciona si Step Functions ya invocó este handler (hay un `chef_task_token` guardado)
- Si obtienes error 409 "No hay una confirmación pendiente", significa que Step Functions aún no ha llegado a este paso
- Después de confirmar, Step Functions avanza automáticamente al siguiente estado

---

### 2. Despachado Confirma

**Endpoint:** `POST /despachado/confirma`

**Body:**
```json
{
  "tenant_id": "pardo",
  "pedido_id": "70a96920-05c1-4dcc-adf9-8c64fa09d323"
}
```

**⚠️ IMPORTANTE:**
- Solo funciona si hay un `despacho_task_token` guardado
- Step Functions debe haber avanzado al estado "DespachandoComida" primero

---

### 3. Motorizado Confirma Recogida

**Endpoint:** `POST /motorizado/confirma`

**Body:**
```json
{
  "tenant_id": "pardo",
  "pedido_id": "70a96920-05c1-4dcc-adf9-8c64fa09d323",
  "motorizado_id": "moto-550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🎯 Flujo Completo de Pedidos

### Diagrama del Flujo

```
1. Crear Pedido (POST /pedido/crear)
   ↓
2. Step Functions se inicia automáticamente
   ↓
3. Estado: "pendiente" → Step Functions invoca "PreguntarAlChef"
   ↓
4. Chef confirma (POST /chef/confirma) → Estado: "preparando"
   ↓
5. Step Functions avanza a "DespachandoComida"
   ↓
6. Despachado confirma (POST /despachado/confirma) → Estado: "despachado"
   ↓
7. Step Functions avanza a "RecogidaDelivery"
   ↓
8. Motorizado confirma (POST /motorizado/confirma) → Estado: "recogiendo" → "en_camino"
   ↓
9. Step Functions avanza a "PedidoEnCamino"
   ↓
10. Cliente recibe → Estado: "entregado"
```

### Estados del Pedido

| Estado | Descripción | Siguiente Paso |
|--------|-------------|----------------|
| `pendiente` | Pedido creado, esperando confirmación del chef | Chef confirma |
| `preparando` | Chef confirmó, preparando comida | Despachado confirma |
| `despachando` | En proceso de despacho | Despachado confirma |
| `despachado` | Despachado confirmó, listo para recoger | Motorizado confirma |
| `recogiendo` | Motorizado está recogiendo el pedido | Automático → `en_camino` |
| `en_camino` | Pedido en camino al cliente | Cliente recibe → `entregado` |
| `entregado` | Pedido entregado al cliente | Fin del flujo |
| `cancelado` | Pedido cancelado | Fin del flujo |

### Ejemplo de Implementación en Frontend

```javascript
// 1. Crear pedido
async function crearPedido(productos, direccion, telefono) {
  const response = await fetch(
    'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/pedido/crear',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'pardo'
      },
      body: JSON.stringify({
        tenant_id: 'pardo',
        usuario_id: '550e8400-e29b-41d4-a716-446655440000',
        productos: productos,
        direccion_entrega: direccion,
        telefono: telefono,
        medio_pago: 'efectivo'
      })
    }
  );
  
  const data = await response.json();
  return data.pedido.pedido_id; // Guardar para polling
}

// 2. Polling del estado del pedido
async function consultarEstadoPedido(pedidoId) {
  const response = await fetch(
    `https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/pedido/consultar?pedido_id=${pedidoId}&tenant_id=pardo`,
    {
      headers: { 'x-tenant-id': 'pardo' }
    }
  );
  
  const data = await response.json();
  return data.pedido;
}

// 3. Polling automático cada 3 segundos
let pollingInterval = null;

function iniciarPolling(pedidoId, callback) {
  pollingInterval = setInterval(async () => {
    const pedido = await consultarEstadoPedido(pedidoId);
    callback(pedido);
    
    // Detener si el pedido está terminado
    if (pedido.estado === 'entregado' || pedido.estado === 'cancelado') {
      clearInterval(pollingInterval);
    }
  }, 3000);
}

// 4. Mapeo de estados para UI
const estadoMap = {
  'pendiente': { label: '⏳ Pendiente', color: '#ffc107' },
  'preparando': { label: '👨‍🍳 Preparando', color: '#17a2b8' },
  'despachando': { label: '📦 Despachando', color: '#007bff' },
  'despachado': { label: '📦 Despachado', color: '#6c757d' },
  'recogiendo': { label: '🏍️ Recogiendo', color: '#fd7e14' },
  'en_camino': { label: '🏍️ En Camino', color: '#6f42c1' },
  'entregado': { label: '✅ Entregado', color: '#28a745' },
  'cancelado': { label: '❌ Cancelado', color: '#dc3545' }
};

// 5. Actualizar UI con el estado
function actualizarUI(pedido) {
  const estadoInfo = estadoMap[pedido.estado] || estadoMap['pendiente'];
  document.getElementById('estado-pedido').textContent = estadoInfo.label;
  document.getElementById('estado-pedido').style.color = estadoInfo.color;
}
```

---

## ⚠️ Errores Comunes y Soluciones

### 1. Error: "Pass options.removeUndefinedValues=true to remove undefined values"

**Causa:** Estás enviando valores `undefined` en el body de la petición.

**Solución:**
```javascript
// ❌ MAL
const body = {
  nombre_producto: producto.nombre,
  precio_producto: producto.precio,  // Si precio es undefined, esto causa error
  sku: producto.sku || undefined  // undefined explícito causa error
};

// ✅ BIEN
const body = {
  nombre_producto: producto.nombre,
  precio_producto: producto.precio || 0,  // Siempre un valor válido
  ...(producto.sku && { sku: producto.sku })  // Solo incluir si existe
};

// O mejor aún, limpiar el objeto antes de enviar
function limpiarObjeto(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

const body = limpiarObjeto({
  nombre_producto: producto.nombre,
  precio_producto: producto.precio,
  sku: producto.sku
});
```

---

### 2. Error: "usuario_id es requerido y debe ser UUID"

**Causa:** El `usuario_id` no es un UUID válido o está mal formateado.

**Solución:**
```javascript
// Validar UUID antes de enviar
function esUUID(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}

if (!esUUID(usuarioId)) {
  alert('El usuario_id debe ser un UUID válido');
  return;
}
```

---

### 3. Error: "productos[0].producto_id es requerido y debe ser UUID"

**Causa:** El `producto_id` en el array de productos no es un UUID válido.

**Solución:**
```javascript
// Validar todos los productos antes de enviar
const productosValidos = productos.every(p => 
  p.producto_id && esUUID(p.producto_id) && p.cantidad > 0
);

if (!productosValidos) {
  alert('Todos los productos deben tener un producto_id válido (UUID) y cantidad > 0');
  return;
}
```

---

### 4. Error: "No hay una confirmación pendiente para este pedido" (409 Conflict)

**Causa:** Estás intentando confirmar un paso antes de que Step Functions haya llegado a ese estado.

**Solución:**
```javascript
// Siempre verificar el estado del pedido antes de confirmar
async function confirmarChef(pedidoId) {
  // 1. Consultar el estado actual
  const pedido = await consultarEstadoPedido(pedidoId);
  
  // 2. Verificar que el estado sea correcto
  if (pedido.estado !== 'pendiente') {
    alert(`El pedido está en estado "${pedido.estado}", no se puede confirmar el chef`);
    return;
  }
  
  // 3. Verificar que haya un token (opcional, pero recomendado)
  if (!pedido.chef_task_token) {
    alert('Step Functions aún no ha iniciado la confirmación del chef. Espera unos segundos.');
    return;
  }
  
  // 4. Ahora sí confirmar
  const response = await fetch(
    'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/chef/confirma',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'pardo'
      },
      body: JSON.stringify({
        tenant_id: 'pardo',
        pedido_id: pedidoId,
        chef_id: 'chef-550e8400-e29b-41d4-a716-446655440000',
        aprobado: true
      })
    }
  );
  
  if (response.status === 409) {
    const error = await response.json();
    console.error('Error:', error.message);
    // Esperar y reintentar después de unos segundos
    setTimeout(() => confirmarChef(pedidoId), 5000);
  }
}
```

---

### 5. Error: Step Functions no avanza después de confirmar

**Causa:** El output de `sendTaskSuccess` no incluye `tenant_id`, causando que Step Functions no pueda pasar al siguiente estado.

**Solución:** Este error ya está corregido en el backend. Si aún ocurre, verifica que:
- El `tenant_id` esté presente en todas las confirmaciones
- No estés usando una versión antigua del backend

---

### 6. Error: Frontend muestra estado incorrecto

**Causa:** El frontend no tiene mapeado el estado "recogiendo" o está usando un estado por defecto.

**Solución:**
```javascript
// Asegúrate de mapear TODOS los estados posibles
const estadoMap = {
  'pendiente': { label: '⏳ Pendiente', color: '#ffc107' },
  'preparando': { label: '👨‍🍳 Preparando', color: '#17a2b8' },
  'despachando': { label: '📦 Despachando', color: '#007bff' },
  'despachado': { label: '📦 Despachado', color: '#6c757d' },
  'recogiendo': { label: '🏍️ Recogiendo', color: '#fd7e14' },  // ⚠️ NO OLVIDAR ESTE
  'en_camino': { label: '🏍️ En Camino', color: '#6f42c1' },
  'entregado': { label: '✅ Entregado', color: '#28a745' },
  'cancelado': { label: '❌ Cancelado', color: '#dc3545' }
};

// Siempre usar el estado del pedido, no un valor por defecto
function actualizarUI(pedido) {
  const estado = pedido.estado || 'pendiente';
  const estadoInfo = estadoMap[estado] || estadoMap['pendiente'];
  // ...
}
```

---

### 7. Error: CORS bloqueando peticiones

**Causa:** El header `x-tenant-id` no está permitido en CORS.

**Solución:** Este error ya está corregido en el backend. Si aún ocurre:
- Verifica que estés usando la URL correcta
- Asegúrate de que el header `x-tenant-id` esté presente
- Verifica que el método HTTP sea correcto (GET, POST, PUT, DELETE)

---

### 8. Error: "getaddrinfo ENOTFOUND" o URL no encontrada

**Causa:** La URL de la API cambió después de un despliegue.

**Solución:**
```bash
# Siempre verificar la URL actual
cd AwsProyecto
sls info

# O usar la variable de entorno
const API_URL = process.env.API_URL || 'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev';
```

---

### 9. Error: SKU undefined en pedidos

**Causa:** El producto no tiene SKU y el backend no puede generarlo.

**Solución:** Este error ya está corregido. El backend genera automáticamente un SKU si no existe:
- Formato: `SKU-XXXXXXXX` (donde X son los primeros 8 caracteres del producto_id)

---

### 10. Error: Precio undefined en pedidos

**Causa:** El producto no tiene `precio_producto` o es `null`/`undefined`.

**Solución:**
```javascript
// Validar que el producto tenga precio antes de crear el pedido
const productosConPrecio = productos.filter(p => 
  p.precio_producto !== undefined && 
  p.precio_producto !== null && 
  !isNaN(p.precio_producto)
);

if (productosConPrecio.length !== productos.length) {
  alert('Algunos productos no tienen precio válido');
  return;
}
```

---

## ✅ Mejores Prácticas

### 1. Manejo de Errores

```javascript
async function hacerPeticion(endpoint, method, body) {
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'pardo'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Manejar errores específicos
      if (response.status === 409) {
        console.warn('Conflicto:', data.message);
        // Reintentar después de unos segundos
        return null;
      }
      
      throw new Error(data.message || 'Error en la petición');
    }
    
    return data;
  } catch (error) {
    console.error('Error en petición:', error);
    throw error;
  }
}
```

### 2. Validación de Datos

```javascript
function validarCrearPedido(datos) {
  const errores = [];
  
  if (!datos.usuario_id || !esUUID(datos.usuario_id)) {
    errores.push('usuario_id debe ser un UUID válido');
  }
  
  if (!Array.isArray(datos.productos) || datos.productos.length === 0) {
    errores.push('Debe haber al menos un producto');
  }
  
  datos.productos.forEach((p, i) => {
    if (!p.producto_id || !esUUID(p.producto_id)) {
      errores.push(`Producto ${i + 1}: producto_id debe ser UUID`);
    }
    if (!p.cantidad || p.cantidad <= 0) {
      errores.push(`Producto ${i + 1}: cantidad debe ser > 0`);
    }
  });
  
  if (!datos.direccion_entrega || datos.direccion_entrega.trim() === '') {
    errores.push('direccion_entrega es requerida');
  }
  
  if (!datos.telefono || datos.telefono.trim() === '') {
    errores.push('telefono es requerido');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}
```

### 3. Polling Inteligente

```javascript
class PedidoPoller {
  constructor(pedidoId, onUpdate) {
    this.pedidoId = pedidoId;
    this.onUpdate = onUpdate;
    this.interval = null;
    this.estadoAnterior = null;
  }
  
  iniciar() {
    this.consultar(); // Consultar inmediatamente
    this.interval = setInterval(() => this.consultar(), 3000);
  }
  
  detener() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  async consultar() {
    try {
      const pedido = await consultarEstadoPedido(this.pedidoId);
      
      // Solo actualizar si el estado cambió
      if (pedido.estado !== this.estadoAnterior) {
        this.estadoAnterior = pedido.estado;
        this.onUpdate(pedido);
        
        // Detener si el pedido terminó
        if (pedido.estado === 'entregado' || pedido.estado === 'cancelado') {
          this.detener();
        }
      }
    } catch (error) {
      console.error('Error en polling:', error);
    }
  }
}
```

### 4. Limpieza de Objetos

```javascript
function limpiarObjeto(obj) {
  // Eliminar undefined, null (opcional), y strings vacíos (opcional)
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => {
      return v !== undefined && v !== null && v !== '';
    })
  );
}

// Uso
const body = limpiarObjeto({
  nombre_producto: producto.nombre,
  precio_producto: producto.precio,
  sku: producto.sku,  // Si es undefined, se elimina
  descripcion: producto.descripcion || ''  // Si es '', se elimina
});
```

### 5. Manejo de Paginación

```javascript
async function obtenerTodosLosProductos(filtros = {}) {
  const productos = [];
  let cursor = null;
  let hasMore = true;
  
  while (hasMore) {
    const params = new URLSearchParams({
      tenant_id: 'pardo',
      limit: '100',
      ...filtros
    });
    
    if (cursor) {
      params.append('cursor', cursor);
    }
    
    const response = await fetch(
      `https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev/producto/obtener?${params}`,
      {
        headers: { 'x-tenant-id': 'pardo' }
      }
    );
    
    const data = await response.json();
    productos.push(...data.productos);
    
    hasMore = data.metadata.has_more;
    cursor = data.metadata.next_cursor;
  }
  
  return productos;
}
```

---

## 📝 Notas Finales

1. **Siempre valida los datos antes de enviarlos** - Esto previene la mayoría de errores 400
2. **Nunca envíes valores `undefined`** - Usa `limpiarObjeto()` o valores por defecto
3. **Usa polling para actualizar el estado del pedido** - No confíes en que el usuario refresque manualmente
4. **Mapea TODOS los estados posibles** - Incluye "recogiendo" y cualquier otro estado que pueda existir
5. **Maneja errores 409 (Conflict) graciosamente** - Significa que Step Functions aún no llegó a ese paso
6. **Verifica la URL de la API después de cada despliegue** - Puede cambiar
7. **No intentes confirmar pasos antes de tiempo** - Siempre verifica el estado del pedido primero
8. **Usa UUIDs válidos** - Valida antes de enviar
9. **El flujo de Step Functions es automático** - Solo necesitas confirmar los pasos cuando lleguen
10. **Guarda el `pedido_id` después de crear** - Lo necesitarás para polling y confirmaciones

---

## 🔗 Recursos Adicionales

- **Verificar URL actual:** `cd AwsProyecto && sls info`
- **Ver logs en CloudWatch:** `aws logs tail /aws/lambda/pardo-pedidos-system-dev-{functionName} --since 10m`
- **Documentación de Step Functions:** https://docs.aws.amazon.com/step-functions/

---

---

## 📚 Resumen Rápido de Endpoints

### Productos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/producto/obtener` | Lista productos (con paginación, filtrado, ordenamiento) |
| GET | `/producto/{producto_id}` | Obtiene un producto por ID |
| POST | `/producto` | Crea un nuevo producto |
| PUT | `/producto/{producto_id}` | Actualiza un producto |
| DELETE | `/producto/{producto_id}` | Elimina un producto |

### Pedidos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/pedido/crear` | Crea un pedido (inicia Step Functions automáticamente) |
| GET | `/pedido/consultar` | Consulta un pedido por ID |
| PUT | `/pedido/{pedido_id}` | Actualiza un pedido (rara vez necesario) |

### Inventario
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/inventario/consultar` | Consulta inventario de producto(s) |
| POST | `/inventario/ajustar` | Ajusta inventario manualmente |

### Workflow (Step Functions)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/chef/confirma` | Chef confirma preparación |
| POST | `/despachado/confirma` | Despachado confirma despacho |
| POST | `/motorizado/confirma` | Motorizado confirma recogida |

---

## 🚀 Ejemplo Completo de Integración

```javascript
// config.js
export const API_CONFIG = {
  BASE_URL: 'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev',
  TENANT_ID: 'pardo',
  POLLING_INTERVAL: 3000 // 3 segundos
};

// api.js
import { API_CONFIG } from './config';

class PardoAPI {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.tenantId = API_CONFIG.TENANT_ID;
  }

  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(this.limpiarObjeto(body));
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición');
    }

    return data;
  }

  limpiarObjeto(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
  }

  // Productos
  async obtenerProductos(filtros = {}) {
    const params = new URLSearchParams({
      tenant_id: this.tenantId,
      limit: filtros.limit || 20,
      ...filtros
    });
    return this.request(`/producto/obtener?${params}`);
  }

  async obtenerProducto(productoId) {
    return this.request(`/producto/${productoId}?tenant_id=${this.tenantId}`);
  }

  async crearProducto(producto) {
    return this.request('/producto', 'POST', {
      tenant_id: this.tenantId,
      ...producto
    });
  }

  // Pedidos
  async crearPedido(pedidoData) {
    return this.request('/pedido/crear', 'POST', {
      tenant_id: this.tenantId,
      ...pedidoData
    });
  }

  async consultarPedido(pedidoId) {
    return this.request(`/pedido/consultar?pedido_id=${pedidoId}&tenant_id=${this.tenantId}`);
  }

  // Workflow
  async confirmarChef(pedidoId, chefId, aprobado = true) {
    return this.request('/chef/confirma', 'POST', {
      tenant_id: this.tenantId,
      pedido_id: pedidoId,
      chef_id: chefId,
      aprobado
    });
  }

  async confirmarDespachado(pedidoId) {
    return this.request('/despachado/confirma', 'POST', {
      tenant_id: this.tenantId,
      pedido_id: pedidoId
    });
  }

  async confirmarMotorizado(pedidoId, motorizadoId) {
    return this.request('/motorizado/confirma', 'POST', {
      tenant_id: this.tenantId,
      pedido_id: pedidoId,
      motorizado_id: motorizadoId
    });
  }
}

// Uso en componente React/Vue/etc
const api = new PardoAPI();

// Crear pedido
const pedido = await api.crearPedido({
  usuario_id: '550e8400-e29b-41d4-a716-446655440000',
  productos: [
    { producto_id: '550e8400-e29b-41d4-a716-446655440000', cantidad: 2 }
  ],
  direccion_entrega: 'Calle Test 123',
  telefono: '999999999',
  medio_pago: 'efectivo'
});

const pedidoId = pedido.pedido.pedido_id;

// Polling del estado
const poller = setInterval(async () => {
  try {
    const estado = await api.consultarPedido(pedidoId);
    actualizarUI(estado.pedido);
    
    if (estado.pedido.estado === 'entregado' || estado.pedido.estado === 'cancelado') {
      clearInterval(poller);
    }
  } catch (error) {
    console.error('Error en polling:', error);
  }
}, API_CONFIG.POLLING_INTERVAL);
```

---

**Última actualización:** 2025-11-22
**Versión del API:** 1.0.0

