// SPDX-License-Identifier: MIT
// See docs/PROVENANCE.md for upstream attribution and source restoration.
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { Application, Container, FillGradient, Graphics, Text } from 'pixi.js';
import { createFallingNotesView, createSheetMusicView, createKeyboardTargetUpdater } from './runtime/visual-sync.mjs';
import { installKeyboardInvalidation } from './runtime/resource-runtime.mjs';
import { isBlackKey, midiToPitch, pitchClassName, judge, syncEngine, bus, computeMeasureSeconds, computeBeatSeconds, upcomingTargets, keySignatureToLabel } from "./engine.js";
import { useAppStore, CUSTOM_COLOR_PRESETS } from "./library-store.js";
function brighten(e, t) {
  return Math.min(255, Math.round((e >> 16 & 255) * t)) << 16 | Math.min(255, Math.round((e >> 8 & 255) * t)) << 8 | Math.min(255, Math.round((e & 255) * t));
}
function hexToNumber(e) {
  return parseInt(e.replace(`#`, ``), 16);
}
var FALLING_MIDI_MIN = 21;
var FALLING_MIDI_MAX = 108;
var INITIAL_NOTE_POOL = 1200;
function isWhiteFallingKey(e) {
  return !isBlackKey(e);
}
var fallingWhiteKeyIndex = Array(109).fill(0);
var fallingWhiteCount = 0;
for (let e = FALLING_MIDI_MIN; e <= FALLING_MIDI_MAX; e++) fallingWhiteKeyIndex[e] = fallingWhiteCount, isWhiteFallingKey(e) && fallingWhiteCount++;
var TOTAL_WHITE_KEYS = fallingWhiteCount;
var NOTE_COLOR_THEMES = {
  violet: {
    left: 8141549,
    right: 9133302,
    unknown: 9133302,
    leftBlack: 10980346,
    rightBlack: 12891645,
    unknownBlack: 12891645
  },
  classic: {
    left: 2450411,
    right: 14427686,
    unknown: 8141549,
    leftBlack: 6333946,
    rightBlack: 16281969,
    unknownBlack: 10980346
  },
  ocean: {
    left: 165063,
    right: 440020,
    unknown: 959977,
    leftBlack: 3718648,
    rightBlack: 6809849,
    unknownBlack: 8246268
  },
  forest: {
    left: 1409085,
    right: 1483594,
    unknown: 2278750,
    leftBlack: 4906624,
    rightBlack: 8843180,
    unknownBlack: 12318672
  },
  cascade: {
    left: 9647082,
    right: 2282478,
    unknown: 11032055,
    leftBlack: 11561717,
    rightBlack: 5101036,
    unknownBlack: 12090104
  }
};
function customNoteColors(e) {
  let t = hexToNumber(e.leftHand),
    n = hexToNumber(e.rightHand),
    r = hexToNumber(e.unknown);
  return {
    left: t,
    right: n,
    unknown: r,
    leftBlack: brighten(t, 1.55),
    rightBlack: brighten(n, 1.55),
    unknownBlack: brighten(r, 1.55)
  };
}
function noteColor(e, t, n, r) {
  let i = n === `custom` && r ? customNoteColors(r) : NOTE_COLOR_THEMES[n],
    a = isBlackKey(e.midi);
  return !t || e.hand === `unknown` ? a ? i.unknownBlack : i.unknown : e.hand === `left` ? a ? i.leftBlack : i.left : e.hand === `right` ? a ? i.rightBlack : i.right : a ? i.unknownBlack : i.unknown;
}
function lerpColor(e, t, n) {
  let r = e >> 16 & 255,
    i = t >> 16 & 255,
    a = e >> 8 & 255,
    o = t >> 8 & 255,
    s = e & 255,
    c = t & 255;
  return Math.round(r + (i - r) * n) << 16 | Math.round(a + (o - a) * n) << 8 | Math.round(s + (c - s) * n);
}
function noteGradient(e) {
  return new FillGradient({
    type: `linear`,
    start: {
      x: 0,
      y: 0
    },
    end: {
      x: 0,
      y: 1
    },
    textureSpace: `local`,
    colorStops: [{
      offset: 0,
      color: lerpColor(e, 16777215, .55)
    }, {
      offset: .22,
      color: lerpColor(e, 16777215, .22)
    }, {
      offset: .62,
      color: e
    }, {
      offset: 1,
      color: lerpColor(e, 0, .3)
    }]
  });
}
var ImpactEffect = class {
  container;
  outerBloom;
  innerBloom;
  sparkle;
  active = false;
  t = 0;
  noteW = 0;
  baseColor = 16777215;
  constructor() {
    this.container = new Container(), this.outerBloom = new Graphics(), this.innerBloom = new Graphics(), this.sparkle = new Graphics(), this.container.addChild(this.outerBloom, this.innerBloom, this.sparkle), this.container.visible = false;
  }
  trigger(e, t, n, r) {
    this.noteW = n, this.baseColor = r, this.t = 0, this.active = true, this.container.visible = true, this.container.x = e, this.container.y = t, this._draw();
  }
  advance(e) {
    return this.t += e * .033, this.t >= 1 ? (this.reset(), true) : (this._draw(), false);
  }
  _draw() {
    let {
        t: e,
        noteW: t,
        baseColor: n
      } = this,
      r = 1 - (1 - e) * (1 - e) * (1 - e),
      i = t * .4 + r * t * 1.5;
    this.innerBloom.clear(), this.innerBloom.circle(0, 0, i), this.innerBloom.fill({
      color: n,
      alpha: (1 - e) * .28
    });
    let a = Math.max(0, e - .1),
      o = 1 - (1 - a) * (1 - a) * (1 - a),
      s = t * .4 + o * t * 3;
    this.outerBloom.clear(), this.outerBloom.circle(0, 0, s), this.outerBloom.fill({
      color: n,
      alpha: (1 - a) * .1
    });
    let c = Math.max(0, 1 - e * 5);
    if (this.sparkle.clear(), c > 0) {
      let e = t * .35 * (1 - r);
      e > .5 && (this.sparkle.circle(0, 0, e), this.sparkle.fill({
        color: n,
        alpha: c * .8
      }));
    }
  }
  reset() {
    this.active = false, this.container.visible = false, this.outerBloom.clear(), this.innerBloom.clear(), this.sparkle.clear();
  }
};
var NoteSprite = class {
  container;
  bg;
  label;
  labelWanted = false;
  barWidth = 0;
  barHeight = 0;
  note = null;
  active = false;
  impactFired = false;
  baseColor = 0;
  constructor() {
    this.container = new Container(), this.bg = new Graphics(), this.label = new Text({
      text: ``,
      style: {
        fontSize: 10,
        fill: 16777215,
        fontFamily: [`-apple-system`, `BlinkMacSystemFont`, `PingFang SC`, `Helvetica Neue`, `Arial`, `sans-serif`],
        fontWeight: `700`,
        dropShadow: {
          color: 0,
          blur: 4,
          distance: 0,
          alpha: .85
        }
      }
    }), this.label.anchor.set(.5, .5), this.container.addChild(this.bg, this.label), this.container.visible = false;
  }
  configure(e, t, n, r, i, a, o, s, c, l) {
    this.note = e, this.active = true, this.impactFired = false, this.baseColor = o, this.barWidth = n, this.barHeight = i, this.container.visible = true, this.container.x = t, this.container.y = r;
    let u = Math.min(c, n * .25);
    if (this.bg.clear(), this.bg.roundRect(0, 0, n, i, u), this.bg.fill(a), i > 10) {
      let e = Math.min(i * .18, 7);
      this.bg.roundRect(1, 1, n - 2, e, u * .6), this.bg.fill({
        color: 16777215,
        alpha: .2
      });
    }
    this.bg.roundRect(0, 0, n, i, u), l ? this.bg.stroke({
      width: 1.5,
      color: o,
      alpha: .55
    }) : this.bg.stroke({
      width: 1,
      color: 16777215,
      alpha: .15
    }), this.label.style.fontSize = i <= 8 ? 6 : n <= 11 ? 7 : 10, this.label.text = s, this.label.x = n / 2, this.label.y = i / 2, this.labelWanted = s.length > 0 && i > 6 && n > 7, this.label.visible = this.labelWanted;
  }
  relabel(e) {
    this.label.text = e, this.labelWanted = e.length > 0 && this.barHeight > 6 && this.barWidth > 7, this.label.visible = this.labelWanted;
  }
  updateLabelY(e, t, n) {
    if (!this.labelWanted) {
      this.label.visible = false;
      return;
    }
    let r = Math.max(0, -e),
      i = Math.min(t, n - e);
    if (i <= r) {
      this.label.visible = false;
      return;
    }
    this.label.visible = true;
    let a = (r + i) / 2,
      o = t / 2;
    this.label.y = o >= r && o <= i ? o : a;
  }
  reset() {
    this.note = null, this.active = false, this.impactFired = false, this.baseColor = 0, this.labelWanted = false, this.label.visible = false, this.container.visible = false;
  }
};
var FallingNotesRenderer = class {
  app;
  _initialized = false;
  opts;
  pool = [];
  active = new Map();
  hitLine;
  ghostBar;
  feedbackLayer = new Graphics();
  whiteW = 0;
  blackW = 0;
  gradientCache = new Map();
  flashes = [];
  flashLayer;
  measureLayer;
  particleLayer;
  particles = [];
  gridLayer;
  beatLayer;
  sustainLineLayer;
  sustainTextLayer;
  sustainedNoteLayer;
  sustainedNotes = new Map();
  constructor(e) {
    this.opts = e, this.app = new Application(), this.hitLine = new Graphics(), this.ghostBar = new Graphics(), this.ghostBar.visible = false;
  }
  async init(e) {
    await this.app.init({
      canvas: e,
      width: this.opts.width,
      height: this.opts.height,
      backgroundColor: 328969,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      autoStart: false
    }), this.computeLayout();
    let t = new Container();
    for (let e = 0; e < INITIAL_NOTE_POOL; e++) {
      let e = new NoteSprite();
      this.pool.push(e), t.addChild(e.container);
    }
    this.drawHitLine(), this.gridLayer = this.buildGrid(), this.gridLayer.visible = this.opts.showGrid ?? false, this.sustainLineLayer = new Graphics(), this.sustainTextLayer = new Container();
    for (let e = 0; e < 80; e++) {
      let e = new Text({
        text: ``,
        style: {
          fontSize: 11,
          fill: 11032055,
          fontFamily: [`-apple-system`, `BlinkMacSystemFont`, `PingFang SC`, `Helvetica Neue`, `Arial`, `sans-serif`],
          fontStyle: `italic`,
          fontWeight: `700`
        }
      });
      e.x = 10, e.visible = false, this.sustainTextLayer.addChild(e);
    }
    this.beatLayer = new Graphics(), this.sustainedNoteLayer = new Graphics(), this.particleLayer = new Graphics(), this.flashLayer = new Container();
    for (let e = 0; e < 30; e++) {
      let e = new ImpactEffect();
      this.flashes.push(e), this.flashLayer.addChild(e.container);
    }
    this.measureLayer = new Container();
    for (let e = 0; e < 60; e++) {
      let e = new Text({
        text: ``,
        style: {
          fontSize: 11,
          fill: 8951480,
          fontFamily: [`-apple-system`, `BlinkMacSystemFont`, `PingFang SC`, `Helvetica Neue`, `Arial`, `sans-serif`],
          fontWeight: `600`
        }
      });
      e.x = 3, e.visible = false, this.measureLayer.addChild(e);
    }
    this.app.stage.addChild(this.gridLayer, this.sustainLineLayer, this.sustainTextLayer, this.beatLayer, t, this.particleLayer, this.sustainedNoteLayer, this.measureLayer, this.flashLayer, this.hitLine, this.ghostBar), this.app.stage.addChild(this.feedbackLayer), this._initialized = true;
  }
  computeLayout() {
    this.whiteW = this.opts.width / TOTAL_WHITE_KEYS, this.blackW = this.whiteW * .6;
  }
  drawHitLine() {
    this.hitLine.clear();
  }
  buildGrid() {
    let e = new Graphics();
    for (let t = FALLING_MIDI_MIN; t <= FALLING_MIDI_MAX; t++) if (t % 12 == 0 && isWhiteFallingKey(t)) {
      let n = fallingWhiteKeyIndex[t] * this.whiteW;
      e.rect(n, 0, 1, this.opts.height), e.fill({
        color: 8421520,
        alpha: .2
      });
    }
    return e;
  }
  noteX(e) {
    return isWhiteFallingKey(e) ? fallingWhiteKeyIndex[e] * this.whiteW : fallingWhiteKeyIndex[e - 1] * this.whiteW + this.whiteW - this.blackW / 2;
  }
  getGradient(e) {
    let t = this.gradientCache.get(e);
    return t || (t = noteGradient(e), this.gradientCache.set(e, t)), t;
  }
  noteLabel(e) {
    let t = [],
      n = this.pitchLabelFor(e.midi);
    return n && t.push(n), this.opts.showFingering && e.finger && t.push(String(e.finger)), t.join(` `);
  }
  pitchLabelFor(e) {
    let t = this.opts.fallingNotesLabelMode ?? `none`;
    if (t === `none`) return ``;
    let n = isWhiteFallingKey(e);
    return t === `c_only` ? e % 12 == 0 ? midiToPitch(e, this.opts.useFlats) : `` : t === `white` && !n || t === `black` && n ? `` : pitchClassName(e, this.opts.useFlats);
  }
  passesFilter(e) {
    switch (this.opts.noteFilter) {
      case `white`:
        return isWhiteFallingKey(e.midi);
      case `black`:
        return isBlackKey(e.midi);
      case `c_only`:
        return e.midi % 12 == 0;
      default:
        return true;
    }
  }
  spawnBurst(e, t, n, r) {
    let i = 9 + Math.floor(Math.random() * 6);
    for (let a = 0; a < i; a++) {
      let i = Math.random() < .5 ? -1 : 1;
      this.particles.push({
        x: e + i * (n * .5 + 1 + Math.random() * 3),
        y: t,
        vx: i * (1.8 + Math.random() * 3.8),
        vy: -(.5 + Math.random() * 2.8),
        size: 1.4 + Math.random() * 2.4,
        life: 1,
        decay: .024 + Math.random() * .018,
        gravity: .07,
        color: r
      });
    }
  }
  spawnTrail(e, t, n, r) {
    if (Math.random() > .38) return;
    let i = Math.random() < .5 ? -1 : 1;
    this.particles.push({
      x: e + n * .5 * i,
      y: t - Math.random() * 22,
      vx: i * (.5 + Math.random() * 1.4),
      vy: -(.2 + Math.random() * 1),
      size: 1 + Math.random() * 1.6,
      life: 1,
      decay: .04 + Math.random() * .03,
      gravity: .025,
      color: r
    });
  }
  triggerFlash(e, t, n, r) {
    let i = this.flashes.find(e => !e.active);
    i && i.trigger(e, t, n, r);
  }
  isSustainActive(e) {
    let t = this.opts.sustainRanges;
    if (!t) return false;
    for (let n of t) {
      if (n.startSeconds > e) break;
      if (e <= n.endSeconds) return true;
    }
    return false;
  }
  addNote(e, t) {
    if (!this._initialized || this.active.has(e.id) || !this.passesFilter(e)) return;
    {
      let n = this.opts.height / this.opts.viewportSeconds,
        r = this.opts.minNoteHeight ?? 8,
        i = Math.max(r, (e.endSeconds - e.startSeconds) * n);
      if ((t - e.startSeconds) * n - i > 60) return;
    }
    let n = this.pool.pop();
    if (!n) return;
    let {
        viewportSeconds: r,
        height: i
      } = this.opts,
      a = isWhiteFallingKey(e.midi),
      o = Math.max(5, (a ? this.whiteW : this.blackW) - 2),
      s = this.noteX(e.midi) + 1,
      c = i / r,
      l = this.opts.minNoteHeight ?? 8,
      u = Math.max(l, (e.endSeconds - e.startSeconds) * c),
      d = e.startSeconds - t,
      f = i - 4 - u - d * c,
      p = noteColor(e, this.opts.showHandColors, this.opts.colorTheme, this.opts.customColors);
    n.configure(e, s, o, f, u, this.getGradient(p), p, this.noteLabel(e), this.opts.noteCornerRadius ?? 4, this.opts.showNoteOutline ?? false), this.active.set(e.id, n);
  }
  tick(e) {
    if (!this._initialized) return;
    let {
        height: t,
        viewportSeconds: n
      } = this.opts,
      r = t / n,
      i = t - 4;
    this.feedbackLayer.clear();
    for (let e of judge.presses) {
      if (e.attempt.interrupted || e.midi < 21 || e.midi > 108 || e.attempt.expectedFingerDurationMs === void 0) continue;
      let t = performance.now() - e.on,
        n = e.attempt.expectedFingerDurationMs,
        r = this.noteX(e.midi) + 1,
        a = Math.max(4, (isWhiteFallingKey(e.midi) ? this.whiteW : this.blackW) - 2);
      if (e.off === void 0) {
        let e = t > n + 90,
          o = e ? Math.min(26, 6 + (t - n) / 40) : 6;
        this.feedbackLayer.roundRect(r, i - o, a, o, 2).fill({
          color: e ? 13346155 : 9162975,
          alpha: .65
        });
      } else e.attempt.releaseStatus === `early_release` && performance.now() - e.off < 500 && this.feedbackLayer.rect(r, i - 12, a * .4, 3).rect(r + a * .6, i - 12, a * .4, 3).fill({
        color: 14256513,
        alpha: .8
      });
    }
    let a = this.opts.minNoteHeight ?? 8,
      o = this.opts.noteCornerRadius ?? 4,
      s = this.opts.impactStyle ?? `bloom`,
      c = this.opts.showSustainedNotes ?? false,
      l = c && this.isSustainActive(e);
    for (let [n, o] of this.active) {
      if (!o.note) continue;
      let u = Math.max(a, (o.note.endSeconds - o.note.startSeconds) * r),
        d = o.note.startSeconds - e;
      o.container.y = i - u - d * r, o.updateLabelY(o.container.y, u, t);
      let f = judge.attempts.find(e => e.expectedNoteId === n),
        p = judge.presses.find(e => e.attempt === f && e.off === void 0 && !e.attempt.interrupted);
      if (p && judge.mode !== `test`) {
        let e = (performance.now() - p.on) / 1e3 * judge.tempo;
        o.container.y = i - u + e * r, o.updateLabelY(o.container.y, u, t);
      }
      if (o.container.alpha = f?.releaseStatus === `early_release` ? .35 : 1, f?.releaseStatus === `early_release` && (o.container.y -= 10), o.container.tint = f?.releaseStatus === `early_release` ? 15506066 : p ? 11724013 : 16777215, !o.impactFired && s !== `off` && o.container.y + u >= i - 2) {
        o.impactFired = true;
        let e = isWhiteFallingKey(o.note.midi) ? this.whiteW : this.blackW,
          t = o.container.x + e * .5;
        s === `bloom` ? this.triggerFlash(t, i - 4, e * .8, o.baseColor) : s === `side` && this.spawnBurst(t, i - 3, e, o.baseColor);
      }
      if (s === `trail`) {
        let e = o.container.y;
        if (e + u < i && e < i) {
          let t = isWhiteFallingKey(o.note.midi) ? this.whiteW : this.blackW;
          this.spawnTrail(o.container.x + t * .5, e + u * .35, t, o.baseColor);
        }
      }
      o.container.y > i + 60 && (c && l && e - o.note.endSeconds < 3 && this.sustainedNotes.set(n, {
        midi: o.note.midi,
        baseColor: o.baseColor,
        endSeconds: o.note.endSeconds
      }), o.reset(), this.pool.push(o), this.active.delete(n));
    }
    if (this.sustainedNoteLayer.clear(), c && this.sustainedNotes.size > 0) {
      let t = this.isSustainActive(e);
      for (let [n, r] of this.sustainedNotes) {
        let a = e - r.endSeconds;
        if (!t || a >= 3) {
          this.sustainedNotes.delete(n);
          continue;
        }
        let s = Math.max(5, (isWhiteFallingKey(r.midi) ? this.whiteW : this.blackW) - 2),
          c = this.noteX(r.midi) + 1,
          l = Math.min(o, s * .25),
          u = Math.min(.32, .32 * (1 - Math.max(0, a - 2)));
        this.sustainedNoteLayer.roundRect(c, i - 12, s, 12, l), this.sustainedNoteLayer.fill({
          color: r.baseColor,
          alpha: u
        });
      }
    }
    let u = this.app.ticker.deltaTime;
    for (let e of this.flashes) e.active && e.advance(u);
    if (this.particleLayer.clear(), this.particles.length > 0) {
      this.particles = this.particles.filter(e => (e.x += e.vx, e.y += e.vy, e.vy += e.gravity, e.life -= e.decay, e.life > 0));
      for (let e of this.particles) {
        let t = Math.max(.5, e.size * e.life);
        this.particleLayer.circle(e.x, e.y, t), this.particleLayer.fill({
          color: e.color,
          alpha: e.life * .88
        });
      }
    }
    if (this.opts.showMeasureNums && this.opts.measureStarts?.length) {
      let n = 0,
        a = this.measureLayer.children,
        o = this.opts.viewportSeconds;
      for (let s = 0; s < this.opts.measureStarts.length && n < a.length; s++) {
        let c = this.opts.measureStarts[s] - e;
        if (c < -.5 || c > o + .5) continue;
        let l = i - c * r;
        if (l < -15 || l > t + 15) continue;
        let u = a[n++];
        u.visible = true, u.text = String(s + 1), u.y = l - 10;
      }
      for (let e = n; e < a.length; e++) a[e].visible = false;
    } else for (let e of this.measureLayer.children) e.visible = false;
    if ((this.opts.showBeatLines ?? false) && this.opts.beatStarts?.length) {
      this.beatLayer.clear();
      let a = new Set((this.opts.measureStarts ?? []).map(e => Math.round(e * 100)));
      for (let o of this.opts.beatStarts) {
        let s = o - e;
        if (s < -.3 || s > n + .3) continue;
        let c = Math.round(i - s * r);
        if (c < 0 || c > t + 1) continue;
        let l = a.has(Math.round(o * 100)),
          u = this.opts.darkMode !== false;
        this.beatLayer.rect(0, c, this.opts.width, l ? 1.5 : 1), this.beatLayer.fill({
          color: u ? 8951480 : 4871528,
          alpha: l ? u ? .2 : .35 : u ? .08 : .15
        });
      }
    } else (this.opts.showBeatLines ?? false) || this.beatLayer.clear();
    if ((this.opts.showSustainPedal ?? false) && this.opts.sustainRanges?.length) {
      this.sustainLineLayer.clear();
      let a = this.sustainTextLayer.children;
      for (let e of a) e.visible = false;
      let o = 0,
        s = -999;
      for (let c of this.opts.sustainRanges) {
        let l = c.startSeconds - e,
          u = c.endSeconds - e;
        if (u < -.5 || l > n + .5) continue;
        let d = Math.max(0, i - u * r),
          f = Math.min(t + 14, i - l * r);
        if (f <= d) continue;
        this.sustainLineLayer.rect(9, d, 1, f - d), this.sustainLineLayer.fill({
          color: 11032055,
          alpha: .55
        });
        let p = Math.min(f - 14, t - 14),
          m = Math.max(2, d - 13);
        if (p - s > 16 && o < a.length && f >= -4 && f <= t + 14) {
          let e = a[o++];
          e.text = `Ped`, e.y = p, e.visible = true;
        }
        if (f - d >= 32 && o < a.length && d >= -4 && d <= t) {
          let e = a[o++];
          e.text = `✱`, e.y = m, e.visible = true, s = m;
        }
      }
    } else if (!(this.opts.showSustainPedal ?? false)) {
      this.sustainLineLayer.clear();
      for (let e of this.sustainTextLayer.children) e.visible = false;
    }
  }
  showGhost(e) {
    if (!e) {
      this.ghostBar.visible = false;
      return;
    }
    let t = (isWhiteFallingKey(e.midi) ? this.whiteW : this.blackW) - 2,
      n = this.noteX(e.midi) + 1;
    this.ghostBar.clear(), this.ghostBar.roundRect(n, this.opts.height - 22, t, 16, 3), this.ghostBar.fill({
      color: 6514417,
      alpha: .5
    }), this.ghostBar.visible = true;
  }
  reset() {
    for (let [, e] of this.active) e.reset(), this.pool.push(e);
    this.active.clear(), this.particles = [], this.particleLayer?.clear(), this.feedbackLayer.clear(), this.sustainedNotes.clear(), this.sustainedNoteLayer?.clear(), this.ghostBar.visible = false;
  }
  fadeIn(e = 420) {
    if (!this._initialized) return;
    this.app.stage.alpha = 0;
    let t = 1 / Math.max(1, Math.round(e / 1e3 * 60)),
      n = () => {
        let e = Math.min(1, this.app.stage.alpha + t);
        this.app.stage.alpha = e, e >= 1 && this.app.ticker.remove(n);
      };
    this.app.ticker.remove(n), this.app.ticker.add(n);
  }
  setOptions(e) {
    let t = `colorTheme` in e && e.colorTheme !== this.opts.colorTheme || `customColors` in e && e.customColors !== this.opts.customColors || `noteFilter` in e && e.noteFilter !== this.opts.noteFilter || `showHandColors` in e && e.showHandColors !== this.opts.showHandColors || `useFlats` in e && e.useFlats !== this.opts.useFlats || `fallingNotesLabelMode` in e && e.fallingNotesLabelMode !== this.opts.fallingNotesLabelMode || `showNoteOutline` in e && e.showNoteOutline !== this.opts.showNoteOutline,
      n = `showFingering` in e && e.showFingering !== this.opts.showFingering;
    if (Object.assign(this.opts, e), this._initialized) {
      if (t) {
        for (let e of this.gradientCache.values()) e.destroy();
        this.gradientCache.clear(), this.reset();
      } else if (n) for (let [, e] of this.active) e.note && e.relabel(this.noteLabel(e.note));
      if (`showGrid` in e && (this.gridLayer.visible = !!e.showGrid), `impactStyle` in e && (this.particles = [], this.particleLayer?.clear()), `darkMode` in e && this.drawHitLine(), `showBeatLines` in e && !e.showBeatLines && this.beatLayer.clear(), `showSustainPedal` in e && !e.showSustainPedal) {
        this.sustainLineLayer.clear();
        for (let e of this.sustainTextLayer.children) e.visible = false;
      }
      `showSustainedNotes` in e && !e.showSustainedNotes && (this.feedbackLayer.clear(), this.sustainedNotes.clear(), this.sustainedNoteLayer?.clear());
    }
  }
  resize(e, t) {
    this._initialized && (this.opts.width = e, this.opts.height = t, this.app.renderer.resize(e, t), this.computeLayout(), this.reset(), this.drawHitLine());
  }
  destroy() {
    if (this._initialized) {
      for (let e of this.gradientCache.values()) e.destroy();
      this.gradientCache.clear(), this.app.destroy(false, {
        children: true
      });
    }
  }
};
var FallingNotesView = createFallingNotesView({
  React: React,
  store: useAppStore,
  engine: syncEngine,
  bus: bus,
  Renderer: FallingNotesRenderer,
  measureStarts: computeMeasureSeconds,
  beatStarts: computeBeatSeconds
});
var KEYBOARD_MIDI_MIN = 21;
var KEYBOARD_MIDI_MAX = 108;
function isWhitePianoKey(e) {
  return !isBlackKey(e);
}
var KEYBOARD_WHITE_COUNT = Array.from({
  length: 88
}, (e, t) => KEYBOARD_MIDI_MIN + t).filter(isWhitePianoKey).length;
var WHITE_TOP = 12895420;
var WHITE_MID = 16119280;
var WHITE_BOTTOM = 15000796;
var BLACK_TOP = 10132112;
var BLACK_BOTTOM = 7041664;
var WHITE_HIGHLIGHT = 16777215;
var BLACK_HIGHLIGHT = 6514417;
var LEFT_KEY_COLOR = 2278750;
var RIGHT_KEY_COLOR = 3900150;
var WRONG_KEY_COLOR = 15680580;
function keyGradient(e) {
  return new FillGradient({
    type: `linear`,
    start: {
      x: 0,
      y: 0
    },
    end: {
      x: 0,
      y: 1
    },
    textureSpace: `local`,
    colorStops: e.map(([e, t]) => ({
      offset: e,
      color: t
    }))
  });
}
function whiteKeyColors(e) {
  return e ? {
    top: 13486248,
    mid: 16775399,
    btm: 15261896
  } : {
    top: WHITE_TOP,
    mid: WHITE_MID,
    btm: WHITE_BOTTOM
  };
}
var keyGradients = {
  whiteNormal: e => {
    let t = whiteKeyColors(e);
    return keyGradient([[0, t.top], [.07, t.mid], [.88, t.mid], [1, t.btm]]);
  },
  whiteSideShade: () => new FillGradient({
    type: `linear`,
    start: {
      x: 0,
      y: 0
    },
    end: {
      x: 1,
      y: 0
    },
    textureSpace: `local`,
    colorStops: [{
      offset: 0,
      color: `rgba(0,0,0,0.10)`
    }, {
      offset: .16,
      color: `rgba(0,0,0,0)`
    }, {
      offset: .84,
      color: `rgba(0,0,0,0)`
    }, {
      offset: 1,
      color: `rgba(0,0,0,0.10)`
    }]
  }),
  blackNormal: () => keyGradient([[0, 3421247], [.18, 1842212], [.82, 1315865], [1, 3816006]]),
  activeWhite: e => keyGradient([[0, 328968], [.12, brighten(e, .58)], [.22, e], [.83, e], [1, brighten(e, 1.45)]]),
  activeBlack: e => keyGradient([[0, brighten(e, .6)], [.5, e], [1, brighten(e, 1.5)]])
};
var PianoKeyboard = class {
  app;
  _initialized = false;
  keyContainers = new Map();
  keys = new Map();
  keyLabels = new Map();
  fingerLabels = new Map();
  keyStates = new Map();
  opts;
  whiteW = 0;
  whiteH = 0;
  blackW = 0;
  blackH = 0;
  keyX = new Map();
  gradCache = new Map();
  isPointerDown = false;
  dragKeys = new Set();
  onWindowPointerUp;
  constructor(e, t) {
    this.opts = t, this.app = new Application(), this.onWindowPointerUp = e => {
      if (e.button === 0) {
        this.isPointerDown = false;
        for (let e of this.dragKeys) this.opts.onKeyRelease?.(e);
        this.dragKeys.clear();
      }
    };
  }
  async init(e) {
    await this.app.init({
      canvas: e,
      width: this.opts.width,
      height: this.opts.height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      autoStart: false
    }), window.addEventListener(`pointerup`, this.onWindowPointerUp), this.computeLayout(), this.drawKeys(), this._initialized = true;
  }
  computeLayout() {
    let {
      width: e,
      height: t
    } = this.opts;
    this.whiteW = e / KEYBOARD_WHITE_COUNT, this.whiteH = t, this.blackW = this.whiteW * .58, this.blackH = t * .6;
    let n = 0;
    for (let e = KEYBOARD_MIDI_MIN; e <= KEYBOARD_MIDI_MAX; e++) isWhitePianoKey(e) && (this.keyX.set(e, n * this.whiteW), n++);
    for (let e = KEYBOARD_MIDI_MIN; e <= KEYBOARD_MIDI_MAX; e++) if (!isWhitePianoKey(e)) {
      let t = this.keyX.get(e - 1) ?? 0;
      this.keyX.set(e, t + this.whiteW - this.blackW / 2);
    }
  }
  drawKeys() {
    let e = new Container(),
      t = new Container(),
      n = new Container();
    for (let e = KEYBOARD_MIDI_MIN; e <= KEYBOARD_MIDI_MAX; e++) {
      let r = isWhitePianoKey(e),
        i = this.keyX.get(e) ?? 0,
        a = r ? this.whiteW : this.blackW,
        o = r ? this.whiteH : this.blackH,
        s = new Container();
      s.x = i, s.interactive = true, s.cursor = `pointer`;
      let c = new Graphics();
      this.paintKey(c, a, o, r, false, null, null, false), s.addChild(c);
      {
        let t = this.noteLabel(e),
          n = new Text({
            text: t,
            style: {
              fontSize: r ? Math.max(7, this.whiteW * .42) : Math.max(6, this.blackW * .55),
              fill: r ? BLACK_BOTTOM : 11184810,
              fontFamily: [`-apple-system`, `BlinkMacSystemFont`, `PingFang SC`, `Helvetica Neue`, `Arial`, `sans-serif`],
              fontWeight: `600`
            }
          });
        n.anchor.set(.5, 1), n.x = a / 2, n.y = r ? o - 5 : o - 3, n.visible = t.length > 0, s.addChild(n), this.keyLabels.set(e, n);
      }
      let l = new Text({
        text: ``,
        style: {
          fontSize: Math.max(9, this.whiteW * .48),
          fill: WHITE_HIGHLIGHT,
          fontFamily: [`-apple-system`, `BlinkMacSystemFont`, `PingFang SC`, `Helvetica Neue`, `Arial`, `sans-serif`],
          fontWeight: `700`
        }
      });
      l.anchor.set(.5, .5), l.x = a / 2, l.y = o * .22, l.visible = false, s.addChild(l), this.fingerLabels.set(e, l), s.on(`pointerdown`, () => {
        this.isPointerDown = true, this.dragKeys.has(e) || (this.opts.onKeyPress?.(e), this.dragKeys.add(e));
      }), s.on(`pointerover`, () => {
        this.isPointerDown && !this.dragKeys.has(e) && (this.opts.onKeyPress?.(e), this.dragKeys.add(e));
        let t = this.keyStates.get(e);
        t && !t.hovered && (t.hovered = true, this.redrawKey(e));
      }), s.on(`pointerout`, () => {
        this.dragKeys.has(e) && (this.opts.onKeyRelease?.(e), this.dragKeys.delete(e));
        let t = this.keyStates.get(e);
        t && t.hovered && (t.hovered = false, this.redrawKey(e));
      }), this.keys.set(e, c), this.keyContainers.set(e, s), this.keyStates.set(e, {
        playbackActive: false,
        inputActive: false,
        hand: null,
        finger: null,
        hovered: false
      }), r ? t.addChild(s) : n.addChild(s);
    }
    e.addChild(t, n), this.app.stage.addChild(e);
  }
  getGrad(e, t) {
    let n = this.gradCache.get(e);
    return n || (n = t(), this.gradCache.set(e, n)), n;
  }
  paintKey(e, t, n, r, i, a, o, s = false) {
    e.clear();
    let c = r ? 4 : 3,
      l = this.opts.pianoTheme === `ivory`,
      u;
    if (!i) u = r ? this.getGrad(l ? `wn-iv` : `wn`, () => keyGradients.whiteNormal(l)) : this.getGrad(`bn`, keyGradients.blackNormal);else {
      let e = a ?? BLACK_HIGHLIGHT,
        t = (r ? `aw` : `ab`) + e.toString(16);
      u = r ? this.getGrad(t, () => keyGradients.activeWhite(e)) : this.getGrad(t, () => keyGradients.activeBlack(e));
    }
    e.roundRect(.5, .5, t - 1, n - 1, c), e.fill(u), i && r && (e.rect(1, n - 4, t - 2, 4), e.fill({
      color: 0,
      alpha: .4
    }), e.rect(.5, n * .08, 2, n * .88), e.fill({
      color: 0,
      alpha: .1
    }), e.rect(t - 2.5, n * .08, 2, n * .88), e.fill({
      color: 0,
      alpha: .1
    })), r && !i && (e.roundRect(.5, .5, t - 1, n - 1, c), e.fill(this.getGrad(`wshade`, keyGradients.whiteSideShade))), i && !r && n > 10 && (e.roundRect(1, 1, t - 2, Math.min(n * .12, 6), c * .4), e.fill({
      color: 16777215,
      alpha: .28
    }), e.rect(1, n - 5, t - 2, 4), e.fill({
      color: a ?? BLACK_HIGHLIGHT,
      alpha: .25
    })), r && (e.roundRect(.5, .5, t - 1, n - 1, c), e.stroke({
      width: 1,
      color: i ? 51 : BLACK_TOP
    })), !r && !i && (e.rect(0, 4, 1, n - 8), e.fill({
      color: 0,
      alpha: .35
    }), e.rect(t - 1, 4, 1, n - 8), e.fill({
      color: 0,
      alpha: .35
    })), s && !i && (r ? (e.roundRect(.5, .5, t - 1, n - 1, c), e.fill({
      color: 16777215,
      alpha: .22
    })) : (e.roundRect(1, 1, t - 2, n - 2, c), e.fill({
      color: 16777215,
      alpha: .14
    })));
  }
  targets = new Map();
  showTargets(e) {
    let t = [...this.targets.keys()];
    this.targets = new Map(e.map(e => [e.midi, e]));
    for (let e of new Set([...t, ...this.targets.keys()])) this.redrawKey(e);
  }
  redrawKey(e) {
    let t = this.keys.get(e),
      n = this.keyStates.get(e),
      r = this.keyContainers.get(e);
    if (!t || !n || !r) return;
    let i = isWhitePianoKey(e),
      a = i ? this.whiteW : this.blackW,
      o = i ? this.whiteH : this.blackH,
      s = this.targets.get(e),
      c = n.playbackActive || n.inputActive || !!s;
    r.y = n.playbackActive || n.inputActive ? i ? 5 : 3 : 0;
    let l = null;
    if (c) {
      let e = this.opts.customColors;
      l = this.opts.showHandColors && n.hand ? n.hand === `left` ? e ? hexToNumber(e.leftHand) : RIGHT_KEY_COLOR : e ? hexToNumber(e.rightHand) : WRONG_KEY_COLOR : n.inputActive ? LEFT_KEY_COLOR : e ? hexToNumber(e.unknown) : BLACK_HIGHLIGHT;
    }
    s && !n.inputActive && (l = s.hand === `left` ? 3964590 : 11108797);
    let u = judge.attempts[judge.attempts.length - 1];
    u?.pitchStatus === `wrong` && u.actualMidi === e && performance.now() - (u.actualOnsetMs ?? 0) < 450 && (l = 12868961), this.paintKey(t, a, o, i, c, l, n.hand, !c && n.hovered);
    let d = this.fingerLabels.get(e);
    if (d) {
      let e = s?.finger ?? n.finger;
      d.visible = this.opts.showFingering && c && e !== null, e !== null && (d.text = String(e));
    }
  }
  noteLabel(e) {
    let t = this.opts.noteLabelMode ?? `none`;
    if (t === `none`) return ``;
    let n = isWhitePianoKey(e);
    return t === `c_only` ? e % 12 == 0 ? midiToPitch(e, this.opts.useFlats) : `` : t === `white` && !n || t === `black` && n ? `` : pitchClassName(e, this.opts.useFlats);
  }
  noteOn(e, t) {
    let n = this.keyStates.get(e.midi);
    n && (t === `playback` ? (n.playbackActive = true, n.hand = e.hand === `unknown` ? null : e.hand, n.finger = e.finger) : n.inputActive = true, this.redrawKey(e.midi));
  }
  noteOff(e, t) {
    let n = this.keyStates.get(e.midi);
    n && (t === `playback` ? (n.playbackActive = false, n.inputActive || (n.hand = null, n.finger = null)) : n.inputActive = false, this.redrawKey(e.midi));
  }
  inputNoteOn(e) {
    let t = this.keyStates.get(e);
    t && (t.inputActive = true, this.redrawKey(e));
  }
  inputNoteOff(e) {
    let t = this.keyStates.get(e);
    t && (t.inputActive = false, this.redrawKey(e));
  }
  reset() {
    for (let [e] of this.keys) {
      let t = this.keyStates.get(e);
      t && (t.playbackActive = false, t.inputActive = false, t.hand = null, t.finger = null, t.hovered = false), this.redrawKey(e);
    }
  }
  setOptions(e) {
    let t = `pianoTheme` in e && e.pianoTheme !== this.opts.pianoTheme || `noteLabelMode` in e && e.noteLabelMode !== this.opts.noteLabelMode || `useFlats` in e && e.useFlats !== this.opts.useFlats;
    if (Object.assign(this.opts, e), t) {
      this.resize(this.opts.width, this.opts.height);
      return;
    }
    for (let [e, t] of this.keyLabels) {
      let n = this.noteLabel(e);
      t.text = n, t.visible = n.length > 0;
    }
    if (`customColors` in e || `showHandColors` in e) for (let [e, t] of this.keyStates) (t.playbackActive || t.inputActive) && this.redrawKey(e);
  }
  resize(e, t) {
    if (this._initialized) {
      this.opts.width = e, this.opts.height = t, this.app.renderer.resize(e, t);
      for (let e of this.gradCache.values()) e.destroy();
      this.gradCache.clear(), this.keyX.clear(), this.keys.clear(), this.keyContainers.clear(), this.keyLabels.clear(), this.fingerLabels.clear(), this.keyStates.clear(), this.app.stage.removeChildren().forEach(e => e.destroy({
        children: true
      })), this.computeLayout(), this.drawKeys();
    }
  }
  destroy() {
    if (window.removeEventListener(`pointerup`, this.onWindowPointerUp), this._initialized) {
      for (let e of this.gradCache.values()) e.destroy();
      this.gradCache.clear(), this.app.destroy(false, {
        children: true
      });
    }
  }
};
var KEYBOARD_HEIGHT = 160;
installKeyboardInvalidation(PianoKeyboard);
function PianoKeyboardView() {
  let e = (0, React.useRef)(null),
    t = (0, React.useRef)(null),
    n = (0, React.useRef)(null),
    [r, i] = (0, React.useState)(false),
    {
      settings: a,
      practiceMode: o
    } = useAppStore();
  return (0, React.useEffect)(() => {
    if (!e.current || !t.current) return;
    let r = t.current,
      s = r.clientWidth || window.innerWidth,
      c = a.colorTheme === `custom` ? a.customColors : CUSTOM_COLOR_PRESETS[a.colorTheme],
      l = new PianoKeyboard(e.current, {
        width: s,
        height: KEYBOARD_HEIGHT,
        noteLabelMode: a.noteLabelMode,
        pianoTheme: a.pianoTheme,
        showFingering: a.showFingering && (o !== `test` || a.guidanceInTest),
        showHandColors: a.showHandColors,
        useFlats: a.useFlats,
        customColors: c,
        onKeyPress: e => {
          syncEngine.playMidi(e, 90);
        },
        onKeyRelease: e => {
          syncEngine.stopMidi(e);
        }
      });
    n.current = l, l.init(e.current).then(() => {
      n.current === l && i(true);
    });
    let u = e => l.noteOn(e, `playback`),
      d = e => l.noteOff(e, `playback`),
      f = ({
        midi: e
      }) => l.inputNoteOn(e),
      p = ({
        midi: e
      }) => l.inputNoteOff(e),
      m = ({
        status: e
      }) => {
        (e === `stopped` || e === `paused`) && l.reset();
      },
      h = () => l.reset();
    bus.on(`note:on`, u), bus.on(`note:off`, d), bus.on(`input:note:on`, f), bus.on(`input:note:off`, p), bus.on(`transport:stateChange`, m), bus.on(`transport:seek`, h);
    let g = setInterval(createKeyboardTargetUpdater({
        store: useAppStore,
        engine: syncEngine,
        judge: judge,
        findTargets: upcomingTargets,
        renderer: l
      }), 60),
      _ = new ResizeObserver(() => {
        let e = r.clientWidth;
        e > 0 && n.current && n.current.resize(e, KEYBOARD_HEIGHT);
      });
    return _.observe(r), () => {
      bus.off(`note:on`, u), bus.off(`note:off`, d), bus.off(`input:note:on`, f), bus.off(`input:note:off`, p), bus.off(`transport:stateChange`, m), bus.off(`transport:seek`, h), clearInterval(g), _.disconnect(), l.destroy(), n.current = null;
    };
  }, []), (0, React.useEffect)(() => {
    n.current?.setOptions({
      noteLabelMode: a.noteLabelMode,
      pianoTheme: a.pianoTheme,
      showFingering: a.showFingering && (o !== `test` || a.guidanceInTest),
      showHandColors: a.showHandColors,
      useFlats: a.useFlats,
      customColors: a.colorTheme === `custom` ? a.customColors : CUSTOM_COLOR_PRESETS[a.colorTheme]
    });
  }, [a.noteLabelMode, a.pianoTheme, a.showFingering, o, a.guidanceInTest, a.showHandColors, a.useFlats, a.colorTheme, a.customColors]), (0, jsxRuntime.jsxs)(`div`, {
    ref: t,
    className: `w-full`,
    style: {
      height: KEYBOARD_HEIGHT,
      background: `#0d0d10`,
      flexShrink: 0,
      position: `relative`,
      overflow: `hidden`
    },
    children: [(0, jsxRuntime.jsx)(`div`, {
      "aria-hidden": true,
      style: {
        position: `absolute`,
        inset: 0,
        background: `radial-gradient(ellipse at 50% 0%, rgba(147,51,234,0.07) 0%, transparent 65%), ` + (a.theme === `dark` ? `#141428` : `#eef1fa`),
        opacity: +!r,
        transition: `opacity 0.2s ease-out`,
        pointerEvents: `none`
      }
    }), (0, jsxRuntime.jsx)(`canvas`, {
      ref: e,
      style: {
        display: `block`,
        width: `100%`,
        height: `100%`,
        position: `relative`,
        opacity: +!!r,
        transition: `opacity 0.15s ease-in`
      }
    })]
  });
}
function sanitizeMusicXml(e) {
  return e.replace(/<script[\s\S]*?<\/script>/gi, ``).replace(/\bon\w+\s*=/gi, `data-removed=`);
}
var SheetMusicView = createSheetMusicView({
  React: React,
  store: useAppStore,
  engine: syncEngine,
  bus: bus,
  secondsToTick: secondsToAlphaTabTick,
  sanitizeXML: sanitizeMusicXml,
  keyLabel: keySignatureToLabel,
  playNote: (...args) => syncEngine.playMidi(...args),
  stopNote: midi => syncEngine.stopMidi(midi)
});
var ALPHATAB_TICKS_PER_QUARTER = 960;
function secondsToAlphaTabTick(e, t, n) {
  if (!t.length) return Math.round(e * 2 * ALPHATAB_TICKS_PER_QUARTER);
  let r = 0,
    i = e;
  for (let e = 0; e < t.length; e++) {
    let a = t[e],
      o = t[e + 1],
      s = 60 / (a.bpm * n),
      c = ALPHATAB_TICKS_PER_QUARTER / n;
    if (o) {
      let e = o.tick - a.tick,
        t = e * s;
      if (i <= t) return r += Math.round(i / s * c), r;
      i -= t, r += Math.round(e * c);
    } else return r += Math.round(i / s * c), r;
  }
  return r;
}
export { brighten, hexToNumber, FALLING_MIDI_MIN, FALLING_MIDI_MAX, INITIAL_NOTE_POOL, isWhiteFallingKey, fallingWhiteKeyIndex, fallingWhiteCount, TOTAL_WHITE_KEYS, NOTE_COLOR_THEMES, customNoteColors, noteColor, lerpColor, noteGradient, ImpactEffect, NoteSprite, FallingNotesRenderer, FallingNotesView, KEYBOARD_MIDI_MIN, KEYBOARD_MIDI_MAX, isWhitePianoKey, KEYBOARD_WHITE_COUNT, WHITE_TOP, WHITE_MID, WHITE_BOTTOM, BLACK_TOP, BLACK_BOTTOM, WHITE_HIGHLIGHT, BLACK_HIGHLIGHT, LEFT_KEY_COLOR, RIGHT_KEY_COLOR, WRONG_KEY_COLOR, keyGradient, whiteKeyColors, keyGradients, PianoKeyboard, KEYBOARD_HEIGHT, PianoKeyboardView, sanitizeMusicXml, SheetMusicView, ALPHATAB_TICKS_PER_QUARTER, secondsToAlphaTabTick };
