import { NextResponse } from 'next/server';
import { initMqttService } from '@/lib/mqtt-service';

// Este endpoint se llama automáticamente al iniciar la app
export async function GET() {
  try {
    await initMqttService();
    return NextResponse.json({ status: 'MQTT service initialized' });
  } catch (error) {
    console.error('Error initializing MQTT:', error);
    return NextResponse.json(
      { error: 'Failed to initialize MQTT service' },
      { status: 500 }
    );
  }
}
