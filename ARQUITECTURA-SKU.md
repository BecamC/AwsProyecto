# Arquitectura y Manejo de SKU en el Sistema

## 📋 Resumen

El **SKU (Stock Keeping Unit)** NO es un campo obligatorio en la tabla `TablaProductos` ni en `TablaInventario`. Es un dato **opcional** que solo se usa cuando se crean combos o cuando se necesita referenciar productos de forma específica.

## 🗄️ Estructura de Tablas DynamoDB

### 1. **TablaProductos**
```yaml
Partition Key: tenant_id (String)
Sort Key: producto_id (String)

Campos almacenados:
- tenant_id *
- producto_id *
- nombre_producto *
- tipo_producto * (promociones, sanguches, combos, etc.)
- precio_producto * (Number)
- descripcion_producto
- image_url
- currency (PEN, USD, etc.)
- is_active (Boolean)
- fecha_creacion
- fecha_actualizacion
- sku (OPCIONAL) - Solo necesario para combos o referencias específicas
- combo_items (Array) - Solo si tipo_producto es 'combo'
```

### 2. **TablaInventario**
```yaml
Partition Key: tenant_id (String)
Sort Key: producto_id (String)

Campos almacenados:
- tenant_id *
- producto_id *
- stock_actual * (Number)
- stock_minimo
- stock_maximo
- ultima_actualizacion
```

### 3. **TablaPedidos**
```yaml
Partition Key: tenant_id (String)
Sort Key: pedido_id (String)

Campos almacenados:
- tenant_id *
- pedido_id *
- user_id *
- productos * (Array de objetos con: product_id, sku, price, quantity)
- precio_total
- direccion_entrega
- telefono
- medio_pago
- estado
- fecha_inicio
- fecha_fin
- chef_id
- motorizado_id
- notas
```

## 🔑 ¿Dónde y Cuándo se Usa el SKU?

### **1. En la Tabla de Productos (OPCIONAL)**
- Los productos **pueden** tener un campo `sku` pero **no es obligatorio**
- Solo es requerido cuando:
  - El producto es de tipo `combo` y tiene `combo_items`
  - Se necesita una referencia específica del producto (ej: "HAMB-001", "BEB-001")

### **2. En Combos (OBLIGATORIO para combo_items)**
Cuando un producto es de tipo `combo`, debe incluir `combo_items`:
```javascript
{
  "tipo_producto": "combo",
  "combo_items": [
    {
      "product_id": "uuid-hamburguesa",
      "sku": "HAMB-001",  // OBLIGATORIO en combo_items
      "quantity": 1
    },
    {
      "product_id": "uuid-bebida",
      "sku": "BEB-001",   // OBLIGATORIO en combo_items
      "quantity": 1
    }
  ]
}
```

### **3. En Pedidos (AUTO-GENERADO)**
Cuando se crea un pedido, el handler `crearPedido.js`:
1. Lee el producto de DynamoDB
2. Si el producto tiene `sku`, lo usa
3. Si el producto **NO tiene** `sku`, lo genera automáticamente:
   ```javascript
   sku = `SKU-${producto_id.substring(0, 8).toUpperCase()}`
   // Ejemplo: SKU-030EA623
   ```

## 🔄 Flujo de Creación de Pedido

```
1. Usuario solicita crear pedido con productos
   ↓
2. Handler valida los productos en DynamoDB
   ↓
3. Para cada producto:
   a. Obtiene producto de TablaProductos
   b. Verifica inventario en TablaInventario
   c. Lee producto.sku
   d. Si sku existe → usa ese valor
   e. Si sku NO existe → genera: SKU-{primeros8char-producto_id}
   ↓
4. Crea el pedido con:
   {
     "productos": [
       {
         "product_id": "uuid",
         "sku": "SKU-030EA623" (generado o existente),
         "price": 35.5,
         "quantity": 2
       }
     ]
   }
```

## ✅ Validaciones Actuales

### En `shared/validations.js`:

```javascript
// Para productos normales (single, promociones):
- nombre_producto: REQUERIDO
- tipo_producto: REQUERIDO
- precio_producto: REQUERIDO (number > 0)
- sku: OPCIONAL

// Para combos:
- tipo_producto: "combo"
- combo_items: REQUERIDO (array con al menos 1 item)
  - combo_items[].product_id: REQUERIDO
  - combo_items[].sku: REQUERIDO  ← ÚNICO LUGAR DONDE SKU ES OBLIGATORIO
  - combo_items[].quantity: REQUERIDO (number > 0)
```

## 🎯 Conclusión

### El sistema actual es **CORRECTO** y funciona así:

1. **Productos individuales** (promociones, sanguches, etc.):
   - NO necesitan `sku` en su definición
   - El `sku` se genera automáticamente al crear pedidos

2. **Combos**:
   - Sus `combo_items` SÍ necesitan `sku` para referenciar correctamente los productos incluidos

3. **Pedidos**:
   - Siempre incluyen `sku` en los productos
   - Se obtiene del producto si existe
   - Se genera automáticamente si no existe

### NO hay datos faltantes en tus productos

El producto que mostraste:
```json
{
  "producto_id": "030ea623-7c94-4e6c-b1bb-b58555cef88e",
  "nombre_producto": "1/4 Pardos Brasa Para Mí",
  "precio_producto": 35.5,
  "tipo_producto": "promociones"
}
```

Es completamente válido y **NO necesita** el campo `sku`. Cuando se cree un pedido con este producto, el sistema generará automáticamente:
```
sku: "SKU-030EA623"
```

## 🔧 Configuración para Evitar Errores de `undefined`

El archivo `shared/dynamodb.js` está configurado con:
```javascript
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // ← Elimina automáticamente valores undefined
  },
});
```

Esto asegura que cualquier valor `undefined` se elimine antes de guardar en DynamoDB.

