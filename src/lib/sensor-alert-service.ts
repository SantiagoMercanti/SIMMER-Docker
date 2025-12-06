import { prisma } from './prisma';
import { sendMail } from './email';

const COOLDOWN_MINUTES = 30;

interface AlertContext {
  sensorId: number;
  sensorNombre: string;
  valor: number;
  valorMin: number;
  valorMax: number;
  timestamp: Date;
  unidadSimbolo: string;
  proyectos: Array<{ id: number; nombre: string }>;
}

/**
 * Verifica si un valor está fuera del rango del sensor
 */
export function isOutOfRange(valor: number, valorMin: number, valorMax: number): boolean {
  return valor < valorMin || valor > valorMax;
}

/**
 * Verifica si ya se envió una alerta recientemente (cooldown de 30 minutos)
 */
async function shouldSendAlert(sensorId: number): Promise<boolean> {
  const cooldownTime = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);

  const recentAlert = await prisma.sensorAlert.findFirst({
    where: {
      sensorId,
      timestamp: {
        gte: cooldownTime,
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  return !recentAlert; // true si NO hay alerta reciente
}

/**
 * Registra que se envió una alerta para este sensor
 */
async function recordAlert(sensorId: number, valor: number, timestamp: Date): Promise<void> {
  await prisma.sensorAlert.create({
    data: {
      sensorId,
      valor,
      timestamp,
    },
  });
}

/**
 * Obtiene los emails de usuarios admin y labManager activos
 */
async function getAlertRecipients(): Promise<string[]> {
  const users = await prisma.userMetadata.findMany({
    where: {
      activo: true,
      tipo: {
        in: ['admin', 'labManager'],
      },
    },
    select: {
      email: true,
    },
  });

  return users.map(u => u.email);
}

/**
 * Genera el contenido HTML del email de alerta
 */
function generateAlertEmail(context: AlertContext): { subject: string; html: string; text: string } {
  const {
    sensorNombre,
    valor,
    valorMin,
    valorMax,
    timestamp,
    unidadSimbolo,
    proyectos,
  } = context;

  const fechaFormateada = timestamp.toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  const tipoAlerta = valor < valorMin ? 'por debajo' : 'por encima';
  const rangoStr = `${valorMin} - ${valorMax} ${unidadSimbolo}`;
  const valorStr = `${valor} ${unidadSimbolo}`;

  const proyectosStr = proyectos.length > 0
    ? proyectos.map(p => `• ${p.nombre}`).join('\n')
    : 'Ninguno';

  const subject = `⚠️ Alerta: Sensor "${sensorNombre}" fuera de rango`;

  const text = `
ALERTA DE SENSOR FUERA DE RANGO

Sensor: ${sensorNombre}
Estado: El sensor está ${tipoAlerta} del rango estable
Valor actual: ${valorStr}
Rango esperado: ${rangoStr}
Fecha/Hora: ${fechaFormateada}

Proyectos afectados:
${proyectosStr}

Por favor, revise el sensor y tome las medidas necesarias.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .alert-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .alert-title {
      color: #856404;
      font-size: 20px;
      font-weight: bold;
      margin: 0 0 10px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .info-table td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
    }
    .info-table td:first-child {
      font-weight: bold;
      width: 40%;
    }
    .value-critical {
      color: #d32f2f;
      font-weight: bold;
      font-size: 18px;
    }
    .projects-list {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="alert-box">
    <div class="alert-title">⚠️ Alerta de Sensor Fuera de Rango</div>
    <p>El sensor <strong>${sensorNombre}</strong> ha registrado valores ${tipoAlerta} del rango estable.</p>
  </div>

  <table class="info-table">
    <tr>
      <td>Sensor:</td>
      <td><strong>${sensorNombre}</strong></td>
    </tr>
    <tr>
      <td>Valor actual:</td>
      <td class="value-critical">${valorStr}</td>
    </tr>
    <tr>
      <td>Rango esperado:</td>
      <td>${rangoStr}</td>
    </tr>
    <tr>
      <td>Fecha/Hora:</td>
      <td>${fechaFormateada}</td>
    </tr>
  </table>

  <div>
    <strong>Proyectos afectados:</strong>
    <div class="projects-list">
      ${proyectos.length > 0
        ? proyectos.map(p => `• ${p.nombre}`).join('<br>')
        : '<em>Ninguno</em>'
      }
    </div>
  </div>

  <p style="margin-top: 20px;">
    Por favor, revise el sensor y tome las medidas necesarias para restablecer los valores dentro del rango normal.
  </p>

  <div class="footer">
    <p>Este es un mensaje automático del sistema de monitoreo SIMMER.</p>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Envía alertas por email a todos los usuarios admin y labManager
 */
async function sendAlertEmails(context: AlertContext): Promise<void> {
  const recipients = await getAlertRecipients();

  if (recipients.length === 0) {
    console.warn('[ALERT] No hay destinatarios para enviar alertas');
    return;
  }

  const { subject, html, text } = generateAlertEmail(context);

  // Enviar emails en paralelo
  const sendPromises = recipients.map(email =>
    sendMail({ to: email, subject, html, text })
      .then(() => {
        console.log(`[ALERT] ✓ Email enviado a: ${email}`);
      })
      .catch(err => {
        console.error(`[ALERT] Error enviando email a ${email}:`, err);
      })
  );

  await Promise.allSettled(sendPromises);
}

/**
 * Función principal: verifica si debe enviar alerta y la envía si corresponde
 */
export async function checkAndSendAlert(
  sensorId: number,
  valor: number,
  timestamp: Date
): Promise<void> {
  try {
    // 1. Obtener información del sensor
    const sensor = await prisma.sensor.findUnique({
      where: { sensor_id: sensorId },
      select: {
        sensor_id: true,
        nombre: true,
        valor_min: true,
        valor_max: true,
        activo: true,
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
        proyectos: {
          where: {
            proyecto: {
              activo: true,
            },
          },
          select: {
            proyecto: {
              select: {
                project_id: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    if (!sensor || !sensor.activo) {
      // Sensor no encontrado o inactivo, no enviar alerta
      return;
    }

    // 2. Verificar si el valor está fuera de rango
    const outOfRange = isOutOfRange(valor, sensor.valor_min, sensor.valor_max);
    
    if (!outOfRange) {
      // Valor dentro del rango, no hacer nada
      return;
    }

    // 3. Verificar cooldown (si ya se envió alerta recientemente)
    const shouldSend = await shouldSendAlert(sensorId);
    
    if (!shouldSend) {
      console.log(
        `[ALERT] Cooldown activo para sensor "${sensor.nombre}" (ID: ${sensorId}). No se envía alerta.`
      );
      return;
    }

    // 4. Preparar contexto y enviar alertas
    const proyectos = sensor.proyectos.map(ps => ({
      id: ps.proyecto.project_id,
      nombre: ps.proyecto.nombre,
    }));

    const context: AlertContext = {
      sensorId: sensor.sensor_id,
      sensorNombre: sensor.nombre,
      valor,
      valorMin: sensor.valor_min,
      valorMax: sensor.valor_max,
      timestamp,
      unidadSimbolo: sensor.unidadMedida?.simbolo || '',
      proyectos,
    };

    console.log(
      `[ALERT] ⚠️  Sensor "${sensor.nombre}" fuera de rango: ${valor} (esperado: ${sensor.valor_min}-${sensor.valor_max})`
    );

    await sendAlertEmails(context);

    // 5. Registrar que se envió la alerta
    await recordAlert(sensorId, valor, timestamp);

    console.log(`[ALERT] ✓ Alerta registrada para sensor "${sensor.nombre}"`);
  } catch (error) {
    console.error('[ALERT] Error en checkAndSendAlert:', error);
    // No lanzar error para no interrumpir el guardado de mediciones
  }
}
