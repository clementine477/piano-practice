# Source provenance and maintenance

Piano Practice derives from the MIT-licensed `gigliof/bach-to-basics` project. Its desktop branch accumulated changes through version 0.6.12 while the available original TypeScript lagged behind that shipped behavior.

For this preview, application-owned JavaScript was recovered from that shipped build, formatted, split by dependency and connected to ordinary npm imports. Vendor React, Tone, Pixi, WebMidi and Zustand implementations were excluded from recovered modules. The original MIT attribution is retained. This is not a claim that the entire source is handwritten or has been restored to its original TypeScript form; some local names and compiler-generated expression structure remain.

The public tree builds without the prior app, personal files, patch archives or original machine. Only the pinned alphaTab npm package receives a hash-checked build adaptation. Its preferred modified TypeScript and corresponding patch are distributed under MPL-2.0.

## Main modules

| Location | Responsibility |
| --- | --- |
| `frontend/src/engine.js` | Audio transport, clock, MIDI input, judging and practice state |
| `frontend/src/library-store.js` | Local IndexedDB library, settings, audio attachments and store |
| `frontend/src/practice-panels.js` | Numbered notation, practice sections and feedback |
| `frontend/src/piano-views.js` | Keyboard, falling notes, staff view and visual synchronization |
| `frontend/src/practice-app.js` | Main controls, library, settings and instrument selection |
| `frontend/src/runtime` | Maintained sample player, pedal scheduling, metronome, cursor and resource modules |
| `frontend/src/utils` | MusicXML/MXL import and expression metadata |
| `desktop` | Electron local-origin shell and manual local update support |

No lessons or personal arrangements are included. Section practice, MIDI feedback and report export remain ordinary application features. Legacy server-assisted import methods may remain internally, but no backend or credentials are bundled and these services are not supported in this preview.

## Validation scope

Runtime tests cover pedal cancellation, repeat-note ownership, sample preparation, metronome timing and cursor interpolation. Desktop tests cover local update validation and rollback. Native smoke tests use an original 72-note fixture, four sample banks, audio activity/silence and repeated view changes. These checks do not establish correctness for every MusicXML producer or physical keyboard.

Build output is reproducible from pinned inputs in the practical sense of repeatable source builds; byte-for-byte signed application reproducibility is not claimed. macOS builds are ad-hoc signed, not notarized.
