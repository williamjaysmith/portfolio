"use client";

/**
 * One short tone with a reminder (008 FR-815, R813).
 *
 * Skylight plays a chime with its reminder pop-up [VERIFIED](36836043247131)
 * and has exactly one, with no picker — so this has one too, and the switch
 * ships OFF because Phase 1 chose a silent display.
 *
 * It is SYNTHESISED rather than played from a file. Two notes from an
 * oscillator are a few lines and no asset: nothing to download before the first
 * reminder of the day, nothing to cache, and nothing to go missing. A recorded
 * chime would be a binary in `public/` that only ever plays for a second.
 *
 * Every path is silent-on-failure, which is constitution §VI applied to sound:
 * a browser that blocks audio until it has seen a gesture, a device with no
 * audio output, a private mode that refuses the API — none of them is an error
 * worth showing a household. The banner is the reminder; the chime is a
 * courtesy on top of it.
 */

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  try {
    context = new AudioContext();
    return context;
  } catch {
    // No Web Audio here. Every later call short-circuits on the same null.
    return null;
  }
}

/** Two notes, a rising third, ~180ms in all. */
const NOTES = [
  { hz: 880, at: 0, seconds: 0.09 },
  { hz: 1174.7, at: 0.09, seconds: 0.12 },
];

export function playChime(): void {
  const audio = audioContext();
  if (!audio) return;

  try {
    // A browser that has not yet seen a user gesture leaves the context
    // suspended; resuming is a no-op when it is already running.
    void audio.resume();

    for (const note of NOTES) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + note.at;

      oscillator.type = "sine";
      oscillator.frequency.value = note.hz;
      // Ramped rather than switched, so it reads as a chime and not a click.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.seconds);

      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + note.seconds + 0.02);
    }
  } catch {
    // Silence is the correct degradation, not a thrown error on a wall tablet.
  }
}
