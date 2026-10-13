import type { ServoName } from './skellyClient';

// Mirrors SERVO_CHANNELS in the firmware's include/Config.h. Keep in sync if
// the hardware rig changes - this only affects slider ranges/labels in the
// app, the ESP32 clamps to its own configured min/max regardless.
export const SERVO_LIST: { name: ServoName; label: string; min: number; max: number; rest: number; hidden?: boolean }[] = [
  { name: 'jaw', label: 'Jaw', min: 0, max: 30, rest: 0 },
  { name: 'eye_pan', label: 'Eye Pan', min: 0, max: 180, rest: 90 },
  { name: 'eye_tilt', label: 'Eye Tilt', min: 0, max: 180, rest: 90 },
];

// Servos to show in manual control / calibration UIs.
export const VISIBLE_SERVO_LIST = SERVO_LIST.filter((s) => !s.hidden);
