# Contributing

Describe what you expected, what happened, your app version and macOS version. Use a minimal score you are allowed to share; do not attach private scores, profile folders, MIDI device identifiers or account information.

Keep the interface small. Prefer removing a redundant control over adding another mode. Changes to scheduling should preserve the audio clock as the timing source; rendering must not drive sound playback. Pause, seek, loop, timbre switch and score replacement must release previous audio and cancel stale work.

Run `pnpm test` and `pnpm build` for every code change. Use `pnpm smoke` on macOS for playback/import/view changes, then inspect the actual app. Add targeted regression coverage when fixing a real bug. Do not replace listening and visual checks with snapshots of implementation details.

Use `tests/fixtures` for small original or explicitly redistributable inputs. Never commit the generated `dist`, application profiles, caches, unreviewed arrangements or large sample files. Existing `examples/` are an explicit exception with separate work-rights notices. Sample manifests and license notices belong in `assets` and `licenses`; binaries belong in Releases.

Preserve upstream copyright and third-party licenses. Changing alphaTab requires updating its preferred source in `third_party/alphatab`, the patch, and the exact-version build adapter. Review the source hash when upgrading.
