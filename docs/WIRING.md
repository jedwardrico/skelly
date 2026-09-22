# Wiring

Target board: a standard ESP32-WROOM-32 dev module (any "ESP32 Dev Kit" style
board). It's the safest default because it's the board BluePad32 and its
examples target most directly, and it has both classic Bluetooth and BLE for
whatever controller/protocol the 8BitDo Ultimate ends up pairing with.

All pin numbers below live in `include/Config.h` — change them there, not in
code, if your wiring differs.

## Power

Servos and the amplifier both want their own clean power, not the ESP32's
onboard 3.3V regulator:

- Run a separate 5V (or the servos' rated voltage) supply for the PCA9685's
  `V+` terminal and servo power rail, sized for however many servos you're
  driving simultaneously (a small skull rig of 3-5 micro servos is usually
  fine on a 2-3A 5V supply; add margin if you add more).
- Power the MAX98357A from 5V (`Vin`) for full volume headroom; it'll also run
  off 3.3V at reduced output.
- Common ground everything: ESP32 GND, PCA9685 GND *and* V+ GND, MAX98357A
  GND, and the servo power supply GND all need to meet at one point.

## PCA9685 (servo driver, I2C)

| PCA9685 pin | ESP32 pin       |
|-------------|-----------------|
| VCC (logic) | 3.3V            |
| GND         | GND             |
| SDA         | GPIO 21         |
| SCL         | GPIO 22         |
| V+          | External 5V (servo supply) |
| GND (power) | External supply GND |

Plug servos into channels 0-4 (or however many you use) matching the
`channel` values in `SERVO_CHANNELS` in `include/Config.h`:

| Channel | Name        | Suggested use     |
|---------|-------------|--------------------|
| 0       | `jaw`       | Jaw hinge          |
| 1       | `neck_pan`  | Neck left/right    |
| 2       | `neck_tilt` | Neck up/down       |
| 3       | `eye_pan`   | Eyes left/right (both eyes, shared servo) |
| 4       | `eye_tilt`  | Eyes up/down (both eyes, shared servo)    |

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

Speaker: any small 4-8 ohm speaker rated for the MAX98357A's few watts fits
inside most 3D-printed skull cavities.

## Pin summary

Chosen specifically so the I2C and I2S buses don't share any pins:

- I2C (PCA9685): GPIO 21 (SDA), GPIO 22 (SCL)
- I2S (MAX98357A): GPIO 26 (BCLK), GPIO 25 (LRC), GPIO 27 (DIN), GPIO 14 (amp enable, optional)

GPIO 21/22/25/26/27 are all safe general-purpose pins on the WROOM-32 module
(no strapping/flash conflicts). If you move things around, avoid GPIO 6-11
(connected to the module's internal flash) and treat GPIO 0/2/5/12/15 as
strapping pins to leave alone unless you know what you're doing with them.
