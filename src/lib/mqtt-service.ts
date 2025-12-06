import mqtt from 'mqtt';
import { prisma } from './prisma';

let mqttClient: mqtt.MqttClient | null = null;
let isInitialized = false;
let isConnecting = false;

interface SensorMessage {
  valor: number;
  timestamp?: string;
}

/**
 * Inicializa el cliente MQTT y se suscribe a los tópicos de sensores activos.
 * Solo se ejecuta una vez en el ciclo de vida del servidor.
 */
export async function initMqttService() {
  // Evitar múltiples inicializaciones
  if (isInitialized) {
    console.log('[MQTT] Servicio ya inicializado');
    return;
  }

  if (isConnecting) {
    console.log('[MQTT] Ya hay una conexión en proceso');
    return;
  }

  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  
  console.log(`[MQTT] Conectando al broker: ${brokerUrl}`);
  isConnecting = true;

  try {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: `simmer_server_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000, // 30 segundos de timeout
    });

    mqttClient.on('connect', async () => {
      console.log('[MQTT] ✓ Conectado al broker');
      isInitialized = true;
      isConnecting = false;
      
      // Suscribirse a todos los tópicos de sensores activos
      await subscribeToActiveSensors();
    });

    mqttClient.on('message', async (topic, payload) => {
      try {
        const message: SensorMessage = JSON.parse(payload.toString());
        console.log(`[MQTT] Mensaje recibido en "${topic}":`, message);
        
        await handleSensorMessage(topic, message);
      } catch (error) {
        console.error(`[MQTT] Error procesando mensaje de "${topic}":`, error);
      }
    });

    mqttClient.on('error', (error) => {
      console.error('[MQTT] Error de conexión:', error);
      isConnecting = false;
    });

    mqttClient.on('offline', () => {
      console.log('[MQTT] Cliente desconectado');
      isInitialized = false;
    });

    mqttClient.on('reconnect', () => {
      console.log('[MQTT] Reconectando...');
      isConnecting = true;
    });

  } catch (error) {
    console.error('[MQTT] Error al inicializar servicio:', error);
    isInitialized = false;
    isConnecting = false;
  }
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
 * Maneja un mensaje MQTT recibido:
 * 1. Busca todos los sensores activos con ese tópico
 * 2. Por cada sensor, busca sus ProyectoSensor activos
 * 3. Guarda una MedicionSensor por cada ProyectoSensor
 */
async function handleSensorMessage(topic: string, message: SensorMessage) {
  const { valor, timestamp } = message;

  // Validar que el valor sea numérico
  if (typeof valor !== 'number' || isNaN(valor)) {
    console.error(`[MQTT] Valor inválido en mensaje: ${valor}`);
    return;
  }

  try {
    // 1. Buscar todos los sensores activos con este tópico
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
      },
    });

    if (sensores.length === 0) {
      console.log(`[MQTT] No hay sensores activos para el tópico "${topic}"`);
      return;
    }

    console.log(`[MQTT] Encontrados ${sensores.length} sensor(es) para "${topic}"`);

    // 2. Por cada sensor, buscar sus ProyectoSensor activos y guardar mediciones
    for (const sensor of sensores) {
      // Validar rango (opcional, puedes comentar si no quieres esta validación)
      if (valor < sensor.valor_min || valor > sensor.valor_max) {
        console.warn(
          `[MQTT] Valor ${valor} fuera de rango [${sensor.valor_min}, ${sensor.valor_max}] para sensor "${sensor.nombre}"`
        );
        // Puedes decidir si continuar o saltar esta medición
        // Por ahora continuamos y guardamos igual
      }

      // Buscar ProyectoSensor activos
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

      // 3. Guardar una medición por cada ProyectoSensor
      const mediciones = proyectosSensor.map(ps => ({
        proyectoSensorId: ps.id,
        valor,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      }));

      await prisma.medicionSensor.createMany({
        data: mediciones,
      });

      console.log(
        `[MQTT] ✓ Guardadas ${mediciones.length} medición(es) para sensor "${sensor.nombre}" (valor: ${valor})`
      );
    }

  } catch (error) {
    console.error(`[MQTT] Error guardando mediciones para tópico "${topic}":`, error);
  }
}

/**
 * Re-suscribe a los tópicos de sensores activos.
 * Útil cuando se crean/editan sensores y queremos actualizar suscripciones.
 */
export async function refreshMqttSubscriptions() {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('[MQTT] Cliente no conectado, no se pueden refrescar suscripciones');
    return;
  }

  console.log('[MQTT] Refrescando suscripciones...');

  // Desuscribirse de todos los tópicos actuales
  const currentTopics = Object.keys(mqttClient['_resubscribeTopics'] || {});
  currentTopics.forEach(topic => {
    mqttClient!.unsubscribe(topic);
  });

  // Volver a suscribirse a los tópicos actuales
  await subscribeToActiveSensors();
}

/**
 * Cierra la conexión MQTT (útil para cleanup en shutdown)
 */
export function closeMqttConnection() {
  if (mqttClient) {
    console.log('[MQTT] Cerrando conexión...');
    mqttClient.end();
    mqttClient = null;
    isInitialized = false;
    isConnecting = false;
  }
}

/**
 * Verifica si el cliente MQTT está conectado
 */
export function isMqttConnected(): boolean {
  return mqttClient !== null && mqttClient.connected;
}

/**
 * Espera a que el cliente MQTT esté conectado (con timeout)
 * RENOMBRADO para evitar conflicto con el parámetro
 */
function waitForMqttConnection(timeoutMs: number = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Si ya está conectado, resolver inmediatamente
    if (mqttClient && mqttClient.connected) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Timeout esperando conexión MQTT'));
    }, timeoutMs);

    // Esperar el evento 'connect'
    const onConnect = () => {
      clearTimeout(timeout);
      mqttClient?.off('connect', onConnect);
      mqttClient?.off('error', onError);
      resolve();
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      mqttClient?.off('connect', onConnect);
      mqttClient?.off('error', onError);
      reject(err);
    };

    mqttClient?.once('connect', onConnect);
    mqttClient?.once('error', onError);

    // Si el cliente no existe, intentar inicializar
    if (!mqttClient) {
      initMqttService()
        .then(() => {
          // Después de inicializar, ya debería estar conectándose
          // Los listeners de arriba manejarán el resultado
        })
        .catch(reject);
    }
  });
}

/**
 * Publica un mensaje a un tópico MQTT
 * Incluye reintentos automáticos y espera de conexión
 */
export async function publishMqttMessage(
  topic: string, 
  message: object,
  options: { 
    retries?: number;
    retryDelay?: number;
    shouldWaitForConnection?: boolean;  // <- RENOMBRADO
  } = {}
): Promise<void> {
  const { 
    retries = 3, 
    retryDelay = 1000,
    shouldWaitForConnection = true  // <- RENOMBRADO
  } = options;

  // Si se solicita, esperar a que el cliente esté conectado
  if (shouldWaitForConnection) {
    try {
      await waitForMqttConnection(10000);  // <- USA LA FUNCIÓN CORRECTA
    } catch (error) {
      console.error('[MQTT] Error esperando conexión:', error);
      throw new Error('Cliente MQTT no disponible. Verifique que el broker esté en ejecución.');
    }
  }

  // Intentar publicar con reintentos
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Verificar cliente
      if (!mqttClient) {
        throw new Error('Cliente MQTT no inicializado');
      }

      if (!mqttClient.connected) {
        throw new Error('Cliente MQTT no conectado');
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
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  throw lastError || new Error('Error desconocido al publicar mensaje MQTT');
}
