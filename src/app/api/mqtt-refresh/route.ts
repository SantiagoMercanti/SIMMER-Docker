import { NextResponse } from 'next/server';
import { refreshMqttSubscriptions } from '@/lib/mqtt-service';
import { requireCanMutate } from '@/lib/auth';

// POST /api/mqtt-refresh
// Refresca las suscripciones MQTT (solo para usuarios con permisos de edición)
export async function POST() {
  try {
    await requireCanMutate();
    
    await refreshMqttSubscriptions();
    
    return NextResponse.json({ 
      status: 'Suscripciones MQTT actualizadas' 
    });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status ?? 500;
    if (status === 401) {
      return NextResponse.json({ error: 'No autenticado' }, { status });
    }
    if (status === 403) {
      return NextResponse.json({ error: 'No autorizado' }, { status });
    }
    
    console.error('Error refrescando suscripciones MQTT:', error);
    return NextResponse.json(
      { error: 'Error al refrescar suscripciones' },
      { status: 500 }
    );
  }
}
