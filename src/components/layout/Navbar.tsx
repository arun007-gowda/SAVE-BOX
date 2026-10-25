import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Box,
  Cpu,
  Sliders,
  AlertTriangle,
  FileText,
  Key,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';

export type TabId =
  | 'overview'
  | 'monitoring'
  | 'digital-twin'
  | 'diagnostics'
  | 'controls'
  | 'alerts'
  | 'reports'
  | 'hardware';

interface NavbarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { alerts } = useDevice();
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
    { id: 'digital-twin', label: '3D Digital Twin', icon: Box },
    { id: 'diagnostics', label: 'Device Health', icon: Cpu },
    { id: 'controls', label: 'Controls', icon: Sliders },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: unacknowledgedCount },
    { id: 'reports', label: 'History & Reports', icon: FileText },
    { id: 'hardware', label: 'Hardware & API Key', icon: Key },
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-900/60 sticky top-[69px] z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white font-mono">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
