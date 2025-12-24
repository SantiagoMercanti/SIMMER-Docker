import mqtt from 'mqtt';
import { prisma } from './prisma';
import { checkAndSendAlert } from './sensor-alert-service';

let mqttClient: mqtt.MqttClient | null = null;
let isInitialized = false;
let isConnecting = false;
let connectionPromise: Promise<void> | null = null;

interface SensorMessage {
  valor: number;
  timestamp?: string;
  unidad?: string;
}

/**
 * ✅ HANDLER único para mensajes MQTT
 * Se define fuera para evitar recrearlo múltiples veces
 */
const messageHandler = async (topic: string, payload: Buffer) => {
  try {
    const message: SensorMessage = JSON.parse(payload.toString());
    console.log(`[MQTT] Mensaje recibido en "${topic}":`, message);
    
    await handleSensorMessage(topic, message);
  } catch (error) {
    console.error(`[MQTT] Error procesando mensaje de "${topic}":`, error);
  }
};

/**
 * Inicializa el cliente MQTT y se suscribe a los tópicos de sensores activos.
 * Solo se ejecuta una vez en el ciclo de vida del servidor.
 */
export async function initMqttService(): Promise<void> {
  // ✅ Si ya está inicializado y conectado, no hacer nada
  if (isInitialized && mqttClient?.connected) {
    console.log('[MQTT] Servicio ya inicializado y conectado');
    return;
  }

  // ✅ Si hay una conexión en proceso, esperar a que termine
  if (isConnecting && connectionPromise) {
    console.log('[MQTT] Esperando conexión en proceso...');
    return connectionPromise;
  }

  // ✅ Si hay un cliente existente pero no conectado, limpiarlo primero
  if (mqttClient && !mqttClient.connected) {
    console.log('[MQTT] Cliente existente pero desconectado, limpiando...');
    mqttClient.removeAllListeners(); // ✅ CRÍTICO: Remover listeners viejos
    mqttClient.end(true); // Forzar cierre
    mqttClient = null;
    isInitialized = false;
  }

  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  
  console.log(`[MQTT] Conectando al broker: ${brokerUrl}`);
  isConnecting = true;

  // Crear promesa de conexión para que otros puedan esperarla
  connectionPromise = new Promise<void>((resolve, reject) => {
    const connectionTimeout = setTimeout(() => {
      isConnecting = false;
      reject(new Error('Timeout conectando al broker MQTT'));
    }, 30000);

    try {
      mqttClient = mqtt.connect(brokerUrl, {
        clientId: `simmer_server_${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      // ✅ CRÍTICO: Registrar el handler UNA SOLA VEZ
      mqttClient.on('message', messageHandler);

      mqttClient.on('connect', async () => {
        clearTimeout(connectionTimeout);
        console.log('[MQTT] ✓ Conectado al broker');
        isInitialized = true;
        isConnecting = false;
        
        // Suscribirse a todos los tópicos de sensores activos
        await subscribeToActiveSensors();
        resolve();
      });

      mqttClient.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('[MQTT] Error de conexión:', error);
        isConnecting = false;
        isInitialized = false;
        reject(error);
      });

      mqttClient.on('offline', () => {
        console.log('[MQTT] Cliente desconectado');
        isInitialized = false;
      });

      mqttClient.on('reconnect', () => {
        console.log('[MQTT] Reconectando...');
      });

      // ✅ NUEVO: Handler para cuando se cierra la conexión
      mqttClient.on('close', () => {
        console.log('[MQTT] Conexión cerrada');
        isInitialized = false;
        isConnecting = false;
      });

    } catch (error) {
      clearTimeout(connectionTimeout);
      console.error('[MQTT] Error al inicializar servicio:', error);
      isInitialized = false;
      isConnecting = false;
      reject(error);
    }
  });

  return connectionPromise;
}

/**
 * Se suscribe a todos los tópicos únicos de sensores activos.
 */
async function subscribeToActiveSensors() {
  if (!mqttClient) {
    console.error('[MQTT] Cliente no inicializado');
    return;
  }

  try {
    // Obtener todos los tópicos únicos de sensores activos
    const sensores = await prisma.sensor.findMany({
      where: {
        activo: true,
        fuente_datos: { not: null },
      },
      select: {
        fuente_datos: true,
      },
      distinct: ['fuente_datos'],
    });

    const topicos = sensores
      .map(s => s.fuente_datos)
      .filter((t): t is string => t !== null && t.trim() !== '');

    if (topicos.length === 0) {
      console.log('[MQTT] No hay sensores activos con tópicos definidos');
      return;
    }

    // Suscribirse a cada tópico
    topicos.forEach(topic => {
      mqttClient!.subscribe(topic, (err) => {
        if (err) {
          console.error(`[MQTT] Error suscribiéndose a "${topic}":`, err);
        } else {
          console.log(`[MQTT] ✓ Suscrito a: ${topic}`);
        }
      });
    });

  } catch (error) {
    console.error('[MQTT] Error al obtener tópicos de sensores:', error);
  }
}

/**
 * Maneja un mensaje MQTT recibido.
 */
async function handleSensorMessage(topic: string, message: SensorMessage) {
  const { valor, timestamp, unidad } = message;

  if (typeof valor !== 'number' || isNaN(valor)) {
    console.error(`[MQTT] Valor inválido en mensaje: ${valor}`);
    return;
  }

  try {
    const sensores = await prisma.sensor.findMany({
      where: {
        fuente_datos: topic,
        activo: true,
      },
      select: {
        sensor_id: true,
        nombre: true,
        valor_min: true,
        valor_max: true,
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
    });

    if (sensores.length === 0) {
      console.log(`[MQTT] No hay sensores activos para el tópico "${topic}"`);
      return;
    }

    console.log(`[MQTT] Encontrados ${sensores.length} sensor(es) para "${topic}"`);

    const medicionTimestamp = timestamp ? new Date(timestamp) : new Date();

    for (const sensor of sensores) {
      if (valor < sensor.valor_min || valor > sensor.valor_max) {
        console.warn(
          `[MQTT] ⚠️  Valor ${valor} fuera de rango [${sensor.valor_min}, ${sensor.valor_max}] para sensor "${sensor.nombre}"`
        );
      }

      const proyectosSensor = await prisma.proyectoSensor.findMany({
        where: {
          sensorId: sensor.sensor_id,
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

      if (proyectosSensor.length === 0) {
        console.log(`[MQTT] Sensor "${sensor.nombre}" no está asociado a proyectos activos`);
        continue;
      }

      // ✅ NUEVO: Determinar qué unidad usar
      // 1. Si viene en el mensaje, usar esa
      // 2. Si no, usar la del sensor (como fallback)
      // 3. Si tampoco tiene, null
      const unidadAGuardar = unidad || sensor.unidadMedida?.simbolo || null;

      // Log para debugging
      if (unidad) {
        console.log(`[MQTT] Medición con unidad específica: "${unidad}"`);
      } else if (sensor.unidadMedida?.simbolo) {
        console.log(`[MQTT] Usando unidad por defecto del sensor: "${sensor.unidadMedida.simbolo}"`);
      } else {
        console.log(`[MQTT] Medición sin unidad de medida`);
      }

      const mediciones = proyectosSensor.map(ps => ({
        proyectoSensorId: ps.id,
        valor,
        timestamp: medicionTimestamp,
        unidadSimbolo: unidadAGuardar,  // ✅ NUEVO: Guardar la unidad
      }));

      await prisma.medicionSensor.createMany({
        data: mediciones,
      });

      console.log(
        `[MQTT] ✓ Guardadas ${mediciones.length} medición(es) para sensor "${sensor.nombre}" (valor: ${valor}${unidadAGuardar ? ` ${unidadAGuardar}` : ''})`
      );

      await checkAndSendAlert(sensor.sensor_id, valor, medicionTimestamp);
    }

  } catch (error) {
    console.error(`[MQTT] Error guardando mediciones para tópico "${topic}":`, error);
  }
}

/**
 * Re-suscribe a los tópicos de sensores activos.
 * Útil cuando se crean, activan o desactivan sensores.
 */
export async function refreshMqttSubscriptions() {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('[MQTT] Cliente no conectado, no se pueden refrescar suscripciones');
    return;
  }

  console.log('[MQTT] Refrescando suscripciones...');

  // Desuscribirse de todos los tópicos actuales
  const currentTopics = Object.keys(mqttClient['_resubscribeTopics'] || {});
  
  if (currentTopics.length > 0) {
    console.log(`[MQTT] Desuscribiendo de ${currentTopics.length} tópico(s) actual(es)...`);
    currentTopics.forEach(topic => {
      mqttClient!.unsubscribe(topic, (err) => {
        if (err) {
          console.error(`[MQTT] Error desuscribiendo de "${topic}":`, err);
        }
      });
    });
  }

  // Re-suscribirse a los sensores activos actuales
  await subscribeToActiveSensors();
  
  console.log('[MQTT] ✓ Suscripciones refrescadas exitosamente');
}

/**
 * Cierra la conexión MQTT.
 */
export function closeMqttConnection() {
  if (mqttClient) {
    console.log('[MQTT] Cerrando conexión...');
    mqttClient.removeAllListeners(); // ✅ CRÍTICO: Limpiar listeners
    mqttClient.end(true);
    mqttClient = null;
    isInitialized = false;
    isConnecting = false;
    connectionPromise = null;
  }
}

/**
 * Verifica si el cliente MQTT está conectado.
 */
export function isMqttConnected(): boolean {
  return mqttClient !== null && mqttClient.connected;
}

/**
 * ✅ Obtiene información de estado del cliente MQTT (para debugging)
 */
export function getMqttStatus() {
  return {
    isConnected: isMqttConnected(),
    isInitialized,
    isConnecting,
    hasClient: mqttClient !== null,
    // ✅ Contar listeners del evento 'message'
    messageListeners: mqttClient ? mqttClient.listenerCount('message') : 0,
  };
}

/**
 * Asegura que el cliente MQTT esté inicializado y conectado.
 */
export async function ensureMqttConnection(timeoutMs: number = 15000): Promise<void> {
  // Si ya está conectado, retornar inmediatamente
  if (mqttClient && mqttClient.connected) {
    return;
  }

  // Si hay una inicialización en proceso, esperarla
  if (isConnecting && connectionPromise) {
    try {
      await Promise.race([
        connectionPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout esperando inicialización MQTT')), timeoutMs)
        )
      ]);
      return;
    } catch (error) {
      throw new Error(`No se pudo conectar a MQTT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Si no está inicializado, inicializarlo ahora
  try {
    await Promise.race([
      initMqttService(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout inicializando MQTT')), timeoutMs)
      )
    ]);
  } catch (error) {
    throw new Error(`No se pudo conectar a MQTT: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Verificar que realmente esté conectado
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('Cliente MQTT no disponible después de inicialización');
  }
}

/**
 * Publica un mensaje a un tópico MQTT con manejo robusto de errores.
 */
export async function publishMqttMessage(
  topic: string, 
  message: object,
  options: { 
    retries?: number;
    retryDelay?: number;
  } = {}
): Promise<void> {
  const { retries = 3, retryDelay = 1000 } = options;

  // Asegurar que hay conexión ANTES de intentar publicar
  try {
    await ensureMqttConnection(15000);
  } catch (error) {
    console.error('[MQTT] Error asegurando conexión:', error);
    throw new Error(
      'Cliente MQTT no disponible. Verifique que el broker esté en ejecución y accesible.'
    );
  }

  // Intentar publicar con reintentos
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Verificar que sigue conectado
      if (!mqttClient || !mqttClient.connected) {
        throw new Error('Cliente MQTT perdió la conexión');
      }

      // Publicar mensaje
      const payload = JSON.stringify(message);
      
      await new Promise<void>((resolve, reject) => {
        mqttClient!.publish(topic, payload, { qos: 1 }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      console.log(`[MQTT] ✓ Mensaje publicado a "${topic}":`, message);
      return; // Éxito

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[MQTT] Intento ${attempt}/${retries} falló para "${topic}":`, lastError.message);
      
      // Si no es el último intento, esperar antes de reintentar
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Intentar reconectar si se perdió la conexión
        if (!mqttClient?.connected) {
          try {
            await ensureMqttConnection(5000);
          } catch {
            // Continuar al siguiente intento incluso si falla la reconexión
          }
        }
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  throw lastError || new Error('Error desconocido al publicar mensaje MQTT');
}
