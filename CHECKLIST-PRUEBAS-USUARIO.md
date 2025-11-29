# ✅ Checklist de Pruebas - Frontend Usuario

## 🎯 Objetivo
Verificar que todas las funcionalidades del frontend de usuario funcionen correctamente con el backend integrado.

---

## 1. 🔐 Autenticación

### 1.1 Registro de Usuario
- [ ] **Navegar a `/register`**
- [ ] **Completar formulario de registro:**
  - Nombre y apellido
  - Email válido
  - Contraseña (mínimo 6 caracteres)
  - Confirmar contraseña
  - Teléfono (opcional)
- [ ] **Hacer clic en "Crear cuenta"**
- [ ] **Verificar:**
  - ✅ Se crea la cuenta exitosamente
  - ✅ Se hace login automático
  - ✅ Se redirige a `/home`
  - ✅ Token se guarda en localStorage (`pardos-auth-token`)
  - ✅ Datos de usuario se guardan en localStorage (`pardos-user`)

### 1.2 Login de Usuario
- [ ] **Navegar a `/login`**
- [ ] **Ingresar credenciales:**
  - Email del usuario registrado
  - Contraseña correcta
- [ ] **Hacer clic en "Iniciar sesión"**
- [ ] **Verificar:**
  - ✅ Login exitoso
  - ✅ Redirección a `/home`
  - ✅ Token guardado en localStorage
  - ✅ Datos de usuario guardados

### 1.3 Login con Credenciales Incorrectas
- [ ] **Intentar login con:**
  - Email incorrecto
  - Contraseña incorrecta
- [ ] **Verificar:**
  - ✅ Muestra mensaje de error apropiado
  - ✅ No redirige
  - ✅ No guarda token

### 1.4 Logout
- [ ] **Estar autenticado**
- [ ] **Hacer clic en "Cerrar sesión"**
- [ ] **Verificar:**
  - ✅ Token eliminado de localStorage
  - ✅ Datos de usuario eliminados
  - ✅ Redirección a `/login` o `/home`

---

## 2. 🏢 Selección de Sede (Multi-Tenant)

### 2.1 Visualización de Sedes
- [ ] **Navegar a `/home` (sin estar autenticado)**
- [ ] **Verificar:**
  - ✅ Se muestran 2 sedes:
    - **PARDOS MIRAFLORES** (Av. Benavides 730, Miraflores)
    - **PARDOS SURCO** (Av. Primavera 645, Surco)
  - ✅ NO se muestran "SEDE 1" o "SEDE 2"

### 2.2 Selección de Sede - Miraflores
- [ ] **Hacer clic en "PARDOS MIRAFLORES"**
- [ ] **Verificar:**
  - ✅ Se guarda `pardo_miraflores` en localStorage (`pardos-sede-selected`)
  - ✅ Redirección a `/menu` (Carta)
  - ✅ Se cargan productos de Miraflores
  - ✅ En DevTools → Network, verificar que header `x-tenant-id: pardo_miraflores` se envía

### 2.3 Selección de Sede - Surco
- [ ] **Volver a `/home`**
- [ ] **Hacer clic en "PARDOS SURCO"**
- [ ] **Verificar:**
  - ✅ Se guarda `pardo_surco` en localStorage
  - ✅ Redirección a `/menu`
  - ✅ Se cargan productos de Surco (diferentes a Miraflores)
  - ✅ En DevTools → Network, verificar que header `x-tenant-id: pardo_surco` se envía

### 2.4 Cambio de Sede
- [ ] **Estar en `/menu` con Miraflores seleccionado**
- [ ] **Cambiar sede usando el selector en la parte superior**
- [ ] **Verificar:**
  - ✅ Los productos cambian inmediatamente
  - ✅ Se actualiza el localStorage
  - ✅ Se envía el nuevo `x-tenant-id` en las peticiones

---

## 3. 📦 Visualización de Productos

### 3.1 Lista de Productos
- [ ] **Navegar a `/menu` (sin estar autenticado)**
- [ ] **Verificar:**
  - ✅ Se cargan productos de la sede seleccionada
  - ✅ Se muestran categorías en el sidebar
  - ✅ Los productos se filtran por categoría al hacer clic
  - ✅ Cada producto muestra:
    - Nombre
    - Precio
    - Imagen
    - Descripción (si existe)

### 3.2 Productos por Sede
- [ ] **Seleccionar Miraflores → Ver productos**
- [ ] **Anotar algunos nombres de productos**
- [ ] **Cambiar a Surco**
- [ ] **Verificar:**
  - ✅ Los productos son diferentes (o algunos son comunes)
  - ✅ Los precios pueden variar
  - ✅ El inventario es independiente

### 3.3 Detalle de Producto
- [ ] **Hacer clic en un producto**
- [ ] **Verificar:**
  - ✅ Se muestra información completa del producto
  - ✅ Precio correcto
  - ✅ Imagen se carga
  - ✅ Descripción visible

---

## 4. 🛒 Creación de Pedidos

### 4.1 Agregar Productos al Carrito (Sin Autenticación)
- [ ] **Estar en `/menu` sin estar autenticado**
- [ ] **Intentar agregar producto al carrito**
- [ ] **Verificar:**
  - ✅ Se puede agregar al carrito (opcional, depende de implementación)
  - ✅ O muestra mensaje de que necesita login

### 4.2 Crear Pedido (Con Autenticación)
- [ ] **Estar autenticado**
- [ ] **Navegar a `/menu`**
- [ ] **Agregar productos al carrito**
- [ ] **Ir a checkout o crear pedido**
- [ ] **Completar formulario:**
  - Dirección de entrega
  - Teléfono
  - Medio de pago
  - Notas (opcional)
- [ ] **Crear pedido**
- [ ] **Verificar:**
  - ✅ Pedido creado exitosamente
  - ✅ Se muestra `pedido_id` en la respuesta
  - ✅ El pedido tiene `tenant_id` de la sede seleccionada
  - ✅ Se redirige a página de seguimiento o confirmación
  - ✅ En DevTools → Network, verificar:
    - Header `Authorization: Bearer <token>` se envía
    - Header `x-tenant-id` se envía
    - Body incluye `usuario_id` del JWT

### 4.3 Crear Pedido Sin Autenticación
- [ ] **Cerrar sesión**
- [ ] **Intentar crear pedido**
- [ ] **Verificar:**
  - ✅ Muestra error o redirige a login
  - ✅ No se crea el pedido

### 4.4 Validación de Productos
- [ ] **Intentar crear pedido con:**
  - Productos vacíos
  - Cantidad 0 o negativa
  - Sin dirección
- [ ] **Verificar:**
  - ✅ Muestra mensajes de validación apropiados
  - ✅ No se crea el pedido

---

## 5. 📋 Consulta de Pedidos

### 5.1 Ver Mis Pedidos
- [ ] **Estar autenticado**
- [ ] **Navegar a `/mis-pedidos` o similar**
- [ ] **Verificar:**
  - ✅ Se cargan todos los pedidos del usuario
  - ✅ Se muestran pedidos de AMBAS sedes (Miraflores y Surco)
  - ✅ Cada pedido muestra:
    - Fecha
    - Estado
    - Total
    - Productos
    - Sede (tenant_id)

### 5.2 Filtros de Pedidos
- [ ] **Si hay filtros disponibles:**
  - Por estado
  - Por fecha
  - Por sede
- [ ] **Verificar que funcionen correctamente**

### 5.3 Detalle de Pedido
- [ ] **Hacer clic en un pedido**
- [ ] **Verificar:**
  - ✅ Se muestra información completa
  - ✅ Productos listados
  - ✅ Estado actual
  - ✅ Dirección de entrega
  - ✅ Teléfono

---

## 6. 🔄 Seguimiento de Pedidos (Step Functions)

### 6.1 Crear Pedido y Ver Seguimiento
- [ ] **Crear un nuevo pedido**
- [ ] **Navegar a la página de seguimiento**
- [ ] **Verificar:**
  - ✅ Estado inicial: "Pendiente" o "Pedido Creado"
  - ✅ Se muestra timeline o pasos del proceso
  - ✅ Polling automático (actualización cada 3 segundos)

### 6.2 Estados del Pedido
- [ ] **Verificar que se muestren correctamente:**
  - ✅ Pendiente
  - ✅ Preparando
  - ✅ Listo para despacho
  - ✅ Despachando
  - ✅ Recogiendo
  - ✅ En camino
  - ✅ Entregado
  - ✅ Cancelado

### 6.3 Actualización en Tiempo Real
- [ ] **Crear pedido**
- [ ] **Abrir página de seguimiento**
- [ ] **En otra ventana/terminal, simular cambios de estado (usando admin o API)**
- [ ] **Verificar:**
  - ✅ El frontend se actualiza automáticamente
  - ✅ El estado cambia sin necesidad de refrescar
  - ✅ Los tiempos se muestran correctamente

---

## 7. 🔒 Protección de Rutas

### 7.1 Rutas Públicas
- [ ] **Sin estar autenticado, navegar a:**
  - `/home` → ✅ Debe funcionar
  - `/menu` → ✅ Debe funcionar (ver productos)
  - `/producto/:id` → ✅ Debe funcionar

### 7.2 Rutas Protegidas
- [ ] **Sin estar autenticado, intentar navegar a:**
  - `/checkout` → ✅ Debe redirigir a `/login`
  - `/mis-pedidos` → ✅ Debe redirigir a `/login`
  - `/orden/:id` → ✅ Debe redirigir a `/login`

### 7.3 Acceso con Token Expirado
- [ ] **Modificar token en localStorage a un valor inválido**
- [ ] **Intentar crear pedido**
- [ ] **Verificar:**
  - ✅ Recibe error 401
  - ✅ Token se elimina
  - ✅ Redirige a login

---

## 8. 🌐 Multi-Tenant - Verificación Completa

### 8.1 Productos Independientes
- [ ] **Crear producto en Miraflores (usando admin)**
- [ ] **Verificar que NO aparece en Surco**
- [ ] **Crear producto en Surco**
- [ ] **Verificar que NO aparece en Miraflores**

### 8.2 Inventario Independiente
- [ ] **Verificar inventario de un producto en Miraflores**
- [ ] **Verificar inventario del mismo producto en Surco**
- [ ] **Verificar que son independientes**

### 8.3 Pedidos por Sede
- [ ] **Crear pedido en Miraflores**
- [ ] **Verificar que el pedido tiene `tenant_id: pardo_miraflores`**
- [ ] **Crear pedido en Surco**
- [ ] **Verificar que el pedido tiene `tenant_id: pardo_surco`**
- [ ] **Verificar que el usuario puede ver ambos pedidos en "Mis Pedidos"**

### 8.4 Productos Comunes
- [ ] **Verificar que hay productos que aparecen en AMBAS sedes**
- [ ] **Estos son los productos "comunes" (10 productos duplicados)**

---

## 9. 🐛 Manejo de Errores

### 9.1 Errores de Red
- [ ] **Desconectar internet**
- [ ] **Intentar cargar productos**
- [ ] **Verificar:**
  - ✅ Muestra mensaje de error apropiado
  - ✅ No crashea la aplicación

### 9.2 Errores del Backend
- [ ] **Si el backend devuelve error 500**
- [ ] **Verificar que se muestra mensaje de error al usuario**

### 9.3 Validaciones
- [ ] **Probar validaciones del frontend:**
  - Email inválido
  - Contraseña muy corta
  - Campos requeridos vacíos

---

## 10. 📱 Responsive Design (Opcional)

### 10.1 Mobile
- [ ] **Abrir en dispositivo móvil o DevTools mobile view**
- [ ] **Verificar que:**
  - ✅ El selector de sede se ve bien
  - ✅ Los productos se muestran correctamente
  - ✅ El formulario de pedido es usable

### 10.2 Tablet
- [ ] **Verificar diseño en tablet**

---

## 11. 🔍 Verificación Técnica (DevTools)

### 11.1 Headers en Peticiones
- [ ] **Abrir DevTools → Network**
- [ ] **Verificar que TODAS las peticiones incluyen:**
  - ✅ `x-tenant-id` con el valor correcto
  - ✅ `Content-Type: application/json`
  - ✅ `Authorization: Bearer <token>` (en endpoints protegidos)

### 11.2 LocalStorage
- [ ] **Verificar que se guardan:**
  - ✅ `pardos-auth-token`
  - ✅ `pardos-user`
  - ✅ `pardos-sede-selected`

### 11.3 Console Errors
- [ ] **Abrir DevTools → Console**
- [ ] **Navegar por la aplicación**
- [ ] **Verificar que NO hay errores en consola**

---

## 📝 Notas Importantes

1. **URL del API**: `https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev`
2. **Tenant IDs**: 
   - `pardo_miraflores` para Miraflores
   - `pardo_surco` para Surco
3. **Endpoints públicos**: Solo `/producto/obtener` y `/producto/{id}`
4. **Endpoints protegidos**: Todos los demás requieren autenticación

---

## ✅ Criterios de Éxito

- ✅ Usuario puede registrarse e iniciar sesión
- ✅ Usuario puede seleccionar sede y ver productos correctos
- ✅ Usuario puede crear pedidos solo cuando está autenticado
- ✅ Usuario puede ver todos sus pedidos de todas las sedes
- ✅ Los productos se filtran correctamente por sede
- ✅ El seguimiento de pedidos funciona en tiempo real
- ✅ No hay errores en consola
- ✅ Todas las rutas están protegidas correctamente

---

## 🚨 Problemas Conocidos a Verificar

1. **SKU undefined**: Verificar que los productos tienen SKU o se genera uno por defecto
2. **producto_id null en logs**: Verificar que se guarda correctamente
3. **Estados undefined**: Verificar que todos los estados del pedido se mapean correctamente

---

## 📞 Si Encuentras Problemas

1. **Revisar DevTools Console** para errores
2. **Revisar DevTools Network** para ver las peticiones
3. **Verificar LocalStorage** para ver qué datos se guardan
4. **Revisar CloudWatch Logs** del backend si es necesario

