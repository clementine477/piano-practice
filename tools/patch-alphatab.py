# SPDX-License-Identifier: MPL-2.0
# alphaTab 1.8.3 adaptations. Original copyright: Daniel Kuschny and contributors.
# See licenses/alphatab and docs/THIRD_PARTY.md.
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'frontend/node_modules/@coderline/alphatab/dist'
DIST=ROOT/'frontend/public'
def replace(text, old, new):
    assert text.count(old)==1, (old[:120], text.count(old))
    return text.replace(old,new)

def isolate_score_results(text):
    # alphaTab 1.8.3's worker replies have no score identity. A late result for
    # A was decoded against api.score B, corrupting bounds or throwing on its
    # different voices. Tag results at their producer and reject stale replies
    # before they can modify DOM, bounds, or render-completion state.
    start=text.index('//#region src/platform/worker/AlphaTabWorkerScoreRenderer.ts')
    end=text.index('//#endregion',start)
    section=text[start:end]
    section=replace(section,'boundsLookup = null;', '_scoreGeneration = 0;\n\tboundsLookup = null;')
    section=replace(section,'const data = e.data;',
        'const data = e.data;\n\t\tif (data.scoreGeneration !== this._scoreGeneration) return;')
    section=replace(section,'renderScore(score, trackIndexes, renderHints) {',
        'renderScore(score, trackIndexes, renderHints) {\n\t\tthis._scoreGeneration++;')
    section=replace(section,'cmd: "alphaTab.renderScore",',
        'cmd: "alphaTab.renderScore",\n\t\t\tscoreGeneration: this._scoreGeneration,')
    text=text[:start]+section+text[end:]
    start=text.index('//#region src/platform/worker/AlphaTabWebWorker.ts')
    end=text.index('//#endregion',start)
    section=text[start:end]
    section=replace(section,'_renderer;', '_scoreGeneration = 0;\n\t_renderer;')
    section=replace(section,'case "alphaTab.renderScore":',
        'case "alphaTab.renderScore":\n\t\t\t\tthis._scoreGeneration = data.scoreGeneration;')
    assert section.count('this._main.postMessage({')==6
    section=section.replace('this._main.postMessage({','this._postResult({')
    section=replace(section,'_main;',
        '_main;\n\t_postResult(data) { this._main.postMessage({...data, scoreGeneration: this._scoreGeneration}); }')
    return text[:start]+section+text[end:]

core=(BASE/'alphaTab.core.mjs').read_text()
assert hashlib.sha256(core.encode()).hexdigest()=='02254ee42c12cc70ddf009f44839630231754ce967059dae881e8729dd41e801'
# MusicXML print-object hides engraving only. Keep every tempo automation for
# MIDI generation and cursor timing. Also read the legacy parent attribute used
# by previously imported arrangements, so existing library entries need no reset.
core=replace(core,
    '\t\t\ttempoAutomation.value = tempo;\n\t\t\ttempoAutomation.ratioPosition = getRatioPosition();',
    '\t\t\ttempoAutomation.value = tempo;\n'
    '\t\t\ttempoAutomation.isVisible = element.getAttribute("print-object", "yes") !== "no" && directionTypes.some(type => type.localName === "metronome" && type.getAttribute("print-object", "yes") !== "no");\n'
    '\t\t\ttempoAutomation.ratioPosition = getRatioPosition();')
core=replace(core,
    'this._parseMetronome(direction, masterBar, getRatioPosition());',
    'this._parseMetronome(direction, masterBar, getRatioPosition(), element.getAttribute("print-object", "yes") !== "no");')
core=replace(core,
    '_parseMetronome(element, masterBar, ratioPosition) {',
    '_parseMetronome(element, masterBar, ratioPosition, parentVisible = true) {')
core=replace(core,
    '\t\t\ttempoAutomation.value = perMinute * (unit / 4);',
    '\t\t\ttempoAutomation.value = perMinute * (unit / 4);\n'
    '\t\t\ttempoAutomation.isVisible = parentVisible && element.getAttribute("print-object", "yes") !== "no";')
core=replace(core,
    'if (tempoAutomation.ratioPosition === existing.ratioPosition && tempoAutomation.value === existing.value) return true;',
    'if (tempoAutomation.ratioPosition === existing.ratioPosition && tempoAutomation.value === existing.value) { existing.isVisible ||= tempoAutomation.isVisible; return true; }')
assert core.count('${automation.value.toString()}')==2
core=core.replace('${automation.value.toString()}', '${Number(automation.value.toFixed(1))}')
core=isolate_score_results(core)
(DIST/'alphatab/alphaTab.core.mjs').write_text(core)
# Keep the classic-worker fallback on the same message protocol as ESM.
(DIST/'alphatab/alphaTab.js').write_text(isolate_score_results((BASE/'alphaTab.js').read_text()))

print('alphaTab layout and tempo patches verified.')
