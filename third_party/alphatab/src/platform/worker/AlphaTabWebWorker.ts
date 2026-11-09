// SPDX-License-Identifier: MPL-2.0
// Modified for Piano Practice; see third_party/alphatab/README.md.
import { Environment } from '@coderline/alphatab/Environment';
import { SettingsSerializer } from '@coderline/alphatab/generated/SettingsSerializer';
import { Logger } from '@coderline/alphatab/Logger';
import { JsonConverter } from '@coderline/alphatab/model/JsonConverter';
import type { Score } from '@coderline/alphatab/model/Score';
import { type FontSizeDefinition, FontSizes } from '@coderline/alphatab/platform/svg/FontSizes';
import type {
    IAlphaTabWorkerGlobalScope,
    IAlphaTabWorkerMessage
} from '@coderline/alphatab/platform/worker/AlphaTabWorkerProtocol';
import type { RenderHints } from '@coderline/alphatab/rendering/IScoreRenderer';
import { ScoreRenderer } from '@coderline/alphatab/rendering/ScoreRenderer';
import type { Settings } from '@coderline/alphatab/Settings';

/**
 * @internal
 * @partial
 */
export class AlphaTabWebWorker {
    private _scoreGeneration = 0;
    private _renderer!: ScoreRenderer;
    private _main: IAlphaTabWorkerGlobalScope<IAlphaTabWorkerMessage>;

    private _postResult(data: IAlphaTabWorkerMessage): void {
        this._main.postMessage({...data, scoreGeneration: this._scoreGeneration});
    }

    public constructor(main: IAlphaTabWorkerGlobalScope<IAlphaTabWorkerMessage>) {
        this._main = main;
        main.addEventListener('message', e => this._handleMessage(e));
    }

    public static init(): void {
        new AlphaTabWebWorker(Environment.getGlobalWorkerScope<IAlphaTabWorkerMessage>());
    }

    private _handleMessage(e: MessageEvent<IAlphaTabWorkerMessage>): void {
        const data = e.data;
        if (!data?.cmd) {
            return;
        }
        switch (data.cmd) {
            case 'alphaTab.initialize':
                const settings: Settings = JsonConverter.jsObjectToSettings(data.settings);
                Logger.logLevel = settings.core.logLevel;
                this._renderer = new ScoreRenderer(settings);
                this._renderer.partialRenderFinished.on(result => {
                    this._postResult({
                        cmd: 'alphaTab.partialRenderFinished',
                        result: result
                    });
                });
                this._renderer.partialLayoutFinished.on(result => {
                    this._postResult({
                        cmd: 'alphaTab.partialLayoutFinished',
                        result: result
                    });
                });
                this._renderer.renderFinished.on(result => {
                    this._postResult({
                        cmd: 'alphaTab.renderFinished',
                        result: result
                    });
                });
                this._renderer.postRenderFinished.on(() => {
                    this._postResult({
                        cmd: 'alphaTab.postRenderFinished',
                        boundsLookup: this._renderer.boundsLookup?.toJson() ?? null
                    });
                });
                this._renderer.preRender.on(resize => {
                    this._postResult({
                        cmd: 'alphaTab.preRender',
                        resize: resize
                    });
                });
                this._renderer.error.on(this._error.bind(this));
                break;
            case 'alphaTab.render':
                this._renderer.render(data.renderHints);
                break;
            case 'alphaTab.resizeRender':
                this._renderer.resizeRender();
                break;
            case 'alphaTab.renderResult':
                this._renderer.renderResult(data.resultId);
                break;
            case 'alphaTab.setWidth':
                this._renderer.width = data.width;
                break;
            case 'alphaTab.renderScore':
                this._scoreGeneration = data.scoreGeneration ?? 0;
                this._updateFontSizes(data.fontSizes);
                const renderHints = data.renderHints;
                const score =
                    data.score == null ? null : JsonConverter.jsObjectToScore(data.score, this._renderer.settings);
                this._renderMultiple(score, data.trackIndexes, renderHints);
                break;
            case 'alphaTab.updateSettings':
                this._updateSettings(data.settings);
                break;
        }
    }

    private _updateFontSizes(fontSizes: Map<string, FontSizeDefinition>): void {
        for (const [k, v] of fontSizes) {
            FontSizes.fontSizeLookupTables.set(k, v);
        }
    }

    private _updateSettings(json: unknown): void {
        SettingsSerializer.fromJson(this._renderer.settings, json);
    }

    private _renderMultiple(score: Score | null, trackIndexes: number[] | null, renderHints?: RenderHints): void {
        try {
            this._renderer.renderScore(score, trackIndexes, renderHints);
        } catch (e) {
            this._error(e as Error);
        }
    }

    private _error(error: Error): void {
        Logger.error('Worker', 'An unexpected error occurred in worker', error);
        this._postResult({
            cmd: 'alphaTab.error',
            error: error
        });
    }
}
