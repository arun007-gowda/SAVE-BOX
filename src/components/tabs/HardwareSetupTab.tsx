import React, { useState, useEffect } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { apiService } from '../../services/api';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  Download,
  Terminal,
  Send,
  Cpu,
  Wifi,
  ExternalLink,
  ShieldCheck,
  Sliders,
  CheckSquare,
  Square,
  Radio,
  RefreshCw,
  Zap,
  Layers,
  Thermometer,
  Wind,
  DoorClosed,
  Battery,
  AlertTriangle,
} from 'lucide-react';

export const HardwareSetupTab: React.FC = () => {
  const {
    apiKeys,
    createApiKey,
    deleteApiKey,
    refreshApiKeys,
    customUploadConfig,
    updateCustomUploadConfig,
    directEsp32Status,
    connectDirectEsp32,
    disconnectDirectEsp32,
    isDirectAutoPolling,
    toggleDirectAutoPolling,
  } = useDevice();

  // Direct ESP32 IP input
  const [directIpInput, setDirectIpInput] = useState<string>(directEsp32Status.ipAddress || '192.168.1.150');
  const [isConnectingDirect, setIsConnectingDirect] = useState<boolean>(false);

  // API Key creation state
  const [newKeyLabel, setNewKeyLabel] = useState<string>('ESP32 Vaccine Node 1');
  const [newKeyDeviceId, setNewKeyDeviceId] = useState<string>('SAVE-BOX-001');
  const [isCreatingKey, setIsCreatingKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Custom Firmware Generator State
  const [firmwareCode, setFirmwareCode] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedPio, setCopiedPio] = useState<boolean>(false);

  const handleCopyPlatformIo = () => {
    const pioConfig = `[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps =
    mathieucarbou/ESPAsyncWebServer @ ^3.6.0
    mathieucarbou/AsyncTCP @ ^3.3.2
    bblanchon/ArduinoJson @ ^7.0.0
    milesburton/DallasTemperature @ ^3.11.0
    paulstoffregen/OneWire @ ^2.3.8
    adafruit/DHT sensor library @ ^1.4.6
    adafruit/Adafruit Unified Sensor @ ^1.1.14`;
    navigator.clipboard.writeText(pioConfig);
    setCopiedPio(true);
    setTimeout(() => setCopiedPio(false), 2000);
  };

  // Test bench simulator state
  const [testTemp, setTestTemp] = useState<number>(4.9);
  const [testRssi, setTestRssi] = useState<number>(-56);
  const [testPeltier, setTestPeltier] = useState<boolean>(true);
  const [testDuty, setTestDuty] = useState<number>(85);
  const [testFanRpm, setTestFanRpm] = useState<number>(2420);
  const [testDoorOpen, setTestDoorOpen] = useState<boolean>(false);
  const [testAmbientTemp, setTestAmbientTemp] = useState<number>(27.8);
  const [testHumidity, setTestHumidity] = useState<number>(56);
  const [testBattery, setTestBattery] = useState<number>(94);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  const activeKey = customUploadConfig.activeApiKey || apiKeys[0]?.key || 'savebox_live_key_esp32_7f9c2d18';

  // Handle direct local Wi-Fi connect
  const handleConnectDirect = async () => {
    setIsConnectingDirect(true);
    await connectDirectEsp32(directIpInput.trim());
    setIsConnectingDirect(false);
  };

  // Generate Arduino Code
  const handleGenerateCustomFirmware = async () => {
    setIsLoadingCode(true);
    try {
      const code = await apiService.generateCustomSketch({
        ...customUploadConfig,
        activeApiKey: activeKey,
      });
      setFirmwareCode(code);
    } catch {
      alert('Could not generate customized firmware code.');
    } finally {
      setIsLoadingCode(false);
    }
  };

  useEffect(() => {
    // Generate initial code on first load
    handleGenerateCustomFirmware();
  }, []);

  const handleCopyFirmware = () => {
    navigator.clipboard.writeText(firmwareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadFirmware = () => {
    const element = document.createElement('a');
    const file = new Blob([firmwareCode], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `SAVE_Box_Custom_${customUploadConfig.deviceId}.ino`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Handle key creation
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    setIsCreatingKey(true);
    try {
      const created = await createApiKey(newKeyLabel, newKeyDeviceId);
      updateCustomUploadConfig({ activeApiKey: created.key });
      setNewKeyLabel('');
    } catch {
      alert('Failed to generate API Key');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Execute test telemetry dispatch directly to backend
  const handleSendTestTelemetry = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const payload: any = {
        deviceId: customUploadConfig.deviceId || 'SAVE-BOX-001',
        timestamp: new Date().toISOString(),
        esp32: {
          online: true,
          wifiRssi: testRssi,
          uptimeSeconds: 360,
          freeHeap: 238400,
          chipModel: 'ESP32 Test Harness',
          sensorCommunicationStatus: 'OK' as const,
        },
        temperature: {
          valueC: testTemp,
          targetC: 5.0,
          sensorStatus: 'OK' as const,
        },
        peltier: {
          commandedOn: testPeltier,
          confirmedOperating: testPeltier,
          dutyPercent: testPeltier ? testDuty : 0,
          mode: testPeltier ? 'ACTIVE' : 'IDLE',
          coolingTimeSeconds: 180,
        },
        fan: {
          running: true,
          rpm: testFanRpm,
          pwmPercent: 80,
          mode: 'AUTOMATIC' as const,
        },
        electrical: {
          available: true,
          inputVoltageV: 12.2,
          peltierCurrentA: testPeltier ? 4.3 : 0,
          fanPowerW: 3.8,
          totalPowerW: testPeltier ? 56.2 : 4.1,
          powerStatus: 'NORMAL' as const,
        },
        customFields: {
          doorOpen: testDoorOpen,
          ambientTempC: testAmbientTemp,
          humidityPercent: testHumidity,
          heatsinkTempC: testPeltier ? 38.4 : 29.2,
          batteryLevelPercent: testBattery,
          batteryVoltageV: Math.round((12.0 + (testBattery / 100) * 0.6) * 100) / 100,
          dualChamberTemp2C: Math.round((testTemp + 0.12) * 100) / 100,
        },
      };

      const res = await apiService.postHardwareTelemetry(activeKey, payload);
      setTestResult({ status: 'SUCCESS', response: res });
      await refreshApiKeys();
    } catch (err: any) {
      setTestResult({ status: 'ERROR', message: err.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const toggleModule = (moduleKey: keyof typeof customUploadConfig.modules) => {
    updateCustomUploadConfig({
      modules: {
        ...customUploadConfig.modules,
        [moduleKey]: !customUploadConfig.modules[moduleKey],
      },
    });
  };

  const updatePin = (pinKey: keyof typeof customUploadConfig.pins, val: number) => {
    updateCustomUploadConfig({
      pins: {
        ...customUploadConfig.pins,
        [pinKey]: val,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Direct Local Wi-Fi ESP32 Connection Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                  ESP32 Async Web Server Connection (Port 80)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                  ESPAsyncWebServer
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Connect and monitor your ESP32 directly via non-blocking asynchronous REST &amp; Server-Sent Events
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 ${
                directEsp32Status.connected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  directEsp32Status.connected ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              <span>{directEsp32Status.connected ? 'DIRECT WI-FI CONNECTED' : 'DISCONNECTED'}</span>
            </span>
          </div>
        </div>

        {/* Input Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800 items-end">
          <div className="md:col-span-6">
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              ESP32 Local Wi-Fi IP / mDNS Hostname:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 192.168.1.150 or savebox.local"
                value={directIpInput}
                onChange={(e) => setDirectIpInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              Continuous Auto-Poll:
            </label>
            <button
              type="button"
              onClick={() => toggleDirectAutoPolling(!isDirectAutoPolling)}
              disabled={!directEsp32Status.connected}
              className={`w-full py-2 px-3 rounded-xl border font-mono text-xs font-medium transition-colors ${
                isDirectAutoPolling && directEsp32Status.connected
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white disabled:opacity-40'
              }`}
            >
              {isDirectAutoPolling && directEsp32Status.connected ? 'Auto-Sync Active (2s)' : 'Auto-Sync Paused'}
            </button>
          </div>

          <div className="md:col-span-3 flex space-x-2">
            {!directEsp32Status.connected ? (
              <button
                type="button"
                onClick={handleConnectDirect}
                disabled={isConnectingDirect || !directIpInput.trim()}
                className="w-full py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConnectingDirect ? 'animate-spin' : ''}`} />
                <span>{isConnectingDirect ? 'Connecting...' : 'Connect ESP32'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={disconnectDirectEsp32}
                className="w-full py-2 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold font-mono text-xs transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Status detail strip */}
        {directEsp32Status.connected && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-mono text-emerald-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Direct Link Active to http://{directEsp32Status.ipAddress}</span>
            </div>
            <div className="flex items-center space-x-4 text-[11px] text-emerald-400/90">
              <span>Ping Latency: {directEsp32Status.latencyMs ?? 16} ms</span>
              <span>Last Synced: {directEsp32Status.lastSyncTime || 'Just now'}</span>
            </div>
          </div>
        )}

        {directEsp32Status.error && (
          <div className="mt-3 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs font-mono text-rose-300 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Connection Warning: {directEsp32Status.error}</span>
          </div>
        )}
      </div>

      {/* 2. Interactive "Customize What Everything to Upload" Sensor Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                Customize What Everything ESP32 Uploads
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                Select sensors, configure GPIO pins, set upload rate, and generate tailored C++ firmware
              </span>
            </div>
          </div>

          <button
            onClick={handleGenerateCustomFirmware}
            disabled={isLoadingCode}
            className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 transition-colors shadow-md disabled:opacity-50"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Update Firmware Sketch</span>
          </button>
        </div>

        {/* Global Connection & Upload Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800 mb-5 font-mono text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Upload Frequency:</label>
            <select
              value={customUploadConfig.uploadIntervalSeconds}
              onChange={(e) => updateCustomUploadConfig({ uploadIntervalSeconds: parseInt(e.target.value, 10) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-cyan-400 font-bold focus:outline-none"
            >
              <option value="1">Every 1 Second (High Speed)</option>
              <option value="2">Every 2 Seconds (Standard)</option>
              <option value="3">Every 3 Seconds (Recommended)</option>
              <option value="5">Every 5 Seconds (Power Saving)</option>
              <option value="10">Every 10 Seconds</option>
              <option value="30">Every 30 Seconds</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Architecture Mode:</label>
            <select
              value={customUploadConfig.connectionMethod}
              onChange={(e) => updateCustomUploadConfig({ connectionMethod: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-cyan-400 font-bold focus:outline-none"
            >
              <option value="ESP_ASYNC_WEB_SERVER">ESP32 Async Web Server (Port 80 - Non-blocking)</option>
              <option value="HYBRID">Hybrid (Async Web Server + Cloud Sync)</option>
              <option value="CLOUD_GATEWAY">Cloud Gateway (HTTP POST Only)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Wi-Fi SSID:</label>
            <input
              type="text"
              value={customUploadConfig.wifiSsid}
              onChange={(e) => updateCustomUploadConfig({ wifiSsid: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Wi-Fi Password:</label>
            <input
              type="password"
              value={customUploadConfig.wifiPassword}
              onChange={(e) => updateCustomUploadConfig({ wifiPassword: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Modular Sensor & Pin Checkbox Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Module 1: Primary DS18B20 */}
          <div
            onClick={() => toggleModule('internalTemp')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              customUploadConfig.modules.internalTemp
                ? 'bg-cyan-500/10 border-cyan-500/40'
                : 'bg-slate-950/60 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Thermometer className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-xs text-white font-mono">Primary Chamber DS18B20</span>
              </div>
              {customUploadConfig.modules.internalTemp ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Main internal cold-box thermal sensor for vaccine vial environment.
            </p>
            <div className="mt-2 flex items-center justify-between text-xs font-mono" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-500">OneWire Pin:</span>
              <input
                type="number"
                value={customUploadConfig.pins.ds18b20Pin}
                onChange={(e) => updatePin('ds18b20Pin', parseInt(e.target.value, 10))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-cyan-300 text-center font-bold"
              />
            </div>
          </div>

          {/* Module 2: Secondary Chamber DS18B20 */}
          <div
            onClick={() => toggleModule('dualChamberTemp')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              customUploadConfig.modules.dualChamberTemp
                ? 'bg-cyan-500/10 border-cyan-500/40'
                : 'bg-slate-950/60 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Thermometer className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-xs text-white font-mono">Secondary Chamber Probe</span>
              </div>
              {customUploadConfig.modules.dualChamberTemp ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Redundant probe for cross-validation and gradient checking.
            </p>
            <div className="mt-2 flex items-center justify-between text-xs font-mono" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-500">GPIO Pin:</span>
              <input
                type="number"
                value={customUploadConfig.pins.ds18b20SecondPin}
                onChange={(e) => updatePin('ds18b20SecondPin', parseInt(e.target.value, 10))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-blue-300 text-center font-bold"
              />
            </div>
          </div>

          {/* Module 3: Ambient DHT11/DHT22 */}
          <div
            onClick={() => toggleModule('ambientHumidityDHT')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              customUploadConfig.modules.ambientHumidityDHT
                ? 'bg-cyan-500/10 border-cyan-500/40'
                : 'bg-slate-950/60 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Wind className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white font-mono">Ambient Temp & Humidity</span>
              </div>
              {customUploadConfig.modules.ambientHumidityDHT ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Monitors external room temperature and relative humidity (DHT22).
            </p>
            <div className="mt-2 flex items-center justify-between text-xs font-mono" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-500">DHT Pin:</span>
              <input
                type="number"
                value={customUploadConfig.pins.dhtPin}
                onChange={(e) => updatePin('dhtPin', parseInt(e.target.value, 10))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-emerald-300 text-center font-bold"
              />
            </div>
          </div>

          {/* Module 4: Lid / Door Magnetic Switch */}
          <div
            onClick={() => toggleModule('lidDoorReedSwitch')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              customUploadConfig.modules.lidDoorReedSwitch
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-slate-950/60 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <DoorClosed className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs text-white font-mono">Lid / Door Reed Switch</span>
              </div>
              {customUploadConfig.modules.lidDoorReedSwitch ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Instant notification when cold-box lid is opened in transit.
            </p>
            <div className="mt-2 flex items-center justify-between text-xs font-mono" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-500">Pull-Up Pin:</span>
              <input
                type="number"
                value={customUploadConfig.pins.doorSwitchPin}
                onChange={(e) => updatePin('doorSwitchPin', parseInt(e.target.value, 10))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-amber-300 text-center font-bold"
              />
            </div>
          </div>

          {/* Module 5: Heatsink Thermal Probe */}
          <div
            onClick={() => toggleModule('heatsinkTempSensor')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              customUploadConfig.modules.heatsinkTempSensor
                ? 'bg-rose-500/10 border-rose-500/40'
                : 'bg-slate-950/60 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Thermometer className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-xs text-white font-mono">Heatsink Thermal Sensor</span>
              </div>
              {customUploadConfig.modules.heatsinkTempSensor ? (
                <CheckSquare className="w-4 h-4 text-rose-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Hot-side heatsink thermal protection (avoids burnout).
            </p>
            <div className="mt-2 flex items-center justify-between text-xs font-mono" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-500">Thermal Pin:</span>
              <input
                type="number"
                value={customUploadConfig.pins.heatsinkPin}
                onChange={(e) => updatePin('heatsinkPin', parseInt(e.target.value, 10))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-rose-300 text-center font-bold"
              />
            </div>
          </div>

          {/* Module 6: Battery Voltage Monitor */}
          <div
            onClick={() => toggleModule('batteryVoltageMonitor')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              customUploadConfig.modules.batteryVoltageMonitor
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-slate-950/60 border-slate-800 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Battery className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white font-mono">Battery Voltage Monitor</span>
              </div>
              {customUploadConfig.modules.batteryVoltageMonitor ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              ADC voltage divider monitoring 12V LiFePO4 battery pack level.
            </p>
            <div className="mt-2 flex items-center justify-between text-xs font-mono" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-500">ADC Pin:</span>
              <input
                type="number"
                value={customUploadConfig.pins.batteryPin}
                onChange={(e) => updatePin('batteryPin', parseInt(e.target.value, 10))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-emerald-300 text-center font-bold"
              />
            </div>
          </div>
        </div>

        {/* ESPAsyncWebServer Library & Architecture Setup Guide */}
        <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="p-1 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  ESPAsyncWebServer Engine
                </span>
                <span className="text-xs font-bold text-white font-mono">
                  High-Performance Non-Blocking Wi-Fi Server
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPlatformIo}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-mono border border-slate-700 flex items-center space-x-1.5 transition-colors"
              >
                {copiedPio ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPio ? 'Copied platformio.ini' : 'Copy PlatformIO Dependencies'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans mb-3">
              Standard Arduino <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded text-[11px] font-mono">WebServer.h</code> blocks 
              the main <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded text-[11px] font-mono">loop()</code> during network I/O, which can cause critical delays in vaccine temperature regulation. 
              With <b>ESPAsyncWebServer</b> and <b>AsyncTCP</b>, all HTTP requests and SSE streams run asynchronously in background FreeRTOS tasks—meaning 
              your DS18B20 sampling and Peltier thermal control execute uninterrupted with microsecond precision.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-cyan-400 font-bold text-[11px] mb-1">1. Required Libraries</div>
                <ul className="text-[10px] text-slate-400 space-y-1">
                  <li>• <b className="text-slate-200">ESPAsyncWebServer</b> (@mathieucarbou)</li>
                  <li>• <b className="text-slate-200">AsyncTCP</b> (@mathieucarbou)</li>
                  <li>• <b className="text-slate-200">ArduinoJson</b> (v6 or v7)</li>
                  <li>• <b className="text-slate-200">DallasTemperature &amp; OneWire</b></li>
                </ul>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-emerald-400 font-bold text-[11px] mb-1">2. Async REST Endpoints</div>
                <ul className="text-[10px] text-slate-400 space-y-1">
                  <li>• <code className="text-emerald-300">GET /api/telemetry</code> (CORS JSON)</li>
                  <li>• <code className="text-emerald-300">GET /api/status</code> (Chamber status)</li>
                  <li>• <code className="text-emerald-300">POST /api/command</code> (Live controls)</li>
                  <li>• <code className="text-emerald-300">GET /events</code> (Server-Sent Events)</li>
                </ul>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="text-purple-400 font-bold text-[11px] mb-1">3. Zero Config Access</div>
                <ul className="text-[10px] text-slate-400 space-y-1">
                  <li>• mDNS: <code className="text-purple-300">http://savebox.local</code></li>
                  <li>• Port: <code className="text-purple-300">80 (Default HTTP)</code></li>
                  <li>• Web UI: <code className="text-purple-300">GET /</code> (Micro dashboard)</li>
                  <li>• Proxy: Built-in local CORS bypass</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Generated Sketch View & Actions */}
        {firmwareCode && (
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <Code className="w-4 h-4 text-cyan-400" />
                <span className="font-bold">Tailored Arduino C++ Sketch Preview</span>
                <span className="text-[10px] text-slate-500">({firmwareCode.split('\n').length} lines)</span>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleCopyFirmware}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center space-x-1.5 transition-colors border border-slate-700"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={handleDownloadFirmware}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center space-x-1.5 transition-colors shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ino Sketch</span>
                </button>
              </div>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto scrollbar-thin">
              {firmwareCode}
            </pre>
          </div>
        )}
      </div>

      {/* 3. API Key Management */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                ESP32 Hardware API Keys
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                Authentication tokens passed in the x-api-key HTTP header
              </span>
            </div>
          </div>
        </div>

        {/* Existing Keys Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2 px-3">Label</th>
                <th className="py-2 px-3">Device ID</th>
                <th className="py-2 px-3">API Secret Key</th>
                <th className="py-2 px-3">Last Telemetry Upload</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {apiKeys.map((k) => (
                <tr key={k.key} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-semibold text-white">{k.label}</td>
                  <td className="py-3 px-3 text-cyan-400">{k.deviceId}</td>
                  <td className="py-3 px-3">
                    <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-slate-300 font-mono text-[11px]">
                      {k.key}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px]">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleTimeString() : 'Never Connected'}
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    <button
                      onClick={() => handleCopyKey(k.key)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
                    >
                      {copiedKey === k.key ? <Check className="w-3.5 h-3.5 text-emerald-400 inline" /> : <Copy className="w-3.5 h-3.5 inline" />}
                      <span className="ml-1">{copiedKey === k.key ? 'Copied' : 'Copy'}</span>
                    </button>
                    {apiKeys.length > 1 && (
                      <button
                        onClick={() => deleteApiKey(k.key)}
                        className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Live Hardware Ingestion Test Bench */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2.5 mb-3">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
              Live Hardware Ingestion Test Bench
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              Test sending customized telemetry fields directly to the server right from the browser
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800 mb-4 font-mono text-xs">
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Chamber Temp (°C):</label>
            <input
              type="number"
              step="0.1"
              value={testTemp}
              onChange={(e) => setTestTemp(parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Ambient Temp (°C):</label>
            <input
              type="number"
              step="0.1"
              value={testAmbientTemp}
              onChange={(e) => setTestAmbientTemp(parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Humidity (% RH):</label>
            <input
              type="number"
              value={testHumidity}
              onChange={(e) => setTestHumidity(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Battery Level (%):</label>
            <input
              type="number"
              value={testBattery}
              onChange={(e) => setTestBattery(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Lid / Door State:</label>
            <button
              type="button"
              onClick={() => setTestDoorOpen(!testDoorOpen)}
              className={`w-full py-1.5 rounded-lg font-bold border transition-colors ${
                testDoorOpen
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {testDoorOpen ? 'LID OPEN (Excursion)' : 'LID CLOSED (Secure)'}
            </button>
          </div>
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Peltier State:</label>
            <button
              type="button"
              onClick={() => setTestPeltier(!testPeltier)}
              className={`w-full py-1.5 rounded-lg font-bold border transition-colors ${
                testPeltier
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {testPeltier ? 'Peltier ON' : 'Peltier OFF'}
            </button>
          </div>
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Fan RPM:</label>
            <input
              type="number"
              value={testFanRpm}
              onChange={(e) => setTestFanRpm(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-slate-400 block text-[11px] mb-1">Wi-Fi RSSI (dBm):</label>
            <input
              type="number"
              value={testRssi}
              onChange={(e) => setTestRssi(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs font-mono text-slate-400">
            Target Endpoint: <span className="text-cyan-400 font-semibold">POST /api/telemetry</span>
          </div>

          <button
            onClick={handleSendTestTelemetry}
            disabled={isSendingTest}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSendingTest ? 'Sending Packet...' : 'Dispatch Customized Telemetry Packet'}</span>
          </button>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-mono ${
              testResult.status === 'SUCCESS'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="font-bold flex items-center space-x-1 mb-1">
              <Check className="w-4 h-4" />
              <span>Gateway Accepted Telemetry (HTTP 200) — Stored and Broadcasted Live!</span>
            </div>
            <pre className="text-[11px] overflow-x-auto text-slate-300">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
