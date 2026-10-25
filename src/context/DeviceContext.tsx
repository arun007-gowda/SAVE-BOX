import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertItem,
  ApiKeyRecord,
  ControlSettings,
  CustomUploadConfig,
  DeviceCommand,
  DirectEsp32Status,
  OperatingMode,
  SystemStatus,
  TelemetryRecord,
} from '../types';
import { apiService } from '../services/api';

interface DeviceContextType {
  mode: OperatingMode;
  setMode: (mode: OperatingMode) => void;
  telemetry: TelemetryRecord;
  history: TelemetryRecord[];
  settings: ControlSettings;
  overallStatus: SystemStatus;
  alerts: AlertItem[];
  apiKeys: ApiKeyRecord[];
  pendingCommands: DeviceCommand[];
  isSseConnected: boolean;
  lastHeartbeat: Date;
  customUploadConfig: CustomUploadConfig;
  updateCustomUploadConfig: (newConfig: Partial<CustomUploadConfig>) => void;
  directEsp32Status: DirectEsp32Status;
  connectDirectEsp32: (ipOrUrl: string) => Promise<boolean>;
  disconnectDirectEsp32: () => void;
  isDirectAutoPolling: boolean;
  toggleDirectAutoPolling: (active: boolean) => void;
  updateSettings: (newSettings: Partial<ControlSettings>) => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  createApiKey: (label: string, deviceId?: string) => Promise<ApiKeyRecord>;
  deleteApiKey: (key: string) => Promise<void>;
  refreshApiKeys: () => Promise<void>;
  reconnect: () => void;
  triggerDemoScenario: (scenario: 'HEAT_EXCURSION' | 'FREEZE_EXCURSION' | 'FAN_FAILURE' | 'SENSOR_DISCONNECT' | 'RESTORE_NORMAL' | 'DOOR_OPEN' | 'DOOR_CLOSE' | 'BATTERY_LOW') => void;
}

const defaultCustomUploadConfig: CustomUploadConfig = {
  uploadIntervalSeconds: 3,
  connectionMethod: 'ESP_ASYNC_WEB_SERVER',
  directEsp32Url: '192.168.1.150',
  activeApiKey: 'savebox_live_key_esp32_7f9c2d18',
  wifiSsid: 'MyVaccineClinic_WiFi',
  wifiPassword: 'ClinicSecureKey',
  deviceId: 'SAVE-BOX-001',
  modules: {
    internalTemp: true,
    dualChamberTemp: false,
    ambientHumidityDHT: true,
    lidDoorReedSwitch: true,
    heatsinkTempSensor: true,
    batteryVoltageMonitor: true,
    peltierPwmControl: true,
    fanSpeedTachometer: true,
    oledLocalDisplay: false,
    buzzerAlarm: false,
  },
  pins: {
    ds18b20Pin: 4,
    ds18b20SecondPin: 5,
    dhtPin: 14,
    doorSwitchPin: 27,
    heatsinkPin: 33,
    batteryPin: 34,
    peltierPin: 25,
    fanPwmPin: 18,
    fanTachPin: 19,
    buzzerPin: 13,
    oledSdaPin: 21,
    oledSclPin: 22,
  },
};

const defaultSettings: ControlSettings = {
  targetTempC: 5.0,
  minTempC: 2.0,
  maxTempC: 8.0,
  autoCooling: true,
  peltierManualOverride: false,
  fanMode: 'AUTOMATIC',
  fanPwmPercent: 75,
  samplingIntervalSec: 2,
  audibleAlarm: false,
};

function createInitialTelemetry(mode: OperatingMode): TelemetryRecord {
  return {
    deviceId: 'SAVE-BOX-001',
    timestamp: new Date().toISOString(),
    source: mode === 'LIVE' ? 'ESP32_HARDWARE' : 'DEMO_SIMULATION',
    esp32: {
      online: true,
      wifiRssi: -58,
      uptimeSeconds: 7320,
      freeHeap: 238496,
      chipModel: 'ESP32-D0WDQ6-V3 (Dual Core 240MHz)',
      ipAddress: '192.168.1.142',
      sensorCommunicationStatus: 'OK',
      errorMessage: null,
    },
    temperature: {
      valueC: 4.8,
      targetC: 5.0,
      minAcceptableC: 2.0,
      maxAcceptableC: 8.0,
      sensorStatus: 'OK',
      trend: 'Stable',
    },
    peltier: {
      commandedOn: true,
      confirmedOperating: true,
      dutyPercent: 70,
      mode: 'ACTIVE',
      fault: false,
      coolingTimeSeconds: 3120,
    },
    fan: {
      running: true,
      rpm: 2380,
      pwmPercent: 75,
      targetRpm: 2400,
      mode: 'AUTOMATIC',
      fault: false,
      tachometerSupported: true,
    },
    electrical: {
      available: true,
      inputVoltageV: 12.18,
      peltierCurrentA: 4.25,
      fanPowerW: 3.84,
      totalPowerW: 55.6,
      powerStatus: 'NORMAL',
    },
    customFields: {
      doorOpen: false,
      ambientTempC: 28.4,
      humidityPercent: 55,
      heatsinkTempC: 36.2,
      batteryLevelPercent: 96,
      batteryVoltageV: 12.38,
      dualChamberTemp2C: 4.9,
    },
  };
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<OperatingMode>('DEMO');
  const [settings, setSettings] = useState<ControlSettings>(defaultSettings);
  const [customUploadConfig, setCustomUploadConfig] = useState<CustomUploadConfig>(defaultCustomUploadConfig);
  const [telemetry, setTelemetry] = useState<TelemetryRecord>(() => createInitialTelemetry('DEMO'));
  const [history, setHistory] = useState<TelemetryRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [pendingCommands, setPendingCommands] = useState<DeviceCommand[]>([]);
  const [isSseConnected, setIsSseConnected] = useState<boolean>(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date>(new Date());

  // Direct ESP32 Wi-Fi Local Connection State
  const [directEsp32Status, setDirectEsp32Status] = useState<DirectEsp32Status>({
    connected: false,
    ipAddress: '192.168.1.150',
    latencyMs: null,
    lastSyncTime: null,
    error: null,
  });
  const [isDirectAutoPolling, setIsDirectAutoPolling] = useState<boolean>(false);

  // Demo simulation state refs
  const demoTempRef = useRef<number>(4.8);
  const demoPeltierRef = useRef<boolean>(true);
  const demoFanDutyRef = useRef<number>(75);
  const demoDoorOpenRef = useRef<boolean>(false);
  const demoBatteryRef = useRef<number>(96);
  const demoFaultRef = useRef<{ fanFault: boolean; sensorFault: boolean }>({ fanFault: false, sensorFault: false });

  // Play audio alert if enabled
  const playAlertSound = useCallback(() => {
    if (!settings.audibleAlarm) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // AudioContext policy
    }
  }, [settings.audibleAlarm]);

  // Determine overall system status
  const overallStatus: SystemStatus = React.useMemo(() => {
    if (!telemetry.esp32.online) return 'OFFLINE';
    if (
      telemetry.temperature.valueC > settings.maxTempC ||
      telemetry.temperature.valueC < settings.minTempC ||
      telemetry.temperature.sensorStatus !== 'OK' ||
      telemetry.peltier.fault ||
      telemetry.fan.fault
    ) {
      return 'CRITICAL';
    }
    if (
      telemetry.temperature.valueC > settings.maxTempC - 0.5 ||
      telemetry.temperature.valueC < settings.minTempC + 0.5 ||
      (telemetry.esp32.wifiRssi && telemetry.esp32.wifiRssi < -78)
    ) {
      return 'WARNING';
    }
    return 'NORMAL';
  }, [telemetry, settings.maxTempC, settings.minTempC]);

  // Fetch API keys on mount
  const refreshApiKeys = useCallback(async () => {
    try {
      const data = await apiService.fetchApiKeys();
      setApiKeys(data.keys);
    } catch (e) {
      console.warn('Could not load API keys from server', e);
    }
  }, []);

  const createApiKey = async (label: string, deviceId = 'SAVE-BOX-001') => {
    const key = await apiService.createApiKey(label, deviceId);
    await refreshApiKeys();
    return key;
  };

  const deleteApiKey = async (key: string) => {
    await apiService.deleteApiKey(key);
    await refreshApiKeys();
  };

  useEffect(() => {
    refreshApiKeys();
  }, [refreshApiKeys]);

  // Handle Live Mode SSE Stream
  useEffect(() => {
    if (mode !== 'LIVE') return;

    let eventSource: EventSource | null = null;
    let fallbackPollInterval: any = null;

    const connectSse = () => {
      try {
        eventSource = new EventSource('/api/stream');
        eventSource.onopen = () => {
          setIsSseConnected(true);
        };
        eventSource.addEventListener('telemetry', (e) => {
          try {
            const data: TelemetryRecord = JSON.parse(e.data);
            setTelemetry(data);
            setLastHeartbeat(new Date());
            setHistory((prev) => [...prev.slice(-99), data]);
          } catch (err) {
            console.error('Failed to parse SSE telemetry', err);
          }
        });
        eventSource.addEventListener('command_ack', (e) => {
          try {
            const ackCmd: DeviceCommand = JSON.parse(e.data);
            setPendingCommands((prev) =>
              prev.map((c) => (c.id === ackCmd.id ? { ...c, status: 'ACKNOWLEDGED' } : c))
            );
          } catch (err) {
            console.error('Failed to parse SSE command_ack', err);
          }
        });
        eventSource.onerror = () => {
          setIsSseConnected(false);
          eventSource?.close();
        };
      } catch (err) {
        setIsSseConnected(false);
      }
    };

    connectSse();

    // Fallback polling for latest state
    fallbackPollInterval = setInterval(async () => {
      try {
        const { telemetry: latest } = await apiService.fetchTelemetryLatest();
        if (latest) {
          setTelemetry(latest);
          setLastHeartbeat(new Date());
        }
      } catch {
        // ignore
      }
    }, 4000);

    return () => {
      eventSource?.close();
      clearInterval(fallbackPollInterval);
      setIsSseConnected(false);
    };
  }, [mode]);

  // Demo Mode Simulation Loop
  useEffect(() => {
    if (mode !== 'DEMO') return;

    const interval = setInterval(() => {
      // Thermal physics calculations
      const ambientTemp = 28.5; // °C ambient room temperature
      const target = settings.targetTempC;
      let current = demoTempRef.current;
      let peltier = demoPeltierRef.current;
      let fanDuty = demoFanDutyRef.current;

      if (settings.autoCooling && !demoFaultRef.current.sensorFault) {
        if (current > target + 0.3) {
          peltier = true;
          fanDuty = 85;
        } else if (current < target - 0.25) {
          peltier = false;
          fanDuty = 35;
        }
      } else if (settings.peltierManualOverride) {
        peltier = true;
      } else {
        peltier = false;
      }

      if (settings.fanMode === 'MANUAL') {
        fanDuty = settings.fanPwmPercent;
      }

      // Temperature delta
      if (demoFaultRef.current.fanFault) {
        fanDuty = 0;
        // Thermal runaway without fan heat dissipation
        current += 0.22;
      } else if (peltier) {
        // Cooling active: exponential approach to chilling setpoint
        const coolingEfficiency = (fanDuty / 100) * 0.12;
        current -= coolingEfficiency;
      } else {
        // Natural heat ingress from insulated enclosure
        const heatIngress = (ambientTemp - current) * 0.007;
        current += heatIngress;
      }

      // Rapid heat ingress if lid/door is open
      if (demoDoorOpenRef.current) {
        current += 0.35;
      }

      // Add realistic microscopic sensor noise (+-0.03°C)
      const noise = (Math.random() - 0.5) * 0.05;
      current = Math.round((current + noise) * 100) / 100;
      demoTempRef.current = current;
      demoPeltierRef.current = peltier;
      demoFanDutyRef.current = fanDuty;

      const trend = current > target + 0.1 ? 'Rising' : current < target - 0.1 ? 'Falling' : 'Stable';
      const rpm = fanDuty > 0 && !demoFaultRef.current.fanFault ? Math.round(fanDuty * 32.5 + (Math.random() - 0.5) * 40) : 0;
      const peltierCurrent = peltier ? Math.round((4.1 + (Math.random() - 0.5) * 0.15) * 100) / 100 : 0;
      const totalPower = peltier ? Math.round((peltierCurrent * 12.1 + (fanDuty / 100) * 4.2) * 10) / 10 : 3.2;

      const simulatedTelemetry: TelemetryRecord = {
        deviceId: customUploadConfig.deviceId || 'SAVE-BOX-001',
        timestamp: new Date().toISOString(),
        source: 'DEMO_SIMULATION',
        esp32: {
          online: true,
          wifiRssi: Math.round(-58 + (Math.random() - 0.5) * 6),
          uptimeSeconds: Math.floor(Date.now() / 1000) % 86400 + 12000,
          freeHeap: 236800 + Math.round((Math.random() - 0.5) * 1000),
          chipModel: 'ESP32-D0WDQ6-V3 (Dual Core 240MHz)',
          ipAddress: directEsp32Status.connected ? directEsp32Status.ipAddress : '192.168.1.142',
          sensorCommunicationStatus: demoFaultRef.current.sensorFault ? 'FAULT' : 'OK',
          errorMessage: demoFaultRef.current.sensorFault ? 'DS18B20 OneWire CRC Checksum Failed' : null,
        },
        temperature: {
          valueC: demoFaultRef.current.sensorFault ? -127.0 : current,
          targetC: settings.targetTempC,
          minAcceptableC: settings.minTempC,
          maxAcceptableC: settings.maxTempC,
          sensorStatus: demoFaultRef.current.sensorFault ? 'FAULT' : 'OK',
          trend,
        },
        peltier: {
          commandedOn: peltier,
          confirmedOperating: peltier,
          dutyPercent: peltier ? 85 : 0,
          mode: peltier ? 'ACTIVE' : 'IDLE',
          fault: demoFaultRef.current.fanFault,
          coolingTimeSeconds: 4120,
        },
        fan: {
          running: fanDuty > 0 && !demoFaultRef.current.fanFault,
          rpm: demoFaultRef.current.fanFault ? 0 : rpm,
          pwmPercent: fanDuty,
          targetRpm: 2400,
          mode: settings.fanMode,
          fault: demoFaultRef.current.fanFault,
          tachometerSupported: true,
        },
        electrical: {
          available: true,
          inputVoltageV: Math.round((12.15 + (Math.random() - 0.5) * 0.1) * 100) / 100,
          peltierCurrentA: peltierCurrent,
          fanPowerW: Math.round((fanDuty / 100) * 3.8 * 10) / 10,
          totalPowerW: totalPower,
          powerStatus: 'NORMAL',
        },
        customFields: {
          doorOpen: demoDoorOpenRef.current,
          ambientTempC: Math.round((28.2 + (Math.random() - 0.5) * 0.4) * 10) / 10,
          humidityPercent: Math.round(54 + (Math.random() - 0.5) * 2),
          heatsinkTempC: peltier
            ? Math.round((38.5 + (Math.random() - 0.5) * 0.6) * 10) / 10
            : Math.round((29.0 + (Math.random() - 0.5) * 0.4) * 10) / 10,
          batteryLevelPercent: demoBatteryRef.current,
          batteryVoltageV: Math.round((12.1 + (demoBatteryRef.current / 100) * 0.5) * 100) / 100,
          dualChamberTemp2C: Math.round((current + 0.15 + (Math.random() - 0.5) * 0.04) * 100) / 100,
        },
      };

      setTelemetry(simulatedTelemetry);
      setLastHeartbeat(new Date());
      setHistory((prev) => [...prev.slice(-99), simulatedTelemetry]);

      // Check alerts in Demo Mode
      if (simulatedTelemetry.temperature.valueC > settings.maxTempC && !demoFaultRef.current.sensorFault) {
        playAlertSound();
        setAlerts((prev) => {
          if (prev.length > 0 && prev[0].title.includes('High Temperature')) return prev;
          return [
            {
              id: 'alert_' + Date.now(),
              timestamp: new Date().toISOString(),
              severity: 'CRITICAL',
              title: 'High Temperature Excursion (>8.0°C)',
              message: `SAVE Box chamber temperature is ${current.toFixed(1)}°C. Exceeds WHO vaccine safe boundary of ${settings.maxTempC}°C.`,
              source: 'TEMPERATURE',
              acknowledged: false,
            },
            ...prev.slice(0, 49),
          ];
        });
      }

      if (demoDoorOpenRef.current) {
        setAlerts((prev) => {
          if (prev.some((a) => a.title.includes('Door Open'))) return prev;
          return [
            {
              id: 'alert_door_' + Date.now(),
              timestamp: new Date().toISOString(),
              severity: 'CRITICAL',
              title: 'Cold Box Lid / Door Open Detected',
              message: 'Magnetic reed switch indicates cold box lid is OPEN! Thermal exposure in progress.',
              source: 'TEMPERATURE',
              acknowledged: false,
            },
            ...prev.slice(0, 49),
          ];
        });
      }
    }, settings.samplingIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [mode, settings, playAlertSound]);

  // Demo scenarios for engineering presentations and testing
  const triggerDemoScenario = (
    scenario:
      | 'HEAT_EXCURSION'
      | 'FREEZE_EXCURSION'
      | 'FAN_FAILURE'
      | 'SENSOR_DISCONNECT'
      | 'RESTORE_NORMAL'
      | 'DOOR_OPEN'
      | 'DOOR_CLOSE'
      | 'BATTERY_LOW'
  ) => {
    if (scenario === 'HEAT_EXCURSION') {
      demoTempRef.current = 11.4;
      demoPeltierRef.current = false;
      setAlerts((prev) => [
        {
          id: 'alert_' + Date.now(),
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          title: 'Manual Test: Heat Excursion (+11.4°C)',
          message: 'Simulation triggered door opening / cooling breakdown scenario.',
          source: 'TEMPERATURE',
          acknowledged: false,
        },
        ...prev,
      ]);
    } else if (scenario === 'FREEZE_EXCURSION') {
      demoTempRef.current = -0.5;
      setAlerts((prev) => [
        {
          id: 'alert_' + Date.now(),
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          title: 'Manual Test: Sub-Zero Freeze Risk (-0.5°C)',
          message: 'Vaccine freezing risk! Liquid crystallization may denature active antigens.',
          source: 'TEMPERATURE',
          acknowledged: false,
        },
        ...prev,
      ]);
    } else if (scenario === 'FAN_FAILURE') {
      demoFaultRef.current.fanFault = true;
      setAlerts((prev) => [
        {
          id: 'alert_' + Date.now(),
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          title: 'Cooling Fan Stall / Tachometer 0 RPM',
          message: 'Heatsink airflow compromised. Peltier module at risk of thermal overload.',
          source: 'FAN',
          acknowledged: false,
        },
        ...prev,
      ]);
    } else if (scenario === 'SENSOR_DISCONNECT') {
      demoFaultRef.current.sensorFault = true;
      setAlerts((prev) => [
        {
          id: 'alert_' + Date.now(),
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          title: 'DS18B20 Probe Disconnected (GPIO 4)',
          message: 'No response from Dallas 1-Wire temperature sensor probe.',
          source: 'ESP32',
          acknowledged: false,
        },
        ...prev,
      ]);
    } else if (scenario === 'DOOR_OPEN') {
      demoDoorOpenRef.current = true;
      setAlerts((prev) => [
        {
          id: 'alert_door_' + Date.now(),
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          title: 'Cold Box Lid / Door Opened',
          message: 'Lid opened by operator. External ambient heat ingress accelerates chamber warmup.',
          source: 'TEMPERATURE',
          acknowledged: false,
        },
        ...prev,
      ]);
    } else if (scenario === 'DOOR_CLOSE') {
      demoDoorOpenRef.current = false;
    } else if (scenario === 'BATTERY_LOW') {
      demoBatteryRef.current = 14;
      setAlerts((prev) => [
        {
          id: 'alert_batt_' + Date.now(),
          timestamp: new Date().toISOString(),
          severity: 'WARNING',
          title: 'Backup Battery Low (14%)',
          message: 'UPS Battery critically depleted. Connect main 12V DC power.',
          source: 'ELECTRICAL',
          acknowledged: false,
        },
        ...prev,
      ]);
    } else if (scenario === 'RESTORE_NORMAL') {
      demoFaultRef.current = { fanFault: false, sensorFault: false };
      demoDoorOpenRef.current = false;
      demoBatteryRef.current = 96;
      demoTempRef.current = 5.0;
      demoPeltierRef.current = true;
      demoFanDutyRef.current = 75;
      setAlerts((prev) => [
        {
          id: 'alert_' + Date.now(),
          timestamp: new Date().toISOString(),
          severity: 'INFO',
          title: 'System Restored to Normal Operation',
          message: 'All sensors and actuators cleared and returned to safe autonomous setpoints.',
          source: 'ESP32',
          acknowledged: true,
        },
        ...prev,
      ]);
    }
  };

  // Direct ESP32 Connection Handlers
  const connectDirectEsp32 = async (ipOrUrl: string): Promise<boolean> => {
    try {
      setDirectEsp32Status((prev) => ({ ...prev, ipAddress: ipOrUrl, error: null }));
      const result = await apiService.pollDirectEsp32(ipOrUrl);
      if (result.success && result.telemetry) {
        setDirectEsp32Status({
          connected: true,
          ipAddress: ipOrUrl,
          latencyMs: result.latencyMs,
          lastSyncTime: new Date().toLocaleTimeString(),
          error: null,
        });
        setTelemetry(result.telemetry);
        setLastHeartbeat(new Date());
        setMode('LIVE');
        setIsDirectAutoPolling(true);
        return true;
      }
      return false;
    } catch (err: any) {
      setDirectEsp32Status((prev) => ({
        ...prev,
        connected: false,
        error: err.message || 'Connection failed',
      }));
      return false;
    }
  };

  const disconnectDirectEsp32 = () => {
    setDirectEsp32Status((prev) => ({ ...prev, connected: false, error: null }));
    setIsDirectAutoPolling(false);
  };

  const toggleDirectAutoPolling = (active: boolean) => {
    setIsDirectAutoPolling(active);
  };

  // Automatic Polling Loop for Direct ESP32 Wi-Fi Node
  useEffect(() => {
    if (!directEsp32Status.connected || !isDirectAutoPolling || mode !== 'LIVE') return;

    const interval = setInterval(async () => {
      try {
        const res = await apiService.pollDirectEsp32(directEsp32Status.ipAddress);
        if (res.success && res.telemetry) {
          setTelemetry(res.telemetry);
          setLastHeartbeat(new Date());
          setHistory((prev) => [...prev.slice(-99), res.telemetry]);
          setDirectEsp32Status((prev) => ({
            ...prev,
            latencyMs: res.latencyMs,
            lastSyncTime: new Date().toLocaleTimeString(),
            error: null,
          }));
        }
      } catch (err: any) {
        setDirectEsp32Status((prev) => ({
          ...prev,
          error: `Heartbeat lost: ${err.message}`,
        }));
      }
    }, settings.samplingIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [directEsp32Status.connected, directEsp32Status.ipAddress, isDirectAutoPolling, mode, settings.samplingIntervalSec]);

  const updateCustomUploadConfig = (newConfig: Partial<CustomUploadConfig>) => {
    setCustomUploadConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const updateSettings = async (newSettings: Partial<ControlSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));

    // If target temp changed, dispatch command
    if (newSettings.targetTempC !== undefined) {
      try {
        const cmd = await apiService.sendCommand('SAVE-BOX-001', 'SET_TARGET_TEMP', {
          targetC: newSettings.targetTempC,
        });
        setPendingCommands((prev) => [...prev, cmd]);
      } catch (err) {
        console.warn('Could not queue SET_TARGET_TEMP command', err);
      }
    }

    if (newSettings.autoCooling !== undefined) {
      try {
        const cmd = await apiService.sendCommand('SAVE-BOX-001', 'SET_AUTO_COOLING', {
          enabled: newSettings.autoCooling,
        });
        setPendingCommands((prev) => [...prev, cmd]);
      } catch (err) {
        console.warn('Could not queue SET_AUTO_COOLING command', err);
      }
    }

    if (newSettings.fanPwmPercent !== undefined) {
      try {
        const cmd = await apiService.sendCommand('SAVE-BOX-001', 'SET_FAN_SPEED', {
          pwmPercent: newSettings.fanPwmPercent,
        });
        setPendingCommands((prev) => [...prev, cmd]);
      } catch (err) {
        console.warn('Could not queue SET_FAN_SPEED command', err);
      }
    }
  };

  const acknowledgeAlert = async (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a))
    );
    try {
      await apiService.acknowledgeAlert(id);
    } catch {
      // offline ack
    }
  };

  const reconnect = () => {
    setLastHeartbeat(new Date());
    if (mode === 'LIVE') {
      if (directEsp32Status.connected) {
        connectDirectEsp32(directEsp32Status.ipAddress);
      } else {
        setIsSseConnected(false);
        setTimeout(() => setIsSseConnected(true), 500);
      }
    }
  };

  return (
    <DeviceContext.Provider
      value={{
        mode,
        setMode,
        telemetry,
        history,
        settings,
        overallStatus,
        alerts,
        apiKeys,
        pendingCommands,
        isSseConnected,
        lastHeartbeat,
        customUploadConfig,
        updateCustomUploadConfig,
        directEsp32Status,
        connectDirectEsp32,
        disconnectDirectEsp32,
        isDirectAutoPolling,
        toggleDirectAutoPolling,
        updateSettings,
        acknowledgeAlert,
        createApiKey,
        deleteApiKey,
        refreshApiKeys,
        reconnect,
        triggerDemoScenario,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevice must be used within DeviceProvider');
  return context;
};
