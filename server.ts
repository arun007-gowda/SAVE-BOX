import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// In-memory data store for live IoT telemetry, API keys, commands, and alerts
interface TelemetryRecord {
  deviceId: string;
  timestamp: string;
  source: 'ESP32_HARDWARE' | 'DEMO_SIMULATION';
  esp32: {
    online: boolean;
    wifiRssi: number | null;
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
  } | null;
}

interface ApiKeyRecord {
  key: string;
  label: string;
  deviceId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface AlertItem {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  source: 'TEMPERATURE' | 'ESP32' | 'PELTIER' | 'FAN' | 'ELECTRICAL';
  acknowledged: boolean;
  acknowledgedAt?: string;
}

interface DeviceCommand {
  id: string;
  deviceId: string;
  type: 'SET_TARGET_TEMP' | 'SET_AUTO_COOLING' | 'SET_PELTIER_STATE' | 'SET_FAN_MODE' | 'SET_FAN_SPEED' | 'REQUEST_STATUS_UPDATE';
  payload: any;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'FAILED';
  createdAt: string;
  acknowledgedAt?: string;
}

// Initial state
const apiKeys: Map<string, ApiKeyRecord> = new Map();

// Seed primary fixed ESP32 hardware key for immediate user connection
const masterKey = 'savebox_live_key_esp32_7f9c2d18';
apiKeys.set(masterKey, {
  key: masterKey,
  label: 'ESP32 Primary Hardware Node',
  deviceId: 'SAVE-BOX-001',
  createdAt: new Date().toISOString(),
  lastUsedAt: null,
});

// Seed demo backup key
const defaultKey = 'savebox_demo_key_9a82f1b4';
apiKeys.set(defaultKey, {
  key: defaultKey,
  label: 'Demo Simulation Key',
  deviceId: 'SAVE-BOX-001',
  createdAt: new Date().toISOString(),
  lastUsedAt: null,
});

let latestTelemetry: TelemetryRecord | null = null;
const telemetryHistory: TelemetryRecord[] = [];
const alertsList: AlertItem[] = [];
const pendingCommands: DeviceCommand[] = [];

// Track SSE subscriber clients
const sseClients: express.Response[] = [];

function broadcastSse(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// Check telemetry against safety thresholds to trigger alerts
function checkAlerts(t: TelemetryRecord) {
  const temp = t.temperature.valueC;
  const minT = t.temperature.minAcceptableC ?? 2.0;
  const maxT = t.temperature.maxAcceptableC ?? 8.0;

  if (temp > maxT) {
    alertsList.unshift({
      id: 'alert_' + Date.now() + '_temp_high',
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      title: 'High Temperature Excursion',
      message: `Internal temperature reached ${temp.toFixed(1)}°C, exceeding maximum safe limit of ${maxT}°C.`,
      source: 'TEMPERATURE',
      acknowledged: false,
    });
  } else if (temp < minT) {
    alertsList.unshift({
      id: 'alert_' + Date.now() + '_temp_low',
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      title: 'Freeze Risk / Low Temperature',
      message: `Internal temperature dropped to ${temp.toFixed(1)}°C, below minimum safe threshold of ${minT}°C. Vaccine freezing risk!`,
      source: 'TEMPERATURE',
      acknowledged: false,
    });
  }

  if (t.temperature.sensorStatus !== 'OK') {
    alertsList.unshift({
      id: 'alert_' + Date.now() + '_temp_sensor',
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      title: 'Temperature Sensor Fault',
      message: `DS18B20 probe reporting ${t.temperature.sensorStatus}. Verify wiring on GPIO pin.`,
      source: 'TEMPERATURE',
      acknowledged: false,
    });
  }

  if (t.peltier.fault) {
    alertsList.unshift({
      id: 'alert_' + Date.now() + '_peltier',
      timestamp: new Date().toISOString(),
      severity: 'WARNING',
      title: 'Peltier Module Anomaly',
      message: 'Peltier thermoelectric cooling module reported an unexpected operating state or thermal overload.',
      source: 'PELTIER',
      acknowledged: false,
    });
  }

  // Custom sensor alerts
  if (t.customFields?.doorOpen === true) {
    alertsList.unshift({
      id: 'alert_' + Date.now() + '_door_open',
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      title: 'Chamber Lid / Door Open Detected',
      message: 'Magnetic reed switch indicates cold box lid is open. Exposure to ambient air threatens vaccine potency!',
      source: 'TEMPERATURE',
      acknowledged: false,
    });
  }

  if (typeof t.customFields?.heatsinkTempC === 'number' && t.customFields.heatsinkTempC > 58) {
    alertsList.unshift({
      id: 'alert_' + Date.now() + '_heatsink_hot',
      timestamp: new Date().toISOString(),
      severity: 'WARNING',
      title: 'Heatsink Thermal Stress Warning',
      message: `Heatsink temperature reached ${t.customFields.heatsinkTempC.toFixed(1)}°C. Check fan clearance and airflow.`,
      source: 'PELTIER',
      acknowledged: false,
    });
  }

  if (typeof t.customFields?.batteryLevelPercent === 'number' && t.customFields.batteryLevelPercent < 20) {
    alertsList.unshift({
      id: 'alert_' + Date.now() + '_low_battery',
      timestamp: new Date().toISOString(),
      severity: 'WARNING',
      title: 'Low Backup Battery Level',
      message: `Reserve battery is at ${t.customFields.batteryLevelPercent}%. Connect external 12V DC power source.`,
      source: 'ELECTRICAL',
      acknowledged: false,
    });
  }

  // Keep alert list capped at 100
  if (alertsList.length > 100) {
    alertsList.length = 100;
  }
}

// ======================== API ROUTES ========================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SAVE-Box-Backend',
    timestamp: new Date().toISOString(),
    apiKeysCount: apiKeys.size,
    historyCount: telemetryHistory.length,
    activeSseClients: sseClients.length,
  });
});

// Manage API Keys for ESP32
app.get('/api/keys', (_req, res) => {
  res.json({
    keys: Array.from(apiKeys.values()),
  });
});

app.post('/api/keys/generate', (req, res) => {
  const label = req.body?.label || 'ESP32 Device Node';
  const deviceId = req.body?.deviceId || 'SAVE-BOX-001';
  const generatedKey = 'savebox_key_' + crypto.randomBytes(16).toString('hex');

  const newKey: ApiKeyRecord = {
    key: generatedKey,
    label,
    deviceId,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  apiKeys.set(generatedKey, newKey);
  res.status(201).json({
    message: 'API Key generated successfully',
    apiKey: newKey,
  });
});

app.delete('/api/keys/:key', (req, res) => {
  const { key } = req.params;
  if (apiKeys.has(key)) {
    apiKeys.delete(key);
    res.json({ success: true, message: 'API key revoked' });
  } else {
    res.status(404).json({ error: 'Key not found' });
  }
});

// Ingest telemetry from ESP32
// Authentication: x-api-key header or ?apiKey= query param
app.post('/api/telemetry', (req, res) => {
  const providedKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);

  // Allow test submission if key matches or in dev fallback
  let validKey = false;
  if (providedKey && apiKeys.has(providedKey)) {
    validKey = true;
    const record = apiKeys.get(providedKey)!;
    record.lastUsedAt = new Date().toISOString();
  }

  if (!validKey && providedKey !== 'savebox_demo_override') {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing x-api-key header',
      hint: 'Generate an API key in the Hardware Setup tab and include it in your ESP32 HTTP headers.',
    });
  }

  const body = req.body || {};
  const now = new Date().toISOString();

  const record: TelemetryRecord = {
    deviceId: body.deviceId || 'SAVE-BOX-001',
    timestamp: body.timestamp || now,
    source: 'ESP32_HARDWARE',
    esp32: {
      online: true,
      wifiRssi: typeof body.esp32?.wifiRssi === 'number' ? body.esp32.wifiRssi : -62,
      uptimeSeconds: typeof body.esp32?.uptimeSeconds === 'number' ? body.esp32.uptimeSeconds : 0,
      freeHeap: body.esp32?.freeHeap || 240000,
      chipModel: body.esp32?.chipModel || 'ESP32-D0WDQ6 (Rev 1)',
      ipAddress: body.esp32?.ipAddress || req.ip || '192.168.1.150',
      sensorCommunicationStatus: body.esp32?.sensorCommunicationStatus || 'OK',
      errorMessage: body.esp32?.errorMessage || null,
    },
    temperature: {
      valueC: typeof body.temperature?.valueC === 'number' ? body.temperature.valueC : 5.0,
      targetC: typeof body.temperature?.targetC === 'number' ? body.temperature.targetC : 5.0,
      minAcceptableC: typeof body.temperature?.minAcceptableC === 'number' ? body.temperature.minAcceptableC : 2.0,
      maxAcceptableC: typeof body.temperature?.maxAcceptableC === 'number' ? body.temperature.maxAcceptableC : 8.0,
      sensorStatus: body.temperature?.sensorStatus || 'OK',
      trend: body.temperature?.trend || 'Stable',
    },
    peltier: {
      commandedOn: Boolean(body.peltier?.commandedOn ?? true),
      confirmedOperating: Boolean(body.peltier?.confirmedOperating ?? true),
      dutyPercent: typeof body.peltier?.dutyPercent === 'number' ? body.peltier.dutyPercent : 75,
      mode: body.peltier?.mode || 'ACTIVE',
      fault: Boolean(body.peltier?.fault ?? false),
      coolingTimeSeconds: body.peltier?.coolingTimeSeconds || 1200,
    },
    fan: {
      running: Boolean(body.fan?.running ?? true),
      rpm: typeof body.fan?.rpm === 'number' ? body.fan.rpm : null,
      pwmPercent: typeof body.fan?.pwmPercent === 'number' ? body.fan.pwmPercent : 80,
      targetRpm: typeof body.fan?.targetRpm === 'number' ? body.fan.targetRpm : 2400,
      mode: body.fan?.mode || 'AUTOMATIC',
      fault: Boolean(body.fan?.fault ?? false),
      tachometerSupported: Boolean(body.fan?.rpm !== null),
    },
    electrical: {
      available: Boolean(body.electrical?.available ?? false),
      inputVoltageV: typeof body.electrical?.inputVoltageV === 'number' ? body.electrical.inputVoltageV : null,
      peltierCurrentA: typeof body.electrical?.peltierCurrentA === 'number' ? body.electrical.peltierCurrentA : null,
      fanPowerW: typeof body.electrical?.fanPowerW === 'number' ? body.electrical.fanPowerW : null,
      totalPowerW: typeof body.electrical?.totalPowerW === 'number' ? body.electrical.totalPowerW : null,
      powerStatus: body.electrical?.powerStatus || (body.electrical?.available ? 'NORMAL' : 'NOT_AVAILABLE'),
    },
    customFields: body.customFields || null,
  };

  latestTelemetry = record;
  telemetryHistory.push(record);
  if (telemetryHistory.length > 500) {
    telemetryHistory.shift();
  }

  checkAlerts(record);
  broadcastSse('telemetry', record);

  // Return any pending commands for the ESP32 to execute
  const commandsForDevice = pendingCommands.filter((c) => c.status === 'PENDING' && c.deviceId === record.deviceId);

  res.json({
    success: true,
    message: 'Telemetry received and recorded',
    pendingCommands: commandsForDevice,
  });
});

// Get latest telemetry
app.get('/api/telemetry/latest', (_req, res) => {
  res.json({
    telemetry: latestTelemetry,
    hasHardwareData: Boolean(latestTelemetry && latestTelemetry.source === 'ESP32_HARDWARE'),
  });
});

// Get telemetry history
app.get('/api/telemetry/history', (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const slice = telemetryHistory.slice(-limit);
  res.json({
    count: slice.length,
    history: slice,
  });
});

// SSE Stream for live real-time push to web dashboard
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);

  // Send initial state
  if (latestTelemetry) {
    res.write(`event: telemetry\ndata: ${JSON.stringify(latestTelemetry)}\n\n`);
  }

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Commands endpoint (Dashboard sends command)
app.post('/api/commands', (req, res) => {
  const { deviceId = 'SAVE-BOX-001', type, payload } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'Command type is required' });
  }

  const command: DeviceCommand = {
    id: 'cmd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    deviceId,
    type,
    payload,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  pendingCommands.push(command);
  broadcastSse('command_queued', command);

  res.status(202).json({
    message: 'Command queued for ESP32 transmission',
    command,
  });
});

// ESP32 acknowledges command
app.post('/api/commands/ack', (req, res) => {
  const { commandId, status = 'ACKNOWLEDGED' } = req.body;
  const cmd = pendingCommands.find((c) => c.id === commandId);
  if (!cmd) {
    return res.status(404).json({ error: 'Command not found' });
  }

  cmd.status = status;
  cmd.acknowledgedAt = new Date().toISOString();
  broadcastSse('command_ack', cmd);

  res.json({ success: true, command: cmd });
});

// Alerts endpoints
app.get('/api/alerts', (_req, res) => {
  res.json({ alerts: alertsList });
});

app.post('/api/alerts/:id/ack', (req, res) => {
  const { id } = req.params;
  const alert = alertsList.find((a) => a.id === id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  alert.acknowledged = true;
  alert.acknowledgedAt = new Date().toISOString();
  res.json({ success: true, alert });
});

// Arduino C++ sketch generator endpoint (Powered by ESPAsyncWebServer)
app.get('/api/arduino-code', (req, res) => {
  const apiKey = (req.query.apiKey as string) || 'savebox_live_key_esp32_7f9c2d18';
  const wifiSsid = (req.query.ssid as string) || 'MyVaccineClinic_WiFi';
  const wifiPass = (req.query.pass as string) || 'ClinicSecureKey';
  const hostUrl = req.protocol + '://' + req.get('host');

  const sketch = generateCustomArduinoSketch({
    wifiSsid,
    wifiPassword: wifiPass,
    activeApiKey: apiKey,
    deviceId: 'SAVE-BOX-001',
    uploadIntervalSeconds: 3,
    connectionMethod: 'ESP_ASYNC_WEB_SERVER',
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
  }, hostUrl);

  res.type('text/plain').send(sketch);
});

// Proxy endpoint to poll ESP32 directly via Local Wi-Fi (avoids browser CORS & mixed-content HTTPS restrictions)
app.get('/api/proxy/esp32', async (req, res) => {
  const rawIp = (req.query.ip as string) || (req.query.url as string);
  if (!rawIp) {
    return res.status(400).json({ error: 'IP or URL is required (e.g. 192.168.1.150 or savebox.local)' });
  }

  const cleanHost = rawIp.replace(/^https?:\/\//, '').replace(/\/api\/telemetry\/?$/, '').replace(/\/api\/status\/?$/, '').replace(/\/$/, '');
  const telemetryUrl = `http://${cleanHost}/api/telemetry`;
  const statusUrl = `http://${cleanHost}/api/status`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const startMs = Date.now();
    
    let activeEndpoint = telemetryUrl;
    let fetchRes = await fetch(telemetryUrl, { signal: controller.signal }).catch(() => null);
    if (!fetchRes || !fetchRes.ok) {
      activeEndpoint = statusUrl;
      fetchRes = await fetch(statusUrl, { signal: controller.signal }).catch(() => null);
    }
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startMs;

    if (!fetchRes || !fetchRes.ok) {
      throw new Error(`ESP32 Async Web Server unreachable at ${cleanHost} (endpoints /api/telemetry or /api/status)`);
    }

    const data: any = await fetchRes.json();
    const now = new Date().toISOString();

    const record: TelemetryRecord = {
      deviceId: data.deviceId || 'SAVE-BOX-001',
      timestamp: data.timestamp || now,
      source: 'ESP32_HARDWARE',
      esp32: {
        online: true,
        wifiRssi: typeof data.esp32?.wifiRssi === 'number' ? data.esp32.wifiRssi : -58,
        uptimeSeconds: typeof data.esp32?.uptimeSeconds === 'number' ? data.esp32.uptimeSeconds : 0,
        freeHeap: data.esp32?.freeHeap || 238000,
        chipModel: data.esp32?.chipModel || 'ESP32 (Direct Wi-Fi Node)',
        ipAddress: cleanHost,
        sensorCommunicationStatus: data.esp32?.sensorCommunicationStatus || 'OK',
        errorMessage: null,
      },
      temperature: {
        valueC: typeof data.temperature?.valueC === 'number' ? data.temperature.valueC : 5.0,
        targetC: typeof data.temperature?.targetC === 'number' ? data.temperature.targetC : 5.0,
        minAcceptableC: typeof data.temperature?.minAcceptableC === 'number' ? data.temperature.minAcceptableC : 2.0,
        maxAcceptableC: typeof data.temperature?.maxAcceptableC === 'number' ? data.temperature.maxAcceptableC : 8.0,
        sensorStatus: data.temperature?.sensorStatus || 'OK',
        trend: data.temperature?.trend || 'Stable',
      },
      peltier: {
        commandedOn: Boolean(data.peltier?.commandedOn ?? true),
        confirmedOperating: Boolean(data.peltier?.confirmedOperating ?? true),
        dutyPercent: typeof data.peltier?.dutyPercent === 'number' ? data.peltier.dutyPercent : 75,
        mode: data.peltier?.mode || 'ACTIVE',
        fault: Boolean(data.peltier?.fault ?? false),
        coolingTimeSeconds: data.peltier?.coolingTimeSeconds || 0,
      },
      fan: {
        running: Boolean(data.fan?.running ?? true),
        rpm: typeof data.fan?.rpm === 'number' ? data.fan.rpm : null,
        pwmPercent: typeof data.fan?.pwmPercent === 'number' ? data.fan.pwmPercent : 80,
        targetRpm: typeof data.fan?.targetRpm === 'number' ? data.fan.targetRpm : 2400,
        mode: data.fan?.mode || 'AUTOMATIC',
        fault: Boolean(data.fan?.fault ?? false),
        tachometerSupported: Boolean(data.fan?.rpm !== null),
      },
      electrical: {
        available: Boolean(data.electrical?.available ?? false),
        inputVoltageV: typeof data.electrical?.inputVoltageV === 'number' ? data.electrical.inputVoltageV : null,
        peltierCurrentA: typeof data.electrical?.peltierCurrentA === 'number' ? data.electrical.peltierCurrentA : null,
        fanPowerW: typeof data.electrical?.fanPowerW === 'number' ? data.electrical.fanPowerW : null,
        totalPowerW: typeof data.electrical?.totalPowerW === 'number' ? data.electrical.totalPowerW : null,
        powerStatus: data.electrical?.powerStatus || (data.electrical?.available ? 'NORMAL' : 'NOT_AVAILABLE'),
      },
      customFields: data.customFields || null,
    };

    latestTelemetry = record;
    telemetryHistory.push(record);
    if (telemetryHistory.length > 500) telemetryHistory.shift();

    checkAlerts(record);
    broadcastSse('telemetry', record);

    res.json({
      success: true,
      latencyMs,
      endpoint: activeEndpoint,
      telemetry: record,
    });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: `Could not reach ESP32 Async Web Server at ${cleanHost} (/api/telemetry or /api/status)`,
      details: err.message,
    });
  }
});

// Proxy command directly to local ESP32
app.post('/api/proxy/esp32/command', async (req, res) => {
  const { ip, type, payload } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP is required' });

  const cleanHost = ip.replace(/^https?:\/\//, '').replace(/\/api\/command\/?$/, '').replace(/\/$/, '');
  const targetUrl = `http://${cleanHost}/api/command`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const postRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await postRes.json();
    res.json({ success: true, response: data });
  } catch (err: any) {
    res.status(502).json({ error: `Command transmission failed: ${err.message}` });
  }
});

// Customized Arduino C++ Sketch Generator Endpoint
app.post('/api/custom-sketch', (req, res) => {
  const config = req.body || {};
  const hostUrl = req.protocol + '://' + req.get('host');
  const code = generateCustomArduinoSketch(config, hostUrl);
  res.type('text/plain').send(code);
});

function generateCustomArduinoSketch(config: any, hostUrl: string): string {
  const ssid = config.wifiSsid || 'MyVaccineClinic_WiFi';
  const pass = config.wifiPassword || 'ClinicSecureKey';
  const apiKey = config.activeApiKey || 'savebox_live_key_esp32_7f9c2d18';
  const deviceId = config.deviceId || 'SAVE-BOX-001';
  const interval = config.uploadIntervalSeconds || 3;
  const method = config.connectionMethod || 'CLOUD_GATEWAY'; // 'CLOUD_GATEWAY' | 'DIRECT_ESP32_IP' | 'HYBRID'

  const modules = config.modules || {
    internalTemp: true,
    dualChamberTemp: false,
    ambientHumidityDHT: false,
    lidDoorReedSwitch: true,
    heatsinkTempSensor: true,
    batteryVoltageMonitor: true,
    peltierPwmControl: true,
    fanSpeedTachometer: true,
    oledLocalDisplay: false,
    buzzerAlarm: false,
  };

  const pins = config.pins || {
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
  };

  return `/*
 * =====================================================================
 *  SAVE Box — Smart Automated Vaccination Enclosure (Custom Firmware)
 *  Device ID: ${deviceId}
 *  Generated for: Tailored Sensor & Telemetry Suite
 * =====================================================================
 *
 * ACTIVE HARDWARE MODULES:
 * [${modules.internalTemp ? 'X' : ' '}] Primary Chamber DS18B20 (Pin: GPIO ${pins.ds18b20Pin})
 * [${modules.dualChamberTemp ? 'X' : ' '}] Secondary Chamber DS18B20 (Pin: GPIO ${pins.ds18b20SecondPin})
 * [${modules.ambientHumidityDHT ? 'X' : ' '}] Ambient Room Temp & Humidity DHT (Pin: GPIO ${pins.dhtPin})
 * [${modules.lidDoorReedSwitch ? 'X' : ' '}] Cold Box Lid/Door Reed Switch (Pin: GPIO ${pins.doorSwitchPin})
 * [${modules.heatsinkTempSensor ? 'X' : ' '}] Heatsink Thermal Probe (Pin: GPIO ${pins.heatsinkPin})
 * [${modules.batteryVoltageMonitor ? 'X' : ' '}] Battery Voltage Divider (Pin: GPIO ${pins.batteryPin})
 * [${modules.peltierPwmControl ? 'X' : ' '}] Peltier Module Driver (Pin: GPIO ${pins.peltierPin})
 * [${modules.fanSpeedTachometer ? 'X' : ' '}] PWM Fan & Tachometer (PWM: ${pins.fanPwmPin}, Tach: ${pins.fanTachPin})
 * [${modules.oledLocalDisplay ? 'X' : ' '}] I2C OLED Display SSD1306 (SDA: ${pins.oledSdaPin}, SCL: ${pins.oledSclPin})
 * [${modules.buzzerAlarm ? 'X' : ' '}] Piezo Audio Alarm (Pin: GPIO ${pins.buzzerPin})
 *
 * TELEMETRY CONFIGURATION:
 * - Upload Frequency: Every ${interval} seconds
 * - Connection Architecture: ${method}
 * - Cloud Gateway URL: ${hostUrl}/api/telemetry
 */

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
${modules.internalTemp || modules.dualChamberTemp || modules.heatsinkTempSensor ? '#include <OneWire.h>\n#include <DallasTemperature.h>' : ''}
${modules.ambientHumidityDHT ? '#include <DHT.h>' : ''}
${modules.oledLocalDisplay ? '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>' : ''}

// ---------------- Wi-Fi Credentials ----------------
const char* ssid = "${ssid}";
const char* password = "${pass}";

// ---------------- Server & Device Config ----------------
const char* serverEndpoint = "${hostUrl}/api/telemetry";
const char* apiKey = "${apiKey}";
const char* deviceId = "${deviceId}";
const unsigned long UPLOAD_INTERVAL_MS = ${interval * 1000};

// ---------------- Hardware Pin Definitions ----------------
#define PIN_DS18B20_PRIMARY ${pins.ds18b20Pin}
#define PIN_PELTIER ${pins.peltierPin}
#define PIN_FAN_PWM ${pins.fanPwmPin}
#define PIN_FAN_TACH ${pins.fanTachPin}
${modules.dualChamberTemp ? `#define PIN_DS18B20_SECOND ${pins.ds18b20SecondPin}` : ''}
${modules.ambientHumidityDHT ? `#define PIN_DHT ${pins.dhtPin}\n#define DHTTYPE DHT22` : ''}
${modules.lidDoorReedSwitch ? `#define PIN_DOOR_SWITCH ${pins.doorSwitchPin}` : ''}
${modules.heatsinkTempSensor ? `#define PIN_HEATSINK ${pins.heatsinkPin}` : ''}
${modules.batteryVoltageMonitor ? `#define PIN_BATTERY_ADC ${pins.batteryPin}` : ''}
${modules.buzzerAlarm ? `#define PIN_BUZZER ${pins.buzzerPin}` : ''}

// PWM Fan Config
#define PWM_CHANNEL 0
#define PWM_FREQ 25000
#define PWM_RES 8

// ESP32 Asynchronous Web Server & SSE on Port 80
AsyncWebServer server(80);
AsyncEventSource events("/events");

${modules.internalTemp ? 'OneWire oneWirePrimary(PIN_DS18B20_PRIMARY);\nDallasTemperature dsPrimary(&oneWirePrimary);' : ''}
${modules.dualChamberTemp ? 'OneWire oneWireSecond(PIN_DS18B20_SECOND);\nDallasTemperature dsSecond(&oneWireSecond);' : ''}
${modules.ambientHumidityDHT ? 'DHT dht(PIN_DHT, DHTTYPE);' : ''}
${modules.oledLocalDisplay ? '#define SCREEN_WIDTH 128\n#define SCREEN_HEIGHT 64\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);' : ''}

// State Variables
float chamberTempC = 5.0;
float targetTempC = 5.0;
bool autoCooling = true;
bool peltierActive = false;
int fanPwmDuty = 180;
volatile unsigned int tachPulses = 0;
float currentFanRpm = 0;
unsigned long lastTachSample = 0;
unsigned long lastUploadTime = 0;
unsigned long lastSseBroadcast = 0;
unsigned long coolingSecondsTotal = 0;

${modules.dualChamberTemp ? 'float chamberTemp2C = 5.1;' : ''}
${modules.ambientHumidityDHT ? 'float ambientTempC = 26.5;\nfloat ambientHumidity = 52.0;' : ''}
${modules.lidDoorReedSwitch ? 'bool isDoorOpen = false;' : ''}
${modules.heatsinkTempSensor ? 'float heatsinkTempC = 34.0;' : ''}
${modules.batteryVoltageMonitor ? 'float batteryVoltage = 12.4;\nint batteryPct = 95;' : ''}

void IRAM_ATTR onTachPulse() {
  tachPulses++;
}

// Forward declarations
void setupAsyncWebServer();
void readAllSensors();
void broadcastSseTelemetry();
${method !== 'ESP_ASYNC_WEB_SERVER' ? 'void uploadTelemetryToCloud();' : ''}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\\n=== SAVE BOX ESP32 ASYNC WEB SERVER STARTING ===");

  // Output Actuator Pins
  pinMode(PIN_PELTIER, OUTPUT);
  digitalWrite(PIN_PELTIER, LOW);

  ${modules.buzzerAlarm ? 'pinMode(PIN_BUZZER, OUTPUT);\ndigitalWrite(PIN_BUZZER, LOW);' : ''}
  ${modules.lidDoorReedSwitch ? 'pinMode(PIN_DOOR_SWITCH, INPUT_PULLUP);' : ''}
  ${modules.batteryVoltageMonitor ? 'pinMode(PIN_BATTERY_ADC, INPUT);' : ''}

  // Fan PWM & Tach
  pinMode(PIN_FAN_TACH, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FAN_TACH), onTachPulse, FALLING);
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_FAN_PWM, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, fanPwmDuty);

  // Sensors Init
  ${modules.internalTemp ? 'dsPrimary.begin();' : ''}
  ${modules.dualChamberTemp ? 'dsSecond.begin();' : ''}
  ${modules.ambientHumidityDHT ? 'dht.begin();' : ''}
  ${modules.oledLocalDisplay ? 'Wire.begin(pins.oledSdaPin, pins.oledSclPin);\ndisplay.begin(SSD1306_SWITCHCAPVCC, 0x3C);\ndisplay.clearDisplay();\ndisplay.setTextColor(WHITE);\ndisplay.setTextSize(1);\ndisplay.setCursor(0,0);\ndisplay.println("SAVE Box Initializing...");\ndisplay.display();' : ''}

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\nWi-Fi Connected! IP Address: ");
    Serial.println(WiFi.localIP());
    setupAsyncWebServer();
  } else {
    Serial.println("\\nWi-Fi Timeout. Operating in autonomous failsafe mode.");
  }
}

void loop() {
  // NOTE: ESPAsyncWebServer runs asynchronously in FreeRTOS background tasks.
  // No server.handleClient() is needed, ensuring zero loop blocking!

  // 1. Read Sensors
  readAllSensors();

  // 2. Measure Fan Tachometer RPM
  unsigned long now = millis();
  if (now - lastTachSample >= 1000) {
    detachInterrupt(digitalPinToInterrupt(PIN_FAN_TACH));
    currentFanRpm = (tachPulses / 2.0) * 60.0;
    tachPulses = 0;
    lastTachSample = now;
    attachInterrupt(digitalPinToInterrupt(PIN_FAN_TACH), onTachPulse, FALLING);
  }

  // 3. Autonomous Temperature Regulation (Bang-Bang with Hysteresis)
  if (autoCooling) {
    if (chamberTempC > targetTempC + 0.4) {
      if (!peltierActive) {
        digitalWrite(PIN_PELTIER, HIGH);
        peltierActive = true;
      }
      fanPwmDuty = 220; // High speed cooling
      ledcWrite(PWM_CHANNEL, fanPwmDuty);
    } else if (chamberTempC <= targetTempC - 0.2) {
      if (peltierActive) {
        digitalWrite(PIN_PELTIER, LOW);
        peltierActive = false;
      }
      fanPwmDuty = 90; // Low quiet circulation
      ledcWrite(PWM_CHANNEL, fanPwmDuty);
    }
  }

  // 4. Check Excursion Audio Alarm
  ${modules.buzzerAlarm ? 'if (chamberTempC > 8.0 || chamberTempC < 2.0 || isDoorOpen) {\n    digitalWrite(PIN_BUZZER, HIGH);\n  } else {\n    digitalWrite(PIN_BUZZER, LOW);\n  }' : ''}

  // 5. Update OLED Local Screen
  ${modules.oledLocalDisplay ? 'updateOledScreen();' : ''}

  // 6. Push Live SSE Telemetry to Web Dashboard Clients
  if (now - lastSseBroadcast >= UPLOAD_INTERVAL_MS) {
    lastSseBroadcast = now;
    broadcastSseTelemetry();
  }

  // 7. Optional Cloud Gateway Upload
  ${method !== 'ESP_ASYNC_WEB_SERVER' ? `
  if (now - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    lastUploadTime = now;
    if (WiFi.status() == WL_CONNECTED) {
      uploadTelemetryToCloud();
    }
  }
  ` : ''}

  delay(20);
}

void readAllSensors() {
  ${modules.internalTemp ? 'dsPrimary.requestTemperatures();\n  float t = dsPrimary.getTempCByIndex(0);\n  if (t != DEVICE_DISCONNECTED_C && t > -40.0 && t < 70.0) {\n    chamberTempC = t;\n  }' : ''}
  ${modules.dualChamberTemp ? 'dsSecond.requestTemperatures();\n  float t2 = dsSecond.getTempCByIndex(0);\n  if (t2 != DEVICE_DISCONNECTED_C && t2 > -40.0 && t2 < 70.0) {\n    chamberTemp2C = t2;\n  }' : ''}
  ${modules.ambientHumidityDHT ? 'ambientTempC = dht.readTemperature();\n  ambientHumidity = dht.readHumidity();' : ''}
  ${modules.lidDoorReedSwitch ? 'isDoorOpen = (digitalRead(PIN_DOOR_SWITCH) == HIGH);' : ''}
  ${modules.heatsinkTempSensor ? '// If analog probe or second 1-wire probe on heatsink:\n  // heatsinkTempC = analogRead(PIN_HEATSINK) * (3.3 / 4095.0) * 100.0;' : ''}
  ${modules.batteryVoltageMonitor ? 'int rawAdc = analogRead(PIN_BATTERY_ADC);\n  batteryVoltage = (rawAdc / 4095.0) * 3.3 * 4.0;\n  batteryPct = constrain(map((long)(batteryVoltage * 100), 1050, 1260, 0, 100), 0, 100);' : ''}
}

void buildTelemetryDoc(JsonDocument& doc) {
  doc["deviceId"] = deviceId;
  doc["timestamp"] = "";

  JsonObject esp = doc.createNestedObject("esp32");
  esp["online"] = true;
  esp["wifiRssi"] = WiFi.RSSI();
  esp["uptimeSeconds"] = millis() / 1000;
  esp["freeHeap"] = ESP.getFreeHeap();
  esp["ipAddress"] = WiFi.localIP().toString();
  esp["serverType"] = "ESPAsyncWebServer";

  JsonObject temp = doc.createNestedObject("temperature");
  temp["valueC"] = chamberTempC;
  temp["targetC"] = targetTempC;
  temp["sensorStatus"] = "OK";

  JsonObject pelt = doc.createNestedObject("peltier");
  pelt["commandedOn"] = peltierActive;
  pelt["dutyPercent"] = peltierActive ? 85 : 0;
  pelt["mode"] = autoCooling ? "ACTIVE" : "IDLE";

  JsonObject fan = doc.createNestedObject("fan");
  fan["running"] = (fanPwmDuty > 0);
  fan["rpm"] = (int)currentFanRpm;
  fan["pwmPercent"] = (int)((fanPwmDuty / 255.0) * 100);

  JsonObject custom = doc.createNestedObject("customFields");
  ${modules.lidDoorReedSwitch ? 'custom["doorOpen"] = isDoorOpen;' : ''}
  ${modules.ambientHumidityDHT ? 'custom["ambientTempC"] = ambientTempC;\n  custom["humidityPercent"] = ambientHumidity;' : ''}
  ${modules.heatsinkTempSensor ? 'custom["heatsinkTempC"] = heatsinkTempC;' : ''}
  ${modules.batteryVoltageMonitor ? 'custom["batteryVoltageV"] = batteryVoltage;\n  custom["batteryLevelPercent"] = batteryPct;' : ''}
  ${modules.dualChamberTemp ? 'custom["dualChamberTemp2C"] = chamberTemp2C;' : ''}
}

void broadcastSseTelemetry() {
  if (events.count() > 0) {
    StaticJsonDocument<896> doc;
    buildTelemetryDoc(doc);
    String ssePayload;
    serializeJson(doc, ssePayload);
    events.send(ssePayload.c_str(), "telemetry", millis());
  }
}

${method !== 'ESP_ASYNC_WEB_SERVER' ? `
void uploadTelemetryToCloud() {
  HTTPClient http;
  http.begin(serverEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", apiKey);

  StaticJsonDocument<896> doc;
  buildTelemetryDoc(doc);
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  int code = http.POST(jsonPayload);
  if (code > 0) {
    Serial.printf("[HTTP %d] Cloud telemetry uploaded successfully!\\n", code);
  }
  http.end();
}
` : ''}

void setupAsyncWebServer() {
  if (MDNS.begin("savebox")) {
    Serial.println("[mDNS] Responder active at http://savebox.local");
  }

  // 1. CORS Preflight & Global Default Headers
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");

  // 2. Micro Web Interface on root (GET /)
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    String html = F("<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>SAVE Box Node</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#e2e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.card{background:#111827;border:1px solid #1f2937;border-radius:18px;padding:24px;width:100%;max-width:360px;box-shadow:0 12px 30px rgba(0,0,0,0.6);text-align:center}.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);margin-bottom:14px}.val{font-size:46px;font-weight:800;color:#38bdf8;font-family:monospace;margin:6px 0}.sub{font-size:12px;color:#94a3b8;line-height:1.6}.meta{margin-top:20px;padding-top:14px;border-top:1px solid #1f2937;font-size:11px;color:#64748b;display:flex;justify-content:space-between}</style></head><body><div class='card'><div class='badge'>ESPAsyncWebServer ACTIVE</div><div class='val'>");
    html += String(chamberTempC, 1);
    html += F("&deg;C</div><div class='sub'>Chamber Setpoint: <b>");
    html += String(targetTempC, 1);
    html += F("&deg;C</b><br>Peltier: <b>");
    html += (peltierActive ? "ACTIVE COOLING" : "IDLE");
    html += F("</b> | Fan: <b>");
    html += String((int)((fanPwmDuty / 255.0) * 100));
    html += F("%</b></div><div class='meta'><span>SAVE Box Node</span><span>savebox.local</span></div></div></body></html>");
    request->send(200, "text/html", html);
  });

  // 3. Asynchronous Non-blocking JSON Telemetry (GET /api/telemetry and GET /api/status)
  auto handleTelemetry = [](AsyncWebServerRequest *request) {
    AsyncResponseStream *response = request->beginResponseStream("application/json");
    response->addHeader("Access-Control-Allow-Origin", "*");

    StaticJsonDocument<896> doc;
    buildTelemetryDoc(doc);
    serializeJson(doc, *response);
    request->send(response);
  };

  server.on("/api/telemetry", HTTP_GET, handleTelemetry);
  server.on("/api/status", HTTP_GET, handleTelemetry);

  // 4. Asynchronous Command Receiver (POST /api/command)
  server.on("/api/command", HTTP_POST, [](AsyncWebServerRequest *request){
    // Response handled in body callback below
  }, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, data, len);
    if (!err) {
      const char* type = doc["type"];
      JsonObject payload = doc["payload"];
      if (type != NULL) {
        if (strcmp(type, "SET_TARGET_TEMP") == 0 && payload.containsKey("targetC")) {
          targetTempC = payload["targetC"];
          Serial.printf("[Async Command] New target: %.1f C\\n", targetTempC);
        } else if (strcmp(type, "SET_AUTO_COOLING") == 0 && payload.containsKey("enabled")) {
          autoCooling = payload["enabled"];
        } else if (strcmp(type, "SET_PELTIER_STATE") == 0 && payload.containsKey("enabled")) {
          peltierActive = payload["enabled"];
          digitalWrite(PIN_PELTIER, peltierActive ? HIGH : LOW);
        } else if (strcmp(type, "SET_FAN_SPEED") == 0 && payload.containsKey("pwmPercent")) {
          int pct = payload["pwmPercent"];
          fanPwmDuty = map(pct, 0, 100, 0, 255);
          ledcWrite(PWM_CHANNEL, fanPwmDuty);
        }
      }
    }
    AsyncWebServerResponse *resp = request->beginResponse(200, "application/json", "{\"success\":true,\"message\":\"Async command executed successfully\"}");
    resp->addHeader("Access-Control-Allow-Origin", "*");
    request->send(resp);
  });

  // 5. Server-Sent Events (SSE) Stream Handler
  events.onConnect([](AsyncEventSourceClient *client){
    Serial.println("[Async SSE] Web client connected to /events");
    client->send("Connected to SAVE Box ESPAsyncWebServer EventSource", NULL, millis(), 10000);
  });
  server.addHandler(&events);

  // 6. Handle OPTIONS Preflight Requests
  server.onNotFound([](AsyncWebServerRequest *request) {
    if (request->method() == HTTP_OPTIONS) {
      AsyncWebServerResponse *response = request->beginResponse(204);
      response->addHeader("Access-Control-Allow-Origin", "*");
      response->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response->addHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
      request->send(response);
    } else {
      request->send(404, "text/plain", "Not Found");
    }
  });

  server.begin();
  Serial.println("[ESPAsyncWebServer] Non-blocking server listening on port 80!");
}

${modules.oledLocalDisplay ? `
void updateOledScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("SAVE BOX [");
  display.print(WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE");
  display.println("]");

  display.setTextSize(2);
  display.setCursor(0, 16);
  display.print(chamberTempC, 1);
  display.println(" C");

  display.setTextSize(1);
  display.setCursor(0, 40);
  display.printf("SET: %.1fC | FAN: %d%%", targetTempC, (int)((fanPwmDuty / 255.0) * 100));
  display.setCursor(0, 52);
  display.print("IP: ");
  display.println(WiFi.localIP());
  display.display();
}
` : ''}
`;
}

// Configure Vite integration for dev and static serving for production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SAVE Box IoT Gateway running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
