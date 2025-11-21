#!/bin/bash

# Ejemplos de CURL para insertar productos fake
# Base URL de la API
BASE_URL="https://9uoan5h0h1.execute-api.us-east-1.amazonaws.com/dev"
TENANT_ID="pardo"

echo "🍔 Ejemplos de CURL para insertar productos"
echo "=========================================="
echo ""

# Producto 1: Hamburguesa Clásica
echo "1. Crear Hamburguesa Clásica:"
echo "curl -X POST '$BASE_URL/producto' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'x-tenant-id: $TENANT_ID' \\"
echo "  -d '{"
echo "    \"nombre_producto\": \"Hamburguesa Clásica\","
echo "    \"tipo_producto\": \"single\","
echo "    \"descripcion_producto\": \"Hamburguesa con carne, lechuga, tomate y queso\","
echo "    \"precio_producto\": \"15.50\","
echo "    \"currency\": \"PEN\","
echo "    \"is_active\": true,"
echo "    \"image_url\": \"https://example.com/images/hamburguesa-clasica.jpg\""
echo "  }'"
echo ""

# Producto 2: Hamburguesa BBQ
echo "2. Crear Hamburguesa BBQ:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Hamburguesa BBQ",
    "tipo_producto": "single",
    "descripcion_producto": "Hamburguesa con salsa BBQ, cebolla caramelizada y bacon",
    "precio_producto": "18.90",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/hamburguesa-bbq.jpg"
  }'
echo ""
echo ""

# Producto 3: Papas Fritas
echo "3. Crear Papas Fritas:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Papas Fritas",
    "tipo_producto": "single",
    "descripcion_producto": "Papas fritas crujientes con sal",
    "precio_producto": "8.50",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/papas-fritas.jpg"
  }'
echo ""
echo ""

# Producto 4: Coca Cola
echo "4. Crear Coca Cola 500ml:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Coca Cola 500ml",
    "tipo_producto": "single",
    "descripcion_producto": "Refresco gaseoso Coca Cola 500ml",
    "precio_producto": "5.00",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/coca-cola.jpg"
  }'
echo ""
echo ""

# Producto 5: Inca Kola
echo "5. Crear Inca Kola 500ml:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Inca Kola 500ml",
    "tipo_producto": "single",
    "descripcion_producto": "Refresco gaseoso Inca Kola 500ml",
    "precio_producto": "5.00",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/inca-kola.jpg"
  }'
echo ""
echo ""

# Producto 6: Nuggets
echo "6. Crear Nuggets de Pollo:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Nuggets de Pollo (6 unidades)",
    "tipo_producto": "single",
    "descripcion_producto": "6 nuggets de pollo crujientes con salsa",
    "precio_producto": "12.00",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/nuggets.jpg"
  }'
echo ""
echo ""

# Producto 7: Alitas
echo "7. Crear Alitas de Pollo:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Alitas de Pollo (6 unidades)",
    "tipo_producto": "single",
    "descripcion_producto": "6 alitas de pollo con salsa picante",
    "precio_producto": "16.50",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/alitas.jpg"
  }'
echo ""
echo ""

# Producto 8: Ensalada
echo "8. Crear Ensalada César:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Ensalada César",
    "tipo_producto": "single",
    "descripcion_producto": "Ensalada fresca con pollo, lechuga, crutones y aderezo césar",
    "precio_producto": "14.00",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/ensalada-cesar.jpg"
  }'
echo ""
echo ""

# Combo (nota: necesitarás reemplazar los product_id con IDs reales)
echo "9. Crear Combo Hamburguesa Clásica (necesita IDs reales de productos):"
echo "NOTA: Reemplaza los product_id con los IDs reales de los productos creados anteriormente"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Combo Hamburguesa Clásica",
    "tipo_producto": "combo",
    "descripcion_producto": "Hamburguesa clásica + Papas fritas + Bebida 500ml",
    "precio_producto": "25.00",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/combo-hamburguesa.jpg",
    "combo_items": [
      {"product_id": "REEMPLAZAR_CON_ID_HAMBURGUESA", "sku": "HAMB-001", "quantity": 1},
      {"product_id": "REEMPLAZAR_CON_ID_PAPAS", "sku": "PAP-001", "quantity": 1},
      {"product_id": "REEMPLAZAR_CON_ID_BEBIDA", "sku": "BEB-001", "quantity": 1}
    ]
  }'
echo ""
echo ""

# Promoción
echo "10. Crear Promo 2x1:"
curl -X POST "$BASE_URL/producto" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "nombre_producto": "Promo 2x1 Hamburguesas",
    "tipo_producto": "promotion",
    "descripcion_producto": "Lleva 2 hamburguesas clásicas al precio de 1 (válido solo martes)",
    "precio_producto": "15.50",
    "currency": "PEN",
    "is_active": true,
    "image_url": "https://example.com/images/promo-2x1.jpg"
  }'
echo ""
echo ""

echo "✅ Ejemplos completados!"
echo ""
echo "💡 Para obtener todos los productos creados:"
echo "curl -X GET '$BASE_URL/producto/obtener?tenant_id=$TENANT_ID' -H 'x-tenant-id: $TENANT_ID'"
echo ""
echo "💡 Para ajustar inventario de un producto (reemplaza PRODUCTO_ID):"
echo "curl -X POST '$BASE_URL/inventario/ajustar' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'x-tenant-id: $TENANT_ID' \\"
echo "  -d '{"
echo "    \"producto_id\": \"PRODUCTO_ID\","
echo "    \"cantidad\": 100,"
echo "    \"tipo_movimiento\": \"entrada\","
echo "    \"reason\": \"Stock inicial\""
echo "  }'"

