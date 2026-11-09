// SPDX-License-Identifier: MIT
// See docs/PROVENANCE.md for upstream attribution and source restoration.
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { WebMidi } from 'webmidi';
import { measureAt, effectiveBpm, formatTime, syncEngine, quickLoop, measuresFor, midiToPitch, bus, keySignatureToLabel } from "./engine.js";
import { useI18n, useAppStore, CUSTOM_COLOR_PRESETS, listArchivedSongs, backingEngine, restoreLibrarySong } from "./library-store.js";
import { importKind, IMPORT_ACCEPT, DistributionPanel, SectionPracticePanel, NumberedView, LivePracticeOverlay, PracticeFeedback } from "./practice-panels.js";
import { SheetMusicView, FallingNotesView, PianoKeyboardView } from "./piano-views.js";
function TransportControls() {
  let {
      tr: e
    } = useI18n(),
    {
      demo: t,
      demoHands: n,
      setDemo: r,
      practiceMode: i,
      stablePasses: a,
      countingIn: o,
      status: s,
      currentSeconds: c,
      tempoMultiplier: l,
      loopStart: u,
      loopEnd: d,
      waitMode: f,
      document: p,
      play: m,
      pause: h,
      stop: g,
      seek: _,
      setTempoMultiplier: v,
      setLoopPoints: y,
      setWaitMode: b,
      setMetronome: x,
      settings: S,
      loadMusicXmlFile: C,
      loadMidiFile: w,
      isLoadingDocument: T,
      loadingMessage: E,
      exportMidi: D,
      exportMusicXml: O,
      isExportingPdf: k,
      isExportingMp3: ee
    } = useAppStore(),
    [A, te] = (0, React.useState)(false),
    [j, M] = (0, React.useState)(null),
    ne = (0, React.useRef)(null),
    [N, re] = (0, React.useState)(false),
    [ie, ae] = (0, React.useState)(null),
    P = (0, React.useRef)(null),
    [F, oe] = (0, React.useState)(null),
    se = (0, React.useRef)(null),
    ce = () => {
      if (!A && ne.current) {
        let e = ne.current.getBoundingClientRect();
        M({
          bottom: window.innerHeight - e.top + 8,
          right: window.innerWidth - e.right
        });
      }
      te(e => !e);
    },
    le = () => {
      if (!N && P.current) {
        let e = P.current.getBoundingClientRect();
        ae({
          bottom: window.innerHeight - e.top + 8,
          left: e.left
        });
      }
      re(e => !e);
    };
  (0, React.useEffect)(() => {
    if (!N) return;
    let e = e => {
      P.current?.contains(e.target) || re(false);
    };
    return document.addEventListener(`mousedown`, e), () => document.removeEventListener(`mousedown`, e);
  }, [N]), (0, React.useEffect)(() => {
    if (!A) return;
    let e = e => {
      ne.current?.contains(e.target) || te(false);
    };
    return document.addEventListener(`mousedown`, e), () => document.removeEventListener(`mousedown`, e);
  }, [A]);
  let I = t => {
      importKind(t.name) === `update` ? window.dispatchEvent(new CustomEvent(`piano-update-file`, {
        detail: t
      })) : importKind(t.name) === `midi` ? w(t) : importKind(t.name) === `score` ? C(t) : useAppStore.setState({
        loadError: e(`支持 MIDI / MusicXML / XML / MXL / Quick JSON；图片或 PDF 需先转换并校对。`, `Supports MIDI / MusicXML / XML / MXL / Quick JSON. Convert and review images or PDFs first.`)
      });
    },
    ue = p?.totalDuration ?? 0,
    de = F ?? c,
    fe = ue > 0 ? Math.max(0, Math.min(1, de / ue)) : 0,
    pe = u !== null && d !== null,
    L = s === `playing` || s === `waiting`,
    me = s === `paused`,
    he = s === `stopped`,
    ge = i === `test` || t,
    _e = p ? measureAt(p, de) : void 0,
    ve = _e ? Math.max(1, _e.beatSeconds.filter(e => e <= de + .001).length) : 1,
    ye = `${Math.round(l * 100)}%${p ? ` · ${effectiveBpm(p, de, l)} BPM` : ``}`,
    be = o ? e(`预备拍`, `Count-in`) : s === `waiting` ? e(`等待弹奏`, `Waiting`) : s === `playing` ? e(`播放中`, `Playing`) : s === `paused` ? e(`已暂停`, `Paused`) : e(`已停止`, `Stopped`),
    xe = e => {
      if (!ue) return 0;
      let t = e.currentTarget.getBoundingClientRect();
      return t.width <= 0 ? c : Math.max(0, Math.min(1, (e.clientX - t.left) / t.width)) * ue;
    },
    Se = e => {
      if (!(!ue || e.button !== 0)) {
        e.preventDefault(), e.currentTarget.focus(), se.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        oe(xe(e));
      }
    },
    Ce = e => {
      se.current === e.pointerId && (e.preventDefault(), oe(xe(e)));
    },
    we = (e, t) => {
      if (se.current !== e.pointerId) return;
      let n = xe(e);
      se.current = null;
      try {
        e.currentTarget.hasPointerCapture(e.pointerId) && e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      oe(null), t && _(n);
    },
    Te = e => {
      if (!ue) return;
      let t = e.shiftKey ? 5 : 1,
        n = null;
      e.key === `ArrowLeft` ? n = c - t : e.key === `ArrowRight` ? n = c + t : e.key === `Home` ? n = 0 : e.key === `End` && (n = ue), n !== null && (e.preventDefault(), e.stopPropagation(), _(Math.max(0, Math.min(ue, n))));
    },
    Ee = e => {
      let t = new Set(S.activeHands);
      t.has(e) ? t.size > 1 && t.delete(e) : t.add(e), useAppStore.getState().setActiveHands(t);
    },
    De = () => {
      let e = c,
        t = Math.min(ue, e + 30);
      y(e, t > e ? t : ue);
    },
    Oe = () => y(null, null);
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex flex-col gap-1.5 pt-2 pb-2 flex-shrink-0 select-none`,
    style: {
      borderTop: `1px solid var(--color-border)`,
      background: `var(--color-surface)`,
      paddingLeft: 12,
      paddingRight: 12
    },
    children: [(0, jsxRuntime.jsxs)(`div`, {
      className: `flex items-center gap-2`,
      style: {
        marginLeft: -12,
        marginRight: -12
      },
      children: [(0, jsxRuntime.jsxs)(`span`, {
        style: {
          width: 128,
          flexShrink: 0,
          fontSize: 12,
          paddingLeft: 12
        },
        "aria-live": `polite`,
        children: [t ? e(`示范 · `, `Demo · `) : ``, be]
      }), (0, jsxRuntime.jsxs)(`span`, {
        className: `text-xs tabular-nums shrink-0 text-right`,
        style: {
          color: `var(--color-text-muted)`,
          paddingLeft: 12
        },
        "aria-label": e(`当前时间`, `current time`),
        children: [_e ? `${e(`小节`, `Bar`)} ${_e.displayNumber} · ${e(`拍`, `Beat`)} ${ve} · ` : ``, formatTime(de)]
      }), (0, jsxRuntime.jsx)(`div`, {
        className: `flex-1 relative cursor-pointer`,
        style: {
          padding: `8px 0`,
          margin: `-8px 0`,
          touchAction: `none`
        },
        onPointerDown: Se,
        onPointerMove: Ce,
        onPointerUp: e => we(e, true),
        onPointerCancel: e => we(e, false),
        onLostPointerCapture: () => {
          se.current = null, oe(null);
        },
        onKeyDown: Te,
        role: `slider`,
        tabIndex: 0,
        "aria-label": e(`播放位置`, `Playback position`),
        "aria-valuenow": Math.round(de * 10) / 10,
        "aria-valuetext": `${_e ? `${e(`小节`, `Bar`)} ${_e.displayNumber} · ${e(`拍`, `Beat`)} ${ve} · ` : ``}${formatTime(de)} / ${formatTime(ue)}`,
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(ue * 10) / 10,
        children: (0, jsxRuntime.jsxs)(`div`, {
          className: `relative rounded-full`,
          style: {
            height: 6,
            background: `var(--color-surface-3)`
          },
          children: [pe && ue > 0 && (0, jsxRuntime.jsx)(`div`, {
            className: `absolute top-0 h-full`,
            style: {
              left: `${u / ue * 100}%`,
              width: `${(d - u) / ue * 100}%`,
              background: `var(--color-accent)`,
              opacity: .25
            }
          }), (0, jsxRuntime.jsx)(`div`, {
            className: `absolute inset-y-0 left-0 rounded-full`,
            style: {
              width: `${fe * 100}%`,
              background: `var(--color-accent)`
            }
          }), (0, jsxRuntime.jsx)(`div`, {
            style: {
              position: `absolute`,
              top: `50%`,
              left: `clamp(7px, ${fe * 100}%, calc(100% - 7px))`,
              transform: `translate(-50%, -50%)`,
              width: 14,
              height: 14,
              borderRadius: `50%`,
              background: `white`,
              boxShadow: `0 0 0 2px var(--color-accent), 0 1px 4px rgba(0,0,0,0.3)`,
              pointerEvents: `none`
            }
          })]
        })
      }), (0, jsxRuntime.jsx)(`span`, {
        className: `text-xs tabular-nums w-9 shrink-0`,
        style: {
          color: `var(--color-text-muted)`,
          paddingRight: 12
        },
        "aria-label": e(`总时长`, `total duration`),
        children: formatTime(ue)
      })]
    }), (0, jsxRuntime.jsxs)(`div`, {
      className: `flex items-center min-w-0`,
      "data-piano-transport": true,
      style: {
        gap: 6,
        overflowX: `auto`,
        scrollbarWidth: `none`
      },
      children: [(0, jsxRuntime.jsxs)(`label`, {
        title: e(`导入 MIDI / MusicXML / MXL / Quick`, `Import MIDI / MusicXML / MXL / Quick`),
        "aria-label": e(`导入 MIDI / MusicXML / MXL / Quick`, `Import MIDI / MusicXML / MXL / Quick`),
        style: {
          display: `inline-flex`,
          alignItems: `center`,
          gap: 5,
          height: 32,
          padding: `0 12px`,
          borderRadius: 7,
          cursor: `pointer`,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: `inherit`,
          flexShrink: 0,
          background: `rgba(147,51,234,0.14)`,
          border: `1px solid rgba(147,51,234,0.35)`,
          color: `var(--color-accent-text)`,
          transition: `background 0.12s`
        },
        onMouseEnter: e => e.currentTarget.style.background = `rgba(147,51,234,0.24)`,
        onMouseLeave: e => e.currentTarget.style.background = `rgba(147,51,234,0.14)`,
        children: [T ? (0, jsxRuntime.jsx)(SpinnerIcon, {}) : (0, jsxRuntime.jsx)(UploadIcon, {}), T && E ? (0, jsxRuntime.jsx)(`span`, {
          style: {
            fontSize: 11,
            color: `var(--color-text-muted)`
          },
          children: E
        }) : (0, jsxRuntime.jsx)(`span`, {
          children: e(`导入`, `Import`)
        }), (0, jsxRuntime.jsx)(`input`, {
          type: `file`,
          accept: IMPORT_ACCEPT,
          className: `hidden`,
          onChange: e => {
            let t = e.target.files?.[0];
            t && I(t), e.target.value = ``;
          }
        })]
      }), (0, jsxRuntime.jsxs)(`div`, {
        ref: P,
        style: {
          position: `relative`,
          flexShrink: 0
        },
        children: [(0, jsxRuntime.jsx)(`button`, {
          onClick: le,
          title: p ? e(`将当前乐谱导出为其他格式`, `Save the current score in another format`) : e(`导入乐谱后可使用导出`, `Load a file to enable export`),
          "aria-label": e(`导出当前乐谱`, `Export current score`),
          "aria-haspopup": `menu`,
          "aria-expanded": N,
          disabled: !p,
          style: {
            display: `inline-flex`,
            alignItems: `center`,
            justifyContent: `center`,
            height: 32,
            width: 32,
            padding: 0,
            borderRadius: 7,
            cursor: p ? `pointer` : `not-allowed`,
            flexShrink: 0,
            background: p ? `rgba(147,51,234,0.14)` : `var(--color-surface-2)`,
            border: p ? `1px solid rgba(147,51,234,0.35)` : `1px solid var(--color-border)`,
            color: p ? `var(--color-accent-text)` : `var(--color-text-muted)`,
            opacity: p ? 1 : .55,
            transition: `background 0.12s`,
            fontFamily: `inherit`
          },
          onMouseEnter: e => {
            p && (e.currentTarget.style.background = `rgba(147,51,234,0.24)`);
          },
          onMouseLeave: e => {
            p && (e.currentTarget.style.background = `rgba(147,51,234,0.14)`);
          },
          children: k || ee ? (0, jsxRuntime.jsx)(SpinnerIcon, {}) : (0, jsxRuntime.jsx)(DownloadIcon, {})
        }), N && ie && (0, jsxRuntime.jsxs)(`div`, {
          role: `menu`,
          style: {
            position: `fixed`,
            bottom: ie.bottom,
            left: ie.left,
            zIndex: 1100,
            minWidth: 180,
            padding: 6,
            background: `var(--color-surface)`,
            border: `1px solid var(--color-border)`,
            borderRadius: 8,
            boxShadow: `0 8px 24px rgba(0,0,0,0.18)`,
            display: `flex`,
            flexDirection: `column`,
            gap: 2
          },
          children: [(0, jsxRuntime.jsx)(ExportMenuItem, {
            label: `MIDI`,
            sublabel: `.midi`,
            enabled: !!p?.midiBuffer,
            onClick: () => {
              D(), re(false);
            },
            disabledReason: e(`当前乐谱没有 MIDI 数据`, `No MIDI data in this document`)
          }), (0, jsxRuntime.jsx)(ExportMenuItem, {
            label: `MusicXML`,
            sublabel: `.musicxml`,
            enabled: !!p?.musicXml,
            onClick: () => {
              O(), re(false);
            },
            disabledReason: e(`当前乐谱没有 MusicXML 数据`, `No MusicXML data in this document`)
          })]
        })]
      }), (0, jsxRuntime.jsx)(TransportDivider, {}), (0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center shrink-0`,
        style: {
          gap: 4
        },
        children: [(0, jsxRuntime.jsx)(TransportButton, {
          onClick: g,
          title: e(`停止并返回开头`, `Stop and return to start`),
          "aria-label": e(`停止`, `Stop`),
          disabled: he,
          children: (0, jsxRuntime.jsx)(StopIcon, {})
        }), (0, jsxRuntime.jsx)(TransportButton, {
          onClick: () => syncEngine.skipBy(-10),
          title: e(`后退 10 秒`, `Skip back 10 seconds`),
          "aria-label": e(`后退 10 秒`, `Skip back 10 seconds`),
          disabled: !p,
          children: (0, jsxRuntime.jsx)(RewindIcon, {})
        }), (0, jsxRuntime.jsx)(TransportButton, {
          primary: true,
          onClick: L ? h : () => m(),
          title: L ? e(`暂停`, `Pause`) : me ? e(`继续`, `Resume`) : e(`播放`, `Play`),
          "aria-label": L ? e(`暂停`, `Pause`) : me ? e(`继续播放`, `Resume playback`) : e(`播放`, `Play`),
          disabled: !p,
          children: L ? (0, jsxRuntime.jsx)(PauseIcon, {}) : (0, jsxRuntime.jsx)(PlayIcon, {})
        }), (0, jsxRuntime.jsx)(TransportButton, {
          onClick: () => syncEngine.skipBy(10),
          title: e(`前进 10 秒`, `Skip forward 10 seconds`),
          "aria-label": e(`前进 10 秒`, `Skip forward 10 seconds`),
          disabled: !p,
          children: (0, jsxRuntime.jsx)(ForwardIcon, {})
        })]
      }), (0, jsxRuntime.jsx)(TransportToggle, {
        active: t,
        onClick: () => r(!t),
        disabled: !p,
        title: e(`示范开关（D）；切换后点击播放`, `Demo (D); press Play after switching`),
        children: e(`示范`, `Demo`)
      }), (0, jsxRuntime.jsxs)(`label`, {
        "data-piano-demo-hands": true,
        style: {
          display: `inline-flex`,
          alignItems: `center`,
          gap: 6,
          flexShrink: 0,
          whiteSpace: `nowrap`
        },
        children: [(0, jsxRuntime.jsx)(`span`, {
          children: e(`示范手`, `Demo hands`)
        }), (0, jsxRuntime.jsxs)(`select`, {
          "aria-label": e(`示范手`, `Demo hands`),
          value: n,
          onChange: e => r(t, e.target.value),
          style: {
            height: 34,
            background: `var(--color-surface-2)`,
            color: `var(--color-text)`,
            borderRadius: 6
          },
          children: [(0, jsxRuntime.jsx)(`option`, {
            value: `both`,
            children: e(`双手`, `Both`)
          }), (0, jsxRuntime.jsx)(`option`, {
            value: `right`,
            children: e(`右手`, `Right`)
          }), (0, jsxRuntime.jsx)(`option`, {
            value: `left`,
            children: e(`左手`, `Left`)
          })]
        })]
      }), (0, jsxRuntime.jsx)(TransportDivider, {}), (0, jsxRuntime.jsx)(`div`, {
        className: `flex items-center shrink-0`,
        style: {
          gap: 5
        },
        children: [`left`, `right`].map(t => {
          let n = S.activeHands.has(t),
            r = t === `left`;
          return (0, jsxRuntime.jsx)(`button`, {
            disabled: i !== `test`,
            onClick: () => Ee(t),
            title: `${n ? e(`静音`, `Mute`) : e(`取消静音`, `Unmute`)} ${t === `left` ? e(`左手`, `left hand`) : e(`右手`, `right hand`)}`,
            "aria-label": `${n ? e(`静音`, `Mute`) : e(`取消静音`, `Unmute`)} ${t === `left` ? e(`左手`, `left hand`) : e(`右手`, `right hand`)}`,
            "aria-pressed": n,
            className: `rounded text-xs font-bold transition-all`,
            style: {
              width: 28,
              height: 34,
              cursor: `pointer`,
              fontFamily: `inherit`,
              ...(n ? {
                background: r ? `var(--color-left-hand-subtle)` : `var(--color-right-hand-subtle)`,
                color: r ? `var(--color-left-hand-text)` : `var(--color-right-hand-text)`,
                border: r ? `1px solid var(--color-left-hand-subtle-border)` : `1px solid var(--color-right-hand-subtle-border)`
              } : {
                background: `var(--color-surface-2)`,
                color: `var(--color-text-muted)`,
                border: `1px solid var(--color-border)`,
                opacity: .5
              })
            },
            children: r ? `L` : `R`
          }, t);
        })
      }), (0, jsxRuntime.jsx)(`div`, {
        className: `flex-1 min-w-0`
      }), (0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center shrink-0`,
        style: {
          gap: 4
        },
        children: [(0, jsxRuntime.jsxs)(TransportToggle, {
          active: f && !t,
          onClick: () => b(!f),
          title: ge ? e(`检测模式下等待功能不可用`, `Wait is unavailable in Test mode`) : e(`等待你弹出正确音符后继续`, `Pause until you play the correct note`),
          "aria-label": e(`等待模式`, `Wait mode`),
          "aria-pressed": f && !t,
          disabled: ge,
          children: [(0, jsxRuntime.jsx)(WaitIcon, {}), ` `, e(`等待`, `Wait`)]
        }), (0, jsxRuntime.jsxs)(`select`, {
          value: ``,
          "aria-label": e(`快速小节循环`, `Quick measure loop`),
          disabled: !p,
          style: {
            height: 34,
            background: `var(--color-surface-2)`,
            color: `var(--color-text)`,
            borderRadius: 6
          },
          onChange: e => {
            if (p) if (e.target.value === `clear`) Oe();else {
              let [t, n] = quickLoop(p, c, Number(e.target.value));
              y(t, n), _(t);
            }
          },
          children: [(0, jsxRuntime.jsx)(`option`, {
            value: ``,
            disabled: true,
            children: e(`小节循环…`, `Measure loop…`)
          }), [1, 2, 4].map(t => (0, jsxRuntime.jsx)(`option`, {
            value: t,
            children: e(`${t} 小节`, `${t} measure${t > 1 ? `s` : ``}`)
          }, t)), (0, jsxRuntime.jsx)(`option`, {
            value: `clear`,
            children: e(`清除循环`, `Clear loop`)
          })]
        }), (0, jsxRuntime.jsxs)(`div`, {
          className: `flex items-center shrink-0`,
          style: {
            border: `1px solid var(--color-border)`,
            borderRadius: 7,
            overflow: `hidden`,
            background: `var(--color-surface-2)`
          },
          children: [(0, jsxRuntime.jsx)(`button`, {
            onClick: () => {
              d !== null && y(Math.min(c, d - 1), d);
            },
            disabled: !pe,
            title: e(`将当前位置设为循环起点 A`, `Set loop start (A) to current position`),
            "aria-label": e(`设置循环起点`, `Set loop start to current position`),
            style: {
              height: 34,
              padding: `0 8px`,
              background: `transparent`,
              border: `none`,
              borderRight: `1px solid var(--color-border)`,
              color: pe ? `var(--color-accent-text)` : `var(--color-text-muted)`,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: `inherit`,
              cursor: pe ? `pointer` : `default`,
              opacity: pe ? 1 : .5,
              transition: `all 0.12s`
            },
            children: `A`
          }), (0, jsxRuntime.jsxs)(`button`, {
            onClick: pe ? Oe : De,
            disabled: !p,
            title: pe ? e(`清除循环`, `Clear loop`) : e(`从当前位置开始 A/B 循环`, `Start A/B loop from current position`),
            "aria-label": pe ? e(`清除循环`, `Clear loop`) : e(`开始循环`, `Start loop`),
            "aria-pressed": pe,
            style: {
              height: 34,
              padding: `0 9px`,
              background: pe ? `var(--color-accent-subtle)` : `transparent`,
              border: `none`,
              color: pe ? `var(--color-accent-text)` : `var(--color-text-muted)`,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: `inherit`,
              cursor: p ? `pointer` : `default`,
              display: `flex`,
              alignItems: `center`,
              gap: 4,
              transition: `all 0.12s`
            },
            children: [(0, jsxRuntime.jsx)(LoopIcon, {}), pe ? `${formatTime(u)}-${formatTime(d)}` : e(`循环`, `Loop`)]
          }), (0, jsxRuntime.jsx)(`button`, {
            onClick: () => {
              u !== null && y(u, Math.max(c, u + 1));
            },
            disabled: !pe,
            title: e(`将当前位置设为循环终点 B`, `Set loop end (B) to current position`),
            "aria-label": e(`设置循环终点`, `Set loop end to current position`),
            style: {
              height: 34,
              padding: `0 8px`,
              background: `transparent`,
              border: `none`,
              borderLeft: `1px solid var(--color-border)`,
              color: pe ? `var(--color-accent-text)` : `var(--color-text-muted)`,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: `inherit`,
              cursor: pe ? `pointer` : `default`,
              opacity: pe ? 1 : .5,
              transition: `all 0.12s`
            },
            children: `B`
          })]
        }), (0, jsxRuntime.jsxs)(TransportToggle, {
          active: S.metronomeEnabled,
          onClick: () => x(!S.metronomeEnabled),
          title: e(`木质节拍器（跟随乐谱节奏）`, `Woodblock metronome (follows the score)`),
          "aria-label": e(`切换节拍器`, `Toggle metronome`),
          "aria-pressed": S.metronomeEnabled,
          children: [(0, jsxRuntime.jsx)(MetronomeIcon, {}), ` `, e(`节拍器`, `Metronome`)]
        }), (0, jsxRuntime.jsxs)(`div`, {
          className: `relative shrink-0`,
          ref: ne,
          children: [(0, jsxRuntime.jsxs)(TransportToggle, {
            active: l !== 1 || A,
            onClick: ce,
            title: e(`播放速度`, `Playback speed`),
            "aria-label": e(`播放速度`, `Playback speed`),
            "aria-pressed": A,
            children: [(0, jsxRuntime.jsx)(TempoIcon, {}), ye, S.speedTrainer.enabled ? ` · ${a}/2` : ``]
          }), A && j && (0, jsxRuntime.jsxs)(`div`, {
            style: {
              position: `fixed`,
              bottom: j.bottom,
              right: j.right,
              width: 220,
              background: `var(--color-surface)`,
              border: `1px solid var(--color-border)`,
              borderRadius: 10,
              boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
              zIndex: 100,
              padding: `12px 14px`
            },
            children: [(0, jsxRuntime.jsxs)(`div`, {
              style: {
                display: `flex`,
                alignItems: `center`,
                justifyContent: `space-between`,
                marginBottom: 10
              },
              children: [(0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 12,
                  fontWeight: 600,
                  color: `var(--color-text)`
                },
                children: e(`播放速度`, `Playback Speed`)
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 13,
                  fontWeight: 700,
                  color: `var(--color-accent-text)`,
                  fontVariantNumeric: `tabular-nums`
                },
                children: ye
              })]
            }), (0, jsxRuntime.jsx)(`input`, {
              type: `range`,
              min: 25,
              max: 200,
              step: 5,
              value: Math.round(l * 100),
              onChange: e => v(Number(e.target.value) / 100),
              "aria-label": e(`播放速度`, `Playback speed`),
              style: {
                width: `100%`,
                accentColor: `var(--color-accent)`
              }
            }), (0, jsxRuntime.jsxs)(`div`, {
              style: {
                display: `flex`,
                justifyContent: `space-between`,
                fontSize: 10,
                color: `var(--color-text-muted)`,
                marginTop: 4
              },
              children: [(0, jsxRuntime.jsx)(`span`, {
                children: `25%`
              }), (0, jsxRuntime.jsx)(`span`, {
                children: `100%`
              }), (0, jsxRuntime.jsx)(`span`, {
                children: `200%`
              })]
            }), l !== 1 && (0, jsxRuntime.jsx)(`button`, {
              onClick: () => v(1),
              style: {
                marginTop: 10,
                width: `100%`,
                background: `var(--color-surface-2)`,
                border: `1px solid var(--color-border)`,
                borderRadius: 6,
                color: `var(--color-accent-text)`,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: `inherit`,
                padding: `5px 0`,
                cursor: `pointer`
              },
              children: e(`恢复 100%`, `Reset to 100%`)
            })]
          })]
        })]
      })]
    })]
  });
}
function TransportButton({
  onClick: e,
  title: t,
  "aria-label": n,
  children: r,
  primary: i,
  disabled: a
}) {
  return (0, jsxRuntime.jsx)(`button`, {
    className: `t-btn${i ? ` primary` : ``}`,
    onClick: e,
    title: t,
    "aria-label": n ?? t,
    disabled: a,
    children: r
  });
}
function TransportToggle({
  active: e,
  onClick: t,
  title: n,
  "aria-label": r,
  "aria-pressed": i,
  children: a,
  disabled: o
}) {
  return (0, jsxRuntime.jsx)(`button`, {
    onClick: t,
    title: n,
    "aria-label": r ?? n,
    "aria-pressed": i,
    disabled: o,
    className: `flex items-center gap-1 rounded text-xs font-medium transition-all shrink-0`,
    style: {
      height: 34,
      padding: `0 8px`,
      cursor: o ? `default` : `pointer`,
      fontFamily: `inherit`,
      ...(e ? {
        background: `var(--color-accent-subtle)`,
        color: `var(--color-accent-text)`,
        border: `1px solid var(--color-accent-subtle-border)`
      } : {
        background: `var(--color-surface-2)`,
        color: `var(--color-text-muted)`,
        border: `1px solid var(--color-border)`
      })
    },
    children: a
  });
}
function TransportDivider() {
  return (0, jsxRuntime.jsx)(`div`, {
    className: `shrink-0`,
    style: {
      width: 1,
      height: 20,
      background: `var(--color-border)`,
      margin: `0 2px`
    }
  });
}
function ExportMenuItem({
  label: e,
  sublabel: t,
  enabled: n,
  onClick: r,
  disabledReason: i
}) {
  let {
    tr: a
  } = useI18n();
  return (0, jsxRuntime.jsxs)(`button`, {
    role: `menuitem`,
    onClick: n ? r : void 0,
    disabled: !n,
    title: n ? a(`另存为 ${t}`, `Save as ${t}`) : i,
    style: {
      display: `flex`,
      alignItems: `baseline`,
      justifyContent: `space-between`,
      gap: 12,
      padding: `8px 10px`,
      background: `transparent`,
      border: `none`,
      borderRadius: 5,
      cursor: n ? `pointer` : `not-allowed`,
      opacity: n ? 1 : .45,
      color: `var(--color-text)`,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: `inherit`,
      textAlign: `left`,
      transition: `background 0.1s`
    },
    onMouseEnter: e => {
      n && (e.currentTarget.style.background = `var(--color-surface-2)`);
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = `transparent`;
    },
    children: [(0, jsxRuntime.jsx)(`span`, {
      children: e
    }), (0, jsxRuntime.jsx)(`span`, {
      style: {
        fontSize: 11,
        color: `var(--color-text-muted)`
      },
      children: t
    })]
  });
}
var PlayIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `12`,
  height: `12`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M8 5v14l11-7z`
  })
});
var PauseIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `12`,
  height: `12`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M6 19h4V5H6v14zm8-14v14h4V5h-4z`
  })
});
var StopIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `10`,
  height: `10`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`rect`, {
    x: `5`,
    y: `5`,
    width: `14`,
    height: `14`,
    rx: `1`
  })
});
var RewindIcon = () => (0, jsxRuntime.jsxs)(`svg`, {
  width: `15`,
  height: `15`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: [(0, jsxRuntime.jsx)(`path`, {
    d: `M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z`
  }), (0, jsxRuntime.jsx)(`text`, {
    x: `12`,
    y: `16`,
    fontSize: `7`,
    fontWeight: `bold`,
    textAnchor: `middle`,
    fontFamily: `inherit`,
    children: `10`
  })]
});
var ForwardIcon = () => (0, jsxRuntime.jsxs)(`svg`, {
  width: `15`,
  height: `15`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: [(0, jsxRuntime.jsx)(`path`, {
    d: `M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z`
  }), (0, jsxRuntime.jsx)(`text`, {
    x: `12`,
    y: `16`,
    fontSize: `7`,
    fontWeight: `bold`,
    textAnchor: `middle`,
    fontFamily: `inherit`,
    children: `10`
  })]
});
var UploadIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `12`,
  height: `12`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z`
  })
});
var DownloadIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `12`,
  height: `12`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M9 4h6v6h4l-7 7-7-7h4v-6zm-4 14h14v2H5v-2z`
  })
});
var SpinnerIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `12`,
  height: `12`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  style: {
    animation: `spin 1s linear infinite`
  },
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z`
  })
});
var WaitIcon = () => (0, jsxRuntime.jsxs)(`svg`, {
  width: `10`,
  height: `10`,
  viewBox: `0 0 20 20`,
  fill: `currentColor`,
  children: [(0, jsxRuntime.jsx)(`rect`, {
    x: `3.5`,
    y: `10`,
    width: `13`,
    height: `7`,
    rx: `1.5`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `4`,
    y: `2.5`,
    width: `2.5`,
    height: `9`,
    rx: `1.25`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `7.5`,
    y: `1`,
    width: `2.5`,
    height: `10.5`,
    rx: `1.25`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `11`,
    y: `1.5`,
    width: `2.5`,
    height: `10`,
    rx: `1.25`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `14`,
    y: `4`,
    width: `2.5`,
    height: `7.5`,
    rx: `1.25`
  })]
});
var LoopIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `12`,
  height: `12`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.68 14.72 20 13.41 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.32 9.28 4 10.59 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z`
  })
});
var TempoIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `10`,
  height: `10`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M7 2v11h3v9l7-12h-4l4-8z`
  })
});
var MetronomeIcon = () => (0, jsxRuntime.jsxs)(`svg`, {
  width: `10`,
  height: `10`,
  viewBox: `0 0 20 20`,
  fill: `none`,
  stroke: `currentColor`,
  strokeWidth: `1.6`,
  strokeLinecap: `round`,
  strokeLinejoin: `round`,
  children: [(0, jsxRuntime.jsx)(`path`, {
    d: `M10 2L2 18h16L10 2z`
  }), (0, jsxRuntime.jsx)(`line`, {
    x1: `10`,
    y1: `15`,
    x2: `13.5`,
    y2: `6`
  })]
});
var SettingLabelContext = (0, React.createContext)(``);
var NOTE_FILTER_OPTIONS = [{
  value: `all`,
  label: `All`,
  title: `Show all notes`
}, {
  value: `white`,
  label: `Natural`,
  title: `Show only natural (white) key notes`
}, {
  value: `black`,
  label: `Sharps`,
  title: `Show only sharp/flat (black) key notes`
}, {
  value: `c_only`,
  label: `C only`,
  title: `Show only C notes`
}];
var COLOR_THEME_LABELS = {
  violet: `Violet`,
  classic: `Classic`,
  ocean: `Ocean`,
  forest: `Forest`,
  cascade: `Cascade`,
  custom: `Custom`
};
var KEY_LABEL_OPTIONS = [{
  value: `none`,
  label: `None`,
  title: `No note name labels`
}, {
  value: `c_only`,
  label: `C only`,
  title: `Label C notes with octave number (C4, C5…)`
}, {
  value: `white`,
  label: `Natural`,
  title: `Label all natural (white) keys`
}, {
  value: `black`,
  label: `Sharps`,
  title: `Label all sharp/flat (black) keys`
}, {
  value: `all`,
  label: `All`,
  title: `Label every key`
}];
function transposeLabel(e, t) {
  return e === 0 ? t === `zh-CN` ? `原调` : `original` : e > 0 ? `+${e}♯` : `${e}♭`;
}
function SettingSwitch({
  active: e,
  onClick: t,
  title: n,
  "aria-label": r
}) {
  let i = (0, React.useContext)(SettingLabelContext);
  return (0, jsxRuntime.jsx)(`button`, {
    role: `switch`,
    "aria-checked": e,
    "aria-label": r ?? i ?? n,
    onClick: t,
    title: n,
    style: {
      display: `inline-flex`,
      alignItems: `center`,
      cursor: `pointer`,
      flexShrink: 0,
      border: `none`,
      background: `transparent`,
      padding: `8px`,
      margin: `-8px`
    },
    children: (0, jsxRuntime.jsx)(`span`, {
      style: {
        display: `inline-block`,
        width: 38,
        height: 22,
        borderRadius: 11,
        background: e ? `var(--color-accent)` : `var(--color-toggle-off)`,
        position: `relative`,
        transition: `background 0.18s`
      },
      children: (0, jsxRuntime.jsx)(`span`, {
        style: {
          position: `absolute`,
          top: 3,
          left: e ? 17 : 3,
          width: 16,
          height: 16,
          borderRadius: `50%`,
          background: `white`,
          transition: `left 0.18s`,
          boxShadow: `0 1px 3px rgba(0,0,0,0.25)`
        }
      })
    })
  });
}
function SettingRow({
  label: e,
  sublabel: t,
  title: n,
  stacked: r = false,
  children: i
}) {
  let a = n ?? e;
  return r ? (0, jsxRuntime.jsx)(SettingLabelContext.Provider, {
    value: a,
    children: (0, jsxRuntime.jsxs)(`div`, {
      className: `settings-row`,
      style: {
        paddingTop: 7,
        paddingBottom: 9,
        borderRadius: 4
      },
      children: [(0, jsxRuntime.jsxs)(`div`, {
        title: n,
        style: {
          marginBottom: 6
        },
        children: [(0, jsxRuntime.jsx)(`span`, {
          style: {
            fontSize: 13.5,
            color: `var(--color-text)`,
            display: `block`,
            fontWeight: 400
          },
          children: e
        }), t && (0, jsxRuntime.jsx)(`span`, {
          style: {
            fontSize: 11,
            color: `var(--color-text-muted)`,
            display: `block`,
            marginTop: 2
          },
          children: t
        })]
      }), (0, jsxRuntime.jsx)(`div`, {
        children: i
      })]
    })
  }) : (0, jsxRuntime.jsx)(SettingLabelContext.Provider, {
    value: a,
    children: (0, jsxRuntime.jsxs)(`div`, {
      className: `settings-row flex items-center justify-between gap-4`,
      style: {
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 4
      },
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `shrink-0`,
        title: n,
        children: [(0, jsxRuntime.jsx)(`span`, {
          style: {
            fontSize: 13.5,
            color: `var(--color-text)`,
            display: `block`,
            fontWeight: 400
          },
          children: e
        }), t && (0, jsxRuntime.jsx)(`span`, {
          style: {
            fontSize: 10,
            color: `var(--color-text-muted)`,
            display: `block`,
            marginTop: 2
          },
          children: t
        })]
      }), (0, jsxRuntime.jsx)(`div`, {
        className: `flex items-center gap-1.5 flex-wrap justify-end`,
        children: i
      })]
    })
  });
}
function SegmentedControl({
  options: e,
  value: t,
  onChange: n,
  fullWidth: r = false,
  "aria-label": i
}) {
  return (0, jsxRuntime.jsx)(`div`, {
    role: `radiogroup`,
    "aria-label": i,
    style: {
      display: r ? `flex` : `inline-flex`,
      width: r ? `100%` : void 0,
      padding: 3,
      background: `var(--color-surface-2)`,
      borderRadius: 8,
      border: `1px solid var(--color-border)`,
      gap: 2,
      flexShrink: 0
    },
    children: e.map(e => {
      let i = e.value === t;
      return (0, jsxRuntime.jsx)(`button`, {
        role: `radio`,
        "aria-checked": i,
        onClick: () => n(e.value),
        title: e.title,
        style: {
          padding: `3px 10px`,
          borderRadius: 5,
          border: `none`,
          background: i ? `var(--color-accent)` : `transparent`,
          color: i ? `#fff` : `var(--color-text-muted)`,
          fontSize: 12,
          fontWeight: i ? 600 : 400,
          cursor: `pointer`,
          fontFamily: `inherit`,
          transition: `all 0.12s`,
          flexShrink: 0,
          flex: r ? 1 : void 0,
          whiteSpace: `nowrap`
        },
        children: e.label
      }, String(e.value));
    })
  });
}
function SettingsSection({
  title: e,
  children: t
}) {
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `border-b`,
    style: {
      borderColor: `var(--color-border)`
    },
    children: [(0, jsxRuntime.jsx)(`div`, {
      className: `text-xs font-bold uppercase select-none`,
      style: {
        color: `var(--color-text)`,
        letterSpacing: `0.07em`,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 14,
        paddingBottom: 6
      },
      children: e
    }), (0, jsxRuntime.jsx)(`div`, {
      style: {
        paddingLeft: 20,
        paddingRight: 20
      },
      children: t
    })]
  });
}
function SettingsHeading({
  children: e
}) {
  return (0, jsxRuntime.jsx)(`div`, {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: `0.08em`,
      textTransform: `uppercase`,
      color: `var(--color-text-muted)`,
      paddingTop: 12,
      paddingBottom: 2,
      marginTop: 4,
      borderTop: `1px solid var(--color-border)`
    },
    children: e
  });
}
function ResetSettingsButton() {
  let {
      resetSettings: e
    } = useAppStore(),
    {
      tr: t
    } = useI18n(),
    [n, r] = (0, React.useState)(false),
    [i, a] = (0, React.useState)(false);
  return (0, jsxRuntime.jsx)(`div`, {
    style: {
      padding: `16px 20px 24px`,
      display: `flex`,
      flexDirection: `column`,
      gap: 10
    },
    children: (0, jsxRuntime.jsx)(`button`, {
      onClick: () => {
        n ? (e(), r(false)) : (r(true), setTimeout(() => r(false), 3e3));
      },
      onMouseEnter: () => a(true),
      onMouseLeave: () => a(false),
      title: t(`恢复所有默认设置`, `Reset all settings to their default values`),
      style: {
        width: `100%`,
        padding: `8px 0`,
        borderRadius: 8,
        border: n ? `1px solid rgba(239,68,68,0.55)` : i ? `1px solid rgba(239,68,68,0.35)` : `1px solid var(--color-border)`,
        background: n ? `rgba(239,68,68,0.08)` : `var(--color-surface-2)`,
        color: n || i ? `#f87171` : `var(--color-text-muted)`,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: `inherit`,
        cursor: `pointer`,
        transition: `all 0.15s`
      },
      children: n ? t(`再次点击确认恢复`, `Click again to confirm reset`) : t(`恢复默认设置`, `Reset to defaults`)
    })
  });
}
function SettingsPanel({
  open: e,
  onClose: t
}) {
  let {
      settings: n,
      updateSettings: r
    } = useAppStore(),
    {
      tr: i
    } = useI18n(),
    a = (e, t, n) => ({
      "--fill-pct": `${(e - t) / (n - t) * 100}%`
    }),
    o = e => {
      r(e === `custom` ? {
        colorTheme: `custom`,
        customColors: n.colorTheme === `custom` ? n.customColors : CUSTOM_COLOR_PRESETS[n.colorTheme]
      } : {
        colorTheme: e
      });
    };
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [e && (0, jsxRuntime.jsx)(`div`, {
      onClick: t,
      style: {
        position: `fixed`,
        inset: 0,
        zIndex: 999,
        background: `rgba(0,0,0,0.4)`
      }
    }), (0, jsxRuntime.jsxs)(`div`, {
      style: {
        position: `fixed`,
        right: 0,
        top: 0,
        height: `100vh`,
        width: 360,
        zIndex: 1e3,
        transform: e ? `translateX(0)` : `translateX(100%)`,
        transition: `transform 0.2s ease`,
        background: `var(--color-surface)`,
        borderLeft: `1px solid var(--color-border)`,
        boxShadow: `-6px 0 24px rgba(0,0,0,0.14)`,
        display: `flex`,
        flexDirection: `column`
      },
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center justify-between shrink-0 border-b`,
        style: {
          borderColor: `var(--color-border)`,
          padding: `14px 20px`
        },
        children: [(0, jsxRuntime.jsx)(`span`, {
          style: {
            fontSize: 16,
            fontWeight: 700,
            color: `var(--color-text)`
          },
          children: i(`设置`, `Settings`)
        }), (0, jsxRuntime.jsx)(`button`, {
          onClick: t,
          style: {
            width: 28,
            height: 28,
            display: `flex`,
            alignItems: `center`,
            justifyContent: `center`,
            background: `var(--color-surface-2)`,
            border: `1px solid var(--color-border)`,
            borderRadius: 7,
            color: `var(--color-text-muted)`,
            cursor: `pointer`,
            fontSize: 14,
            lineHeight: 1
          },
          title: i(`关闭设置`, `Close settings`),
          "aria-label": i(`关闭设置`, `Close settings`),
          children: `×`
        })]
      }), (0, jsxRuntime.jsxs)(`div`, {
        className: `flex-1 overflow-y-auto`,
        style: {
          overflowX: `hidden`
        },
        children: [(0, jsxRuntime.jsx)(SettingsSection, {
          title: i(`语言`, `Language`),
          children: (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`界面语言`, `Interface language`),
            sublabel: i(`切换后立即生效`, `applies immediately`),
            stacked: true,
            children: (0, jsxRuntime.jsx)(SegmentedControl, {
              "aria-label": i(`界面语言`, `Interface language`),
              options: [{
                value: `zh-CN`,
                label: `中文`
              }, {
                value: `en-US`,
                label: `English`
              }],
              value: n.language,
              onChange: e => r({
                language: e
              }),
              fullWidth: true
            })
          })
        }), (0, jsxRuntime.jsxs)(SettingsSection, {
          title: i(`外观`, `Appearance`),
          children: [(0, jsxRuntime.jsx)(`div`, {
            style: {
              padding: `10px 0 4px`
            },
            children: (0, jsxRuntime.jsx)(`span`, {
              style: {
                fontSize: 13.5,
                color: `var(--color-text)`,
                fontWeight: 400
              },
              children: i(`配色主题`, `Color theme`)
            })
          }), (0, jsxRuntime.jsxs)(`div`, {
            style: {
              padding: `0 0 12px`,
              display: `flex`,
              flexDirection: `column`,
              gap: 8
            },
            children: [(0, jsxRuntime.jsx)(`div`, {
              style: {
                display: `grid`,
                gridTemplateColumns: `repeat(5, 1fr)`,
                gap: 6
              },
              children: [`violet`, `classic`, `ocean`, `forest`, `cascade`].map(e => {
                let t = CUSTOM_COLOR_PRESETS[e],
                  r = n.colorTheme === e;
                return (0, jsxRuntime.jsxs)(`button`, {
                  onClick: () => o(e),
                  title: n.language === `zh-CN` ? {
                    violet: `紫罗兰`,
                    classic: `经典`,
                    ocean: `海洋`,
                    forest: `森林`,
                    cascade: `瀑布`
                  }[e] : COLOR_THEME_LABELS[e],
                  "aria-label": `${i(`配色主题`, `Color theme`)}: ${n.language === `zh-CN` ? {
                    violet: `紫罗兰`,
                    classic: `经典`,
                    ocean: `海洋`,
                    forest: `森林`,
                    cascade: `瀑布`
                  }[e] : COLOR_THEME_LABELS[e]}`,
                  "aria-pressed": r,
                  style: {
                    display: `flex`,
                    flexDirection: `column`,
                    alignItems: `center`,
                    gap: 5,
                    padding: `8px 4px 6px`,
                    borderRadius: 8,
                    border: r ? `2px solid var(--color-accent)` : `2px solid var(--color-border)`,
                    background: r ? `var(--color-accent-subtle)` : `var(--color-surface-2)`,
                    cursor: `pointer`,
                    transition: `border-color 0.15s, background 0.15s`
                  },
                  children: [(0, jsxRuntime.jsx)(`div`, {
                    style: {
                      display: `flex`,
                      gap: 5
                    },
                    children: [{
                      color: t.leftHand,
                      label: `L`
                    }, {
                      color: t.rightHand,
                      label: `R`
                    }].map(({
                      color: e,
                      label: t
                    }) => (0, jsxRuntime.jsxs)(`div`, {
                      style: {
                        display: `flex`,
                        flexDirection: `column`,
                        alignItems: `center`,
                        gap: 2
                      },
                      children: [(0, jsxRuntime.jsx)(`span`, {
                        style: {
                          width: 11,
                          height: 11,
                          borderRadius: `50%`,
                          background: e,
                          boxShadow: `0 1px 3px rgba(0,0,0,0.3)`,
                          display: `block`
                        }
                      }), (0, jsxRuntime.jsx)(`span`, {
                        style: {
                          fontSize: 8,
                          fontWeight: 700,
                          color: `var(--color-text-muted)`,
                          lineHeight: 1
                        },
                        children: t
                      })]
                    }, t))
                  }), (0, jsxRuntime.jsx)(`span`, {
                    style: {
                      fontSize: 10,
                      fontWeight: r ? 700 : 500,
                      color: r ? `var(--color-accent-text)` : `var(--color-text-muted)`,
                      letterSpacing: `0.02em`,
                      lineHeight: 1
                    },
                    children: n.language === `zh-CN` ? {
                      violet: `紫罗兰`,
                      classic: `经典`,
                      ocean: `海洋`,
                      forest: `森林`,
                      cascade: `瀑布`
                    }[e] : COLOR_THEME_LABELS[e]
                  })]
                }, e);
              })
            }), (0, jsxRuntime.jsxs)(`button`, {
              onClick: () => o(`custom`),
              "aria-pressed": n.colorTheme === `custom`,
              style: {
                display: `flex`,
                alignItems: `center`,
                gap: 8,
                padding: `7px 10px`,
                borderRadius: 8,
                border: n.colorTheme === `custom` ? `2px solid var(--color-accent)` : `2px solid var(--color-border)`,
                background: n.colorTheme === `custom` ? `var(--color-accent-subtle)` : `var(--color-surface-2)`,
                cursor: `pointer`,
                width: `100%`,
                transition: `border-color 0.15s, background 0.15s`
              },
              children: [(0, jsxRuntime.jsx)(`div`, {
                style: {
                  display: `flex`,
                  gap: 5
                },
                children: [{
                  key: `leftHand`,
                  label: `L`
                }, {
                  key: `rightHand`,
                  label: `R`
                }, {
                  key: `unknown`,
                  label: `?`
                }].map(({
                  key: e,
                  label: t
                }) => (0, jsxRuntime.jsxs)(`div`, {
                  style: {
                    display: `flex`,
                    flexDirection: `column`,
                    alignItems: `center`,
                    gap: 2
                  },
                  children: [(0, jsxRuntime.jsx)(`span`, {
                    style: {
                      width: 10,
                      height: 10,
                      borderRadius: `50%`,
                      background: n.customColors[e],
                      boxShadow: `0 1px 3px rgba(0,0,0,0.3)`,
                      display: `block`
                    }
                  }), (0, jsxRuntime.jsx)(`span`, {
                    style: {
                      fontSize: 8,
                      fontWeight: 700,
                      color: `var(--color-text-muted)`,
                      lineHeight: 1
                    },
                    children: t
                  })]
                }, e))
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 12,
                  fontWeight: n.colorTheme === `custom` ? 700 : 500,
                  color: n.colorTheme === `custom` ? `var(--color-accent-text)` : `var(--color-text-muted)`
                },
                children: i(`自定义`, `Custom`)
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 11,
                  color: `var(--color-text-muted)`,
                  marginLeft: `auto`
                },
                children: i(`自定义颜色`, `pick your own colors`)
              })]
            }), n.colorTheme === `custom` && (0, jsxRuntime.jsx)(`div`, {
              style: {
                display: `flex`,
                gap: 12,
                padding: `8px 10px`,
                borderRadius: 8,
                background: `var(--color-surface-2)`,
                border: `1px solid var(--color-border)`
              },
              children: [{
                key: `leftHand`,
                label: i(`左手`, `Left hand`)
              }, {
                key: `rightHand`,
                label: i(`右手`, `Right hand`)
              }, {
                key: `unknown`,
                label: i(`其他`, `Other`)
              }].map(({
                key: e,
                label: t
              }) => (0, jsxRuntime.jsxs)(`label`, {
                style: {
                  display: `flex`,
                  flexDirection: `column`,
                  alignItems: `center`,
                  gap: 4,
                  cursor: `pointer`,
                  flex: 1
                },
                children: [(0, jsxRuntime.jsx)(`input`, {
                  type: `color`,
                  value: n.customColors[e],
                  onChange: t => r({
                    customColors: {
                      ...n.customColors,
                      [e]: t.target.value
                    }
                  }),
                  style: {
                    width: 36,
                    height: 28,
                    padding: 2,
                    border: `1px solid var(--color-border)`,
                    borderRadius: 6,
                    background: `none`,
                    cursor: `pointer`
                  }
                }), (0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 10,
                    color: `var(--color-text-muted)`,
                    whiteSpace: `nowrap`
                  },
                  children: t
                })]
              }, e))
            }), (() => {
              let e = n.colorTheme === `custom` ? n.customColors : CUSTOM_COLOR_PRESETS[n.colorTheme];
              return (0, jsxRuntime.jsxs)(`div`, {
                style: {
                  display: `flex`,
                  flexDirection: `column`,
                  gap: 6,
                  padding: `4px 10px 6px`,
                  borderRadius: 8,
                  background: `var(--color-surface-2)`,
                  border: `1px solid var(--color-border)`
                },
                children: [(0, jsxRuntime.jsxs)(`div`, {
                  style: {
                    display: `flex`,
                    alignItems: `center`,
                    justifyContent: `space-between`
                  },
                  children: [(0, jsxRuntime.jsxs)(`div`, {
                    style: {
                      display: `flex`,
                      flexDirection: `column`,
                      gap: 1
                    },
                    children: [(0, jsxRuntime.jsx)(`span`, {
                      style: {
                        fontSize: 13,
                        color: `var(--color-text)`,
                        fontWeight: 500
                      },
                      children: i(`区分左右手`, `Differentiate hands`)
                    }), (0, jsxRuntime.jsx)(`span`, {
                      style: {
                        fontSize: 11,
                        color: `var(--color-text-muted)`
                      },
                      children: i(`适用于双轨 MIDI 文件`, `Works with two-track MIDI files`)
                    })]
                  }), (0, jsxRuntime.jsx)(SettingSwitch, {
                    active: n.showHandColors,
                    onClick: () => r({
                      showHandColors: !n.showHandColors
                    }),
                    "aria-label": i(`区分左右手`, `Differentiate hands`)
                  })]
                }), n.showHandColors && (0, jsxRuntime.jsx)(`div`, {
                  style: {
                    display: `flex`,
                    gap: 12,
                    alignItems: `center`
                  },
                  children: [{
                    color: e.leftHand,
                    label: i(`左手`, `Left hand`)
                  }, {
                    color: e.rightHand,
                    label: i(`右手`, `Right hand`)
                  }].map(({
                    color: e,
                    label: t
                  }) => (0, jsxRuntime.jsxs)(`div`, {
                    style: {
                      display: `flex`,
                      alignItems: `center`,
                      gap: 5
                    },
                    children: [(0, jsxRuntime.jsx)(`span`, {
                      style: {
                        width: 10,
                        height: 10,
                        borderRadius: `50%`,
                        background: e,
                        display: `inline-block`,
                        boxShadow: `0 1px 3px rgba(0,0,0,0.25)`
                      }
                    }), (0, jsxRuntime.jsx)(`span`, {
                      style: {
                        fontSize: 11,
                        color: `var(--color-text-muted)`
                      },
                      children: t
                    })]
                  }, t))
                })]
              });
            })()]
          }), (0, jsxRuntime.jsx)(SettingsHeading, {
            children: i(`键盘`, `Keyboard`)
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`琴键颜色`, `Key color`),
            title: i(`钢琴白键的视觉颜色`, `Visual colour of the piano keyboard's white keys`),
            children: (0, jsxRuntime.jsx)(`div`, {
              role: `radiogroup`,
              "aria-label": i(`钢琴琴键颜色`, `Piano key colour`),
              style: {
                display: `inline-flex`,
                gap: 6
              },
              children: [{
                value: `white`,
                label: i(`白色`, `White`),
                title: i(`明亮白色琴键`, `Bright white piano keys`),
                topColor: `#c4c4bc`,
                midColor: `#f5f5f0`,
                btmColor: `#e4e4dc`
              }, {
                value: `ivory`,
                label: i(`象牙色`, `Ivory`),
                title: i(`偏暖的象牙色琴键`, `Warm cream-toned piano keys`),
                topColor: `#cdc8a8`,
                midColor: `#fff8e7`,
                btmColor: `#e8e0c8`
              }].map(({
                value: e,
                label: t,
                title: i,
                topColor: a,
                midColor: o,
                btmColor: s
              }) => {
                let c = n.pianoTheme === e;
                return (0, jsxRuntime.jsxs)(`button`, {
                  role: `radio`,
                  "aria-checked": c,
                  onClick: () => r({
                    pianoTheme: e
                  }),
                  title: i,
                  style: {
                    display: `flex`,
                    flexDirection: `column`,
                    alignItems: `center`,
                    gap: 5,
                    padding: `6px 10px 5px`,
                    borderRadius: 8,
                    border: c ? `2px solid var(--color-accent)` : `2px solid var(--color-border)`,
                    background: c ? `var(--color-accent-subtle)` : `var(--color-surface-3)`,
                    cursor: `pointer`,
                    transition: `border-color 0.15s, background 0.15s`,
                    fontFamily: `inherit`
                  },
                  children: [(0, jsxRuntime.jsx)(`div`, {
                    style: {
                      width: 20,
                      height: 34,
                      borderRadius: `0 0 3px 3px`,
                      background: `linear-gradient(to bottom, ${a} 0%, ${o} 8%, ${o} 88%, ${s} 100%)`,
                      border: `1px solid rgba(0,0,0,0.18)`,
                      boxShadow: `0 2px 4px rgba(0,0,0,0.18)`
                    }
                  }), (0, jsxRuntime.jsx)(`span`, {
                    style: {
                      fontSize: 11,
                      fontWeight: c ? 700 : 400,
                      color: c ? `var(--color-accent-text)` : `var(--color-text-muted)`,
                      lineHeight: 1
                    },
                    children: t
                  })]
                }, e);
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`音名显示`, `Labels`),
            title: i(`选择哪些琴键显示音名`, `Which keys on the piano keyboard display their note name`),
            sublabel: i(`显示在琴键上`, `on the keyboard`),
            stacked: true,
            children: (0, jsxRuntime.jsx)(SegmentedControl, {
              "aria-label": i(`键盘音名显示模式`, `Keyboard label mode`),
              options: KEY_LABEL_OPTIONS.map(e => ({
                ...e,
                label: n.language === `zh-CN` ? {
                  none: `无`,
                  c_only: `仅 C`,
                  white: `自然音`,
                  black: `升号音`,
                  all: `全部`
                }[e.value] : e.label,
                title: n.language === `zh-CN` ? {
                  none: `不显示音名`,
                  c_only: `仅为 C 音显示音名和八度`,
                  white: `为所有自然音显示音名`,
                  black: `为所有升/降音显示音名`,
                  all: `为所有琴键显示音名`
                }[e.value] : e.title
              })),
              value: n.noteLabelMode,
              onChange: e => r({
                noteLabelMode: e
              }),
              fullWidth: true
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`使用降号 ♭`, `Use flats ♭`),
            sublabel: i(`影响所有音名显示`, `affects all note labels`),
            title: i(`临时记号优先显示为降号（D♭）而不是升号（C♯）`, `Show accidentals as flats (D♭) instead of sharps (C♯)`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.useFlats,
              onClick: () => r({
                useFlats: !n.useFlats
              })
            })
          }), (0, jsxRuntime.jsx)(SettingsHeading, {
            children: i(`下落音符`, `Falling notes`)
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`音名显示`, `Labels`),
            title: i(`选择哪些下落音符显示音名`, `Which falling note bars display their pitch name`),
            sublabel: i(`显示在音符条上`, `on note bars`),
            stacked: true,
            children: (0, jsxRuntime.jsx)(SegmentedControl, {
              "aria-label": i(`下落音符音名显示模式`, `Falling note bar label mode`),
              options: KEY_LABEL_OPTIONS.map(e => ({
                ...e,
                label: n.language === `zh-CN` ? {
                  none: `无`,
                  c_only: `仅 C`,
                  white: `自然音`,
                  black: `升号音`,
                  all: `全部`
                }[e.value] : e.label,
                title: n.language === `zh-CN` ? {
                  none: `不显示音名`,
                  c_only: `仅为 C 音显示音名和八度`,
                  white: `为所有自然音显示音名`,
                  black: `为所有升/降音显示音名`,
                  all: `为所有琴键显示音名`
                }[e.value] : e.title
              })),
              value: n.fallingNotesLabelMode,
              onChange: e => r({
                fallingNotesLabelMode: e
              }),
              fullWidth: true
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`音符筛选`, `Note filter`),
            sublabel: i(`控制画布中出现的音符`, `which notes appear in canvas`),
            title: i(`仅显示指定类型的下落音符`, `Show only a subset of notes in the falling notes view`),
            stacked: true,
            children: (0, jsxRuntime.jsx)(SegmentedControl, {
              "aria-label": i(`音符筛选`, `Note filter`),
              options: NOTE_FILTER_OPTIONS.map(e => ({
                ...e,
                label: n.language === `zh-CN` ? {
                  all: `全部`,
                  white: `自然音`,
                  black: `升号音`,
                  c_only: `仅 C`
                }[e.value] : e.label,
                title: n.language === `zh-CN` ? {
                  all: `显示全部音符`,
                  white: `仅显示自然音（白键）`,
                  black: `仅显示升/降音（黑键）`,
                  c_only: `仅显示 C 音`
                }[e.value] : e.title
              })),
              value: n.noteFilter,
              onChange: e => r({
                noteFilter: e
              }),
              fullWidth: true
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`八度分隔线`, `Octave grid`),
            sublabel: i(`显示八度之间的分隔线`, `separator lines between octaves`),
            title: i(`在下落音符视图中绘制淡化的八度分隔线`, `Draw subtle separator lines between octaves in the falling notes view`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showGrid,
              onClick: () => r({
                showGrid: !n.showGrid
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`最小音符高度`, `Min note height`),
            sublabel: i(`避免短促音符太小而看不清`, `prevents staccato notes from disappearing`),
            title: i(`音符条的最小像素高度，避免短促音在任何速度下变得不可见`, `Minimum pixel height for note bars - keeps short staccato notes visible at any tempo`),
            stacked: true,
            children: (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center gap-1.5`,
              children: [(0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`
                },
                children: `4`
              }), (0, jsxRuntime.jsx)(`input`, {
                type: `range`,
                min: 4,
                max: 24,
                step: 1,
                value: n.minNoteHeight,
                onChange: e => r({
                  minNoteHeight: Number(e.target.value)
                }),
                "aria-label": i(`最小音符高度（像素）`, `Minimum note height in pixels`),
                "aria-valuetext": `${n.minNoteHeight}px`,
                className: `flex-1`,
                style: a(n.minNoteHeight, 4, 24)
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`
                },
                children: `24`
              }), (0, jsxRuntime.jsxs)(`span`, {
                className: `text-xs tabular-nums`,
                style: {
                  color: `var(--color-text)`,
                  marginLeft: 2,
                  minWidth: 36,
                  textAlign: `right`
                },
                children: [n.minNoteHeight, `px`]
              })]
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`音符圆角`, `Note roundness`),
            sublabel: i(`调整音符条圆角`, `corner radius of note bars`),
            title: i(`调整下落音符条圆角，0 为直角，12 为最大圆角`, `Border radius of falling note bars - 0 is sharp corners, 12 is fully rounded`),
            stacked: true,
            children: (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center gap-1.5`,
              children: [(0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`
                },
                children: `0`
              }), (0, jsxRuntime.jsx)(`input`, {
                type: `range`,
                min: 0,
                max: 12,
                step: 1,
                value: n.noteCornerRadius,
                onChange: e => r({
                  noteCornerRadius: Number(e.target.value)
                }),
                "aria-label": i(`音符圆角`, `Note corner radius`),
                "aria-valuetext": `${n.noteCornerRadius}`,
                className: `flex-1`,
                style: a(n.noteCornerRadius, 0, 12)
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`
                },
                children: `12`
              }), (0, jsxRuntime.jsxs)(`span`, {
                className: `text-xs tabular-nums`,
                style: {
                  color: `var(--color-text)`,
                  marginLeft: 2,
                  minWidth: 36,
                  textAlign: `right`
                },
                children: [n.noteCornerRadius, `px`]
              })]
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`音符描边`, `Note outline`),
            sublabel: i(`为音符条显示彩色边框`, `colored border around note bars`),
            title: i(`使用左右手颜色为每个下落音符条绘制描边`, `Draw a colored border stroke around each falling note bar using its hand color`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showNoteOutline,
              onClick: () => r({
                showNoteOutline: !n.showNoteOutline
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`乐谱白色背景`, `White score background`),
            sublabel: i(`深色模式下仍保持白色谱面`, `keep sheet music on white in dark mode`),
            title: i(`即使在深色模式下也用白色背景显示乐谱`, `Render sheet music on a white background even in dark mode`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.sheetMusicWhiteBackground,
              onClick: () => r({
                sheetMusicWhiteBackground: !n.sheetMusicWhiteBackground
              })
            })
          })]
        }), (0, jsxRuntime.jsxs)(SettingsSection, {
          title: i(`显示叠加`, `Overlays`),
          children: [(0, jsxRuntime.jsx)(SettingRow, {
            label: i(`指法数字`, `Finger numbers`),
            sublabel: i(`在钢琴键盘上显示 1-5 指法提示`, `1-5 hints on the piano keyboard`),
            title: i(`在钢琴键盘上显示指法数字提示`, `Show finger number hints on the piano keyboard`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showFingering,
              onClick: () => r({
                showFingering: !n.showFingering
              })
            })
          }), n.showFingering && (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`同时显示在下落音符上`, `Also on falling notes`),
            sublabel: i(`在音符条上附加指法数字`, `appends digit to each note bar`),
            title: i(`同时在下落音符条上显示指法数字`, `Also overlay finger digits on the falling-note bars (off by default - visually busier)`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showFingeringOnNotes,
              onClick: () => r({
                showFingeringOnNotes: !n.showFingeringOnNotes
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`小节号`, `Measure numbers`),
            sublabel: i(`显示在下落音符左侧`, `on the left edge of falling notes`),
            title: i(`在下落音符视图左侧显示小节号`, `Show measure numbers along the left edge of the falling notes view`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showMeasureNums,
              onClick: () => r({
                showMeasureNums: !n.showMeasureNums
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`节拍线`, `Beat lines`),
            sublabel: i(`每拍显示水平辅助线`, `horizontal grid lines at each beat`),
            title: i(`在每拍和小节边界绘制淡化水平线，辅助节奏阅读`, `Draw faint horizontal lines at each beat and measure boundary to aid rhythm reading`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showBeatLines,
              onClick: () => r({
                showBeatLines: !n.showBeatLines
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`延音踏板`, `Sustain pedal`),
            sublabel: i(`用阴影区域显示 CC64 踏板`, `shaded bands show CC64 pedal regions`),
            title: i(`在下落音符视图中以半透明区域显示延音踏板 CC64 开关区间`, `Visualize sustain pedal (CC64) on/off periods as semi-transparent bands in the falling notes view`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showSustainPedal,
              onClick: () => r({
                showSustainPedal: !n.showSustainPedal
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`延音残影`, `Sustained note ghost`),
            sublabel: i(`踏板保持时在琴键处显示残影`, `ghost at keyboard while pedal is held`),
            title: i(`踏板仍保持时，为已经松键的音符保留淡化残影`, `Keep a faint ghost indicator for notes that have ended while the sustain pedal is still held`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.showSustainedNotes,
              onClick: () => r({
                showSustainedNotes: !n.showSustainedNotes
              })
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`落键效果`, `Impact effect`),
            sublabel: i(`音符到达琴键时的视觉效果`, `visual when notes hit the keyboard`),
            title: i(`选择音符到达判定线时的视觉效果`, `Choose the visual effect that plays when a note reaches the hit line`),
            stacked: true,
            children: (0, jsxRuntime.jsx)(SegmentedControl, {
              "aria-label": i(`落键效果样式`, `Impact effect style`),
              options: [{
                value: `off`,
                label: i(`关闭`, `Off`),
                title: i(`关闭落键视觉效果`, `No visual effect on note impact`)
              }, {
                value: `bloom`,
                label: i(`柔光`, `Bloom`),
                title: i(`柔和扩散光圈（默认）`, `Soft expanding ring (default)`)
              }, {
                value: `side`,
                label: i(`侧光`, `Side`),
                title: i(`音符触线时从两侧散出粒子`, `Particles burst left & right from note edges at impact`)
              }, {
                value: `trail`,
                label: i(`拖影`, `Trail`),
                title: i(`音符下落时从两侧产生轻微拖影`, `Sparkles drift off the bar sides as it falls`)
              }],
              value: n.impactStyle,
              onChange: e => r({
                impactStyle: e
              })
            })
          })]
        }), (0, jsxRuntime.jsxs)(SettingsSection, {
          title: i(`播放`, `Playback`),
          children: [(0, jsxRuntime.jsx)(SettingRow, {
            label: i(`音符视窗`, `Note window`),
            sublabel: i(`一次显示多少秒的后续音符`, `seconds of notes visible at once`),
            title: i(`设置下落音符一次显示多少秒内容。数值越小，音符越大、下落越慢。`, `How many seconds of music are visible in the falling notes view at once. Lower = notes appear larger and slower.`),
            stacked: true,
            children: (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center gap-1.5`,
              children: [(0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`,
                  whiteSpace: `nowrap`
                },
                children: `2s`
              }), (0, jsxRuntime.jsx)(`input`, {
                type: `range`,
                min: 2,
                max: 10,
                step: .5,
                value: n.viewportSeconds,
                onChange: e => r({
                  viewportSeconds: Number(e.target.value)
                }),
                "aria-label": i(`音符视窗（秒）`, `Note window - seconds of music visible`),
                "aria-valuetext": `${n.viewportSeconds} seconds`,
                className: `flex-1`,
                style: a(n.viewportSeconds, 2, 10)
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`,
                  whiteSpace: `nowrap`
                },
                children: `10s`
              }), (0, jsxRuntime.jsxs)(`span`, {
                className: `text-xs tabular-nums`,
                style: {
                  color: `var(--color-text)`,
                  marginLeft: 2,
                  minWidth: 36,
                  textAlign: `right`
                },
                children: [n.viewportSeconds, `s`]
              })]
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`移调`, `Transpose`),
            sublabel: i(`按半音整体移动音高`, `shift all notes by semitones`),
            title: i(`按半音整体移高或移低所有音符，同时影响播放与显示。`, `Shift all notes up or down by semitones. Affects both audio playback and display.`),
            stacked: true,
            children: (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center gap-1.5`,
              children: [(0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`,
                  whiteSpace: `nowrap`
                },
                children: `-6♭`
              }), (0, jsxRuntime.jsx)(`input`, {
                type: `range`,
                min: -6,
                max: 6,
                step: 1,
                value: n.transposeSemitones,
                onChange: e => r({
                  transposeSemitones: Number(e.target.value)
                }),
                "aria-label": i(`移调半音数`, `Transpose in semitones`),
                "aria-valuetext": transposeLabel(n.transposeSemitones, n.language),
                className: `flex-1`,
                style: a(n.transposeSemitones, -6, 6)
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`,
                  whiteSpace: `nowrap`
                },
                children: `+6♯`
              }), (0, jsxRuntime.jsx)(`span`, {
                className: `text-xs tabular-nums`,
                style: {
                  color: `var(--color-text)`,
                  marginLeft: 2,
                  minWidth: 52,
                  textAlign: `right`,
                  flexShrink: 0,
                  whiteSpace: `nowrap`
                },
                children: transposeLabel(n.transposeSemitones, n.language)
              })]
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`音频偏移`, `Audio offset`),
            sublabel: i(`补偿音频接口延迟`, `compensate for audio interface latency`),
            title: i(`按毫秒调整音频调度。正值让声音更早播放，用于补偿接口或蓝牙造成的延迟。`, `Shift audio scheduling by ±ms. Positive values play audio earlier - use this if you hear notes after the visual cue due to interface or Bluetooth latency.`),
            stacked: true,
            children: (0, jsxRuntime.jsxs)(`div`, {
              className: `flex items-center gap-1.5`,
              children: [(0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`,
                  whiteSpace: `nowrap`
                },
                children: `-200`
              }), (0, jsxRuntime.jsx)(`input`, {
                type: `range`,
                min: -200,
                max: 200,
                step: 5,
                value: n.renderOffset,
                onChange: e => r({
                  renderOffset: Number(e.target.value)
                }),
                "aria-label": i(`音频偏移（毫秒）`, `Audio offset in milliseconds`),
                "aria-valuetext": `${n.renderOffset}ms`,
                className: `flex-1`,
                style: a(n.renderOffset, -200, 200)
              }), (0, jsxRuntime.jsx)(`span`, {
                style: {
                  fontSize: 10,
                  color: `var(--color-text-muted)`,
                  whiteSpace: `nowrap`
                },
                children: `+200`
              }), (0, jsxRuntime.jsxs)(`span`, {
                className: `text-xs tabular-nums`,
                style: {
                  color: `var(--color-text)`,
                  marginLeft: 2,
                  minWidth: 40,
                  textAlign: `right`
                },
                children: [n.renderOffset > 0 ? `+${n.renderOffset}` : n.renderOffset, `ms`]
              })]
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`滚轮定位`, `Scroll to seek`),
            sublabel: i(`用鼠标滚轮移动播放位置`, `mouse wheel scrubs playback position`),
            title: i(`开启后，在下落音符画布滚动鼠标滚轮可前后移动播放位置`, `When enabled, scrolling the mouse wheel on the falling notes canvas moves the playback position forward or backward`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.scrollToSeek,
              onClick: () => r({
                scrollToSeek: !n.scrollToSeek
              })
            })
          }), (0, jsxRuntime.jsx)(PianoSoundControls, {}), (0, jsxRuntime.jsx)(`div`, {
            style: {
              padding: 12,
              fontSize: 12
            },
            children: i(`声音：连接数码钢琴时优先使用琴体发声；否则使用本地采样钢琴。`, `Audio: prefer the connected digital piano when available; otherwise use the local sampled piano.`)
          }), (0, jsxRuntime.jsx)(SettingsHeading, {
            children: i(`练习`, `Practice`)
          }), (0, jsxRuntime.jsx)(`p`, {
            style: {
              padding: 12,
              fontSize: 12
            },
            children: i(`在主界面选择练习手。下方可调整左右手音量。`, `Choose the practice hand on the main screen. Adjust hand volumes below.`)
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`左右手音量`, `Hand volumes`),
            sublabel: i(`分别调整左右手音量`, `balance each hand independently`),
            title: i(`分别调低左右手音量而无需完全静音，适合单手练习`, `Reduce a hand's volume without muting it - useful when drilling the other hand`),
            stacked: true,
            children: (0, jsxRuntime.jsx)(`div`, {
              style: {
                display: `flex`,
                flexDirection: `column`,
                gap: 6
              },
              children: [`left`, `right`].map(e => (0, jsxRuntime.jsxs)(`div`, {
                className: `flex items-center gap-2`,
                children: [(0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 11,
                    color: `var(--color-text-muted)`,
                    width: 28,
                    flexShrink: 0
                  },
                  children: e === `left` ? i(`左手`, `Left`) : i(`右手`, `Right`)
                }), (0, jsxRuntime.jsx)(`input`, {
                  type: `range`,
                  min: 0,
                  max: 1,
                  step: .05,
                  value: n.handVolume[e],
                  onChange: t => r({
                    handVolume: {
                      ...n.handVolume,
                      [e]: Number(t.target.value)
                    }
                  }),
                  "aria-label": e === `left` ? i(`左手音量`, `Left hand volume`) : i(`右手音量`, `Right hand volume`),
                  "aria-valuetext": `${Math.round(n.handVolume[e] * 100)}%`,
                  className: `flex-1`,
                  style: a(n.handVolume[e], 0, 1)
                }), (0, jsxRuntime.jsxs)(`span`, {
                  className: `text-xs tabular-nums`,
                  style: {
                    color: `var(--color-text)`,
                    width: 32,
                    textAlign: `right`,
                    flexShrink: 0
                  },
                  children: [Math.round(n.handVolume[e] * 100), `%`]
                })]
              }, e))
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`预备小节`, `Count-in bars`),
            sublabel: i(`播放开始前的预备小节`, `silent bars before playback starts`),
            title: i(`设置播放开始前的节拍器预备小节，便于提前准备。`, `Number of metronome bars to count before playback begins. Useful for getting your hands ready.`),
            stacked: true,
            children: (0, jsxRuntime.jsx)(SegmentedControl, {
              "aria-label": i(`预备小节`, `Count-in bars`),
              options: [{
                value: 0,
                label: i(`0 小节`, `0 bars`),
                title: i(`无预备，立即开始`, `No count-in - start immediately`)
              }, {
                value: 1,
                label: i(`1 小节`, `1 bar`),
                title: i(`1 小节预备`, `One bar count-in`)
              }, {
                value: 2,
                label: i(`2 小节`, `2 bars`),
                title: i(`2 小节预备`, `Two bars count-in`)
              }],
              value: n.countInBars,
              onChange: e => r({
                countInBars: e
              }),
              fullWidth: true
            })
          }), (0, jsxRuntime.jsx)(SettingRow, {
            label: i(`渐进提速`, `Speed trainer`),
            sublabel: i(`连续两轮稳定后提高速度`, `steps after two clean loop passes`),
            title: i(`连续两轮稳定后提高速度，从起始百分比逐步增加到目标百分比。`, `Increase tempo only after two consecutive clean loop passes, stepping from Start% up to End%`),
            children: (0, jsxRuntime.jsx)(SettingSwitch, {
              active: n.speedTrainer.enabled,
              onClick: () => r({
                speedTrainer: {
                  ...n.speedTrainer,
                  enabled: !n.speedTrainer.enabled
                }
              })
            })
          }), n.speedTrainer.enabled && (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
            children: [(0, jsxRuntime.jsx)(SettingRow, {
              label: i(`起始速度`, `Start speed`),
              sublabel: i(`开始训练时的速度百分比`, `Tempo % when trainer begins`),
              title: i(`渐进提速开始时的速度百分比`, `Tempo percentage to start from when the speed trainer resets`),
              stacked: true,
              children: (0, jsxRuntime.jsxs)(`div`, {
                className: `flex items-center gap-1.5`,
                children: [(0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 10,
                    color: `var(--color-text-muted)`,
                    whiteSpace: `nowrap`
                  },
                  children: `25%`
                }), (0, jsxRuntime.jsx)(`input`, {
                  type: `range`,
                  min: 25,
                  max: 100,
                  step: 5,
                  value: n.speedTrainer.startPct,
                  onChange: e => r({
                    speedTrainer: {
                      ...n.speedTrainer,
                      startPct: Number(e.target.value)
                    }
                  }),
                  "aria-label": i(`渐进提速起始百分比`, `Speed trainer start percentage`),
                  "aria-valuetext": `${n.speedTrainer.startPct}%`,
                  className: `flex-1`,
                  style: a(n.speedTrainer.startPct, 25, 100)
                }), (0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 10,
                    color: `var(--color-text-muted)`,
                    whiteSpace: `nowrap`
                  },
                  children: `100%`
                }), (0, jsxRuntime.jsxs)(`span`, {
                  className: `text-xs tabular-nums`,
                  style: {
                    color: `var(--color-text)`,
                    marginLeft: 2,
                    minWidth: 36,
                    textAlign: `right`
                  },
                  children: [n.speedTrainer.startPct, `%`]
                })]
              })
            }), (0, jsxRuntime.jsx)(SettingRow, {
              label: i(`目标速度`, `End speed`),
              sublabel: i(`最终达到的最高速度百分比`, `Maximum tempo % to reach`),
              title: i(`渐进提速最终达到的最高速度百分比，100% 为原速`, `Maximum tempo percentage the speed trainer will reach (100 = full speed)`),
              stacked: true,
              children: (0, jsxRuntime.jsxs)(`div`, {
                className: `flex items-center gap-1.5`,
                children: [(0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 10,
                    color: `var(--color-text-muted)`,
                    whiteSpace: `nowrap`
                  },
                  children: `50%`
                }), (0, jsxRuntime.jsx)(`input`, {
                  type: `range`,
                  min: 50,
                  max: 200,
                  step: 5,
                  value: n.speedTrainer.endPct,
                  onChange: e => r({
                    speedTrainer: {
                      ...n.speedTrainer,
                      endPct: Number(e.target.value)
                    }
                  }),
                  "aria-label": i(`渐进提速目标百分比`, `Speed trainer end percentage`),
                  "aria-valuetext": `${n.speedTrainer.endPct}%`,
                  className: `flex-1`,
                  style: a(n.speedTrainer.endPct, 50, 200)
                }), (0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 10,
                    color: `var(--color-text-muted)`,
                    whiteSpace: `nowrap`
                  },
                  children: `200%`
                }), (0, jsxRuntime.jsxs)(`span`, {
                  className: `text-xs tabular-nums`,
                  style: {
                    color: `var(--color-text)`,
                    marginLeft: 2,
                    minWidth: 36,
                    textAlign: `right`
                  },
                  children: [n.speedTrainer.endPct, `%`]
                })]
              })
            }), (0, jsxRuntime.jsx)(SettingRow, {
              label: i(`每轮增量`, `Step`),
              sublabel: i(`每轮循环增加的百分比`, `% added per loop pass`),
              title: i(`每完成一轮循环后增加多少速度百分比`, `How many percentage points to add to the tempo after each complete loop pass`),
              stacked: true,
              children: (0, jsxRuntime.jsxs)(`div`, {
                className: `flex items-center gap-1.5`,
                children: [(0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 10,
                    color: `var(--color-text-muted)`,
                    whiteSpace: `nowrap`
                  },
                  children: `1%`
                }), (0, jsxRuntime.jsx)(`input`, {
                  type: `range`,
                  min: 1,
                  max: 20,
                  step: 1,
                  value: n.speedTrainer.stepPct,
                  onChange: e => r({
                    speedTrainer: {
                      ...n.speedTrainer,
                      stepPct: Number(e.target.value)
                    }
                  }),
                  "aria-label": i(`渐进提速每轮增量`, `Speed trainer step percentage`),
                  "aria-valuetext": `${n.speedTrainer.stepPct}%`,
                  className: `flex-1`,
                  style: a(n.speedTrainer.stepPct, 1, 20)
                }), (0, jsxRuntime.jsx)(`span`, {
                  style: {
                    fontSize: 10,
                    color: `var(--color-text-muted)`,
                    whiteSpace: `nowrap`
                  },
                  children: `20%`
                }), (0, jsxRuntime.jsxs)(`span`, {
                  className: `text-xs tabular-nums`,
                  style: {
                    color: `var(--color-text)`,
                    marginLeft: 2,
                    minWidth: 36,
                    textAlign: `right`
                  },
                  children: [n.speedTrainer.stepPct, `%`]
                })]
              })
            })]
          })]
        }), (0, jsxRuntime.jsx)(ResetSettingsButton, {})]
      })]
    })]
  });
}
function DevicePanel() {
  let {
      tr: e
    } = useI18n(),
    [t, n] = (0, React.useState)([]),
    [r, i] = (0, React.useState)(`idle`),
    [a, o] = (0, React.useState)(null),
    [s, c] = (0, React.useState)(false),
    [l, u] = (0, React.useState)(0),
    d = (0, React.useRef)(null),
    f = (0, React.useRef)(null),
    {
      midiDeviceName: p,
      setMidiDevice: m
    } = useAppStore();
  (0, React.useEffect)(() => {
    let e = false;
    i(`idle`);
    let t = () => n(WebMidi.inputs.map(e => e.name)),
      r = () => {
        t();
        let e = useAppStore.getState().midiDeviceName;
        e && !WebMidi.inputs.some(t => t.name === e) && (syncEngine.disconnectMidi(), syncEngine.audio.midiOutputName = null, m(null));
      };
    return WebMidi.enable({
      sysex: false
    }).then(() => {
      e || (i(`enabled`), o(null), t(), WebMidi.addListener(`connected`, t), WebMidi.addListener(`disconnected`, r));
    }).catch(t => {
      e || (o(t instanceof Error ? t.message : String(t)), i(`error`));
    }), () => {
      e = true, WebMidi.removeListener(`connected`, t), WebMidi.removeListener(`disconnected`, r);
    };
  }, [l]), (0, React.useEffect)(() => {
    if (!s) return;
    let e = e => {
      !d.current?.contains(e.target) && !f.current?.contains(e.target) && c(false);
    };
    return document.addEventListener(`mousedown`, e), () => document.removeEventListener(`mousedown`, e);
  }, [s]);
  let h = e => {
      if (p) try {
        WebMidi.getInputByName(p)?.removeListener();
      } catch {}
      let t = WebMidi.getInputByName(e);
      t && (t.removeListener(), t.addListener(`noteon`, e => syncEngine.onMidiInput(e.note.number, e.rawValue ?? 64, e.message.channel ?? 1, e.timestamp)), t.addListener(`noteoff`, e => syncEngine.onMidiInputOff(e.note.number, e.message.channel ?? 1, e.timestamp)), t.addListener(`controlchange`, e => {
        e.controller.number === 64 && syncEngine.onMidiPedal(e.rawValue ?? 0, e.message.channel ?? 1, e.timestamp);
      }), syncEngine.audio.midiOutputName = WebMidi.outputs.find(t => t.name === e)?.name ?? null, m(e), c(false));
    },
    g = () => {
      if (syncEngine.disconnectMidi(), syncEngine.audio.midiOutputName = null, p) try {
        WebMidi.getInputByName(p)?.removeListener();
      } catch {}
      m(null), c(false);
    };
  if (r === `error`) return (0, jsxRuntime.jsx)(`button`, {
    type: `button`,
    onClick: () => u(e => e + 1),
    className: `text-xs px-2 py-1 rounded shrink-0`,
    title: `${a ?? e(`MIDI 错误`, `MIDI error`)} · ${e(`点击重试`, `Click to retry`)}`,
    style: {
      color: `var(--color-warning)`,
      background: `var(--color-warning-subtle)`,
      border: `1px solid var(--color-warning-border)`,
      cursor: `pointer`
    },
    children: `⚠ MIDI`
  });
  if (r === `idle`) return (0, jsxRuntime.jsx)(`span`, {
    className: `text-xs`,
    children: e(`正在连接 MIDI…`, `Connecting MIDI…`)
  });
  let _ = !!p;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `relative shrink-0`,
    children: [(0, jsxRuntime.jsxs)(`button`, {
      ref: d,
      onClick: () => c(e => !e),
      title: _ ? `${e(`已连接`, `Connected`)}: ${p}` : e(`选择 MIDI 输入设备`, `Select MIDI input device`),
      className: `flex items-center gap-2 text-xs font-semibold transition-colors shrink-0`,
      style: {
        background: _ ? `rgba(34,197,94,0.08)` : `var(--color-warning-subtle)`,
        border: _ ? `1px solid rgba(34,197,94,0.5)` : `1px solid var(--color-warning-border)`,
        color: _ ? `#4ade80` : `var(--color-warning)`,
        cursor: `pointer`,
        maxWidth: 200,
        borderRadius: 999,
        fontSize: 12,
        padding: _ ? `4px 10px` : `5px 12px`
      },
      children: [_ ? (0, jsxRuntime.jsx)(`span`, {
        className: `w-1.5 h-1.5 rounded-full shrink-0`,
        style: {
          background: `#4ade80`,
          boxShadow: `0 0 6px #4ade80`
        }
      }) : (0, jsxRuntime.jsx)(`span`, {
        style: {
          fontSize: 11,
          lineHeight: 1,
          flexShrink: 0
        },
        children: `⚠`
      }), (0, jsxRuntime.jsx)(`span`, {
        className: `truncate`,
        style: {
          maxWidth: 130
        },
        children: _ ? p : e(`未连接 MIDI`, `No MIDI device`)
      }), (0, jsxRuntime.jsx)(`svg`, {
        width: `8`,
        height: `8`,
        viewBox: `0 0 24 24`,
        fill: `currentColor`,
        style: {
          opacity: .5,
          flexShrink: 0
        },
        children: (0, jsxRuntime.jsx)(`path`, {
          d: `M7 10l5 5 5-5z`
        })
      })]
    }), s && (0, jsxRuntime.jsxs)(`div`, {
      ref: f,
      style: {
        position: `absolute`,
        top: `calc(100% + 6px)`,
        right: 0,
        minWidth: 200,
        background: `var(--color-surface)`,
        border: `1px solid var(--color-border)`,
        borderRadius: 8,
        boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
        zIndex: 100,
        overflow: `hidden`
      },
      children: [(0, jsxRuntime.jsx)(`div`, {
        className: `px-3 py-2 text-xs font-semibold uppercase tracking-wide`,
        style: {
          color: `var(--color-text-muted)`,
          borderBottom: `1px solid var(--color-border)`
        },
        children: e(`MIDI 输入`, `MIDI Input`)
      }), t.length === 0 ? (0, jsxRuntime.jsx)(`div`, {
        className: `px-3 py-3 text-xs`,
        style: {
          color: `var(--color-text-muted)`
        },
        children: e(`未发现 MIDI 设备。`, `No MIDI devices found.`)
      }) : (0, jsxRuntime.jsx)(`ul`, {
        style: {
          listStyle: `none`,
          margin: 0,
          padding: `4px 0`
        },
        children: t.map(e => {
          let t = e === p;
          return (0, jsxRuntime.jsx)(`li`, {
            children: (0, jsxRuntime.jsxs)(`button`, {
              onClick: () => h(e),
              className: `w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2`,
              style: {
                background: t ? `rgba(99,102,241,0.12)` : `transparent`,
                color: t ? `var(--color-accent)` : `var(--color-text)`,
                border: `none`,
                cursor: `pointer`
              },
              children: [(0, jsxRuntime.jsx)(`span`, {
                className: `w-1.5 h-1.5 rounded-full shrink-0`,
                style: {
                  background: t ? `#4ade80` : `var(--color-border)`
                }
              }), (0, jsxRuntime.jsx)(`span`, {
                className: `truncate`,
                children: e
              }), t && (0, jsxRuntime.jsx)(`span`, {
                className: `ml-auto text-xs`,
                style: {
                  color: `#4ade80`
                },
                children: `✓`
              })]
            })
          }, e);
        })
      }), _ && (0, jsxRuntime.jsx)(`div`, {
        style: {
          borderTop: `1px solid var(--color-border)`,
          padding: `4px 0`
        },
        children: (0, jsxRuntime.jsx)(`button`, {
          onClick: g,
          className: `w-full text-left px-3 py-2 text-xs transition-colors`,
          style: {
            background: `transparent`,
            color: `#f87171`,
            border: `none`,
            cursor: `pointer`
          },
          children: e(`断开连接`, `Disconnect`)
        })
      })]
    })]
  });
}
function isYamahaOutput(e) {
  return /(?:p[- ]?series|p[- ]?22[35]|yamaha)/i.test(e.label);
}
function SongLibraryPanel({
  open: e,
  onClose: t
}) {
  let {
      tr: n
    } = useI18n(),
    [r, i] = (0, React.useState)([]),
    [a, o] = (0, React.useState)(false);
  (0, React.useEffect)(() => {
    e && a && listArchivedSongs().then(i);
  }, [e, a]);
  let {
      savedSongs: s,
      currentSongId: c,
      currentSavedSong: l,
      refreshSongLibrary: u,
      loadMusicXmlFile: d,
      loadMidiFile: f,
      openSavedSong: p,
      renameSavedSong: m,
      removeSavedSong: h,
      replaceCurrentSongScore: g,
      attachCurrentSongAudio: _,
      detachCurrentSongAudio: v,
      previewCurrentSongMix: y,
      setCurrentSongMix: b,
      restoreRecommendedMix: x,
      previewCurrentSongAudioOffset: S,
      setCurrentSongAudioOffset: C,
      setAudioOutputDevice: w,
      settings: T
    } = useAppStore(),
    [E, D] = (0, React.useState)([]),
    [O, k] = (0, React.useState)(null),
    [ee, A] = (0, React.useState)(``),
    [te, j] = (0, React.useState)(`0`),
    [M, ne] = (0, React.useState)(false),
    N = (0, React.useRef)(0),
    re = (0, React.useRef)(false),
    ie = (0, React.useRef)(null),
    ae = (0, React.useRef)(null),
    P = (0, React.useRef)(null),
    F = (0, React.useRef)(null);
  (0, React.useEffect)(() => {
    if (!e) return;
    u();
    let t = false,
      n = () => {
        backingEngine.enumerateOutputDevices().then(e => {
          t || D(e);
        }).catch(() => {
          t || D([]);
        });
      };
    return n(), navigator.mediaDevices?.addEventListener?.(`devicechange`, n), () => {
      t = true, navigator.mediaDevices?.removeEventListener?.(`devicechange`, n);
    };
  }, [e, u]), (0, React.useEffect)(() => {
    let e = l?.audioOffsetMs ?? 0;
    N.current = e, re.current = false, ne(false), j(String(e));
  }, [l?.id]), (0, React.useEffect)(() => {
    M || j(String(l?.audioOffsetMs ?? 0));
  }, [l?.audioOffsetMs, M]), (0, React.useEffect)(() => {
    if (!e) return;
    let n = e => {
      if (e.key !== `Escape`) return;
      let n = e.target;
      n instanceof HTMLInputElement || n instanceof HTMLSelectElement || n instanceof HTMLTextAreaElement || t();
    };
    return window.addEventListener(`keydown`, n), () => window.removeEventListener(`keydown`, n);
  }, [e, t]);
  let oe = (0, React.useMemo)(() => {
      let e = new Map();
      e.set(``, {
        deviceId: ``,
        label: n(`系统默认`, `System Default`)
      });
      for (let t of E) t.deviceId !== "default" && e.set(t.deviceId, t);
      return [...e.values()].sort((e, t) => Number(isYamahaOutput(t)) - Number(isYamahaOutput(e)));
    }, [E, n]),
    se = (0, React.useMemo)(() => oe.find(e => e.deviceId && isYamahaOutput(e)) ?? null, [oe]);
  if (!e) return null;
  let ce = l?.userMix,
    le = l?.recommendedMix,
    I = (e, t) => {
      let n = useAppStore.getState().currentSavedSong?.userMix;
      n && y({
        ...n,
        [e]: t
      });
    },
    ue = () => {
      let e = useAppStore.getState().currentSavedSong?.userMix;
      e && b(e);
    },
    de = () => {
      let e = useAppStore.getState().currentSavedSong;
      if (!e) return;
      let t = Number(te),
        n = Number.isFinite(t) ? Math.max(-2e3, Math.min(2e3, Math.round(t))) : e.audioOffsetMs;
      j(String(n)), C(n);
    };
  return (0, jsxRuntime.jsx)(`div`, {
    style: {
      position: `fixed`,
      inset: 0,
      zIndex: 220,
      background: `rgba(0,0,0,0.48)`,
      display: `flex`,
      alignItems: `center`,
      justifyContent: `center`,
      padding: 24
    },
    onMouseDown: e => {
      e.target === e.currentTarget && t();
    },
    children: (0, jsxRuntime.jsxs)(`div`, {
      role: `dialog`,
      "aria-modal": `true`,
      "aria-label": n(`本地曲目`, `Local Songs`),
      style: {
        width: `min(940px, 92vw)`,
        height: `min(760px, 86vh)`,
        maxHeight: `calc(100dvh - 48px)`,
        display: `grid`,
        gridTemplateRows: `minmax(0,1fr)`,
        gridTemplateColumns: `minmax(300px, 0.9fr) minmax(360px, 1.1fr)`,
        background: `var(--color-surface)`,
        border: `1px solid var(--color-border)`,
        borderRadius: 16,
        boxShadow: `0 24px 70px rgba(0,0,0,.48)`,
        overflow: `hidden`
      },
      children: [(0, jsxRuntime.jsxs)(`section`, {
        style: {
          borderRight: `1px solid var(--color-border)`,
          minHeight: 0,
          overflow: `auto`,
          overscrollBehavior: `contain`
        },
        children: [(0, jsxRuntime.jsx)(`div`, {
          style: {
            padding: `18px 18px 12px`,
            position: `sticky`,
            top: 0,
            background: `var(--color-surface)`,
            zIndex: 2
          },
          children: (0, jsxRuntime.jsxs)(`div`, {
            style: {
              display: `flex`,
              alignItems: `center`,
              justifyContent: `space-between`,
              gap: 12
            },
            children: [(0, jsxRuntime.jsxs)(`div`, {
              children: [(0, jsxRuntime.jsx)(`div`, {
                style: {
                  fontWeight: 760,
                  fontSize: 18
                },
                children: n(`本地曲目`, `Local Songs`)
              }), (0, jsxRuntime.jsx)(`div`, {
                style: {
                  fontSize: 12,
                  color: `var(--color-text-muted)`,
                  marginTop: 3
                },
                children: n(`导入一次，以后直接继续练`, `Import once, continue later`)
              })]
            }), (0, jsxRuntime.jsxs)(`div`, {
              style: {
                display: `flex`,
                gap: 6
              },
              children: [(0, jsxRuntime.jsx)(`button`, {
                className: `t-btn`,
                onClick: () => ie.current?.click(),
                children: n(`导入新曲`, `Import Song`)
              }), (0, jsxRuntime.jsx)(`button`, {
                className: `t-btn`,
                onClick: t,
                "aria-label": n(`关闭`, `Close`),
                children: `×`
              })]
            }), (0, jsxRuntime.jsx)(`input`, {
              ref: ie,
              hidden: true,
              type: `file`,
              accept: IMPORT_ACCEPT,
              onChange: e => {
                let t = e.target.files?.[0];
                t && (importKind(t.name) === `midi` ? f(t) : d(t)), e.currentTarget.value = ``;
              }
            })]
          })
        }), (0, jsxRuntime.jsxs)(`div`, {
          style: {
            padding: `4px 12px 16px`
          },
          children: [(0, jsxRuntime.jsxs)(`label`, {
            style: {
              fontSize: 12
            },
            children: [(0, jsxRuntime.jsx)(`input`, {
              type: `checkbox`,
              checked: a,
              onChange: e => o(e.target.checked)
            }), n(` 显示已归档及已删除曲目`, ` Show archived and deleted songs`)]
          }), s.length === 0 && (!a || !r.length) ? (0, jsxRuntime.jsx)(`div`, {
            style: {
              padding: `34px 18px`,
              textAlign: `center`,
              color: `var(--color-text-muted)`,
              fontSize: 13
            },
            children: n(`还没有保存的曲目。导入 MIDI / MusicXML / MXL / Quick 后会自动保存。`, `No saved songs yet. Imported MIDI / MusicXML / MXL / Quick scores are saved automatically.`)
          }) : [...s, ...(a ? r : [])].map(e => {
            let t = e.id === c;
            return (0, jsxRuntime.jsx)(`div`, {
              style: {
                padding: `10px 11px`,
                marginBottom: 6,
                borderRadius: 10,
                border: `1px solid ${t ? `var(--color-accent)` : `var(--color-border)`}`,
                background: t ? `var(--color-accent-subtle)` : `var(--color-surface-2)`
              },
              children: O === e.id ? (0, jsxRuntime.jsxs)(`div`, {
                style: {
                  display: `flex`,
                  gap: 6
                },
                children: [(0, jsxRuntime.jsx)(`input`, {
                  autoFocus: true,
                  value: ee,
                  onChange: e => A(e.target.value),
                  onKeyDown: t => {
                    t.key === `Enter` && (m(e.id, ee), k(null)), t.key === `Escape` && (t.preventDefault(), k(null));
                  },
                  style: {
                    flex: 1,
                    minWidth: 0
                  }
                }), (0, jsxRuntime.jsx)(`button`, {
                  className: `t-btn`,
                  onClick: () => {
                    m(e.id, ee), k(null);
                  },
                  children: n(`保存`, `Save`)
                })]
              }) : (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
                children: [(0, jsxRuntime.jsxs)(`button`, {
                  onClick: () => void p(e.id),
                  style: {
                    width: `100%`,
                    background: `transparent`,
                    border: 0,
                    color: `var(--color-text)`,
                    textAlign: `left`,
                    padding: 0,
                    cursor: `pointer`,
                    fontFamily: `inherit`
                  },
                  children: [(0, jsxRuntime.jsx)(`div`, {
                    style: {
                      fontSize: 14,
                      fontWeight: t ? 760 : 650,
                      whiteSpace: `nowrap`,
                      overflow: `hidden`,
                      textOverflow: `ellipsis`
                    },
                    children: n(e.title, e.title.replace(/ · 已删除$/, ` · Deleted`).replace(/ · 已归档$/, ` · Archived`))
                  }), (0, jsxRuntime.jsxs)(`div`, {
                    style: {
                      marginTop: 4,
                      display: `flex`,
                      gap: 7,
                      flexWrap: `wrap`,
                      fontSize: 11,
                      color: `var(--color-text-muted)`
                    },
                    children: [e.hasAccompaniment && (0, jsxRuntime.jsx)(`span`, {
                      children: n(`伴奏`, `Backing`)
                    }), e.hasReferencePiano && (0, jsxRuntime.jsx)(`span`, {
                      children: n(`参考钢琴`, `Reference Piano`)
                    }), (0, jsxRuntime.jsx)(`span`, {
                      children: new Date(e.lastOpenedAt).toLocaleDateString()
                    })]
                  })]
                }), (0, jsxRuntime.jsxs)(`div`, {
                  style: {
                    display: `flex`,
                    gap: 5,
                    marginTop: 8
                  },
                  children: [(0, jsxRuntime.jsx)(`button`, {
                    className: `t-btn`,
                    onClick: () => {
                      k(e.id), A(e.title);
                    },
                    children: n(`重命名`, `Rename`)
                  }), (0, jsxRuntime.jsx)(`button`, {
                    className: `t-btn`,
                    onClick: () => {
                      window.confirm(n(`从本地曲目库删除“${e.title}”？可在“已删除曲目”中恢复，磁盘上的原文件不受影响。`, `Remove “${e.title}” from the local library? The original file on disk will not be deleted.`)) && h(e.id).then(() => listArchivedSongs().then(i));
                    },
                    children: n(`删除`, `Remove`)
                  }), e.userDeletedAt && (0, jsxRuntime.jsx)(`button`, {
                    className: `t-btn`,
                    onClick: async () => {
                      await restoreLibrarySong(e.id);
                      await u();
                      i(await listArchivedSongs());
                    },
                    children: n(`恢复`, `Restore`)
                  })]
                })]
              })
            }, e.id);
          })]
        })]
      }), (0, jsxRuntime.jsx)(`section`, {
        style: {
          minHeight: 0,
          overflow: `auto`,
          overscrollBehavior: `contain`,
          padding: 20
        },
        children: l ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
          children: [(0, jsxRuntime.jsxs)(`div`, {
            style: {
              marginBottom: 18,
              display: `flex`,
              alignItems: `flex-start`,
              justifyContent: `space-between`,
              gap: 12
            },
            children: [(0, jsxRuntime.jsxs)(`div`, {
              style: {
                minWidth: 0
              },
              children: [(0, jsxRuntime.jsx)(`div`, {
                style: {
                  fontSize: 18,
                  fontWeight: 760,
                  whiteSpace: `nowrap`,
                  overflow: `hidden`,
                  textOverflow: `ellipsis`
                },
                children: l.title
              }), (0, jsxRuntime.jsx)(`div`, {
                style: {
                  color: `var(--color-text-muted)`,
                  fontSize: 12,
                  marginTop: 4
                },
                children: n(`乐谱、伴奏和同步设置会一起保存`, `Score, audio, and sync settings are saved together`)
              })]
            }), (0, jsxRuntime.jsx)(`button`, {
              className: `t-btn`,
              onClick: () => ae.current?.click(),
              children: n(`替换乐谱`, `Replace Score`)
            }), (0, jsxRuntime.jsx)(`input`, {
              ref: ae,
              hidden: true,
              type: `file`,
              accept: IMPORT_ACCEPT,
              onChange: e => {
                let t = e.target.files?.[0];
                t && g(t), e.currentTarget.value = ``;
              }
            })]
          }), (0, jsxRuntime.jsx)(LibrarySection, {
            children: n(`音轨`, `Tracks`)
          }), (0, jsxRuntime.jsx)(AudioAttachment, {
            label: n(`伴奏`, `Backing Track`),
            filename: l.accompanimentName,
            onChoose: () => P.current?.click(),
            onRemove: l.accompanimentAssetId ? () => void v(`accompaniment`) : void 0,
            chooseLabel: n(`选择音频`, `Choose audio`),
            removeLabel: n(`移除`, `Remove`)
          }), (0, jsxRuntime.jsx)(AudioAttachment, {
            label: n(`参考钢琴`, `Reference Piano`),
            filename: l.referencePianoName,
            onChoose: () => F.current?.click(),
            onRemove: l.referencePianoAssetId ? () => void v(`referencePiano`) : void 0,
            chooseLabel: n(`选择音频`, `Choose audio`),
            removeLabel: n(`移除`, `Remove`)
          }), (0, jsxRuntime.jsx)(`input`, {
            ref: P,
            hidden: true,
            type: `file`,
            accept: `audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg`,
            onChange: e => {
              let t = e.target.files?.[0];
              t && _(`accompaniment`, t), e.currentTarget.value = ``;
            }
          }), (0, jsxRuntime.jsx)(`input`, {
            ref: F,
            hidden: true,
            type: `file`,
            accept: `audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg`,
            onChange: e => {
              let t = e.target.files?.[0];
              t && _(`referencePiano`, t), e.currentTarget.value = ``;
            }
          }), (0, jsxRuntime.jsx)(LibrarySection, {
            children: n(`混音`, `Mix`)
          }), ce && (0, jsxRuntime.jsxs)(`div`, {
            style: {
              display: `grid`,
              gap: 13
            },
            children: [(0, jsxRuntime.jsx)(MixerControl, {
              label: n(`伴奏`, `Backing`),
              value: ce.accompaniment,
              recommended: le?.accompaniment,
              onChange: e => I(`accompaniment`, e),
              onCommit: ue
            }), (0, jsxRuntime.jsx)(MixerControl, {
              label: n(`参考钢琴`, `Reference Piano`),
              value: ce.referencePiano,
              recommended: le?.referencePiano,
              onChange: e => I(`referencePiano`, e),
              onCommit: ue
            }), (0, jsxRuntime.jsx)(MixerControl, {
              label: n(`节拍器`, `Metronome`),
              value: ce.metronome,
              recommended: le?.metronome,
              onChange: e => I(`metronome`, e),
              onCommit: ue
            }), (0, jsxRuntime.jsx)(`button`, {
              className: `t-btn`,
              onClick: () => void x(),
              style: {
                justifySelf: `start`
              },
              children: n(`恢复推荐混音`, `Restore Recommended Mix`)
            })]
          }), (0, jsxRuntime.jsx)(LibrarySection, {
            children: n(`同步`, `Sync`)
          }), (0, jsxRuntime.jsxs)(`div`, {
            style: {
              display: `grid`,
              gridTemplateColumns: `1fr auto`,
              gap: 10,
              alignItems: `center`
            },
            children: [(0, jsxRuntime.jsxs)(`div`, {
              children: [(0, jsxRuntime.jsx)(`div`, {
                style: {
                  fontSize: 13,
                  fontWeight: 620
                },
                children: n(`伴奏同步偏移`, `Backing Sync Offset`)
              }), (0, jsxRuntime.jsx)(`div`, {
                style: {
                  fontSize: 11,
                  color: `var(--color-text-muted)`,
                  marginTop: 2
                },
                children: n(`正值让音频相对乐谱更早`, `Positive values advance audio relative to the score`)
              })]
            }), (0, jsxRuntime.jsx)(`input`, {
              type: `number`,
              min: -2e3,
              max: 2e3,
              step: 10,
              value: te,
              onFocus: () => {
                N.current = useAppStore.getState().currentSavedSong?.audioOffsetMs ?? 0, re.current = false, ne(true);
              },
              onChange: e => {
                let t = e.target.value;
                j(t);
                let n = Number(t);
                t.trim() !== `` && Number.isFinite(n) && S(n);
              },
              onBlur: () => {
                if (re.current) {
                  re.current = false, ne(false);
                  return;
                }
                de(), ne(false);
              },
              onKeyDown: e => {
                if (e.key === `Enter` && e.currentTarget.blur(), e.key === `Escape`) {
                  e.preventDefault(), re.current = true;
                  let t = N.current;
                  j(String(t)), S(t), e.currentTarget.blur();
                }
              },
              style: {
                width: 96
              }
            })]
          }), (0, jsxRuntime.jsx)(LibrarySection, {
            children: n(`音频输出`, `Audio Output`)
          }), (0, jsxRuntime.jsxs)(`div`, {
            style: {
              display: `flex`,
              gap: 8
            },
            children: [(0, jsxRuntime.jsx)(`select`, {
              value: T.audioOutputDeviceId,
              onChange: e => void w(e.target.value),
              style: {
                flex: 1,
                minWidth: 0
              },
              children: oe.map(e => (0, jsxRuntime.jsxs)(`option`, {
                value: e.deviceId,
                children: [e.label, e.deviceId && isYamahaOutput(e) ? n(` · 推荐`, ` · Recommended`) : ``]
              }, e.deviceId || `system`))
            }), se && T.audioOutputDeviceId !== se.deviceId && (0, jsxRuntime.jsx)(`button`, {
              className: `t-btn`,
              onClick: () => void w(se.deviceId),
              title: n(`让伴奏从钢琴扬声器播放`, `Play backing audio through the piano speakers`),
              children: n(`使用 P-Series（推荐）`, `Use P-Series (Recommended)`)
            }), (0, jsxRuntime.jsx)(`button`, {
              className: `t-btn`,
              onClick: () => {
                backingEngine.requestOutputDevice().then(async e => {
                  if (!e) {
                    useAppStore.setState({
                      loadError: n(`当前 Chromium 不提供系统音频输出选择器，可直接使用左侧设备列表。`, `This Chromium build does not expose the system audio-output chooser; use the device list instead.`)
                    });
                    return;
                  }
                  D(t => [...t.filter(t => t.deviceId !== e.deviceId), e]), await w(e.deviceId);
                }).catch(e => {
                  useAppStore.setState({
                    loadError: e instanceof Error ? e.message : String(e)
                  });
                });
              },
              children: n(`选择设备…`, `Choose Device…`)
            })]
          }), (0, jsxRuntime.jsx)(`div`, {
            style: {
              fontSize: 11,
              color: `var(--color-text-muted)`,
              lineHeight: 1.5,
              marginTop: 6
            },
            children: n(`如果 macOS 暴露了 P-Series 音频输出，可在这里选择它，让伴奏从钢琴扬声器播放。`, `If macOS exposes P-Series as an audio output, select it here to play backing audio through the piano speakers.`)
          })]
        }) : (0, jsxRuntime.jsx)(`div`, {
          style: {
            height: `100%`,
            minHeight: 440,
            display: `grid`,
            placeItems: `center`,
            color: `var(--color-text-muted)`,
            textAlign: `center`
          },
          children: (0, jsxRuntime.jsxs)(`div`, {
            children: [(0, jsxRuntime.jsx)(`div`, {
              style: {
                fontSize: 16,
                fontWeight: 680,
                color: `var(--color-text)`
              },
              children: n(`选择一首曲目`, `Select a song`)
            }), (0, jsxRuntime.jsx)(`div`, {
              style: {
                fontSize: 12,
                marginTop: 6
              },
              children: n(`选择后可以绑定伴奏、参考钢琴和推荐混音。`, `Attach backing audio, a reference piano, and mix settings to the selected song.`)
            })]
          })
        })
      })]
    })
  });
}
function LibrarySection({
  children: e
}) {
  return (0, jsxRuntime.jsx)(`div`, {
    style: {
      marginTop: 20,
      marginBottom: 9,
      paddingBottom: 6,
      borderBottom: `1px solid var(--color-border)`,
      fontSize: 11,
      fontWeight: 760,
      textTransform: `uppercase`,
      letterSpacing: `.08em`,
      color: `var(--color-text-muted)`
    },
    children: e
  });
}
function AudioAttachment({
  label: e,
  filename: t,
  onChoose: n,
  onRemove: r,
  chooseLabel: i,
  removeLabel: a
}) {
  return (0, jsxRuntime.jsxs)(`div`, {
    style: {
      display: `grid`,
      gridTemplateColumns: `120px minmax(0,1fr) auto`,
      gap: 8,
      alignItems: `center`,
      marginBottom: 8
    },
    children: [(0, jsxRuntime.jsx)(`div`, {
      style: {
        fontSize: 13,
        fontWeight: 620
      },
      children: e
    }), (0, jsxRuntime.jsx)(`div`, {
      style: {
        minWidth: 0,
        fontSize: 12,
        color: `var(--color-text-muted)`,
        whiteSpace: `nowrap`,
        overflow: `hidden`,
        textOverflow: `ellipsis`
      },
      children: t ?? `—`
    }), (0, jsxRuntime.jsxs)(`div`, {
      style: {
        display: `flex`,
        gap: 5
      },
      children: [(0, jsxRuntime.jsx)(`button`, {
        className: `t-btn`,
        onClick: n,
        children: i
      }), r && (0, jsxRuntime.jsx)(`button`, {
        className: `t-btn`,
        onClick: r,
        children: a
      })]
    })]
  });
}
function MixerControl({
  label: e,
  value: t,
  recommended: n,
  onChange: r,
  onCommit: i
}) {
  let {
    tr: a
  } = useI18n();
  return (0, jsxRuntime.jsxs)(`div`, {
    style: {
      display: `grid`,
      gridTemplateColumns: `120px 1fr 52px`,
      gap: 10,
      alignItems: `center`
    },
    children: [(0, jsxRuntime.jsxs)(`div`, {
      style: {
        fontSize: 13
      },
      children: [e, n !== void 0 && (0, jsxRuntime.jsxs)(`span`, {
        style: {
          marginLeft: 6,
          fontSize: 10,
          color: `var(--color-text-muted)`
        },
        children: [Math.abs(t - n) < .005 ? `★ ` : ``, a(`推荐`, `Rec.`), ` `, Math.round(n * 100), `%`]
      })]
    }), (0, jsxRuntime.jsx)(`input`, {
      type: `range`,
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(t * 100),
      onChange: e => r(Number(e.target.value) / 100),
      onPointerUp: i,
      onKeyUp: i,
      onBlur: i
    }), (0, jsxRuntime.jsxs)(`div`, {
      style: {
        textAlign: `right`,
        fontSize: 12,
        fontVariantNumeric: `tabular-nums`
      },
      children: [Math.round(t * 100), `%`]
    })]
  });
}
function PracticeView() {
  let [e, t] = (0, React.useState)(() => {
      let e = localStorage.getItem(`piano-notation`);
      if (e === `both`) localStorage.setItem(`piano-notation`, `number`);
      return e === `staff` ? e : `number`;
    }),
    [n, r] = (0, React.useState)(false),
    [i, a] = (0, React.useState)(false),
    {
      tr: c
    } = useI18n(),
    {
      loadMusicXmlFile: l,
      loadMidiFile: u,
      practiceMode: d,
      settings: f,
      updateSettings: p,
      status: m,
      play: h,
      pause: g,
      seek: _,
      loadError: v,
      clearLoadError: y,
      document: b,
      isLoadingDocument: x,
      initializeLibrary: S
    } = useAppStore(),
    C = d !== `test`;
  (0, React.useEffect)(() => {
    let e = e => {
      let n = e.detail === `both` ? `number` : e.detail;
      if ([`staff`, `number`].includes(n)) {
        t(n);
        p({
          layoutMode: `sheet`
        });
        try {
          localStorage.setItem(`piano-notation`, n);
        } catch {}
      }
    };
    window.addEventListener(`piano-notation-change`, e);
    return () => window.removeEventListener(`piano-notation-change`, e);
  }, [p]), (0, React.useEffect)(() => {
    let e = () => {
      t(`staff`);
      p({
        layoutMode: `sheet`
      });
      try {
        localStorage.setItem(`piano-notation`, `staff`);
      } catch {}
    };
    window.addEventListener(`piano-plain-score`, e);
    return () => window.removeEventListener(`piano-plain-score`, e);
  }, [p]), (0, React.useEffect)(() => {
    C && t(`number`);
  }, [C]), (0, React.useEffect)(() => {
    S();
  }, [S]), (0, React.useEffect)(() => {
    syncEngine.audio.load().catch(() => {});
    let e = () => syncEngine.audio.load().catch(() => {});
    return document.addEventListener(`pointermove`, e, {
      once: true
    }), () => document.removeEventListener(`pointermove`, e);
  }, []), (0, React.useEffect)(() => {
    let e = false,
      t = () => {
        e || (e = true, syncEngine.wakeAudio());
      };
    return window.addEventListener(`pointerdown`, t), window.addEventListener(`keydown`, t), () => {
      window.removeEventListener(`pointerdown`, t), window.removeEventListener(`keydown`, t);
    };
  }, []), (0, React.useEffect)(() => {
    document.documentElement.lang = f.language === `zh-CN` ? `zh-CN` : `en`;
  }, [f.language]), (0, React.useEffect)(() => {
    document.documentElement.dataset.theme = f.theme;
  }, [f.theme]), (0, React.useEffect)(() => {
    let e = e => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || n || i || e.target.closest(`input,select,textarea,button,[contenteditable=true],[role=dialog]`)) return;
      let t = e.target.tagName;
      if (!(e.code !== `Space` || t === `INPUT` || t === `SELECT` || t === `TEXTAREA`)) if (e.preventDefault(), e.shiftKey) {
        let e = useAppStore.getState();
        g(), _(e.loopStart ?? 0), h();
      } else m === `playing` || m === `waiting` ? g() : h();
    };
    return window.addEventListener(`keydown`, e), () => window.removeEventListener(`keydown`, e);
  }, [m, h, g, _, n, i]), (0, React.useEffect)(() => {
    let e = e => {
      if (e.code !== `ArrowLeft` && e.code !== `ArrowRight` || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || n || i || e.target.closest(`input,select,textarea,button,[contenteditable=true],[role=dialog]`)) return;
      let t = e.target.tagName;
      if (t === `INPUT` || t === `SELECT` || t === `TEXTAREA`) return;
      e.preventDefault();
      let {
        document: r,
        currentSeconds: a
      } = useAppStore.getState();
      if (!r?.notes.length) return;
      let s = e.altKey ? measuresFor(r).map(e => e.startSeconds) : [...new Set(r.notes.map(e => e.startSeconds))].sort((e, t) => e - t);
      if (e.code === `ArrowRight`) {
        let e = s.find(e => e > a + .05);
        e !== void 0 && _(e);
      } else {
        let e = [...s].reverse().find(e => e < a - .05);
        e !== void 0 && _(e);
      }
    };
    return window.addEventListener(`keydown`, e), () => window.removeEventListener(`keydown`, e);
  }, [_, n, i]), (0, React.useEffect)(() => {
    let e = e => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || n || i || e.target.closest(`input,select,textarea,button,[contenteditable=true],[role=dialog]`)) return;
      let t = useAppStore.getState();
      if (t.document && (e.code === `KeyD` && (e.preventDefault(), t.setDemo(!t.demo)), e.code === `KeyL`)) if (e.preventDefault(), t.loopStart !== null) t.setLoopPoints(null, null);else {
        let [e, n] = quickLoop(t.document, t.currentSeconds, 1);
        t.setLoopPoints(e, n);
      }
    };
    return window.addEventListener(`keydown`, e), () => window.removeEventListener(`keydown`, e);
  }, [n, i]);
  let w = (0, React.useCallback)(e => {
      importKind(e.name) === `update` ? window.dispatchEvent(new CustomEvent(`piano-update-file`, {
        detail: e
      })) : importKind(e.name) === `midi` ? u(e) : importKind(e.name) === `score` ? l(e) : useAppStore.setState({
        loadError: c(`支持 MIDI / MusicXML / XML / MXL / Quick JSON；图片或 PDF 需先转换并校对。`, `Supports MIDI / MusicXML / XML / MXL / Quick JSON. Convert and review images or PDFs first.`)
      });
    }, [l, u, c]),
    T = (0, React.useCallback)(e => {
      e.preventDefault();
      let t = e.dataTransfer.files[0];
      t && w(t);
    }, [w]),
    {
      layoutMode: E
    } = f,
    D = e => p({
      layoutMode: e
    });
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex flex-col h-screen`,
    onDragOver: e => e.preventDefault(),
    onDrop: T,
    children: [(0, jsxRuntime.jsxs)(`header`, {
      className: `flex-shrink-0 flex items-center`,
      style: {
        position: `relative`,
        height: 44,
        background: `var(--color-surface)`,
        borderBottom: `1px solid var(--color-border)`,
        paddingLeft: 10,
        paddingRight: 10
      },
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center gap-2 shrink-0`,
        children: [(0, jsxRuntime.jsx)(`div`, {
          role: `img`,
          "aria-hidden": `true`,
          className: `flex items-center justify-center shrink-0 select-none`,
          style: {
            width: 32,
            height: 32,
            background: `linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)`,
            borderRadius: 8,
            boxShadow: `0 3px 10px rgba(147,51,234,0.45)`
          },
          children: (0, jsxRuntime.jsx)(PianoKeysIcon, {})
        }), (0, jsxRuntime.jsx)(`span`, {
          style: {
            fontSize: 15,
            whiteSpace: `nowrap`,
            letterSpacing: `-0.2px`,
            lineHeight: 1,
            fontWeight: 700,
            color: `var(--color-text)`
          },
          children: `Piano Practice`
        })]
      }), (0, jsxRuntime.jsx)(`div`, {
        className: `flex items-center`,
        style: {
          position: `absolute`,
          left: `50%`,
          transform: `translateX(-50%)`
        },
        children: (0, jsxRuntime.jsx)(`div`, {
          className: `flex items-center`,
          style: {
            padding: 3,
            background: `var(--color-surface-2)`,
            borderRadius: 999,
            border: `1px solid var(--color-border)`
          },
          children: [`piano`, `falling`, `sheet`, `all`].map(e => (0, jsxRuntime.jsx)(`button`, {
            onClick: () => D(e),
            title: e === `piano` ? c(`仅显示钢琴键盘`, `Show piano keyboard only`) : e === `falling` ? c(`仅显示下落音符`, `Show falling notes only`) : e === `sheet` ? c(`仅显示乐谱`, `Show sheet music only`) : c(`显示综合练习视图`, `Show all practice views`),
            "aria-label": e === `piano` ? c(`仅显示钢琴键盘`, `Show piano keyboard only`) : e === `falling` ? c(`仅显示下落音符`, `Show falling notes only`) : e === `sheet` ? c(`仅显示乐谱`, `Show sheet music only`) : c(`显示综合练习视图`, `Show all practice views`),
            className: `transition-all font-semibold`,
            style: {
              padding: `4px 12px`,
              fontSize: 12,
              borderRadius: 999,
              border: `none`,
              background: E === e ? `var(--color-accent)` : `transparent`,
              color: E === e ? `#ffffff` : `var(--color-text-muted)`,
              boxShadow: E === e ? `0 0 12px rgba(147,51,234,0.35)` : `none`,
              cursor: `pointer`
            },
            children: e === `piano` ? c(`钢琴`, `Piano`) : e === `falling` ? c(`下落音符`, `Falling Notes`) : e === `sheet` ? c(`乐谱`, `Sheet Music`) : c(`综合`, `All`)
          }, e))
        })
      }), (0, jsxRuntime.jsxs)(`div`, {
        className: `flex items-center gap-1.5`,
        style: {
          marginLeft: `auto`
        },
        children: [null, (0, jsxRuntime.jsxs)(`button`, {
          onClick: () => a(true),
          title: c(`本地曲目与伴奏`, `Local songs and backing tracks`),
          "aria-label": c(`打开本地曲目`, `Open local songs`),
          className: `flex items-center justify-center rounded transition-colors shrink-0`,
          style: {
            height: 30,
            padding: `0 9px`,
            gap: 5,
            background: `var(--color-surface-2)`,
            border: `1px solid var(--color-border)`,
            color: `var(--color-text-muted)`,
            fontSize: 11,
            fontWeight: 650,
            fontFamily: `inherit`,
            cursor: `pointer`
          },
          children: [(0, jsxRuntime.jsx)(`span`, {
            "aria-hidden": `true`,
            children: `♫`
          }), c(`曲目`, `Songs`)]
        }), (0, jsxRuntime.jsx)(DevicePanel, {}), (0, jsxRuntime.jsx)(`button`, {
          onClick: () => p({
            theme: f.theme === `dark` ? `light` : `dark`
          }),
          title: f.theme === `dark` ? c(`切换到浅色模式`, `Switch to light mode`) : c(`切换到深色模式`, `Switch to dark mode`),
          "aria-label": f.theme === `dark` ? c(`切换到浅色模式`, `Switch to light mode`) : c(`切换到深色模式`, `Switch to dark mode`),
          className: `flex items-center justify-center rounded transition-colors shrink-0`,
          style: {
            width: 30,
            height: 30,
            background: `var(--color-surface-2)`,
            border: `1px solid var(--color-border)`,
            color: `var(--color-text-muted)`
          },
          children: f.theme === `dark` ? (0, jsxRuntime.jsx)(SunIcon, {}) : (0, jsxRuntime.jsx)(MoonIcon, {})
        }), (0, jsxRuntime.jsx)(`button`, {
          onClick: () => r(true),
          title: c(`设置`, `Settings`),
          "aria-label": c(`打开设置`, `Open settings`),
          className: `flex items-center justify-center rounded transition-colors shrink-0`,
          style: {
            width: 30,
            height: 30,
            background: `var(--color-surface-2)`,
            border: `1px solid var(--color-border)`,
            color: `var(--color-text-muted)`
          },
          children: (0, jsxRuntime.jsx)(CloseIcon, {})
        })]
      })]
    }), (0, jsxRuntime.jsxs)(`div`, {
      style: {
        display: `flex`,
        alignItems: `center`,
        gap: 16,
        padding: `4px 12px`,
        background: `var(--color-surface)`,
        fontSize: 12
      },
      children: [(0, jsxRuntime.jsxs)(`label`, {
        children: [c(`谱面 `, `Notation `), (0, jsxRuntime.jsxs)(`select`, {
          "data-piano-notation": true,
          value: e,
          onChange: e => {
            let n = e.target.value;
            t(n), localStorage.setItem(`piano-notation`, n), (E === `piano` || E === `falling`) && D(`sheet`);
          },
          children: [(0, jsxRuntime.jsx)(`option`, {
            value: `staff`,
            children: c(`五线谱`, `Staff`)
          }), (0, jsxRuntime.jsx)(`option`, {
            value: `number`,
            children: c(`数字谱`, `Numbered`)
          })]
        })]
      }), (0, jsxRuntime.jsxs)(`label`, {
        children: [(0, jsxRuntime.jsx)(`input`, {
          type: `checkbox`,
          checked: E === `all` || E === `falling`,
          onChange: e => D(e.target.checked ? `all` : `sheet`)
        }), c(` 下落式`, ` Falling notes`)]
      }), (0, jsxRuntime.jsx)(DistributionPanel, {}), (0, jsxRuntime.jsx)(PianoQuickSoundControls, {})]
    }), (0, jsxRuntime.jsxs)(`main`, {
      className: `flex flex-1 overflow-hidden min-h-0 relative`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `flex flex-col flex-1 min-h-0 overflow-hidden`,
        style: {
          background: E === `all` ? `radial-gradient(ellipse at 50% calc(100% - 160px), rgba(147,51,234,0.07) 0%, transparent 65%), var(--color-notes-bg)` : void 0
        },
        children: [(0, jsxRuntime.jsx)(SectionPracticePanel, {}, `learning-controls`), E === `piano` && !C && (0, jsxRuntime.jsx)(PianoModeBackground, {}, `piano-bg`), (E === `piano` || E === `falling`) && C && (0, jsxRuntime.jsx)(NumberedView, {}, `learning-number`), E === `sheet` && (0, jsxRuntime.jsxs)(`div`, {
          className: `flex flex-col flex-1 min-h-0 overflow-hidden`,
          children: [e === `staff` && (0, jsxRuntime.jsx)(SheetMusicView, {}), e === `number` && (0, jsxRuntime.jsx)(NumberedView, {})]
        }, `score`), E === `all` && (0, jsxRuntime.jsxs)(`div`, {
          className: `flex flex-col min-h-0 overflow-hidden`,
          style: {
            flex: e === `number` ? `1 1 0` : `0 1 clamp(240px, 32vh, 300px)`,
            minHeight: 180
          },
          children: [e === `staff` && (0, jsxRuntime.jsx)(SheetMusicView, {}), e === `number` && (0, jsxRuntime.jsx)(NumberedView, {})]
        }, `sheet-band`), (E === `falling` || E === `all`) && (0, jsxRuntime.jsx)(`div`, {
          className: `flex flex-col min-h-0`,
          style: {
            flex: `1 1 0`,
            minHeight: 80,
            overflow: `hidden`
          },
          children: (0, jsxRuntime.jsx)(FallingNotesView, {})
        }, `falling`), (0, jsxRuntime.jsx)(PianoKeyboardView, {}, `kbd`)]
      }), C && (0, jsxRuntime.jsx)(LivePracticeOverlay, {})]
    }), !b && !x && (0, jsxRuntime.jsx)(EmptyScoreOverlay, {
      onImport: w
    }), v && (0, jsxRuntime.jsx)(ErrorToast, {
      message: v,
      onDismiss: y
    }), (0, jsxRuntime.jsx)(PracticeFeedback, {}), (0, jsxRuntime.jsx)(TransportControls, {}), (0, jsxRuntime.jsx)(StatusBar, {}), (0, jsxRuntime.jsx)(SettingsPanel, {
      open: n,
      onClose: () => r(false)
    }), null, (0, jsxRuntime.jsx)(SongLibraryPanel, {
      open: i,
      onClose: () => a(false)
    })]
  });
}
function EmptyScoreOverlay({
  onImport: e
}) {
  let t = (0, React.useRef)(null),
    {
      tr: n
    } = useI18n();
  return (0, jsxRuntime.jsxs)(`div`, {
    style: {
      position: `absolute`,
      inset: 0,
      zIndex: 10,
      display: `flex`,
      flexDirection: `column`,
      alignItems: `center`,
      justifyContent: `center`,
      gap: 20,
      textAlign: `center`,
      padding: 40,
      pointerEvents: `none`
    },
    children: [(0, jsxRuntime.jsx)(`div`, {
      style: {
        width: 72,
        height: 72,
        borderRadius: 18,
        background: `linear-gradient(135deg, rgba(147,51,234,0.25) 0%, rgba(147,51,234,0.10) 100%), var(--color-notes-bg)`,
        border: `1px solid rgba(147,51,234,0.25)`,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `center`,
        color: `var(--color-accent-text)`
      },
      children: (0, jsxRuntime.jsx)(SettingsIcon, {})
    }), (0, jsxRuntime.jsxs)(`div`, {
      style: {
        maxWidth: 300
      },
      children: [(0, jsxRuntime.jsx)(`div`, {
        style: {
          fontSize: 18,
          fontWeight: 700,
          color: `var(--color-text)`,
          marginBottom: 8
        },
        children: n(`尚未导入乐谱`, `No file loaded`)
      }), (0, jsxRuntime.jsx)(`div`, {
        style: {
          fontSize: 13,
          color: `var(--color-text-muted)`,
          lineHeight: 1.6
        },
        children: n(`导入 MIDI / MusicXML / MXL / Quick 开始练习。乐谱、长短音条和琴键会同步显示。`, `Import MIDI / MusicXML / MXL / Quick to start. Sheet music, duration bars and keys stay in sync.`)
      })]
    }), (0, jsxRuntime.jsxs)(`button`, {
      onClick: () => t.current?.click(),
      style: {
        pointerEvents: `all`,
        display: `flex`,
        alignItems: `center`,
        gap: 8,
        padding: `11px 28px`,
        background: `var(--color-accent)`,
        color: `#fff`,
        border: `none`,
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        cursor: `pointer`,
        boxShadow: `0 0 24px rgba(147,51,234,0.45)`,
        fontFamily: `inherit`,
        transition: `all 0.15s`
      },
      onMouseEnter: e => {
        e.currentTarget.style.transform = `translateY(-1px)`, e.currentTarget.style.boxShadow = `0 0 34px rgba(147,51,234,0.6)`;
      },
      onMouseLeave: e => {
        e.currentTarget.style.transform = ``, e.currentTarget.style.boxShadow = `0 0 24px rgba(147,51,234,0.45)`;
      },
      children: [(0, jsxRuntime.jsx)(UploadLargeIcon, {}), n(`导入乐谱`, `Import a file`)]
    }), (0, jsxRuntime.jsx)(`span`, {
      style: {
        fontSize: 11,
        color: `var(--color-text-muted)`,
        marginTop: -10
      },
      children: n(`也可以把文件拖到窗口任意位置`, `or drag & drop anywhere`)
    }), (0, jsxRuntime.jsx)(`input`, {
      ref: t,
      type: `file`,
      accept: IMPORT_ACCEPT,
      className: `hidden`,
      onChange: t => {
        let n = t.target.files?.[0];
        n && e(n), t.target.value = ``;
      }
    })]
  });
}
var UploadLargeIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `16`,
  height: `16`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z`
  })
});
var GRID_MIDI_MIN = 21;
var GRID_MIDI_MAX = 108;
function buildGridKeyIndices() {
  let e = e => [1, 3, 6, 8, 10].includes(e % 12),
    t = Array(109).fill(0),
    n = 0;
  for (let r = GRID_MIDI_MIN; r <= GRID_MIDI_MAX; r++) t[r] = n, e(r) || n++;
  return {
    idx: t,
    totalWhite: n
  };
}
var {
  idx: gridWhiteKeyIndex,
  totalWhite: gridWhiteCount
} = buildGridKeyIndices();
function drawPianoGrid(e) {
  let {
    width: t,
    height: n
  } = e;
  if (t === 0 || n === 0) return;
  let r = e.getContext(`2d`);
  if (!r) return;
  let i = e => [1, 3, 6, 8, 10].includes(e % 12),
    a = t / gridWhiteCount;
  r.clearRect(0, 0, t, n), r.fillStyle = `rgba(128,128,144,0.2)`;
  for (let e = GRID_MIDI_MIN; e <= GRID_MIDI_MAX; e++) if (e % 12 == 0 && !i(e)) {
    let t = gridWhiteKeyIndex[e] * a;
    r.fillRect(t, 0, 1, n);
  }
}
function PianoModeBackground() {
  let e = (0, React.useRef)(null),
    t = (0, React.useRef)(null),
    {
      settings: n
    } = useAppStore(),
    r = (0, React.useMemo)(() => () => {
      let t = e.current;
      t && drawPianoGrid(t);
    }, []);
  return (0, React.useEffect)(() => {
    let i = t.current,
      a = e.current;
    if (!i || !a) return;
    let o = new ResizeObserver(([e]) => {
      let {
        width: t,
        height: i
      } = e.contentRect;
      a.width = Math.round(t), a.height = Math.round(i), n.showGrid && r();
    });
    return o.observe(i), a.width = i.clientWidth, a.height = i.clientHeight, n.showGrid && r(), () => o.disconnect();
  }, [r]), (0, React.useEffect)(() => {
    let t = e.current;
    if (t) if (n.showGrid) r();else {
      let e = t.getContext(`2d`);
      e && e.clearRect(0, 0, t.width, t.height);
    }
  }, [n.showGrid, r]), (0, jsxRuntime.jsx)(`div`, {
    ref: t,
    className: `flex-1 relative`,
    style: {
      minHeight: 0,
      background: `radial-gradient(ellipse at 50% 100%, rgba(147,51,234,0.07) 0%, transparent 65%), var(--color-notes-bg)`,
      borderTop: `1px solid var(--color-notes-border)`
    },
    children: (0, jsxRuntime.jsx)(`canvas`, {
      ref: e,
      style: {
        display: `block`,
        width: `100%`,
        height: `100%`
      }
    })
  });
}
function StatusBar() {
  let {
      document: e,
      currentSeconds: t,
      tempoMultiplier: n,
      status: r
    } = useAppStore(),
    {
      tr: i
    } = useI18n(),
    [a, o] = (0, React.useState)(``),
    s = (0, React.useRef)(null);
  (0, React.useEffect)(() => {
    let e = ({
      midi: e
    }) => {
      o(midiToPitch(e)), s.current && clearTimeout(s.current), s.current = setTimeout(() => o(``), 2e3);
    };
    return bus.on(`input:note:on`, e), () => {
      bus.off(`input:note:on`, e), s.current && clearTimeout(s.current);
    };
  }, []);
  let l = e ? effectiveBpm(e, t, n) : null,
    u = e => `${Math.floor(e / 60)}:${Math.floor(e % 60).toString().padStart(2, `0`)}`,
    d = e?.keySignature ? keySignatureToLabel(e.keySignature) : null;
  return (0, jsxRuntime.jsxs)(`div`, {
    className: `flex items-center gap-3 border-t flex-shrink-0 min-w-0`,
    style: {
      height: 26,
      background: `var(--color-surface)`,
      borderColor: `var(--color-border-subtle)`,
      fontSize: 11,
      color: `var(--color-text-muted)`,
      fontVariantNumeric: `tabular-nums`,
      paddingLeft: 10,
      paddingRight: 12
    },
    children: [e ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
      children: [(r === `playing` || r === `paused`) && (0, jsxRuntime.jsx)(`span`, {
        style: {
          color: `var(--color-accent)`,
          fontWeight: 600,
          flexShrink: 0
        },
        children: r === `paused` ? i(`已暂停`, `Paused`) : i(`播放中`, `Playing`)
      }), (0, jsxRuntime.jsx)(`span`, {
        className: `truncate`,
        style: {
          minWidth: 0
        },
        children: e.title
      }), d && (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [(0, jsxRuntime.jsx)(StatusSeparator, {}), (0, jsxRuntime.jsx)(`span`, {
          className: `shrink-0`,
          children: d
        })]
      }), l !== null && (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [(0, jsxRuntime.jsx)(StatusSeparator, {}), (0, jsxRuntime.jsxs)(`span`, {
          className: `shrink-0`,
          children: [l, ` BPM`]
        })]
      }), a && (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [(0, jsxRuntime.jsx)(StatusSeparator, {}), (0, jsxRuntime.jsx)(`span`, {
          className: `shrink-0`,
          style: {
            color: `var(--color-accent)`
          },
          children: a
        })]
      })]
    }) : (0, jsxRuntime.jsx)(`span`, {
      children: i(`尚未导入乐谱 · 可拖入文件或点击 ↑ 导入`, `No file loaded · drag & drop or click ↑ Import`)
    }), (0, jsxRuntime.jsx)(`div`, {
      className: `flex-1 min-w-0`
    }), e && (0, jsxRuntime.jsxs)(`span`, {
      className: `shrink-0`,
      children: [u(t), ` / `, u(e.totalDuration)]
    })]
  });
}
var StatusSeparator = () => (0, jsxRuntime.jsx)(`span`, {
  style: {
    color: `var(--color-text-dim)`
  },
  children: `·`
});
function ErrorToast({
  message: e,
  onDismiss: t
}) {
  let {
    tr: n
  } = useI18n();
  return (0, React.useEffect)(() => {
    let n = e.includes(`
`) ? 3e4 : 12e3,
      r = setTimeout(t, n);
    return () => clearTimeout(r);
  }, [e, t]), (0, jsxRuntime.jsxs)(`div`, {
    role: `alert`,
    style: {
      position: `fixed`,
      bottom: 68,
      left: `50%`,
      transform: `translateX(-50%)`,
      zIndex: 2e3,
      maxWidth: 520,
      width: `calc(100% - 32px)`,
      background: `var(--color-surface)`,
      border: `1px solid rgba(239,68,68,0.5)`,
      borderRadius: 10,
      boxShadow: `0 8px 32px rgba(0,0,0,0.45)`,
      padding: `10px 14px`,
      display: `flex`,
      alignItems: `flex-start`,
      gap: 10,
      fontSize: 12,
      color: `var(--color-text)`,
      lineHeight: 1.5
    },
    children: [(0, jsxRuntime.jsx)(`span`, {
      style: {
        color: `#f87171`,
        fontSize: 16,
        lineHeight: 1.2,
        flexShrink: 0
      },
      children: `⚠`
    }), (0, jsxRuntime.jsx)(`span`, {
      style: {
        flex: 1,
        wordBreak: `break-word`
      },
      children: e.split(`
`).map((t, n) => (0, jsxRuntime.jsxs)(`span`, {
        children: [t, n < e.split(`
`).length - 1 && (0, jsxRuntime.jsx)(`br`, {})]
      }, n))
    }), (0, jsxRuntime.jsx)(`button`, {
      onClick: t,
      "aria-label": n(`关闭错误提示`, `Dismiss error`),
      style: {
        background: `none`,
        border: `none`,
        cursor: `pointer`,
        color: `var(--color-text-muted)`,
        fontSize: 16,
        lineHeight: 1,
        flexShrink: 0,
        padding: `0 2px`
      },
      children: `✕`
    })]
  });
}
var SettingsIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `30`,
  height: `30`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  "aria-hidden": `true`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z`
  })
});
var PianoKeysIcon = () => (0, jsxRuntime.jsxs)(`svg`, {
  width: `18`,
  height: `14`,
  viewBox: `0 0 17 14`,
  fill: `none`,
  "aria-hidden": `true`,
  children: [(0, jsxRuntime.jsx)(`rect`, {
    x: `0`,
    y: `0`,
    width: `3`,
    height: `13`,
    rx: `0.5`,
    fill: `white`,
    fillOpacity: `0.95`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `3.5`,
    y: `0`,
    width: `3`,
    height: `13`,
    rx: `0.5`,
    fill: `white`,
    fillOpacity: `0.95`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `7`,
    y: `0`,
    width: `3`,
    height: `13`,
    rx: `0.5`,
    fill: `white`,
    fillOpacity: `0.95`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `10.5`,
    y: `0`,
    width: `3`,
    height: `13`,
    rx: `0.5`,
    fill: `white`,
    fillOpacity: `0.95`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `14`,
    y: `0`,
    width: `3`,
    height: `13`,
    rx: `0.5`,
    fill: `white`,
    fillOpacity: `0.95`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `2`,
    y: `0`,
    width: `2.5`,
    height: `8.5`,
    rx: `0.5`,
    fill: `rgba(0,0,0,0.5)`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `5.5`,
    y: `0`,
    width: `2.5`,
    height: `8.5`,
    rx: `0.5`,
    fill: `rgba(0,0,0,0.5)`
  }), (0, jsxRuntime.jsx)(`rect`, {
    x: `12.5`,
    y: `0`,
    width: `2.5`,
    height: `8.5`,
    rx: `0.5`,
    fill: `rgba(0,0,0,0.5)`
  })]
});
var SunIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `14`,
  height: `14`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2v-2H2v2zm18 0h2v-2h-2v2zM11 2v2h2V2h-2zm0 18v2h2v-2h-2zM5.64 6.35 4.22 4.93a1 1 0 0 0-1.41 1.41l1.41 1.42 1.42-1.41zM18.36 17.65l1.42 1.41a1 1 0 0 0 1.41-1.41l-1.41-1.42-1.42 1.42zM5.64 17.66l-1.42 1.41a1 1 0 0 1-1.41-1.41l1.41-1.42 1.42 1.42zM19.78 4.93l-1.42 1.42-1.41-1.42 1.42-1.41a1 1 0 0 1 1.41 1.41z`
  })
});
var MoonIcon = () => (0, jsxRuntime.jsx)(`svg`, {
  width: `14`,
  height: `14`,
  viewBox: `0 0 24 24`,
  fill: `currentColor`,
  children: (0, jsxRuntime.jsx)(`path`, {
    d: `M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z`
  })
});
var CloseIcon = () => (0, jsxRuntime.jsxs)(`svg`, {
  width: `14`,
  height: `14`,
  viewBox: `0 0 24 24`,
  fill: `none`,
  stroke: `currentColor`,
  strokeWidth: `2`,
  children: [(0, jsxRuntime.jsx)(`circle`, {
    cx: `12`,
    cy: `12`,
    r: `3`
  }), (0, jsxRuntime.jsx)(`path`, {
    d: `M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z`
  })]
});
function App() {
  return (0, jsxRuntime.jsx)(PracticeView, {});
}
function PianoSoundSelect({
  quick = false
}) {
  const {
      settings: n,
      updateSettings: update
    } = useAppStore(),
    {
      tr: i
    } = useI18n();
  const style = {
    padding: quick ? '4px 8px' : '8px 10px',
    borderRadius: 7,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: quick ? 12 : undefined,
    width: quick ? 168 : '100%',
    cursor: 'pointer'
  };
  return (0, jsxRuntime.jsx)('select', {
    'aria-label': quick ? i('快速切换钢琴音色', 'Quick piano sound') : i('钢琴音色', 'Piano sound'),
    title: i('切换时暂停播放', 'Pauses playback when changed'),
    value: ['grand', 'bright'].includes(n.instrument) ? 'upright-kw' : n.instrument,
    style,
    onChange: e => {
      syncEngine.pause();
      update({
        instrument: e.target.value
      });
    },
    children: [['upright-kw', i('Kawai 立式', 'Kawai Upright')], ['ydp-grand', i('Yamaha 三角', 'Yamaha Grand')], ['salamander-grand', i('Salamander 三角', 'Salamander Grand')], ['steinway-b', i('施坦威 B', 'Steinway B')]].map(([value, label]) => (0, jsxRuntime.jsx)('option', {
      value,
      children: label
    }, value))
  });
}
function PianoQuickSoundControls() {
  const {
      pianoSampleStatus: status
    } = useAppStore(),
    {
      tr: i
    } = useI18n();
  return (0, jsxRuntime.jsxs)('div', {
    'data-piano-quick-sound': true,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginLeft: 'auto',
      flexShrink: 0,
      whiteSpace: 'nowrap'
    },
    children: [(0, jsxRuntime.jsxs)('label', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      },
      children: [i('音色', 'Sound'), (0, jsxRuntime.jsx)(PianoSoundSelect, {
        quick: true
      })]
    }), (0, jsxRuntime.jsx)('span', {
      role: 'status',
      'aria-live': 'polite',
      style: {
        fontSize: 11,
        color: 'var(--color-text-muted)'
      },
      children: status?.error ? i('加载失败', 'Load failed') : status?.loading ? i('加载 ', 'Loading ') + Math.round(status.done / Math.max(1, status.total) * 100) + '%' : ''
    })]
  });
}
function PianoSoundControls() {
  const {
      settings: n,
      updateSettings: update,
      pianoSampleStatus: status
    } = useAppStore(),
    {
      tr: i
    } = useI18n();
  const fieldStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 7,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)'
  };
  const row = (label, sublabel, children) => (0, jsxRuntime.jsx)(SettingRow, {
    label,
    sublabel,
    stacked: true,
    children
  }, label);
  const slider = (name, label, value, min, max, step) => (0, jsxRuntime.jsx)('input', {
    type: 'range',
    'aria-label': label,
    min,
    max,
    step,
    value,
    style: {
      width: '100%'
    },
    onChange: e => update({
      [name]: Number(e.target.value)
    })
  });
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [row(i('钢琴音色', 'Piano sound'), i('切换时暂停播放', 'Pauses playback when changed'), (0, jsxRuntime.jsx)(PianoSoundSelect, {})), status && (0, jsxRuntime.jsx)('div', {
      role: 'status',
      'aria-live': 'polite',
      style: {
        fontSize: 11,
        padding: '0 20px 8px',
        color: 'var(--color-text-muted)'
      },
      children: status.error ? i('音色加载失败，请重新选择后再试', 'Could not load piano. Select it again to retry.') : status.loading ? i('正在加载音色 ', 'Loading piano ') + Math.round(status.done / Math.max(1, status.total) * 100) + '%' : i('音色已就绪', 'Piano ready')
    }), row(i('明亮度', 'Brightness'), i('柔和 · 原音 · 明亮', 'Soft · Original · Bright'), slider('pianoBrightness', i('明亮度', 'Brightness'), n.pianoBrightness ?? 0, -6, 6, .5)), row(i('空间感', 'Room'), i('贴近琴键 · 房间余韵', 'Close keys · Room ambience'), slider('pianoRoom', i('空间感', 'Room'), n.pianoRoom ?? 12, 0, 30, 1)), row(i('基准音高', 'Reference pitch'), i('标准为 440 Hz', 'Standard: 440 Hz'), (0, jsxRuntime.jsx)('select', {
      'aria-label': i('基准音高', 'Reference pitch'),
      value: n.pianoTuning ?? 440,
      style: fieldStyle,
      onChange: e => update({
        pianoTuning: Number(e.target.value)
      }),
      children: [432, 440, 442].map(v => (0, jsxRuntime.jsx)('option', {
        value: v,
        children: v + ' Hz' + (v === 440 ? i(' · 标准', ' · Standard') : '')
      }, v))
    }))]
  });
}
export { TransportControls, TransportButton, TransportToggle, TransportDivider, ExportMenuItem, PlayIcon, PauseIcon, StopIcon, RewindIcon, ForwardIcon, UploadIcon, DownloadIcon, SpinnerIcon, WaitIcon, LoopIcon, TempoIcon, MetronomeIcon, SettingLabelContext, NOTE_FILTER_OPTIONS, COLOR_THEME_LABELS, KEY_LABEL_OPTIONS, transposeLabel, SettingSwitch, SettingRow, SegmentedControl, SettingsSection, SettingsHeading, ResetSettingsButton, SettingsPanel, DevicePanel, isYamahaOutput, SongLibraryPanel, LibrarySection, AudioAttachment, MixerControl, PracticeView, EmptyScoreOverlay, UploadLargeIcon, GRID_MIDI_MIN, GRID_MIDI_MAX, buildGridKeyIndices, gridWhiteKeyIndex, gridWhiteCount, drawPianoGrid, PianoModeBackground, StatusBar, StatusSeparator, ErrorToast, SettingsIcon, PianoKeysIcon, SunIcon, MoonIcon, CloseIcon, App, PianoSoundSelect, PianoQuickSoundControls, PianoSoundControls };
