import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  playPomodoroCue,
  unlockPomodoroAudio,
  volumeToPeakGain,
} from "./pomodoroSound";

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }
}

describe("pomodoro sound", () => {
  const OriginalAudioContext = globalThis.AudioContext;

  beforeEach(() => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (OriginalAudioContext) {
      globalThis.AudioContext = OriginalAudioContext;
    }
  });

  it("maps volume percent to peak gain", () => {
    expect(volumeToPeakGain(0)).toBe(0);
    expect(volumeToPeakGain(100)).toBeCloseTo(0.18);
    expect(volumeToPeakGain(50)).toBeCloseTo(0.09);
    expect(volumeToPeakGain(200)).toBeCloseTo(0.18);
  });

  it("unlocks a shared audio context without throwing", () => {
    expect(() => unlockPomodoroAudio()).not.toThrow();
  });

  it("schedules start and end cues without throwing", () => {
    expect(() => playPomodoroCue("start", 70)).not.toThrow();
    expect(() => playPomodoroCue("end", 40)).not.toThrow();
  });
});
