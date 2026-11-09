import {generateWithNoteMetadata} from '../notation/musicxml-metadata.mjs';
import {sustainRangesFromMidi,sustainRangesFromMusicXml} from '../runtime/pedal-playback.mjs';
import {applyMusicXmlVelocities} from '../runtime/musicxml-expression.mjs';
import { importer, midi as alphaMidi, Settings } from "@coderline/alphatab";
import { Midi } from "@tonejs/midi";
import { midiToPitch } from "@bach-to-basics/shared";
import type { MusicDocument, NoteEvent, Finger } from "@bach-to-basics/shared";

/** Reuse AlphaTab's score importer AND MIDI generator. No second MusicXML parser. */
export function localMusicXml(xml: string, id: string, title: string): MusicDocument {
  const settings = new Settings();
  const score = importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml), settings);
  const file = new alphaMidi.MidiFile();
  file.format = alphaMidi.MidiFileFormat.MultiTrack;
  const handler = new alphaMidi.AlphaSynthMidiFileHandler(file, true);
  const generator = new alphaMidi.MidiFileGenerator(score, settings, handler);
  const metadata = generateWithNoteMetadata(score,generator,handler);
  const bytes = file.toBinary();
  const parsed = new Midi(bytes);
  let serial = 0;
  const notes: NoteEvent[] = [];
  for (const track of parsed.tracks)
    for (const n of track.notes) {
      const meta = metadata.take(n.midi,n.ticks,track.channel);
      const duration = meta?.duration ?? n.durationTicks;
      notes.push({
        id: `n${serial++}`,
        midi: n.midi,
        pitch: midiToPitch(n.midi),
        startTick: n.ticks,
        durationTick: duration,
        startSeconds: n.time,
        endSeconds: parsed.header.ticksToSeconds(n.ticks + duration),
        hand: meta?.hand ?? "unknown",
        finger: meta?.finger ?? null,
        velocity: Math.round(n.velocity * 127),
        channel: track.channel,
      });
    }
  applyMusicXmlVelocities(xml,notes,generator.tickLookup.masterBars,parsed.header.ppq,(tick:number)=>parsed.header.ticksToSeconds(tick));
  notes.sort((a, b) => a.startSeconds - b.startSeconds);
  if (!notes.length) throw new Error("PRACTICE_NO_NOTES");
  const end=Math.max(parsed.duration,...generator.tickLookup.masterBars.map(b=>parsed.header.ticksToSeconds(b.end)));
  let sustainRanges=sustainRangesFromMusicXml(xml,generator.tickLookup.masterBars,parsed.header.ppq,(tick:number)=>parsed.header.ticksToSeconds(tick),end);
  if(!sustainRanges.length)sustainRanges=sustainRangesFromMidi(parsed.tracks,end);
  return {
    sustainRanges,
    id,
    title,
    sourceType: "musicxml",
    musicXml: xml,
    midiBuffer: bytes.slice().buffer as ArrayBuffer,
    notes,
    measures: generator.tickLookup.masterBars.map((bar, index) => {
      const beatTicks = parsed.header.ppq * 4 / bar.masterBar.timeSignatureDenominator;
      const beatSeconds: number[] = [];
      for (let tick = bar.start; tick < bar.end; tick += beatTicks) beatSeconds.push(parsed.header.ticksToSeconds(tick));
      return { index, displayNumber: String(bar.masterBar.index + 1), startTick: bar.start, endTick: bar.end,
        startSeconds: parsed.header.ticksToSeconds(bar.start), endSeconds: parsed.header.ticksToSeconds(bar.end), beatSeconds };
    }),
    tempoMap: parsed.header.tempos.length
      ? parsed.header.tempos.map((t) => ({ tick: t.ticks, bpm: t.bpm }))
      : [{ tick: 0, bpm: 120 }],
    timeSignatures: parsed.header.timeSignatures.length
      ? parsed.header.timeSignatures.map((t) => ({
          tick: t.ticks,
          numerator: t.timeSignature[0],
          denominator: t.timeSignature[1],
        }))
      : [{ tick: 0, numerator: 4, denominator: 4 }],
    totalDuration: Math.max(...notes.map((n) => n.endSeconds), parsed.duration, ...generator.tickLookup.masterBars.map(b => parsed.header.ticksToSeconds(b.end))),
    ppq: parsed.header.ppq,
    numberKeys: generator.tickLookup.masterBars.map(b => ({ tick: b.start, fifths: Number(b.masterBar.keySignature), minor: Number(b.masterBar.keySignatureType) === 1 })),
    keySignature: null,
    youtubeId: null,
    youtubeSyncOffset: 0,
    fingeringVersion: notes.some((n) => n.finger !== null) ? "manual" : "none",
  };
}
