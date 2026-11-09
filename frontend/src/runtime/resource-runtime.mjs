/** Paint the keyboard only when a key, target, setting or size changes. */
export function installKeyboardInvalidation(Renderer){
  const proto=Renderer.prototype,init=proto.init,destroy=proto.destroy,resize=proto.resize;
  function invalidate(){
    if(this.resourceDisposed||!this._initialized||this.resourceFrame)return;
    this.resourceFrame=requestAnimationFrame(()=>{
      this.resourceFrame=0;
      if(!this.resourceDisposed&&this._initialized)this.app.render();
    });
  }
  proto.init=async function(...args){
    await init.apply(this,args);
    if(this.resourceDisposed){destroy.call(this);return;}
    this.releasePointerKeys=()=>this.onWindowPointerUp({button:0});
    window.addEventListener('blur',this.releasePointerKeys);
    window.addEventListener('pointercancel',this.releasePointerKeys);
    invalidate.call(this);
  };
  for(const name of ['redrawKey','setOptions']){
    const method=proto[name];
    proto[name]=function(...args){const result=method.apply(this,args);invalidate.call(this);return result;};
  }
  proto.resize=function(width,height){
    if(!this._initialized||width===this.opts.width&&height===this.opts.height)return;
    const previous=new Map(this.keyStates);
    resize.call(this,width,height);
    for(const [midi,state]of previous){this.keyStates.set(midi,state);this.redrawKey(midi);}
    invalidate.call(this);
  };
  proto.destroy=function(){
    this.releasePointerKeys?.();
    window.removeEventListener('blur',this.releasePointerKeys);
    window.removeEventListener('pointercancel',this.releasePointerKeys);
    this.resourceDisposed=true;cancelAnimationFrame(this.resourceFrame);this.resourceFrame=0;
    destroy.call(this);
  };
}

/** Numeric notation follows transport/input changes instead of an idle RAF. */
export function subscribeVisualUpdates(callback,{store,bus}){
  let frame=0,disposed=false;
  const update=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;if(!disposed)callback();});};
  const tick=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=0;callback();};
  bus.on('transport:tick',tick);
  const events=['transport:seek','transport:stateChange','document:loaded','input:note:on','input:note:off'];
  for(const name of events)bus.on(name,update);
  const unsubscribe=store.subscribe(update);update();
  return()=>{disposed=true;cancelAnimationFrame(frame);unsubscribe();bus.off('transport:tick',tick);for(const name of events)bus.off(name,update);};
}

/** Timed hints need a clock only during performance or short-lived feedback. */
export function subscribePracticeFeedback(callback,{store,bus,engine,judge}){
  let timer=0,disposed=false;
  const run=()=>{
    clearTimeout(timer);timer=0;if(disposed)return;
    callback();
    if(!store.getState().demo&&(engine.state.status==='playing'||judge.presses.some(p=>p.off===undefined&&!p.attempt.interrupted)||performance.now()-judge.messageTime<1300))timer=setTimeout(run,100);
  };
  const events=['transport:seek','transport:stateChange','document:loaded','input:note:on','input:note:off'];
  const update=()=>{clearTimeout(timer);timer=setTimeout(run,0);};
  for(const name of events)bus.on(name,update);
  const unsubscribe=store.subscribe(update);run();
  return()=>{disposed=true;clearTimeout(timer);unsubscribe();for(const name of events)bus.off(name,update);};
}
