/**
 * Data structures and types for SAVE Box (Smart Automated Vaccination Enclosure)
 */

export type SystemStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

export type OperatingMode = 'DEMO' | 'LIVE';

export interface TelemetryRecord {
  deviceId: string;
  timestamp: string;
  source: 'ESP32_HARDWARE' | 'DEMO_SIMULATION';
  esp32: {
    online: boolean;
    wifiRssi: number | null; // in dBm, e.g. -58
    uptimeSeconds: number;
    freeHeap?: number;
    chipModel?: string;
    ipAddress?: string;
    sensorCommunicationStatus?: 'OK' | 'DEGRADED' | 'FAULT';
    errorMessage?: string | null;
  };
  temperature: {
    valueC: number;
    targetC: number;
    minAcceptableC: number;
    maxAcceptableC: number;
    sensorStatus: 'OK' | 'FAULT' | 'DISCONNECTED';
    trend: 'Rising' | 'Falling' | 'Stable';
  };
  peltier: {
    commandedOn: boolean;
    confirmedOperating: boolean;
    dutyPercent: number;
    mode: 'ACTIVE' | 'IDLE' | 'DISABLED';
    fault: boolean;
    coolingTimeSeconds: number;
  };
  fan: {
    running: boolean;
    rpm: number | null;
    pwmPercent: number;
    targetRpm: number | null;
    mode: 'AUTOMATIC' | 'MANUAL';
    fault: boolean;
    tachometerSupported: boolean;
  };
  electrical: {
    available: boolean;
    inputVoltageV: number | null;
    peltierCurrentA: number | null;
    fanPowerW: number | null;
    totalPowerW: number | null;
    powerStatus: 'NORMAL' | 'LOW_VOLTAGE' | 'FAULT' | 'NOT_AVAILABLE';
  };
  customFields?: {
    doorOpen?: boolean | null;
    ambientTempC?: number | null;
    humidityPercent?: number | null;
    heatsinkTempC?: number | null;
    batteryLevelPercent?: number | null;
    batteryVoltageV?: number | null;
    dualChamberTemp2C?: number | null;
    extra?: Record<string, string | number | boolean>;
  };
}

export interface CustomUploadConfig {
  uploadIntervalSeconds: number;
  connectionMethod: 'ESP_ASYNC_WEB_SERVER' | 'DIRECT_ESP32_IP' | 'CLOUD_GATEWAY' | 'HYBRID';
  directEsp32Url: string;
  activeApiKey: string;
  wifiSsid: string;
  wifiPassword: string;
  deviceId: string;
  modules: {
    internalTemp: boolean;
    dualChamberTemp: boolean;
    ambientHumidityDHT: boolean;
    lidDoorReedSwitch: boolean;
    heatsinkTempSensor: boolean;
    batteryVoltageMonitor: boolean;
    peltierPwmControl: boolean;
    fanSpeedTachometer: boolean;
    oledLocalDisplay: boolean;
    buzzerAlarm: boolean;
  };
  pins: {
    ds18b20Pin: number;
    ds18b20SecondPin: number;
    dhtPin: number;
    doorSwitchPin: number;
    heatsinkPin: number;
    batteryPin: number;
    peltierPin: number;
    fanPwmPin: number;
    fanTachPin: number;
    buzzerPin: number;
    oledSdaPin: number;
    oledSclPin: number;
  };
}

export interface DirectEsp32Status {
  connected: boolean;
  ipAddress: string;
  latencyMs: number | null;
  lastSyncTime: string | null;
  error: string | null;
}

export interface ApiKeyRecord {
  key: string;
  label: string;
  deviceId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface AlertItem {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  source: 'TEMPERATURE' | 'ESP32' | 'PELTIER' | 'FAN' | 'ELECTRICAL';
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  type: 'SET_TARGET_TEMP' | 'SET_AUTO_COOLING' | 'SET_PELTIER_STATE' | 'SET_FAN_MODE' | 'SET_FAN_SPEED' | 'REQUEST_STATUS_UPDATE';
  payload: any;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'FAILED';
  createdAt: string;
  acknowledgedAt?: string;
}

export interface ControlSettings {
  targetTempC: number;
  minTempC: number;
  maxTempC: number;
  autoCooling: boolean;
  peltierManualOverride: boolean;
  fanMode: 'AUTOMATIC' | 'MANUAL';
  fanPwmPercent: number;
  samplingIntervalSec: number;
  audibleAlarm: boolean;
}

export interface ColdChainCompliance {
  totalHoursMonitored: number;
  percentInSafeRange: number; // e.g. 98.6%
  minTempRecorded: number;
  maxTempRecorded: number;
  avgTempRecorded: number;
  totalExcursions: number;
  excursionDurationMinutes: number;
  whoStandardMet: boolean; // 2°C - 8°C continuous
  evaluationSummary: string;
}
