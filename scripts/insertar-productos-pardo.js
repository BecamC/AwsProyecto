#!/usr/bin/env node

/**
 * Script para insertar todos los productos de Pardo desde productos-data.js
 * 
 * Uso: node insertar-productos-pardo.js
 * 
 * Variables de entorno opcionales:
 * - BASE_URL: URL del API Gateway (default: https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev)
 * - TENANT_ID: ID del tenant (default: "pardo")
 * 
 * Ejemplo con URL personalizada:
 *   BASE_URL=https://tu-api.execute-api.us-east-1.amazonaws.com/dev node insertar-productos-pardo.js
 * 
 * Para obtener la URL actual después de un deploy:
 *   sls info
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuración
// NOTA: Si la URL cambia después de un deploy, actualiza esta línea o usa:
// BASE_URL=https://tu-nueva-url.execute-api.us-east-1.amazonaws.com/dev node insertar-productos-pardo.js
const BASE_URL = process.env.BASE_URL || 'https://tl5son9q35.execute-api.us-east-1.amazonaws.com/dev';
const TENANT_ID = process.env.TENANT_ID || 'pardo';

// Intentar leer productos desde archivo, si no existe, usar array vacío
let productos = [];
try {
  const productosPath = path.join(__dirname, 'productos-data.js');
  if (fs.existsSync(productosPath)) {
    // Leer y parsear el archivo
    const content = fs.readFileSync(productosPath, 'utf8');
    // Extraer el array de productos usando regex
    const match = content.match(/export const productos = (\[[\s\S]*?\]);/);
    if (match) {
      // Evaluar el array (cuidado con eval, pero es un archivo local confiable)
      productos = eval(match[1]);
    }
  }
} catch (error) {
  console.error('Error leyendo productos-data.js:', error.message);
  console.log('Usando productos hardcodeados...');
}

// Si no se pudo leer, usar productos hardcodeados (primeros 20 como ejemplo)
if (productos.length === 0) {
  console.log('⚠️  No se encontró productos-data.js, usando productos de ejemplo');
  productos = [
    {
      "id": 1,
      "categoria": "Promociones",
      "subcategoria": null,
      "nombre": "1/4 Brasa Encamotado Para Mí",
      "descripcion": "1/4 Pardos Brasa, mix de papas fritas con rejillas de camotes fritos, ensalada a elección y gaseosa personal.",
      "precio": 38.90,
      "imagen": "https://images-frontent-user-pardos.s3.us-east-1.amazonaws.com/imgi_18_dea3bca1-e3a9-466a-b267-e4faa4f39296.jpeg"
    }
  ];
}

// Función para hacer petición HTTP
function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Normalizar categoría a tipo_producto (usar la categoría directamente en minúsculas)
function normalizarCategoria(categoria) {
  if (!categoria) return 'otros';
  
  // Normalizar: quitar acentos y convertir a minúsculas
  return categoria
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/\s+/g, '_'); // Reemplazar espacios con guiones bajos
}

// Función para crear producto
async function crearProducto(producto, index) {
  const categoriaNormalizada = normalizarCategoria(producto.categoria);
  
  const body = {
    nombre_producto: producto.nombre,
    descripcion_producto: producto.descripcion || '',
    precio_producto: producto.precio,
    tipo_producto: categoriaNormalizada, // Usar categoría normalizada como tipo_producto
    categoria: producto.categoria,
    image_url: producto.imagen,
    currency: 'PEN',
    is_active: true,
    // Stock NO se incluye aquí - solo el inventario lo controla
  };

  const url = `${BASE_URL}/producto`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify(body),
  };

  try {
    const result = await makeRequest(url, options);
    if (result.status === 201) {
      console.log(`✅ [${String(index + 1).padStart(3, '0')}/${productos.length}] ${producto.nombre.substring(0, 50).padEnd(50)} - ${categoriaNormalizada.padEnd(20)}`);
      return { 
        success: true, 
        producto_id: result.data.producto?.producto_id, 
        tipo: categoriaNormalizada,
        nombre: producto.nombre,
        categoria: producto.categoria
      };
    } else {
      console.error(`❌ [${String(index + 1).padStart(3, '0')}/${productos.length}] ${producto.nombre.substring(0, 50)} - Error (${result.status}):`, JSON.stringify(result.data).substring(0, 100));
      return { success: false, error: result.data };
    }
  } catch (error) {
    console.error(`❌ [${String(index + 1).padStart(3, '0')}/${productos.length}] ${producto.nombre.substring(0, 50)} - Error:`, error.message);
    return { success: false, error: error.message };
  }
}


// Función principal
async function main() {
  console.log('🍔 Iniciando inserción de productos de Pardo...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`Total productos a insertar: ${productos.length}\n`);
  console.log('='.repeat(80));

  const resultados = {
    exitosos: 0,
    fallidos: 0,
    porTipo: {},
    errores: [],
    productosCreados: [], // Guardar productos creados con sus IDs
  };

  // Crear todos los productos usando su categoría como tipo_producto
  console.log('\n📦 Creando productos...\n');
  
  for (let i = 0; i < productos.length; i++) {
    const resultado = await crearProducto(productos[i], i);
    
    if (resultado.success) {
      resultados.exitosos++;
      resultados.productosCreados.push(resultado); // Guardar para crear combos después
      
      // Contar por tipo (categoría)
      const tipo = resultado.tipo || 'otros';
      resultados.porTipo[tipo] = (resultados.porTipo[tipo] || 0) + 1;
    } else {
      resultados.fallidos++;
      resultados.errores.push({
        index: i + 1,
        nombre: productos[i].nombre,
        error: resultado.error
      });
    }
    
    // Pequeño delay entre peticiones (200ms)
    if (i < productos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Resumen de inserción
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMEN DE INSERCIÓN');
  console.log('='.repeat(80));
  console.log(`✅ Exitosos: ${resultados.exitosos}`);
  console.log(`❌ Fallidos: ${resultados.fallidos}`);
  console.log(`\nPor tipo (categoría):`);
  Object.keys(resultados.porTipo).sort().forEach(tipo => {
    console.log(`  - ${tipo}: ${resultados.porTipo[tipo]}`);
  });
  
  if (resultados.errores.length > 0) {
    console.log(`\n⚠️  Errores (primeros 10):`);
    resultados.errores.slice(0, 10).forEach(err => {
      console.log(`  [${err.index}] ${err.nombre}: ${JSON.stringify(err.error).substring(0, 80)}`);
    });
  }

  // PASO 2: Crear combos basados en productos existentes
  console.log('\n' + '='.repeat(80));
  console.log('🔄 PASO 2: Creando combos...\n');
  
  // Función para buscar producto por nombre o palabras clave
  function buscarProducto(productos, palabrasClave) {
    const palabras = palabrasClave.map(p => p.toLowerCase());
    return productos.find(p => {
      const nombre = p.nombre.toLowerCase();
      const categoria = p.categoria?.toLowerCase() || '';
      return palabras.some(palabra => nombre.includes(palabra) || categoria.includes(palabra));
    });
  }

  // Definir combos a crear basados en las descripciones
  const combosACrear = [
    {
      nombre: 'Combo 1/4 Brasa Encamotado',
      descripcion: '1/4 Pardos Brasa, mix de papas fritas con rejillas de camotes fritos, ensalada a elección y gaseosa personal.',
      precio: 38.90,
      imagen: 'https://images-frontent-user-pardos.s3.us-east-1.amazonaws.com/imgi_18_dea3bca1-e3a9-466a-b267-e4faa4f39296.jpeg',
      items: [
        { palabras: ['1/4', 'brasa'], cantidad: 1 },
        { palabras: ['papas', 'fritas'], cantidad: 1 },
        { palabras: ['camotes', 'fritos'], cantidad: 1 },
        { palabras: ['ensalada'], cantidad: 1 },
        { palabras: ['gaseosa', 'personal'], cantidad: 1 },
      ]
    },
    {
      nombre: 'Combo Tú Eliges 1.5 Lts',
      descripcion: '1 Pardos Brasa + papas fritas + guarnición + Inca Kola sin azúcar de 1.5 L. Esta promoción incluye salsas.',
      precio: 90.50,
      imagen: 'https://images-frontent-user-pardos.s3.us-east-1.amazonaws.com/imgi_21_40e5dc4f-ac7b-4694-940e-5b26ae5712c2.jpeg',
      items: [
        { palabras: ['1', 'pardos', 'brasa'], cantidad: 1 },
        { palabras: ['papas', 'fritas'], cantidad: 1 },
        { palabras: ['inca', 'kola', '1.5'], cantidad: 1 },
      ]
    },
    {
      nombre: 'Combo Promoción Para 2',
      descripcion: '1/2 Pardos Brasa + papas fritas + ensalada regular + 2 bebidas personales.',
      precio: 57.50,
      imagen: 'https://images-frontent-user-pardos.s3.us-east-1.amazonaws.com/imgi_24_1c4c6613-a212-4fef-832d-ee53d4ecbcdd.jpeg',
      items: [
        { palabras: ['1/2', 'brasa'], cantidad: 1 },
        { palabras: ['papas', 'fritas'], cantidad: 1 },
        { palabras: ['ensalada'], cantidad: 1 },
        { palabras: ['gaseosa', 'personal'], cantidad: 2 },
      ]
    },
    {
      nombre: 'Combo Brioche Parrillero Completo',
      descripcion: 'Sánguche de Pardos Parrillero con pan brioche, lechuga, papas al hilo, mayonesa Pardos, gaseosa personal y papas fritas.',
      precio: 33.90,
      imagen: 'https://images-frontent-user-pardos.s3.us-east-1.amazonaws.com/sanguches/imgi_18_1da9da56-52d1-4956-80eb-ff510e18ed9b.jpeg',
      items: [
        { palabras: ['brioche', 'parrillero'], cantidad: 1 },
        { palabras: ['papas', 'fritas'], cantidad: 1 },
        { palabras: ['gaseosa', 'personal'], cantidad: 1 },
      ]
    },
    {
      nombre: 'Combo Chicharrón Para Mí',
      descripcion: '5 chicharrones con papas fritas o doradas, guarnición de ensalada Pardos y bebida personal. Este producto incluye salsas.',
      precio: 37.90,
      imagen: 'https://images-frontent-user-pardos.s3.us-east-1.amazonaws.com/imgi_27_76ccbccd-14b7-40ef-b05e-fab1b677fa6e.jpeg',
      items: [
        { palabras: ['chicharrón', 'pollo'], cantidad: 1 },
        { palabras: ['papas', 'fritas'], cantidad: 1 },
        { palabras: ['ensalada'], cantidad: 1 },
        { palabras: ['gaseosa', 'personal'], cantidad: 1 },
      ]
    },
  ];

  let combosCreados = 0;
  let combosFallidos = 0;

  for (const combo of combosACrear) {
    // Buscar productos base para el combo
    const comboItems = [];
    
    for (const item of combo.items) {
      const productoBase = buscarProducto(resultados.productosCreados, item.palabras);
      if (productoBase && productoBase.producto_id) {
        comboItems.push({
          product_id: productoBase.producto_id,
          sku: `SKU-${productoBase.producto_id.substring(0, 8)}`,
          quantity: item.cantidad
        });
      }
    }

    // Solo crear combo si tiene al menos 2 items
    if (comboItems.length >= 2) {
      const body = {
        nombre_producto: combo.nombre,
        descripcion_producto: combo.descripcion,
        precio_producto: combo.precio,
        tipo_producto: 'combo',
        categoria: 'Combos',
        image_url: combo.imagen,
        currency: 'PEN',
        is_active: true,
        combo_items: comboItems,
      };

      const url = `${BASE_URL}/producto`;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID,
        },
        body: JSON.stringify(body),
      };

      try {
        const result = await makeRequest(url, options);
        if (result.status === 201) {
          console.log(`✅ Combo creado: ${combo.nombre.substring(0, 50).padEnd(50)} - ${comboItems.length} items`);
          combosCreados++;
        } else {
          console.error(`❌ Error creando combo: ${combo.nombre} - ${JSON.stringify(result.data).substring(0, 80)}`);
          combosFallidos++;
        }
      } catch (error) {
        console.error(`❌ Error creando combo: ${combo.nombre} - ${error.message}`);
        combosFallidos++;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      console.log(`⚠️  Combo omitido: ${combo.nombre} - No se encontraron suficientes productos base (encontrados: ${comboItems.length})`);
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(80));
  console.log(`✅ Productos creados: ${resultados.exitosos}`);
  console.log(`✅ Combos creados: ${combosCreados}`);
  console.log(`❌ Productos fallidos: ${resultados.fallidos}`);
  console.log(`❌ Combos fallidos: ${combosFallidos}`);
  
  console.log('='.repeat(80));
  console.log('\n💡 Para verificar los productos creados:');
  console.log(`   curl -X GET '${BASE_URL}/producto/obtener?tenant_id=${TENANT_ID}' -H 'x-tenant-id: ${TENANT_ID}'`);
  console.log(`\n💡 Para filtrar por categoría (tipo_producto):`);
  console.log(`   curl -X GET '${BASE_URL}/producto/obtener?tenant_id=${TENANT_ID}&tipo_producto=promociones' -H 'x-tenant-id: ${TENANT_ID}'`);
  console.log(`\n💡 Para ver solo combos:`);
  console.log(`   curl -X GET '${BASE_URL}/producto/obtener?tenant_id=${TENANT_ID}&tipo_producto=combo' -H 'x-tenant-id: ${TENANT_ID}'`);
}

// Ejecutar
main().catch(console.error);
