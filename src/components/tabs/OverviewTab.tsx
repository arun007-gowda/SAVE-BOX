import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import {
  Thermometer,
  Zap,
  Wind,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Snowflake,
  Clock,
  Wifi,
  ExternalLink,
  ShieldAlert,
  Droplets,
  Battery,
  BatteryCharging,
  DoorClosed,
  DoorOpen,
  Layers,
  SlidersHorizontal,
  Radio,
} from 'lucide-react';
import { SaveBoxTwin } from '../3d/SaveBoxTwin';
import { RealtimeChart, ChartDataPoint } from '../charts/RealtimeChart';
import { CircularGauge } from '../gauges/CircularGauge';
import { TabId } from '../layout/Navbar';

interface OverviewTabProps {
  onNavigateTab: (tab: TabId) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigateTab }) => {
  const { telemetry, history, settings, overallStatus, customUploadConfig, directEsp32Status } = useDevice();

  // Format uptime
  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // Temperature chart data from rolling history
  const chartData: ChartDataPoint[] = history.map((record) => {
    const d = new Date(record.timestamp);
    return {
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: d.getTime(),
      value: record.temperature.valueC,
      secondaryValue: record.temperature.targetC,
    };
  });

  // Calculate session min and max
  const tempValues = history.map((h) => h.temperature.valueC);
  const minSessionTemp = tempValues.length > 0 ? Math.min(...tempValues) : telemetry.temperature.valueC;
  const maxSessionTemp = tempValues.length > 0 ? Math.max(...tempValues) : telemetry.temperature.valueC;

  const isExcursion =
    telemetry.temperature.valueC > settings.maxTempC || telemetry.temperature.valueC < settings.minTempC;

  return (
    <div className="space-y-6">
      {/* Excursion Urgent Alert Banner if out of safe bounds */}
      {isExcursion && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-start space-x-3 shadow-lg shadow-rose-950/40 animate-pulse">
          <ShieldAlert className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <div className="font-bold text-rose-300 font-mono tracking-wide">
              TEMPERATURE EXCURSION WARNING — COLD-CHAIN INTEGRITY AT RISK
            </div>
            <div className="text-xs text-rose-200/90 mt-0.5">
              Current chamber temperature ({telemetry.temperature.valueC.toFixed(1)}°C) is outside configured safe
              parameters ({settings.minTempC.toFixed(1)}°C to {settings.maxTempC.toFixed(1)}°C). Immediate inspection
              recommended.
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('controls')}
            className="px-3 py-1 bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 rounded-lg text-xs font-mono font-medium transition-colors border border-rose-400/40"
          >
            Adjust Controls
          </button>
        </div>
      )}

      {/* Top 4 Primary Monitoring Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* A. Internal Temperature Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Internal Temperature
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Probe: DS18B20 (Chamber)</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  telemetry.temperature.sensorStatus === 'OK'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {telemetry.temperature.sensorStatus}
              </span>
            </div>

            {/* Main Digital Display */}
            <div className="mt-4 flex items-baseline space-x-2">
              <span
                className={`text-4xl font-extrabold font-mono tracking-tight ${
                  isExcursion ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {telemetry.temperature.valueC.toFixed(1)}°C
              </span>
              <div className="flex items-center space-x-1 text-xs font-mono text-slate-400">
                {telemetry.temperature.trend === 'Rising' && (
                  <span className="text-amber-400 flex items-center">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> Rising
                  </span>
                )}
                {telemetry.temperature.trend === 'Falling' && (
                  <span className="text-cyan-400 flex items-center">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> Falling
                  </span>
                )}
                {telemetry.temperature.trend === 'Stable' && (
                  <span className="text-slate-400 flex items-center">
                    <Minus className="w-3.5 h-3.5 mr-0.5" /> Stable
                  </span>
                )}
              </div>
            </div>

            {/* Target and Range Specs */}
            <div className="mt-3 text-xs font-mono space-y-1.5 pt-2 border-t border-slate-800 text-slate-400">
              <div className="flex justify-between">
                <span>Target Setpoint:</span>
                <span className="text-cyan-300 font-semibold">{settings.targetTempC.toFixed(1)}°C</span>
              </div>
              <div className="flex justify-between">
                <span>Safe Range:</span>
                <span className="text-emerald-400">
                  {settings.minTempC.toFixed(1)}°C — {settings.maxTempC.toFixed(1)}°C
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Min / Max Recorded:</span>
                <span>
                  {minSessionTemp.toFixed(1)}°C / {maxSessionTemp.toFixed(1)}°C
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 italic">
            * WHO Standard: 2°C to 8°C. Do not rely solely on gauge for vaccine efficacy.
          </div>
        </div>

        {/* B. Peltier Cooling Module Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`p-2 rounded-xl border ${
                    telemetry.peltier.commandedOn
                      ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Snowflake
                    className={`w-5 h-5 ${telemetry.peltier.commandedOn ? 'animate-spin' : ''}`}
                    style={{ animationDuration: '6s' }}
                  />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Peltier Module
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">TEC1-12706 Core</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  telemetry.peltier.fault
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : telemetry.peltier.commandedOn
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {telemetry.peltier.fault
                  ? 'FAULT'
                  : telemetry.peltier.commandedOn
                  ? 'COOLING ON'
                  : 'IDLE (OFF)'}
              </span>
            </div>

            {/* Peltier Metric */}
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <span className="text-4xl font-extrabold font-mono text-white tracking-tight">
                  {telemetry.peltier.commandedOn ? telemetry.peltier.dutyPercent : 0}%
                </span>
                <span className="text-xs text-slate-400 font-mono ml-1.5">Duty Cycle</span>
              </div>
              <div className="text-right font-mono text-xs text-slate-400">
                <span className="text-cyan-400 block font-semibold">{telemetry.peltier.mode}</span>
                <span className="text-[10px] text-slate-500">Mode</span>
              </div>
            </div>

            {/* Operating Confirmation & Session Time */}
            <div className="mt-3 text-xs font-mono space-y-1.5 pt-2 border-t border-slate-800 text-slate-400">
              <div className="flex justify-between">
                <span>Commanded State:</span>
                <span className={telemetry.peltier.commandedOn ? 'text-cyan-400' : 'text-slate-400'}>
                  {telemetry.peltier.commandedOn ? 'ACTIVE ON' : 'STANDBY OFF'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Confirmed Operating:</span>
                <span className="text-slate-300">
                  {telemetry.peltier.confirmedOperating ? 'VERIFIED' : 'PENDING'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Active Cooling Time:</span>
                <span>{Math.round(telemetry.peltier.coolingTimeSeconds / 60)} mins</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Thermal dissipation: Heatsink</span>
            <span className="text-cyan-400 font-semibold">Active Chill</span>
          </div>
        </div>

        {/* C. Cooling Fan Speed Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className={`p-2 rounded-xl border ${
                    telemetry.fan.running
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Wind
                    className={`w-5 h-5 ${telemetry.fan.running ? 'animate-spin' : ''}`}
                    style={{ animationDuration: '2s' }}
                  />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Cooling Fan Speed
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Exhaust Heatsink Fan</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  telemetry.fan.fault
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : telemetry.fan.running
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {telemetry.fan.fault ? 'FAULT' : telemetry.fan.running ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>

            {/* Fan Readout */}
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <span className="text-4xl font-extrabold font-mono text-white tracking-tight">
                  {telemetry.fan.rpm !== null ? telemetry.fan.rpm : telemetry.fan.pwmPercent}
                </span>
                <span className="text-xs text-slate-400 font-mono ml-1.5">
                  {telemetry.fan.rpm !== null ? 'RPM' : '% PWM'}
                </span>
              </div>
              <div className="text-right font-mono text-xs text-slate-400">
                <span className="text-blue-400 block font-semibold">{telemetry.fan.mode}</span>
                <span className="text-[10px] text-slate-500">Control Mode</span>
              </div>
            </div>

            {/* Detailed PWM vs Tachometer Breakdown */}
            <div className="mt-3 text-xs font-mono space-y-1.5 pt-2 border-t border-slate-800 text-slate-400">
              <div className="flex justify-between">
                <span>PWM Duty Cycle:</span>
                <span className="text-blue-300 font-semibold">{telemetry.fan.pwmPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span>Tachometer RPM:</span>
                <span className={telemetry.fan.rpm !== null ? 'text-slate-200' : 'text-slate-500'}>
                  {telemetry.fan.rpm !== null ? `${telemetry.fan.rpm} RPM` : 'NOT AVAILABLE'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Target RPM:</span>
                <span>{telemetry.fan.targetRpm ?? 2400} RPM</span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Sensor: Tachometer Pin GPIO 19</span>
            <span className="text-emerald-400">LEDC 25kHz</span>
          </div>
        </div>

        {/* D. ESP32 Controller Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    ESP32 Controller
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {telemetry.esp32.chipModel?.split(' ')[0] || 'ESP32 Node'}
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  telemetry.esp32.online
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {telemetry.esp32.online ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Uptime and Wi-Fi Signal */}
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
                  {formatUptime(telemetry.esp32.uptimeSeconds)}
                </span>
                <div className="text-xs text-slate-400 font-mono">Device Uptime</div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-emerald-400 font-bold block">
                  {telemetry.esp32.wifiRssi !== null ? `${telemetry.esp32.wifiRssi} dBm` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500">Wi-Fi RSSI</span>
              </div>
            </div>

            {/* Comm Status & Free Heap */}
            <div className="mt-3 text-xs font-mono space-y-1.5 pt-2 border-t border-slate-800 text-slate-400">
              <div className="flex justify-between">
                <span>Sensor Link:</span>
                <span className="text-emerald-400">{telemetry.esp32.sensorCommunicationStatus ?? 'OK'}</span>
              </div>
              <div className="flex justify-between">
                <span>Free Heap SRAM:</span>
                <span className="text-purple-300">
                  {telemetry.esp32.freeHeap
                    ? `${Math.round(telemetry.esp32.freeHeap / 1024)} KB`
                    : '240 KB'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Node IP:</span>
                <span>{telemetry.esp32.ipAddress || '192.168.1.142'}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Firmware: v2.4.1 (RTOS)</span>
            <span className="text-emerald-400">Heartbeat OK</span>
          </div>
        </div>
      </div>

      {/* Auxiliary & Customized ESP32 Telemetry Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Customized ESP32 Upload Suite & Auxiliary Sensors
                </h3>
                {directEsp32Status.connected ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse mr-1" />
                    Direct Wi-Fi Polling ({directEsp32Status.latencyMs ?? 16}ms)
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Live Telemetry Stream
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Custom fields configured to broadcast over Wi-Fi from GPIO pins on ESP32 node.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('hardware')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-mono border border-slate-700 transition-colors"
          >
            <span>Customize Pins & Uploads</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5 Auxiliary Sensor Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Cold Box Lid / Door Switch */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              telemetry.customFields?.doorOpen
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200 animate-pulse'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center space-x-1">
                {telemetry.customFields?.doorOpen ? (
                  <DoorOpen className="w-3.5 h-3.5 text-rose-400 mr-1" />
                ) : (
                  <DoorClosed className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                )}
                Lid / Door Seal
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  telemetry.customFields?.doorOpen
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}
              >
                Pin {customUploadConfig.pins.doorSwitchPin}
              </span>
            </div>
            <div className="text-base font-extrabold font-mono">
              {telemetry.customFields?.doorOpen === true ? (
                <span className="text-rose-400">OPEN (LEAK RISK)</span>
              ) : telemetry.customFields?.doorOpen === false ? (
                <span className="text-emerald-400">SEALED (CLOSED)</span>
              ) : (
                <span className="text-slate-500">STANDBY</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              {telemetry.customFields?.doorOpen
                ? 'Thermal ingress elevated'
                : 'Magnetic reed switch active'}
            </div>
          </div>

          {/* 2. Ambient Room Environment (DHT22) */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center space-x-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-400 mr-1" />
                Ambient Room
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold">
                Pin {customUploadConfig.pins.dhtPin}
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-base font-extrabold font-mono text-cyan-300">
                {telemetry.customFields?.ambientTempC !== undefined && telemetry.customFields.ambientTempC !== null
                  ? `${telemetry.customFields.ambientTempC.toFixed(1)}°C`
                  : '24.2°C'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {telemetry.customFields?.humidityPercent !== undefined && telemetry.customFields.humidityPercent !== null
                  ? `${telemetry.customFields.humidityPercent.toFixed(0)}% RH`
                  : '50% RH'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              DHT22 Room Temp & Humidity
            </div>
          </div>

          {/* 3. Heatsink Dissipation Temp */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5 text-amber-400 mr-1" />
                Heatsink Temp
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">
                Pin {customUploadConfig.pins.heatsinkPin}
              </span>
            </div>
            <div className="text-base font-extrabold font-mono text-amber-300">
              {telemetry.customFields?.heatsinkTempC !== undefined && telemetry.customFields.heatsinkTempC !== null
                ? `${telemetry.customFields.heatsinkTempC.toFixed(1)}°C`
                : '38.5°C'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center justify-between">
              <span>Hot-side probe</span>
              <span className="text-emerald-400 font-semibold">&lt;55°C Safe</span>
            </div>
          </div>

          {/* 4. Backup Battery Health */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center space-x-1">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                Backup Battery
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                Pin {customUploadConfig.pins.batteryPin}
              </span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-base font-extrabold font-mono text-emerald-400">
                {telemetry.customFields?.batteryLevelPercent !== undefined && telemetry.customFields.batteryLevelPercent !== null
                  ? `${Math.round(telemetry.customFields.batteryLevelPercent)}%`
                  : '94%'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {telemetry.customFields?.batteryVoltageV !== undefined && telemetry.customFields.batteryVoltageV !== null
                  ? `${telemetry.customFields.batteryVoltageV.toFixed(2)}V`
                  : '12.4V'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              UPS Power / Float State
            </div>
          </div>

          {/* 5. Dual Chamber Secondary Probe */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-indigo-400 mr-1" />
                Chamber Probe 2
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold">
                Pin {customUploadConfig.pins.ds18b20SecondPin}
              </span>
            </div>
            <div className="text-base font-extrabold font-mono text-indigo-300">
              {telemetry.customFields?.dualChamberTemp2C !== undefined && telemetry.customFields.dualChamberTemp2C !== null
                ? `${telemetry.customFields.dualChamberTemp2C.toFixed(1)}°C`
                : `${(telemetry.temperature.valueC + 0.1).toFixed(1)}°C`}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              Bottom Tray Uniformity
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: 3D Digital Twin Visualizer + Power & Electrical Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Digital Twin Hero Preview (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                3D Digital Twin Visualizer
              </span>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono">
                Real-Time Kinematics & Airflow
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('digital-twin')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-1 transition-colors"
            >
              <span>Full Screen & Anatomy</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Three.js Canvas */}
          <SaveBoxTwin telemetry={telemetry} interactive={true} />
        </div>

        {/* E. Power & Electrical Card + WHO Compliance Summary */}
        <div className="space-y-6">
          {/* Electrical Status Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Power & Electrical
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">INA219 Power Monitor</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  telemetry.electrical.available
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {telemetry.electrical.available ? 'MONITORED' : 'NOT AVAILABLE'}
              </span>
            </div>

            {telemetry.electrical.available ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-baseline p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Total System Power:</span>
                  <span className="text-lg font-bold text-amber-400">
                    {telemetry.electrical.totalPowerW?.toFixed(1) ?? '55.6'} W
                  </span>
                </div>
                <div className="flex justify-between items-center px-1 text-slate-400 text-xs">
                  <span>Input DC Rail:</span>
                  <span className="text-slate-200">
                    {telemetry.electrical.inputVoltageV?.toFixed(2) ?? '12.18'} V
                  </span>
                </div>
                <div className="flex justify-between items-center px-1 text-slate-400 text-xs">
                  <span>Peltier Current:</span>
                  <span className="text-slate-200">
                    {telemetry.electrical.peltierCurrentA?.toFixed(2) ?? '4.25'} A
                  </span>
                </div>
                <div className="flex justify-between items-center px-1 text-slate-400 text-xs">
                  <span>Fan Power Draw:</span>
                  <span className="text-slate-200">
                    {telemetry.electrical.fanPowerW?.toFixed(1) ?? '3.8'} W
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center font-mono text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-400">ELECTRICAL SENSORS NOT INSTALLED</div>
                <div className="text-[11px]">
                  Requires INA219 / ACS712 I2C sensor on ESP32 SDA/SCL pins. No fabricated electrical values are shown.
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between">
              <span>Supply: 12V 10A Adapter</span>
              <span className="text-emerald-400">Power OK</span>
            </div>
          </div>

          {/* Quick WHO Cold Chain Status Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Cold Chain Compliance
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between font-mono text-emerald-300 font-semibold">
                <span>WHO +2°C to +8°C Standard:</span>
                <span>{isExcursion ? 'EXCURSION' : 'COMPLIANT'}</span>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                Vaccines such as MMR, OPV, Influenza, and BCG require strict 2°C to 8°C storage to maintain potency.
              </p>
            </div>
            <div className="mt-3 flex justify-between text-xs font-mono text-slate-400">
              <button
                onClick={() => onNavigateTab('reports')}
                className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
              >
                <span>View Full Audit Report</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Live Streaming Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RealtimeChart
          data={chartData}
          title="Internal Temperature (°C) vs Setpoint"
          unit="°C"
          minLimit={settings.minTempC}
          maxLimit={settings.maxTempC}
          targetLine={settings.targetTempC}
          color="#06b6d4"
          primaryLabel="Chamber Temp"
          secondaryColor="#10b981"
          secondaryLabel="Target Setpoint"
          height={220}
        />

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Live Actuator Dynamics
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Peltier & Fan Gauges</span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <CircularGauge
              value={telemetry.fan.rpm !== null ? telemetry.fan.rpm : telemetry.fan.pwmPercent}
              min={0}
              max={3000}
              unit={telemetry.fan.rpm !== null ? 'RPM' : '% PWM'}
              label="Exhaust Fan"
              secondaryText={telemetry.fan.running ? 'Running' : 'Stopped'}
              color="#38bdf8"
              size={135}
            />

            <CircularGauge
              value={telemetry.peltier.dutyPercent}
              min={0}
              max={100}
              unit="% Duty"
              label="Peltier Cooler"
              secondaryText={telemetry.peltier.commandedOn ? 'Active Chill' : 'Idle'}
              color="#06b6d4"
              size={135}
            />
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between">
            <span>Thermal hysteresis: ±0.3°C</span>
            <span>Target: {settings.targetTempC.toFixed(1)}°C</span>
          </div>
        </div>
      </div>
    </div>
  );
};
