/** Web Audio phase cues: short dual tones, no asset pack. */

export type PomodoroCue = "start" | "end";

const MAX_PEAK_GAIN = 0.18;
const START_CUE_DELAY_MS = 380;

let sharedContext: AudioContext | null = null;
let pendingStartTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioContext() {
  const AudioCtx =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioCtx();
  }
  return sharedContext;
}

/** Call from a user gesture so later timer cues are allowed to play. */
export function unlockPomodoroAudio() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // Audio is optional.
  }
}

/** Map 0-100 UI volume to a safe oscillator peak gain. */
export function volumeToPeakGain(volume: number) {
  const clamped = Math.min(
    100,
    Math.max(0, Number.isFinite(volume) ? volume : 0),
  );
  return (clamped / 100) * MAX_PEAK_GAIN;
}

function scheduleTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number,
) {
  if (peakGain <= 0.0001) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function scheduleCue(ctx: AudioContext, cue: PomodoroCue, volume: number) {
  const peak = volumeToPeakGain(volume);
  if (peak <= 0.0001) return;
  const t0 = ctx.currentTime;
  if (cue === "start") {
    // Ascending soft pair marks a phase beginning.
    scheduleTone(ctx, 523.25, t0, 0.12, peak * 0.85);
    scheduleTone(ctx, 659.25, t0 + 0.14, 0.16, peak);
    return;
  }
  // Brighter pair marks phase complete / skip.
  scheduleTone(ctx, 880, t0, 0.14, peak);
  scheduleTone(ctx, 1174.66, t0 + 0.16, 0.18, peak * 0.85);
}

export function playPomodoroCue(cue: PomodoroCue, volume = 70) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const play = () => scheduleCue(ctx, cue, volume);
    if (ctx.state === "suspended") {
      void ctx
        .resume()
        .then(play)
        .catch(() => {
          // Autoplay policy may still block.
        });
      return;
    }
    play();
  } catch {
    // Audio is optional.
  }
}

/** Prefer playPomodoroCue("end", volume). */
export function playPhaseCompleteSound(volume = 70) {
  playPomodoroCue("end", volume);
}

export function playPhaseEndThenMaybeStart(
  volume: number,
  autoStartNext: boolean,
) {
  playPomodoroCue("end", volume);
  if (!autoStartNext) return;
  if (pendingStartTimer) clearTimeout(pendingStartTimer);
  pendingStartTimer = setTimeout(() => {
    pendingStartTimer = null;
    playPomodoroCue("start", volume);
  }, START_CUE_DELAY_MS);
}
