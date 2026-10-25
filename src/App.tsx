import React, { useState } from 'react';
import { DeviceProvider, useDevice } from './context/DeviceContext';
import { Header } from './components/layout/Header';
import { Navbar, TabId } from './components/layout/Navbar';
import { OverviewTab } from './components/tabs/OverviewTab';
import { LiveMonitoringTab } from './components/tabs/LiveMonitoringTab';
import { DigitalTwinTab } from './components/tabs/DigitalTwinTab';
import { DiagnosticsTab } from './components/tabs/DiagnosticsTab';
import { ControlsTab } from './components/tabs/ControlsTab';
import { AlertsTab } from './components/tabs/AlertsTab';
import { HistoryReportsTab } from './components/tabs/HistoryReportsTab';
import { HardwareSetupTab } from './components/tabs/HardwareSetupTab';
import { ShieldCheck, Cpu, Snowflake, Activity } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { telemetry, mode } = useDevice();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header */}
      <Header />

      {/* Tab Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Tab Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && <OverviewTab onNavigateTab={setActiveTab} />}
        {activeTab === 'monitoring' && <LiveMonitoringTab />}
        {activeTab === 'digital-twin' && <DigitalTwinTab />}
        {activeTab === 'diagnostics' && <DiagnosticsTab />}
        {activeTab === 'controls' && <ControlsTab />}
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'reports' && <HistoryReportsTab />}
        {activeTab === 'hardware' && <HardwareSetupTab />}
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-6 mt-12 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-slate-950 p-0.5 flex items-center justify-center overflow-hidden border border-cyan-500/40">
              <img
                src="/assets/aistudio/image_188d8c4b.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-slate-300">SAVE Box Engineering Project</span>
            <span>•</span>
            <span>ESP32 Thermoelectric Cold-Chain Node</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>WHO PQS Standard 2°C–8°C</span>
            </span>
            <span className="flex items-center space-x-1">
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
              <span>TEC1-12706 Peltier</span>
            </span>
            <span className="flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Mode: {mode}</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <DeviceProvider>
      <DashboardContent />
    </DeviceProvider>
  );
}
