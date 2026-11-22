/**
 * ClawBot WALL-E Twin — ESP32 USB-C Serial <-> TB6612FNG Differential-Drive Firmware
 *
 * Hardware Architecture ($25 DIY Mini WALL-E):
 *   [OpenClaw Gateway + Cerebras]
 *          |  (Wi-Fi / Local Loopback SSE)
 *   [Tilted Android Smartphone ("Face & Eyes + Camera + USB Host")]
 *          |  (USB-C OTG Serial @ 115200 baud, newline-delimited JSON @ 20-60 Hz)
 *   [ESP32 DevKit V1] ---> [TB6612FNG Dual H-Bridge] ---> [Left & Right 3-6V TT Gearmotors]
 *                     ---> [HC-SR04 Ultrasonic Sensor]
 *                     ---> [4x AA Battery Pack (6V Motor VM) + Rear Caster Wheel]
 *
 * Inbound JSON Packet Schema (matches shared/types.ts `Esp32Packet`):
 *   {"t":1732234000,"l":0.74,"r":0.52,"led":"cyan","wd":500,"mode":"follow_dog"}\n
 *
 * Safety Features:
 *   1. 500ms Hardware Watchdog: automatically short-brakes both motors if USB-C
 *      serial packets stop arriving (e.g., cable unplugged or app backgrounded).
 *   2. Ultrasonic Reflex Brake: halts forward motion if an obstacle is < 12 cm ahead.
 *   3. Zero external library dependencies: compiles out-of-the-box in Arduino IDE / PlatformIO
 *      for any ESP32 board.
 */

#include <Arduino.h>

// ======================= PIN DEFINITIONS (ESP32 DevKit V1) =======================
// TB6612FNG Dual Motor Driver
static const int PIN_PWMA = 25;  // Left motor PWM speed
static const int PIN_AIN1 = 26;  // Left motor direction A
static const int PIN_AIN2 = 27;  // Left motor direction B
static const int PIN_STBY = 14;  // H-Bridge standby (HIGH = enabled, LOW = disabled)
static const int PIN_BIN1 = 12;  // Right motor direction A
static const int PIN_BIN2 = 13;  // Right motor direction B
static const int PIN_PWMB = 33;  // Right motor PWM speed

// HC-SR04 Front Ultrasonic Rangefinder
static const int PIN_TRIG = 32;
static const int PIN_ECHO = 35;

// Status LED (Onboard GPIO 2)
static const int PIN_LED  = 2;

// ======================= CONSTANTS & STATE =======================
static const unsigned long SERIAL_BAUD             = 115200;
static const unsigned long DEFAULT_WATCHDOG_MS     = 500;
static const unsigned long MIN_WATCHDOG_MS         = 150;
static const unsigned long MAX_WATCHDOG_MS         = 2000;
static const unsigned long TELEMETRY_INTERVAL_MS   = 100;
static const float         EMERGENCY_STOP_CM       = 12.0f;

static float         targetLeftPwm      = 0.0f;
static float         targetRightPwm     = 0.0f;
static unsigned long watchdogTimeoutMs  = DEFAULT_WATCHDOG_MS;
static unsigned long lastPacketMillis   = 0;
static unsigned long lastTelemetryMillis = 0;
static bool          watchdogTripped    = true;
static float         lastUltrasonicCm   = 120.0f;
static String        activeLedColor     = "cyan";
static String        activeMode         = "idle";
static String        rxBuffer           = "";

// ======================= HELPER: LIGHTWEIGHT JSON EXTRACTORS =======================
static bool extractJsonFloat(const String& json, const char* key, float& outVal) {
  String pattern = String("\"") + key + "\":";
  int idx = json.indexOf(pattern);
  if (idx < 0) return false;
  int start = idx + pattern.length();
  while (start < (int)json.length() && (json[start] == ' ' || json[start] == '\t')) {
    start++;
  }
  int end = start;
  while (end < (int)json.length() &&
         (isDigit(json[end]) || json[end] == '-' || json[end] == '+' || json[end] == '.')) {
    end++;
  }
  if (end <= start) return false;
  outVal = json.substring(start, end).toFloat();
  return true;
}

static bool extractJsonString(const String& json, const char* key, String& outVal) {
  String pattern = String("\"") + key + "\":\"";
  int idx = json.indexOf(pattern);
  if (idx < 0) return false;
  int start = idx + pattern.length();
  int end = json.indexOf('\"', start);
  if (end < 0) return false;
  outVal = json.substring(start, end);
  return true;
}

// ======================= MOTOR CONTROL (TB6612FNG) =======================
static void setSingleMotor(int pinIn1, int pinIn2, int pinPwm, float normalizedPwm) {
  float clamped = constrain(normalizedPwm, -1.0f, 1.0f);
  int duty = (int)roundf(fabsf(clamped) * 255.0f);

  // Deadband guard to prevent motor hum at tiny duty cycles
  if (duty < 12) {
    // Active short-brake on TB6612FNG (IN1 = HIGH, IN2 = HIGH, PWM = 0)
    digitalWrite(pinIn1, HIGH);
    digitalWrite(pinIn2, HIGH);
    analogWrite(pinPwm, 0);
    return;
  }

  if (clamped > 0.0f) {
    digitalWrite(pinIn1, HIGH);
    digitalWrite(pinIn2, LOW);
  } else {
    digitalWrite(pinIn1, LOW);
    digitalWrite(pinIn2, HIGH);
  }
  analogWrite(pinPwm, duty);
}

static void brakeAllMotors() {
  digitalWrite(PIN_AIN1, HIGH);
  digitalWrite(PIN_AIN2, HIGH);
  analogWrite(PIN_PWMA, 0);

  digitalWrite(PIN_BIN1, HIGH);
  digitalWrite(PIN_BIN2, HIGH);
  analogWrite(PIN_PWMB, 0);
}

static void applyDifferentialDrive(float leftPwm, float rightPwm) {
  digitalWrite(PIN_STBY, HIGH);

  // Ultrasonic forward collision guard
  bool drivingForward = (leftPwm > 0.05f && rightPwm > 0.05f);
  if (drivingForward && lastUltrasonicCm < EMERGENCY_STOP_CM) {
    brakeAllMotors();
    return;
  }

  setSingleMotor(PIN_AIN1, PIN_AIN2, PIN_PWMA, leftPwm);
  setSingleMotor(PIN_BIN1, PIN_BIN2, PIN_PWMB, rightPwm);
}

// ======================= ULTRASONIC SENSOR (HC-SR04) =======================
static float readUltrasonicCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // 15ms timeout (~250 cm max range) so loop stays responsive
  unsigned long durationUs = pulseIn(PIN_ECHO, HIGH, 15000);
  if (durationUs == 0) {
    return 180.0f;
  }
  float cm = (durationUs * 0.0343f) * 0.5f;
  return constrain(cm, 2.0f, 250.0f);
}

// ======================= PACKET HANDLER =======================
static void processPacket(const String& line) {
  float l = 0.0f;
  float r = 0.0f;
  if (!extractJsonFloat(line, "l", l) || !extractJsonFloat(line, "r", r)) {
    return;
  }

  targetLeftPwm  = constrain(l, -1.0f, 1.0f);
  targetRightPwm = constrain(r, -1.0f, 1.0f);

  float wd = (float)DEFAULT_WATCHDOG_MS;
  if (extractJsonFloat(line, "wd", wd)) {
    watchdogTimeoutMs = (unsigned long)constrain(wd, (float)MIN_WATCHDOG_MS, (float)MAX_WATCHDOG_MS);
  }

  extractJsonString(line, "led", activeLedColor);
  extractJsonString(line, "mode", activeMode);

  lastPacketMillis = millis();
  watchdogTripped  = false;
  digitalWrite(PIN_LED, HIGH);
}

// ======================= ARDUINO SETUP & LOOP =======================
void setup() {
  Serial.begin(SERIAL_BAUD);
  rxBuffer.reserve(256);

  pinMode(PIN_PWMA, OUTPUT);
  pinMode(PIN_AIN1, OUTPUT);
  pinMode(PIN_AIN2, OUTPUT);
  pinMode(PIN_STBY, OUTPUT);
  pinMode(PIN_BIN1, OUTPUT);
  pinMode(PIN_BIN2, OUTPUT);
  pinMode(PIN_PWMB, OUTPUT);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LED, OUTPUT);

  digitalWrite(PIN_STBY, HIGH);
  brakeAllMotors();
  digitalWrite(PIN_LED, LOW);

  Serial.println("{\"boot\":\"clawbot-walle-esp32\",\"baud\":115200,\"watchdogMs\":500}");
}

void loop() {
  // 1. Drain USB-C Serial buffer for incoming Esp32Packet JSON lines
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (rxBuffer.length() > 2) {
        processPacket(rxBuffer);
      }
      rxBuffer = "";
    } else if (rxBuffer.length() < 240) {
      rxBuffer += c;
    }
  }

  unsigned long now = millis();

  // 2. Enforce 500ms Hardware Safety Watchdog
  if (!watchdogTripped && (now - lastPacketMillis > watchdogTimeoutMs)) {
    watchdogTripped = true;
    targetLeftPwm   = 0.0f;
    targetRightPwm  = 0.0f;
    brakeAllMotors();
    digitalWrite(PIN_LED, LOW);
  }

  // 3. Drive motors or keep braked if watchdog tripped
  if (watchdogTripped) {
    brakeAllMotors();
  } else {
    applyDifferentialDrive(targetLeftPwm, targetRightPwm);
  }

  // 4. Periodic ultrasonic reading & USB-C serial telemetry ACK (10 Hz)
  if (now - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMillis = now;
    lastUltrasonicCm = readUltrasonicCm();

    Serial.print("{\"ok\":true,\"l\":");
    Serial.print(targetLeftPwm, 2);
    Serial.print(",\"r\":");
    Serial.print(targetRightPwm, 2);
    Serial.print(",\"cm\":");
    Serial.print(lastUltrasonicCm, 1);
    Serial.print(",\"wdOk\":");
    Serial.print(watchdogTripped ? "false" : "true");
    Serial.print(",\"mode\":\"");
    Serial.print(activeMode);
    Serial.println("\"}");
  }
}
