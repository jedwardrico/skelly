# Adding BluePad32 / 8BitDo Ultimate support

`lib/GamepadController` and the `esp32_bluepad32` environment in
`platformio.ini` are a scaffold, not a finished build - they intentionally
**do not build yet**. Here's why, and what to actually do about it.

## Why this isn't just wired up already

BluePad32 (https://bluepad32.readthedocs.io/en/latest/) needs Bluetooth
stack support (BTstack) that Espressif's stock `framework-arduinoespressif32`
package doesn't ship. Their Arduino integration works by overriding that
package with a BluePad32-flavored build of the Arduino-ESP32 core via
PlatformIO's `platform_packages`. The exact download URL for that override
is tied to a specific BluePad32 release and changes over time, so hardcoding
one here would silently go stale. Get the current one straight from the
docs you linked:

https://bluepad32.readthedocs.io/en/latest/plat_arduino/

## Steps

1. Read the Arduino platform page above and note:
   - the current `platform_packages` override line for
     `framework-arduinoespressif32`
   - whether a `lib_deps` entry (or a git submodule) is expected for the
     BluePad32 library itself, and its current version/URL
   - the required `board_build.partitions` value, if any
2. Fill those into the `[env:esp32_bluepad32]` section of `platformio.ini`
   (the `TODO(BLUEPAD32)` comments mark exactly where).
3. Build just that environment to sanity-check the toolchain override before
   touching any code:
   ```
   pio run -e esp32_bluepad32
   ```
4. Open `lib/GamepadController/GamepadController.cpp` and double-check the
   Bluepad32 API calls against the version you pulled in - the header notes
   which API shape (`ControllerPtr` / `BP32.setup()` / `BP32.update()`) it
   was written against, but Bluepad32 has renamed things before (older
   examples use `GamepadPtr` instead of `ControllerPtr`).
5. Pair the 8BitDo Ultimate controller. Put it in Bluetooth mode (check the
   8BitDo manual for your controller's mode switch - not the 2.4G dongle
   mode, which BluePad32 can't see) and it should show up like any other
   Bluetooth gamepad; BluePad32's docs have a general pairing walkthrough if
   it doesn't connect on the first try.
6. Flash `-e esp32_bluepad32` instead of the default `esp32dev` env. The
   default env is untouched and keeps building/working with just WiFi
   control the whole time.

## What's already there to build on

- `GamepadController::begin()`/`update()` - connect/disconnect handling and
  a per-loop input poll, guarded entirely behind `#ifdef ENABLE_BLUEPAD32`
  so it's a no-op in the default build.
- A starter mapping: right stick -> neck pan/tilt, left stick while holding
  L1 -> direct jaw puppeteering (overriding the audio-envelope jaw sync
  while held), face buttons -> preset speech clips via the same
  `AudioPlayer` the WiFi control API uses.
- `g_jawOverride`, so `main.cpp`'s audio-driven jaw sync backs off while a
  human is puppeteering the jaw by hand.

Treat the mapping as a starting point - button layout, dead zones, and which
axis drives what are all easy to retune once you're actually holding the
controller next to the skull.
