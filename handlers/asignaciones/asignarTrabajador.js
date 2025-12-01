const { getItem, updateItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireStaff } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const TABLA_STAFF = process.env.TABLA_STAFF;

exports.handler = async (event) => {
  try {
    // Verificar autenticación y permisos de staff
    const auth = requireStaff(event, 'manage_orders');
    if (auth.error) {
      return auth.error;
    }

    const { payload } = auth;
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    // Verificar permisos: admin general puede asignar trabajadores en cualquier sede
    // Admin por sede y trabajadores solo pueden asignar en su propia sede
    const isAdminGeneral = payload.staff_tier === 'admin' && (!payload.tenant_id_sede || payload.tenant_id_sede === 'GENERAL');
    const userTenantId = payload.tenant_id_sede;
    
    if (!isAdminGeneral && userTenantId !== tenantId) {
      return response(403, { message: 'No tienes permiso para asignar trabajadores en esta sede' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return response(400, { message: 'Body inválido' });
    }

    const { pedido_id, trabajador_email, tipo_asignacion } = body;

    // Validaciones
    if (!pedido_id) {
      return response(400, { message: 'pedido_id es requerido' });
    }

    if (!trabajador_email) {
      return response(400, { message: 'trabajador_email es requerido' });
    }

    if (!tipo_asignacion) {
      return response(400, { message: 'tipo_asignacion es requerido' });
    }

    if (!['chef', 'motorizado'].includes(tipo_asignacion)) {
      return response(400, { message: 'tipo_asignacion debe ser "chef" o "motorizado"' });
    }

    // Verificar que el pedido existe
    const pedido = await getItem(TABLA_PEDIDOS, {
      tenant_id: tenantId,
      pedido_id: pedido_id,
    });

    if (!pedido) {
      return response(404, { message: 'Pedido no encontrado' });
    }

    // Verificar que el trabajador existe y pertenece a la misma sede
    const trabajador = await getItem(TABLA_STAFF, {
      tenant_id_sede: tenantId,
      email: trabajador_email.toLowerCase(),
    });

    if (!trabajador) {
      return response(404, { message: 'Trabajador no encontrado en esta sede' });
    }

    if (!trabajador.is_active) {
      return response(400, { message: 'El trabajador no está activo' });
    }

    // Verificar que el trabajador sea del tipo correcto
    // Chef: puede ser admin o trabajador con permisos de cocina
    // Motorizado: puede ser admin o trabajador con permisos de delivery
    if (tipo_asignacion === 'chef') {
      const puedeSerChef = trabajador.staff_tier === 'admin' || 
                           trabajador.permissions?.includes('update_order_status');
      if (!puedeSerChef) {
        return response(403, { message: 'El trabajador no tiene permisos para ser asignado como chef' });
      }
    }

    if (tipo_asignacion === 'motorizado') {
      const puedeSerMotorizado = trabajador.staff_tier === 'admin' || 
                                 trabajador.permissions?.includes('update_order_status');
      if (!puedeSerMotorizado) {
        return response(403, { message: 'El trabajador no tiene permisos para ser asignado como motorizado' });
      }
    }

    // Actualizar el pedido con la asignación
    const fechaActualizacion = getTimestamp();
    const campoAsignacion = tipo_asignacion === 'chef' ? 'chef_id' : 'motorizado_id';
    const nombreTrabajador = trabajador.name || trabajador.email;

    const updateExpression = `SET ${campoAsignacion} = :trabajador_id, fecha_actualizacion = :fecha`;
    const expressionAttributeValues = {
      ':trabajador_id': trabajador.user_id,
      ':fecha': fechaActualizacion,
    };

    // Si se está asignando un chef y ya había uno, mantener el anterior o reemplazarlo según la lógica
    // Si se está asignando un motorizado y ya había uno, mantener el anterior o reemplazarlo según la lógica
    const updated = await updateItem({
      TableName: TABLA_PEDIDOS,
      Key: {
        tenant_id: tenantId,
        pedido_id: pedido_id,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    return response(200, {
      message: `Trabajador asignado exitosamente como ${tipo_asignacion}`,
      pedido: updated,
      asignacion: {
        tipo: tipo_asignacion,
        trabajador_id: trabajador.user_id,
        trabajador_email: trabajador.email,
        trabajador_nombre: nombreTrabajador,
      },
    });
  } catch (error) {
    console.error('Error asignando trabajador:', error);
    return response(500, {
      message: 'Error interno al asignar trabajador',
      error: error.message,
    });
  }
};

