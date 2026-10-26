# Wiring

Target board: an ESP32-WROVER dev module (any "ESP32 Dev Kit" style board
built around WROVER instead of WROOM). It's the default because it adds
PSRAM and more flash than WROOM - headroom for a bigger LittleFS audio
library now, and enough spare GPIOs/PSRAM to wire up an OV2640-style camera
module later. It's still the same ESP32 chip BluePad32 targets, with both
classic Bluetooth and BLE for whatever controller/protocol the 8BitDo
Ultimate ends up pairing with.

All pin numbers below live in `include/Config.h` — change them there, not in
code, if your wiring differs.

## Power

Servos and the amplifier both want their own clean power, not the ESP32's
onboard 3.3V regulator:

- Run a separate 5V (or the servos' rated voltage) supply into the Freenove
  breakout board's screw terminals, sized for however many servos you're
  driving simultaneously (a small skull rig of 3-5 micro servos is usually
  fine on a 2-3A 5V supply; add margin if you add more).
- If running from a battery, put a toggle (SPST) switch in series with the
  battery's positive lead, between the battery and the ESP32 breakout board's
  power input, so the whole rig can be switched on and off. Switch the
  positive side only; leave the battery negative wired straight to the common
  ground.
- Power the MAX98357A from 5V (`Vin`) for full volume headroom; it'll also run
  off 3.3V at reduced output.
- Common ground everything: ESP32 GND, the breakout board's power-rail GND,
  MAX98357A GND, and the servo power supply GND all need to meet at one
  point.

## Servos (direct GPIO, via the Freenove breakout board)

No PCA9685 or other I2C PWM driver is in the loop - each servo's signal wire
plugs straight into one of the breakout board's GPIO terminal blocks, which
just passes the ESP32's own pin header through to screw terminals (plus a
regulated power rail for the servos' V+/GND). The ESP32 drives every servo
itself over software PWM (via the `ESP32Servo` library), one GPIO per servo:

| Servo pin (signal) | ESP32 GPIO |
|---------------------|------------|
| `jaw`               | GPIO 13    |
| `eye_pan`           | GPIO 18    |
| `eye_tilt`          | GPIO 19    |

Servo V+ and GND go to the breakout board's servo power rail (fed from the
external 5V supply above), not to the ESP32's own 5V/3.3V pins.

These GPIOs match the `pin` values in `SERVO_CHANNELS` in
`include/Config.h` - change them there (and in this table) if your wiring
differs. They're chosen to avoid the I2S bus below, UART0 (GPIO 0/1/3), the
flash pins (GPIO 6-11), and the strapping pins (GPIO 0/2/5/12/15).

The two eyeballs are mechanically linked (a single yoke/linkage), so each axis
moves both eyes together — there's no independent per-eye servo.

Add/remove rows in `SERVO_CHANNELS` (and this table) to match your rig; the
firmware sizes every internal array off `SERVO_CHANNEL_COUNT` automatically.

## MAX98357A (I2S amplifier)

| MAX98357A pin | ESP32 pin |
|----------------|-----------|
| VIN            | 5V        |
| GND            | GND       |
| BCLK           | GPIO 26   |
| LRC (WS)       | GPIO 25   |
| DIN            | GPIO 27   |
| SD (shutdown)  | GPIO 14 (optional; see below) |
| GAIN           | leave floating for 9dB, or see MAX98357A datasheet for other presets |

The `SD` pin doubles as MAX98357A's mono-mix select on some breakout
silkscreens — check your specific breakout's datasheet. Tying `SD` to a GPIO
(as wired above) lets firmware mute the amp between lines instead of it idly
hissing; tie it straight to 3.3V instead and set `I2S_AMP_ENABLE_PIN` to `-1`
in `Config.h` if you'd rather not use a GPIO for it.

### Debugging garbled audio

Run `python3 tools/make_test_audio.py` (writes `data/audio/test_tone.wav` and
`test_tone.mp3`; no ElevenLabs credits needed), then work down this list:

1. `pio run --target uploadfs`, play `test_tone.wav` (no network, no decoder):
   garbled/noisy here = wiring or power (loose BCLK/LRC/DIN jumper, no common
   ground, amp sharing a noisy rail with the servos).
2. Play `test_tone.mp3` from flash: clean WAV but garbled MP3 = decode
   underruns or sample-rate trouble, not wiring or transfer.
3. In the app's Speech tab, "Send test tone to skull" uploads a generated WAV
   over WiFi and compares CRCs: a mismatch = corrupted transfer.

Speaker: any small 4-8 ohm speaker rated for the MAX98357A's few watts fits
inside most 3D-printed skull cavities.

## Pin summary

Chosen specifically so the servo pins and the I2S bus don't share any pins:

- Servos: GPIO 13 (jaw), GPIO 18 (eye_pan), GPIO 19 (eye_tilt)
- I2S (MAX98357A): GPIO 26 (BCLK), GPIO 25 (LRC), GPIO 27 (DIN), GPIO 14 (amp enable, optional)

GPIO 13/18/19/25-27 are all safe general-purpose pins on a WROVER-B/-E
module (no strapping/flash/PSRAM conflicts). If you move things around,
avoid GPIO 6-11 (connected to the module's internal flash), treat GPIO
0/2/5/12/15 as strapping pins to leave alone unless you know what you're
doing with them.
