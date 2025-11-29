/**
 * Script de migración de datos para implementar multi-tenant
 * 
 * Este script toma los datos existentes con tenant_id="pardo" y los distribuye en:
 * - pardo_miraflores (40% de productos no comunes)
 * - pardo_surco (60% de productos no comunes)
 * - 10 productos comunes (presentes en ambas sedes)
 * 
 * Los usuarios y pedidos también se actualizan para reflejar las sedes.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = 'us-east-1';
const STAGE = process.env.STAGE || 'dev';

const TABLA_PRODUCTOS = `TablaProductos-${STAGE}`;
const TABLA_INVENTARIO = `TablaInventario-${STAGE}`;
const TABLA_PEDIDOS = `TablaPedidos-${STAGE}`;

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

// Helper para pausar ejecución
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Obtener todos los productos con tenant_id="pardo"
 */
async function obtenerProductosPardo() {
  console.log('📦 Obteniendo productos de tenant "pardo"...');
  
  const params = {
    TableName: TABLA_PRODUCTOS,
    FilterExpression: 'tenant_id = :tenant',
    ExpressionAttributeValues: {
      ':tenant': 'pardo'
    }
  };
  
  const result = await docClient.send(new ScanCommand(params));
  console.log(`✅ Encontrados ${result.Items.length} productos`);
  
  return result.Items || [];
}

/**
 * Seleccionar 10 productos aleatorios para que sean comunes
 */
function seleccionarProductosComunes(productos, cantidad = 10) {
  const shuffled = [...productos].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(cantidad, productos.length));
}

/**
 * Distribuir productos restantes 40/60 entre las sedes
 */
function distribuirProductos(productosNoComunes) {
  const total = productosNoComunes.length;
  const cantidadMiraflores = Math.ceil(total * 0.4);
  
  // Mezclar para distribución aleatoria
  const shuffled = [...productosNoComunes].sort(() => 0.5 - Math.random());
  
  const productosMiraflores = shuffled.slice(0, cantidadMiraflores);
  const productosSurco = shuffled.slice(cantidadMiraflores);
  
  return { productosMiraflores, productosSurco };
}

/**
 * Eliminar producto con tenant_id antiguo
 */
async function eliminarProducto(producto) {
  await docClient.send(new DeleteCommand({
    TableName: TABLA_PRODUCTOS,
    Key: {
      tenant_id: producto.tenant_id,
      producto_id: producto.producto_id
    }
  }));
}

/**
 * Crear producto en nueva sede
 */
async function crearProductoEnSede(producto, nuevoTenantId) {
  const nuevoProducto = {
    ...producto,
    tenant_id: nuevoTenantId,
    updated_at: new Date().toISOString(),
    migrated_from: 'pardo',
    migrated_at: new Date().toISOString()
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLA_PRODUCTOS,
    Item: nuevoProducto
  }));
  
  return nuevoProducto;
}

/**
 * Migrar inventario para un producto
 */
async function migrarInventario(productoId, sedeOrigen, sedeDestino) {
  // Obtener inventario actual
  const getResult = await docClient.send(new ScanCommand({
    TableName: TABLA_INVENTARIO,
    FilterExpression: 'tenant_id = :tenant AND producto_id = :producto',
    ExpressionAttributeValues: {
      ':tenant': sedeOrigen,
      ':producto': productoId
    }
  }));
  
  if (getResult.Items && getResult.Items.length > 0) {
    const inventarioOriginal = getResult.Items[0];
    
    // Eliminar inventario antiguo
    await docClient.send(new DeleteCommand({
      TableName: TABLA_INVENTARIO,
      Key: {
        tenant_id: inventarioOriginal.tenant_id,
        producto_id: inventarioOriginal.producto_id
      }
    }));
    
    // Crear nuevo inventario en la sede destino
    const nuevoInventario = {
      ...inventarioOriginal,
      tenant_id: sedeDestino,
      ultima_actualizacion: new Date().toISOString(),
      migrated_from: sedeOrigen
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLA_INVENTARIO,
      Item: nuevoInventario
    }));
    
    return true;
  }
  
  return false;
}

/**
 * Crear inventario independiente para productos comunes
 */
async function crearInventarioIndependiente(productoId, sede) {
  const inventarioComun = {
    tenant_id: sede,
    producto_id: productoId,
    stock_actual: 0, // Inventario vacío inicial
    stock_minimo: 10,
    stock_maximo: 9999,
    ultima_actualizacion: new Date().toISOString(),
    created_for_common_product: true
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLA_INVENTARIO,
    Item: inventarioComun
  }));
}

/**
 * Actualizar pedidos con sede aleatoria
 */
async function actualizarPedidos() {
  console.log('\n📋 Actualizando pedidos...');
  
  const result = await docClient.send(new ScanCommand({
    TableName: TABLA_PEDIDOS,
    FilterExpression: 'tenant_id = :tenant',
    ExpressionAttributeValues: {
      ':tenant': 'pardo'
    }
  }));
  
  const pedidos = result.Items || [];
  console.log(`Encontrados ${pedidos.length} pedidos para actualizar`);
  
  let miraforesCount = 0;
  let surcoCount = 0;
  
  for (const pedido of pedidos) {
    // Asignar aleatoriamente a una sede
    const nuevaSede = Math.random() < 0.5 ? 'pardo_miraflores' : 'pardo_surco';
    
    if (nuevaSede === 'pardo_miraflores') {
      miraforesCount++;
    } else {
      surcoCount++;
    }
    
    // Eliminar pedido antiguo
    await docClient.send(new DeleteCommand({
      TableName: TABLA_PEDIDOS,
      Key: {
        tenant_id: pedido.tenant_id,
        pedido_id: pedido.pedido_id
      }
    }));
    
    // Crear pedido con nueva sede
    const nuevoPedido = {
      ...pedido,
      tenant_id: nuevaSede,
      migrated_from: 'pardo',
      migrated_at: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLA_PEDIDOS,
      Item: nuevoPedido
    }));
    
    await sleep(50); // Throttle para no exceder límites
  }
  
  console.log(`✅ Pedidos actualizados:`);
  console.log(`   - Miraflores: ${miraforesCount}`);
  console.log(`   - Surco: ${surcoCount}`);
}

/**
 * Función principal de migración
 */
async function migrar() {
  console.log('🚀 Iniciando migración multi-tenant...\n');
  console.log('Configuración:');
  console.log(`  - Región: ${REGION}`);
  console.log(`  - Stage: ${STAGE}`);
  console.log(`  - Tabla Productos: ${TABLA_PRODUCTOS}`);
  console.log(`  - Tabla Inventario: ${TABLA_INVENTARIO}`);
  console.log(`  - Tabla Pedidos: ${TABLA_PEDIDOS}\n`);
  
  try {
    // 1. Obtener todos los productos
    const todosLosProductos = await obtenerProductosPardo();
    
    if (todosLosProductos.length === 0) {
      console.log('⚠️  No se encontraron productos para migrar');
      return;
    }
    
    // 2. Seleccionar productos comunes (10)
    console.log('\n🔄 Seleccionando productos comunes...');
    const productosComunes = seleccionarProductosComunes(todosLosProductos, 10);
    console.log(`✅ Seleccionados ${productosComunes.length} productos comunes`);
    
    // 3. Productos no comunes
    const productosNoComunesIds = new Set(productosComunes.map(p => p.producto_id));
    const productosNoComunes = todosLosProductos.filter(p => !productosNoComunesIds.has(p.producto_id));
    console.log(`📦 Productos no comunes: ${productosNoComunes.length}`);
    
    // 4. Distribuir productos no comunes 40/60
    console.log('\n📊 Distribuyendo productos no comunes...');
    const { productosMiraflores, productosSurco } = distribuirProductos(productosNoComunes);
    console.log(`✅ Miraflores: ${productosMiraflores.length} productos (${Math.round(productosMiraflores.length / productosNoComunes.length * 100)}%)`);
    console.log(`✅ Surco: ${productosSurco.length} productos (${Math.round(productosSurco.length / productosNoComunes.length * 100)}%)`);
    
    // 5. Migrar productos comunes (duplicarlos en ambas sedes)
    console.log('\n🔄 Migrando productos comunes...');
    for (const producto of productosComunes) {
      console.log(`  - ${producto.nombre_plato || producto.producto_id}`);
      
      // Eliminar el original
      await eliminarProducto(producto);
      
      // Crear en ambas sedes
      await crearProductoEnSede(producto, 'pardo_miraflores');
      await crearProductoEnSede(producto, 'pardo_surco');
      
      // Crear inventario independiente para cada sede
      await crearInventarioIndependiente(producto.producto_id, 'pardo_miraflores');
      await crearInventarioIndependiente(producto.producto_id, 'pardo_surco');
      
      await sleep(100);
    }
    console.log('✅ Productos comunes migrados');
    
    // 6. Migrar productos de Miraflores
    console.log('\n🏢 Migrando productos a Miraflores...');
    for (const producto of productosMiraflores) {
      await eliminarProducto(producto);
      await crearProductoEnSede(producto, 'pardo_miraflores');
      await migrarInventario(producto.producto_id, 'pardo', 'pardo_miraflores');
      await sleep(50);
    }
    console.log('✅ Productos de Miraflores migrados');
    
    // 7. Migrar productos de Surco
    console.log('\n🏢 Migrando productos a Surco...');
    for (const producto of productosSurco) {
      await eliminarProducto(producto);
      await crearProductoEnSede(producto, 'pardo_surco');
      await migrarInventario(producto.producto_id, 'pardo', 'pardo_surco');
      await sleep(50);
    }
    console.log('✅ Productos de Surco migrados');
    
    // 8. Actualizar pedidos
    await actualizarPedidos();
    
    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log('\n📊 Resumen:');
    console.log(`  Total de productos: ${todosLosProductos.length}`);
    console.log(`  Productos comunes (ambas sedes): ${productosComunes.length}`);
    console.log(`  Productos exclusivos Miraflores: ${productosMiraflores.length}`);
    console.log(`  Productos exclusivos Surco: ${productosSurco.length}`);
    console.log(`\n  Total en Miraflores: ${productosComunes.length + productosMiraflores.length}`);
    console.log(`  Total en Surco: ${productosComunes.length + productosSurco.length}`);
    console.log('\n💡 Siguiente paso: Actualizar frontends para incluir selector de sede');
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  migrar()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { migrar };

