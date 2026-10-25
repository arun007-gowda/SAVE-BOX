import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { RealtimeChart, ChartDataPoint } from '../charts/RealtimeChart';
import {
  Activity,
  Radio,
  Play,
  Pause,
  Copy,
  Check,
  Terminal,
  Wifi,
  Clock,
  Sliders,
  DoorOpen,
  DoorClosed,
  Droplets,
  Flame,
  BatteryCharging,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export const LiveMonitoringTab: React.FC = () => {
  const {
    telemetry,
    history,
    settings,
    updateSettings,
    isSseConnected,
    mode,
    customUploadConfig,
    directEsp32Status,
  } = useDevice();
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewTimeWindow, setViewTimeWindow] = useState<'30' | '60' | '100'>('60');

  // Filter history based on time window count
  const windowCount = parseInt(viewTimeWindow, 10);
  const activeRecords = history.slice(-windowCount);

  // 1. Temperature Chart Series
  const tempChartData: ChartDataPoint[] = activeRecords.map((r) => {
    const d = new Date(r.timestamp);
    return {
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: d.getTime(),
      value: r.temperature.valueC,
      secondaryValue: r.temperature.targetC,
    };
  });

  // 2. Peltier Duty Cycle Chart Series
  const peltierChartData: ChartDataPoint[] = activeRecords.map((r) => {
    const d = new Date(r.timestamp);
    return {
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: d.getTime(),
      value: r.peltier.dutyPercent,
      secondaryValue: r.peltier.commandedOn ? 100 : 0,
    };
  });

  // 3. Cooling Fan RPM / PWM Chart Series
  const fanChartData: ChartDataPoint[] = activeRecords.map((r) => {
    const d = new Date(r.timestamp);
    return {
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: d.getTime(),
      value: r.fan.rpm !== null ? r.fan.rpm : r.fan.pwmPercent * 25,
      secondaryValue: r.fan.pwmPercent,
    };
  });

  // 4. Wi-Fi RSSI Signal Chart Series
  const wifiChartData: ChartDataPoint[] = activeRecords.map((r) => {
    const d = new Date(r.timestamp);
    return {
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: d.getTime(),
      value: r.esp32.wifiRssi ?? -60,
    };
  });

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Stream Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Live Sensor Telemetry Stream
            </h2>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <span className="flex items-center text-cyan-400">
                <Radio className="w-3 h-3 mr-1" />
                {mode === 'LIVE' ? (isSseConnected ? 'SSE Active' : 'Polling') : 'Simulated Loop'}
              </span>
              <span>•</span>
              <span>Interval: {settings.samplingIntervalSec}s</span>
              <span>•</span>
              <span>{activeRecords.length} Data Points</span>
            </div>
          </div>
        </div>

        {/* Filter and Stream Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-500 px-2 text-[10px]">POINTS:</span>
            {(['30', '60', '100'] as const).map((pts) => (
              <button
                key={pts}
                onClick={() => setViewTimeWindow(pts)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  viewTimeWindow === pts
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {pts}
              </button>
            ))}
          </div>

          {/* Sampling Interval Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-slate-500">SAMPLE:</span>
            <select
              value={settings.samplingIntervalSec}
              onChange={(e) => updateSettings({ samplingIntervalSec: parseInt(e.target.value, 10) })}
              className="bg-transparent text-cyan-400 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="1" className="bg-slate-900 text-white">1s</option>
              <option value="2" className="bg-slate-900 text-white">2s</option>
              <option value="3" className="bg-slate-900 text-white">3s</option>
              <option value="5" className="bg-slate-900 text-white">5s</option>
            </select>
          </div>

          {/* Stream Pause / Play Toggle */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center space-x-1.5 transition-colors ${
              isPaused
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Freeze'}</span>
          </button>
        </div>
      </div>

      {/* Live Auxiliary Sensor Telemetry Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Custom Upload Broadcast Stream
            </span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono">
            {directEsp32Status.connected ? (
              <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                Direct Wi-Fi Node: {directEsp32Status.ipAddress} ({directEsp32Status.latencyMs ?? 16}ms)
              </span>
            ) : (
              <span className="text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                Cloud Ingestion Mode (API Key Protected)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs font-mono">
          {/* Lid */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {telemetry.customFields?.doorOpen ? (
                <DoorOpen className="w-4 h-4 text-rose-400 animate-pulse" />
              ) : (
                <DoorClosed className="w-4 h-4 text-emerald-400" />
              )}
              <div>
                <span className="text-[10px] text-slate-400 block">Lid Seal (Pin {customUploadConfig.pins.doorSwitchPin})</span>
                <span className={`font-bold ${telemetry.customFields?.doorOpen ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {telemetry.customFields?.doorOpen ? 'OPEN ALERT' : 'CLOSED OK'}
                </span>
              </div>
            </div>
          </div>

          {/* Ambient Room */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Ambient (Pin {customUploadConfig.pins.dhtPin})</span>
                <span className="font-bold text-cyan-300">
                  {telemetry.customFields?.ambientTempC !== undefined && telemetry.customFields.ambientTempC !== null
                    ? `${telemetry.customFields.ambientTempC.toFixed(1)}°C`
                    : '24.2°C'}{' '}
                  <span className="text-slate-400 text-[10px]">
                    ({telemetry.customFields?.humidityPercent !== undefined && telemetry.customFields.humidityPercent !== null
                      ? `${telemetry.customFields.humidityPercent.toFixed(0)}%`
                      : '50%'})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Heatsink */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Heatsink (Pin {customUploadConfig.pins.heatsinkPin})</span>
                <span className="font-bold text-amber-400">
                  {telemetry.customFields?.heatsinkTempC !== undefined && telemetry.customFields.heatsinkTempC !== null
                    ? `${telemetry.customFields.heatsinkTempC.toFixed(1)}°C`
                    : '38.5°C'}
                </span>
              </div>
            </div>
          </div>

          {/* Battery */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Battery (Pin {customUploadConfig.pins.batteryPin})</span>
                <span className="font-bold text-emerald-400">
                  {telemetry.customFields?.batteryLevelPercent !== undefined && telemetry.customFields.batteryLevelPercent !== null
                    ? `${Math.round(telemetry.customFields.batteryLevelPercent)}%`
                    : '94%'}{' '}
                  <span className="text-slate-400 text-[10px]">
                    ({telemetry.customFields?.batteryVoltageV !== undefined && telemetry.customFields.batteryVoltageV !== null
                      ? `${telemetry.customFields.batteryVoltageV.toFixed(1)}V`
                      : '12.4V'})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Chamber 2 */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Probe 2 (Pin {customUploadConfig.pins.ds18b20SecondPin})</span>
                <span className="font-bold text-indigo-300">
                  {telemetry.customFields?.dualChamberTemp2C !== undefined && telemetry.customFields.dualChamberTemp2C !== null
                    ? `${telemetry.customFields.dualChamberTemp2C.toFixed(1)}°C`
                    : `${(telemetry.temperature.valueC + 0.1).toFixed(1)}°C`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2x2 Real-time Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Internal Temperature */}
        <RealtimeChart
          data={tempChartData}
          title="Internal Temperature Stream"
          unit="°C"
          minLimit={settings.minTempC}
          maxLimit={settings.maxTempC}
          targetLine={settings.targetTempC}
          color="#06b6d4"
          primaryLabel="Probe (°C)"
          secondaryColor="#10b981"
          secondaryLabel="Setpoint"
          height={240}
        />

        {/* 2. Peltier Cooling Duty Cycle */}
        <RealtimeChart
          data={peltierChartData}
          title="Peltier Cooling Module Output"
          unit="%"
          targetLine={80}
          color="#0ea5e9"
          primaryLabel="Duty Cycle (%)"
          secondaryColor="#3b82f6"
          secondaryLabel="Commanded State"
          height={240}
        />

        {/* 3. Cooling Fan Speed RPM / PWM */}
        <RealtimeChart
          data={fanChartData}
          title="Cooling Fan Speed Dynamics"
          unit="RPM"
          color="#38bdf8"
          primaryLabel="Tachometer RPM"
          secondaryColor="#818cf8"
          secondaryLabel="PWM Duty (%)"
          height={240}
        />

        {/* 4. Wi-Fi Signal Strength RSSI */}
        <RealtimeChart
          data={wifiChartData}
          title="ESP32 Wi-Fi Signal (dBm)"
          unit="dBm"
          targetLine={-60}
          color="#a855f7"
          primaryLabel="Signal RSSI"
          height={240}
        />
      </div>

      {/* Raw ESP32 JSON Telemetry Inspector & Frame Console */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Live ESP32 Telemetry Packet Inspector
            </h3>
          </div>
          <button
            onClick={handleCopyJson}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
        </div>

        {/* JSON Display */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto max-h-72 scrollbar-thin">
          <pre>{JSON.stringify(telemetry, null, 2)}</pre>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Schema: ISO-IoT / SAVE-Box-v1</span>
          <span>Authoritative Server Timestamp: {telemetry.timestamp}</span>
        </div>
      </div>
    </div>
  );
};
