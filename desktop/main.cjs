const { app, BrowserWindow, protocol, net, session, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// EXPLICIT_USER_DATA_V1: QA profiles are opt-in; normal launches keep their data.
const requestedUserData = app.commandLine.getSwitchValue("user-data-dir");
if (requestedUserData && path.isAbsolute(requestedUserData)) {
  require("node:fs").mkdirSync(requestedUserData, { recursive: true });
  app.setPath("userData", requestedUserData);
}

// Piano Practice is a local desktop music application. Backing/reference audio
// may legitimately begin after an asynchronous Count-in or Wait release, when
// Chromium's transient click activation has already expired. The window is
// locked to our private p225://app origin below, so allow local media playback
// without a fresh gesture instead of producing intermittent NotAllowedError.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "p225",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
const local = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "p225:" && u.host === "app";
  } catch {
    return false;
  }
};
app.whenReady().then(async () => {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, "dist")
    : path.resolve(__dirname, "../frontend/dist");
  protocol.handle("p225", (request) => {
    const url = new URL(request.url);
    if (!local(request.url)) return new Response("Forbidden", { status: 403 });
    const file = path.resolve(
      root,
      "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)
    );
    if (!file.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  const win = new BrowserWindow({
    show: !process.argv.includes("--headless-check"),
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#151820",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
      backgroundThrottling: false,
    },
  });
  // Web MIDI permission handling. Chromium/Electron can ask for either
  // `midi` or `midiSysex`, and some permission checks do not provide every
  // origin/detail field. Authorize only our local app WebContents, but do not
  // require multiple optional origin fields to all be populated.
  const localPermission = (permission) =>
    permission === "midi" || permission === "midiSysex" || permission === "speaker-selection";
  const requestIsLocal = (wc, candidate) => {
    const wcUrl = wc?.getURL?.() ?? "";
    return local(candidate ?? "") || local(wcUrl);
  };
  const appSession = win.webContents.session;
  appSession.setPermissionCheckHandler((wc, permission, requestingOrigin, details = {}) =>
    localPermission(permission) &&
    requestIsLocal(wc, details.requestingUrl ?? requestingOrigin)
  );
  appSession.setPermissionRequestHandler((wc, permission, callback, details = {}) =>
    callback(
      localPermission(permission) &&
      requestIsLocal(wc, details.requestingUrl ?? details.securityOrigin)
    )
  );

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!local(url)) event.preventDefault();
  });
  require("./updates.cjs").installUpdates({ app, ipcMain, win, local });
  await win.loadURL("p225://app/" + (process.argv.includes("--headless-check") ? "?smoke=1" : ""));
  if (process.argv.includes("--audio-gate")) {
    const result = await win.webContents.executeJavaScript(`(async () => {
      try {
        const media = navigator.mediaDevices;
        const outputs = media?.enumerateDevices
          ? (await media.enumerateDevices()).filter(d => d.kind === "audiooutput").map(d => ({deviceId:d.deviceId, label:d.label}))
          : [];
        const probe = document.createElement("audio");
        return {
          secure: isSecureContext,
          setSinkId: typeof probe.setSinkId === "function",
          selectAudioOutput: typeof media?.selectAudioOutput === "function",
          outputs,
          pSeries: outputs.filter(d => /(?:p[- ]?series|p[- ]?22[35]|yamaha)/i.test(d.label || "")),
        };
      } catch(e) { return {error:String(e), outputs:[]}; }
    })()`);
    console.log("PIANO_PRACTICE_AUDIO_GATE", JSON.stringify(result, null, 2));
    app.exit(result.setSinkId && Array.isArray(result.outputs) && result.outputs.length > 0 ? 0 : 1);
    return;
  }
  if (process.argv.includes("--midi-monitor")) {
    console.log("请在接下来的 20 秒内按下、松开琴键，并踩放踏板。");
    const result = await win.webContents.executeJavaScript(`(async () => {
      try {
        const access = await Promise.race([navigator.requestMIDIAccess({sysex:false}), new Promise((_,reject)=>setTimeout(()=>reject(new Error("MIDI timeout")),10000))]);
        const events=[];
        for(const input of access.inputs.values()) input.onmidimessage = e => {
          const [status,note,value]=e.data, kind=status & 240;
          if(events.length<500 && [128,144,176].includes(kind)) events.push({port:input.name, time:Math.round(e.timeStamp), kind:kind===144 && value>0 ? "Note On" : kind===128 || kind===144 ? "Note Off" : "CC", note, value});
        };
        await new Promise(resolve=>setTimeout(resolve,20000));
        return {inputs:[...access.inputs.values()].map(p=>p.name), noteOn:events.filter(e=>e.kind==="Note On").length, noteOff:events.filter(e=>e.kind==="Note Off").length, events};
      } catch(e) { return {error:String(e)}; }
    })()`);
    console.log("PIANO_PRACTICE_MIDI_MONITOR", JSON.stringify(result, null, 2));
    app.exit(result.noteOn > 0 && result.noteOff > 0 ? 0 : 1);
  }
  if (process.argv.includes("--midi-gate")) {
    const result = await win.webContents.executeJavaScript(`(async () => {
      try { const access = await Promise.race([navigator.requestMIDIAccess({sysex:false}), new Promise((_,reject)=>setTimeout(()=>reject(new Error("MIDI API timeout after 10 seconds")),10000))]);
        return {secure:isSecureContext, available:true, inputs:[...access.inputs.values()].map(p=>p.name), outputs:[...access.outputs.values()].map(p=>p.name)};
      } catch(e) { return {secure:isSecureContext, available:false, error:String(e)}; }
    })()`);
    console.log("PIANO_PRACTICE_MIDI_GATE", JSON.stringify(result));
    app.exit(result.available ? 0 : 1);
  }
});
app.on("window-all-closed", () => app.quit());
