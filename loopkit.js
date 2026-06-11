(function(){
  'use strict';
  const VERSION='0.1.6-portable';
  const ROOT_ID='loopkit-root';
  const META='script[type="application/loopkit+json"],script[type="application/loopkit+meta"]';
  const DECISIONS='#loopkit-decisions';
  let mode=null, targetEl=null, point=null, dirty=false, blockNext=false;
  const meta=readMeta();
  const decisions=(document.querySelector(DECISIONS)?.textContent||'').trim();
  const key=`loopkit:v0:${meta.artifactId}:${meta.artifactVersion}`;
  let events=readEvents();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

  function init(){
    if(document.getElementById(ROOT_ID)) return;
    injectStyle();
    const root=document.createElement('div');
    root.id=ROOT_ID;
    root.setAttribute('data-loop-ignore','');
    root.innerHTML=`
      <div class="lk-bar">
        <button type="button" data-mode="markup">Mark up</button>
        <button type="button" data-mode="comments">Comments</button>
        <button type="button" data-mode="tweaks">Tweaks</button>
        <button type="button" data-copy>Copy bundle</button>
      </div>
      <div class="lk-outline"><span></span></div>
      <div class="lk-composer">
        <div class="lk-title">Feedback</div>
        <textarea placeholder="Напиши фидбэк..."></textarea>
        <div class="lk-actions"><button type="button" data-cancel>Cancel</button><button type="button" data-save>Save</button></div>
      </div>
      <button type="button" class="lk-pill"></button>
      <div class="lk-drawer"><div class="lk-drawer-head"><b>Feedback bundle</b><button type="button" data-close>×</button></div><div class="lk-list"></div><div class="lk-actions"><button type="button" data-clear>Clear</button><button type="button" data-copy>Copy for AI</button></div></div>
      <div class="lk-pins"></div><div class="lk-toast"></div>`;
    document.documentElement.appendChild(root);
    bindUi(root);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onMaybeBlock, true);
    document.addEventListener('click', onMaybeBlock, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', renderPins, true);
    window.addEventListener('resize', renderPins);
    render();
    window.LoopKit=Object.assign(window.LoopKit||{}, {version:VERSION, meta, getEvents:()=>events.slice(), clearEvents, exportBundle, exportMarkdown, copyBundle, saveEvent(ev){events.push(Object.assign(base(ev.type||'custom',ev.message||''),ev)); persist(); render();}});
    console.info('[LoopKit] initialized', VERSION, meta);
  }

  function bindUi(root){
    root.addEventListener('pointerdown', stop, true);
    root.addEventListener('click', stop, true);
    root.addEventListener('keydown', e=>{ e.stopPropagation(); if((e.metaKey||e.ctrlKey)&&e.key==='Enter') saveDraft(); }, true);
    root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click', e=>{stop(e); setMode(mode===b.dataset.mode?null:b.dataset.mode);}));
    root.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click', e=>{stop(e); copyBundle();}));
    root.querySelector('[data-save]').addEventListener('click', e=>{stop(e); saveDraft();});
    root.querySelector('[data-cancel]').addEventListener('click', e=>{stop(e); closeComposer();});
    root.querySelector('[data-close]').addEventListener('click', e=>{stop(e); $('.lk-drawer').classList.remove('is-visible');});
    root.querySelector('[data-clear]').addEventListener('click', e=>{stop(e); clearEvents();});
    root.querySelector('.lk-pill').addEventListener('click', e=>{stop(e); $('.lk-drawer').classList.toggle('is-visible'); renderList();});
    root.querySelector('textarea').addEventListener('input', e=>{dirty=!!e.target.value.trim();});
  }

  function setMode(next){
    mode=next; closeComposer(); hideOutline();
    document.querySelectorAll(`#${ROOT_ID} [data-mode]`).forEach(b=>b.classList.toggle('is-active', b.dataset.mode===mode));
    document.documentElement.dataset.loopkitMode=mode||'';
    if(mode==='tweaks') openComposer(null, window.innerWidth/2-180, 64, 'tweak.request', 'Tweaks request');
  }

  function onMove(e){
    if(mode!=='markup' || isLK(e)) return;
    const t=targetAt(e.clientX,e.clientY);
    if(t) showOutline(t); else hideOutline();
  }

  function onDown(e){
    if(!mode || isLK(e)) return;
    stop(e); blockNext=true;
    const composer=$('.lk-composer');
    if(composer.classList.contains('is-visible') && dirty){ shake(composer); return; }
    const t=targetAt(e.clientX,e.clientY);
    if(mode==='markup'){
      if(!t){ toast('Нет data-loop-id'); return; }
      targetEl=t; point=null; openComposer(t, e.clientX+12, e.clientY+12, 'markup.comment', titleOf(t));
    } else if(mode==='comments'){
      targetEl=t||document.querySelector('[data-loop-id]'); point=makePoint(targetEl,e.clientX,e.clientY); openComposer(targetEl,e.clientX+12,e.clientY+12,'comment.pin','Comment');
    }
  }

  function onMaybeBlock(e){
    if(!mode || isLK(e)) return;
    if(blockNext || mode){ stop(e); blockNext=false; }
  }

  function onKey(e){
    if(isLK(e)) return;
    const k=e.key.toLowerCase();
    if((e.metaKey||e.ctrlKey)&&e.shiftKey&&k==='e'){e.preventDefault(); copyBundle();}
    if(e.key==='Escape'){setMode(null); $('.lk-drawer').classList.remove('is-visible');}
  }

  function openComposer(t,x,y,type,title){
    const c=$('.lk-composer'), ta=c.querySelector('textarea');
    c.dataset.type=type; c.querySelector('.lk-title').textContent=title||'Feedback';
    c.style.left=clamp(x,14,window.innerWidth-380)+'px';
    c.style.top=clamp(y,54,window.innerHeight-220)+'px';
    ta.value=''; dirty=false; c.classList.add('is-visible'); setTimeout(()=>ta.focus(),0);
  }
  function closeComposer(){ const c=$('.lk-composer'); if(!c)return; c.classList.remove('is-visible'); c.querySelector('textarea').value=''; dirty=false; targetEl=null; point=null; }
  function saveDraft(){
    const c=$('.lk-composer'), ta=c.querySelector('textarea'), message=ta.value.trim();
    if(!message){shake(c); return;}
    const type=c.dataset.type||'markup.comment';
    const ev=base(type,message);
    if(type!=='tweak.request') ev.target=info(targetEl);
    if(type==='comment.pin') ev.point=point;
    events.push(ev); persist(); closeComposer(); render(); toast('Saved');
  }

  function targetAt(x,y){
    const root=document.getElementById(ROOT_ID); const old=root.style.display; root.style.display='none';
    const el=document.elementFromPoint(x,y); root.style.display=old;
    const t=el&&el.closest&&el.closest('[data-loop-id]');
    if(!t||t.closest('[data-loop-ignore]')) return null;
    return t;
  }
  function makePoint(t,x,y){const p={x:Math.round(x),y:Math.round(y)}; if(t){const r=t.getBoundingClientRect(); p.relX=r.width?(x-r.left)/r.width:0; p.relY=r.height?(y-r.top)/r.height:0;} return p;}
  function showOutline(t){const r=t.getBoundingClientRect(), o=$('.lk-outline'); o.style.display='block'; o.style.left=Math.round(r.left)+'px'; o.style.top=Math.round(r.top)+'px'; o.style.width=Math.round(r.width)+'px'; o.style.height=Math.round(r.height)+'px'; o.querySelector('span').textContent=titleOf(t);}
  function hideOutline(){const o=$('.lk-outline'); if(o) o.style.display='none';}

  function render(){renderPill(); renderList(); renderPins();}
  function renderPill(){const p=$('.lk-pill'); p.textContent='Feedback '+events.length; p.classList.toggle('is-visible', events.length>0);}
  function renderList(){const list=$('.lk-list'); if(!list)return; list.innerHTML=events.length?'':'<div class="lk-item">Пока нет фидбэка.</div>'; events.forEach((ev,i)=>{const d=document.createElement('div'); d.className='lk-item'; d.innerHTML=`<small>${i+1}. ${esc(ev.type)} ${ev.target?'· '+esc(ev.target.id):''}</small>${esc(ev.message)}`; list.appendChild(d);});}
  function renderPins(){const box=$('.lk-pins'); if(!box)return; box.innerHTML=''; events.forEach((ev,i)=>{const pos=pinPos(ev); if(!pos)return; const b=document.createElement('button'); b.type='button'; b.className='lk-pin'; b.textContent=String(i+1); b.title=ev.message; b.style.left=pos.x+'px'; b.style.top=pos.y+'px'; box.appendChild(b);});}
  function pinPos(ev){let t=null; if(ev.target&&ev.target.id){try{t=document.querySelector(`[data-loop-id="${cssEsc(ev.target.id)}"]`)}catch{}} if(t&&ev.point&&ev.point.relX!=null){const r=t.getBoundingClientRect(); return {x:Math.round(r.left+r.width*ev.point.relX), y:Math.round(r.top+r.height*ev.point.relY)};} if(ev.point) return {x:ev.point.x,y:ev.point.y}; if(t){const r=t.getBoundingClientRect(); return {x:Math.round(r.right),y:Math.round(r.top)};} return null;}

  function base(type,message){return {id:uid('fb'),type,artifactId:meta.artifactId,artifactVersion:meta.artifactVersion,createdAt:new Date().toISOString(),message,url:location.href};}
  function info(t){if(!t)return null; const r=t.getBoundingClientRect(); return {id:t.dataset.loopId,kind:t.dataset.loopKind||t.tagName.toLowerCase(),title:titleOf(t),selector:`[data-loop-id="${cssEsc(t.dataset.loopId)}"]`,text:compact(t.textContent,700),rect:{x:Math.round(r.left),y:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}};}
  function exportBundle(){return {loopkit:'feedback-bundle-v0',runtimeVersion:VERSION,artifact:{id:meta.artifactId,version:meta.artifactVersion,title:meta.title,description:meta.description||'',url:location.href},decisions,rule:'This feedback bundle is single-use and valid only for this artifact version. The next agent must respond to every item and must not carry this bundle forward automatically.',items:events.slice()};}
  function exportMarkdown(){const b=exportBundle(), lines=['# LoopKit feedback bundle','',`Artifact: ${b.artifact.title}`,`ID: ${b.artifact.id}`,`Version: ${b.artifact.version}`,'']; if(decisions) lines.push('## DECISIONS',decisions,''); lines.push('## Feedback items'); if(!events.length) lines.push('No feedback items.'); events.forEach((ev,i)=>{lines.push(`${i+1}. ${ev.type}`); if(ev.target)lines.push(`   Target: ${ev.target.id} — ${ev.target.title}`); if(ev.point)lines.push(`   Point: x=${ev.point.x}, y=${ev.point.y}`); lines.push(`   Message: ${ev.message}`,'');}); lines.push('## Machine-readable JSON','```json',JSON.stringify(b,null,2),'```'); return lines.join('\n');}
  async function copyBundle(){const text=exportMarkdown(); try{await navigator.clipboard.writeText(text)}catch{const a=document.createElement('textarea'); a.value=text; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove();} toast('Feedback bundle copied');}
  function clearEvents(){events=[]; persist(); render(); $('.lk-drawer').classList.remove('is-visible'); toast('Cleared');}
  function readEvents(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
  function persist(){localStorage.setItem(key,JSON.stringify(events));}
  function readMeta(){const f={artifactId:document.title||'artifact',artifactVersion:'v1',title:document.title||'Artifact',description:''}, n=document.querySelector(META); if(!n)return f; try{const r=JSON.parse(n.textContent||'{}'); return {artifactId:r.artifactId||r.artifact_id||f.artifactId,artifactVersion:r.artifactVersion||r.artifact_version||f.artifactVersion,title:r.title||f.title,description:r.description||''}}catch{return f}}

  function injectStyle(){const s=document.createElement('style'); s.textContent=`
    #${ROOT_ID}{position:static!important;z-index:2147483647;pointer-events:none;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b}
    #${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID} .lk-bar,#${ROOT_ID} .lk-composer,#${ROOT_ID} .lk-pill,#${ROOT_ID} .lk-drawer,#${ROOT_ID} .lk-pin{pointer-events:auto;z-index:2147483647}
    #${ROOT_ID} .lk-bar{position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:4px;align-items:center;padding:5px;background:rgba(255,255,255,.94);border:1px solid rgba(24,24,27,.14);border-radius:16px;box-shadow:0 16px 45px rgba(0,0,0,.14);backdrop-filter:blur(14px)}
    #${ROOT_ID} button{height:32px;border:0;border-radius:11px;background:transparent;color:#52525b;padding:0 10px;font:700 13px/1 inherit;cursor:pointer;white-space:nowrap}#${ROOT_ID} button:hover{background:#f4f4f5;color:#18181b}#${ROOT_ID} button.is-active{background:#18181b;color:#fff}
    #${ROOT_ID} .lk-outline{position:fixed;display:none;pointer-events:none;z-index:2147483646;border:2px solid #2563eb;border-radius:10px;box-shadow:0 0 0 3px rgba(37,99,235,.12)}#${ROOT_ID} .lk-outline span{position:absolute;left:0;top:-26px;background:#2563eb;color:#fff;border-radius:999px;padding:4px 8px;font:700 11px/1 inherit;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
    #${ROOT_ID} .lk-composer{position:fixed;display:none;width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}#${ROOT_ID} .lk-composer.is-visible{display:block}#${ROOT_ID} .lk-title{font:800 12px/1.25 inherit;color:#18181b;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #${ROOT_ID} textarea{width:100%;min-height:92px;resize:vertical;border:1px solid #e4e4e7;border-radius:13px;padding:10px;font:14px/1.35 inherit;outline:none;color:#18181b;background:#fff}#${ROOT_ID} textarea:focus{border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,.08)}#${ROOT_ID} .lk-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}#${ROOT_ID} .lk-actions button{border:1px solid #e4e4e7;background:#fff;color:#18181b}#${ROOT_ID} .lk-actions button:last-child{background:#18181b;color:#fff;border-color:#18181b}
    #${ROOT_ID} .lk-pill{position:fixed;right:14px;bottom:14px;display:none;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;box-shadow:0 16px 36px rgba(0,0,0,.22)}#${ROOT_ID} .lk-pill.is-visible{display:block}#${ROOT_ID} .lk-drawer{position:fixed;right:14px;bottom:58px;width:min(380px,calc(100vw - 28px));max-height:min(540px,calc(100vh - 86px));overflow:auto;display:none;background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}#${ROOT_ID} .lk-drawer.is-visible{display:block}#${ROOT_ID} .lk-drawer-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}#${ROOT_ID} .lk-item{border-top:1px solid #eee;padding:10px 0;font:13px/1.35 inherit}#${ROOT_ID} .lk-item small{display:block;color:#71717a;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
    #${ROOT_ID} .lk-pin{position:fixed;min-width:22px;height:22px;border-radius:999px;border:2px solid #fff;background:#18181b;color:#fff;font:800 11px/18px inherit;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.25);transform:translate(-50%,-50%)}#${ROOT_ID} .lk-toast{pointer-events:none;position:fixed;left:50%;bottom:16px;z-index:2147483647;transform:translateX(-50%) translateY(8px);opacity:0;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;font:800 12px/1 inherit;box-shadow:0 14px 34px rgba(0,0,0,.22);transition:.16s ease}#${ROOT_ID} .lk-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}#${ROOT_ID} .lk-shake{animation:lkshake .22s ease-in-out 0s 2}@keyframes lkshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`;
    document.head.appendChild(s);
  }
  function $(sel){return document.querySelector(`#${ROOT_ID} ${sel}`)} function isLK(e){return e.target&&e.target.closest&&e.target.closest('#'+ROOT_ID)} function stop(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation()} function titleOf(t){return t?.dataset.loopTitle||t?.getAttribute('aria-label')||compact(t?.textContent,80)||t?.dataset.loopId||'Feedback'} function uid(p){return `${p}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`} function compact(v,n){return String(v||'').replace(/\s+/g,' ').trim().slice(0,n)} function clamp(v,a,b){return Math.max(a,Math.min(b,v))} function esc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))} function cssEsc(v){return window.CSS?.escape?CSS.escape(v):String(v).replace(/[^a-zA-Z0-9_-]/g,'\\$&')} function shake(el){el.classList.remove('lk-shake');void el.offsetWidth;el.classList.add('lk-shake')} function toast(m){let t=$('.lk-toast');t.textContent=m;t.classList.add('is-visible');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('is-visible'),1300)}
})();