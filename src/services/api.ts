import { ApiKeyRecord, AlertItem, DeviceCommand, TelemetryRecord } from '../types';

export const apiService = {
  async fetchHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },

  async fetchTelemetryLatest(): Promise<{ telemetry: TelemetryRecord | null; hasHardwareData: boolean }> {
    const res = await fetch('/api/telemetry/latest');
    if (!res.ok) throw new Error('Failed to fetch latest telemetry');
    return await res.json();
  },

  async fetchTelemetryHistory(limit = 100): Promise<{ count: number; history: TelemetryRecord[] }> {
    const res = await fetch(`/api/telemetry/history?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return await res.json();
  },

  async fetchApiKeys(): Promise<{ keys: ApiKeyRecord[] }> {
    const res = await fetch('/api/keys');
    if (!res.ok) throw new Error('Failed to fetch API keys');
    return await res.json();
  },

  async createApiKey(label: string, deviceId = 'SAVE-BOX-001'): Promise<ApiKeyRecord> {
    const res = await fetch('/api/keys/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, deviceId }),
    });
    if (!res.ok) throw new Error('Failed to generate API key');
    const data = await res.json();
    return data.apiKey;
  },

  async deleteApiKey(key: string): Promise<boolean> {
    const res = await fetch(`/api/keys/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  async sendCommand(deviceId: string, type: DeviceCommand['type'], payload: any): Promise<DeviceCommand> {
    const res = await fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, type, payload }),
    });
    if (!res.ok) throw new Error('Failed to queue command');
    const data = await res.json();
    return data.command;
  },

  async fetchAlerts(): Promise<{ alerts: AlertItem[] }> {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return await res.json();
  },

  async acknowledgeAlert(id: string): Promise<boolean> {
    const res = await fetch(`/api/alerts/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
    });
    return res.ok;
  },

  async postHardwareTelemetry(apiKey: string, telemetry: Partial<TelemetryRecord>): Promise<any> {
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(telemetry),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Submission failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },

  async fetchArduinoSketch(apiKey = '', ssid = '', pass = ''): Promise<string> {
    const params = new URLSearchParams();
    if (apiKey) params.append('apiKey', apiKey);
    if (ssid) params.append('ssid', ssid);
    if (pass) params.append('pass', pass);
    const res = await fetch(`/api/arduino-code?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to generate Arduino code');
    return await res.text();
  },

  async generateCustomSketch(config: any): Promise<string> {
    const res = await fetch('/api/custom-sketch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to generate customized Arduino code');
    return await res.text();
  },

  async pollDirectEsp32(ipOrUrl: string): Promise<{ success: boolean; latencyMs: number; telemetry: TelemetryRecord }> {
    const res = await fetch(`/api/proxy/esp32?ip=${encodeURIComponent(ipOrUrl)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Connection failed' }));
      throw new Error(err.details || err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },

  async sendDirectEsp32Command(ip: string, type: string, payload: any): Promise<any> {
    const res = await fetch('/api/proxy/esp32/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, type, payload }),
    });
    if (!res.ok) throw new Error('Failed to dispatch command to ESP32');
    return await res.json();
  },
};

