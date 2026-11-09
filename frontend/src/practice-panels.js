// SPDX-License-Identifier: MIT
// See docs/PROVENANCE.md for upstream attribution and source restoration.
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { subscribeVisualUpdates, subscribePracticeFeedback } from './runtime/resource-runtime.mjs';
import { ticksToSeconds, measuresFor, syncEngine, judge, bus, midiToPitch } from "./engine.js";
import { useI18n, useAppStore, translateFeedback } from "./library-store.js";
function secondsToDocumentTick(e, t, n) {
  let r = 0,
    i = 120,
    a = 0;
  for (let o of t) {
    let s = ticksToSeconds(o.tick, t, n);
    if (s > e) break;
    r = o.tick, i = o.bpm, a = s;
  }
  return Math.round(r + (e - a) * n * i / 60);
}
function learningSections(e) {
  let t = measuresFor(e),
    n = [];
  if (e.musicXml) {
    let t = e.musicXml.match(/<miscellaneous-field name="piano-practice-quick">([\s\S]*?)<\/miscellaneous-field>/)?.[1];
    if (t) try {
      let e = t.replace(/&quot;/g, `"`).replace(/&apos;/g, `'`).replace(/&lt;/g, `<`).replace(/&gt;/g, `>`).replace(/&amp;/g, `&`),
        r = JSON.parse(e);
      Array.isArray(r.sections) && (n = r.sections);
    } catch {}
  }
  let r = [0],
    i = 0;
  for (; i < t.length;) {
    let e = n.find(e => e && e.startMeasure === i + 1 && Number.isInteger(e.endMeasure) && e.endMeasure >= e.startMeasure && e.endMeasure <= t.length && e.endMeasure - e.startMeasure < 4 && t[e.endMeasure - 1].endSeconds - t[i].startSeconds <= 12),
      a = e ? e.endMeasure - 1 : Math.min(n.some(e => e?.startMeasure === i + 2) ? i : i + 1, t.length - 1);
    r.push(t[a].endSeconds), i = a + 1;
  }
  r.at(-1) < e.totalDuration && r.push(e.totalDuration);
  let a = [...new Set(e.notes.map(e => e.startSeconds))].sort((e, t) => e - t);
  for (let e = 0; e < r.length - 1; e++) {
    let t = r[e],
      n = r[e + 1],
      i = a.filter(e => e > t + .001 && e < n - .001).find((e, n) => e - t >= 12 || n >= 24);
    i !== void 0 && r.splice(e + 1, 0, i);
  }
  return r.slice(0, -1).map((i, a) => {
    let o = r[a + 1],
      s = t.find(e => i >= e.startSeconds && i < e.endSeconds);
    return {
      name: n.find(e => e && s && e.startMeasure === s.index + 1 && t[e.endMeasure - 1]?.endSeconds === o)?.name ?? `乐段 ${a + 1}`,
      startSeconds: i,
      endSeconds: o,
      startTick: secondsToDocumentTick(i, e.tempoMap, e.ppq),
      endTick: secondsToDocumentTick(o, e.tempoMap, e.ppq)
    };
  }).filter(e => e.endSeconds > e.startSeconds);
}
function SectionPracticePanel() {
  const {
    tr: tr,
    language: lang
  } = useI18n();
  let {
      document: e,
      practiceMode: t
    } = useAppStore(),
    n = (0, React.useMemo)(() => e ? learningSections(e) : [], [e]),
    [r, i] = (0, React.useState)(0),
    [a, o] = (0, React.useState)(`准备`),
    [s, c] = (0, React.useState)(syncEngine.state.learningHands),
    l = (0, React.useRef)(0),
    u = (0, React.useRef)(() => {});
  return u.current = (e, t) => {
    let r = n[e];
    if (!r) return;
    let a = ++l.current;
    i(e), o(t ? `示范` : `跟弹`), syncEngine.pause(), syncEngine.setLearningRange(null), syncEngine.setDemo(t, s), syncEngine.seek(r.startSeconds), syncEngine.setLearningRange({
      start: r.startSeconds,
      end: r.endSeconds,
      complete: t => {
        a === l.current && (t ? u.current(e, false) : e + 1 < n.length ? u.current(e + 1, true) : (o(`本曲完成`), syncEngine.setDemo(false)));
      }
    }), syncEngine.play();
  }, (0, React.useEffect)(() => (++l.current, o(`准备`), c(t === `follow` ? syncEngine.state.practiceHand : syncEngine.state.learningHands), i(Math.max(0, n.findIndex(e => syncEngine.state.currentSeconds < e.endSeconds))), () => {
    ++l.current, syncEngine.setLearningRange(null);
  }), [e, t, n]), t === `test` || !n.length ? null : (0, jsxRuntime.jsxs)(`div`, {
    "data-piano-practice-hands": true,
    "aria-label": tr(`分段学习`, `Section practice`),
    style: {
      display: `flex`,
      alignItems: `center`,
      gap: 10,
      padding: `8px 16px`,
      flexWrap: `wrap`,
      borderBottom: `1px solid var(--color-border)`,
      fontSize: 13
    },
    children: [(0, jsxRuntime.jsx)(`strong`, {
      children: tr(`练习手`, `Practice hand`)
    }), [`both`, `right`, `left`].map(e => (0, jsxRuntime.jsx)(`button`, {
      "aria-pressed": s === e,
      style: {
        fontWeight: s === e ? 750 : 400
      },
      onClick: () => {
        ++l.current, o(`准备`), c(e), syncEngine.setLearningRange(null), syncEngine.setLearningHands(e), t === `follow` && useAppStore.getState().setPracticeMode(`learn`);
      },
      children: e === `both` ? tr(`双手`, `Both`) : e === `right` ? tr(`右手`, `Right`) : tr(`左手`, `Left`)
    }, e)), (0, jsxRuntime.jsxs)(`span`, {
      children: [lang === `zh-CN` ? n[r]?.name : n[r]?.name?.replace(/^乐段 (\d+)$/, `Section $1`), ` · `, r + 1, `/`, n.length, ` · `, lang === `zh-CN` ? a : {
        准备: `Ready`,
        示范: `Demo`,
        跟弹: `Play along`,
        本曲完成: `Complete`
      }[a] ?? a]
    }), (0, jsxRuntime.jsx)(`button`, {
      disabled: r === 0,
      onClick: () => u.current(r - 1, true),
      children: tr(`上一段`, `Previous`)
    }), (0, jsxRuntime.jsx)(`button`, {
      onClick: () => u.current(r, true),
      children: a === `准备` ? tr(`开始分段 / 示范`, `Start / Demo`) : tr(`示范`, `Demo`)
    }), (0, jsxRuntime.jsx)(`button`, {
      onClick: () => u.current(r, false),
      children: tr(`重弹本段`, `Retry section`)
    }), (0, jsxRuntime.jsx)(`button`, {
      disabled: r + 1 >= n.length,
      onClick: () => u.current(r + 1, true),
      children: tr(`下一段`, `Next`)
    }), s !== `both` && (0, jsxRuntime.jsxs)(`label`, {
      children: [(0, jsxRuntime.jsx)(`input`, {
        type: `checkbox`,
        checked: t === `follow`,
        onChange: e => useAppStore.getState().setPracticeMode(e.target.checked ? `follow` : `learn`, s)
      }), tr(`另一手伴奏`, `Other hand accompaniment`)]
    })]
  });
}
var IMPORT_ACCEPT = `.musicxml,.xml,.mxl,.quick.json,.mid,.midi`;
function importKind(e) {
  return /\.midi?$/i.test(e) ? `midi` : /\.(musicxml|xml|mxl|quick\.json)$/i.test(e) ? `score` : /\.ppupdate$/i.test(e) ? `update` : null;
}
var positiveModulo = (e, t) => (e % t + t) % t;
function numberNote(e, t = [], n = 0) {
  let r = [...t].reverse().find(t => t.tick <= e.startTick) ?? {
      tick: 0,
      fifths: 0,
      minor: false
    },
    i = Math.max(21, Math.min(108, e.midi + n)),
    a = positiveModulo(r.fifths * 7 + (r.minor ? 9 : 0) + n, 12),
    o = r.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11],
    s = positiveModulo(i - a, 12),
    c = o.map((e, t) => ({
      degree: t + 1,
      alter: positiveModulo(s - e + 6, 12) - 6
    }));
  c.sort((e, t) => Math.abs(e.alter) - Math.abs(t.alter) || (r.fifths < 0 ? e.alter - t.alter : t.alter - e.alter));
  let {
    degree: l,
    alter: u
  } = c[0];
  return {
    degree: l,
    accidental: u > 0 ? `♯`.repeat(u) : `♭`.repeat(-u),
    octave: Math.floor(i / 12) - 1,
    midi: i,
    tonic: a,
    minor: r.minor
  };
}
function indexNumberedNotes(e) {
  let t = new Map();
  for (let n of e.notes) {
    let e = t.get(n.startTick) ?? [];
    e.push(n), t.set(n.startTick, e);
  }
  let n = [...t.values()].sort((e, t) => e[0].startSeconds - t[0].startSeconds),
    r = new Map(),
    i = 1,
    a = 1,
    o = 1;
  return n.forEach((e, t) => {
    let s = Math.floor(e[0].startSeconds / 8),
      c = r.get(s) ?? [];
    if (c.push(e), r.set(s, c), a = Math.max(a, e.filter(e => e.hand !== `left`).length), o = Math.max(o, e.filter(e => e.hand === `left`).length), t) {
      let r = e[0].startSeconds - n[t - 1][0].startSeconds;
      r > .001 && (i = Math.min(i, r));
    }
  }), {
    groups: n,
    byTick: t,
    pages: r,
    scale: Math.max(110, 36 / Math.max(.04, i)),
    cueHeight: Math.max(76, Math.max(a, o) * 60 + 12),
    laneHeights: {
      right: Math.max(72, a * 48 + 20),
      left: Math.max(72, o * 48 + 20)
    }
  };
}
function numberedTargets(e, t, n, r, i, a) {
  if (n.length) return (e.byTick.get(n[0].startTick) ?? n).filter(i);
  let o = 0,
    s = e.groups.length;
  for (; o < s;) {
    let n = o + s >>> 1;
    e.groups[n][0].startSeconds < t - .03 ? o = n + 1 : s = n;
  }
  for (let n = o; n < e.groups.length; n++) {
    let o = e.groups[n];
    if (o[0].startSeconds > t + a) break;
    if (o.some(e => i(e) && !r.has(e.id))) return o.filter(i);
  }
  return [];
}
var handColor = e => e === `left` ? `#6296d8` : `#ac83d9`;
var belongsToHand = (e, t) => t === `left` ? e.hand === `left` : e.hand !== `left`;
var NumberedView = (0, React.memo)(function () {
  let e = useAppStore(e => e.document),
    t = useAppStore(e => e.settings.transposeSemitones),
    n = useAppStore(e => e.settings.guidanceInTest),
    r = useAppStore(e => e.settings.showFingering),
    i = useAppStore(e => e.settings.language === `zh-CN`),
    a = (0, React.useMemo)(() => e ? indexNumberedNotes(e) : null, [e]),
    o = (0, React.useRef)(null),
    s = (0, React.useRef)(null),
    [numberViewportPage, setNumberViewportPage] = (0, React.useState)(0),
    [c, l] = (0, React.useState)({
      page: 0,
      targets: [],
      matched: new Set(),
      waiting: false,
      signature: ``
    });
  (0, React.useEffect)(() => {
    if (!a) return;
    let e = 0,
      t = ``,
      r = -1,
      i = () => {
        let c = syncEngine.state,
          u = syncEngine.pendingTargets,
          visualSeconds = c.status === `playing` ? syncEngine.clock.visualSeconds : c.currentSeconds,
          d = u[0]?.startSeconds ?? visualSeconds,
          f = Math.floor(d / 8),
          p = c.demo || c.practiceMode === `test` && !n ? [] : numberedTargets(a, visualSeconds, u, judge.matched, e => syncEngine.isPracticeNote(e), c.practiceMode === `learn` ? 4 : 1.2),
          m = [f, c.status, c.practiceMode, c.practiceHand, c.learningHands, p.map(e => `${e.id}:${+!!judge.matched.has(e.id)}`).join(`,`)].join(`|`);
        m !== t && (t = m, l({
          page: f,
          targets: p,
          matched: new Set(p.filter(e => judge.matched.has(e.id)).map(e => e.id)),
          waiting: c.status === `waiting`,
          signature: m
        }));
        let h = 60 + d * a.scale;
        o.current && (o.current.style.transform = `translateX(${Math.round(h * devicePixelRatio) / devicePixelRatio}px)`);
        let g = s.current;
        g && (g.scrollLeft = Math.max(0, h - g.clientWidth * .35));
      };
    return subscribeVisualUpdates(i, {
      store: useAppStore,
      bus: bus
    });
  }, [a, n]);
  let u = (0, React.useMemo)(() => new Map(e?.notes.map(n => [n.id, numberNote(n, e.numberKeys, t)])), [e, t]);
  if (!e || !a) return null;
  let d = 0,
    f = e.totalDuration,
    numberRadius = Math.ceil(innerWidth / (8 * a.scale)) + 1,
    p = Array.from({
      length: numberRadius * 2 + 1
    }, (_, j) => a.pages.get(numberViewportPage - numberRadius + j) ?? []).flat(),
    m = new Set(c.targets.map(e => e.id)),
    h = (t, n = false) => {
      let a = u.get(t.id),
        o = c.matched.has(t.id);
      return (0, jsxRuntime.jsxs)(`div`, {
        "data-note-id": t.id,
        "data-matched": o || void 0,
        title: `${midiToPitch(a.midi)} · ${Number((t.durationTick / e.ppq).toFixed(3))} ${i ? `拍` : `beats`}`,
        style: {
          color: handColor(t.hand),
          fontSize: n ? 36 : 24,
          fontWeight: m.has(t.id) ? 800 : 500,
          lineHeight: 1.2,
          height: n ? 60 : 42,
          whiteSpace: `nowrap`,
          opacity: o ? .45 : syncEngine.isPracticeNote(t) ? 1 : .3
        },
        children: [a.accidental, a.degree, (0, jsxRuntime.jsx)(`sup`, {
          style: {
            fontSize: `55%`
          },
          children: a.octave
        }), n && (0, jsxRuntime.jsx)(`span`, {
          "aria-label": o ? i ? `已弹对` : `Matched` : void 0,
          style: {
            display: `inline-block`,
            width: 18,
            fontSize: 14,
            visibility: o ? `visible` : `hidden`
          },
          children: `✓`
        }), (0, jsxRuntime.jsx)(`div`, {
          "aria-label": t.finger && r ? `${i ? `指法` : `Finger`} ${t.finger}` : void 0,
          style: {
            fontSize: n ? 12 : 10,
            height: n ? 16 : 12,
            lineHeight: 1,
            opacity: .72,
            marginTop: 2
          },
          children: r && t.finger ? `${t.finger}${i ? `指` : ` finger`}` : `\xA0`
        })]
      }, t.id);
    };
  return (0, jsxRuntime.jsxs)(`section`, {
    "data-piano-number": true,
    "aria-label": i ? `数字谱` : `Numbered notation`,
    style: {
      flex: `1 1 0`,
      minHeight: 0,
      overflow: `auto`,
      padding: `8px 16px`,
      background: `var(--color-surface)`,
      color: `var(--color-text)`
    },
    children: [(0, jsxRuntime.jsxs)(`div`, {
      style: {
        fontSize: 11,
        opacity: .7
      },
      children: [i ? `数字谱 · 首调 do · 上标区分八度 · 左手蓝 / 右手紫` : `Numbered · movable do · octave superscripts · left blue / right purple`, e.sourceType === `midi` ? i ? ` · MIDI 分手为估计` : ` · MIDI hands estimated` : ``]
    }), (0, jsxRuntime.jsxs)(`div`, {
      "data-numbered-cue": true,
      style: {
        display: syncEngine.state.practiceMode === `test` && !n ? `none` : `flex`,
        gap: 24,
        alignItems: `center`,
        height: a.cueHeight,
        flexShrink: 0
      },
      children: [(0, jsxRuntime.jsx)(`span`, {
        style: {
          fontSize: 12,
          width: 40,
          flexShrink: 0
        },
        children: c.waiting ? i ? `请弹齐` : `Play all` : i ? `接下来` : `Next`
      }), [`right`, `left`].map(e => (0, jsxRuntime.jsxs)(`div`, {
        style: {
          display: `flex`,
          gap: 12,
          alignItems: `center`,
          minWidth: 76
        },
        children: [(0, jsxRuntime.jsx)(`small`, {
          children: e === `right` ? i ? `右` : `R` : i ? `左` : `L`
        }), (0, jsxRuntime.jsx)(`div`, {
          children: c.targets.filter(t => belongsToHand(t, e)).map(e => h(e, true))
        })]
      }, e))]
    }), (0, jsxRuntime.jsx)(`div`, {
      ref: s,
      onScroll: event => setNumberViewportPage(Math.max(0, Math.floor((event.currentTarget.scrollLeft + event.currentTarget.clientWidth / 2 - 60) / (8 * a.scale)))),
      style: {
        overflowX: `auto`,
        overflowAnchor: `none`
      },
      children: (0, jsxRuntime.jsxs)(`div`, {
        style: {
          position: `relative`,
          width: Math.max(8, e.totalDuration) * a.scale + 70
        },
        children: [[`right`, `left`].map(e => (0, jsxRuntime.jsxs)(`div`, {
          "data-piano-hand-lane": e,
          "aria-label": e === `right` ? i ? `右手时间轴` : `Right-hand timeline` : i ? `左手时间轴` : `Left-hand timeline`,
          style: {
            position: `relative`,
            height: a.laneHeights[e],
            borderBottom: `1px solid var(--color-border)`
          },
          children: [(0, jsxRuntime.jsx)(`small`, {
            style: {
              position: `absolute`,
              top: 12,
              color: handColor(e)
            },
            children: e === `right` ? i ? `右手` : `Right` : i ? `左手` : `Left`
          }), p.map(t => (0, jsxRuntime.jsx)(`div`, {
            "data-start-tick": t[0].startTick,
            style: {
              position: `absolute`,
              left: 60 + (t[0].startSeconds - d) * a.scale,
              top: 8,
              minWidth: 30,
              borderRadius: 4,
              background: t.some(e => m.has(e.id)) ? `var(--color-surface-2)` : void 0
            },
            children: t.filter(t => belongsToHand(t, e)).map(t => (0, jsxRuntime.jsxs)(`div`, {
              children: [h(t), (0, jsxRuntime.jsx)(`div`, {
                title: i ? `音长` : `Duration`,
                style: {
                  height: 3,
                  width: Math.max(3, (Math.min(t.endSeconds, f) - t.startSeconds) * a.scale),
                  background: handColor(e),
                  opacity: .45,
                  marginBottom: 3
                }
              })]
            }, t.id))
          }, t[0].startTick))]
        }, e)), (0, jsxRuntime.jsx)(`div`, {
          "aria-label": i ? `共同时间轴` : `Shared timeline`,
          style: {
            height: 24,
            fontSize: 10,
            position: `relative`
          },
          children: Array.from({
            length: Math.ceil(e.totalDuration) + 1
          }, (e, t) => (0, jsxRuntime.jsxs)(`span`, {
            style: {
              position: `absolute`,
              left: 60 + t * a.scale
            },
            children: [d + t, `s`]
          }, t))
        }), (0, jsxRuntime.jsx)(`div`, {
          ref: o,
          "aria-label": i ? `播放指针` : `Playhead`,
          style: {
            position: `absolute`,
            top: 0,
            bottom: 24,
            left: 0,
            width: 1,
            background: `var(--color-accent)`,
            pointerEvents: `none`,
            willChange: `transform`
          }
        })]
      })
    })]
  });
});
function DistributionPanel() {
  const {
    tr: tr
  } = useI18n();
  let e = window.localUpdates,
    t = (0, React.useRef)(false),
    [n, r] = (0, React.useState)(false),
    [i, a] = (0, React.useState)(``),
    [o, s] = (0, React.useState)(null),
    [c, l] = (0, React.useState)(``),
    [u, d] = (0, React.useState)(false);
  async function f(n) {
    if (!(!e || t.current)) {
      t.current = true, r(true), s(null), d(true), l(tr(`正在校验更新包…`, `Checking update…`));
      try {
        let t = await (n ? e.prepareFile(n) : e.prepare());
        s(t), l(t ? tr(`校验通过。安装时会保留旧版本。`, `Verified. The previous version will be kept.`) : tr(`已取消`, `Cancelled`));
      } catch (e) {
        l(String(e));
      } finally {
        t.current = false, d(false);
      }
    }
  }
  return (0, React.useEffect)(() => {
    if (!e) return;
    e.info().then(e => a(e.version)).catch(e => l(String(e)));
    let t = e => void f(e.detail);
    return window.addEventListener(`piano-update-file`, t), () => window.removeEventListener(`piano-update-file`, t);
  }, [e]), e ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsx)(`button`, {
      onClick: () => r(true),
      children: tr(`更新`, `Update`)
    }), n && (0, jsxRuntime.jsx)(`div`, {
      role: `dialog`,
      "aria-label": tr(`本地更新`, `Local update`),
      style: {
        position: `fixed`,
        inset: 0,
        zIndex: 3e3,
        background: `#0008`,
        display: `grid`,
        placeItems: `center`
      },
      children: (0, jsxRuntime.jsxs)(`div`, {
        style: {
          background: `var(--color-surface)`,
          color: `var(--color-text)`,
          padding: 24,
          borderRadius: 12,
          width: 500,
          maxHeight: `80vh`,
          overflow: `auto`
        },
        onDragOver: e => e.preventDefault(),
        onDrop: e => {
          e.preventDefault(), e.stopPropagation();
          let t = e.dataTransfer.files[0];
          t && f(t);
        },
        children: [(0, jsxRuntime.jsx)(`h2`, {
          children: tr(`本地更新`, `Local update`)
        }), (0, jsxRuntime.jsxs)(`p`, {
          children: [tr(`当前版本 `, `Current version `), i, o && tr(` → 更新包 ${o.version}`, ` → Update ${o.version}`)]
        }), (0, jsxRuntime.jsx)(`p`, {
          children: tr(`选择或拖入 .ppupdate 更新包。`, `Choose or drop a .ppupdate package.`)
        }), o && (0, jsxRuntime.jsx)(`p`, {
          style: {
            whiteSpace: `pre-wrap`
          },
          children: o.notes
        }), (0, jsxRuntime.jsx)(`p`, {
          role: `status`,
          children: c
        }), (0, jsxRuntime.jsxs)(`div`, {
          style: {
            display: `flex`,
            gap: 16
          },
          children: [(0, jsxRuntime.jsx)(`button`, {
            disabled: u,
            onClick: () => void f(),
            children: tr(`导入更新…`, `Import update…`)
          }), o && (0, jsxRuntime.jsx)(`button`, {
            disabled: u,
            onClick: async () => {
              if (!t.current) {
                t.current = true, d(true);
                try {
                  useAppStore.getState().pause(), await e.install();
                } catch (e) {
                  l(String(e)), t.current = false, d(false);
                }
              }
            },
            children: tr(`安装并重启`, `Install and restart`)
          }), (0, jsxRuntime.jsx)(`button`, {
            disabled: u,
            onClick: () => r(false),
            children: tr(`稍后`, `Later`)
          })]
        })]
      })
    })]
  }) : null;
}
function exportText(e, t, n) {
  let r = URL.createObjectURL(new Blob([t], {
      type: n
    })),
    i = document.createElement(`a`);
  i.href = r, i.download = e, i.click(), setTimeout(() => URL.revokeObjectURL(r), 1e3);
}
function PracticeFeedback() {
  let e = useAppStore(e => e.practiceMode),
    [t, n] = (0, React.useState)(false),
    {
      tr: r,
      language: i
    } = useI18n(),
    {
      document: a,
      status: o,
      setPracticeMode: s,
      settings: c
    } = useAppStore(),
    l = e => s(e, c.waitForHand === `left` ? `left` : `right`),
    u = a ? judge.report(a.title, a.tempoMap[0]?.bpm ?? 120) : null,
    d = e => {
      if (!u) return;
      let t = {
          ...u,
          previousAttempts: syncEngine.completedReports.filter(e => e.runId !== u.runId)
        },
        n = i === `zh-CN` ? {
          learn: `学习`,
          follow: `单手跟练`,
          test: `正常`
        }[u.mode] : {
          learn: `Learn`,
          follow: `Follow`,
          test: `Normal`
        }[u.mode],
        r = e === `json` ? JSON.stringify(t, null, 2) : i === `zh-CN` ? `# ${u.piece}\n\n模式：${n} · ${u.tempo} BPM\n\n音高正确：${u.summary.correct}；错音：${u.summary.wrong}；漏音：${u.summary.missed}\n\n平均起音偏差：${u.summary.meanAbsOnsetMs === null ? `学习模式不评分` : Math.round(u.summary.meanAbsOnsetMs) + ` ms`}\n\n长音松键合适：${u.summary.goodReleases} / ${u.summary.judgedReleases}\n\n## 完整练习数据\n\n\`\`\`json\n${JSON.stringify(t, null, 2)}\n\`\`\`\n` : `# ${u.piece}\n\nMode: ${n} · ${u.tempo} BPM\n\nCorrect pitches: ${u.summary.correct}; wrong notes: ${u.summary.wrong}; missed notes: ${u.summary.missed}\n\nMean onset error: ${u.summary.meanAbsOnsetMs === null ? `not scored in Learn mode` : Math.round(u.summary.meanAbsOnsetMs) + ` ms`}\n\nGood releases: ${u.summary.goodReleases} / ${u.summary.judgedReleases}\n\n## Full practice data\n\n\`\`\`json\n${JSON.stringify(t, null, 2)}\n\`\`\`\n`;
      exportText(`Piano-Practice-${new Date().toISOString().replace(/[:.]/g, `-`)}.${e}`, r, e === `json` ? `application/json` : `text/markdown`);
    };
  return (0, jsxRuntime.jsxs)(`section`, {
    style: {
      position: `relative`,
      flex: `0 0 50px`,
      height: 50,
      background: `var(--color-surface)`,
      color: `var(--color-text)`,
      padding: `7px 12px`,
      fontSize: 13,
      borderTop: `1px solid var(--color-border)`,
      zIndex: 30
    },
    children: [(0, jsxRuntime.jsxs)(`div`, {
      style: {
        display: `flex`,
        gap: 10,
        alignItems: `center`,
        height: `100%`
      },
      children: [(0, jsxRuntime.jsxs)(`label`, {
        style: {
          display: `flex`,
          alignItems: `center`,
          gap: 7,
          whiteSpace: `nowrap`
        },
        children: [(0, jsxRuntime.jsx)(`span`, {
          style: {
            color: `var(--color-text-muted)`
          },
          children: r(`练习模式`, `Practice mode`)
        }), (0, jsxRuntime.jsxs)(`select`, {
          "aria-label": r(`练习模式`, `Practice mode`),
          value: e === `test` ? `test` : `learn`,
          onChange: e => {
            let t = e.target.value;
            l(t);
            useAppStore.getState().updateSettings({
              guidanceInTest: false,
              showFingering: t !== `test`
            });
            if (t === `test`) window.dispatchEvent(new Event(`piano-plain-score`));
          },
          style: {
            height: 34,
            minWidth: 116,
            padding: `0 30px 0 10px`,
            background: `var(--color-surface-2)`,
            color: `var(--color-text)`,
            border: `1px solid var(--color-border)`,
            borderRadius: 7
          },
          children: [(0, jsxRuntime.jsx)(`option`, {
            value: `test`,
            children: r(`普通练琴`, `Play score`)
          }), (0, jsxRuntime.jsx)(`option`, {
            value: `learn`,
            children: r(`教学引导`, `Guided learning`)
          })]
        })]
      }), (0, jsxRuntime.jsx)(`span`, {
        style: {
          color: `var(--color-text-muted)`,
          fontSize: 12
        },
        children: e === `test` ? r(`直接看谱 · 无教弹提示`, `Read and play · no coaching`) : r(`分段示范 · 指法与跟弹提示`, `Sections · fingering and follow-along`)
      }), (0, jsxRuntime.jsx)(`div`, {
        style: {
          flex: 1
        }
      }), (0, jsxRuntime.jsx)(`button`, {
        className: `t-btn`,
        onClick: () => {
          syncEngine.pause(), n(!t);
        },
        disabled: !a,
        children: r(`练习总结`, `Practice Summary`)
      }), (0, jsxRuntime.jsx)(`button`, {
        className: `t-btn`,
        disabled: !u,
        onClick: () => d(`md`),
        children: r(`导出 Markdown`, `Export Markdown`)
      }), (0, jsxRuntime.jsx)(`button`, {
        className: `t-btn`,
        disabled: !u,
        onClick: () => d(`json`),
        children: r(`导出 JSON`, `Export JSON`)
      })]
    }), t && u && (0, jsxRuntime.jsxs)(`div`, {
      style: {
        position: `absolute`,
        right: 12,
        bottom: `calc(100% + 8px)`,
        width: 420,
        maxWidth: `calc(100vw - 24px)`,
        padding: `12px 14px`,
        borderRadius: 10,
        background: `var(--color-surface)`,
        border: `1px solid var(--color-border)`,
        boxShadow: `0 10px 28px rgba(0,0,0,0.35)`,
        lineHeight: 1.6,
        zIndex: 60
      },
      children: [(0, jsxRuntime.jsx)(`strong`, {
        children: r(`练习总结`, `Practice Summary`)
      }), (0, jsxRuntime.jsxs)(`div`, {
        style: {
          marginTop: 6,
          color: `var(--color-text-muted)`
        },
        children: [r(`按对`, `Correct`), ` `, u.summary.correct, ` · `, r(`错音`, `Wrong`), ` `, u.summary.wrong, ` · `, r(`漏音`, `Missed`), ` `, u.summary.missed, ` · `, r(`长音松键合适`, `Good releases`), ` `, u.summary.goodReleases, `/`, u.summary.judgedReleases, (0, jsxRuntime.jsx)(`br`, {}), r(`需留意小节`, `Measures to review`), `：`, u.weakRegions.filter(e => e.errors).map(e => e.measure).join(`、`) || r(`暂无明显错音/松键问题`, `No obvious pitch/release issues`), ` · `, r(`和弦最大展开`, `Max chord spread`), `：`, Math.round(Math.max(0, ...u.chords.map(e => e.chordSpreadMs ?? 0))), ` ms`, o === `paused` && (0, jsxRuntime.jsxs)(`span`, {
          children: [` · `, r(`已暂停，可继续练习`, `Paused, ready to continue`)]
        })]
      })]
    })]
  });
}
var feedbackSeen = new Set();
function LivePracticeOverlay() {
  let [, e] = (0, React.useState)(0),
    {
      tr: t,
      language: n
    } = useI18n(),
    r = useAppStore(e => e.document),
    i = useAppStore(e => e.demo),
    a = useAppStore(e => e.settings.showFingering),
    [o, s] = (0, React.useState)(false);
  (0, React.useEffect)(() => {
    if (!r || !a || r.notes.some(e => e.finger != null) || feedbackSeen.has(r.id)) return;
    feedbackSeen.add(r.id), s(true);
    let e = setTimeout(() => s(false), 3500);
    return () => {
      clearTimeout(e), s(false);
    };
  }, [r?.id, a]), (0, React.useEffect)(() => subscribePracticeFeedback(() => e(e => e + 1), {
    store: useAppStore,
    bus: bus,
    engine: syncEngine,
    judge: judge
  }), []);
  let c = syncEngine.pendingTargets,
    l = judge.mode === `test` ? [] : judge.presses.filter(e => e.off === void 0 && !e.attempt.interrupted && (e.attempt.expectedFingerDurationMs ?? 0) >= 600),
    u = l.length ? l[0] : null,
    d = ``;
  if (u) {
    let e = u.attempt.expectedFingerDurationMs - (performance.now() - u.on),
      n = midiToPitch(u.midi);
    d = e > 650 ? t(`保持 ${n} · ${(e / 1e3).toFixed(1)}s`, `Hold ${n} · ${(e / 1e3).toFixed(1)}s`) : e > 120 ? t(`准备松开`, `Prepare to release`) : t(`松开`, `Release`);
  }
  let f = ``,
    p = `normal`;
  if (c.length) {
    if (p = `warning`, c.length === 1) {
      let e = c[0];
      f = t(`还差 ${e.pitch}${e.finger ? ` · ${e.finger}指` : ``}`, `Still need ${e.pitch}${e.finger ? ` · finger ${e.finger}` : ``}`);
    } else f = t(`还差 ${c.length} 个音`, `${c.length} notes remaining`);
  } else if (d) f = d;else if (performance.now() - judge.messageTime < 1200 && judge.lastMessage) {
    let e = judge.lastMessage.match(/^错音 · MIDI (\d+)/)?.[1];
    if (e) {
      let n = midiToPitch(Number(e));
      f = t(`错音 ${n} · 看高亮目标键`, `Wrong note ${n} · follow the highlighted target`);
    } else {
      f = translateFeedback(judge.lastMessage, n);
      let e = judge.attempts[judge.attempts.length - 1];
      if (e?.pitchStatus === `missed` && e.expectedNoteId) {
        let t = judge.notes.find(t => t.id === e.expectedNoteId);
        t?.finger && (f += n === `zh-CN` ? ` · ${t.finger}指` : ` · finger ${t.finger}`);
      }
    }
    /^(按对了|Correct|准时|On time|时值合适|Release OK)/.test(f) && (f = ``), /错音|漏音|Wrong note|Missed/.test(f) ? p = `error` : /稍早|稍晚|松早|松晚|Early|Late|Released/.test(f) && (p = `warning`);
  }
  if (i) return null;
  let m = o && a;
  return !f && !m ? null : (0, jsxRuntime.jsxs)(`div`, {
    "aria-live": `polite`,
    style: {
      position: `absolute`,
      left: `50%`,
      bottom: 172,
      transform: `translateX(-50%)`,
      zIndex: 25,
      width: `min(640px, calc(100% - 32px))`,
      pointerEvents: `none`,
      display: `flex`,
      flexDirection: `column`,
      alignItems: `center`,
      gap: 6
    },
    children: [f && (0, jsxRuntime.jsx)(`div`, {
      role: `status`,
      style: {
        minHeight: 42,
        padding: `9px 18px`,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `center`,
        borderRadius: 10,
        background: p === `error` ? `rgba(127,29,29,0.92)` : p === `warning` ? `rgba(82,63,18,0.92)` : `rgba(24,31,42,0.92)`,
        border: `1px solid ${p === `error` ? `rgba(248,113,113,0.55)` : p === `warning` ? `rgba(245,158,11,0.5)` : `var(--color-border)`}`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.28)`,
        color: `#f8fafc`,
        fontSize: 17,
        fontWeight: 650,
        letterSpacing: `0.01em`,
        textAlign: `center`,
        backdropFilter: `blur(8px)`
      },
      children: f
    }), m && (0, jsxRuntime.jsx)(`div`, {
      style: {
        fontSize: 12,
        color: `var(--color-text-muted)`,
        background: `rgba(20,25,32,0.82)`,
        padding: `5px 9px`,
        borderRadius: 6
      },
      children: t(`这份谱没有指法，可补入指法后重新导入。`, `This score has no fingering. Add fingering and re-import if needed.`)
    })]
  });
}
export { secondsToDocumentTick, learningSections, SectionPracticePanel, IMPORT_ACCEPT, importKind, positiveModulo, numberNote, indexNumberedNotes, numberedTargets, handColor, belongsToHand, NumberedView, DistributionPanel, exportText, PracticeFeedback, feedbackSeen, LivePracticeOverlay };
