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
    
    // Retry logic para entornos donde MQTT puede tardar en estar listo
    const maxRetries = 5;
    const retryDelay = 3000; // 3 segundos
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await initMqttService();
        console.log('[INSTRUMENTATION] ✓ Servicio MQTT inicializado exitosamente');
        return;
      } catch (error) {
        console.error(`[INSTRUMENTATION] Intento ${i + 1}/${maxRetries} falló:`, error);
        
        if (i < maxRetries - 1) {
          console.log(`[INSTRUMENTATION] Reintentando en ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.error('[INSTRUMENTATION] ❌ No se pudo inicializar MQTT después de varios intentos');
          // No lanzar error para que el servidor siga funcionando
          // MQTT se reconectará automáticamente cuando esté disponible
        }
      }
    }
  }
}
