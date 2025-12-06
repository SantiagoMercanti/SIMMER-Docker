import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, getCurrentUser } from '@/lib/auth';
import { publishMqttMessage, isMqttConnected } from '@/lib/mqtt-service';

// POST /api/actuators/:id/send
// Body: { valor: number }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Autenticación: requiere labManager o admin
    await requireCanMutate();
    
    // Obtener el usuario actual para el registro
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const actuadorId = Number(id);

    if (!Number.isInteger(actuadorId) || actuadorId <= 0) {
      return NextResponse.json(
        { error: 'ID de actuador inválido' },
        { status: 400 }
      );
    }

    // 2. Parsear el valor del body
    const body = await req.json().catch(() => ({}));
    const valor = body?.valor;

    if (typeof valor !== 'number' || isNaN(valor)) {
      return NextResponse.json(
        { error: 'El campo "valor" debe ser un número válido' },
        { status: 400 }
      );
    }

    // 3. Verificar que el actuador existe y está activo
    const actuador = await prisma.actuador.findUnique({
      where: { actuator_id: actuadorId },
      select: {
        actuator_id: true,
        nombre: true,
        activo: true,
        valor_min: true,
        valor_max: true,
        fuente_datos: true,
      },
    });

    if (!actuador) {
      return NextResponse.json(
        { error: 'Actuador no encontrado' },
        { status: 404 }
      );
    }

    if (!actuador.activo) {
      return NextResponse.json(
        { error: 'Actuador inactivo' },
        { status: 404 }
      );
    }

    // 4. Validar que el actuador tenga un tópico MQTT configurado
    if (!actuador.fuente_datos || actuador.fuente_datos.trim() === '') {
      return NextResponse.json(
        { error: 'El actuador no tiene un tópico MQTT configurado' },
        { status: 400 }
      );
    }

    // 5. Validar que el valor esté dentro del rango permitido
    if (valor < actuador.valor_min || valor > actuador.valor_max) {
      return NextResponse.json(
        { 
          error: `El valor debe estar entre ${actuador.valor_min} y ${actuador.valor_max}` 
        },
        { status: 400 }
      );
    }

    // 6. Verificar conexión MQTT antes de intentar publicar
    const mqttConnected = isMqttConnected();
    console.log(`[Actuador Send] Estado MQTT: ${mqttConnected ? 'Conectado' : 'Desconectado'}`);

    if (!mqttConnected) {
      console.warn('[Actuador Send] MQTT no conectado, intentando enviar de todas formas...');
    }

    // 7. Preparar el mensaje MQTT
    const timestamp = new Date().toISOString();
    const mqttMessage = {
      valor,
      timestamp,
    };

    // 8. PRIMERO: Publicar a MQTT (si falla, no guardamos en BD)
    try {
      console.log(`[Actuador Send] Intentando publicar a "${actuador.fuente_datos}":`, mqttMessage);
      
      await publishMqttMessage(actuador.fuente_datos, mqttMessage, {
        retries: 3,
        retryDelay: 1000,
        shouldWaitForConnection: true
      });
      
      console.log(`[Actuador Send] ✓ Mensaje MQTT publicado exitosamente`);
    } catch (mqttError) {
      console.error('[Actuador Send] Error al publicar MQTT:', mqttError);
      
      const errorMessage = mqttError instanceof Error ? mqttError.message : String(mqttError);
      
      return NextResponse.json(
        { 
          error: 'No se pudo enviar el mensaje MQTT',
          details: errorMessage,
          mqttConnected,
          suggestion: mqttConnected 
            ? 'El broker rechazó el mensaje. Verifique los permisos del tópico.'
            : 'El broker MQTT no está conectado. Verifique que el servicio esté en ejecución.'
        },
        { status: 503 } // Service Unavailable
      );
    }

    // 9. SEGUNDO: Si MQTT OK, buscar todos los ProyectoActuador activos
    const proyectosActuador = await prisma.proyectoActuador.findMany({
      where: {
        actuadorId: actuador.actuator_id,
        proyecto: {
          activo: true,
        },
      },
      select: {
        id: true,
        proyecto: {
          select: {
            nombre: true,
          },
        },
      },
    });

    if (proyectosActuador.length === 0) {
      return NextResponse.json(
        { 
          message: 'Mensaje MQTT enviado correctamente',
          warning: 'El actuador no está asociado a ningún proyecto activo, no se guardaron registros en BD',
          mqttTopic: actuador.fuente_datos,
          valor,
          timestamp,
        },
        { status: 200 }
      );
    }

    // 10. Guardar un RegistroActuador por cada ProyectoActuador
    const registrosData = proyectosActuador.map((pa) => ({
      proyectoActuadorId: pa.id,
      valor,
      timestamp: new Date(timestamp),
      usuarioId: currentUser.id,
    }));

    const result = await prisma.registroActuador.createMany({
      data: registrosData,
    });

    console.log(
      `[Actuador Send] ✓ Guardados ${result.count} registro(s) para actuador "${actuador.nombre}"`
    );

    // 11. Retornar éxito
    return NextResponse.json(
      {
        message: 'Valor enviado correctamente',
        mqttTopic: actuador.fuente_datos,
        valor,
        timestamp,
        recordsCreated: result.count,
        projects: proyectosActuador.map(pa => pa.proyecto.nombre),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[Actuador Send] Error general:', error);

    // Manejar errores de autenticación
    const status = (error as { status?: number })?.status ?? 0;
    if (status === 401) {
      return NextResponse.json({ error: 'No autenticado' }, { status });
    }
    if (status === 403) {
      return NextResponse.json(
        { error: 'No tienes permisos para enviar valores a actuadores' },
        { status }
      );
    }

    // Error genérico
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        {
          error: 'Error al procesar el envío',
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error al procesar el envío' },
      { status: 500 }
    );
  }
}
