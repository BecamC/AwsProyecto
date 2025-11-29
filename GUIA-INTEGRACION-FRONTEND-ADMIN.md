# Guía de Integración - Frontend Admin Pardo

## 📋 Resumen

Este documento proporciona instrucciones detalladas para conectar el frontend de administración (`front_admin_pardo`) con los endpoints reales del backend consolidado en `AwsProyecto`.

## 🔗 Endpoints Disponibles

### Base URL
```javascript
const API_BASE_URL = 'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev';
```

### Autenticación

#### POST `/auth/login`
**Descripción**: Login para staff (admin o trabajador)

**Headers**:
```javascript
{
  'Content-Type': 'application/json'
}
```

**Body**:
```javascript
{
  "email": "admin@pardos.com",
  "password": "password123",
  "frontend_type": "staff",
  "tenant_id_sede": "pardo_miraflores" // o "pardo_surco"
}
```

**Respuesta Exitosa** (200):
```javascript
{
  "message": "Login exitoso",
  "user": {
    "user_id": "uuid",
    "email": "admin@pardos.com",
    "name": "Admin User",
    "user_type": "staff",
    "staff_tier": "admin", // o "trabajador"
    "permissions": ["view_products", "manage_products", ...],
    "tenant_id_sede": "pardo_miraflores"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "session": {
    "frontend_type": "staff"
  }
}
```

**Guardar en localStorage**:
```javascript
localStorage.setItem('pardos-system-token', data.token);
localStorage.setItem('pardos-system-user', JSON.stringify(data.user));
```

#### POST `/auth/generate-invitation`
**Descripción**: Generar código de invitación para registrar nuevo staff

**Headers**:
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <token>'
}
```

**Body**:
```javascript
{
  "max_uses": 10,  // Opcional, default 10
  "expires_in_days": 30  // Opcional, default 30
}
```

**Permisos Requeridos**: `generate_invitation_codes`

---

### Productos

#### GET `/producto/obtener`
**Descripción**: Obtener lista de productos de una sede

**Headers**:
```javascript
{
  'x-tenant-id': 'pardo_miraflores' // o 'pardo_surco'
}
```

**Query Params**: Ninguno requerido

**Respuesta**:
```javascript
{
  "productos": [
    {
      "producto_id": "uuid",
      "nombre_plato": "1/4 Pollo",
      "precio_producto": 25.5,
      "tipo_producto": "Pollos",
      "descripcion_producto": "...",
      "image_url": "https://...",
      "is_active": true,
      "sku": "POLL-001",
      "tenant_id": "pardo_miraflores",
      "fecha_creacion": "2025-11-29T...",
      "fecha_actualizacion": "2025-11-29T..."
    }
  ]
}
```

#### POST `/producto`
**Descripción**: Crear nuevo producto

**Headers**:
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <token>',
  'x-tenant-id': 'pardo_miraflores'
}
```

**Body**:
```javascript
{
  "nombre_plato": "Producto Nuevo",
  "precio_producto": 30.0,
  "tipo_producto": "Pollos",
  "descripcion_producto": "Descripción del producto",
  "image_url": "https://...",
  "sku": "PROD-001",
  "is_active": true
}
```

**Permisos Requeridos**: `manage_products`

#### PUT `/producto/{producto_id}`
**Descripción**: Actualizar producto existente

**Headers**: Igual que POST

**Body**: Campos a actualizar (solo enviar los que cambian)

**Permisos Requeridos**: `manage_products`

#### DELETE `/producto/{producto_id}`
**Descripción**: Eliminar producto

**Headers**:
```javascript
{
  'Authorization': 'Bearer <token>',
  'x-tenant-id': 'pardo_miraflores'
}
```

**Permisos Requeridos**: `manage_products`

---

### Pedidos

#### GET `/pedido/consultar`
**Descripción**: Consultar pedidos

**Headers**:
```javascript
{
  'Authorization': 'Bearer <token>',
  'x-tenant-id': 'pardo_miraflores'
}
```

**Query Params**:
- `pedido_id` (opcional): UUID del pedido específico
- `usuario_id` (opcional): Filtrar por usuario
- `fecha_desde` (opcional): Fecha ISO string
- `fecha_hasta` (opcional): Fecha ISO string

**Respuesta** (sin params, lista todos los pedidos del tenant):
```javascript
{
  "pedidos": [
    {
      "pedido_id": "uuid",
      "user_id": "uuid",
      "tenant_id": "pardo_miraflores",
      "estado": "pendiente", // preparando, listo_despacho, despachando, recogiendo, en_camino, entregado, cancelado
      "precio_total": 51.0,
      "productos": [{...}],
      "direccion_entrega": "Calle 123",
      "telefono": "999999999",
      "medio_pago": "efectivo",
      "fecha_inicio": "2025-11-29T...",
      "fecha_fin": null,
      "chef_id": null,
      "motorizado_id": null
    }
  ]
}
```

---

### Workflow (Step Functions)

#### POST `/chef/confirma`
**Descripción**: Chef confirma que terminó de preparar el pedido

**Headers**:
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <token>',
  'x-tenant-id': 'pardo_miraflores'
}
```

**Body**:
```javascript
{
  "pedido_id": "uuid",
  "chef_id": "uuid-del-chef",
  "tenant_id": "pardo_miraflores"
}
```

**Permisos Requeridos**: `update_order_status`

#### POST `/despachado/confirma`
**Descripción**: Despachador confirma que despachó el pedido

**Body**:
```javascript
{
  "pedido_id": "uuid",
  "tenant_id": "pardo_miraflores"
}
```

**Permisos Requeridos**: `update_order_status`

#### POST `/motorizado/confirma`
**Descripción**: Motorizado confirma que recogió el pedido

**Body**:
```javascript
{
  "pedido_id": "uuid",
  "motorizado_id": "uuid-del-motorizado",
  "tenant_id": "pardo_miraflores"
}
```

**Permisos Requeridos**: `update_order_status`

---

### Inventario

#### POST `/inventario/consultar`
**Descripción**: Consultar inventario de productos

**Headers**:
```javascript
{
  'Content-Type': 'application/json',
  'x-tenant-id': 'pardo_miraflores'
}
```

**Body**:
```javascript
{
  "productos_ids": ["uuid1", "uuid2", ...]
}
```

**Respuesta**:
```javascript
{
  "inventario": [
    {
      "producto_id": "uuid",
      "tenant_id": "pardo_miraflores",
      "stock_actual": 50,
      "stock_minimo": 10,
      "stock_maximo": 100,
      "ultima_actualizacion": "2025-11-29T..."
    }
  ]
}
```

#### POST `/inventario/ajustar`
**Descripción**: Ajustar inventario manualmente

**Headers**:
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <token>',
  'x-tenant-id': 'pardo_miraflores'
}
```

**Body**:
```javascript
{
  "producto_id": "uuid",
  "cantidad": 20, // Positivo para entrada, negativo para salida
  "tipo_movimiento": "entrada", // o "salida" o "ajuste"
  "reason": "Compra de inventario"
}
```

**Permisos Requeridos**: `manage_inventory`

---

## 🔐 Autenticación y Autorización

### Obtener Token
```javascript
const token = localStorage.getItem('pardos-system-token');
```

### Headers con Autenticación
```javascript
const getAuthHeaders = (tenantId) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
  'x-tenant-id': tenantId
});
```

### Verificar Permisos
```javascript
const user = JSON.parse(localStorage.getItem('pardos-system-user'));

// Verificar si es admin
const isAdmin = user.staff_tier === 'admin';

// Verificar permiso específico
const hasPermission = (permission) => {
  return user.permissions && user.permissions.includes(permission);
};
```

### Lista de Permisos

**Trabajador** (`staff_tier: "trabajador"`):
- `view_products`
- `view_orders`
- `update_order_status`
- `view_customers`
- `manage_own_profile`

**Admin** (`staff_tier: "admin"`):
- Todos los de trabajador, más:
- `manage_products`
- `manage_orders`
- `manage_staff_trabajador`
- `view_reports`
- `manage_inventory`
- `generate_invitation_codes`
- `manage_all_profiles`

---

## 📦 Actualización de `api.js` (Frontend Admin)

### Estructura Sugerida

```javascript
// front_admin_pardo/src/config/api.js

export const API_BASE_URL = 'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev';

// ===== LOCAL STORAGE =====
const TOKEN_KEY = 'pardos-system-token';
const USER_KEY = 'pardos-system-user';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeAuthToken = () => localStorage.removeItem(TOKEN_KEY);

export const getUserData = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};
export const setUserData = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));
export const removeUserData = () => localStorage.removeItem(USER_KEY);

export const isAuthenticated = () => !!getAuthToken();

// ===== HEADERS =====
export const getAuthHeaders = (tenantId) => {
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId
  };
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// ===== HANDLE RESPONSE =====
const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      removeUserData();
      window.location.href = '/login';
    }
    
    throw {
      status: response.status,
      message: data.message || 'Error en la petición',
      data
    };
  }
  
  return data;
};

// ===== AUTH API =====
export const loginStaffAPI = async (email, password, tenant_id_sede) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      frontend_type: 'staff',
      tenant_id_sede
    })
  });
  
  const data = await handleResponse(response);
  
  if (data.token) {
    setAuthToken(data.token);
    setUserData(data.user);
  }
  
  return data;
};

export const logoutStaffAPI = async () => {
  try {
    const token = getAuthToken();
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } finally {
    removeAuthToken();
    removeUserData();
  }
};

export const generateInvitationCodeAPI = async (maxUses = 10, expiresInDays = 30) => {
  const user = getUserData();
  const response = await fetch(`${API_BASE_URL}/auth/generate-invitation`, {
    method: 'POST',
    headers: getAuthHeaders(user.tenant_id_sede),
    body: JSON.stringify({ max_uses: maxUses, expires_in_days: expiresInDays })
  });
  
  return await handleResponse(response);
};

// ===== PRODUCTOS API =====
export const getProductosAPI = async (tenantId) => {
  const response = await fetch(`${API_BASE_URL}/producto/obtener`, {
    headers: getAuthHeaders(tenantId)
  });
  
  return await handleResponse(response);
};

export const createProductoAPI = async (tenantId, productoData) => {
  const response = await fetch(`${API_BASE_URL}/producto`, {
    method: 'POST',
    headers: getAuthHeaders(tenantId),
    body: JSON.stringify(productoData)
  });
  
  return await handleResponse(response);
};

export const updateProductoAPI = async (tenantId, productoId, productoData) => {
  const response = await fetch(`${API_BASE_URL}/producto/${productoId}`, {
    method: 'PUT',
    headers: getAuthHeaders(tenantId),
    body: JSON.stringify(productoData)
  });
  
  return await handleResponse(response);
};

export const deleteProductoAPI = async (tenantId, productoId) => {
  const response = await fetch(`${API_BASE_URL}/producto/${productoId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(tenantId)
  });
  
  return await handleResponse(response);
};

// ===== PEDIDOS API =====
export const getAllOrdersAPI = async (tenantId, params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `${API_BASE_URL}/pedido/consultar${queryParams ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url, {
    headers: getAuthHeaders(tenantId)
  });
  
  return await handleResponse(response);
};

// ===== WORKFLOW API =====
export const confirmarChefAPI = async (tenantId, pedidoId, chefId) => {
  const response = await fetch(`${API_BASE_URL}/chef/confirma`, {
    method: 'POST',
    headers: getAuthHeaders(tenantId),
    body: JSON.stringify({ pedido_id: pedidoId, chef_id: chefId, tenant_id: tenantId })
  });
  
  return await handleResponse(response);
};

export const confirmarDespachadoAPI = async (tenantId, pedidoId) => {
  const response = await fetch(`${API_BASE_URL}/despachado/confirma`, {
    method: 'POST',
    headers: getAuthHeaders(tenantId),
    body: JSON.stringify({ pedido_id: pedidoId, tenant_id: tenantId })
  });
  
  return await handleResponse(response);
};

export const confirmarMotorizadoAPI = async (tenantId, pedidoId, motorizadoId) => {
  const response = await fetch(`${API_BASE_URL}/motorizado/confirma`, {
    method: 'POST',
    headers: getAuthHeaders(tenantId),
    body: JSON.stringify({ pedido_id: pedidoId, motorizado_id: motorizadoId, tenant_id: tenantId })
  });
  
  return await handleResponse(response);
};

// ===== INVENTARIO API =====
export const ajustarInventarioAPI = async (tenantId, productoId, cantidad, tipoMovimiento, reason) => {
  const response = await fetch(`${API_BASE_URL}/inventario/ajustar`, {
    method: 'POST',
    headers: getAuthHeaders(tenantId),
    body: JSON.stringify({
      producto_id: productoId,
      cantidad,
      tipo_movimiento: tipoMovimiento,
      reason
    })
  });
  
  return await handleResponse(response);
};

export const consultarInventarioAPI = async (tenantId, productosIds) => {
  const response = await fetch(`${API_BASE_URL}/inventario/consultar`, {
    method: 'POST',
    headers: getAuthHeaders(tenantId),
    body: JSON.stringify({ productos_ids: productosIds })
  });
  
  return await handleResponse(response);
};
```

---

## 🎯 Pasos de Integración

### 1. Actualizar `api.js`
- Reemplazar el contenido actual con la estructura sugerida arriba
- Actualizar `API_BASE_URL` si cambia

### 2. Actualizar Componente `Login.jsx`
```javascript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginStaffAPI } from '../config/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sede, setSede] = useState('pardo_miraflores');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await loginStaffAPI(email, password, sede);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... JSX con form y selector de sede
  );
};
```

### 3. Proteger Rutas
Crear un `ProtectedRoute.jsx`:
```javascript
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../config/api';

const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default ProtectedRoute;
```

Usar en rutas:
```javascript
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

### 4. Actualizar Componentes de Productos
- Reemplazar funciones simuladas con llamadas reales a la API
- Agregar manejo de errores y loading states
- Usar `getUserData()` para obtener `tenant_id_sede`

### 5. Actualizar Dashboard y MisPedidos
- Conectar con `getAllOrdersAPI`
- Implementar polling para actualización en tiempo real
- Filtrar pedidos según rol del usuario

### 6. Implementar Flujo de Workflow
- Crear botones para confirmar estados (Chef, Despachado, Motorizado)
- Validar permisos antes de mostrar botones
- Actualizar UI después de cada confirmación

---

## ⚠️ Errores Comunes y Soluciones

### Error 401 - No autenticado
- **Causa**: Token no válido o expirado
- **Solución**: Verificar que el token esté en localStorage y sea válido. Si no, redirigir a login.

### Error 403 - Sin permisos
- **Causa**: El usuario no tiene los permisos necesarios
- **Solución**: Verificar `user.permissions` antes de llamar a la API. Ocultar botones/opciones si no tiene permiso.

### Error 409 - Conflicto en Step Functions
- **Causa**: Intentar confirmar un estado que no está esperando confirmación
- **Solución**: Verificar que el pedido esté en el estado correcto antes de llamar al endpoint. Por ejemplo, solo llamar a `/chef/confirma` si el estado es "pendiente".

### Productos no se cargan
- **Causa**: `x-tenant-id` header no está siendo enviado
- **Solución**: Siempre incluir el header `x-tenant-id` con el valor de la sede (`pardo_miraflores` o `pardo_surco`)

### `undefined` en datos del pedido
- **Causa**: DynamoDB no acepta valores `undefined`
- **Solución**: Asegurar que todos los campos tengan valores válidos (usar `null`, `''`, o `0` en lugar de `undefined`)

---

## 🧪 Testing

### Herramientas Sugeridas
- **Postman**: Para probar endpoints individuales
- **Thunder Client** (VS Code): Alternativa ligera a Postman
- **Browser DevTools**: Para inspeccionar requests/responses

### Casos de Prueba

1. **Login exitoso**
   - Probar con credenciales válidas
   - Verificar que el token se guarde en localStorage

2. **Crear producto**
   - Probar con datos válidos
   - Verificar que aparezca en la lista

3. **Flujo completo de pedido**
   - Crear pedido → Chef confirma → Despachado confirma → Motorizado confirma
   - Verificar que cada paso actualice el estado correctamente

4. **Permisos**
   - Login como trabajador → Intentar crear producto (debe fallar con 403)
   - Login como admin → Crear producto (debe funcionar)

5. **Multi-tenant**
   - Crear producto en `pardo_miraflores`
   - Cambiar a `pardo_surco` y verificar que no aparezca
   - Crear producto en `pardo_surco` y verificar que solo aparezca ahí

---

## 📞 Soporte

Si encuentras problemas durante la integración:
1. Verifica los logs de CloudWatch en AWS
2. Inspecciona las respuestas de la API en DevTools
3. Revisa los permisos del usuario autenticado
4. Asegúrate de que el `x-tenant-id` header sea correcto

---

¡Buena suerte con la integración! 🚀

