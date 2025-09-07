'use client';

import { useEffect, useState } from 'react';
import ElementList from '../components/ElementList';
import SensorActuatorForm, { type SensorActuatorFormValues } from '../components/SensorActuatorForm';

type Item = { id: string; name: string };

export default function DashboardPage() {
  const [openSensor, setOpenSensor] = useState(false);
  const [openActuador, setOpenActuador] = useState(false);

  const [proyectos] = useState<Item[]>([
    // si más adelante querés, los traemos también de la DB
    { id: 'p1', name: 'BioReactor A' },
    { id: 'p2', name: 'Fermentor 200L' },
  ]);
  const [sensores, setSensores] = useState<Item[]>([]);
  const [actuadores, setActuadores] = useState<Item[]>([]);
  const [loading, setLoading] = useState({ sens: false, act: false });

  const loadSensores = async () => {
    setLoading(s => ({ ...s, sens: true }));
    try {
      const res = await fetch('/api/sensors', { cache: 'no-store' });
      const data: Item[] = await res.json();
      setSensores(data);
    } finally {
      setLoading(s => ({ ...s, sens: false }));
    }
  };

  const loadActuadores = async () => {
    setLoading(s => ({ ...s, act: true }));
    try {
      const res = await fetch('/api/actuators', { cache: 'no-store' });
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

  const submitSensor = async (vals: SensorActuatorFormValues) => {
    const res = await fetch('/api/sensors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'Error al guardar el sensor');
      return;
    }
    setOpenSensor(false);
    await loadSensores();
  };

  const submitActuador = async (vals: SensorActuatorFormValues) => {
    const res = await fetch('/api/actuators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'Error al guardar el actuador');
      return;
    }
    setOpenActuador(false);
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
            onAdd={() => setOpenSensor(true)}
          />

          <ElementList
            title="Actuadores"
            items={actuadores}
            addLabel={loading.act ? 'Cargando...' : 'Nuevo actuador'}
            onAdd={() => setOpenActuador(true)}
          />
        </div>
      </div>

      {/* MODAL: Nuevo Sensor */}
      <SensorActuatorForm
        asModal
        open={openSensor}
        onRequestClose={() => setOpenSensor(false)}
        tipo="sensor"
        onCancel={() => setOpenSensor(false)}
        onSubmit={submitSensor}
      />

      {/* MODAL: Nuevo Actuador */}
      <SensorActuatorForm
        asModal
        open={openActuador}
        onRequestClose={() => setOpenActuador(false)}
        tipo="actuador"
        onCancel={() => setOpenActuador(false)}
        onSubmit={submitActuador}
      />
    </div>
  );
}
