import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import {
  Sliders,
  Thermometer,
  Snowflake,
  Wind,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Bell,
  Check,
} from 'lucide-react';

export const ControlsTab: React.FC = () => {
  const {
    telemetry,
    settings,
    updateSettings,
    pendingCommands,
    reconnect,
  } = useDevice();

  // Local draft states
  const [draftTargetTemp, setDraftTargetTemp] = useState<number>(settings.targetTempC);
  const [draftMinTemp, setDraftMinTemp] = useState<number>(settings.minTempC);
  const [draftMaxTemp, setDraftMaxTemp] = useState<number>(settings.maxTempC);
  const [draftFanPwm, setDraftFanPwm] = useState<number>(settings.fanPwmPercent);

  // Confirmation modals
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: () => {},
  });

  const isOffline = !telemetry.esp32.online;

  const handleApplyTemperature = () => {
    if (draftTargetTemp < draftMinTemp || draftTargetTemp > draftMaxTemp) {
      alert(`Target temperature must be within safe boundaries (${draftMinTemp}°C to ${draftMaxTemp}°C)`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Temperature Setpoint Adjustment',
      description: `Transmit new target setpoint of ${draftTargetTemp.toFixed(1)}°C (Safe Range: ${draftMinTemp.toFixed(1)}°C to ${draftMaxTemp.toFixed(1)}°C) to SAVE Box ESP32 controller?`,
      action: async () => {
        await updateSettings({
          targetTempC: draftTargetTemp,
          minTempC: draftMinTemp,
          maxTempC: draftMaxTemp,
        });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleToggleAutoCooling = () => {
    const newState = !settings.autoCooling;
    setConfirmModal({
      isOpen: true,
      title: newState ? 'Enable Autonomous Cooling Loop' : 'Disable Autonomous Cooling Loop',
      description: newState
        ? 'ESP32 will autonomously manage Peltier and PWM fan based on real-time probe readings.'
        : 'WARNING: Disabling automatic cooling will halt autonomous temperature maintenance. Internal chamber may warm up to ambient!',
      action: async () => {
        await updateSettings({ autoCooling: newState });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleToggleManualPeltier = () => {
    const newState = !settings.peltierManualOverride;
    setConfirmModal({
      isOpen: true,
      title: newState ? 'Force Peltier Output ON (Manual)' : 'Turn Peltier OFF (Manual)',
      description: newState
        ? 'Directly energizes the Peltier thermoelectric driver regardless of target temperature. Ensure exhaust fan is operating to prevent heatsink burnout!'
        : 'Cuts power to Peltier module.',
      action: async () => {
        await updateSettings({ peltierManualOverride: newState });
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleApplyFanPwm = async () => {
    await updateSettings({
      fanMode: 'MANUAL',
      fanPwmPercent: draftFanPwm,
    });
  };

  return (
    <div className="space-y-6">
      {/* Offline Warning Banner if device unreachable */}
      {isOffline && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center space-x-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">CONTROLS LOCKED:</span> The ESP32 device node is currently offline or unreachable.
            Remote commands cannot be safely verified.
          </div>
        </div>
      )}

      {/* Main Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Temperature Setpoint & Threshold Limits */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Temperature Setpoint & Safety Boundaries
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  WHO Cold-Chain Target (+2°C to +8°C)
                </span>
              </div>
            </div>

            {/* Target Temperature Slider */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-baseline text-xs font-mono text-slate-300 mb-2">
                  <span>Target Chamber Setpoint:</span>
                  <span className="text-lg font-bold text-cyan-400">{draftTargetTemp.toFixed(1)}°C</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="8.0"
                  step="0.1"
                  disabled={isOffline}
                  value={draftTargetTemp}
                  onChange={(e) => setDraftTargetTemp(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>2.0°C (Freeze Threshold)</span>
                  <span>5.0°C (Default)</span>
                  <span>8.0°C (Heat Threshold)</span>
                </div>
              </div>

              {/* Threshold Bounds (Min & Max Acceptable) */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">
                    Min Safe Limit (°C):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="4.0"
                    disabled={isOffline}
                    value={draftMinTemp}
                    onChange={(e) => setDraftMinTemp(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">
                    Max Safe Limit (°C):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="6.0"
                    max="10.0"
                    disabled={isOffline}
                    value={draftMaxTemp}
                    onChange={(e) => setDraftMaxTemp(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans">
                Adjust according to specific vaccine storage protocol (e.g. mRNA COVID-19 vaccines vs standard lyophilized measles or rabies).
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleApplyTemperature}
              disabled={isOffline}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Transmit Setpoint Update
            </button>
          </div>
        </div>

        {/* Card 2: Peltier & Autonomous Cooling Controls */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Snowflake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Autonomous Cooling & Peltier Actuator
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Hysteresis & Bang-Bang Control
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Auto Cooling Toggle */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white font-mono">
                    Autonomous Closed-Loop Cooling
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ESP32 automatically triggers Peltier & PWM fan to hold target
                  </div>
                </div>
                <button
                  onClick={handleToggleAutoCooling}
                  disabled={isOffline}
                  className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${
                    settings.autoCooling ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'
                  } disabled:opacity-50`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Manual Peltier Override */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white font-mono">
                    Manual Peltier Power Override
                  </div>
                  <div className="text-[11px] text-amber-400/80">
                    Bypasses auto loop for bench testing (Max 15 min safety timeout)
                  </div>
                </div>
                <button
                  onClick={handleToggleManualPeltier}
                  disabled={isOffline || settings.autoCooling}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-colors ${
                    settings.peltierManualOverride
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {settings.peltierManualOverride ? 'FORCED ON' : 'FORCE ON'}
                </button>
              </div>

              {/* Cooling Fan Speed Slider */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-bold text-white font-mono">
                      Cooling Fan PWM Control
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Mode: {settings.fanMode}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-blue-400 font-mono">{draftFanPwm}%</span>
                </div>

                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  disabled={isOffline}
                  value={draftFanPwm}
                  onChange={(e) => setDraftFanPwm(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-400 disabled:opacity-50"
                />

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => updateSettings({ fanMode: 'AUTOMATIC' })}
                    disabled={isOffline}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                      settings.fanMode === 'AUTOMATIC'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Auto Mode
                  </button>
                  <button
                    onClick={handleApplyFanPwm}
                    disabled={isOffline}
                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-mono font-semibold transition-colors disabled:opacity-50"
                  >
                    Set Manual PWM
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
            <span>Hardware Watchdog: Armed</span>
            <button
              onClick={reconnect}
              className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Poll Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Command Queue & Real-time Acknowledgment Log */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2 mb-3">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            Dispatched Hardware Command Queue & Verification Log
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-4 font-sans">
          To maintain industrial integrity, the dashboard never assumes a command succeeded until the ESP32
          firmware positively acknowledges it over the network.
        </p>

        {pendingCommands.length === 0 ? (
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs font-mono text-slate-500">
            No commands currently dispatched in this session.
          </div>
        ) : (
          <div className="space-y-2">
            {pendingCommands.slice(-5).map((cmd) => (
              <div
                key={cmd.id}
                className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <div className="font-bold text-slate-200">{cmd.type}</div>
                  <div className="text-[10px] text-slate-400">
                    ID: {cmd.id} • Payload: {JSON.stringify(cmd.payload)}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 ${
                      cmd.status === 'ACKNOWLEDGED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : cmd.status === 'PENDING'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {cmd.status === 'ACKNOWLEDGED' && <Check className="w-3 h-3" />}
                    {cmd.status === 'PENDING' && <RotateCw className="w-3 h-3 animate-spin" />}
                    <span>{cmd.status}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-cyan-400">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <h3 className="text-base font-bold text-white font-mono">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{confirmModal.description}</p>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-colors shadow-lg shadow-cyan-500/20"
              >
                Confirm & Transmit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
