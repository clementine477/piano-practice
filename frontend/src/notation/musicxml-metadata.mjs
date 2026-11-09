/**
 * Preserve a source note's identity while alphaTab emits its MIDI note-on.
 * Version binding: bundled alphaTab 1.8.3 (build 32), checked by patch_import.py.
 * No prototype/global mutation; original own/prototype methods are restored even
 * if generation fails. The serialized MIDI bytes are not modified.
 */
export function generateWithNoteMetadata(score, generator, handler) {
  if (typeof generator._generateNote !== 'function' || typeof handler.addNote !== 'function') {
    throw new Error('PRACTICE_IMPORT_METADATA_UNSUPPORTED');
  }
  const originalGenerateNote = generator._generateNote;
  const originalAddNote = handler.addNote;
  const ownGenerateNote = Object.getOwnPropertyDescriptor(generator, '_generateNote');
  const ownAddNote = Object.getOwnPropertyDescriptor(handler, 'addNote');
  const rows = [];
  let current = null;

  generator._generateNote = function (note, ...args) {
    const previous = current;
    current = {note, beatStart: args[0]};
    try {
      return originalGenerateNote.call(this, note, ...args);
    } finally {
      current = previous;
    }
  };
  handler.addNote = function (track, start, length, key, velocity, channel) {
    // Always forward the original arguments, unchanged, to the MIDI handler.
    const result = originalAddNote.call(this, track, start, length, key, velocity, channel);
    const note = current?.note;
    const staff = note?.beat?.voice?.bar?.staff;
    const sourceTrack = staff?.track;
    const rawFinger = note?.leftHandFinger >= 0 ? note.leftHandFinger + 1
      : note?.rightHandFinger >= 0 ? note.rightHandFinger + 1 : null;
    let duration;
    // Retain the existing app's notated-duration policy, including staccato
    // and tied notes. For expanded ornaments, only a source-pitch onset at the
    // source beat start receives that duration, matching the old join's policy;
    // later/other-pitch emissions retain their generated MIDI duration.
    const isSingleEmission = note && !note.ornament && !note.isTrill
      && !note.beat.isTremolo && !note.beat.hasRasgueado;
    const isSourceOnset = note && Math.abs(start - current.beatStart) < 2
      && key === note.realValue;
    if (isSingleEmission || isSourceOnset) {
      duration = note.beat.playbackDuration;
      let tied = note.tieDestination;
      const visited = new Set();
      while (tied && !visited.has(tied)) {
        visited.add(tied);
        duration += tied.beat.playbackDuration;
        tied = tied.tieDestination;
      }
    }
    rows.push({
      tick: start + (handler.tickShift || 0),
      midi: Math.max(0, Math.min(127, key)),
      channel,
      track,
      staff: staff?.index ?? null,
      voice: note?.beat?.voice?.index ?? null,
      duration,
      generatedDuration: length,
      hand: !sourceTrack ? 'unknown'
        : sourceTrack.staves.length > 1 ? (staff.index === 0 ? 'right' : 'left')
        : score.tracks.length > 1 ? (sourceTrack.index === 0 ? 'right' : 'left')
        : 'unknown',
      finger: rawFinger !== null && rawFinger >= 1 && rawFinger <= 5 ? rawFinger : null,
    });
    return result;
  };
  try {
    generator.generate();
  } finally {
    if (ownGenerateNote) Object.defineProperty(generator, '_generateNote', ownGenerateNote);
    else delete generator._generateNote;
    if (ownAddNote) Object.defineProperty(handler, 'addNote', ownAddNote);
    else delete handler.addNote;
  }
  return createMetadataQueue(rows);
}

/** Pure occurrence queue; each generated note can enrich at most one MIDI note.
 * alphaTab's MidiTrack.addEvent preserves equal-tick note-on insertion order,
 * and the bundled MIDI parser preserves that order per channel. Do not choose
 * a candidate by parsed duration: same-pitch overlapping note-offs can exchange
 * those durations in a MIDI round trip. Retain source onset order instead.
 */
export function createMetadataQueue(rows) {
  const buckets = new Map();
  for (let index = 0; index < rows.length; index++) {
    const row = {...rows[index], index, used: false};
    const key = `${row.channel}:${row.midi}:${Math.floor(row.tick)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return {
    take(midi, tick, channel) {
      const baseTick = Math.floor(tick);
      let chosen;
      for (let delta = -2; delta <= 2; delta++) {
        for (const row of buckets.get(`${channel}:${midi}:${baseTick + delta}`) || []) {
          if (!row.used && Math.abs(row.tick - tick) < 2
            && (!chosen || row.index < chosen.index)) chosen = row;
        }
      }
      if (!chosen) return undefined;
      chosen.used = true;
      return chosen;
    },
    count: rows.length,
  };
}
