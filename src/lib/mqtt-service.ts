import mqtt from 'mqtt';
import { prisma } from './prisma';
import { checkAndSendAlert } from './sensor-alert-service';

let mqttClient: mqtt.MqttClient | null = null;
let isInitialized = false;
let isConnecting = false;
let connectionPromise: Promise<void> | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

interface SensorMessage {
  valor: number;
  timestamp?: string;
  unidad?: string;
}

/**
 * HANDLER único para mensajes MQTT
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
 * Inicia un heartbeat que verifica la conexión MQTT periódicamente
 */
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(async () => {
    if (!mqttClient) {
      console.warn('[MQTT Heartbeat] Cliente no existe');
      return;
    }

    if (!mqttClient.connected) {
      console.warn('[MQTT Heartbeat] ⚠️  Cliente desconectado, intentando reconectar...');
      try {
        await initMqttService();
        console.log('[MQTT Heartbeat] ✓ Reconexión exitosa');
      } catch (error) {
        console.error('[MQTT Heartbeat] ❌ Error en reconexión:', error);
      }
    } else {
      console.log('[MQTT Heartbeat] ✓ Conexión activa');
    }
  }, 30000);
}

/**
 * ✅ Detiene el heartbeat
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Lee la URL del broker desde DB (clave "mqtt_broker_url"),
 * con fallback a process.env y luego al valor por defecto.
 */
async function getBrokerUrl(): Promise<string> {
  const DEFAULT_URL = 'mqtt://172.16.248.85:1883';
  try {
    const config = await prisma.configSistema.findUnique({
      where: { clave: 'mqtt_broker_url' },
    });
    if (config?.valor) return config.valor;
  } catch (e) {
    console.warn('[MQTT] No se pudo leer URL desde DB, usando env/default:', e);
  }
  return process.env.MQTT_BROKER_URL || DEFAULT_URL;
}

/**
 * Cambia la URL del broker: persiste en DB, cierra la conexión actual
 * y reconecta al nuevo broker.
 */
export async function changeBrokerUrl(newUrl: string): Promise<void> {
  // Persistir en DB
  await prisma.configSistema.upsert({
    where: { clave: 'mqtt_broker_url' },
    update: { valor: newUrl },
    create: { clave: 'mqtt_broker_url', valor: newUrl },
  });
  console.log(`[MQTT] URL del broker actualizada a: ${newUrl}`);

  // Cerrar conexión actual si existe
  closeMqttConnection();

  // Reconectar con la nueva URL
  await initMqttService();
}

/**
 * Inicializa el cliente MQTT y se suscribe a los tópicos de sensores activos.
 */
export async function initMqttService(): Promise<void> {
  // Si ya está inicializado y conectado, no hacer nada
  if (isInitialized && mqttClient?.connected) {
    console.log('[MQTT] Servicio ya inicializado y conectado');
    return;
  }

  // Si hay una conexión en proceso, esperar a que termine
  if (isConnecting && connectionPromise) {
    console.log('[MQTT] Esperando conexión en proceso...');
    return connectionPromise;
  }

  // Si hay un cliente existente pero no conectado, limpiarlo primero
  if (mqttClient && !mqttClient.connected) {
    console.log('[MQTT] Cliente existente pero desconectado, limpiando...');
    stopHeartbeat();
    mqttClient.removeAllListeners();
    mqttClient.end(true);
    mqttClient = null;
    isInitialized = false;
  }

  const brokerUrl = await getBrokerUrl();

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
        reconnectPeriod: 0,
        connectTimeout: 30000,
        keepalive: 60,
        protocolVersion: 4,
        reschedulePings: true,
        will: {
          topic: 'simmer/server/status',
          payload: Buffer.from('offline'),
          qos: 1,
          retain: true
        }
      });

      mqttClient.on('message', messageHandler);

      mqttClient.on('connect', async () => {
        clearTimeout(connectionTimeout);
        console.log('[MQTT] ✓ Conectado al broker');
        console.log('[MQTT] Cliente ID:', mqttClient?.options.clientId);
        isInitialized = true;
        isConnecting = false;

        // Suscribirse a todos los tópicos de sensores activos
        await subscribeToActiveSensors();
        startHeartbeat();
        resolve();
      });

      mqttClient.on('disconnect', (packet) => {
        console.log('[MQTT] ⚠️  Desconexión detectada:', packet);
      });

      mqttClient.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('[MQTT] Error de conexión:', error);
        isConnecting = false;
        isInitialized = false;
        reject(error);
      });

      mqttClient.on('offline', () => {
        console.log('[MQTT] ⚠️  Cliente fuera de línea');
        isInitialized = false;
        stopHeartbeat();
      });

      mqttClient.on('reconnect', () => {
        console.log('[MQTT] Reconectando...');
      });

      // Handler para cuando se cierra la conexión
      mqttClient.on('close', () => {
        console.log('[MQTT] Conexión cerrada');
        isInitialized = false;
        isConnecting = false;
        stopHeartbeat();
      });

      mqttClient.on('packetsend', (packet) => {
        if (packet.cmd === 'pingreq') {
          console.log('[MQTT] 📡 Enviando ping keepalive');
        }
      });

      mqttClient.on('packetreceive', (packet) => {
        if (packet.cmd === 'pingresp') {
          console.log('[MQTT] 📡 Ping keepalive recibido');
        }
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
        estado: true,
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
            estado: true,
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
        console.log(`[MQTT] Sensor "${sensor.nombre}" no está asociado a proyectos activos y encendidos`);
        continue;
      }

      const unidadAGuardar = unidad || sensor.unidadMedida?.simbolo || null;

      const mediciones = proyectosSensor.map(ps => ({
        proyectoSensorId: ps.id,
        valor,
        timestamp: medicionTimestamp,
        unidadSimbolo: unidadAGuardar,
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
 * ✅ Re-suscribe con auto-reconexión
 */
export async function refreshMqttSubscriptions() {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('[MQTT] Cliente no conectado, intentando reconectar...');

    try {
      await ensureMqttConnection(15000);
      console.log('[MQTT] ✓ Reconexión exitosa');
    } catch (error) {
      console.error('[MQTT] ❌ Error al reconectar:', error);
      throw new Error('No se pudo reconectar al broker MQTT');
    }
  }

  console.log('[MQTT] Refrescando suscripciones...');

  // Desuscribirse de todos los tópicos actuales
  if (!mqttClient) {
    throw new Error('Cliente MQTT no disponible después de reconexión');
  }

  type ResubscribeTopicsHolder = {
    _resubscribeTopics?: Record<string, unknown>;
  };

  const holder = mqttClient as unknown as ResubscribeTopicsHolder;
  const currentTopics = Object.keys(holder._resubscribeTopics ?? {});

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
    stopHeartbeat();
    connectionPromise = null;
    isInitialized = false;
    isConnecting = false;
    mqttClient.removeAllListeners();
    mqttClient.end(true);
    mqttClient = null;
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
    // Contar listeners del evento 'message'
    messageListeners: mqttClient ? mqttClient.listenerCount('message') : 0,
    hasHeartbeat: heartbeatInterval !== null,
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
