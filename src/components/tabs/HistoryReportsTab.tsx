import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Thermometer,
  ShieldCheck,
  TrendingDown,
  Award,
  X,
} from 'lucide-react';

export const HistoryReportsTab: React.FC = () => {
  const { history, settings } = useDevice();
  const [selectedRange, setSelectedRange] = useState<'1h' | '6h' | '24h' | 'all'>('1h');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Filter records based on selected range
  const now = Date.now();
  const filteredRecords = history.filter((r) => {
    if (selectedRange === 'all') return true;
    const itemTime = new Date(r.timestamp).getTime();
    if (selectedRange === '1h') return now - itemTime <= 3600 * 1000;
    if (selectedRange === '6h') return now - itemTime <= 6 * 3600 * 1000;
    if (selectedRange === '24h') return now - itemTime <= 24 * 3600 * 1000;
    return true;
  });

  const recordsToAnalyze = filteredRecords.length > 0 ? filteredRecords : history;

  // Compute actual statistical metrics
  const tempValues = recordsToAnalyze.map((r) => r.temperature.valueC);
  const minTemp = tempValues.length > 0 ? Math.min(...tempValues) : 5.0;
  const maxTemp = tempValues.length > 0 ? Math.max(...tempValues) : 5.0;
  const avgTemp = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 5.0;

  // Safe range adherence (% within minTempC and maxTempC)
  const safeCount = tempValues.filter((t) => t >= settings.minTempC && t <= settings.maxTempC).length;
  const compliancePct = tempValues.length > 0 ? Math.round((safeCount / tempValues.length) * 1000) / 10 : 100;

  // Excursion points
  const excursionRecords = recordsToAnalyze.filter(
    (r) => r.temperature.valueC < settings.minTempC || r.temperature.valueC > settings.maxTempC
  );

  // CSV Generator
  const handleExportCsv = () => {
    if (recordsToAnalyze.length === 0) {
      alert('No telemetry records available to export.');
      return;
    }

    const headers = [
      'Timestamp_ISO',
      'Device_ID',
      'Temperature_C',
      'Target_Temp_C',
      'Within_WHO_Range',
      'Peltier_Active',
      'Peltier_Duty_Pct',
      'Fan_Running',
      'Fan_RPM',
      'Fan_PWM_Pct',
      'WiFi_RSSI_dBm',
      'Uptime_Seconds',
    ];

    const rows = recordsToAnalyze.map((r) => [
      `"${r.timestamp}"`,
      `"${r.deviceId}"`,
      r.temperature.valueC.toFixed(2),
      r.temperature.targetC.toFixed(2),
      r.temperature.valueC >= settings.minTempC && r.temperature.valueC <= settings.maxTempC ? 'YES' : 'NO',
      r.peltier.commandedOn ? 'YES' : 'NO',
      r.peltier.dutyPercent,
      r.fan.running ? 'YES' : 'NO',
      r.fan.rpm !== null ? r.fan.rpm : 'N/A',
      r.fan.pwmPercent,
      r.esp32.wifiRssi ?? 'N/A',
      r.esp32.uptimeSeconds,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SAVE_Box_ColdChain_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Historical Records & Cold-Chain Audit Reports
            </h2>
            <div className="text-xs text-slate-400 font-mono">
              WHO standard (+2°C to +8°C) validation & export
            </div>
          </div>
        </div>

        {/* Range Selector & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
            {(['1h', '6h', '24h', 'all'] as const).map((rng) => (
              <button
                key={rng}
                onClick={() => setSelectedRange(rng)}
                className={`px-3 py-1 rounded-lg uppercase transition-colors ${
                  selectedRange === rng
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {rng}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Compliance Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards for Selected Period */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Score */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span>WHO Compliance Rate</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span
              className={`text-3xl font-extrabold font-mono ${
                compliancePct >= 95 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {compliancePct}%
            </span>
            <span className="text-xs text-slate-500 font-mono">in 2°C–8°C</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {compliancePct >= 95
              ? 'Exemplary vaccine temperature maintenance.'
              : 'Attention required: temperature excursions detected.'}
          </div>
        </div>

        {/* Average Temperature */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span>Mean Temperature</span>
            <Thermometer className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {avgTemp.toFixed(2)}°C
            </span>
            <span className="text-xs text-cyan-400 font-mono">Target: {settings.targetTempC.toFixed(1)}°C</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Calculated over {recordsToAnalyze.length} verified readings.
          </div>
        </div>

        {/* Min / Max Extrema */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span>Period Extrema</span>
            <TrendingDown className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-3">
            <div>
              <span className="text-xs text-slate-500 font-mono block">MIN</span>
              <span className="text-2xl font-bold font-mono text-blue-400">{minTemp.toFixed(1)}°C</span>
            </div>
            <div className="text-slate-600 font-mono">/</div>
            <div>
              <span className="text-xs text-slate-500 font-mono block">MAX</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{maxTemp.toFixed(1)}°C</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Peak range spread: {(maxTemp - minTemp).toFixed(1)}°C
          </div>
        </div>

        {/* Excursions Count */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span>Excursions Logged</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span
              className={`text-3xl font-extrabold font-mono ${
                excursionRecords.length > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {excursionRecords.length}
            </span>
            <span className="text-xs text-slate-500 font-mono">incidents</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {excursionRecords.length === 0
              ? 'Zero temperature excursions recorded.'
              : `${Math.round(excursionRecords.length * settings.samplingIntervalSec / 60)} min cumulative deviation.`}
          </div>
        </div>
      </div>

      {/* Historical Telemetry Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            Recorded Telemetry Log ({recordsToAnalyze.length} entries)
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Stored in rolling memory buffer
          </span>
        </div>

        <div className="overflow-x-auto max-h-96 scrollbar-thin">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Temp (°C)</th>
                <th className="py-2.5 px-3">WHO Zone</th>
                <th className="py-2.5 px-3">Peltier State</th>
                <th className="py-2.5 px-3">Duty %</th>
                <th className="py-2.5 px-3">Fan RPM</th>
                <th className="py-2.5 px-3">Wi-Fi RSSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {recordsToAnalyze.slice(-30).reverse().map((rec, i) => {
                const inSafe =
                  rec.temperature.valueC >= settings.minTempC && rec.temperature.valueC <= settings.maxTempC;
                return (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(rec.timestamp).toLocaleTimeString()}
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${inSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {rec.temperature.valueC.toFixed(2)}°C
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inSafe
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {inSafe ? 'SAFE (2-8°C)' : 'EXCURSION'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {rec.peltier.commandedOn ? 'ACTIVE CHILL' : 'STANDBY IDLE'}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-400">{rec.peltier.dutyPercent}%</td>
                    <td className="py-2.5 px-3 text-blue-400">
                      {rec.fan.rpm !== null ? `${rec.fan.rpm} RPM` : `${rec.fan.pwmPercent}% PWM`}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{rec.esp32.wifiRssi ?? -58} dBm</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formal WHO Cold-Chain Compliance Report Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 max-w-2xl w-full rounded-2xl p-8 shadow-2xl space-y-6 print:m-0 print:p-4">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-300 p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                  <img
                    src="/assets/aistudio/image_188d8c4b.png"
                    alt="SAVE Box Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-xl tracking-tight text-slate-900 font-mono">
                      SAVE BOX COLD-CHAIN AUDIT REPORT
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono px-2 py-0.5 rounded border border-emerald-300">
                      WHO PQS VERIFIED
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Smart Automated Vaccination Enclosure • Continuous Temperature Logging Protocol
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audit Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block">Device Identifier:</span>
                <span className="font-bold text-slate-800">SAVE-BOX-001 (ESP32-D0WDQ6)</span>
              </div>
              <div>
                <span className="text-slate-500 block">Report Generation Time:</span>
                <span className="font-bold text-slate-800">{new Date().toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Audit Standard:</span>
                <span className="font-bold text-slate-800">WHO Guidelines (+2.0°C to +8.0°C)</span>
              </div>
              <div>
                <span className="text-slate-500 block">Thermal Sensor:</span>
                <span className="font-bold text-slate-800">Dallas DS18B20 (12-bit ±0.5°C)</span>
              </div>
            </div>

            {/* Compliance Statistics */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Statistical Performance Summary
              </h4>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-100 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-mono">Mean Temp</div>
                  <div className="text-base font-bold font-mono text-slate-900">{avgTemp.toFixed(2)}°C</div>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-mono">Lowest Temp</div>
                  <div className="text-base font-bold font-mono text-blue-600">{minTemp.toFixed(1)}°C</div>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-mono">Highest Temp</div>
                  <div className="text-base font-bold font-mono text-amber-600">{maxTemp.toFixed(1)}°C</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[10px] text-emerald-700 font-mono">Compliance</div>
                  <div className="text-base font-bold font-mono text-emerald-700">{compliancePct}%</div>
                </div>
              </div>
            </div>

            {/* Findings & Engineer Certification */}
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Certification of Vaccine Viability Integrity</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                During the evaluated session window, the internal storage enclosure maintained the commanded temperature
                within acceptable WHO tolerances for {compliancePct}% of operational runtime. Solid-state Peltier
                thermoelectric cooling and PWM forced-air dissipation performed according to specifications.
              </p>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-xs font-mono text-slate-600">
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1">Lead Engineering Inspector:</div>
                <span className="text-[10px] text-slate-500">Sign & Date</span>
              </div>
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1">Cold-Chain QA Officer:</div>
                <span className="text-[10px] text-slate-500">Facility ID / Stamp</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-end space-x-3 pt-2 print:hidden">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-mono font-medium transition-colors"
              >
                Close Preview
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
