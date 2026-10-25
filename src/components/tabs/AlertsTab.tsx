import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { AlertItem } from '../../types';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Bell,
  Volume2,
  VolumeX,
  Play,
  Check,
  Filter,
} from 'lucide-react';

export const AlertsTab: React.FC = () => {
  const { alerts, acknowledgeAlert, settings, updateSettings, triggerDemoScenario } = useDevice();
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'ALL') return true;
    return a.severity === filterSeverity;
  });

  const getSeverityBadge = (sev: AlertItem['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          icon: AlertOctagon,
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          icon: AlertTriangle,
        };
      case 'INFO':
      default:
        return {
          bg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
          icon: Info,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Alerts Overview Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Alerts & Incident Notification Center
            </h2>
            <div className="text-xs text-slate-400 font-mono">
              Real-time excursion surveillance & fault logging
            </div>
          </div>
        </div>

        {/* Audible Alert Toggle & Demonstration Trigger */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => updateSettings({ audibleAlarm: !settings.audibleAlarm })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center space-x-1.5 transition-colors ${
              settings.audibleAlarm
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {settings.audibleAlarm ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>Audible Alarm: {settings.audibleAlarm ? 'ARMED' : 'MUTED'}</span>
          </button>

          {/* Test Trigger Scenarios for Presentations */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-[10px] text-slate-500 px-2">SIMULATE:</span>
            <button
              onClick={() => triggerDemoScenario('HEAT_EXCURSION')}
              className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[11px]"
            >
              Heat Peak
            </button>
            <button
              onClick={() => triggerDemoScenario('FREEZE_EXCURSION')}
              className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-[11px]"
            >
              Sub-Zero
            </button>
            <button
              onClick={() => triggerDemoScenario('FAN_FAILURE')}
              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px]"
            >
              Fan Stall
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-mono text-slate-400">Filter Severity:</span>
          {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                filterSeverity === sev
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-slate-500">
          Showing {filteredAlerts.length} incidents
        </div>
      </div>

      {/* Incident List */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="text-sm font-bold text-white font-mono">All Systems Operating Nominally</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto font-sans">
            No active faults or temperature excursions recorded. Internal conditions conform to configured vaccine
            preservation tolerances.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const badge = getSeverityBadge(alert.severity);
            const Icon = badge.icon;
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all ${
                  alert.acknowledged
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-70'
                    : 'bg-slate-900/90 border-slate-700 shadow-xl'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2 rounded-xl border mt-0.5 shrink-0 ${badge.bg}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${badge.bg}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {new Date(alert.timestamp).toLocaleTimeString()} • {alert.source}
                        </span>
                        {alert.acknowledged && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>ACKNOWLEDGED</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white font-mono mt-1">{alert.title}</h4>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-sans">{alert.message}</p>
                    </div>
                  </div>

                  {/* Acknowledge Button */}
                  {!alert.acknowledged ? (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium transition-colors"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <div className="text-[10px] font-mono text-slate-500 shrink-0 text-right">
                      Acked at {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleTimeString() : 'Verified'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance Note */}
      <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
        <span>Protocol: WHO PQS/E003/CB01 (Cold Box Temperature Monitoring)</span>
        <span>Fault Cleared Upon Physical Hardware Recovery</span>
      </div>
    </div>
  );
};
