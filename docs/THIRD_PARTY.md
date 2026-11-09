# Third-party software and recordings

The application license does not replace the licenses of these components. Full notices are under `licenses/` and are included in the macOS application resources. npm versions are pinned by `pnpm-lock.yaml`.

| Component | License / permission | Source and use |
| --- | --- | --- |
| Bach to Basics | MIT, gigliof | https://github.com/gigliof/bach-to-basics — application foundation |
| alphaTab 1.8.3 | MPL-2.0 | https://github.com/CoderLine/alphaTab/tree/v1.8.3 — notation/import, modified sources in `third_party/alphatab` |
| Bravura | SIL Open Font License | Bundled by alphaTab; original notice in `licenses/Bravura-OFL.txt` |
| SONiVOX | Apache-2.0 | alphaTab's soundfont, used for its internal muted playback clock; not a marketed piano bank |
| Kawai Upright | CC0 | https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html — extracted/rendered to Ogg, three velocity layers |
| Yamaha YDP Grand | CC BY 3.0 | Same FreePats page; Zenph Studios / Mikhail Krishtal / Roberto; converted to Ogg |
| Salamander Grand V3 | CC BY 3.0 | https://github.com/sfzinstruments/SalamanderGrandPiano — Alexander Holm; retuning Markus Fiedler; remapping kinwie; converted to Ogg with start offsets/retuning retained |
| Iowa Steinway Model B | Iowa MIS usage permission | https://theremin.music.uiowa.edu/MIS.html — University of Iowa Electronic Music Studios, Evan Mazunik, November 2001; processed for local playback; derived missing keys documented in its manifest |
| VCSL woodblock | CC0 | https://github.com/sgossner/VCSL — sampled metronome; provenance in `frontend/public/samples/metronome/SOURCE.json` |

Iowa's page permits downloading and use in projects without restrictions. It is not described here as CC0 or public domain. Instrument names identify the recorded instruments, not sponsorship or endorsement.

The four piano banks are distributed separately as checksummed Release ZIPs and bundled with the preview application. Their individual notices describe conversions and attribution. GeneralUser GS is not included in this release.

`licenses/npm/` includes installed production dependency license texts and a machine-readable inventory, generated with `pnpm licenses`. Electron's own LICENSE and Chromium third-party notices are distributed with its runtime. Development tools are specified in the lockfile and are not bundled into application JavaScript merely by being installed.

Modified alphaTab files and the build adapter remain MPL-2.0. Apply `third_party/alphatab/piano-practice.patch` to upstream commit `9d0142eee2b1175dfd36e839ddbd867aed9e454e` for the corresponding preferred source. Other application files remain MIT.

Two optional study scores are documented in [examples/README.md](../examples/README.md). Their composition and arrangement rights are not covered by the MIT license. They are separate from the application and the piano sample banks.
