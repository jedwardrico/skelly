#!/usr/bin/env python3
"""Generates the no-ElevenLabs audio test clips in data/audio/.

  test_tone.wav  16 kHz mono PCM - no decoder involved, so it isolates the
                 wiring/I2S path.
  test_tone.mp3  44.1 kHz mono 64 kbps - same format ElevenLabs returns, so it
                 exercises the MP3 decoder too (needs ffmpeg).

The clip is built to be diagnosable by ear: a steady 440 Hz tone (garbling
shows up as crackle or pitch wobble), silence (wiring noise shows up as
hiss/buzz), a sweep, then speech-like beeps (jaw sync).
Keep the layout in sync with app/src/api/testAudio.ts.
"""
import math, os, struct, subprocess, sys, wave

RATE = 16000
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "audio")


def segment(freq0, freq1, seconds, amp=0.5):
    n = int(RATE * seconds)
    phase = 0.0
    out = []
    for i in range(n):
        f = freq0 + (freq1 - freq0) * i / n
        phase += 2 * math.pi * f / RATE
        fade = min(1.0, i / 160, (n - i) / 160)  # avoid clicks at the edges
        out.append(int(amp * fade * 32767 * math.sin(phase)))
    return out


def build():
    s = segment(440, 440, 1.5)
    s += [0] * int(RATE * 0.5)
    s += segment(200, 2000, 2.0)
    s += [0] * int(RATE * 0.5)
    for f in (330, 392, 523, 392):
        s += segment(f, f, 0.18) + [0] * int(RATE * 0.12)
    return s


def main():
    os.makedirs(OUT, exist_ok=True)
    wav_path = os.path.join(OUT, "test_tone.wav")
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", x) for x in build()))
    print("wrote", wav_path)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-ar", "44100",
             "-ac", "1", "-b:a", "64k", os.path.join(OUT, "test_tone.mp3")],
            check=True)
        print("wrote test_tone.mp3")
    except (OSError, subprocess.CalledProcessError) as e:
        sys.exit(f"ffmpeg failed, skipped mp3: {e}")


if __name__ == "__main__":
    main()
