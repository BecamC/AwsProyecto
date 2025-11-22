#!/usr/bin/env node

/**
 * Script para insertar todos los productos de Pardo desde productos.js
 * 
 * Uso: node insertar-productos-pardo.js
 * 
 * Requiere:
 * - BASE_URL: URL del API Gateway (default: https://9uoan5h0h1.execute-api.us-east-1.amazonaws.com/dev)
 * - TENANT_ID: ID del tenant (default: "pardo")
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuración
const BASE_URL = process.env.BASE_URL || 'https://9uoan5h0h1.execute-api.us-east-1.amazonaws.com/dev';
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

// Función para determinar si un producto es combo basado en su descripción
function esCombo(nombre, descripcion) {
  const texto = `${nombre} ${descripcion || ''}`.toLowerCase();
  
  // Patrones que indican que es un combo
  const patronesCombo = [
    /\+\s*(papas|bebida|gaseosa|chicha|ensalada|guarnición)/,
    /con\s+(papas|bebida|gaseosa|chicha|ensalada|guarnición)\s+y\s+/,
    /\d+\s+(papas|bebidas|gaseosas|chichas|ensaladas)/,
    /(incluye|incluye|con)\s+(.*?)\s+(y|más|+)/,
  ];
  
  return patronesCombo.some(patron => patron.test(texto));
}

// Función para extraer productos base de una descripción de combo
function extraerProductosBase(descripcion, productosBase) {
  const items = [];
  const texto = descripcion.toLowerCase();
  
  // Palabras clave comunes que indican productos base
  const palabrasClave = {
    'papas fritas': ['papas fritas', 'papas', 'fritas'],
    'gaseosa': ['gaseosa', 'gaseosa personal', 'bebida personal'],
    'chicha': ['chicha', 'chicha personal', 'botella de chicha'],
    'ensalada': ['ensalada', 'ensalada regular', 'ensalada grande', 'guarnición de ensalada'],
    'arroz': ['arroz', 'arroz blanco'],
    'camotes': ['camotes', 'camotes fritos'],
    'brasa': ['1/4 brasa', '1/2 brasa', '1 brasa', 'pardos brasa'],
    'parrillero': ['1/4 parrillero', '1/2 parrillero', 'parrillero'],
  };
  
  // Buscar productos base por palabras clave
  Object.keys(palabrasClave).forEach(clave => {
    const variantes = palabrasClave[clave];
    const encontrado = variantes.some(variante => texto.includes(variante));
    
    if (encontrado) {
      // Buscar producto base que coincida
      const productoEncontrado = productosBase.find(p => {
        const nombreProd = p.nombre_producto.toLowerCase();
        return variantes.some(v => nombreProd.includes(v)) || 
               nombreProd.includes(clave);
      });
      
      if (productoEncontrado && !items.find(item => item.product_id === productoEncontrado.producto_id)) {
        // Determinar cantidad
        let cantidad = 1;
        const matchCantidad = texto.match(new RegExp(`(\\d+)\\s*(${variantes.join('|')})`, 'i'));
        if (matchCantidad) {
          cantidad = parseInt(matchCantidad[1]);
        }
        
        items.push({
          product_id: productoEncontrado.producto_id,
          sku: productoEncontrado.sku || `SKU-${productoEncontrado.producto_id.substring(0, 8)}`,
          quantity: cantidad
        });
      }
    }
  });
  
  // Si no encontramos items, buscar por similitud de nombre
  if (items.length === 0) {
    // Buscar productos de categorías relacionadas
    const categoriasRelacionadas = ['Guarniciones', 'Bebidas', 'Pardos Brasa', 'Pardos Parrilleros'];
    categoriasRelacionadas.forEach(cat => {
      const productosCategoria = productosBase.filter(p => 
        p.categoria && p.categoria.toLowerCase().includes(cat.toLowerCase())
      );
      
      if (productosCategoria.length > 0 && !items.find(item => 
        productosCategoria.some(p => p.producto_id === item.product_id)
      )) {
        // Agregar el primer producto de la categoría como ejemplo
        items.push({
          product_id: productosCategoria[0].producto_id,
          sku: productosCategoria[0].sku || `SKU-${productosCategoria[0].producto_id.substring(0, 8)}`,
          quantity: 1
        });
      }
    });
  }
  
  return items;
}

// Función para crear producto
async function crearProducto(producto, index, productosBase = []) {
  const categoriaNormalizada = normalizarCategoria(producto.categoria);
  const esUnCombo = esCombo(producto.nombre, producto.descripcion);
  
  const body = {
    nombre_producto: producto.nombre,
    descripcion_producto: producto.descripcion || '',
    precio_producto: producto.precio,
    tipo_producto: esUnCombo ? 'combo' : categoriaNormalizada,
    categoria: producto.categoria,
    image_url: producto.imagen,
    currency: 'PEN',
    is_active: true,
    stock: 100, // Stock inicial por defecto
    stock_minimo: 10,
    stock_maximo: 9999,
  };

  // Si es combo y tenemos productos base, agregar combo_items
  if (esUnCombo && productosBase.length > 0) {
    const comboItems = extraerProductosBase(producto.descripcion || '', productosBase);
    if (comboItems.length > 0) {
      body.combo_items = comboItems;
    }
  }

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
      const tipoMostrar = esUnCombo ? 'combo' : categoriaNormalizada;
      console.log(`✅ [${String(index + 1).padStart(3, '0')}/${productos.length}] ${producto.nombre.substring(0, 50).padEnd(50)} - ${tipoMostrar.padEnd(15)} ${esUnCombo && body.combo_items ? `(${body.combo_items.length} items)` : ''}`);
      return { 
        success: true, 
        producto_id: result.data.producto?.producto_id, 
        tipo: esUnCombo ? 'combo' : categoriaNormalizada,
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

// Función para obtener todos los productos creados
async function obtenerProductosCreados() {
  const url = `${BASE_URL}/producto/obtener?tenant_id=${TENANT_ID}&limit=1000`;
  const options = {
    method: 'GET',
    headers: {
      'x-tenant-id': TENANT_ID,
    },
  };

  try {
    const result = await makeRequest(url, options);
    if (result.status === 200 && result.data.productos) {
      return result.data.productos;
    }
    return [];
  } catch (error) {
    console.error('Error obteniendo productos:', error.message);
    return [];
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
    productosCreados: [],
  };

  // PASO 1: Crear todos los productos individuales primero
  console.log('\n📦 PASO 1: Creando productos individuales...\n');
  
  for (let i = 0; i < productos.length; i++) {
    const resultado = await crearProducto(productos[i], i, []);
    
    if (resultado.success) {
      resultados.exitosos++;
      resultados.productosCreados.push(resultado);
      
      // Contar por tipo
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

  // PASO 2: Identificar productos que deberían ser combos y actualizarlos
  console.log('\n\n🔄 PASO 2: Identificando y creando combos...\n');
  
  // Obtener todos los productos creados para usarlos como base
  const productosCreados = await obtenerProductosCreados();
  console.log(`📋 Productos base disponibles: ${productosCreados.length}\n`);

  let combosCreados = 0;
  for (let i = 0; i < productos.length; i++) {
    const producto = productos[i];
    if (esCombo(producto.nombre, producto.descripcion)) {
      // Buscar el producto creado
      const productoCreado = resultados.productosCreados.find(p => p.nombre === producto.nombre);
      
      if (productoCreado && productoCreado.tipo !== 'combo') {
        // Extraer productos base
        const comboItems = extraerProductosBase(producto.descripcion || '', productosCreados);
        
        if (comboItems.length > 0) {
          // Actualizar el producto para convertirlo en combo
          const url = `${BASE_URL}/producto/${productoCreado.producto_id}`;
          const body = {
            tipo_producto: 'combo',
            combo_items: comboItems
          };
          
          const options = {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': TENANT_ID,
            },
            body: JSON.stringify(body),
          };
          
          try {
            const result = await makeRequest(url, options);
            if (result.status === 200) {
              console.log(`✅ Combo creado: ${producto.nombre.substring(0, 50).padEnd(50)} - ${comboItems.length} items`);
              combosCreados++;
              // Actualizar el tipo en resultados
              const tipoAnterior = productoCreado.tipo;
              productoCreado.tipo = 'combo';
              resultados.porTipo['combo'] = (resultados.porTipo['combo'] || 0) + 1;
              if (resultados.porTipo[tipoAnterior] && resultados.porTipo[tipoAnterior] > 0) {
                resultados.porTipo[tipoAnterior]--;
              }
            }
          } catch (error) {
            console.error(`❌ Error creando combo: ${producto.nombre} - ${error.message}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMEN DE INSERCIÓN');
  console.log('='.repeat(80));
  console.log(`✅ Exitosos: ${resultados.exitosos}`);
  console.log(`❌ Fallidos: ${resultados.fallidos}`);
  console.log(`🔄 Combos creados: ${combosCreados}`);
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
  
  console.log('='.repeat(80));
  console.log('\n💡 Para verificar los productos creados:');
  console.log(`   curl -X GET '${BASE_URL}/producto/obtener?tenant_id=${TENANT_ID}' -H 'x-tenant-id: ${TENANT_ID}'`);
  console.log(`\n💡 Para filtrar por categoría (tipo_producto):`);
  console.log(`   curl -X GET '${BASE_URL}/producto/obtener?tenant_id=${TENANT_ID}&tipo_producto=promociones' -H 'x-tenant-id: ${TENANT_ID}'`);
}

// Ejecutar
main().catch(console.error);
