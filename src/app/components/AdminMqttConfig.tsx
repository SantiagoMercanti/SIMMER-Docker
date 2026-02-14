'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type MqttStatus = {
  isConnected: boolean;
  isInitialized: boolean;
  isConnecting: boolean;
  hasClient: boolean;
  hasHeartbeat: boolean;
};

type MqttInfo = {
  brokerUrl: string;
  isFromDb: boolean;
  status: MqttStatus;
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

export default function AdminMqttConfig() {
  const [info, setInfo] = useState<MqttInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInfo = useCallback(async () => {
    try {
      const res = await fetch(api('/api/admin/mqtt'), { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo obtener la configuración MQTT');
      const data: MqttInfo = await res.json();
      setInfo(data);
      setInputUrl(prev => prev || data.brokerUrl);
      return data;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Al montar: cargar y si no está conectado hacer poll para capturar estado real
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const data = await loadInfo();
      if (cancelled) return;

      if (data && !data.status.isConnected) {
        let attempts = 0;
        const poll = async () => {
          if (cancelled || attempts >= 5) return;
          attempts++;
          const fresh = await loadInfo();
          if (cancelled) return;
          if (!fresh?.status.isConnected) {
            pollRef.current = setTimeout(poll, 1500);
          }
        };
        pollRef.current = setTimeout(poll, 1500);
      }
    };

    init();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [loadInfo]);

  async function handleSave() {
    if (!inputUrl.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(api('/api/admin/mqtt'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ brokerUrl: inputUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al guardar');

      setSuccess(`Broker actualizado. Reconectando a ${data.brokerUrl}...`);

      // Poll para reflejar el estado de conexión tras aplicar
      let attempts = 0;
      const poll = async () => {
        if (attempts >= 6) return;
        attempts++;
        const fresh = await loadInfo();
        if (!fresh?.status.isConnected) {
          pollRef.current = setTimeout(poll, 1500);
        }
      };
      pollRef.current = setTimeout(poll, 1000);

    } catch (e) {
      setError((e as Error).message);
      // Aunque falle, recargar para mostrar URL guardada y estado real
      await loadInfo();
    } finally {
      setSaving(false);
    }
  }

  const statusDot = info
    ? info.status.isConnected
      ? 'bg-green-500'
      : info.status.isConnecting
        ? 'bg-yellow-500'
        : 'bg-red-500'
    : 'bg-gray-400';

  const statusLabel = info
    ? info.status.isConnected
      ? 'Conectado'
      : info.status.isConnecting
        ? 'Conectando...'
        : 'Desconectado'
    : '—';

  return (
    <section className="bg-white shadow-md rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Configuración MQTT</h2>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusDot}`} />
            <span className="text-gray-700 font-medium">{statusLabel}</span>
            {info && !info.isFromDb && (
              <span className="text-xs text-gray-400">(valor inicial desde variable de entorno)</span>
            )}
          </div>

          {info && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">URL activa</p>
              <p className="font-mono text-sm text-gray-800 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                {info.brokerUrl}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="mqtt-url" className="text-xs font-medium text-gray-700 block mb-1">
              Nueva URL del broker
            </label>
            <div className="flex gap-2">
              <input
                id="mqtt-url"
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="mqtt://host:1883"
                className="flex-1 border border-gray-300 text-gray-500 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !inputUrl.trim() || inputUrl.trim() === info?.brokerUrl}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {saving ? 'Guardando...' : 'Aplicar'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Formatos válidos: mqtt://, mqtts://, ws://, wss://
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>
      )}
    </section>
  );
}
