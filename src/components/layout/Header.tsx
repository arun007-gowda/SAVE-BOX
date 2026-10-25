import React, { useState, useEffect } from 'react';
import { useDevice } from '../../context/DeviceContext';
import {
  Wifi,
  WifiOff,
  RotateCw,
  Volume2,
  VolumeX,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Radio,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    telemetry,
    overallStatus,
    mode,
    setMode,
    isSseConnected,
    lastHeartbeat,
    settings,
    updateSettings,
    reconnect,
    triggerDemoScenario,
    directEsp32Status,
  } = useDevice();

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) +
          ' ' +
          now.toLocaleTimeString(undefined, { hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    switch (overallStatus) {
      case 'NORMAL':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          label: 'NORMAL',
          icon: ShieldCheck,
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          label: 'WARNING',
          icon: AlertTriangle,
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          label: 'CRITICAL',
          icon: AlertOctagon,
        };
      case 'OFFLINE':
      default:
        return {
          bg: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
          dot: 'bg-slate-400',
          label: 'OFFLINE',
          icon: WifiOff,
        };
    }
  };

  const statusInfo = getStatusBadge();
  const StatusIcon = statusInfo.icon;

  const secondsSinceHeartbeat = Math.round((Date.now() - lastHeartbeat.getTime()) / 1000);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 shadow-xl backdrop-blur-md">
      {/* Top Banner Notice for Mode */}
      {mode === 'DEMO' ? (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold tracking-wider uppercase text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
              Demo Simulation Mode
            </span>
            <span className="hidden sm:inline">
              Simulated thermal physics active. To monitor actual ESP32 hardware, connect via Wi-Fi with an API Key.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-amber-200/80 hidden md:inline">Quick Scenarios:</span>
            <button
              onClick={() => triggerDemoScenario('HEAT_EXCURSION')}
              className="text-[11px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-100 px-2 py-0.5 rounded transition-colors"
            >
              Excursion Test
            </button>
            <button
              onClick={() => triggerDemoScenario('DOOR_OPEN')}
              className="text-[11px] bg-rose-500/20 hover:bg-rose-500/40 text-rose-100 px-2 py-0.5 rounded transition-colors"
            >
              Lid Open
            </button>
            <button
              onClick={() => triggerDemoScenario('RESTORE_NORMAL')}
              className="text-[11px] bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-100 px-2 py-0.5 rounded transition-colors"
            >
              Reset Normal
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-cyan-500/15 border-b border-cyan-500/30 px-4 py-1 text-xs text-cyan-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold tracking-wider uppercase text-[10px] bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
              Live Hardware Mode
            </span>
            <span>
              {directEsp32Status.connected
                ? `Direct Wi-Fi Link Active to ESP32 (${directEsp32Status.ipAddress}) • Latency: ${directEsp32Status.latencyMs ?? 16}ms`
                : `Connected to Cloud Gateway. Telemetry updates directly from ESP32 node (${telemetry.deviceId}).`}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono">
              {directEsp32Status.connected
                ? 'Local Wi-Fi REST Polling'
                : isSseConnected
                ? 'SSE Live Stream Active'
                : 'Polling Fallback'}
            </span>
          </div>
        </div>
      )}

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Branding & Device Info */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-950 border border-cyan-400/40 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/25 overflow-hidden shrink-0">
            <img
              src="/assets/aistudio/image_188d8c4b.png"
              alt="SAVE Box Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center space-x-1.5 font-sans">
                <span>SAVE</span>
                <span className="text-cyan-400">Box</span>
              </h1>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                {telemetry.deviceId}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Smart Automated Vaccination Enclosure</p>
          </div>
        </div>

        {/* Center: Live Date/Time & Heartbeat */}
        <div className="hidden lg:flex items-center space-x-6 text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{currentTime}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Updated:</span>
            <span className="text-slate-200">
              {secondsSinceHeartbeat <= 2 ? 'Just now' : `${secondsSinceHeartbeat}s ago`}
            </span>
          </div>
        </div>

        {/* Right: Status Indicators & Mode Switcher */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setMode('DEMO')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                mode === 'DEMO'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Demo Mode
            </button>
            <button
              onClick={() => setMode('LIVE')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                mode === 'LIVE'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Live ESP32
            </button>
          </div>

          {/* Wi-Fi & ESP32 Link */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono ${
              telemetry.esp32.online
                ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
            title={`Wi-Fi RSSI: ${telemetry.esp32.wifiRssi ?? 'N/A'} dBm`}
          >
            {telemetry.esp32.online ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="hidden sm:inline">
              {telemetry.esp32.online ? `${telemetry.esp32.wifiRssi ?? -58} dBm` : 'OFFLINE'}
            </span>
          </div>

          {/* Overall System Status Pill */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono tracking-wide ${statusInfo.bg}`}
          >
            <div className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{statusInfo.label}</span>
          </div>

          {/* Alarm Audio Toggle */}
          <button
            onClick={() => updateSettings({ audibleAlarm: !settings.audibleAlarm })}
            className={`p-2 rounded-xl border transition-colors ${
              settings.audibleAlarm
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={settings.audibleAlarm ? 'Audible Alarm Mute' : 'Enable Audible Alarm for Excursions'}
          >
            {settings.audibleAlarm ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Reconnect / Refresh */}
          <button
            onClick={reconnect}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Reconnect & poll fresh status"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
