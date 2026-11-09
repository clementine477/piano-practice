import {createScoreCursor} from './cursor-motion.mjs';
/** Views share the transport clock, including seeks made while they are hidden. */
export function createFallingNotesView({React, store, engine, bus, Renderer, measureStarts, beatStarts}) {
  const h=React.createElement;
  return function FallingNotesView() {
    const canvasRef=React.useRef(null), containerRef=React.useRef(null), liveRef=React.useRef(null);
    const {settings, practiceMode, document:doc, seek}=store();
    const options=React.useMemo(()=>({
      viewportSeconds:settings.viewportSeconds, fallingNotesLabelMode:settings.fallingNotesLabelMode,
      showFingering:settings.showFingering&&settings.showFingeringOnNotes&&(practiceMode!=='test'||settings.guidanceInTest),
      showHandColors:settings.showHandColors, useFlats:settings.useFlats, noteFilter:settings.noteFilter,
      colorTheme:settings.colorTheme, customColors:settings.customColors, showGrid:settings.showGrid,
      showMeasureNums:settings.showMeasureNums,
      measureStarts:doc?(doc.measures?.map(m=>m.startSeconds)??measureStarts(doc.timeSignatures,doc.tempoMap,doc.ppq,doc.totalDuration)):[],
      impactStyle:settings.impactStyle, minNoteHeight:settings.minNoteHeight, noteCornerRadius:settings.noteCornerRadius,
      showBeatLines:settings.showBeatLines, beatStarts:doc?beatStarts(doc.timeSignatures,doc.tempoMap,doc.ppq,doc.totalDuration):[],
      showSustainPedal:settings.showSustainPedal, sustainRanges:doc?.sustainRanges,
      showNoteOutline:settings.showNoteOutline, showSustainedNotes:settings.showSustainedNotes,
      darkMode:settings.theme==='dark'
    }),[settings,practiceMode,doc]);
    const optionsRef=React.useRef(options);optionsRef.current=options;
    React.useEffect(()=>{
      const host=containerRef.current, canvas=canvasRef.current;
      if(!host||!canvas)return;
      const renderer=new Renderer({...optionsRef.current,width:host.clientWidth||1,height:host.clientHeight||200});
      let disposed=false, ready=false, resizeFrame=0, indexedNotes=null, maxEnds=[];
      const now=()=>engine.state.status==='playing'?engine.clock.visualSeconds:engine.state.currentSeconds;
      function repaint(seconds=now()) {
        if(disposed||!ready)return;
        const s=store.getState(), notes=s.document?.notes??[];
        if(indexedNotes!==notes){
          indexedNotes=notes;maxEnds=[];let end=-Infinity;
          for(const note of notes){end=Math.max(end,note.endSeconds);maxEnds.push(end);}
        }
        // A long held note may begin before the visible window. Prefix maxima
        // skip old notes without dropping that note or rescanning the whole song.
        let low=0, high=maxEnds.length;
        while(low<high){const mid=(low+high)>>>1;if(maxEnds[mid]<seconds-.8)low=mid+1;else high=mid;}
        for(let index=low;index<notes.length;index++){
          const note=notes[index];
          if(note.startSeconds>seconds+s.settings.viewportSeconds)break;
          if(note.endSeconds>=seconds-.8)renderer.addNote({...note,midi:Math.max(21,Math.min(108,note.midi+s.settings.transposeSemitones))},seconds);
        }
        renderer.tick(seconds);
        // The transport already owns the animation clock. A second PIXI RAF
        // repainted static canvases forever and added unnecessary GPU work.
        renderer.app.ticker.update(performance.now());
      }
      function resize() {
        resizeFrame=0;if(disposed||!ready)return;
        const width=host.clientWidth, height=host.clientHeight;
        if(width>0&&height>0&&(width!==renderer.opts.width||height!==renderer.opts.height))renderer.resize(width,height);
        repaint();
      }
      const onTick=({seconds})=>repaint(seconds);
      const onSeek=({seconds})=>{renderer.reset();repaint(seconds);};
      const onState=()=>{renderer.reset();if(ready)renderer.app.stage.alpha=1;repaint();};
      bus.on('transport:tick',onTick);bus.on('transport:seek',onSeek);bus.on('transport:stateChange',onState);
      const observer=new ResizeObserver(()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(resize);});observer.observe(host);
      liveRef.current={renderer,repaint};
      renderer.init(canvas).then(()=>{
        if(disposed){renderer.destroy();return;}
        ready=true;renderer.setOptions(optionsRef.current);resize();
      }).catch(error=>{if(!disposed)console.error('Could not initialize falling notes',error);});
      return()=>{
        disposed=true;observer.disconnect();cancelAnimationFrame(resizeFrame);
        bus.off('transport:tick',onTick);bus.off('transport:seek',onSeek);bus.off('transport:stateChange',onState);
        if(ready)renderer.destroy();liveRef.current=null;
      };
    },[]);
    React.useEffect(()=>{
      const live=liveRef.current;if(!live)return;
      live.renderer.setOptions(options);live.renderer.reset();live.repaint();
    },[options]);
    return h('div',{ref:containerRef,className:'w-full flex-1 relative','data-piano-falling':true,
      onWheel:event=>{if(!doc||!settings.scrollToSeek)return;const step=(event.deltaY>0?1:-1)*settings.viewportSeconds*.3;seek(Math.max(0,Math.min(doc.totalDuration,store.getState().currentSeconds+step)));},
      style:{minHeight:0,overflow:'hidden',background:settings.layoutMode==='all'?'transparent':'radial-gradient(ellipse at 50% 100%, rgba(147,51,234,0.07) 0%, transparent 65%), var(--color-notes-bg)',borderTop:settings.layoutMode==='all'?'none':'1px solid var(--color-notes-border)'}
    },h('canvas',{ref:canvasRef,style:{display:'block',width:'100%',height:'100%'}}));
  };
}

export function createSheetMusicView({React,store,engine,secondsToTick,sanitizeXML,keyLabel,playNote,stopNote,bus}) {
  const h=React.createElement;
  return function SheetMusicView(){
    const scrollRef=React.useRef(null),containerRef=React.useRef(null),apiRef=React.useRef(null),reloadRef=React.useRef(null);
    const {document:doc,settings}=store(), combined=settings.layoutMode==='all';
    React.useEffect(()=>{
      let disposed=false, api=null, cursor=null, loadedXML=null, loadedBuffer=null, scoreReady=false;
      let scrollFrame=0, fitFrame=0, lastVertical=-1, lastVerticalAt=0;
      const timers=new Set();
      const now=()=>engine.state.status==='playing'?engine.clock.visualSeconds:engine.state.currentSeconds;
      function fitHeight(){
        fitFrame=0;
        const host=scrollRef.current,root=containerRef.current;
        if(disposed||!combined||!host||!root||!root.scrollHeight)return;
        const fit=(host.clientHeight-24)/root.scrollHeight;
        const zoom=Math.min(1,Math.max(.45,fit));
        // At the minimum window height, two simultaneous notations need a
        // scrollable score pane instead of unreadably small or clipped staves.
        host.style.overflowY=fit<.45?'auto':'hidden';
        if(Math.abs(Number(root.style.zoom||1)-zoom)>.005)root.style.zoom=String(zoom);
        queueScroll();
      }
      // Writing zoom/overflow during ResizeObserver delivery can resize this
      // very pane again. Dual notation then reports an undelivered resize loop
      // which the application's error handler treats as a fatal error.
      function queueFit(){if(!disposed&&!fitFrame)fitFrame=requestAnimationFrame(fitHeight);}
      const resizeObserver=new ResizeObserver(queueFit);
      if(scrollRef.current)resizeObserver.observe(scrollRef.current);
      function scrollCursor(){
        scrollFrame=0;if(disposed)return;
        const host=scrollRef.current,root=containerRef.current;
        const cursor=root?.querySelector('.at-cursor-beat')??root?.querySelector('.at-cursor-bar');
        if(!host||!cursor)return;
        const c=cursor.getBoundingClientRect(),r=host.getBoundingClientRect();
        if(combined){
          const target=Math.max(0,c.left-r.left+host.scrollLeft-host.clientWidth*.4);
          if(Math.abs(target-host.scrollLeft)>.5)host.scrollLeft=target;
        }else{
          const time=performance.now(),playing=engine.state.status==='playing';
          if(playing&&time-lastVerticalAt<200)return;lastVerticalAt=time;
          const target=Math.max(0,c.top-r.top+host.scrollTop-host.clientHeight*.3);
          if(Math.abs(target-lastVertical)>60||!playing){lastVertical=target;host.scrollTo({top:target,behavior:playing?'smooth':'instant'});}
        }
      }
      function queueScroll(){if(!disposed&&!scrollFrame)scrollFrame=requestAnimationFrame(scrollCursor);}
      function sync({seconds=now()}={}){
        if(disposed||!api||!scoreReady)return;
        const current=store.getState().document;if(!current)return;
        if(cursor?.paint(seconds)){cancelAnimationFrame(scrollFrame);scrollCursor();}
      }
      function load(){
        if(disposed||!api)return;
        const current=store.getState().document;
        if(current?.musicXml){
          if(current.musicXml===loadedXML)return;
          loadedXML=current.musicXml;loadedBuffer=null;scoreReady=false;
          api.load(new TextEncoder().encode(sanitizeXML(current.musicXml)),[-1]);
        }else if(current?.mxlBuffer&&current.mxlBuffer!==loadedBuffer){
          loadedBuffer=current.mxlBuffer;loadedXML=null;scoreReady=false;
          api.load(new Uint8Array(current.mxlBuffer),[-1]);
        }
      }
      reloadRef.current=load;
      import('@coderline/alphatab').then(({AlphaTabApi})=>{
        if(disposed||!containerRef.current)return;
        api=new AlphaTabApi(containerRef.current,{
          core:{engine:'svg',enableLazyLoading:true,logLevel:0,fontDirectory:'/font/',scriptFile:'/alphatab/alphaTab.js'},
          notation:{elements:combined?{scoreTitle:false,scoreSubTitle:false,scoreArtist:false,scoreAlbum:false,scoreWords:false,scoreMusic:false,scoreWordsAndMusic:false,scoreCopyright:false,trackNames:false}:{}},
          display:{padding:combined?[8,8,8,8]:[20,20,20,20],layoutMode:combined?1:0,scale:combined?.82:.9,stretchForce:.1,staveProfile:0},
          player:{enablePlayer:true,enableCursor:true,enableUserInteraction:true,soundFont:'/soundfont/sonivox.sf3',scrollMode:0}
        });
        apiRef.current = api;
        cursor=createScoreCursor(api,containerRef.current,()=>store.getState().document,secondsToTick);
        api.masterVolume=0;
        api.playerReady.on(()=>{api.masterVolume=0;sync();});
        // A parsed score is not yet the displayed score: the worker still has
        // to return its matching layout. Never combine new ticks with old bounds.
        api.scoreLoaded.on(()=>{cursor.invalidate();});
        api.postRenderFinished.on(()=>{scoreReady=true;cursor.invalidate();queueFit();sync();});
        api.beatMouseDown.on(beat=>{
          const notes=beat?.notes??[];if(!notes.length)return;
          for(const note of notes)playNote(note.realValue,80);
          const timer=setTimeout(()=>{timers.delete(timer);for(const note of notes)stopNote(note.realValue);},500);
          timers.add(timer);
        });
        load();
      }).catch(error=>{if(!disposed)console.error('Could not initialize sheet music',error);});
      bus.on('transport:tick',sync);bus.on('transport:seek',sync);bus.on('transport:stateChange',sync);
      return()=>{
        disposed=true;reloadRef.current=null;cancelAnimationFrame(scrollFrame);cancelAnimationFrame(fitFrame);resizeObserver.disconnect();
        bus.off('transport:tick',sync);bus.off('transport:seek',sync);bus.off('transport:stateChange',sync);
        // Preview note timers must still release their notes after a view change.
        cursor?.destroy();api?.destroy();apiRef.current=null;
      };
    },[combined]);
    React.useEffect(()=>reloadRef.current?.(),[doc?.musicXml,doc?.mxlBuffer]);
    const white=settings.theme==='dark'&&settings.sheetMusicWhiteBackground;
    const invert=settings.theme==='dark'&&!settings.sheetMusicWhiteBackground;
    return h('div',{ref:scrollRef,className:'flex-1','data-piano-sheet':true,style:{
      background:white?'#ffffff':combined?'transparent':'radial-gradient(ellipse at 50% 100%, rgba(147,51,234,0.07) 0%, transparent 65%), var(--color-notes-bg)',
      position:'relative',isolation:'isolate',zIndex:0,minHeight:0,borderTop:'1px solid var(--color-notes-border)',overflowX:combined?'auto':'hidden',overflowY:combined?'hidden':'auto'
    }},h('div',{style:{maxWidth:combined?'none':900,margin:combined?0:'0 auto',padding:combined?'10px 20px':'10px 16px 190px',position:'relative'}},
      h('div',{ref:containerRef,className:invert?'sheet-dark-invert':''}),
      settings.showKeySignature&&doc?.keySignature&&!combined&&h('div',{className:'absolute top-2 right-4 z-10 pointer-events-none text-xs px-2 py-0.5 rounded',style:{background:white?'#f5f7fb':'var(--color-surface-2)',border:'1px solid var(--color-border)',color:'var(--color-text-muted)',letterSpacing:'.03em'}},keyLabel(doc.keySignature))
    ));
  };
}

/** Cache guidance data; demonstration never needs to copy the entire score. */
export function createKeyboardTargetUpdater({store,engine,judge,findTargets,renderer}){
  let previousNotes=null,previousKey='',notes=[],targetSignature='';
  function show(targets){
    const attempt=judge.attempts.at(-1);
    const wrong=attempt?.pitchStatus==='wrong'&&performance.now()-(attempt.actualOnsetMs??0)<450?attempt.actualMidi:'';
    const signature=targets.map(n=>`${n.midi}:${n.hand}:${n.finger}`).join('|')+';'+wrong;
    if(signature!==targetSignature){targetSignature=signature;renderer.showTargets(targets);}
  }
  return()=>{
    const s=store.getState(),state=engine.state;
    if(s.demo||(s.practiceMode==='test'&&!s.settings.guidanceInTest)){show([]);return;}
    const key=[s.settings.transposeSemitones,s.practiceMode,state.practiceHand,state.learningHands,[...state.activeHands].sort().join(',')].join('|');
    if(previousNotes!==s.document?.notes||previousKey!==key){
      previousNotes=s.document?.notes;previousKey=key;
      notes=(previousNotes??[]).filter(n=>engine.isPracticeNote(n)).map(n=>({...n,midi:Math.max(21,Math.min(108,n.midi+s.settings.transposeSemitones))}));
    }
    show(engine.pendingTargets.length?engine.pendingTargets:findTargets(notes,s.currentSeconds,s.status==='playing'?judge.matched:new Set(),s.practiceMode==='learn'?4:1.2));
  };
}

export function createTempoLabelReader(){
  const cache=new WeakMap();
  return(doc,seconds,multiplier)=>{
    let entry=cache.get(doc);
    if(!entry||entry.source!==doc.tempoMap||entry.ppq!==doc.ppq){
      let elapsed=0,previousTick=0,previousBpm=doc.tempoMap[0]?.bpm??120;
      const changes=doc.tempoMap.map(tempo=>{
        elapsed+=(tempo.tick-previousTick)*60/(previousBpm*doc.ppq);
        previousTick=tempo.tick;previousBpm=tempo.bpm;return{seconds:elapsed,bpm:tempo.bpm};
      });
      entry={source:doc.tempoMap,ppq:doc.ppq,changes};cache.set(doc,entry);
    }
    let low=0,high=entry.changes.length;
    while(low<high){const mid=(low+high)>>>1;if(entry.changes[mid].seconds<=seconds)low=mid+1;else high=mid;}
    return Math.round((entry.changes[Math.max(0,low-1)]?.bpm??120)*multiplier);
  };
}
