// SPDX-License-Identifier: MIT
// See docs/PROVENANCE.md for upstream attribution and source restoration.
import { create as createStore } from 'zustand';
import { getTransport, start as startAudio } from 'tone';
import { installPedalPlayback } from './runtime/pedal-playback.mjs';
import { installSampledPiano } from './runtime/sampled-piano.mjs';
import { bus, syncEngine, readPracticeContext, savePracticeContext } from "./engine.js";
var LIBRARY_DB_NAME = `piano-practice-library`;
var LIBRARY_DB_VERSION = 2;
var SONGS_STORE = `songs`;
var ASSETS_STORE = `songAssets`;
var LAST_SONG_KEY = `piano-practice-last-song-id`;
var songMutations = new Map();
var libraryMutationQueue = Promise.resolve();
async function serializeLibraryMutation(e) {
  let t = libraryMutationQueue.catch(() => {}).then(e);
  return libraryMutationQueue = t.then(() => void 0, () => void 0), t;
}
async function serializeSongMutation(e, t) {
  let n = (songMutations.get(e) ?? Promise.resolve()).catch(() => {}).then(t),
    r = n.then(() => void 0, () => void 0);
  songMutations.set(e, r);
  try {
    return await n;
  } finally {
    songMutations.get(e) === r && songMutations.delete(e);
  }
}
var DEFAULT_MIXER = {
  accompaniment: .7,
  referencePiano: .3,
  metronome: .2
};
function clampVolume(e) {
  return Math.max(0, Math.min(1, Number.isFinite(e) ? e : 0));
}
function normalizeMixer(e) {
  let t = e ?? DEFAULT_MIXER;
  return {
    accompaniment: clampVolume(t.accompaniment),
    referencePiano: clampVolume(t.referencePiano),
    metronome: clampVolume(t.metronome)
  };
}
function assetKey(e, t) {
  return `${e}:${t}`;
}
async function hashText(e) {
  let t = new TextEncoder().encode(e),
    n = await crypto.subtle.digest(`SHA-256`, t);
  return [...new Uint8Array(n)].map(e => e.toString(16).padStart(2, `0`)).join(``);
}
function openLibraryDB() {
  return new Promise((e, t) => {
    let n = indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION),
      r = false;
    n.onupgradeneeded = e => {
      let t = n.result,
        r = n.transaction;
      if (!r) return;
      let i;
      t.objectStoreNames.contains(SONGS_STORE) ? (i = r.objectStore(SONGS_STORE), i.indexNames.contains(`lastOpenedAt`) || i.createIndex(`lastOpenedAt`, `lastOpenedAt`, {
        unique: false
      }), i.indexNames.contains(`title`) || i.createIndex(`title`, `title`, {
        unique: false
      }), i.indexNames.contains(`scoreHash`) || i.createIndex(`scoreHash`, `scoreHash`, {
        unique: false
      })) : (i = t.createObjectStore(SONGS_STORE, {
        keyPath: `id`
      }), i.createIndex(`lastOpenedAt`, `lastOpenedAt`, {
        unique: false
      }), i.createIndex(`title`, `title`, {
        unique: false
      }), i.createIndex(`scoreHash`, `scoreHash`, {
        unique: false
      }));
      let a;
      if (t.objectStoreNames.contains(ASSETS_STORE) ? (a = r.objectStore(ASSETS_STORE), a.indexNames.contains(`songId`) || a.createIndex(`songId`, `songId`, {
        unique: false
      })) : (a = t.createObjectStore(ASSETS_STORE, {
        keyPath: `id`
      }), a.createIndex(`songId`, `songId`, {
        unique: false
      })), (e.oldVersion ?? 0) < 2) {
        let e = i.openCursor();
        e.onsuccess = () => {
          let t = e.result;
          if (!t) return;
          let n = t.value,
            r = false;
          if (n.accompaniment instanceof Blob) {
            let e = assetKey(n.id, `accompaniment`);
            a.put({
              id: e,
              songId: n.id,
              kind: `accompaniment`,
              name: n.accompanimentName ?? `accompaniment`,
              mimeType: n.accompaniment.type || `application/octet-stream`,
              size: n.accompaniment.size,
              blob: n.accompaniment,
              updatedAt: n.updatedAt ?? Date.now()
            }), n.accompanimentAssetId = e, delete n.accompaniment, r = true;
          }
          if (n.referencePiano instanceof Blob) {
            let e = assetKey(n.id, `referencePiano`);
            a.put({
              id: e,
              songId: n.id,
              kind: `referencePiano`,
              name: n.referencePianoName ?? `reference-piano`,
              mimeType: n.referencePiano.type || `application/octet-stream`,
              size: n.referencePiano.size,
              blob: n.referencePiano,
              updatedAt: n.updatedAt ?? Date.now()
            }), n.referencePianoAssetId = e, delete n.referencePiano, r = true;
          }
          r && t.update(n), t.continue();
        };
      }
    }, n.onsuccess = () => {
      if (r) {
        n.result.close();
        return;
      }
      e(n.result);
    }, n.onerror = () => t(n.error ?? Error(`Failed to open local song library`)), n.onblocked = () => {
      r = true, t(Error(`Local song library is blocked by another app window`));
    };
  });
}
function requestResult(e) {
  return new Promise((t, n) => {
    e.onsuccess = () => t(e.result), e.onerror = () => n(e.error ?? Error(`IndexedDB request failed`));
  });
}
function transactionDone(e) {
  let t = new Promise((t, n) => {
    e.oncomplete = () => t(), e.onabort = () => n(e.error ?? Error(`Song library transaction aborted`)), e.onerror = () => n(e.error ?? Error(`Song library transaction failed`));
  });
  return t.catch(() => {}), t;
}
async function withSongs(e, t) {
  let n = await openLibraryDB();
  try {
    let r = n.transaction(SONGS_STORE, e),
      i = transactionDone(r),
      a = await requestResult(t(r.objectStore(SONGS_STORE)));
    return await i, a;
  } finally {
    n.close();
  }
}
function normalizeSong(e) {
  return {
    ...e,
    audioOffsetMs: Math.max(-2e3, Math.min(2e3, Math.round(e.audioOffsetMs ?? 0))),
    recommendedMix: normalizeMixer(e.recommendedMix),
    userMix: normalizeMixer(e.userMix)
  };
}
function songSummary(e) {
  let t = normalizeSong(e);
  return {
    id: t.id,
    title: t.title,
    originalFilename: t.originalFilename,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    lastOpenedAt: t.lastOpenedAt,
    hasAccompaniment: !!t.accompanimentAssetId,
    hasReferencePiano: !!t.referencePianoAssetId,
    audioOffsetMs: t.audioOffsetMs,
    recommendedMix: t.recommendedMix,
    userMix: t.userMix
  };
}
async function listSongs() {
  return (await withSongs(`readonly`, e => e.getAll())).filter(e => !e.remoteHidden).map(songSummary).sort((e, t) => t.lastOpenedAt - e.lastOpenedAt);
}
async function getSong(e) {
  let t = (await withSongs(`readonly`, t => t.get(e))) ?? null;
  return t ? normalizeSong(t) : null;
}
async function getSongByHash(e) {
  let t = (await withSongs(`readonly`, t => t.index(`scoreHash`).get(e))) ?? null;
  return t ? normalizeSong(t) : null;
}
async function saveSong(e) {
  let t = e.midiBuffer ? `midi:` + [...new Uint8Array(await crypto.subtle.digest(`SHA-256`, e.midiBuffer))].map(e => e.toString(16).padStart(2, `0`)).join(``) : await hashText(e.scoreXml);
  return serializeLibraryMutation(async () => {
    let n = Date.now(),
      r = e.id ? await getSong(e.id) : null,
      i = r ? null : await getSongByHash(t);
    if (i && (i.scoreXml !== e.scoreXml || e.midiBuffer && (!i.midiBuffer || i.midiBuffer.byteLength !== e.midiBuffer.byteLength || !new Uint8Array(e.midiBuffer).every((e, t) => e === new Uint8Array(i.midiBuffer)[t]))) && (i = null), !r && !i && !e.midiBuffer) {
      let n = (await withSongs(`readonly`, e => e.getAll())).find(t => !t.scoreHash && t.scoreXml === e.scoreXml);
      n && (i = normalizeSong({
        ...n,
        scoreHash: t
      }), await withSongs(`readwrite`, e => e.put(i)));
    }
    let a = r ?? i,
      o = a?.id ?? e.id ?? crypto.randomUUID();
    return serializeSongMutation(o, async () => {
      let r = (await getSong(o)) ?? a,
        i = normalizeSong({
          id: o,
          title: r?.title ?? e.title,
          scoreXml: e.scoreXml,
          scoreFormat: e.scoreFormat,
          midiBuffer: e.midiBuffer,
          originalFilename: e.originalFilename,
          scoreHash: t,
          createdAt: r?.createdAt ?? n,
          updatedAt: Date.now(),
          lastOpenedAt: Date.now(),
          accompanimentAssetId: r?.accompanimentAssetId,
          accompanimentName: r?.accompanimentName,
          referencePianoAssetId: r?.referencePianoAssetId,
          referencePianoName: r?.referencePianoName,
          audioOffsetMs: r?.audioOffsetMs ?? 0,
          recommendedMix: r?.recommendedMix ?? DEFAULT_MIXER,
          userMix: r?.userMix ?? DEFAULT_MIXER
        });
      return await withSongs(`readwrite`, e => e.put(i)), writeLastSongId(o), i;
    });
  });
}
async function markSongOpened(e) {
  return serializeSongMutation(e, async () => {
    let t = await getSong(e);
    if (!t) return null;
    let n = {
      ...t,
      lastOpenedAt: Date.now()
    };
    return await withSongs(`readwrite`, e => e.put(n)), writeLastSongId(e), n;
  });
}
async function renameSong(e, t) {
  let n = t.trim().slice(0, 200);
  n && (await serializeSongMutation(e, async () => {
    let t = await getSong(e);
    t && (await withSongs(`readwrite`, e => e.put({
      ...t,
      title: n,
      updatedAt: Date.now()
    })));
  }));
}
async function removeSong(id) {
  await serializeSongMutation(id, async () => {
    const song = await getSong(id);
    if (!song) return;
    await withSongs(`readwrite`, table => table.put({
      ...song,
      remoteHidden: true,
      userDeletedAt: Date.now()
    }));
    if (readLastSongId() === id) writeLastSongId(null);
  });
}
async function restoreLibrarySong(id) {
  await serializeSongMutation(id, async () => {
    const song = await getSong(id);
    if (!song) return;
    const next = {
      ...song,
      remoteHidden: false
    };
    delete next.userDeletedAt;
    await withSongs(`readwrite`, table => table.put(next));
  });
}
async function replaceSongScore(e, t) {
  let n = t.midiBuffer ? `midi:` + [...new Uint8Array(await crypto.subtle.digest(`SHA-256`, t.midiBuffer))].map(e => e.toString(16).padStart(2, `0`)).join(``) : await hashText(t.scoreXml);
  return serializeSongMutation(e, async () => {
    let r = await getSong(e);
    if (!r) throw Error(`Saved song not found`);
    let i = {
      ...r,
      scoreXml: t.scoreXml,
      scoreFormat: t.scoreFormat,
      midiBuffer: t.midiBuffer,
      originalFilename: t.originalFilename ?? r.originalFilename,
      scoreHash: n,
      updatedAt: Date.now(),
      lastOpenedAt: Date.now()
    };
    return await withSongs(`readwrite`, e => e.put(i)), writeLastSongId(e), i;
  });
}
async function readSongAudio(e, t) {
  let n = t === `accompaniment` ? e.accompanimentAssetId : e.referencePianoAssetId;
  if (!n) return null;
  let r = await openLibraryDB();
  try {
    let e = r.transaction(ASSETS_STORE, `readonly`),
      t = transactionDone(e),
      i = await requestResult(e.objectStore(ASSETS_STORE).get(n));
    return await t, i?.blob ?? null;
  } finally {
    r.close();
  }
}
async function attachSongAudio(e, t, n) {
  let r = n.slice(0, n.size, n.type || `application/octet-stream`),
    i = n.name;
  return serializeSongMutation(e, async () => {
    let n = await getSong(e);
    if (!n) throw Error(`Saved song not found`);
    let a = Date.now(),
      o = assetKey(e, t),
      s = {
        id: o,
        songId: e,
        kind: t,
        name: i,
        mimeType: r.type || `application/octet-stream`,
        size: r.size,
        blob: r,
        updatedAt: a
      },
      c = {
        ...n,
        updatedAt: a,
        ...(t === `accompaniment` ? {
          accompanimentAssetId: o,
          accompanimentName: i
        } : {
          referencePianoAssetId: o,
          referencePianoName: i
        })
      },
      l = await openLibraryDB();
    try {
      let e = l.transaction([SONGS_STORE, ASSETS_STORE], `readwrite`),
        t = transactionDone(e);
      e.objectStore(ASSETS_STORE).put(s), e.objectStore(SONGS_STORE).put(c), await t;
    } finally {
      l.close();
    }
    return c;
  });
}
async function detachSongAudio(e, t) {
  return serializeSongMutation(e, async () => {
    let n = await getSong(e);
    if (!n) throw Error(`Saved song not found`);
    let r = t === `accompaniment` ? n.accompanimentAssetId : n.referencePianoAssetId,
      i = {
        ...n,
        updatedAt: Date.now()
      };
    t === `accompaniment` ? (delete i.accompanimentAssetId, delete i.accompanimentName) : (delete i.referencePianoAssetId, delete i.referencePianoName);
    let a = await openLibraryDB();
    try {
      let n = a.transaction([SONGS_STORE, ASSETS_STORE], `readwrite`),
        o = transactionDone(n);
      r && n.objectStore(ASSETS_STORE).delete(r), n.objectStore(ASSETS_STORE).delete(assetKey(e, t)), n.objectStore(SONGS_STORE).put(i), await o;
    } finally {
      a.close();
    }
    return i;
  });
}
async function updateSongMix(e, t) {
  return serializeSongMutation(e, async () => {
    let n = await getSong(e);
    if (!n) throw Error(`Saved song not found`);
    let r = {
      ...n,
      updatedAt: Date.now(),
      audioOffsetMs: t.audioOffsetMs === void 0 ? n.audioOffsetMs : Math.max(-2e3, Math.min(2e3, Math.round(t.audioOffsetMs))),
      recommendedMix: t.recommendedMix ? normalizeMixer(t.recommendedMix) : normalizeMixer(n.recommendedMix),
      userMix: t.userMix ? normalizeMixer(t.userMix) : normalizeMixer(n.userMix)
    };
    return await withSongs(`readwrite`, e => e.put(r)), r;
  });
}
async function requestPersistentStorage() {
  try {
    return navigator.storage?.persist ? navigator.storage.persisted && (await navigator.storage.persisted()) ? true : await navigator.storage.persist() : null;
  } catch {
    return null;
  }
}
function isQuotaError(e) {
  return e instanceof DOMException && (e.name === `QuotaExceededError` || e.name === `NS_ERROR_DOM_QUOTA_REACHED`);
}
function readLastSongId() {
  try {
    return window.localStorage.getItem(LAST_SONG_KEY);
  } catch {
    return null;
  }
}
function writeLastSongId(e) {
  try {
    e ? window.localStorage.setItem(LAST_SONG_KEY, e) : window.localStorage.removeItem(LAST_SONG_KEY);
  } catch {}
}
async function listArchivedSongs() {
  return (await withSongs(`readonly`, e => e.getAll())).filter(e => e.remoteHidden).map(e => ({
    ...songSummary(e),
    userDeletedAt: e.userDeletedAt,
    title: e.title + (e.userDeletedAt ? ` · 已删除` : ` · 已归档`)
  }));
}
var BACKING_DRIFT_THRESHOLD = .12;
var backingEngine = new class {
  backing = this.makeElement();
  reference = this.makeElement();
  backingUrl = null;
  referenceUrl = null;
  songId = null;
  audioOffsetMs = 0;
  mix = {
    accompaniment: .7,
    referencePiano: .3,
    metronome: .2
  };
  outputDeviceId = ``;
  startedForRun = false;
  playGeneration = 0;
  pendingPlays = new Map();
  playErrorKinds = new Set();
  destroyed = false;
  loadGeneration = 0;
  outputRouteTail = Promise.resolve();
  deviceChangeHandler = () => {
    this.handleDeviceChange();
  };
  constructor() {
    bus.on(`transport:stateChange`, ({
      status: e
    }) => {
      e === `paused` || e === `waiting` ? (this.pause(), e === `paused` && this.playErrorKinds.clear()) : e === `stopped` && (this.playErrorKinds.clear(), this.pause(), this.seek(0), this.startedForRun = false);
    }), bus.on(`transport:seek`, ({
      seconds: e
    }) => {
      this.pause(), this.seek(e), this.startedForRun = false, this.playErrorKinds.clear();
    }), bus.on(`document:loaded`, () => {
      this.pause(), this.startedForRun = false, this.playErrorKinds.clear();
    }), bus.on(`transport:tick`, ({
      seconds: e
    }) => {
      if (this.destroyed) return;
      let t = syncEngine.state;
      this.setTempo(t.tempoMultiplier), t.status === `playing` && this.followTick(e);
    }), navigator.mediaDevices?.addEventListener?.(`devicechange`, this.deviceChangeHandler);
  }
  makeElement() {
    let e = document.createElement(`audio`);
    e.preload = `auto`, e.loop = false, e.crossOrigin = `anonymous`;
    let t = e;
    return `preservesPitch` in t && (t.preservesPitch = true), e;
  }
  revokeUrls() {
    this.backingUrl && URL.revokeObjectURL(this.backingUrl), this.referenceUrl && URL.revokeObjectURL(this.referenceUrl), this.backingUrl = null, this.referenceUrl = null;
  }
  async loadSong(e) {
    let t = ++this.loadGeneration;
    if (this.pause(), this.resetElement(this.backing), this.resetElement(this.reference), this.revokeUrls(), this.songId = e?.id ?? null, this.startedForRun = false, this.playErrorKinds.clear(), this.audioOffsetMs = e?.audioOffsetMs ?? 0, this.mix = e?.userMix ?? {
      accompaniment: .7,
      referencePiano: .3,
      metronome: .2
    }, this.applyVolumes(), !e) return;
    let [n, r] = await Promise.all([readSongAudio(e, `accompaniment`), readSongAudio(e, `referencePiano`)]);
    t !== this.loadGeneration || this.destroyed || (e.accompanimentAssetId && !n && bus.emit(`backing:assetMissing`, {
      kind: `accompaniment`
    }), e.referencePianoAssetId && !r && bus.emit(`backing:assetMissing`, {
      kind: `referencePiano`
    }), n && (this.backingUrl = URL.createObjectURL(n), this.backing.src = this.backingUrl, this.backing.load()), r && (this.referenceUrl = URL.createObjectURL(r), this.reference.src = this.referenceUrl, this.reference.load()), this.outputDeviceId && (await this.setOutputDevice(this.outputDeviceId).catch(() => {})));
  }
  resetElement(e) {
    e.pause(), e.removeAttribute(`src`);
    try {
      e.load();
    } catch {}
  }
  unload() {
    this.loadGeneration++, this.pause(), this.resetElement(this.backing), this.resetElement(this.reference), this.revokeUrls(), this.songId = null, this.startedForRun = false, this.playErrorKinds.clear();
  }
  get currentSongId() {
    return this.songId;
  }
  get hasBacking() {
    return this.backing.hasAttribute(`src`);
  }
  get hasReference() {
    return this.reference.hasAttribute(`src`);
  }
  setMix(e) {
    this.mix = {
      accompaniment: Math.max(0, Math.min(1, e.accompaniment)),
      referencePiano: Math.max(0, Math.min(1, e.referencePiano)),
      metronome: Math.max(0, Math.min(1, e.metronome))
    }, this.applyVolumes();
  }
  applyVolumes() {
    this.backing.volume = this.mix.accompaniment, this.reference.volume = this.mix.referencePiano;
  }
  setOffsetMs(e) {
    this.audioOffsetMs = Math.max(-2e3, Math.min(2e3, Math.round(e))), this.seek(syncEngine.state.currentSeconds);
  }
  sourceSeconds(e) {
    return e + this.audioOffsetMs / 1e3;
  }
  seek(e) {
    let t = this.sourceSeconds(e);
    this.seekElement(this.backing, t), this.seekElement(this.reference, t);
  }
  seekElement(e, t) {
    if (!e.src) return;
    let n = Number.isFinite(e.duration) && e.duration > 0 ? e.duration : 1 / 0,
      r = Math.max(0, Math.min(t, Math.max(0, n - .005)));
    try {
      e.currentTime = r;
    } catch {
      let t = () => {
        e.removeEventListener(`loadedmetadata`, t);
        try {
          e.currentTime = r;
        } catch {}
      };
      e.addEventListener(`loadedmetadata`, t);
    }
  }
  setTempo(e) {
    let t = Math.max(.25, Math.min(2, e));
    this.backing.playbackRate = t, this.reference.playbackRate = t;
  }
  pause() {
    this.playGeneration++, this.pendingPlays.clear(), this.backing.pause(), this.reference.pause();
  }
  async playElement(e, t) {
    if (!e.src || e.ended || this.playErrorKinds.has(t) || this.pendingPlays.has(e)) return;
    let n = this.playGeneration;
    this.pendingPlays.set(e, n);
    try {
      await e.play();
    } catch (e) {
      if (n !== this.playGeneration || e instanceof DOMException && e.name === `AbortError`) return;
      this.playErrorKinds.add(t);
      let r = e instanceof DOMException ? e.name : `PlaybackError`,
        i = e instanceof Error ? e.message : String(e);
      bus.emit(`backing:playbackError`, {
        kind: t,
        errorName: r,
        message: i
      });
    } finally {
      this.pendingPlays.get(e) === n && this.pendingPlays.delete(e);
    }
  }
  followTick(e) {
    let t = this.sourceSeconds(e),
      n = [this.backing, this.reference].filter(e => e.hasAttribute(`src`));
    if (!n.length) return;
    if (t < 0) {
      for (let e of n) e.pause(), this.seekElement(e, 0);
      this.startedForRun = false;
      return;
    }
    for (let e of n) {
      if (Number.isFinite(e.duration) && t >= e.duration) {
        e.pause();
        continue;
      }
      let n = Math.abs(e.currentTime - t);
      (!this.startedForRun || n > BACKING_DRIFT_THRESHOLD) && this.seekElement(e, t);
    }
    let r = [];
    this.backing.hasAttribute(`src`) && !this.playErrorKinds.has(`accompaniment`) && r.push({
      el: this.backing,
      kind: `accompaniment`
    }), this.reference.hasAttribute(`src`) && !this.playErrorKinds.has(`referencePiano`) && r.push({
      el: this.reference,
      kind: `referencePiano`
    });
    let i = r.filter(({
      el: e
    }) => !Number.isFinite(e.duration) || t < e.duration);
    (!this.startedForRun || i.some(({
      el: e
    }) => e.paused && !e.ended)) && (this.startedForRun = true, Promise.all(i.map(({
      el: e,
      kind: t
    }) => this.playElement(e, t))));
  }
  async enumerateOutputDevices() {
    return navigator.mediaDevices?.enumerateDevices ? (await navigator.mediaDevices.enumerateDevices()).filter(e => e.kind === `audiooutput`).map((e, t) => ({
      deviceId: e.deviceId,
      label: e.label || (e.deviceId === "default" ? `System Default` : `Audio Output ${t + 1}`)
    })) : [];
  }
  async requestOutputDevice() {
    let e = navigator.mediaDevices;
    if (typeof e?.selectAudioOutput != `function`) return null;
    let t = await e.selectAudioOutput();
    return t?.deviceId ? {
      deviceId: t.deviceId,
      label: t.label || `Selected Audio Output`
    } : null;
  }
  async setOutputDevice(e) {
    let t = e === "default" ? `` : e,
      n = this.outputRouteTail.catch(() => {}).then(() => this.applyOutputDevice(t));
    return this.outputRouteTail = n.then(() => void 0, () => void 0), n;
  }
  async applyOutputDevice(e) {
    if (this.destroyed) return;
    let t = this.outputDeviceId;
    if (e !== t) try {
      let t = (await Promise.allSettled([this.setElementSink(this.backing, e), this.setElementSink(this.reference, e)])).find(e => e.status === `rejected`);
      if (t?.status === `rejected`) throw t.reason;
      this.outputDeviceId = e;
    } catch (e) {
      throw await Promise.allSettled([this.setElementSink(this.backing, t), this.setElementSink(this.reference, t)]), this.outputDeviceId = t, e;
    }
  }
  async handleDeviceChange() {
    if (!(!this.outputDeviceId || this.outputDeviceId === "default")) try {
      if ((await this.enumerateOutputDevices()).some(e => e.deviceId === this.outputDeviceId)) return;
      let e = this.outputDeviceId;
      await this.setOutputDevice(``), bus.emit(`backing:outputFallback`, {
        previousDeviceId: e
      });
    } catch {}
  }
  async setElementSink(e, t) {
    if (typeof e.setSinkId != `function`) {
      if (t && t !== "default") throw Error(`AUDIO_OUTPUT_SELECTION_UNSUPPORTED`);
      return;
    }
    await e.setSinkId(t === "default" ? `` : t);
  }
  get selectedOutputDeviceId() {
    return this.outputDeviceId;
  }
  destroy() {
    this.destroyed || (this.destroyed = true, navigator.mediaDevices?.removeEventListener?.(`devicechange`, this.deviceChangeHandler), this.unload());
  }
}();
var CUSTOM_COLOR_PRESETS = {
  violet: {
    leftHand: `#7c3aed`,
    rightHand: `#f59e0b`,
    unknown: `#a78bfa`
  },
  classic: {
    leftHand: `#2563eb`,
    rightHand: `#dc2626`,
    unknown: `#7c3aed`
  },
  ocean: {
    leftHand: `#0284c7`,
    rightHand: `#f97316`,
    unknown: `#0ea5e9`
  },
  forest: {
    leftHand: `#16a34a`,
    rightHand: `#a855f7`,
    unknown: `#4ade80`
  },
  cascade: {
    leftHand: `#9333ea`,
    rightHand: `#22d3ee`,
    unknown: `#a855f7`
  }
};
var SETTINGS_KEY = `piano-practice-settings-v1`;
var LEGACY_THEME_KEY = `b2b-theme`;
var DEFAULT_SETTINGS = {
  guidanceInTest: false,
  showFingering: true,
  showFingeringOnNotes: true,
  showHandColors: true,
  useFlats: false,
  viewportSeconds: 4,
  theme: `dark`,
  language: `zh-CN`,
  activeHands: new Set([`left`, `right`]),
  volume: .8,
  noteFilter: `all`,
  colorTheme: `ocean`,
  customColors: {
    leftHand: `#9333ea`,
    rightHand: `#22d3ee`,
    unknown: `#a855f7`
  },
  layoutMode: `all`,
  metronomeEnabled: false,
  noteLabelMode: `all`,
  fallingNotesLabelMode: `all`,
  pianoTheme: `white`,
  showGrid: false,
  showMeasureNums: true,
  showKeySignature: true,
  transposeSemitones: 0,
  speedTrainer: {
    enabled: false,
    startPct: 60,
    endPct: 100,
    stepPct: 5,
    currentPct: 60
  },
  countInBars: 0,
  impactStyle: `off`,
  sheetMusicWhiteBackground: false,
  scrollToSeek: false,
  minNoteHeight: 8,
  noteCornerRadius: 4,
  showBeatLines: false,
  showSustainPedal: false,
  handVolume: {
    left: 0,
    right: 0
  },
  instrument: `upright-kw`,
  pianoBrightness: 0,
  pianoRoom: 12,
  pianoTuning: 440,
  waitForHand: `both`,
  showNoteOutline: false,
  renderOffset: 0,
  showSustainedNotes: false,
  audioOutputDeviceId: ``
};
function freshSettings() {
  return {
    ...DEFAULT_SETTINGS,
    activeHands: new Set(DEFAULT_SETTINGS.activeHands),
    customColors: {
      ...DEFAULT_SETTINGS.customColors
    },
    speedTrainer: {
      ...DEFAULT_SETTINGS.speedTrainer
    },
    handVolume: {
      ...DEFAULT_SETTINGS.handVolume
    }
  };
}
function serializeSettings(e) {
  return {
    ...e,
    activeHands: [...e.activeHands],
    speedTrainer: {
      ...e.speedTrainer,
      currentPct: e.speedTrainer.startPct
    }
  };
}
function saveSettings(e) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(serializeSettings(e)));
  } catch {}
}
function loadSettings() {
  let e = freshSettings();
  try {
    let t = window.localStorage.getItem(SETTINGS_KEY);
    if (t) {
      let n = JSON.parse(t);
      return {
        ...e,
        ...n,
        customColors: {
          ...e.customColors,
          ...(n.customColors ?? {})
        },
        speedTrainer: {
          ...e.speedTrainer,
          ...(n.speedTrainer ?? {}),
          currentPct: n.speedTrainer?.startPct ?? e.speedTrainer.startPct
        },
        handVolume: {
          ...e.handVolume,
          ...(n.handVolume ?? {})
        },
        activeHands: new Set(Array.isArray(n.activeHands) ? n.activeHands.filter(e => e === `left` || e === `right`) : [...e.activeHands])
      };
    }
    let n = window.localStorage.getItem(LEGACY_THEME_KEY);
    (n === `dark` || n === `light`) && (e.theme = n);
  } catch {}
  return e;
}
var INITIAL_SETTINGS = loadSettings();
var midiInputDevice = null;
var documentLoadGeneration = 0;
var currentLibraryLoad = null;
syncEngine.setTranspose(INITIAL_SETTINGS.transposeSemitones), syncEngine.setCountInBars(INITIAL_SETTINGS.countInBars), syncEngine.setSpeedTrainer(INITIAL_SETTINGS.speedTrainer), syncEngine.setMetronome(INITIAL_SETTINGS.metronomeEnabled), syncEngine.setActiveHands(INITIAL_SETTINGS.activeHands), syncEngine.setHandVolume(INITIAL_SETTINGS.handVolume), syncEngine.setWaitForHand(INITIAL_SETTINGS.waitForHand), syncEngine.setRenderOffset(INITIAL_SETTINGS.renderOffset), syncEngine.setInstrument(INITIAL_SETTINGS.instrument).catch(() => {}), syncEngine.setWaitMode(true);
var useAppStore = createStore((e, t) => (syncEngine.onStateChange(t => {
  e({
    demo: t.demo,
    demoHands: t.demoHands,
    practiceMode: t.practiceMode,
    stablePasses: t.stablePasses,
    countingIn: t.countingIn,
    status: t.status,
    currentSeconds: t.currentSeconds,
    tempoMultiplier: t.tempoMultiplier,
    loopStart: t.loopStart,
    loopEnd: t.loopEnd,
    waitMode: t.waitMode
  });
}), bus.on(`speedTrainer:stepped`, ({
  currentPct: t
}) => {
  e(e => ({
    tempoMultiplier: t / 100,
    settings: {
      ...e.settings,
      speedTrainer: {
        ...e.settings.speedTrainer,
        currentPct: t
      }
    }
  }));
}), bus.on(`backing:outputFallback`, () => {
  let t = null;
  e(e => (t = {
    ...e.settings,
    audioOutputDeviceId: ``
  }, {
    settings: t,
    loadError: e.settings.language === `zh-CN` ? `伴奏音频输出设备已断开，已切换到 Mac / 系统默认输出。` : `The backing-track output device disconnected. Switched to the Mac/system default output.`
  })), t && saveSettings(t);
}), bus.on(`backing:assetMissing`, ({
  kind: t
}) => {
  e(e => ({
    loadError: e.settings.language === `zh-CN` ? t === `accompaniment` ? `这首曲目的伴奏文件已丢失或无法读取。乐谱仍可正常练习，可在曲目面板重新选择伴奏。` : `这首曲目的参考钢琴文件已丢失或无法读取。乐谱仍可正常练习，可在曲目面板重新选择参考钢琴。` : t === `accompaniment` ? `This song's backing-track asset is missing or unreadable. The score is still usable; attach the backing track again from Songs.` : `This song's reference-piano asset is missing or unreadable. The score is still usable; attach it again from Songs.`
  }));
}), bus.on(`backing:playbackError`, ({
  kind: t,
  errorName: n,
  message: r
}) => {
  e(e => {
    let i = e.settings.language === `zh-CN`;
    return {
      loadError: `${t === `accompaniment` ? i ? `伴奏` : `Backing track` : i ? `参考钢琴` : `Reference piano`}：${n === `NotAllowedError` ? i ? `请先点击播放或重新选择音频输出设备后再试。` : `Click Play or reselect the audio output device, then try again.` : n === `NotSupportedError` ? i ? `这个音频编码当前无法播放，请换成 M4A / MP3 / WAV。` : `This audio codec is not supported here. Try M4A, MP3, or WAV.` : r}`
    };
  });
}), {
  document: null,
  isLoadingDocument: false,
  isGeneratingFingering: false,
  isExportingPdf: false,
  isExportingMp3: false,
  loadError: null,
  loadingMessage: null,
  demo: false,
  demoHands: `both`,
  practiceMode: `learn`,
  stablePasses: 0,
  countingIn: false,
  setDemo: (e, t) => syncEngine.setDemo(e, t),
  setPracticeMode: (e, t = `right`) => {
    syncEngine.setPracticeMode(e, t);
  },
  status: `stopped`,
  currentSeconds: 0,
  tempoMultiplier: 1,
  loopStart: null,
  loopEnd: null,
  waitMode: false,
  settings: INITIAL_SETTINGS,
  midiDeviceName: null,
  midiEnabled: false,
  savedSongs: [],
  currentSongId: null,
  currentSavedSong: null,
  libraryReady: false,
  loadMidiFile: e => t().loadMusicXmlFile(e),
  loadMusicXmlFile: async n => {
    let r = ++documentLoadGeneration;
    currentLibraryLoad = null, (t().status === `playing` || t().status === `waiting`) && syncEngine.pause(), e({
      isLoadingDocument: true,
      loadError: null
    });
    try {
      let i = crypto.randomUUID(),
        a = n.name.replace(/\.(musicxml|xml|mxl|mid|midi|quick\.json)$/i, ``).replace(/[\x00-\x1f\x7f/\\]/g, ``).slice(0, 200) || `Untitled`;
      if (n.size > 50 * 1024 * 1024) throw Error(`乐谱文件超过 50 MB`);
      let o = /\.midi?$/i.test(n.name),
        s = await n.arrayBuffer();
      if (r !== documentLoadGeneration) return;
      let c;
      if (o) c = ``;else if (n.name.toLowerCase().endsWith(`.quick.json`)) c = (await (async () => {
        let {
          quickToXml: e
        } = await Promise.resolve().then(() => quickScoreModule);
        return {
          quickToXml: e
        };
      })()).quickToXml(JSON.parse(new TextDecoder().decode(s)));else if (n.name.toLowerCase().endsWith(`.mxl`)) {
        let {
          extractXmlFromMxl: e
        } = await (async () => {
          let {
            extractXmlFromMxl: e
          } = await import(`./utils/mxlExtract.ts`);
          return {
            extractXmlFromMxl: e
          };
        })();
        c = await e(s);
      } else c = new TextDecoder().decode(s);
      if (r !== documentLoadGeneration) return;
      let {
        localMusicXml: l
      } = await (async () => {
        let {
          localMusicXml: e
        } = await import(`./utils/localMusicXml.ts`);
        return {
          localMusicXml: e
        };
      })();
      if (r !== documentLoadGeneration) return;
      let u = o ? await parseMidiWorker(s.slice(0), i, a) : l(c, i, a);
      if (r !== documentLoadGeneration) return;
      let d = null;
      try {
        d = await saveSong({
          id: i,
          title: a,
          scoreXml: c,
          midiBuffer: o ? s : void 0,
          scoreFormat: o ? `midi` : n.name.toLowerCase().endsWith(`.mxl`) ? `mxl` : `musicxml`,
          originalFilename: n.name
        });
      } catch (e) {
        console.warn(`Could not persist imported score`, e);
      }
      if (r !== documentLoadGeneration) return;
      let f = d ? {
        ...u,
        id: d.id,
        title: d.title
      } : u;
      if (e({
        document: f,
        currentSongId: d?.id ?? null,
        currentSavedSong: d
      }), d ? (backingEngine.setMix(d.userMix), backingEngine.setOffsetMs(d.audioOffsetMs), syncEngine.setMetronomeVolume(d.userMix.metronome), backingEngine.loadSong(d).catch(e => console.warn(`Could not load saved song audio`, e))) : backingEngine.unload(), await syncEngine.loadDocument(f), r !== documentLoadGeneration) return;
      t().setPracticeMode(`test`), t().updateSettings({
        guidanceInTest: false,
        showFingering: false
      }), !o && window.dispatchEvent(new Event(`piano-plain-score`));
      let p = t().currentSongId;
      if (p) {
        let e = {
          ...readPracticeContext(p, f.totalDuration),
          mode: `test`,
          waitMode: false
        };
        t().setPracticeMode(e.mode, e.practiceHand), syncEngine.setWaitMode(e.waitMode), syncEngine.setTempoMultiplier(e.tempoMultiplier), syncEngine.setLoopPoints(e.loopStart, e.loopEnd), syncEngine.seek(e.positionSeconds);
      }
      if (d) {
        let t = await listSongs();
        if (r !== documentLoadGeneration) return;
        e({
          savedSongs: t
        });
      } else e({
        loadError: t().settings.language === `zh-CN` ? `乐谱已打开，但未能保存到本地曲目库。` : `The score opened, but it could not be saved to the local library.`
      });
    } catch (n) {
      if (r !== documentLoadGeneration) return;
      let i = n instanceof Error ? n.message : String(n),
        a = t().settings.language === `zh-CN`;
      e({
        loadError: i === `PRACTICE_NO_NOTES` ? a ? `谱中没有可练习的音符，请导入钢琴 MusicXML。` : `No playable notes were found. Import a piano MusicXML score.` : i
      });
    } finally {
      r === documentLoadGeneration && e({
        isLoadingDocument: false
      });
    }
  },
  loadPdfFile: async t => {
    let n = crypto.randomUUID(),
      r = t.name.replace(/\.pdf$/i, ``).replace(/[\x00-\x1f\x7f/\\]/g, ``).slice(0, 200) || `Untitled`;
    e({
      isLoadingDocument: true,
      loadingMessage: `Reading sheet music…`,
      loadError: null
    });
    try {
      let i = new FormData();
      i.append(`file`, t, t.name);
      let a = await fetch(`/api/omr/pdf2midi`, {
        method: `POST`,
        body: i
      });
      if (!a.ok) {
        let e = await a.json().catch(() => ({}));
        throw Error(e.detail ?? `Server error ${a.status}`);
      }
      let {
          musicxml: o,
          midi_b64: s
        } = await a.json(),
        c = atob(s),
        l = new Uint8Array(c.length);
      for (let e = 0; e < c.length; e++) l[e] = c.charCodeAt(e);
      let u = l.buffer,
        d = u.slice(0),
        f = await parseMidiWorker(u, n, r);
      f.musicXml = o, f.sourceType = `musicxml`;
      let p = false;
      if (o) {
        let e = applyMusicXmlFingerings(f.notes, o);
        e.some(e => e.finger !== null) && (f.notes = e, f.fingeringVersion = `manual`, p = true);
      }
      let m = {
        ...f,
        midiBuffer: d
      };
      e(e => ({
        document: m,
        settings: p ? {
          ...e.settings,
          showFingering: true
        } : e.settings
      })), await syncEngine.loadDocument(m);
    } catch (t) {
      e({
        loadError: String(t)
      });
    } finally {
      e({
        isLoadingDocument: false,
        loadingMessage: null
      });
    }
  },
  loadAudioFile: async t => {
    let n = crypto.randomUUID(),
      r = t.name.replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, ``).replace(/[\x00-\x1f\x7f/\\]/g, ``).slice(0, 200) || `Untitled`;
    e({
      isLoadingDocument: true,
      loadingMessage: `Transcribing audio…`,
      loadError: null
    });
    try {
      let i = new FormData();
      i.append(`file`, t, t.name);
      let a = await fetch(`/api/transcribe/mp3`, {
        method: `POST`,
        body: i
      });
      if (!a.ok) {
        let e = await a.json().catch(() => ({}));
        throw Error(e.detail ?? `Server error ${a.status}`);
      }
      let o = await a.arrayBuffer(),
        s = o.slice(0),
        c = await parseMidiWorker(o, n, r);
      e({
        document: {
          ...c,
          midiBuffer: s
        }
      }), await syncEngine.loadDocument({
        ...c,
        midiBuffer: s
      }), requestFingering(s.slice(0), c, n).catch(console.warn);
    } catch (t) {
      e({
        loadError: t instanceof Error ? t.message : String(t)
      });
    } finally {
      e({
        isLoadingDocument: false,
        loadingMessage: null
      });
    }
  },
  generateFingering: async () => {
    let {
      document: n
    } = t();
    if (n?.musicXml) {
      e({
        isGeneratingFingering: true,
        loadError: null
      });
      try {
        let r = await fetch(`/api/fingering/generate`, {
          method: `POST`,
          headers: {
            "Content-Type": `application/json`
          },
          body: JSON.stringify({
            musicxml: n.musicXml
          })
        });
        if (!r.ok) {
          let e = await r.json().catch(() => ({}));
          throw Error(e.detail ?? `Server error ${r.status}`);
        }
        let {
            musicxml: i
          } = await r.json(),
          a = applyMusicXmlFingerings(n.notes, i),
          {
            document: o
          } = t();
        if (o?.id === n.id) {
          let t = {
            ...o,
            notes: a,
            fingeringVersion: `auto`
          };
          e(e => ({
            document: t,
            settings: {
              ...e.settings,
              showFingering: true
            }
          })), syncEngine.updateDocumentNotes(a);
        }
      } catch (t) {
        e({
          loadError: String(t)
        });
      } finally {
        e({
          isGeneratingFingering: false
        });
      }
    }
  },
  exportMidi: () => {
    let {
      document: e
    } = t();
    e?.midiBuffer && downloadBlob(new Blob([e.midiBuffer], {
      type: `audio/midi`
    }), `${safeFilename(e.title)}.midi`);
  },
  exportMusicXml: () => {
    let {
      document: e
    } = t();
    e?.musicXml && downloadBlob(new Blob([e.musicXml], {
      type: `application/vnd.recordare.musicxml+xml`
    }), `${safeFilename(e.title)}.musicxml`);
  },
  exportPdf: async () => {
    let {
      document: n
    } = t();
    if (n?.musicXml) {
      e({
        isExportingPdf: true,
        loadError: null
      });
      try {
        let e = await fetch(`/api/export/pdf`, {
          method: `POST`,
          headers: {
            "Content-Type": `application/json`
          },
          body: JSON.stringify({
            musicxml: n.musicXml
          })
        });
        if (!e.ok) {
          let t = await e.json().catch(() => ({}));
          throw Error(t.detail ?? `Server error ${e.status}`);
        }
        downloadBlob(await e.blob(), `${safeFilename(n.title)}.pdf`);
      } catch (t) {
        e({
          loadError: t instanceof Error ? t.message : String(t)
        });
      } finally {
        e({
          isExportingPdf: false
        });
      }
    }
  },
  exportMp3: async () => {
    let {
      document: n
    } = t();
    if (!(!n?.notes || n.notes.length === 0)) {
      e({
        isExportingMp3: true,
        loadError: null
      });
      try {
        let {
            renderOffline: e,
            Scheduler: t,
            SplendidGrandPiano: r
          } = await (async () => {
            let {
              renderOffline: e,
              Scheduler: t,
              SplendidGrandPiano: n
            } = await import(`smplr`);
            return {
              renderOffline: e,
              Scheduler: t,
              SplendidGrandPiano: n
            };
          })(),
          i = .05,
          a = bytesToBase64(await (await e(async e => {
            let a = new r(e, {
              scheduler: new t(e, {
                lookaheadMs: 864e5
              })
            });
            await a.load;
            for (let e of n.notes) a.start({
              note: e.midi,
              velocity: e.velocity,
              time: i + e.startSeconds,
              duration: Math.max(.05, e.endSeconds - e.startSeconds)
            });
          }, {
            sampleRate: 44100,
            channels: 2,
            duration: i + n.totalDuration + 1.5
          })).toWav16().arrayBuffer()),
          o = await fetch(`/api/export/mp3`, {
            method: `POST`,
            headers: {
              "Content-Type": `application/json`
            },
            body: JSON.stringify({
              wav_base64: a
            })
          });
        if (!o.ok) {
          let e = await o.json().catch(() => ({}));
          throw Error(e.detail ?? `Server error ${o.status}`);
        }
        downloadBlob(await o.blob(), `${safeFilename(n.title)}.mp3`);
      } catch (t) {
        e({
          loadError: t instanceof Error ? t.message : String(t)
        });
      } finally {
        e({
          isExportingMp3: false
        });
      }
    }
  },
  play: () => {
    syncEngine.play();
  },
  pause: () => syncEngine.pause(),
  stop: () => syncEngine.stop(),
  seek: e => syncEngine.seek(e),
  setTempoMultiplier: t => {
    syncEngine.setTempoMultiplier(t), backingEngine.setTempo(t), e({
      tempoMultiplier: t
    });
  },
  setLoopPoints: (t, n) => {
    syncEngine.setLoopPoints(t, n), e({
      loopStart: syncEngine.state.loopStart,
      loopEnd: syncEngine.state.loopEnd
    });
  },
  setWaitMode: n => {
    n && t().practiceMode === `test` && t().setPracticeMode(`learn`), syncEngine.setWaitMode(n), e({
      waitMode: n
    });
  },
  setMetronome: t => {
    syncEngine.setMetronome(t);
    let n = null;
    e(e => (n = {
      ...e.settings,
      metronomeEnabled: t
    }, {
      settings: n
    })), n && saveSettings(n);
  },
  setActiveHands: t => {
    syncEngine.setActiveHands(t);
    let n = null;
    e(e => (n = {
      ...e.settings,
      activeHands: t
    }, {
      settings: n
    })), n && saveSettings(n);
  },
  updateSettings: t => {
    let n = null;
    e(e => (n = {
      ...e.settings,
      ...t
    }, {
      settings: n
    })), n && saveSettings(n), syncEngine.audio.setPianoSettings?.(n), `transposeSemitones` in t && t.transposeSemitones !== void 0 && syncEngine.setTranspose(t.transposeSemitones), `countInBars` in t && t.countInBars !== void 0 && syncEngine.setCountInBars(t.countInBars), `speedTrainer` in t && t.speedTrainer !== void 0 && syncEngine.setSpeedTrainer(t.speedTrainer), `handVolume` in t && t.handVolume !== void 0 && syncEngine.setHandVolume(t.handVolume), `instrument` in t && t.instrument !== void 0 && syncEngine.setInstrument(t.instrument).catch(console.warn), `waitForHand` in t && t.waitForHand !== void 0 && syncEngine.setWaitForHand(t.waitForHand), `renderOffset` in t && t.renderOffset !== void 0 && syncEngine.setRenderOffset(t.renderOffset);
  },
  resetSettings: () => {
    let t = freshSettings();
    e({
      settings: t
    }), saveSettings(t), syncEngine.audio.setPianoSettings?.(t), syncEngine.setTranspose(DEFAULT_SETTINGS.transposeSemitones), syncEngine.setCountInBars(DEFAULT_SETTINGS.countInBars), syncEngine.setSpeedTrainer(DEFAULT_SETTINGS.speedTrainer), syncEngine.setMetronome(DEFAULT_SETTINGS.metronomeEnabled), syncEngine.setActiveHands(DEFAULT_SETTINGS.activeHands), syncEngine.setHandVolume(DEFAULT_SETTINGS.handVolume), syncEngine.setWaitForHand(DEFAULT_SETTINGS.waitForHand), syncEngine.setInstrument(DEFAULT_SETTINGS.instrument).catch(console.warn), syncEngine.setRenderOffset(DEFAULT_SETTINGS.renderOffset);
  },
  setMidiDevice: t => e({
    midiDeviceName: t,
    midiEnabled: t !== null
  }),
  initializeLibrary: async () => {
    if (!t().libraryReady) return midiInputDevice || (midiInputDevice = (async () => {
      try {
        requestPersistentStorage();
        let n = await listSongs();
        e({
          savedSongs: n,
          libraryReady: true
        });
        let r = t().settings.audioOutputDeviceId;
        if (r) try {
          await backingEngine.setOutputDevice(r);
        } catch (n) {
          console.warn(`Could not restore audio output device`, n), await backingEngine.setOutputDevice(``).catch(() => {});
          let r = {
            ...t().settings,
            audioOutputDeviceId: ``
          };
          e({
            settings: r
          }), saveSettings(r);
        }
        let i = readLastSongId();
        i && n.some(e => e.id === i) && !t().document && !t().isLoadingDocument && (await t().openSavedSong(i));
      } catch (t) {
        console.warn(`Local song library initialization failed`, t), e({
          libraryReady: true
        });
      } finally {
        midiInputDevice = null;
      }
    })(), midiInputDevice);
  },
  refreshSongLibrary: async () => {
    try {
      e({
        savedSongs: await listSongs()
      });
    } catch (e) {
      console.warn(`Could not refresh local song library`, e);
    }
  },
  openSavedSong: async n => {
    let r = ++documentLoadGeneration;
    currentLibraryLoad = n, (t().status === `playing` || t().status === `waiting`) && syncEngine.pause(), e({
      isLoadingDocument: true,
      loadError: null
    });
    try {
      let i = await getSong(n);
      if (r !== documentLoadGeneration) return;
      if (!i) throw Error(`SAVED_SONG_NOT_FOUND`);
      let {
        localMusicXml: a
      } = await (async () => {
        let {
          localMusicXml: e
        } = await import(`./utils/localMusicXml.ts`);
        return {
          localMusicXml: e
        };
      })();
      if (r !== documentLoadGeneration) return;
      let o = i.scoreFormat === `midi` && i.midiBuffer ? await parseMidiWorker(i.midiBuffer.slice(0), i.id, i.title) : a(i.scoreXml, i.id, i.title);
      if (r !== documentLoadGeneration || (i = (await markSongOpened(i.id)) ?? i, r !== documentLoadGeneration)) return;
      backingEngine.setMix(i.userMix), backingEngine.setOffsetMs(i.audioOffsetMs), syncEngine.setMetronomeVolume(i.userMix.metronome);
      let s = await listSongs();
      if (r !== documentLoadGeneration || (e({
        document: o,
        currentSongId: i.id,
        currentSavedSong: i,
        savedSongs: s
      }), await syncEngine.loadDocument(o), r !== documentLoadGeneration)) return;
      let c = t().currentSongId;
      if (c) {
        let e = readPracticeContext(c, o.totalDuration);
        t().setPracticeMode(e.mode, e.practiceHand), syncEngine.setWaitMode(e.waitMode), syncEngine.setTempoMultiplier(e.tempoMultiplier), syncEngine.setLoopPoints(e.loopStart, e.loopEnd), syncEngine.seek(e.positionSeconds);
      }
      backingEngine.loadSong(i).catch(e => console.warn(`Could not load saved song audio`, e));
    } catch (n) {
      if (r !== documentLoadGeneration) return;
      let i = t().settings.language === `zh-CN`,
        a = n instanceof Error ? n.message : String(n);
      e({
        loadError: a === `SAVED_SONG_NOT_FOUND` ? i ? `保存的曲目不存在或已被删除。` : `The saved song no longer exists.` : i ? `无法打开本地曲目：${a}` : `Could not open saved song: ${a}`
      });
    } finally {
      r === documentLoadGeneration && (currentLibraryLoad = null, e({
        isLoadingDocument: false
      }));
    }
  },
  renameSavedSong: async (n, r) => {
    if (await renameSong(n, r), t().currentSavedSong?.id === n) {
      let t = r.trim().slice(0, 200);
      t && (e(e => ({
        currentSavedSong: e.currentSavedSong ? {
          ...e.currentSavedSong,
          title: t,
          updatedAt: Date.now()
        } : null,
        document: e.document ? {
          ...e.document,
          title: t
        } : null
      })), syncEngine.updateDocumentTitle(t));
    }
    e({
      savedSongs: await listSongs()
    });
  },
  removeSavedSong: async n => {
    let r = t().currentSongId === n;
    currentLibraryLoad === n && (++documentLoadGeneration, currentLibraryLoad = null, e({
      isLoadingDocument: false
    })), r && (t().status === `playing` || t().status === `waiting`) && syncEngine.pause(), await removeSong(n), t().currentSongId === n && (backingEngine.unload(), e({
      currentSongId: null,
      currentSavedSong: null
    })), e({
      savedSongs: await listSongs()
    });
  },
  replaceCurrentSongScore: async n => {
    let r = ++documentLoadGeneration;
    currentLibraryLoad = null;
    let i = t().currentSongId;
    if ((t().status === `playing` || t().status === `waiting`) && syncEngine.pause(), !(!i || !n.name.match(/\.(musicxml|xml|mxl|quick\.json|mid|midi)$/i))) {
      e({
        isLoadingDocument: true,
        loadError: null
      });
      try {
        let a = await n.arrayBuffer();
        if (r !== documentLoadGeneration) return;
        let o = /\.midi?$/i.test(n.name),
          s = o ? `` : n.name.toLowerCase().endsWith(`.quick.json`) ? (await (async () => {
            let {
              quickToXml: e
            } = await Promise.resolve().then(() => quickScoreModule);
            return {
              quickToXml: e
            };
          })()).quickToXml(JSON.parse(new TextDecoder().decode(a))) : n.name.toLowerCase().endsWith(`.mxl`) ? await (await (async () => {
            let {
              extractXmlFromMxl: e
            } = await import(`./utils/mxlExtract.ts`);
            return {
              extractXmlFromMxl: e
            };
          })()).extractXmlFromMxl(a) : new TextDecoder().decode(a);
        if (r !== documentLoadGeneration) return;
        let c = t().currentSavedSong;
        if (!c || c.id !== i) return;
        let {
            localMusicXml: l
          } = await (async () => {
            let {
              localMusicXml: e
            } = await import(`./utils/localMusicXml.ts`);
            return {
              localMusicXml: e
            };
          })(),
          u = o ? await parseMidiWorker(a.slice(0), c.id, c.title) : l(s, c.id, c.title);
        if (r !== documentLoadGeneration) return;
        let d = await replaceSongScore(i, {
          scoreXml: s,
          midiBuffer: o ? a : void 0,
          scoreFormat: o ? `midi` : n.name.toLowerCase().endsWith(`.mxl`) ? `mxl` : `musicxml`,
          originalFilename: n.name
        });
        if (r !== documentLoadGeneration) return;
        let f = {
          ...u,
          id: d.id,
          title: d.title
        };
        backingEngine.setMix(d.userMix), backingEngine.setOffsetMs(d.audioOffsetMs), syncEngine.setMetronomeVolume(d.userMix.metronome);
        let p = await listSongs();
        if (r !== documentLoadGeneration || (e({
          document: f,
          currentSavedSong: d,
          savedSongs: p
        }), await syncEngine.loadDocument(f), r !== documentLoadGeneration)) return;
        let m = t().currentSongId;
        if (m) {
          let e = readPracticeContext(m, f.totalDuration);
          t().setPracticeMode(e.mode, e.practiceHand), syncEngine.setWaitMode(e.waitMode), syncEngine.setTempoMultiplier(e.tempoMultiplier), syncEngine.setLoopPoints(e.loopStart, e.loopEnd), syncEngine.seek(e.positionSeconds);
        }
        backingEngine.loadSong(d).catch(e => console.warn(`Could not reload song audio after score replacement`, e));
      } catch (t) {
        r === documentLoadGeneration && e({
          loadError: t instanceof Error ? t.message : String(t)
        });
      } finally {
        r === documentLoadGeneration && e({
          isLoadingDocument: false
        });
      }
    }
  },
  attachCurrentSongAudio: async (n, r) => {
    let i = t().currentSongId;
    if ((t().status === `playing` || t().status === `waiting`) && syncEngine.pause(), !i) {
      e({
        loadError: t().settings.language === `zh-CN` ? `请先把当前乐谱保存到曲目库。` : `Save the current score to the song library first.`
      });
      return;
    }
    try {
      let a = await attachSongAudio(i, n, r),
        o = await listSongs();
      if (t().currentSongId !== i) {
        e({
          savedSongs: o
        });
        return;
      }
      if (await backingEngine.loadSong(a), t().currentSongId !== i) return;
      backingEngine.setMix(a.userMix), backingEngine.setOffsetMs(a.audioOffsetMs), syncEngine.setMetronomeVolume(a.userMix.metronome), e({
        currentSavedSong: a,
        savedSongs: o
      });
    } catch (n) {
      let r = t().settings.language === `zh-CN`;
      e({
        loadError: isQuotaError(n) ? r ? `本地存储空间不足，无法保存这条音轨。乐谱不会受影响。` : `Not enough local storage to save this audio track. The score is unaffected.` : n instanceof Error ? n.message : String(n)
      });
    }
  },
  detachCurrentSongAudio: async n => {
    let r = t().currentSongId;
    if ((t().status === `playing` || t().status === `waiting`) && syncEngine.pause(), r) try {
      let i = await detachSongAudio(r, n),
        a = await listSongs();
      if (t().currentSongId !== r) {
        e({
          savedSongs: a
        });
        return;
      }
      if (await backingEngine.loadSong(i), t().currentSongId !== r) return;
      backingEngine.setMix(i.userMix), backingEngine.setOffsetMs(i.audioOffsetMs), syncEngine.setMetronomeVolume(i.userMix.metronome), e({
        currentSavedSong: i,
        savedSongs: a
      });
    } catch (t) {
      e({
        loadError: t instanceof Error ? t.message : String(t)
      });
    }
  },
  previewCurrentSongMix: n => {
    let r = t().currentSongId;
    r && (backingEngine.setMix(n), syncEngine.setMetronomeVolume(n.metronome), e(e => ({
      currentSavedSong: e.currentSavedSong?.id === r ? {
        ...e.currentSavedSong,
        userMix: n
      } : e.currentSavedSong,
      savedSongs: e.savedSongs.map(e => e.id === r ? {
        ...e,
        userMix: n
      } : e)
    })));
  },
  setCurrentSongMix: async n => {
    let r = t().currentSongId;
    if (r) {
      t().previewCurrentSongMix(n);
      try {
        let i = await updateSongMix(r, {
          userMix: n
        });
        t().currentSongId === r && e(e => ({
          currentSavedSong: i,
          savedSongs: e.savedSongs.map(e => e.id === r ? {
            ...e,
            userMix: i.userMix,
            updatedAt: i.updatedAt
          } : e)
        }));
      } catch (e) {
        console.warn(`Could not persist song mix`, e);
      }
    }
  },
  restoreRecommendedMix: async () => {
    let e = t().currentSavedSong;
    e && (await t().setCurrentSongMix(e.recommendedMix));
  },
  previewCurrentSongAudioOffset: n => {
    let r = t().currentSongId;
    if (!r) return;
    let i = Math.max(-2e3, Math.min(2e3, Math.round(Number.isFinite(n) ? n : 0)));
    backingEngine.setOffsetMs(i), e(e => ({
      currentSavedSong: e.currentSavedSong?.id === r ? {
        ...e.currentSavedSong,
        audioOffsetMs: i
      } : e.currentSavedSong,
      savedSongs: e.savedSongs.map(e => e.id === r ? {
        ...e,
        audioOffsetMs: i
      } : e)
    }));
  },
  setCurrentSongAudioOffset: async n => {
    let r = t().currentSongId;
    if (!r) return;
    let i = Math.max(-2e3, Math.min(2e3, Math.round(Number.isFinite(n) ? n : 0)));
    t().previewCurrentSongAudioOffset(i);
    try {
      let n = await updateSongMix(r, {
        audioOffsetMs: i
      });
      t().currentSongId === r ? e(e => ({
        currentSavedSong: n,
        savedSongs: e.savedSongs.map(e => e.id === r ? {
          ...e,
          audioOffsetMs: n.audioOffsetMs,
          updatedAt: n.updatedAt
        } : e)
      })) : e(e => ({
        savedSongs: e.savedSongs.map(e => e.id === r ? {
          ...e,
          audioOffsetMs: n.audioOffsetMs,
          updatedAt: n.updatedAt
        } : e)
      }));
    } catch (e) {
      console.warn(`Could not persist audio offset`, e);
    }
  },
  setAudioOutputDevice: async n => {
    let r = n === "default" ? `` : n;
    try {
      await backingEngine.setOutputDevice(r), t().updateSettings({
        audioOutputDeviceId: r
      });
    } catch (n) {
      let r = t().settings.language === `zh-CN`,
        i = n instanceof Error ? n.message : String(n),
        a = n instanceof DOMException && n.name === `NotAllowedError`,
        o = n instanceof DOMException && n.name === `NotFoundError`;
      e({
        loadError: i === `AUDIO_OUTPUT_SELECTION_UNSUPPORTED` ? r ? `当前 Electron/Chromium 环境不支持指定音频输出设备。` : `This Electron/Chromium build cannot select a specific audio output device.` : a ? r ? `还没有获得这个音频输出设备的权限。请点“选择设备…”并选择 P-Series / 目标扬声器。` : `This output is not permitted yet. Click “Choose Device…” and select P-Series or the desired speaker.` : o ? r ? `这个音频输出设备当前不可用，请重新选择。` : `That audio output is no longer available. Choose another device.` : i
      });
    }
  },
  clearLoadError: () => e({
    loadError: null
  }),
  syncEngineState: () => {
    let t = syncEngine.state;
    e({
      demo: t.demo,
      demoHands: t.demoHands,
      practiceMode: t.practiceMode,
      stablePasses: t.stablePasses,
      countingIn: t.countingIn,
      status: t.status,
      currentSeconds: t.currentSeconds,
      tempoMultiplier: t.tempoMultiplier,
      loopStart: t.loopStart,
      loopEnd: t.loopEnd,
      waitMode: t.waitMode
    });
  }
}));
function parseMidiWorker(e, t, n) {
  return new Promise((r, i) => {
    let a = new Worker(new URL("./workers/midi.worker.ts", import.meta.url), {
        type: `module`
      }),
      o = setTimeout(() => {
        a.terminate(), i(Error(`MIDI parsing timed out`));
      }, 3e4);
    a.onmessage = e => {
      clearTimeout(o), a.terminate(), e.data.ok ? r(e.data.doc) : i(Error(e.data.error));
    }, a.onerror = e => {
      clearTimeout(o), a.terminate(), i(e);
    }, a.postMessage({
      buffer: e,
      id: t,
      title: n
    }, [e]);
  });
}
function safeFilename(e) {
  return e.replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, `_`).slice(0, 200) || `untitled`;
}
function bytesToBase64(e) {
  let t = e instanceof Uint8Array ? e : new Uint8Array(e),
    n = 32768,
    r = ``;
  for (let e = 0; e < t.length; e += n) r += String.fromCharCode.apply(null, Array.from(t.subarray(e, e + n)));
  return btoa(r);
}
function downloadBlob(e, t) {
  let n = URL.createObjectURL(e),
    r = document.createElement(`a`);
  r.href = n, r.download = t, document.body.appendChild(r), r.click(), document.body.removeChild(r), setTimeout(() => URL.revokeObjectURL(n), 1e3);
}
var STEP_SEMITONES = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};
function musicXmlPitch(e, t, n) {
  return (t + 1) * 12 + (STEP_SEMITONES[e] ?? 0) + Math.round(n);
}
var CIRCLED_FINGERS = {
  "①": `1`,
  "②": `2`,
  "③": `3`,
  "④": `4`,
  "⑤": `5`
};
function applyMusicXmlFingerings(e, t) {
  let n = new DOMParser().parseFromString(t, `application/xml`),
    r = {
      left: [],
      right: []
    },
    i = Array.from(n.querySelectorAll(`part`));
  for (let e of i) {
    let t = Array.from(e.querySelectorAll(`note`)),
      n = false,
      i = 0,
      a = 0;
    for (let e of t) {
      if (e.querySelector(`rest`)) continue;
      e.querySelector(`staff`) && (n = true);
      let t = e.querySelector(`pitch > step`)?.textContent ?? ``,
        r = Number(e.querySelector(`pitch > octave`)?.textContent ?? 0),
        o = Number(e.querySelector(`pitch > alter`)?.textContent ?? 0);
      t && (i += musicXmlPitch(t, r, o), a++);
    }
    let o = (a > 0 ? i / a : 60) >= 60 ? `right` : `left`;
    for (let e of t) {
      if (e.querySelector(`rest`)) continue;
      let t = o;
      n && (t = Number(e.querySelector(`staff`)?.textContent ?? 1) === 2 ? `left` : `right`);
      let i = (e.querySelector(`notations technical fingering`) ?? e.querySelector(`notations fingering`))?.textContent?.trim() ?? ``,
        a = CIRCLED_FINGERS[i] ?? i,
        s = /^[1-5]$/.test(a) ? Number(a) : null;
      r[t].push(s);
    }
  }
  let a = {
    left: [],
    right: [],
    unknown: []
  };
  e.forEach((e, t) => a[e.hand].push(t));
  let o = e.map(e => ({
    ...e
  }));
  for (let e of [`left`, `right`]) {
    let t = a[e],
      n = r[e],
      i = Math.min(t.length, n.length);
    for (let e = 0; e < i; e++) o[t[e]] = {
      ...o[t[e]],
      finger: n[e]
    };
  }
  return o;
}
async function requestFingering(e, t, n) {
  let r = new Blob([e], {
      type: `audio/midi`
    }),
    i = new FormData();
  i.append(`file`, r, `track.mid`);
  let a = encodeURIComponent(t.title ?? ``),
    o = await fetch(`/api/transcribe/midi2musicxml?title=${a}`, {
      method: `POST`,
      body: i
    });
  if (!o.ok) return;
  let {
    musicxml: s
  } = await o.json();
  t.musicXml = s;
  let {
    document: c
  } = useAppStore.getState();
  c?.id === t.id && useAppStore.setState({
    document: {
      ...t
    }
  });
}
var practiceSaveTimer = 0;
var practiceRestoreBusy = false;
function schedulePracticeSave(e) {
  if (!(!e.currentSongId || !e.document || e.isLoadingDocument)) try {
    savePracticeContext(e.currentSongId, {
      version: 1,
      positionSeconds: e.currentSeconds,
      tempoMultiplier: e.tempoMultiplier,
      loopStart: e.loopStart,
      loopEnd: e.loopEnd,
      mode: e.practiceMode,
      practiceHand: syncEngine.state.practiceHand,
      waitMode: e.waitMode
    }), practiceSaveTimer = Date.now();
  } catch {
    practiceRestoreBusy || (practiceRestoreBusy = true, queueMicrotask(() => useAppStore.setState({
      loadError: `无法保存练习位置 / Could not save practice context.`
    })));
  }
}
useAppStore.subscribe((e, t) => {
  if (e.currentSongId !== t.currentSongId || e.isLoadingDocument && !t.isLoadingDocument) {
    e.currentSongId !== null && schedulePracticeSave(t);
    return;
  }
  e.isLoadingDocument || (e.status !== t.status || e.tempoMultiplier !== t.tempoMultiplier || e.loopStart !== t.loopStart || e.loopEnd !== t.loopEnd || e.practiceMode !== t.practiceMode || e.waitMode !== t.waitMode || e.settings.waitForHand !== t.settings.waitForHand || t.isLoadingDocument || e.status !== `playing` && e.currentSeconds !== t.currentSeconds || Date.now() - practiceSaveTimer > 12e3) && schedulePracticeSave(e);
}), bus.on(`transport:seek`, ({
  seconds: e
}) => schedulePracticeSave({
  ...useAppStore.getState(),
  currentSeconds: e
})), typeof window < `u` && window.addEventListener && (window.addEventListener(`pagehide`, () => schedulePracticeSave(useAppStore.getState())), window.addEventListener(`beforeunload`, () => schedulePracticeSave(useAppStore.getState())));
function translate(e, t, n) {
  return e === `zh-CN` ? t : n;
}
function useI18n() {
  let e = useAppStore(e => e.settings.language);
  return {
    language: e,
    isZh: e === `zh-CN`,
    tr: (t, n) => translate(e, t, n)
  };
}
function translateFeedback(e, t) {
  return !e || t === `zh-CN` ? e : e === `准时` ? `On time` : e === `时值合适` ? `Release OK` : e.startsWith(`按对了 · `) ? e.replace(`按对了 · `, `Correct · `).replace(` · 指法 `, ` · Finger `) : e.startsWith(`错音 · `) ? e.replace(`错音 · `, `Wrong note · `).replace(`，请看目标键`, `, check the target key`) : e.startsWith(`漏音 · `) ? e.replace(`漏音 · `, `Missed · `) : e.startsWith(`稍早 `) ? e.replace(`稍早 `, `Early `) : e.startsWith(`稍晚 `) ? e.replace(`稍晚 `, `Late `) : e.startsWith(`松早 `) ? e.replace(`松早 `, `Released early `) : e.startsWith(`松晚 `) ? e.replace(`松晚 `, `Released late `) : e;
}
var quickScoreModule = {
  quickToXml: quickToXml
};
var escapeXml = e => e.replace(/[<>&"']/g, e => ({
  "<": `&lt;`,
  ">": `&gt;`,
  "&": `&amp;`,
  '"': `&quot;`,
  "'": `&apos;`
})[e]);
function quickToXml(e) {
  let t = e;
  if (!t || t.schema !== 1 || ![`Quick`, `Clean`].includes(t.quality) || typeof t.title != `string` || t.title.length > 200 || !Number.isFinite(t.bpm) || t.bpm < 20 || t.bpm > 300 || !Number.isInteger(t.fifths) || Math.abs(t.fifths) > 7 || !Array.isArray(t.measures) || !t.measures.length || t.measures.length > 2e3) throw Error(`Invalid Quick score header`);
  if (t.beatType !== void 0 && ![1, 2, 4, 8, 16].includes(t.beatType)) throw Error(`Invalid beatType`);
  let n = e => e.beats * 4 / (e.beatType ?? t.beatType ?? 4),
    r = 0;
  for (let e of t.measures) {
    if (e.beatType !== void 0 && ![1, 2, 4, 8, 16].includes(e.beatType)) throw Error(`Invalid beatType`);
    if (!Number.isInteger(e.beats) || e.beats < 1 || e.beats > 16 || !Array.isArray(e.notes)) throw Error(`Invalid measure`);
    if (e.fifths !== void 0 && (!Number.isInteger(e.fifths) || Math.abs(e.fifths) > 7)) throw Error(`Invalid measure key`);
    if (e.bpm !== void 0 && (!Number.isFinite(e.bpm) || e.bpm < 20 || e.bpm > 300)) throw Error(`Invalid measure tempo`);
    for (let t of e.notes) if (r++, !Number.isInteger(t.midi) || t.midi < 21 || t.midi > 108 || !Number.isFinite(t.beat) || !Number.isFinite(t.duration) || t.beat < 0 || t.duration <= 0 || t.beat + t.duration > n(e) + 1e-6 || ![`left`, `right`].includes(t.hand) || t.finger !== void 0 && (!Number.isInteger(t.finger) || t.finger < 1 || t.finger > 5) || Math.abs(t.beat * 480 - Math.round(t.beat * 480)) > 1e-4 || Math.abs(t.duration * 480 - Math.round(t.duration * 480)) > 1e-4) throw Error(`Invalid note position, duration, pitch, hand or finger`);
  }
  if (!r || r > 1e5) throw Error(`Invalid note count`);
  let i = [`C`, `C`, `D`, `D`, `E`, `F`, `F`, `G`, `G`, `A`, `A`, `B`],
    a = [1, 3, 6, 8, 10],
    o = t.measures.map((e, n) => {
      let r = t.fifths,
        i = !!t.minor;
      for (let e = 0; e <= n; e++) r = t.measures[e].fifths ?? r, i = t.measures[e].minor ?? i;
      return {
        fifths: r,
        minor: i
      };
    }),
    s = (e, r) => `<part id="${r}">${t.measures.map((r, s) => {
      let c = r.notes.filter(t => t.hand === e).sort((e, t) => e.beat - t.beat || e.midi - t.midi).map((e, t) => {
        let o = Math.round(e.beat * 480),
          s = Math.round(e.duration * 480),
          c = n(r) * 480 - o - s;
        return `${t ? `<backup><duration>${n(r) * 480}</duration></backup>` : ``}${o ? `<forward><duration>${o}</duration></forward>` : ``}<note><pitch><step>${i[e.midi % 12]}</step>${a.includes(e.midi % 12) ? `<alter>1</alter>` : ``}<octave>${Math.floor(e.midi / 12) - 1}</octave></pitch><duration>${s}</duration><voice>${t + 1}</voice>${e.finger ? `<notations><technical><fingering>${e.finger}</fingering></technical></notations>` : ``}</note>${c ? `<forward><duration>${c}</duration></forward>` : ``}`;
      }).join(``);
      return `<measure number="${s + 1}"><attributes><divisions>480</divisions><key><fifths>${o[s].fifths}</fifths><mode>${o[s].minor ? `minor` : `major`}</mode></key><time><beats>${r.beats}</beats><beat-type>${r.beatType ?? t.beatType ?? 4}</beat-type></time><clef><sign>${e === `right` ? `G` : `F`}</sign><line>${e === `right` ? 2 : 4}</line></clef></attributes>${s === 0 || r.bpm !== void 0 ? `<direction><sound tempo="${r.bpm ?? t.bpm}"/></direction>` : ``}${c || `<note><rest measure="yes"/><duration>${n(r) * 480}</duration></note>`}</measure>`;
    }).join(``)}</part>`;
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escapeXml(t.title)}</work-title></work><identification><creator type="composer">${escapeXml(t.composer || ``)}</creator><miscellaneous><miscellaneous-field name="quality">${t.quality}</miscellaneous-field><miscellaneous-field name="piano-practice-quick">${escapeXml(JSON.stringify(t))}</miscellaneous-field></miscellaneous></identification><part-list><score-part id="R"><part-name>Right</part-name></score-part><score-part id="L"><part-name>Left</part-name></score-part></part-list>${s(`right`, `R`)}${s(`left`, `L`)}</score-partwise>`;
}
const pianoSampledPlayback = installSampledPiano({
  audio: syncEngine.audio,
  context: () => getTransport().context.rawContext,
  wake: startAudio,
  onStatus: s => useAppStore.setState({
    pianoSampleStatus: s
  })
});
syncEngine.audio.setPianoSettings(useAppStore.getState().settings);
const pianoPedalPlayback = installPedalPlayback({
  engine: syncEngine,
  transport: getTransport
});
export { LIBRARY_DB_NAME, LIBRARY_DB_VERSION, SONGS_STORE, ASSETS_STORE, LAST_SONG_KEY, songMutations, libraryMutationQueue, serializeLibraryMutation, serializeSongMutation, DEFAULT_MIXER, clampVolume, normalizeMixer, assetKey, hashText, openLibraryDB, requestResult, transactionDone, withSongs, normalizeSong, songSummary, listSongs, getSong, getSongByHash, saveSong, markSongOpened, renameSong, removeSong, restoreLibrarySong, replaceSongScore, readSongAudio, attachSongAudio, detachSongAudio, updateSongMix, requestPersistentStorage, isQuotaError, readLastSongId, writeLastSongId, listArchivedSongs, BACKING_DRIFT_THRESHOLD, backingEngine, CUSTOM_COLOR_PRESETS, SETTINGS_KEY, LEGACY_THEME_KEY, DEFAULT_SETTINGS, freshSettings, serializeSettings, saveSettings, loadSettings, INITIAL_SETTINGS, midiInputDevice, documentLoadGeneration, currentLibraryLoad, useAppStore, parseMidiWorker, safeFilename, bytesToBase64, downloadBlob, STEP_SEMITONES, musicXmlPitch, CIRCLED_FINGERS, applyMusicXmlFingerings, requestFingering, practiceSaveTimer, practiceRestoreBusy, schedulePracticeSave, translate, useI18n, translateFeedback, quickScoreModule, escapeXml, quickToXml, pianoSampledPlayback, pianoPedalPlayback };
