// SPDX-License-Identifier: MIT
// See docs/PROVENANCE.md for upstream attribution and source restoration.
import mitt from 'mitt';
import { getTransport, start as startAudio, PolySynth, Synth, Frequency, now as toneNow } from 'tone';
import { WebMidi } from 'webmidi';
import { createSampledMetronome } from './runtime/sampled-metronome.mjs';
import { createTempoLabelReader } from './runtime/visual-sync.mjs';
var PRACTICE_CONTEXT_PREFIX = `piano-practice-context-v1:`;
function normalizePracticeContext(e, t) {
  let n = (e, t) => typeof e == `number` && Number.isFinite(e) ? e : t,
    r = e => Math.max(0, Math.min(t, e)),
    i = e.loopStart == null ? null : r(n(e.loopStart, 0)),
    a = e.loopEnd == null ? null : r(n(e.loopEnd, 0));
  (i === null || a === null || a <= i) && (i = null, a = null);
  let o = e.mode === `follow` || e.mode === `test` ? e.mode : `learn`;
  return {
    version: 1,
    positionSeconds: r(n(e.positionSeconds, 0)),
    tempoMultiplier: Math.max(.25, Math.min(2, n(e.tempoMultiplier, 1))),
    loopStart: i,
    loopEnd: a,
    mode: o,
    practiceHand: e.practiceHand === `left` ? `left` : `right`,
    waitMode: o !== `test` && e.waitMode !== false
  };
}
function readPracticeContext(e, t) {
  try {
    return normalizePracticeContext(JSON.parse(window.localStorage.getItem(PRACTICE_CONTEXT_PREFIX + e) || `{}`), t);
  } catch {
    return normalizePracticeContext({}, t);
  }
}
function savePracticeContext(e, t) {
  window.localStorage.setItem(PRACTICE_CONTEXT_PREFIX + e, JSON.stringify(t));
}
function removePracticeContext(e) {
  window.localStorage.removeItem(PRACTICE_CONTEXT_PREFIX + e);
}
function keySignatureToLabel(e) {
  return `${e.key} ${e.scale}`;
}
function ticksToSeconds(e, t, n) {
  let r = 0,
    i = 0;
  for (let a = 0; a < t.length; a++) {
    let o = t[a];
    if (o.tick > e) break;
    let s = t[a + 1],
      c = s && s.tick <= e ? s.tick : e;
    if (r += (c - i) * (60 / (o.bpm * n)), i = c, !s || s.tick > e) break;
  }
  return r;
}
function computeMeasureSeconds(e, t, n, r) {
  if (!e.length || !t.length) return [];
  let i = [],
    a = 0,
    o = 0;
  for (;;) {
    for (; o + 1 < e.length && e[o + 1].tick <= a;) o++;
    let s = e[o],
      c = Math.round(n * 4 * s.numerator / s.denominator),
      l = ticksToSeconds(a, t, n);
    if (l > r + 1 || (i.push(l), a += c, i.length > 2e3)) break;
  }
  return i;
}
function computeBeatSeconds(e, t, n, r) {
  if (!e.length || !t.length) return [];
  let i = [],
    a = 0,
    o = 0;
  for (;;) {
    for (; o + 1 < e.length && e[o + 1].tick <= a;) o++;
    let s = e[o],
      c = Math.round(n * 4 / s.denominator),
      l = ticksToSeconds(a, t, n);
    if (l > r + 1 || (i.push(l), a += c, i.length > 2e4)) break;
  }
  return i;
}
var SHARP_NAMES = [`C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B`];
var FLAT_NAMES = [`C`, `D♭`, `D`, `E♭`, `E`, `F`, `G♭`, `G`, `A♭`, `A`, `B♭`, `B`];
function midiToPitch(e, t = false) {
  let n = t ? FLAT_NAMES : SHARP_NAMES,
    r = Math.floor(e / 12) - 1;
  return `${n[e % 12]}${r}`;
}
function pitchClassName(e, t = false) {
  return (t ? FLAT_NAMES : SHARP_NAMES)[e % 12];
}
function isBlackKey(e) {
  let t = e % 12;
  return [1, 3, 6, 8, 10].includes(t);
}
function measuresFor(e) {
  if (e.measures?.length) return e.measures;
  let t = computeMeasureSeconds(e.timeSignatures, e.tempoMap, e.ppq, e.totalDuration).filter(t => t < e.totalDuration),
    n = computeBeatSeconds(e.timeSignatures, e.tempoMap, e.ppq, e.totalDuration);
  return t.map((r, i) => {
    let a = Math.min(e.totalDuration, t[i + 1] ?? e.totalDuration);
    return {
      index: i,
      displayNumber: String(i + 1),
      startTick: 0,
      endTick: 0,
      startSeconds: r,
      endSeconds: a,
      beatSeconds: n.filter(e => e >= r && e < a)
    };
  });
}
function measureAt(e, t) {
  let n = measuresFor(e);
  return n.find(e => t >= e.startSeconds && t < e.endSeconds) ?? n.at(-1);
}
function quickLoop(e, t, n) {
  let r = measuresFor(e),
    i = measureAt(e, t);
  return i ? [i.startSeconds, Math.min(e.totalDuration, r[Math.min(r.length - 1, i.index + n - 1)].endSeconds)] : [0, e.totalDuration];
}
var effectiveBpm = createTempoLabelReader();
function upcomingTargets(e, t, n, r) {
  let i = e.find(e => e.startSeconds >= t - .03 && !n.has(e.id));
  if (!i || i.startSeconds > t + r) return [];
  let a = new Set();
  return e.filter(e => Math.abs(e.startSeconds - i.startSeconds) < .001 && !n.has(e.id)).filter(e => a.has(e.midi) ? false : (a.add(e.midi), true));
}
var bus = mitt();
var judge = new class {
  attempts = [];
  presses = [];
  pedals = new Map();
  pedalEvents = [];
  matched = new Set();
  notes = [];
  mode = `learn`;
  tempo = 1;
  serial = 0;
  runId = 0;
  measures = [];
  start = 0;
  end = 1 / 0;
  message = ``;
  messageTime = 0;
  get lastMessage() {
    return this.message;
  }
  set lastMessage(e) {
    this.message = e, this.messageTime = performance.now();
  }
  begin(e, t, n, r, i = 0, a = 1 / 0) {
    this.runId++, this.notes = e, this.mode = t, this.tempo = n, this.measures = r, this.start = i, this.end = a, this.attempts = [], this.presses = [], this.pedalEvents = [], this.pedals.clear(), this.matched.clear(), this.lastMessage = ``;
  }
  measure(e) {
    return Math.max(1, this.measures.filter(t => t <= e + .001).length);
  }
  candidates(e) {
    return this.notes.filter(t => !this.matched.has(t.id) && t.startSeconds >= this.start - .001 && t.startSeconds < this.end && Math.abs((t.startSeconds - e) * 1e3 / this.tempo) <= 300);
  }
  on(e, t, n, r, i = 1, a) {
    if (t === 0) {
      this.off(e, n, i);
      return;
    }
    let o = (a ?? this.candidates(r)).filter(e => !this.matched.has(e.id)).filter(t => t.midi === e).sort((e, t) => Math.abs(e.startSeconds - r) - Math.abs(t.startSeconds - r))[0],
      s = `press-${++this.serial}`,
      c = {
        actualPressId: s,
        actualMidi: e,
        actualOnsetMs: n,
        actualScoreSeconds: r,
        velocity: t,
        pitchStatus: o ? `correct` : `wrong`
      };
    return o ? (this.matched.add(o.id), Object.assign(c, {
      expectedNoteId: o.id,
      expectedMidi: o.midi,
      expectedScoreSeconds: o.startSeconds,
      expectedOnsetMs: n + (o.startSeconds - r) * 1e3 / this.tempo,
      expectedFingerDurationMs: (o.endSeconds - o.startSeconds) * 1e3 / this.tempo,
      hand: o.hand,
      measure: this.measure(o.startSeconds)
    }), this.mode === `test` ? (c.onsetDeltaMs = (r - o.startSeconds) * 1e3 / this.tempo, c.timingStatus = Math.abs(c.onsetDeltaMs) <= 70 ? `on_time` : c.onsetDeltaMs < 0 ? `early` : `late`, this.lastMessage = c.timingStatus === `on_time` ? `准时` : `${c.onsetDeltaMs < 0 ? `稍早` : `稍晚`} ${Math.round(c.onsetDeltaMs)} ms`) : this.lastMessage = `按对了 · ${o.pitch}${o.finger ? ` · 指法 ` + o.finger : ``}`) : (c.measure = this.measure(r), this.lastMessage = `错音 · MIDI ${e}，请看目标键`), this.attempts.push(c), this.presses.push({
      id: s,
      midi: e,
      channel: i,
      on: n,
      attempt: c
    }), c;
  }
  off(e, t, n = 1) {
    let r = this.presses.find(t => t.midi === e && t.channel === n && t.off === void 0 && !t.attempt.interrupted);
    if (!r) return;
    r.off = t;
    let i = r.attempt;
    if (i.actualFingerDurationMs = Math.max(0, t - r.on), this.pedals.get(n) || (i.soundingDurationMs = i.actualFingerDurationMs), i.expectedFingerDurationMs !== void 0 && (i.releaseDeltaMs = i.actualFingerDurationMs - i.expectedFingerDurationMs, i.expectedFingerDurationMs >= 400)) {
      let e = Math.max(90, i.expectedFingerDurationMs * .2);
      i.releaseStatus = Math.abs(i.releaseDeltaMs) <= e ? `good_release` : i.releaseDeltaMs < 0 ? `early_release` : `late_release`, this.lastMessage = i.releaseStatus === `good_release` ? `时值合适` : `${i.releaseDeltaMs < 0 ? `松早` : `松晚`} ${Math.round(Math.abs(i.releaseDeltaMs))} ms`;
    }
    return i;
  }
  pedal(e, t, n = 1) {
    if (this.pedalEvents.push({
      controller: 64,
      value: e,
      timeMs: t,
      channel: n
    }), this.pedals.set(n, e >= 64), e < 64) for (let e of this.presses) e.channel === n && e.off !== void 0 && e.attempt.soundingDurationMs === void 0 && !e.attempt.interrupted && !e.attempt.soundingInterrupted && (e.attempt.soundingDurationMs = t - e.on);
  }
  advance(e) {
    if (this.mode === `test`) for (let t of this.notes) t.startSeconds >= this.start - .001 && t.startSeconds < this.end && !this.matched.has(t.id) && (e - t.startSeconds) * 1e3 / this.tempo > 300 && (this.matched.add(t.id), this.attempts.push({
      expectedNoteId: t.id,
      expectedMidi: t.midi,
      expectedScoreSeconds: t.startSeconds,
      expectedFingerDurationMs: (t.endSeconds - t.startSeconds) * 1e3 / this.tempo,
      hand: t.hand,
      measure: this.measure(t.startSeconds),
      pitchStatus: `missed`
    }), this.lastMessage = `漏音 · ${t.pitch}`);
  }
  interrupt() {
    for (let e of this.presses) e.off === void 0 && (e.attempt.interrupted = true), e.attempt.soundingDurationMs === void 0 && (e.attempt.soundingInterrupted = true);
    this.pedals.clear();
  }
  chords() {
    let e = new Map();
    for (let t of this.notes) if (t.startSeconds >= this.start - .001 && t.startSeconds < this.end) {
      let n = Math.round(t.startSeconds * 1e3);
      e.set(n, [...(e.get(n) ?? []), t]);
    }
    return [...e.values()].filter(e => e.length > 1 && e.some(e => this.matched.has(e.id))).map(e => {
      let t = this.attempts.filter(t => e.some(e => e.id === t.expectedNoteId) && t.pitchStatus === `correct`),
        n = t.map(e => e.actualOnsetMs);
      return {
        measure: this.measure(e[0].startSeconds),
        expected: e.map(e => e.midi),
        correct: t.length,
        extra: this.attempts.filter(t => t.pitchStatus === `wrong` && t.actualScoreSeconds !== void 0 && Math.abs(t.actualScoreSeconds - e[0].startSeconds) / this.tempo <= .3).map(e => e.actualMidi),
        firstKeyMs: n.length ? Math.min(...n) : null,
        lastKeyMs: n.length ? Math.max(...n) : null,
        missing: e.filter(e => !t.some(t => t.expectedNoteId === e.id)).map(e => e.midi),
        chordSpreadMs: n.length > 1 ? Math.max(...n) - Math.min(...n) : null
      };
    });
  }
  report(e, t) {
    let n = this.attempts.filter(e => e.pitchStatus === `correct`),
      r = n.filter(e => e.onsetDeltaMs !== void 0),
      i = n.filter(e => e.releaseStatus && !e.interrupted),
      a = e => e.length ? e.reduce((e, t) => e + t, 0) / e.length : null,
      o = [...new Set(this.attempts.map(e => e.measure).filter(e => e !== void 0))].map(e => {
        let t = this.attempts.filter(t => t.measure === e);
        return {
          measure: e,
          notes: t.length,
          errors: t.filter(e => e.pitchStatus !== `correct` || e.releaseStatus === `early_release` || e.releaseStatus === `late_release`).length,
          meanAbsOnsetMs: a(t.flatMap(e => e.onsetDeltaMs === void 0 ? [] : [Math.abs(e.onsetDeltaMs)]))
        };
      }).sort((e, t) => t.errors / t.notes - e.errors / e.notes);
    return {
      schemaVersion: 1,
      runId: this.runId,
      piece: e,
      tempo: t * this.tempo,
      mode: this.mode,
      range: {
        startSeconds: this.start,
        endSeconds: Number.isFinite(this.end) ? this.end : null
      },
      summary: {
        pitchAccuracy: this.attempts.length ? n.length / this.attempts.length : null,
        correct: n.length,
        wrong: this.attempts.filter(e => e.pitchStatus === `wrong`).length,
        missed: this.attempts.filter(e => e.pitchStatus === `missed`).length,
        meanAbsOnsetMs: a(r.map(e => Math.abs(e.onsetDeltaMs))),
        onsetBiasMs: a(r.map(e => e.onsetDeltaMs)),
        judgedReleases: i.length,
        goodReleases: i.filter(e => e.releaseStatus === `good_release`).length
      },
      weakRegions: o.slice(0, 3),
      bestRegions: [...o].reverse().slice(0, 3),
      chords: this.chords(),
      attempts: this.attempts,
      pedalEvents: this.pedalEvents,
      notes: [`onsetBiasMs: negative=early, positive=late`, `Learn/Follow onset is not scored`, `Interrupted holds excluded from release summary`, `MIDI 1 repeated same-pitch note-offs use channel/pitch FIFO`]
    };
  }
}();
var MidiClock = class {
  onTickCb = null;
  _tempoMultiplier = 1;
  startGeneration = 0;
  _startOffset = 0;
  get tempoMultiplier() {
    return this._tempoMultiplier;
  }
  set tempoMultiplier(e) {
    let t = this.currentSeconds;
    this._tempoMultiplier = Math.max(.25, Math.min(2, e)), this._startOffset = t - getTransport().seconds * this._tempoMultiplier;
  }
  onTick(e) {
    this.onTickCb = e;
  }
  async start(e = 0) {
    let t = ++this.startGeneration;
    await startAudio(), t === this.startGeneration && (this._startOffset = e, getTransport().cancel(), getTransport().seconds = 0, getTransport().bpm.value = 120, getTransport().scheduleRepeat(when => {
      this.onTickCb?.(this.currentSeconds, when);
    }, .01), getTransport().start());
  }
  pause() {
    this.startGeneration++, getTransport().pause();
  }
  resume() {
    getTransport().start();
  }
  stop() {
    this.startGeneration++, getTransport().stop(), getTransport().cancel();
  }
  reschedule(e) {
    this._startOffset = e, getTransport().seconds = 0, getTransport().scheduleRepeat(when => {
      this.onTickCb?.(this.currentSeconds, when);
    }, .01);
  }
  seek(e) {
    this.startGeneration++, this._startOffset = e, getTransport().seconds = 0;
  }
  get currentSeconds() {
    return this._startOffset + getTransport().seconds * this._tempoMultiplier;
  }
  get visualSeconds() {
    const t = getTransport(),
      s = t.getSecondsAtTime(t.context.rawContext.currentTime);
    return this._startOffset + (s > t.seconds + .000001 ? 0 : s) * this._tempoMultiplier;
  }
  get state() {
    return getTransport().state;
  }
};
var AudioEngine = class {
  ctx = null;
  player = null;
  _currentId = `grand`;
  _loaded = false;
  localSynth = null;
  midiOutputName = null;
  get midiOutput() {
    return this.midiOutputName ? WebMidi.getOutputByName(this.midiOutputName) : void 0;
  }
  async load() {
    this.localSynth ||= new PolySynth(Synth, {
      oscillator: {
        type: `triangle`
      },
      envelope: {
        attack: .005,
        decay: .4,
        sustain: .25,
        release: .15
      },
      volume: -15
    }).toDestination(), this._loaded = true;
  }
  async setInstrument(e) {
    if (!(e === this._currentId && this._loaded)) {
      this._currentId = e, this._loaded = false;
      try {
        this.player?.stop?.();
      } catch {}
      this.player = null, this.ctx && (await this.load());
    }
  }
  get loaded() {
    return this._loaded;
  }
  async wake() {
    if (this.ctx ||= new AudioContext(), this.ctx.state === `suspended`) try {
      await this.ctx.resume();
    } catch {}
  }
  playNote(e) {
    this.playMidi(e.midi, e.velocity);
  }
  playMidi(e, t = 90) {
    if (t <= 0) return;
    let n = this.midiOutput;
    if (n) try {
      n.sendNoteOn(e, {
        channels: 1,
        rawAttack: t
      });
      return;
    } catch {}
    startAudio(), this.localSynth?.triggerAttack(Frequency(e, `midi`).toFrequency(), toneNow(), t / 127);
  }
  stopNote(e) {
    try {
      this.midiOutput?.sendNoteOff(e, {
        channels: 1
      });
    } catch {}
    this.localSynth?.triggerRelease(Frequency(e, `midi`).toFrequency(), toneNow());
  }
  stopAll() {
    try {
      this.midiOutput?.sendAllSoundOff();
    } catch {}
    this.localSynth?.releaseAll();
    try {
      this.player?.stop?.();
    } catch {}
  }
};
var LOOKAHEAD_DOC_SECONDS = 5;
var YT_DRIFT_THRESHOLD = .25;
var syncEngine = new class {
  clock = new MidiClock();
  audio = new AudioEngine();
  doc = null;
  noteIndex = 0;
  previewIndex = 0;
  archivedRun = -1;
  waitTargets = [];
  completedReports = [];
  beginAttempt(e) {
    if (!this.doc || this._state.demo) return;
    let t = this.doc.notes.filter(e => this.isPracticeNote(e)).map(e => this.transposeNote(e));
    judge.begin(t, this._state.waitMode ? judge.mode === `follow` ? `follow` : `learn` : `test`, this._state.tempoMultiplier, this.doc.measures?.map(e => e.startSeconds) ?? computeMeasureSeconds(this.doc.timeSignatures, this.doc.tempoMap, this.doc.ppq, this.doc.totalDuration), e, this.learningRange?.end ?? this._state.loopEnd ?? this.doc.totalDuration), this.waitTargets = [];
  }
  preserveAttempt() {
    this._state.demo || !this.doc || !judge.attempts.length || this.archivedRun === judge.runId || (this.archivedRun = judge.runId, judge.interrupt(), this.completedReports.push(structuredClone(judge.report(this.doc.title, this.doc.tempoMap[0]?.bpm ?? 120))));
  }
  activeNotes = new Set();
  _state = {
    demo: false,
    demoHands: `both`,
    practiceMode: `learn`,
    practiceHand: `right`,
    learningHands: `both`,
    stablePasses: 0,
    countingIn: false,
    status: `stopped`,
    currentSeconds: 0,
    tempoMultiplier: 1,
    loopStart: null,
    loopEnd: null,
    waitMode: false,
    activeHands: new Set([`left`, `right`]),
    metronomeEnabled: false,
    handVolume: {
      left: 0,
      right: 0
    },
    waitForHand: `both`
  };
  ytPlayer = null;
  animFrameId = null;
  stateListeners = new Set();
  metronome = null;
  metronomeVolume = .2;
  lastBeatCrossed = -1;
  pendingMidiPlays = new Set();
  renderOffsetMs = 0;
  transposeSemitones = 0;
  countInBars = 0;
  countInTimeouts = [];
  speedTrainer = {
    enabled: false,
    startPct: 60,
    endPct: 100,
    stepPct: 5,
    currentPct: 60
  };
  constructor() {
    this.clock.onTick(this.onTick.bind(this));
  }
  async loadDocument(e) {
    this.stop(), this._state.demo = false, this.resetStablePasses(), this.learningRange = null, this.doc = e, this.completedReports.length = 0, this._state.loopStart = null, this._state.loopEnd = null, this.clock.seek(0), this.beginAttempt(0), this.noteIndex = 0, this.activeNotes.clear(), this._state.currentSeconds = 0, bus.emit(`document:loaded`, {
      id: e.id,
      title: e.title,
      totalDuration: e.totalDuration
    }), this.emitState(`stopped`);
  }
  async wakeAudio() {
    try {
      await startAudio(), await this.audio.wake();
    } catch (e) {
      console.error(`SyncEngine.wakeAudio failed:`, e);
    }
  }
  updateDocumentNotes(e) {
    this.doc &&= {
      ...this.doc,
      notes: e
    };
  }
  updateDocumentTitle(e) {
    this.doc &&= {
      ...this.doc,
      title: e
    };
  }
  playGeneration = 0;
  passEligible = false;
  resetStablePasses() {
    this._state.stablePasses = 0, this.passEligible = false;
  }
  setDemo(e, t = this._state.demoHands) {
    if (!(e === this._state.demo && t === this._state.demoHands)) {
      if (!e && !this._state.demo) {
        this._state.demoHands = t, this.emitState(this._state.status);
        return;
      }
      this.learningRange = null, this.pause(), e && this.preserveAttempt(), getTransport().cancel(), bus.emit(`transport:seek`, {
        seconds: this._state.currentSeconds
      }), this.seekTo(this._state.currentSeconds), this.resetStablePasses(), !e && this._state.demo && (this._state.demo = false, this.preserveAttempt(), this.beginAttempt(this._state.currentSeconds)), this._state.demo = e, this._state.demoHands = t, this.emitState(`paused`);
    }
  }
  setPracticeMode(e, t = `right`) {
    this.pause(), this._state.demo && this.setDemo(false), this.preserveAttempt(), judge.mode = e, this._state.practiceMode = e, this._state.waitMode = e !== `test`, this._state.practiceHand = t, this.learningRange = null, this.seek(this._state.currentSeconds), this.emitState(`paused`);
  }
  learningRange = null;
  setLearningRange(e) {
    this.learningRange = e, this.doc && !this._state.demo && this.beginAttempt(this._state.currentSeconds);
  }
  get hasLearningRange() {
    return this.learningRange !== null;
  }
  setLearningHands(e) {
    this.pause(), this._state.learningHands = e, this.seek(this._state.currentSeconds);
  }
  isPracticeNote(e) {
    return e.hand === `unknown` ? true : this._state.practiceMode === `follow` ? e.hand === this._state.practiceHand : this._state.practiceMode === `learn` ? this._state.learningHands === `both` || e.hand === this._state.learningHands : this._state.activeHands.has(e.hand);
  }
  playbackVolume(e) {
    return this._state.practiceMode === `follow` ? e === this._state.practiceHand ? 0 : 1 : this._state.practiceMode === `learn` ? 0 : e === `unknown` ? 1 : this._state.handVolume[e];
  }
  async play(e) {
    if (!this.doc) return;
    this._cancelCountIn();
    let t = this.playGeneration;
    if (await this.audio.load(), t !== this.playGeneration) return;
    if (this._state.metronomeEnabled || this.countInBars > 0) {
      this.metronome ||= createSampledMetronome({
        engine: this,
        transport: getTransport,
        measures: measuresFor,
        bus: bus
      });
      await this.metronome.load();
    }
    if (t !== this.playGeneration) return;
    await this.audio.prepareNotes?.(this.doc.notes.map(n => ({
      ...n,
      midi: n.midi + this.transposeSemitones,
      velocity: this._state.demo ? n.velocity : Math.max(1, Math.round(n.velocity * this.playbackVolume(n.hand)))
    })));
    if (t !== this.playGeneration) return;
    let n = e ?? this._state.currentSeconds;
    if (this.passEligible = !this._state.demo && this._state.loopStart !== null && Math.abs(n - this._state.loopStart) < .001, this._state.status === `stopped` && this.beginAttempt(n), this.countInBars > 0) await this._playWithCountIn(n);else {
      if (this.countingIn = false, this.seekTo(n), await this.clock.start(n), t !== this.playGeneration) return;
      this.startAnimLoop(), this.emitState(`playing`);
    }
  }
  async _playWithCountIn(e) {
    let t = this.playGeneration;
    this.countingIn = true;
    let n = effectiveBpm(this.doc, e, 1),
      r = measureAt(this.doc, e)?.startTick ?? 0,
      i = [...this.doc.timeSignatures].reverse().find(e => e.tick <= r) ?? {
        numerator: 4,
        denominator: 4
      },
      a = i.numerator,
      o = 60 / n / this._state.tempoMultiplier * (4 / i.denominator) * 1e3,
      s = this.countInBars * a;
    this.metronome ||= createSampledMetronome({
      engine: this,
      transport: getTransport,
      measures: measuresFor,
      bus: bus
    }), this.emitState(`playing`);
    this.metronome.countIn(s, o / 1000, a);
    let c = setTimeout(async () => {
      t === this.playGeneration && (this.countInTimeouts = [], this.countingIn = false, this.seekTo(e), await this.clock.start(e), t === this.playGeneration && (this.startAnimLoop(), this.emitState(`playing`)));
    }, s * o);
    this.countInTimeouts.push(c);
  }
  countingIn = false;
  _cancelCountIn() {
    this.playGeneration++, this.countingIn = false;
    this.metronome?.reset();
    for (let e of this.countInTimeouts) clearTimeout(e);
    this.countInTimeouts = [];
  }
  pause() {
    this._state.demo || judge.interrupt(), this.resetStablePasses(), this._state.currentSeconds = this._state.status === `playing` ? this.clock.visualSeconds : this._state.currentSeconds, this._cancelCountIn(), this.clock.pause(), getTransport().cancel(), this.pendingMidiPlays.clear(), this.audio.stopAll(), this.metronome?.triggerRelease(), this.stopAnimLoop(), this.emitState(`paused`);
  }
  stop() {
    this.learningRange = null, this.preserveAttempt(), this.waitTargets = [], this._cancelCountIn(), this.clock.stop(), this.clock.seek(0), this.audio.stopAll(), this.metronome?.reset(), this.stopAnimLoop(), this.noteIndex = 0, this.activeNotes.clear(), this._state.currentSeconds = 0, this.lastBeatCrossed = -1, this.emitState(`stopped`), bus.emit(`transport:tick`, {
      seconds: 0,
      tick: 0
    });
  }
  seek(e, t = false) {
    if (t || this.resetStablePasses(), !this.doc) return;
    let n = Math.max(0, Math.min(this.doc.totalDuration, e));
    this.learningRange && (n < this.learningRange.start || n >= this.learningRange.end) && (this.learningRange = null), this.preserveAttempt(), this.beginAttempt(n);
    let r = this._state.status === `playing` || this._state.status === `waiting`;
    this._cancelCountIn(), r && this.clock.pause(), bus.emit(`transport:seek`, {
      seconds: n
    }), getTransport().cancel(), this.seekTo(n), this.clock.seek(n), this.audio.stopAll(), bus.emit(`transport:tick`, {
      seconds: n,
      tick: 0
    }), r && (this.clock.reschedule(n), this.clock.resume(), this._state.status = `playing`, this.startAnimLoop()), this.emitState(this._state.status);
  }
  skipBy(e) {
    let t = this.doc?.totalDuration ?? 0,
      n = Math.max(0, Math.min(t, this._state.currentSeconds + e));
    this.seek(n);
  }
  setTempoMultiplier(e) {
    this.resetStablePasses(), this._cancelCountIn();
    let t = Math.max(.25, Math.min(2, e)),
      n = this.waitTargets[0]?.startSeconds ?? this._state.currentSeconds;
    if (this.preserveAttempt(), this._state.tempoMultiplier = t, this.clock.tempoMultiplier = t, this.beginAttempt(n), this._state.status === `playing` || this._state.status === `waiting`) {
      let e = n;
      this.clock.pause(), bus.emit(`transport:seek`, {
        seconds: e
      }), getTransport().cancel(), this.audio.stopAll(), this.seekTo(e), this.clock.reschedule(e), this.clock.resume(), this._state.status = `playing`, this.startAnimLoop();
    }
    this.emitState(this._state.status);
  }
  setLoopPoints(e, t) {
    this.learningRange = null, this.resetStablePasses();
    let n = this.doc?.totalDuration ?? 0;
    e = e === null ? null : Math.max(0, Math.min(n, e)), t = t === null ? null : Math.max(0, Math.min(n, t)), (e === null || t === null || t <= e) && (e = null, t = null), this._state.loopStart = e, this._state.loopEnd = t, this._state.demo || (judge.end = t ?? this.doc?.totalDuration ?? 1 / 0), this.emitState(this._state.status);
  }
  setWaitMode(e) {
    this._state.waitMode !== e && (this.preserveAttempt(), this._state.waitMode = e, this.beginAttempt(this._state.currentSeconds), this._state.status === `waiting` && !e && (this.clock.resume(), this._state.status = `playing`, this.startAnimLoop()), this.emitState(this._state.status));
  }
  setMetronomeVolume(e) {
    this.metronomeVolume = Math.max(0, Math.min(1, e)), this.metronome && (this.metronome.volume.value = this.metronomeVolumeDb());
  }
  metronomeVolumeDb() {
    return this.metronomeVolume <= 1e-4 ? -80 : Math.max(-80, 20 * Math.log10(this.metronomeVolume));
  }
  setMetronome(e) {
    this._state.metronomeEnabled = e, e && !this.metronome && (this.metronome = createSampledMetronome({
      engine: this,
      transport: getTransport,
      measures: measuresFor,
      bus: bus
    })), this.metronome?.reset(), e && this.metronome.load().catch(() => {
      this._state.metronomeEnabled = false;
      this.emitState(this._state.status);
    }), e || (this.lastBeatCrossed = -1), this.emitState(this._state.status);
  }
  setActiveHands(e) {
    this._state.activeHands = e, this.doc && this.seek(this._state.currentSeconds), this.emitState(this._state.status);
  }
  setHandVolume(e) {
    this._state.handVolume = {
      left: Math.max(0, Math.min(1, e.left)),
      right: Math.max(0, Math.min(1, e.right))
    };
  }
  setWaitForHand(e) {
    this._state.waitForHand = e, this.doc && this.seek(this._state.currentSeconds);
  }
  async setInstrument(e) {
    await this.audio.setInstrument(e);
  }
  setYouTubePlayer(e) {
    this.ytPlayer = e;
  }
  setTranspose(e) {
    this.transposeSemitones = Math.round(Math.max(-12, Math.min(12, e))), this.doc && this.seek(this._state.currentSeconds);
  }
  setCountInBars(e) {
    this.countInBars = e;
  }
  setSpeedTrainer(e) {
    let t = e.enabled && !this.speedTrainer.enabled;
    this.speedTrainer = {
      ...e
    }, this.resetStablePasses(), t && this.setTempoMultiplier(e.startPct / 100);
  }
  setRenderOffset(e) {
    this.renderOffsetMs = Math.max(-200, Math.min(200, e));
  }
  onMidiInput(e, t, n = 1, r = performance.now()) {
    if (t === 0) {
      this.onMidiInputOff(e, n, r);
      return;
    }
    if (!this._state.demo && !this.countingIn && (this._state.status === `playing` || this._state.status === `waiting`)) {
      let i = this.clock.currentSeconds - (this._state.status === `playing` ? Math.max(0, performance.now() - r) / 1e3 * this._state.tempoMultiplier : 0);
      judge.on(e, t, r, i, n, this._state.status === `waiting` ? this.waitTargets : void 0);
    }
    bus.emit(`input:note:on`, {
      midi: e,
      velocity: t
    }), this._state.status === `waiting` && this.waitTargets.every(e => judge.matched.has(e.id)) && (this.waitTargets = [], this._state.status = `playing`, this.clock.resume(), this.emitState(`playing`));
  }
  onMidiPedal(e, t = 1, n = performance.now()) {
    !this._state.demo && !this.countingIn && judge.pedal(e, n, t);
  }
  disconnectMidi() {
    this.pause(), judge.interrupt(), bus.emit(`transport:seek`, {
      seconds: this._state.currentSeconds
    });
  }
  get pendingTargets() {
    return this._state.demo ? [] : this.waitTargets.filter(e => !judge.matched.has(e.id));
  }
  async playMidi(e, t = 90) {
    this.onMidiInput(e, t), this.pendingMidiPlays.add(e), await this.audio.load(), this.pendingMidiPlays.has(e) && (this.pendingMidiPlays.delete(e), this.audio.playMidi(e, t));
  }
  stopMidi(e) {
    this.pendingMidiPlays.delete(e), this.audio.stopNote(e), this.onMidiInputOff(e);
  }
  onMidiInputOff(e, t = 1, n = performance.now()) {
    !this._state.demo && !this.countingIn && judge.off(e, n, t), bus.emit(`input:note:off`, {
      midi: e
    });
  }
  onStateChange(e) {
    return this.stateListeners.add(e), () => this.stateListeners.delete(e);
  }
  get state() {
    return this._state;
  }
  seekTo(e) {
    if (!this.doc) return;
    this._state.currentSeconds = e, this.previewIndex = this.doc.notes.findIndex(t => t.endSeconds >= e), this.previewIndex < 0 && (this.previewIndex = this.doc.notes.length), this.noteIndex = this.doc.notes.findIndex(t => t.startSeconds >= e), this.noteIndex === -1 && (this.noteIndex = this.doc.notes.length), this.activeNotes.clear();
    let t = this.doc.tempoMap[0]?.bpm ?? 120;
    this.lastBeatCrossed = Math.floor(e / (60 / t));
  }
  transposeNote(e) {
    if (this.transposeSemitones === 0) return e;
    let t = Math.max(21, Math.min(108, e.midi + this.transposeSemitones));
    return {
      ...e,
      midi: t
    };
  }
  onTick(e, __beatWhen) {
    if (!this.doc) return;
    for (; this.previewIndex < this.doc.notes.length && this.doc.notes[this.previewIndex].startSeconds <= e + LOOKAHEAD_DOC_SECONDS;) bus.emit(`note:upcoming`, this.transposeNote(this.doc.notes[this.previewIndex++]));
    if (this._state.demo || judge.advance(e), !this._state.demo && this._state.waitMode && this._state.status === `playing`) {
      let t = judge.notes.find(e => e.startSeconds >= judge.start - .001 && e.startSeconds < judge.end && !judge.matched.has(e.id));
      if (t && t.startSeconds <= e + .01) {
        this.waitTargets = judge.notes.filter(e => Math.abs(e.startSeconds - t.startSeconds) < .001 && !judge.matched.has(e.id)), this.clock.pause(), this.emitState(`waiting`);
        return;
      }
    }
    this.metronome?.schedule(e, __beatWhen);
    if (this.learningRange && e >= this.learningRange.end) {
      let e = this.learningRange,
        t = judge.notes.filter(t => t.startSeconds >= e.start && t.startSeconds < e.end),
        n = this._state.demo || t.every(e => judge.matched.has(e.id)),
        r = judge.presses.some(e => e.off === void 0 && !e.attempt.interrupted && e.attempt.expectedNoteId);
      if (n && (this._state.demo || !r)) {
        let t = this._state.demo;
        this.learningRange = null, this.pause(), e.complete(t);
        return;
      }
    }
    let {
      loopStart: t,
      loopEnd: n,
      tempoMultiplier: r
    } = this._state;
    if (!this.learningRange && t !== null && n !== null && e >= n) {
      if (this.speedTrainer.enabled && !this._state.demo) {
        let e = judge.report(``, 120).summary,
          r = judge.notes.filter(e => e.startSeconds >= t && e.startSeconds < n),
          i = this.passEligible && r.length > 0 && r.every(e => judge.matched.has(e.id)) && e.wrong === 0 && e.missed === 0 && e.goodReleases === e.judgedReleases && (judge.mode !== `test` || (e.meanAbsOnsetMs ?? 1 / 0) <= 120);
        if (this._state.stablePasses = i ? this._state.stablePasses + 1 : 0, this._state.stablePasses >= 2) {
          let e = Math.min(this.speedTrainer.endPct, Math.round(this._state.tempoMultiplier * 100) + this.speedTrainer.stepPct);
          e > this._state.tempoMultiplier * 100 && (this.speedTrainer.currentPct = e, this.setTempoMultiplier(e / 100), bus.emit(`speedTrainer:stepped`, {
            currentPct: e
          })), this._state.stablePasses = 0;
        }
      }
      this.seek(t, true), this.passEligible = !this._state.demo;
      return;
    }
    if (!this.learningRange && (t === null || n === null) && e >= this.doc.totalDuration + .35 * r && !judge.presses.some(e => e.off === void 0 && !e.attempt.interrupted && e.attempt.expectedNoteId)) {
      bus.emit(`academy:ended`, {
        seconds: e,
        documentId: this.doc.id
      });
      this.stop();
      return;
    }
    this.pedalPlayback?.schedule(e);
    const __pianoGeneration = this.pedalPlayback?.generation;
    let i = this.doc.notes;
    for (; this.noteIndex < i.length;) {
      let t = i[this.noteIndex];
      if (this.learningRange && t.startSeconds >= this.learningRange.end || t.startSeconds > e + (!this._state.demo && this._state.waitMode ? .02 : LOOKAHEAD_DOC_SECONDS)) break;
      if (this.activeNotes.has(t.id)) {
        this.noteIndex++;
        continue;
      }
      let n = this.transposeNote(t);
      this.activeNotes.add(t.id);
      let a = this.renderOffsetMs / 1e3,
        o = Math.max(0, (t.startSeconds - e) / r - a),
        s = Math.max(0, (t.endSeconds - e) / r - a);
      getTransport().scheduleOnce(__pianoWhen => {
        if (__pianoGeneration !== this.pedalPlayback?.generation) return;
        if (this._state.demo ? this._state.demoHands === `both` || t.hand === this._state.demoHands || t.hand === `unknown` : this._state.practiceMode === `follow` || this.isPracticeNote(t)) {
          getTransport().context.draw.schedule(() => {
            if (__pianoGeneration === this.pedalPlayback?.generation) bus.emit(`note:on`, n);
          }, __pianoWhen);
          let e = this._state.demo ? 1 : this.playbackVolume(t.hand),
            r = e === 1 ? n : {
              ...n,
              velocity: Math.max(1, Math.round(n.velocity * e))
            };
          e > 0 && this.audio.playNote(r, __pianoWhen);
        }
      }, `+${o}`), getTransport().scheduleOnce(__pianoWhen => {
        if (__pianoGeneration !== this.pedalPlayback?.generation) return;
        getTransport().context.draw.schedule(() => {
          if (__pianoGeneration === this.pedalPlayback?.generation) bus.emit(`note:off`, n);
        }, __pianoWhen), this.audio.stopNote(n.midi, n.id, __pianoWhen);
      }, `+${s}`), this.noteIndex++;
    }
    if (this.ytPlayer && this.doc.youtubeId) {
      let t = e + this.doc.youtubeSyncOffset;
      try {
        let e = this.ytPlayer.getCurrentTime();
        Math.abs(e - t) > YT_DRIFT_THRESHOLD && this.ytPlayer.seekTo(t, true);
      } catch {}
    }
  }
  startAnimLoop() {
    this.stopAnimLoop();
    let e = 0,
      t = () => {
        let n = this.clock.visualSeconds;
        this._state.currentSeconds = n, bus.emit(`transport:tick`, {
          seconds: n,
          tick: 0
        });
        let r = performance.now();
        if (r - e >= 100) {
          e = r;
          for (let e of this.stateListeners) e({
            ...this._state
          });
        }
        this.animFrameId = requestAnimationFrame(t);
      };
    this.animFrameId = requestAnimationFrame(t);
  }
  stopAnimLoop() {
    this.animFrameId !== null && (cancelAnimationFrame(this.animFrameId), this.animFrameId = null);
  }
  emitState(e) {
    this._state.status = e, this._state.countingIn = this.countingIn, bus.emit(`transport:stateChange`, {
      status: e,
      seconds: this._state.currentSeconds
    });
    for (let e of this.stateListeners) e({
      ...this._state
    });
  }
}();
function formatTime(e) {
  return `${Math.floor(e / 60)}:${Math.floor(e % 60).toString().padStart(2, `0`)}`;
}
export { PRACTICE_CONTEXT_PREFIX, normalizePracticeContext, readPracticeContext, savePracticeContext, removePracticeContext, keySignatureToLabel, ticksToSeconds, computeMeasureSeconds, computeBeatSeconds, SHARP_NAMES, FLAT_NAMES, midiToPitch, pitchClassName, isBlackKey, measuresFor, measureAt, quickLoop, effectiveBpm, upcomingTargets, bus, judge, MidiClock, AudioEngine, LOOKAHEAD_DOC_SECONDS, YT_DRIFT_THRESHOLD, syncEngine, formatTime };
