'use client';

import { useEffect, useState } from 'react';
import ElementList from '../components/ElementList';
import SensorActuatorForm, { type SensorActuatorFormValues } from '../components/SensorActuatorForm';
import ProjectForm, { type ProjectFormValues, type SimpleItem } from '../components/ProjectForm';

type Item = { id: string; name: string };
type Role = 'operator' | 'labManager' | 'admin';

// Prefijo de API según entorno ('' en dev, '/a03' en prod)
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

export default function DashboardPage() {
  const [openSensor, setOpenSensor] = useState(false);
  const [openActuador, setOpenActuador] = useState(false);
  const [openProyecto, setOpenProyecto] = useState(false);

  // edición
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [editingActuatorId, setEditingActuatorId] = useState<string | null>(null);
  const [editingProyectoId, setEditingProyectoId] = useState<string | null>(null);

  const [sensorInitial, setSensorInitial] = useState<Partial<SensorActuatorFormValues> | undefined>(undefined);
  const [actuatorInitial, setActuatorInitial] = useState<Partial<SensorActuatorFormValues> | undefined>(undefined);
  const [proyectoInitial, setProyectoInitial] = useState<Partial<ProjectFormValues> | undefined>(undefined);

  // Datos del dashboard
  const [proyectos, setProyectos] = useState<Item[]>([]);
  const [sensores, setSensores] = useState<Item[]>([]);
  const [actuadores, setActuadores] = useState<Item[]>([]);
  const [loading, setLoading] = useState({ proj: false, sens: false, act: false });

  // Permisos por rol: por defecto 'desconocido' => sin mutación para evitar parpadeo
  const [role, setRole] = useState<Role | 'unknown'>('unknown');
  const canMutate = role === 'labManager' || role === 'admin';

  // ------- CARGA: Proyectos / Sensores / Actuadores -------
  const loadProjects = async () => {
    setLoading(s => ({ ...s, proj: true }));
    try {
      const res = await fetch(api('/api/projects'), { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudieron obtener proyectos');
      const data: Item[] = await res.json();
      setProyectos(data);
    } finally {
      setLoading(s => ({ ...s, proj: false }));
    }
  };

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

  // Carga del rol actual
  const loadRole = async () => {
    try {
      const res = await fetch(api('/api/me'), { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo obtener el rol');
      const j = (await res.json()) as { role?: Role };
      setRole(j?.role ?? 'operator'); // si no vino rol, lo tratamos como operator
    } catch {
      setRole('operator'); // en error => sin permisos de mutación
    }
  };

  useEffect(() => {
    loadRole();
    loadProjects();
    loadSensores();
    loadActuadores();
  }, []);

  // ----------------- Crear / Editar Sensor -----------------
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

  // ----------------- Crear / Editar Actuador -----------------
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

  // ------------------------ Crear / Editar Proyecto ------------------------
  const openNewProyecto = () => {
    setEditingProyectoId(null);
    setProyectoInitial(undefined);
    setOpenProyecto(true);
  };

  const handleEditProyecto = async (id: string) => {
    const res = await fetch(api(`/api/projects/${id}`), { cache: 'no-store' });
    if (!res.ok) {
      alert('No se pudo cargar el proyecto');
      return;
    }
    const d = await res.json();
    // d = { nombre, descripcion, sensorIds:number[], actuatorIds:number[] }
    setProyectoInitial(d);
    setEditingProyectoId(id);
    setOpenProyecto(true);
  };

  const submitProyecto = async (vals: ProjectFormValues) => {
    const url = editingProyectoId ? api(`/api/projects/${editingProyectoId}`) : api('/api/projects');
    const method = editingProyectoId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'Error al guardar el proyecto');
      return;
    }
    setOpenProyecto(false);
    setEditingProyectoId(null);
    setProyectoInitial(undefined);
    await loadProjects(); // refrescamos la lista real
  };

  const handleDeleteProyecto = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto? Esta acción es permanente.')) return;
    const res = await fetch(api(`/api/projects/${id}`), { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'No se pudo eliminar');
      return;
    }
    await loadProjects();
  };

  // Listas simples para el form de proyectos (checkboxes)
  const sensoresSimple: SimpleItem[] = sensores.map(s => ({ id: Number(s.id), name: s.name }));
  const actuadoresSimple: SimpleItem[] = actuadores.map(a => ({ id: Number(a.id), name: a.name }));

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
            addLabel={loading.proj ? 'Cargando...' : 'Nuevo proyecto'}
            onAdd={openNewProyecto}
            onEdit={handleEditProyecto}
            onDelete={handleDeleteProyecto}
            canCreate={canMutate}
            canEdit={canMutate}
            canDelete={canMutate}
          />

          <ElementList
            title="Sensores"
            items={sensores}
            addLabel={loading.sens ? 'Cargando...' : 'Nuevo sensor'}
            onAdd={openNewSensor}
            onEdit={handleEditSensor}
            onDelete={handleDeleteSensor}
            canCreate={canMutate}
            canEdit={canMutate}
            canDelete={canMutate}
          />

          <ElementList
            title="Actuadores"
            items={actuadores}
            addLabel={loading.act ? 'Cargando...' : 'Nuevo actuador'}
            onAdd={openNewActuator}
            onEdit={handleEditActuator}
            onDelete={handleDeleteActuator}
            canCreate={canMutate}
            canEdit={canMutate}
            canDelete={canMutate}
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

      {/* MODAL: Proyecto */}
      <ProjectForm
        asModal
        open={openProyecto}
        onRequestClose={() => { setOpenProyecto(false); setEditingProyectoId(null); setProyectoInitial(undefined); }}
        initialValues={editingProyectoId ? proyectoInitial : undefined}
        sensores={sensoresSimple}
        actuadores={actuadoresSimple}
        onCancel={() => { setOpenProyecto(false); setEditingProyectoId(null); setProyectoInitial(undefined); }}
        onSubmit={submitProyecto}
      />
    </div>
  );
}
