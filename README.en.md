# Piano Practice

Local piano practice with your own scores, MIDI input, notation and falling notes.

[中文](README.md) · [Preview downloads](https://github.com/clementine477/piano-practice/releases) · [Licenses](docs/THIRD_PARTY.md)

- Import your own scores and course exercise files (MusicXML, MXL, MIDI or Quick JSON) into a local library.
- Switch between staff and numbered notation; falling notes, pedal cues and an 88-key keyboard.
- Separate demonstration and practice hands, guided sections, wait-for-input, tempo and loop controls.
- Four recorded piano banks, adjustable brightness, ambience and tuning; recorded woodblock metronome.
- Chinese and English UI. No account or backend required for normal practice.

No courses or personal practice records are bundled. Optional [Day One / Are You Lost examples](examples/README.md) are separate imports with their own work rights; the software MIT license does not cover them. Import other material you have permission to use. The short score under `tests/fixtures` is an original regression fixture, not a bundled course.

## macOS preview

Apple Silicon is the tested target. Download the application ZIP from Releases, unzip and move the app to Applications. This preview is ad-hoc signed and is **not Apple-notarized**; macOS may require allowing it in System Settings → Privacy & Security. Do not disable system security.

The initial library is empty. Import a score, choose a MIDI device or use the on-screen keyboard. The download includes all four piano banks. Hardware MIDI compatibility and large-score performance still need wider testing. Windows/Linux packages are not available. PDF recognition, audio transcription and automatic fingering services are outside this release.

## Develop

Use Node.js 24, pnpm 11.25.0 and Python 3. Packaging requires macOS command-line developer tools.

```sh
pnpm install --frozen-lockfile
pnpm samples
pnpm desktop
```

The roughly 255 MB sample packs are separate Release assets. Downloads and extracted files are SHA-256 verified. Offline installation: `python3 tools/fetch-samples.py --from-dir /path/to/sample-zips`.

```sh
pnpm dev             # browser development
pnpm test            # runtime and desktop unit regression checks
pnpm build           # production frontend
pnpm smoke           # isolated hidden Electron window; no personal profile
pnpm check:public    # publication exclusions and sample verification
pnpm package:mac     # local signed macOS app
```

Library, audio, preferences and practice position/tempo/loop settings stay in the local application data directory. Note-by-note attempts and statistics are session-only: export before closing. A persistent practice-history timeline is not implemented yet. No telemetry, cloud sync, accounts or ads are included. Updates are manual. Back up original scores and application data before migration; a complete library migration wizard is not provided yet.

## License and provenance

Based on [gigliof/bach-to-basics](https://github.com/gigliof/bach-to-basics), retaining the original MIT license and credit. Application code is MIT. Modified alphaTab files are MPL-2.0, and recordings/fonts/dependencies retain their own licenses. See [third-party notices](docs/THIRD_PARTY.md).

Some application modules were recovered into readable, buildable JavaScript from the shipped version to preserve its playback fixes; the original TypeScript has not been fully recovered. See [provenance and architecture](docs/PROVENANCE.md). This is an early **0.7.0-preview.1** release, not a production stability guarantee.

See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and bug reports.
