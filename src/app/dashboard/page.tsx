'use client';

import { useState } from 'react';
import ElementList from '../components/ElementList';
import SensorActuatorForm from '../components/SensorActuatorForm';

export default function DashboardPage() {
  const [openSensor, setOpenSensor] = useState(false);
  const [openActuador, setOpenActuador] = useState(false);

  const proyectos = [
    { id: 'p1', name: 'BioReactor A' },
    { id: 'p2', name: 'Fermentor 200L' },
  ];
  const sensores = [
    { id: 's1', name: 'Sensor de pH' },
    { id: 's2', name: 'Temp. Reactor' },
  ];
  const actuadores = [
    { id: 'a1', name: 'Válvula PID' },
    { id: 'a2', name: 'Agitador' },
  ];

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
            onEdit={(id) => console.log('Editar proyecto', id)}
            onDelete={(id) => console.log('Eliminar proyecto', id)}
          />

          <ElementList
            title="Sensores"
            items={sensores}
            addLabel="Nuevo sensor"
            onAdd={() => setOpenSensor(true)}
            onEdit={(id) => console.log('Editar sensor', id)}
            onDelete={(id) => console.log('Eliminar sensor', id)}
          />

          <ElementList
            title="Actuadores"
            items={actuadores}
            addLabel="Nuevo actuador"
            onAdd={() => setOpenActuador(true)}
            onEdit={(id) => console.log('Editar actuador', id)}
            onDelete={(id) => console.log('Eliminar actuador', id)}
          />
        </div>
      </div>

      {/* Form como MODAL */}
      <SensorActuatorForm
        asModal
        open={openSensor}
        onRequestClose={() => setOpenSensor(false)}
        tipo="sensor"
        onCancel={() => setOpenSensor(false)}
        onSubmit={(vals) => {
          console.log('SUBMIT SENSOR', vals);
          setOpenSensor(false);
        }}
      />

      <SensorActuatorForm
        asModal
        open={openActuador}
        onRequestClose={() => setOpenActuador(false)}
        tipo="actuador"
        onCancel={() => setOpenActuador(false)}
        onSubmit={(vals) => {
          console.log('SUBMIT ACTUADOR', vals);
          setOpenActuador(false);
        }}
      />
    </div>
  );
}
