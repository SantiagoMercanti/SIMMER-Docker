import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCanMutate, getCurrentUser, getOwnershipFilter } from '@/lib/auth';
import { refreshMqttSubscriptions } from '@/lib/mqtt-service';

// Función para normalizar el nombre (sin tildes, minúsculas, sin espacios)
function normalizeForTopic(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
    .replace(/\s+/g, '') // Eliminar espacios
    .replace(/[^a-z0-9]/g, ''); // Eliminar caracteres especiales
}

// GET /api/sensors → [{id, name, activo}]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  // Obtener usuario actual (obligatorio)
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Solo admin puede ver inactivos
  if (includeInactive && user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Aplicar filtro de ownership (admin ve todo, otros solo lo suyo)
  const ownershipFilter = getOwnershipFilter(user.id, user.role);

  const rows = await prisma.sensor.findMany({
    where: {
      ...ownershipFilter,
      ...(includeInactive ? {} : { activo: true }),
    },
    select: { sensor_id: true, nombre: true, activo: true },
    orderBy: [{ activo: 'desc' }, { sensor_id: 'asc' }],
  });

  const data = rows.map(r => ({
    id: String(r.sensor_id),
    name: r.nombre,
    activo: r.activo
  }));
  return NextResponse.json(data);
}

// POST /api/sensors
export async function POST(req: Request) {
  try {
    // Requiere permisos de mutación (no-operator)
    const acting = await requireCanMutate();

    const body = await req.json();

    const nombre: string = (body?.nombre ?? '').trim();
    const unidadMedidaId: number = body?.unidadMedidaId;
    const descripcion: string | undefined = body?.descripcion?.trim() || undefined;

    if (body?.valorMin === undefined || body?.valorMin === '') {
      return NextResponse.json({ error: 'Falta valorMin' }, { status: 400 });
    }
    if (body?.valorMax === undefined || body?.valorMax === '') {
      return NextResponse.json({ error: 'Falta valorMax' }, { status: 400 });
    }

    const valorMin = Number(body.valorMin);
    const valorMax = Number(body.valorMax);

    if (!nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });
    if (!unidadMedidaId) return NextResponse.json({ error: 'Falta unidad de medida' }, { status: 400 });
    if (Number.isNaN(valorMin)) return NextResponse.json({ error: 'valorMin debe ser numérico' }, { status: 400 });
    if (Number.isNaN(valorMax)) return NextResponse.json({ error: 'valorMax debe ser numérico' }, { status: 400 });
    if (valorMin > valorMax) return NextResponse.json({ error: 'valorMax debe ser ≥ valorMin' }, { status: 400 });

    // Crear con ownership (sin fuente_datos todavía)
    const created = await prisma.sensor.create({
      data: {
        nombre,
        descripcion,
        unidad_medida_id: unidadMedidaId,
        valor_min: valorMin,
        valor_max: valorMax,
        creadorId: acting.id,
      },
      select: { sensor_id: true, nombre: true },
    });

    // Generar el tópico: simmer/sensor/{nombre_normalizado}{id}
    const nombreNormalizado = normalizeForTopic(created.nombre);
    const topico = `simmer/sensor/${nombreNormalizado}${created.sensor_id}`;

    // Actualizar el sensor con el tópico generado
    await prisma.sensor.update({
      where: { sensor_id: created.sensor_id },
      data: { fuente_datos: topico },
    });

    // ✅ NUEVO: Refrescar suscripciones MQTT para incluir el nuevo sensor
    try {
      await refreshMqttSubscriptions();
      console.log(`[API] ✓ Suscripción MQTT actualizada para nuevo sensor: ${topico}`);
    } catch (mqttError) {
      // No fallar la creación del sensor si falla la suscripción MQTT
      // El sensor quedará registrado y se suscribirá en el próximo reinicio
      console.error('[API] ⚠️ Error al refrescar suscripciones MQTT:', mqttError);
    }

    return NextResponse.json({ 
      id: String(created.sensor_id), 
      name: created.nombre,
      topico: topico 
    }, { status: 201 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'No tienes permisos para crear sensores' }, { status });
    return NextResponse.json({ error: 'Error creando sensor' }, { status: 500 });
  }
}
