import mqtt from 'mqtt';
import { prisma } from './prisma';

let mqttClient: mqtt.MqttClient | null = null;
let isInitialized = false;

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

  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  
  console.log(`[MQTT] Conectando al broker: ${brokerUrl}`);

  try {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: `simmer_server_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    mqttClient.on('connect', async () => {
      console.log('[MQTT] ✓ Conectado al broker');
      isInitialized = true;
      
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
    });

    mqttClient.on('offline', () => {
      console.log('[MQTT] Cliente desconectado');
    });

    mqttClient.on('reconnect', () => {
      console.log('[MQTT] Reconectando...');
    });

  } catch (error) {
    console.error('[MQTT] Error al inicializar servicio:', error);
    isInitialized = false;
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
  }
}

/**
 * Publica un mensaje a un tópico MQTT
 * (útil para actuadores en el futuro)
 */
export function publishMqttMessage(topic: string, message: object): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttClient.connected) {
      reject(new Error('Cliente MQTT no conectado'));
      return;
    }

    const payload = JSON.stringify(message);
    mqttClient.publish(topic, payload, (error) => {
      if (error) {
        console.error(`[MQTT] Error publicando a "${topic}":`, error);
        reject(error);
      } else {
        console.log(`[MQTT] ✓ Mensaje publicado a "${topic}":`, message);
        resolve();
      }
    });
  });
}
