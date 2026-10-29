// Mirrors kAnimParams in the firmware's lib/AnimationSettings. The device is
// the source of truth for current values and defaults (GET /api/animation);
// this only supplies labels, grouping and slider ranges. Keep ranges in sync.

export interface AnimParam {
  key: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface AnimGroup {
  title: string;
  params: AnimParam[];
}

export const ANIMATION_GROUPS: AnimGroup[] = [
  {
    title: 'Jaw',
    params: [
      { key: 'jawGain', label: 'Opening gain', hint: 'Higher opens the jaw wider for the same loudness.', min: 1, max: 12, step: 0.1, unit: '×' },
      { key: 'jawOpenFloor', label: 'Minimum open', hint: 'Fraction of the range the jaw stays open to while speaking, so it only makes small movements toward closed.', min: 0, max: 1, step: 0.01 },
      { key: 'jawSilence', label: 'Silence threshold', hint: 'Audio quieter than this closes the jaw fully.', min: 0, max: 0.2, step: 0.005 },
      { key: 'jawAttackMs', label: 'Open speed', hint: 'Time to open. Lower is snappier.', min: 1, max: 200, step: 1, unit: 'ms' },
      { key: 'jawReleaseMs', label: 'Close smoothness', hint: 'Time to close. Higher is smoother and keeps the jaw open longer between beats.', min: 5, max: 600, step: 5, unit: 'ms' },
      { key: 'jawUpdateMs', label: 'Update interval', hint: 'Minimum time between jaw servo moves.', min: 40, max: 250, step: 5, unit: 'ms' },
    ],
  },
  {
    title: 'Eyes: variety',
    params: [
      { key: 'eyeDartChance', label: 'Dart chance', hint: 'How often a move is a quick dart instead of a slow wander.', min: 0, max: 1, step: 0.05 },
      { key: 'eyeIntervalMinMs', label: 'Pause (min)', hint: 'Shortest pause between eye moves.', min: 100, max: 10000, step: 50, unit: 'ms' },
      { key: 'eyeIntervalMaxMs', label: 'Pause (max)', hint: 'Longest pause between eye moves.', min: 100, max: 10000, step: 50, unit: 'ms' },
    ],
  },
  {
    title: 'Eyes: wander (slow glance)',
    params: [
      { key: 'eyeWanderTilt', label: 'Tilt range', hint: 'Degrees up/down from rest.', min: 0, max: 90, step: 1, unit: '°' },
      { key: 'eyeWanderSpeed', label: 'Speed', hint: 'Lower is smoother and lazier.', min: 5, max: 400, step: 5, unit: '°/s' },
    ],
  },
  {
    title: 'Eyes: dart (quick flick)',
    params: [
      { key: 'eyeDartTilt', label: 'Tilt range', hint: 'Degrees up/down from rest.', min: 0, max: 90, step: 1, unit: '°' },
      { key: 'eyeDartSpeed', label: 'Speed', hint: 'Higher is snappier.', min: 5, max: 600, step: 5, unit: '°/s' },
    ],
  },
  {
    title: 'Eyes: after speaking',
    params: [
      { key: 'eyeReturnSpeed', label: 'Return-to-rest speed', hint: 'How fast the eyes ease back to zero when speech ends.', min: 5, max: 400, step: 5, unit: '°/s' },
    ],
  },
];

export type AnimationValues = Record<string, number>;
