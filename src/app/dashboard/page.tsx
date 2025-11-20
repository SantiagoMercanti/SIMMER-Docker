'use client';

import { useEffect, useState, useCallback } from 'react';
import ElementList from '../components/ElementList';
import SensorActuatorForm, { type SensorActuatorFormValues } from '../components/SensorActuatorForm';
import ProjectForm, { type ProjectFormValues, type SimpleItem } from '../components/ProjectForm';
import SensorDetailsModal from '../components/SensorDetailsModal';
import ActuatorDetailsModal from '../components/ActuatorDetailsModal';
import ProjectDetailsModal from '../components/ProjectDetailsModal';
import Header from '../components/Header';

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

  // Modal de detalle de elementos
  const [openSensorDetails, setOpenSensorDetails] = useState(false);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [openActuatorDetails, setOpenActuatorDetails] = useState(false);
  const [selectedActuatorId, setSelectedActuatorId] = useState<string | null>(null);
  const [openProjectDetails, setOpenProjectDetails] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // ------- CARGA: Proyectos / Sensores / Actuadores -------
  const loadProjects = useCallback(async (includeInactive = false) => {
    setLoading(s => ({ ...s, proj: true }));
    try {
      const url = `${BASE}/api/projects${includeInactive ? '?includeInactive=true' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudieron obtener proyectos');
      const data: Item[] = await res.json();
      setProyectos(data);
    } finally {
      setLoading(s => ({ ...s, proj: false }));
    }
  }, []);

  const loadSensores = useCallback(async (includeInactive = false) => {
    setLoading(s => ({ ...s, sens: true }));
    try {
      const url = `${BASE}/api/sensors${includeInactive ? '?includeInactive=true' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudieron obtener sensores');
      const data: Item[] = await res.json();
      setSensores(data);
    } finally {
      setLoading(s => ({ ...s, sens: false }));
    }
  }, []);

  const loadActuadores = useCallback(async (includeInactive = false) => {
    setLoading(s => ({ ...s, act: true }));
    try {
      const url = `${BASE}/api/actuators${includeInactive ? '?includeInactive=true' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudieron obtener actuadores');
      const data: Item[] = await res.json();
      setActuadores(data);
    } finally {
      setLoading(s => ({ ...s, act: false }));
    }
  }, []);

  const loadRole = useCallback(async () => {
    try {
      const res = await fetch(api('/api/me'), { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo obtener el rol');
      const j = (await res.json()) as { role?: Role };
      setRole(j?.role ?? 'operator');
    } catch {
      setRole('operator');
    }
  }, []);

  useEffect(() => {
    loadRole();
    loadProjects(false);
    loadSensores(false);
    loadActuadores(false);
  }, [loadRole, loadProjects, loadSensores, loadActuadores]); // ← Ahora incluye las dependencias

  useEffect(() => {
    if (role === 'admin') {
      loadProjects(true);
      loadSensores(true);
      loadActuadores(true);
    }
  }, [role, loadProjects, loadSensores, loadActuadores]); // ← Ahora incluye las dependencias

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

    // Normalizá a strings lo que el form espera como texto
    setSensorInitial({
      ...d,
      unidadMedida: d.unidadMedida ?? '',
      fuenteDatos: d.fuenteDatos ?? '',
      valorMin: d.valorMin !== null && d.valorMin !== undefined ? String(d.valorMin) : '',
      valorMax: d.valorMax !== null && d.valorMax !== undefined ? String(d.valorMax) : '',
    });

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
    await loadSensores(role === 'admin');
  };

  async function fetchUsage(
    kind: 'sensor' | 'actuator',
    id: string
  ): Promise<{ projects: { id: number; nombre: string }[] }> {
    const url =
      kind === 'sensor'
        ? api(`/api/sensors/${id}/usage`)
        : api(`/api/actuators/${id}/usage`);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      // Si el endpoint no existe o falla, devolvemos vacío para no romper el flujo.
      return { projects: [] };
    }
    return res.json();
  }

  const handleDeleteSensor = async (id: string) => {
    try {
      // Pre-chequeo de uso en proyectos
      const { projects } = await fetchUsage('sensor', id);

      if (projects?.length) {
        const nombres = projects.map(p => p.nombre).join(' - ');
        const msg = `El elemento a eliminar está siendo utilizado en los proyectos: ${nombres}. ¿Desea continuar?`;
        if (!confirm(msg)) return;
      } else {
        if (!confirm('¿Eliminar este sensor?')) return;
      }

      // DELETE (soft-delete en backend)
      const res = await fetch(api(`/api/sensors/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error ?? 'No se pudo eliminar');
        return;
      }
      await loadSensores(role === 'admin');
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar');
    }
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

    setActuatorInitial({
      ...d,
      unidadMedida: d.unidadMedida ?? '',
      fuenteDatos: d.fuenteDatos ?? '',
      valorMin: d.valorMin !== null && d.valorMin !== undefined ? String(d.valorMin) : '',
      valorMax: d.valorMax !== null && d.valorMax !== undefined ? String(d.valorMax) : '',
    });
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
    await loadActuadores(role === 'admin');
  };

  const handleDeleteActuator = async (id: string) => {
    try {
      // Pre-chequeo de uso en proyectos
      const { projects } = await fetchUsage('actuator', id);

      if (projects?.length) {
        const nombres = projects.map(p => p.nombre).join(' - ');
        const msg = `El elemento a eliminar está siendo utilizado en los proyectos: ${nombres}. ¿Desea continuar?`;
        if (!confirm(msg)) return;
      } else {
        if (!confirm('¿Eliminar este actuador?')) return;
      }

      // DELETE (soft-delete en backend)
      const res = await fetch(api(`/api/actuators/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error ?? 'No se pudo eliminar');
        return;
      }
      await loadActuadores(role === 'admin');
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar');
    }
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
    await loadProjects(role === 'admin');
  };

  // Agregar estas funciones en page.tsx

  const handleReactivateSensor = async (id: string) => {
    if (!confirm('¿Reactivar este sensor?')) return;
    const res = await fetch(api(`/api/sensors/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'No se pudo reactivar');
      return;
    }
    await loadSensores(true);
  };

  const handleReactivateActuator = async (id: string) => {
    if (!confirm('¿Reactivar este actuador?')) return;
    const res = await fetch(api(`/api/actuators/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'No se pudo reactivar');
      return;
    }
    await loadActuadores(true);
  };

  const handleReactivateProject = async (id: string) => {
    if (!confirm('¿Reactivar este proyecto?')) return;
    const res = await fetch(api(`/api/projects/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'No se pudo reactivar');
      return;
    }
    await loadProjects(true);
  };

  // Listas simples para el form de proyectos (checkboxes)
  const sensoresSimple: SimpleItem[] = sensores.map(s => ({ id: Number(s.id), name: s.name }));
  const actuadoresSimple: SimpleItem[] = actuadores.map(a => ({ id: Number(a.id), name: a.name }));

  // Abrir modales de detalle
  const handleViewSensor = (id: string) => { setSelectedSensorId(id); setOpenSensorDetails(true); };
  const handleViewActuator = (id: string) => { setSelectedActuatorId(id); setOpenActuatorDetails(true); };
  const handleViewProject = (id: string) => { setSelectedProjectId(id); setOpenProjectDetails(true); };
  const openSensorFromProject = (sensorId: number) => { setSelectedSensorId(String(sensorId)); setOpenSensorDetails(true); };
  const openActuatorFromProject = (actuatorId: number) => { setSelectedActuatorId(String(actuatorId)); setOpenActuatorDetails(true); };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-100 px-4 py-8 overflow-y-auto">
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
              onReactivate={handleReactivateProject}  // ← AGREGAR
              onView={handleViewProject}
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
              onReactivate={handleReactivateSensor}  // ← Agregado
              onView={handleViewSensor}
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
              onReactivate={handleReactivateActuator}  // ← Agregado
              onView={handleViewActuator}
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
          editingId={editingSensorId ? Number(editingSensorId) : undefined}
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
          editingId={editingActuatorId ? Number(editingActuatorId) : undefined}
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

        {/* DETALLES */}
        <SensorDetailsModal
          open={openSensorDetails}
          sensorId={selectedSensorId}
          onClose={() => { setOpenSensorDetails(false); setSelectedSensorId(null); }}
          onOpenProject={(projectId) => {
            // Abrir el modal de proyecto
            setSelectedProjectId(String(projectId));
            setOpenProjectDetails(true);
          }}
          onGoLogs={(sid) => {
            console.log('Ir a registro de mediciones del sensor', sid);
          }}
        />
        <ActuatorDetailsModal
          open={openActuatorDetails}
          actuatorId={selectedActuatorId}
          onClose={() => { setOpenActuatorDetails(false); setSelectedActuatorId(null); }}
          onGoProjects={(aid) => console.log('Ir a proyectos del actuador', aid)}
          onGoLogs={(aid) => console.log('Ir a registro de envíos del actuador', aid)}
        />
        <ProjectDetailsModal
          open={openProjectDetails}
          projectId={selectedProjectId}
          onClose={() => { setOpenProjectDetails(false); setSelectedProjectId(null); }}
          onOpenSensor={openSensorFromProject}
          onOpenActuator={openActuatorFromProject}
        />
      </main>
    </div>
  );
}
