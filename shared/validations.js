const VALID_PRODUCT_TYPES = ['combo', 'single', 'promotion'];
const VALID_STATES = [
  'pendiente',
  'preparando',
  'despachando',
  'despachado',
  'recogiendo',
  'en_camino',
  'entregado',
  'cancelado',
  'rechazado'
];

function isUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateCrearPedido(payload = {}) {
  const errors = [];

  if (!payload.usuario_id || !isUUID(payload.usuario_id)) {
    errors.push('usuario_id es requerido y debe ser UUID');
  }

  if (!Array.isArray(payload.productos) || payload.productos.length === 0) {
    errors.push('productos es requerido y debe tener al menos un item');
  } else {
    payload.productos.forEach((item, index) => {
      if (!item.producto_id || !isUUID(item.producto_id)) {
        errors.push(`productos[${index}].producto_id es requerido y debe ser UUID`);
      }
      if (typeof item.cantidad !== 'number' || item.cantidad <= 0) {
        errors.push(`productos[${index}].cantidad debe ser un número mayor a cero`);
      }
    });
  }

  if (!payload.direccion_entrega || typeof payload.direccion_entrega !== 'string') {
    errors.push('direccion_entrega es requerida');
  }

  if (!payload.telefono || typeof payload.telefono !== 'string') {
    errors.push('telefono es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateActualizarPedido(payload = {}) {
  const errors = [];

  if (payload.estado && !VALID_STATES.includes(payload.estado)) {
    errors.push(`estado debe ser uno de: ${VALID_STATES.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateProducto(data = {}, isUpdate = false) {
  const errors = [];

  if (!data.tenant_id) {
    errors.push('tenant_id es requerido');
  }
  if (isUpdate && !data.producto_id) {
    errors.push('producto_id es requerido para actualizar');
  }
  if (!data.nombre_producto) {
    errors.push('nombre_producto es requerido');
  }
  if (!data.tipo_producto) {
    errors.push('tipo_producto es requerido');
  }
  if (data.precio_producto === undefined || data.precio_producto === null || data.precio_producto === '') {
    errors.push('precio_producto es requerido');
  } else if (typeof data.precio_producto !== 'number' || data.precio_producto <= 0) {
    errors.push('precio_producto debe ser un número mayor a cero');
  }
  if (data.tipo_producto === 'combo') {
    if (!Array.isArray(data.combo_items) || data.combo_items.length === 0) {
      errors.push('combo_items debe contener al menos un producto cuando tipo_producto es combo');
    } else {
      data.combo_items.forEach((comboItem, index) => {
        if (!comboItem.product_id) {
          errors.push(`combo_items[${index}].product_id es requerido`);
        }
        if (!comboItem.sku) {
          errors.push(`combo_items[${index}].sku es requerido`);
        }
        if (typeof comboItem.quantity !== 'number' || comboItem.quantity <= 0) {
          errors.push(`combo_items[${index}].quantity debe ser un número mayor a cero`);
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  isUUID,
  validateCrearPedido,
  validateActualizarPedido,
  validateProducto,
  VALID_PRODUCT_TYPES,
  VALID_STATES,
};

