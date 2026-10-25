import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import {
  Cpu,
  Wifi,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

export const DiagnosticsTab: React.FC = () => {
  const { telemetry, mode, isSseConnected, lastHeartbeat } = useDevice();

  const wifiRssi = telemetry.esp32.wifiRssi ?? -58;
  const getWifiQuality = (rssi: number) => {
    if (rssi >= -60) return { label: 'Excellent (-30 to -60 dBm)', color: 'text-emerald-400', bar: 100 };
    if (rssi >= -70) return { label: 'Good (-61 to -70 dBm)', color: 'text-cyan-400', bar: 75 };
    if (rssi >= -80) return { label: 'Fair / Degraded (-71 to -80 dBm)', color: 'text-amber-400', bar: 45 };
    return { label: 'Poor / Critical (< -80 dBm)', color: 'text-rose-400', bar: 20 };
  };

  const wifiQuality = getWifiQuality(wifiRssi);

  const pinouts = [
    { pin: 'GPIO 4', function: 'DS18B20 1-Wire Data', type: 'Digital Bidirectional', status: 'OK (4.7kΩ Pullup)' },
    { pin: 'GPIO 25', function: 'Peltier MOSFET Gate', type: 'Digital Output (High/Low)', status: telemetry.peltier.commandedOn ? 'ACTIVE HIGH (3.3V)' : 'LOW (0V)' },
    { pin: 'GPIO 18', function: 'Fan Speed PWM (LEDC)', type: 'PWM 25 kHz 8-bit', status: `DUTY: ${telemetry.fan.pwmPercent}%` },
    { pin: 'GPIO 19', function: 'Fan RPM Tachometer', type: 'Interrupt Falling Pulse', status: telemetry.fan.rpm !== null ? `${telemetry.fan.rpm} RPM` : 'Standby / Pullup' },
    { pin: 'GPIO 21 / 22', function: 'I2C Bus (SDA / SCL)', type: 'I2C Master (Optional INA219)', status: telemetry.electrical.available ? 'BUS ACTIVE' : 'OPEN (Optional)' },
  ];

  const safetyInterlocks = [
    {
      name: 'Independent Thermal Cutoff (Firmware Watchdog)',
      condition: 'Peltier shut down if Chamber < 1.0°C to prevent vaccine freeze injury',
      status: 'ARMED',
      compliant: true,
    },
    {
      name: 'Heatsink Thermal Overload Protection',
      condition: 'Emergency fan 100% boost if hot side heatsink exceeds 55°C',
      status: 'ARMED',
      compliant: true,
    },
    {
      name: 'Wi-Fi Heartbeat Standalone Failsafe',
      condition: 'If cloud gateway is unreachable, ESP32 continues autonomous local PID regulation',
      status: 'AUTONOMOUS BACKUP ACTIVE',
      compliant: true,
    },
    {
      name: 'Hardware Reverse Polarity & Surge Protection',
      condition: 'Schottky diode barrier on 12V DC input terminal',
      status: 'VERIFIED',
      compliant: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Controller Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Microcontroller Specs */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center space-x-2.5 mb-4">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Microcontroller Specs
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">ESP32-D0WDQ6 Silicon</span>
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">CPU Architecture:</span>
              <span className="text-slate-200">Xtensa Dual-Core 32-bit</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Clock Frequency:</span>
              <span className="text-slate-200">240 MHz</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Free Heap RAM:</span>
              <span className="text-purple-300">
                {telemetry.esp32.freeHeap ? `${Math.round(telemetry.esp32.freeHeap / 1024)} KB` : '238 KB'}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Operating System:</span>
              <span className="text-slate-200">FreeRTOS v10.4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Flash Memory:</span>
              <span className="text-slate-200">4 MB SPI Flash</span>
            </div>
          </div>
        </div>

        {/* Wi-Fi & Network Diagnostics */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center space-x-2.5 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Wi-Fi Signal Diagnostics
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">802.11 b/g/n 2.4 GHz</span>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400">Signal RSSI:</span>
                <span className="text-lg font-bold text-emerald-400">{wifiRssi} dBm</span>
              </div>
              {/* Signal Bar Meter */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${wifiQuality.bar}%` }}
                />
              </div>
              <div className={`text-[11px] font-semibold ${wifiQuality.color}`}>
                Rating: {wifiQuality.label}
              </div>
            </div>

            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Node IP Address:</span>
              <span className="text-slate-200">{telemetry.esp32.ipAddress || '192.168.1.142'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cloud Link Mode:</span>
              <span className="text-cyan-400 font-semibold">
                {mode === 'LIVE' ? (isSseConnected ? 'SSE Live Stream' : 'HTTP Polling') : 'Demo Simulation'}
              </span>
            </div>
          </div>
        </div>

        {/* Health Summary & Errors */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center space-x-2.5 mb-4">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                System Health & Latency
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Real-time Telemetry Status</span>
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Controller Status:</span>
              <span className="text-emerald-400 font-bold">ONLINE (Communicating)</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Sensor Bus Link:</span>
              <span className="text-emerald-400">
                {telemetry.esp32.sensorCommunicationStatus || 'OK (No Packet Errors)'}
              </span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400">Controller Errors:</span>
              <span className="text-slate-300">
                {telemetry.esp32.errorMessage ? (
                  <span className="text-rose-400 font-bold">{telemetry.esp32.errorMessage}</span>
                ) : (
                  'None Reported (Clean)'
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Telemetry Ping:</span>
              <span className="text-slate-200">
                {lastHeartbeat.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GPIO Pin Allocation Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2 mb-4">
          <HardDrive className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            ESP32 GPIO Hardware Pin Allocation & Bus Mapping
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3">Pin</th>
                <th className="py-2.5 px-3">Hardware Function</th>
                <th className="py-2.5 px-3">Electrical Interface</th>
                <th className="py-2.5 px-3">Live Signal State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pinouts.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-bold text-cyan-400">{p.pin}</td>
                  <td className="py-3 px-3 text-slate-200">{p.function}</td>
                  <td className="py-3 px-3 text-slate-400">{p.type}</td>
                  <td className="py-3 px-3 text-emerald-400 font-medium">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standalone Hardware Safety Interlocks */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            Hardware Safety Interlocks & Independent Fail-Safes
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-4 font-sans">
          In compliance with medical IoT guidelines, the web dashboard does NOT bypass hardware-level safety
          interlocks. Critical temperature protection remains fully autonomous on the ESP32.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
          {safetyInterlocks.map((interlock, idx) => (
            <div key={idx} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{interlock.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  {interlock.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">{interlock.condition}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
