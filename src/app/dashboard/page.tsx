'use client';

import { useEffect, useState } from 'react';
import ElementList from '../components/ElementList';
import SensorActuatorForm, { type SensorActuatorFormValues } from '../components/SensorActuatorForm';

type Item = { id: string; name: string };

// Prefijo de API según entorno ('' en dev, '/a03' en prod)
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

export default function DashboardPage() {
  const [openSensor, setOpenSensor] = useState(false);
  const [openActuador, setOpenActuador] = useState(false);

  // edición
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [editingActuatorId, setEditingActuatorId] = useState<string | null>(null);
  const [sensorInitial, setSensorInitial] = useState<Partial<SensorActuatorFormValues> | undefined>(undefined);
  const [actuatorInitial, setActuatorInitial] = useState<Partial<SensorActuatorFormValues> | undefined>(undefined);

  const [proyectos] = useState<Item[]>([
    { id: 'p1', name: 'BioReactor A' },
    { id: 'p2', name: 'Fermentor 200L' },
  ]);
  const [sensores, setSensores] = useState<Item[]>([]);
  const [actuadores, setActuadores] = useState<Item[]>([]);
  const [loading, setLoading] = useState({ sens: false, act: false });

  const loadSensores = async () => {
    setLoading(s => ({ ...s, sens: true }));
    try {
      const res = await fetch(api('/api/sensors'), { cache: 'no-store' });
      const data: Item[] = await res.json();
      setSensores(data);
    } finally {
      setLoading(s => ({ ...s, sens: false }));
    }
  };

  const loadActuadores = async () => {
    setLoading(s => ({ ...s, act: true }));
    try {
      const res = await fetch(api('/api/actuators'), { cache: 'no-store' });
      const data: Item[] = await res.json();
      setActuadores(data);
    } finally {
      setLoading(s => ({ ...s, act: false }));
    }
  };

  useEffect(() => {
    loadSensores();
    loadActuadores();
  }, []);

  // --- Crear / Editar Sensor ---
  const openNewSensor = () => {
    setEditingSensorId(null);
    setSensorInitial(undefined);
    setOpenSensor(true);
  };

  const handleEditSensor = async (id: string) => {
    // traemos detalle antes de abrir para que el form se inicialice con esos valores
    const res = await fetch(api(`/api/sensors/${id}`), { cache: 'no-store' });
    if (!res.ok) {
      alert('No se pudo cargar el sensor');
      return;
    }
    const d = await res.json();
    setSensorInitial(d);
    setEditingSensorId(id);
    setOpenSensor(true);
  };

  const submitSensor = async (vals: SensorActuatorFormValues) => {
    const url = editingSensorId ? api(`/api/sensors/${editingSensorId}`) : api('/api/sensors');
    const method = editingSensorId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'Error al guardar el sensor');
      return;
    }
    setOpenSensor(false);
    setEditingSensorId(null);
    setSensorInitial(undefined);
    await loadSensores();
  };

  const handleDeleteSensor = async (id: string) => {
    if (!confirm('¿Eliminar este sensor?')) return;
    const res = await fetch(api(`/api/sensors/${id}`), { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'No se pudo eliminar');
      return;
    }
    await loadSensores();
  };

  // --- Crear / Editar Actuador ---
  const openNewActuator = () => {
    setEditingActuatorId(null);
    setActuatorInitial(undefined);
    setOpenActuador(true);
  };

  const handleEditActuator = async (id: string) => {
    const res = await fetch(api(`/api/actuators/${id}`), { cache: 'no-store' });
    if (!res.ok) {
      alert('No se pudo cargar el actuador');
      return;
    }
    const d = await res.json();
    setActuatorInitial(d);
    setEditingActuatorId(id);
    setOpenActuador(true);
  };

  const submitActuador = async (vals: SensorActuatorFormValues) => {
    const url = editingActuatorId ? api(`/api/actuators/${editingActuatorId}`) : api('/api/actuators');
    const method = editingActuatorId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'Error al guardar el actuador');
      return;
    }
    setOpenActuador(false);
    setEditingActuatorId(null);
    setActuatorInitial(undefined);
    await loadActuadores();
  };

  const handleDeleteActuator = async (id: string) => {
    if (!confirm('¿Eliminar este actuador?')) return;
    const res = await fetch(api(`/api/actuators/${id}`), { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'No se pudo eliminar');
      return;
    }
    await loadActuadores();
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-blue-600 tracking-wide">Dashboard</h1>
          <p className="text-gray-600">Administrá proyectos, sensores y actuadores.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ElementList
            title="Proyectos"
            items={proyectos}
            addLabel="Nuevo proyecto"
            onAdd={() => console.log('Abrir formulario de proyecto')}
          />

          <ElementList
            title="Sensores"
            items={sensores}
            addLabel={loading.sens ? 'Cargando...' : 'Nuevo sensor'}
            onAdd={openNewSensor}
            onEdit={handleEditSensor}
            onDelete={handleDeleteSensor}
          />

          <ElementList
            title="Actuadores"
            items={actuadores}
            addLabel={loading.act ? 'Cargando...' : 'Nuevo actuador'}
            onAdd={openNewActuator}
            onEdit={handleEditActuator}
            onDelete={handleDeleteActuator}
          />
        </div>
      </div>

      {/* MODAL: Sensor */}
      <SensorActuatorForm
        asModal
        open={openSensor}
        onRequestClose={() => { setOpenSensor(false); setEditingSensorId(null); setSensorInitial(undefined); }}
        tipo="sensor"
        initialValues={editingSensorId ? sensorInitial : undefined}
        onCancel={() => { setOpenSensor(false); setEditingSensorId(null); setSensorInitial(undefined); }}
        onSubmit={submitSensor}
      />

      {/* MODAL: Actuador */}
      <SensorActuatorForm
        asModal
        open={openActuador}
        onRequestClose={() => { setOpenActuador(false); setEditingActuatorId(null); setActuatorInitial(undefined); }}
        tipo="actuador"
        initialValues={editingActuatorId ? actuatorInitial : undefined}
        onCancel={() => { setOpenActuador(false); setEditingActuatorId(null); setActuatorInitial(undefined); }}
        onSubmit={submitActuador}
      />
    </div>
  );
}
