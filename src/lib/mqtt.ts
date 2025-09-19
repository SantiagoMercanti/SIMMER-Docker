import mqtt, { MqttClient } from 'mqtt';

const client: MqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://mqtt:1883', {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log('[MQTT] conectado');
  client.subscribe('simmer/+/sensors/+/state', { qos: 1 });
  client.subscribe('simmer/+/actuators/+/ack', { qos: 1 });
});

client.on('message', (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());
    console.log(`[MQTT] ${topic}`, data);
  } catch (e) {
    console.error('[MQTT] error parseando payload', e);
  }
});

export function publishCmd(projectId: string, actuatorId: string, cmd: unknown) {
  client.publish(
    `simmer/${projectId}/actuators/${actuatorId}/cmd`,
    JSON.stringify(cmd),
    { qos: 1, retain: false }
  );
}

export default client;
