# alphaTab adaptations

Upstream: https://github.com/CoderLine/alphaTab/tree/v1.8.3
Commit: `9d0142eee2b1175dfd36e839ddbd867aed9e454e`
License: MPL-2.0, Daniel Kuschny and contributors.

The `src/` files are the preferred TypeScript form of the changed upstream files. Apply `piano-practice.patch` to that upstream commit for the complete source tree. The protocol type change has no JavaScript output.

Changes: keep hidden MusicXML tempo events for playback without engraving them; round visible tempo labels; tag worker render replies with a score generation and reject obsolete replies.

The application build uses the pinned npm release and `tools/patch-alphatab.py`, which applies equivalent JavaScript changes and checks the exact upstream SHA-256. Both the readable source changes and the build adapter are supplied under MPL-2.0. All other upstream files are unmodified.
