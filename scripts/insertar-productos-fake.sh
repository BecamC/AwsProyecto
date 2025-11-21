#!/bin/bash

# Script para insertar productos fake en el sistema
# Uso: ./insertar-productos-fake.sh

BASE_URL="https://9uoan5h0h1.execute-api.us-east-1.amazonaws.com/dev"
TENANT_ID="pardo"

echo "🍔 Insertando productos fake en el sistema..."
echo "Base URL: $BASE_URL"
echo "Tenant ID: $TENANT_ID"
echo ""

# Función para hacer POST
post_producto() {
    local nombre=$1
    local tipo=$2
    local descripcion=$3
    local precio=$4
    local categoria=$5
    local imagen_url=$6
    local combo_items=$7
    
    local body
    if [ -z "$combo_items" ]; then
        body=$(cat <<EOF
{
  "nombre_producto": "$nombre",
  "tipo_producto": "$tipo",
  "descripcion_producto": "$descripcion",
  "precio_producto": "$precio",
  "currency": "PEN",
  "is_active": true,
  "image_url": "$imagen_url"
}
EOF
)
    else
        body=$(cat <<EOF
{
  "nombre_producto": "$nombre",
  "tipo_producto": "$tipo",
  "descripcion_producto": "$descripcion",
  "precio_producto": "$precio",
  "currency": "PEN",
  "is_active": true,
  "image_url": "$imagen_url",
$combo_items
}
EOF
)
    fi
    
    echo "📦 Creando: $nombre"
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/producto" \
        -H "Content-Type: application/json" \
        -H "x-tenant-id: $TENANT_ID" \
        -d "$body")
    
    http_code=$(echo "$response" | tail -n1)
    body_response=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 201 ]; then
        echo "✅ Creado exitosamente"
        echo "$body_response" | jq -r '.producto.producto_id' | head -1
    else
        echo "❌ Error ($http_code): $body_response"
    fi
    echo ""
}

# Productos individuales (single)
echo "=== Creando productos individuales ==="
post_producto \
    "Hamburguesa Clásica" \
    "single" \
    "Hamburguesa con carne, lechuga, tomate y queso" \
    "15.50" \
    "hamburguesas" \
    "https://example.com/images/hamburguesa-clasica.jpg" \
    ""

post_producto \
    "Hamburguesa BBQ" \
    "single" \
    "Hamburguesa con salsa BBQ, cebolla caramelizada y bacon" \
    "18.90" \
    "hamburguesas" \
    "https://example.com/images/hamburguesa-bbq.jpg" \
    ""

post_producto \
    "Papas Fritas" \
    "single" \
    "Papas fritas crujientes con sal" \
    "8.50" \
    "acompañamientos" \
    "https://example.com/images/papas-fritas.jpg" \
    ""

post_producto \
    "Coca Cola 500ml" \
    "single" \
    "Refresco gaseoso Coca Cola 500ml" \
    "5.00" \
    "bebidas" \
    "https://example.com/images/coca-cola.jpg" \
    ""

post_producto \
    "Inca Kola 500ml" \
    "single" \
    "Refresco gaseoso Inca Kola 500ml" \
    "5.00" \
    "bebidas" \
    "https://example.com/images/inca-kola.jpg" \
    ""

post_producto \
    "Nuggets de Pollo (6 unidades)" \
    "single" \
    "6 nuggets de pollo crujientes con salsa" \
    "12.00" \
    "pollo" \
    "https://example.com/images/nuggets.jpg" \
    ""

post_producto \
    "Alitas de Pollo (6 unidades)" \
    "single" \
    "6 alitas de pollo con salsa picante" \
    "16.50" \
    "pollo" \
    "https://example.com/images/alitas.jpg" \
    ""

post_producto \
    "Ensalada César" \
    "single" \
    "Ensalada fresca con pollo, lechuga, crutones y aderezo césar" \
    "14.00" \
    "ensaladas" \
    "https://example.com/images/ensalada-cesar.jpg" \
    ""

# Productos combo
echo ""
echo "=== Creando combos ==="
echo "⚠️  NOTA: Los combos requieren IDs reales de productos."
echo "   Para crear un combo, primero crea los productos individuales,"
echo "   obtén sus IDs, y luego crea el combo con esos IDs."
echo ""
echo "   Ejemplo de creación manual de combo:"
echo "   curl -X POST '$BASE_URL/producto' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'x-tenant-id: $TENANT_ID' \\"
echo "     -d '{"
echo "       \"nombre_producto\": \"Combo Hamburguesa Clásica\","
echo "       \"tipo_producto\": \"combo\","
echo "       \"descripcion_producto\": \"Hamburguesa + Papas + Bebida\","
echo "       \"precio_producto\": \"25.00\","
echo "       \"currency\": \"PEN\","
echo "       \"is_active\": true,"
echo "       \"combo_items\": ["
echo "         {\"product_id\": \"ID_REAL_1\", \"sku\": \"HAMB-001\", \"quantity\": 1},"
echo "         {\"product_id\": \"ID_REAL_2\", \"sku\": \"PAP-001\", \"quantity\": 1},"
echo "         {\"product_id\": \"ID_REAL_3\", \"sku\": \"BEB-001\", \"quantity\": 1}"
echo "       ]"
echo "     }'"
echo ""

# Productos promoción
echo ""
echo "=== Creando promociones ==="

post_producto \
    "Promo 2x1 Hamburguesas" \
    "promotion" \
    "Lleva 2 hamburguesas clásicas al precio de 1 (válido solo martes)" \
    "15.50" \
    "promociones" \
    "https://example.com/images/promo-2x1.jpg" \
    ""

post_producto \
    "Promo Familiar" \
    "promotion" \
    "4 hamburguesas + 4 papas + 4 bebidas (ahorra 20%)" \
    "85.00" \
    "promociones" \
    "https://example.com/images/promo-familiar.jpg" \
    ""

echo ""
echo "✅ Proceso completado!"
echo ""
echo "💡 Nota: Los combo_items usan IDs de ejemplo."
echo "   En producción, deberías obtener los IDs reales de los productos creados."
echo ""
echo "📋 Para verificar los productos creados, ejecuta:"
echo "   curl -X GET '$BASE_URL/producto/obtener?tenant_id=$TENANT_ID' -H 'x-tenant-id: $TENANT_ID'"

