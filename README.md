# SAVE Box — Smart Automated Vaccination Enclosure Dashboard

The **SAVE Box (Smart Automated Vaccination Enclosure)** is an industrial IoT and medical cold-chain monitoring system powered by an ESP32 microcontroller, solid-state Peltier thermoelectric cooling module (TEC1-12706), 25 kHz PWM heatsink fan, and Dallas DS18B20 1-Wire precision temperature probe.

---

## 🌟 Key Features

1. **Live Cold-Chain Telemetry**: Real-time internal temperature display, WHO (+2°C to +8°C) safe boundary indicators, session min/max extrema, and trend tracking.
2. **Peltier & Fan Dynamics**: Commanded vs confirmed status, duty cycle percentage, actual tachometer RPM, and cooling duration.
3. **Interactive 3D Digital Twin**: High-fidelity Three.js procedural model with exploded view, X-ray view, real-time rotating fan blades, and thermal airflow dissipation particle simulation.
4. **Hardware API Key Authentication**: Built-in API Key Generator for authenticating ESP32 HTTP POST payloads.
5. **Firmware Generator**: Ready-to-flash Arduino C++ sketch pre-populated with Wi-Fi credentials, backend endpoint, and API key.
6. **Dual Mode Architecture**:
   - **Demo Mode**: Realistic thermodynamic physics simulation (ambient heat ingress, hysteresis chilling, fault triggers for presentations).
   - **Live Hardware Mode**: Zero-latency Server-Sent Events (SSE) and HTTP REST ingestion from actual ESP32 nodes.
7. **Cold-Chain Audit & Reports**: Statistical compliance scoring, CSV data export, and printable WHO audit reports.

---

## 🔌 Hardware Setup & Pin Assignments

| Component | ESP32 Pin | Interface | Notes |
| :--- | :--- | :--- | :--- |
| **DS18B20 Temp Probe** | GPIO 4 | Dallas OneWire | Requires 4.7kΩ pull-up between 3.3V and DATA |
| **Peltier Driver** | GPIO 25 | Digital Output | Connects to N-channel MOSFET (IRF540N) or Solid-State Relay |
| **Cooling Fan PWM** | GPIO 18 | LEDC PWM (25 kHz) | Controls 12V 4-wire or 3-wire fan speed |
| **Fan Tachometer** | GPIO 19 | Interrupt Falling | Measures actual rotor RPM (2 pulses / revolution) |
| **Power Supply** | External | 12V DC (5A–10A) | Dedicated DC power brick with flyback diode protection |

---

## 📡 ESP32 Telemetry JSON Schema

The ESP32 sends periodic HTTP POST requests to `/api/telemetry` with header `x-api-key`:

```json
{
  "deviceId": "SAVE-BOX-001",
  "timestamp": "2026-10-23T12:00:00Z",
  "esp32": {
    "online": true,
    "wifiRssi": -58,
    "uptimeSeconds": 3600,
    "freeHeap": 238000,
    "chipModel": "ESP32-D0WDQ6",
    "sensorCommunicationStatus": "OK"
  },
  "temperature": {
    "valueC": 5.0,
    "targetC": 5.0,
    "sensorStatus": "OK"
  },
  "peltier": {
    "commandedOn": true,
    "confirmedOperating": true,
    "dutyPercent": 75,
    "mode": "ACTIVE"
  },
  "fan": {
    "running": true,
    "rpm": 2400,
    "pwmPercent": 80,
    "mode": "AUTOMATIC"
  },
  "electrical": {
    "available": false
  }
}
```

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Start full-stack server (Backend API + Frontend dev server)
npm run dev

# Build for production
npm run build
```
