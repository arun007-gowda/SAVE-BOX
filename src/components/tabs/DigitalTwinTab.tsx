import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import { SaveBoxTwin } from '../3d/SaveBoxTwin';
import { Box, Layers, Snowflake, Wind, Cpu, Thermometer, ShieldCheck } from 'lucide-react';

export const DigitalTwinTab: React.FC = () => {
  const { telemetry } = useDevice();

  const components = [
    {
      title: 'Peltier Thermoelectric Module',
      spec: 'TEC1-12706 (12V 5A)',
      role: 'Active solid-state heat pump transferring thermal energy from internal chamber to external heatsink via Peltier effect.',
      status: telemetry.peltier.commandedOn ? 'ACTIVE CHILL' : 'STANDBY IDLE',
      color: 'text-cyan-400',
      icon: Snowflake,
    },
    {
      title: 'Active Cooling Heatsink & Fan',
      spec: 'Extruded Aluminum + 80mm PWM Fan',
      role: 'High surface-area thermal dissipation matrix paired with 25 kHz PWM fan for forced air convection heat exhaust.',
      status: `${telemetry.fan.rpm ?? (telemetry.fan.pwmPercent * 24)} RPM`,
      color: 'text-blue-400',
      icon: Wind,
    },
    {
      title: 'Vaccine Storage Vial Chamber',
      spec: '6-Vial Stainless Tray (2°C - 8°C)',
      role: 'Insulated vaccine payload compartment with suspended aluminum racking preventing thermal bridges.',
      status: `${telemetry.temperature.valueC.toFixed(1)}°C (WHO Safe Zone)`,
      color: 'text-emerald-400',
      icon: Box,
    },
    {
      title: 'DS18B20 1-Wire Digital Probe',
      spec: 'Stainless Steel Capsule (12-bit)',
      role: 'Calibrated ±0.5°C digital temperature probe directly in contact with vial environment via GPIO 4 OneWire bus.',
      status: telemetry.temperature.sensorStatus === 'OK' ? 'COMMUNICATION OK' : 'SENSOR FAULT',
      color: 'text-emerald-400',
      icon: Thermometer,
    },
    {
      title: 'ESP32 IoT Core Microcontroller',
      spec: 'Xtensa Dual-Core 240MHz (FreeRTOS)',
      role: 'Executes autonomous bang-bang / PID cooling loops, Wi-Fi telemetry transmission, and safety fail-safes.',
      status: telemetry.esp32.online ? 'SYSTEM ONLINE' : 'OFFLINE',
      color: 'text-purple-400',
      icon: Cpu,
    },
    {
      title: 'Polyurethane Insulated Enclosure',
      spec: 'Hermetic Silicone Gasket Seal',
      role: 'Thermal barrier maintaining internal cold environment and buffering against external ambient temperature excursions.',
      status: 'HERMETIC SEAL INTACT',
      color: 'text-teal-400',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 3D Scene Hero Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center space-x-2">
            <Box className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              SAVE Box Interactive 3D Digital Twin & Anatomy
            </h2>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Drag to Rotate • Scroll to Zoom • Right-click to Pan
          </div>
        </div>

        {/* 3D Visualizer */}
        <SaveBoxTwin telemetry={telemetry} interactive={true} exploded={false} />
      </div>

      {/* Component Breakdown Cards */}
      <div>
        <div className="flex items-center space-x-2 mb-4 px-1">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            Subsystem Engineering & Component Specifications
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {components.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white font-mono">{item.title}</h4>
                        <span className="text-[11px] text-cyan-400 font-mono">{item.spec}</span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 leading-relaxed font-sans">{item.role}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-500">Live Operating Read:</span>
                  <span className={`font-semibold ${item.color}`}>{item.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
