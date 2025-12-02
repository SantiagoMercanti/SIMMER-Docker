/**
 * Next.js Instrumentation
 * Se ejecuta una vez cuando el servidor de Node.js arranca
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Solo en servidor (no en edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initMqttService } = await import('./lib/mqtt-service');
    
    console.log('[INSTRUMENTATION] Inicializando servicio MQTT...');
    await initMqttService();
  }
}
