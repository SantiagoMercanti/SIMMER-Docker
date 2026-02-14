// Ubicación: src/app/api/admin/mqtt/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMqttStatus, changeBrokerUrl } from '@/lib/mqtt-service';

const DEFAULT_URL = process.env.MQTT_BROKER_URL || 'mqtt://172.16.248.85:1883';
const MQTT_CONFIG_KEY = 'mqtt_broker_url';

// GET /api/admin/mqtt — devuelve la URL actual y el estado de conexión
export async function GET() {
  try {
    await requireAdmin();

    const config = await prisma.configSistema.findUnique({
      where: { clave: MQTT_CONFIG_KEY },
    });

    return NextResponse.json({
      brokerUrl: config?.valor ?? DEFAULT_URL,
      isFromDb: !!config?.valor,
      status: getMqttStatus(),
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (status === 403) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST /api/admin/mqtt — cambia la URL y reconecta
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const newUrl: string = typeof body?.brokerUrl === 'string' ? body.brokerUrl.trim() : '';

    if (!newUrl) {
      return NextResponse.json({ error: 'brokerUrl es requerido' }, { status: 400 });
    }

    // Validación básica de formato
    if (!newUrl.startsWith('mqtt://') && !newUrl.startsWith('mqtts://') && !newUrl.startsWith('ws://') && !newUrl.startsWith('wss://')) {
      return NextResponse.json(
        { error: 'URL inválida. Debe comenzar con mqtt://, mqtts://, ws:// o wss://' },
        { status: 400 }
      );
    }

    await changeBrokerUrl(newUrl);

    return NextResponse.json({
      ok: true,
      brokerUrl: newUrl,
      status: getMqttStatus(),
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (status === 403) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
    console.error('[API MQTT] Error al cambiar broker:', err);
    return NextResponse.json(
      { error: 'Conexión fallida, revise la URL del broker MQTT' },
      { status: 500 }
    );
  }
}
