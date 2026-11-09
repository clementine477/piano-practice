import React from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import './notation/pro-workspace.css';
import {App} from './practice-app.js';
import {useAppStore,pianoPedalPlayback,pianoSampledPlayback} from './library-store.js';
import {syncEngine,judge,bus} from './engine.js';
createRoot(document.getElementById('root')).render(<App/>);
// Native regression tests opt in through an isolated, hidden app window.
if (new URLSearchParams(location.search).get('smoke') === '1') {
  globalThis.qa = {useAppStore,pianoPedalPlayback,pianoSampledPlayback,syncEngine,judge,bus};
}
