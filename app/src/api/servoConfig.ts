import type { ServoName } from './skellyClient';

// Mirrors SERVO_CHANNELS in the firmware's include/Config.h. Keep in sync if
// the hardware rig changes - this only affects slider ranges/labels in the
// app, the ESP32 clamps to its own configured min/max regardless.
export const SERVO_LIST: { name: ServoName; label: string; min: number; max: number; rest: number; hidden?: boolean }[] = [
  { name: 'jaw', label: 'Jaw', min: 0, max: 55, rest: 0 },
  // Neck isn't physically built yet - hidden from the UI until it is.
  { name: 'neck_pan', label: 'Neck Pan', min: 30, max: 150, rest: 90, hidden: true },
  { name: 'neck_tilt', label: 'Neck Tilt', min: 60, max: 120, rest: 90, hidden: true },
  { name: 'eye_pan', label: 'Eye Pan', min: 0, max: 180, rest: 90 },
  { name: 'eye_tilt', label: 'Eye Tilt', min: 0, max: 180, rest: 90 },
];

// Servos to show in manual control / calibration UIs.
export const VISIBLE_SERVO_LIST = SERVO_LIST.filter((s) => !s.hidden);
