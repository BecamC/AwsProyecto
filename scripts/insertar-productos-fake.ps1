# Script PowerShell para insertar productos fake en el sistema
# Uso: .\insertar-productos-fake.ps1

$BASE_URL = "https://9uoan5h0h1.execute-api.us-east-1.amazonaws.com/dev"
$TENANT_ID = "pardo"

Write-Host "🍔 Insertando productos fake en el sistema..." -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL"
Write-Host "Tenant ID: $TENANT_ID"
Write-Host ""

# Función para hacer POST
function Post-Producto {
    param(
        [string]$nombre,
        [string]$tipo,
        [string]$descripcion,
        [string]$precio,
        [string]$categoria,
        [string]$imagen_url,
        [string]$combo_items = ""
    )
    
    $body = @{
        nombre_producto = $nombre
        tipo_producto = $tipo
        descripcion_producto = $descripcion
        precio_producto = $precio
        currency = "PEN"
        is_active = $true
        image_url = $imagen_url
    } | ConvertTo-Json
    
    if ($combo_items) {
        $bodyObj = $body | ConvertFrom-Json
        $bodyObj | Add-Member -NotePropertyName "combo_items" -NotePropertyValue ($combo_items | ConvertFrom-Json)
        $body = $bodyObj | ConvertTo-Json -Depth 10
    }
    
    Write-Host "📦 Creando: $nombre" -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/producto" `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json"
                "x-tenant-id" = $TENANT_ID
            } `
            -Body $body
        
        Write-Host "✅ Creado exitosamente - ID: $($response.producto.producto_id)" -ForegroundColor Green
        return $response.producto.producto_id
    }
    catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        return $null
    }
    Write-Host ""
}

# Productos individuales (single)
Write-Host "=== Creando productos individuales ===" -ForegroundColor Cyan
Write-Host ""

$productos = @(
    @{
        nombre = "Hamburguesa Clásica"
        tipo = "single"
        descripcion = "Hamburguesa con carne, lechuga, tomate y queso"
        precio = "15.50"
        categoria = "hamburguesas"
        imagen = "https://example.com/images/hamburguesa-clasica.jpg"
    },
    @{
        nombre = "Hamburguesa BBQ"
        tipo = "single"
        descripcion = "Hamburguesa con salsa BBQ, cebolla caramelizada y bacon"
        precio = "18.90"
        categoria = "hamburguesas"
        imagen = "https://example.com/images/hamburguesa-bbq.jpg"
    },
    @{
        nombre = "Papas Fritas"
        tipo = "single"
        descripcion = "Papas fritas crujientes con sal"
        precio = "8.50"
        categoria = "acompañamientos"
        imagen = "https://example.com/images/papas-fritas.jpg"
    },
    @{
        nombre = "Coca Cola 500ml"
        tipo = "single"
        descripcion = "Refresco gaseoso Coca Cola 500ml"
        precio = "5.00"
        categoria = "bebidas"
        imagen = "https://example.com/images/coca-cola.jpg"
    },
    @{
        nombre = "Inca Kola 500ml"
        tipo = "single"
        descripcion = "Refresco gaseoso Inca Kola 500ml"
        precio = "5.00"
        categoria = "bebidas"
        imagen = "https://example.com/images/inca-kola.jpg"
    },
    @{
        nombre = "Nuggets de Pollo (6 unidades)"
        tipo = "single"
        descripcion = "6 nuggets de pollo crujientes con salsa"
        precio = "12.00"
        categoria = "pollo"
        imagen = "https://example.com/images/nuggets.jpg"
    },
    @{
        nombre = "Alitas de Pollo (6 unidades)"
        tipo = "single"
        descripcion = "6 alitas de pollo con salsa picante"
        precio = "16.50"
        categoria = "pollo"
        imagen = "https://example.com/images/alitas.jpg"
    },
    @{
        nombre = "Ensalada César"
        tipo = "single"
        descripcion = "Ensalada fresca con pollo, lechuga, crutones y aderezo césar"
        precio = "14.00"
        categoria = "ensaladas"
        imagen = "https://example.com/images/ensalada-cesar.jpg"
    }
)

$productoIds = @()
foreach ($producto in $productos) {
    $id = Post-Producto -nombre $producto.nombre `
        -tipo $producto.tipo `
        -descripcion $producto.descripcion `
        -precio $producto.precio `
        -categoria $producto.categoria `
        -imagen_url $producto.imagen
    if ($id) {
        $productoIds += $id
    }
    Start-Sleep -Milliseconds 500
}

# Productos combo
Write-Host ""
Write-Host "=== Creando combos ===" -ForegroundColor Cyan
Write-Host ""

# Combo Hamburguesa (usando IDs de ejemplo - en producción usar los IDs reales)
$comboItems = @(
    @{
        product_id = "producto-hamburguesa-id"
        sku = "HAMB-001"
        quantity = 1
    },
    @{
        product_id = "producto-papas-id"
        sku = "PAP-001"
        quantity = 1
    },
    @{
        product_id = "producto-bebida-id"
        sku = "BEB-001"
        quantity = 1
    }
) | ConvertTo-Json

Post-Producto -nombre "Combo Hamburguesa Clásica" `
    -tipo "combo" `
    -descripcion "Hamburguesa clásica + Papas fritas + Bebida 500ml" `
    -precio "25.00" `
    -categoria "combos" `
    -imagen_url "https://example.com/images/combo-hamburguesa.jpg" `
    -combo_items $comboItems

# Productos promoción
Write-Host ""
Write-Host "=== Creando promociones ===" -ForegroundColor Cyan
Write-Host ""

Post-Producto -nombre "Promo 2x1 Hamburguesas" `
    -tipo "promotion" `
    -descripcion "Lleva 2 hamburguesas clásicas al precio de 1 (válido solo martes)" `
    -precio "15.50" `
    -categoria "promociones" `
    -imagen_url "https://example.com/images/promo-2x1.jpg"

Post-Producto -nombre "Promo Familiar" `
    -tipo "promotion" `
    -descripcion "4 hamburguesas + 4 papas + 4 bebidas (ahorra 20%)" `
    -precio "85.00" `
    -categoria "promociones" `
    -imagen_url "https://example.com/images/promo-familiar.jpg"

Write-Host ""
Write-Host "✅ Proceso completado!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Nota: Los combo_items usan IDs de ejemplo." -ForegroundColor Yellow
Write-Host "   En producción, deberías obtener los IDs reales de los productos creados." -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Para verificar los productos creados, ejecuta:" -ForegroundColor Cyan
Write-Host "   Invoke-RestMethod -Uri '$BASE_URL/producto/obtener?tenant_id=$TENANT_ID' -Headers @{'x-tenant-id'='$TENANT_ID'}"

