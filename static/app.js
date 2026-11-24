/* Ruth Docs: the supplied minimalist interface, connected to FastAPI + SQLite.
   Demo account switching is not authentication; use synthetic documents only. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const MAX_IMAGE_BYTES = 450000;
  let users = [], me = 1, docs = [], current = null, dirty = false;
  let filter = 'all', shareOpen = false, versionsOpen = false, shareRole = 'edit', saving = false, saveTimer = null, noticeTimer;
  const editor = $('editor'), title = $('title');
  let selectedImage = null, draggedFigure = null;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const userName = id => (users.find(u => u.id === id)?.name ?? `User ${id}`).toLowerCase();
  const json = (method, body) => ({method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  async function api(path, options = {}) {
    const r = await fetch(path, options);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(typeof data.detail === 'string' ? data.detail : `Request failed (${r.status})`);
    return data;
  }
  function notice(msg) {
    $('notice').textContent = msg;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => $('notice').textContent = '', 4000);
  }
  function role() { return current?.role ?? null; }
  function editable() { return role() === 'owner' || role() === 'edit'; }
  function changed() {
    if (!editable()) return;
    dirty = true;
    updateWordCount();
    renderMeta();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save().catch(e => notice(e.message)), 1300);
  }
  const time = s => s ? new Date(s.endsWith('Z') ? s : s.replace(' ', 'T')+'Z').toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}).toLowerCase() : 'now';

  function updateWordCount() {
    const text=editor.innerText || editor.textContent || '';
    const words=text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[];
    $('wordCount').textContent=`${words.length.toLocaleString()} ${words.length===1?'word':'words'}`;
    editor.dataset.empty=String(!text.trim() && !editor.querySelector('img'));
  }
  function renderSession() {$('accountName').textContent=userName(me);}
  function showLogin() {
    $('loginChoices').innerHTML=users.map(u=>`<button class="login-choice" type="button" data-login-user="${u.id}"><span>${escape(u.name)}</span><span class="mono">continue →</span></button>`).join('');
    $('loginGate').hidden=false;
    $('loginChoices').querySelector('button')?.focus();
  }
  async function openLanding() {
    await loadDocs();
    const saved=Number(sessionStorage.getItem('ruth-docs-active'));
    const first=docs.find(d=>d.id===saved)||docs[0];
    if(first) return openDoc(first.id);
    // First-time writers land on a blank, editable canvas.
    const created=await api('/api/documents',json('POST',{user_id:me,title:'untitled'}));
    await loadDocs();await openDoc(created.id);
  }
  async function chooseLogin(id) {
    if(!users.some(u=>u.id===id)) return;
    if(id!==me) await switchUser(id);
    me=id;sessionStorage.setItem('ruth-docs-demo-user',String(id));renderSession();
    $('loginGate').hidden=true;
    if(!current) await openLanding();
  }
  function versionTime(s) {
    return new Date(s.replace(' ','T')+'Z').toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }
  async function renderVersions() {
    const pop=$('versionsPop');
    $('historyBtn').setAttribute('aria-expanded',String(versionsOpen));
    if(!versionsOpen||!current) {pop.hidden=true;return;}
    const history=await api(`/api/documents/${current.id}/versions?user_id=${me}`);
    pop.innerHTML=`<div class="pop-head"><span class="mono">version history</span><button class="tool" type="button" data-action="history">[close]</button></div>
      <p class="history-help">Save a version at a useful stopping point. Autosave keeps the latest draft.</p>
      ${editable()?'<button class="pill" type="button" data-action="save-version">save version</button>':''}
      <ul class="history-list">${history.length?history.map(v=>`<li><div class="history-copy"><strong>${escape(v.title)}</strong><small>${escape(versionTime(v.created_at))} · ${escape(v.saved_by_name)}</small></div>${editable()?`<button class="tool" type="button" data-restore-version="${v.id}">[restore]</button>`:''}</li>`).join(''):'<li class="history-empty">No versions saved yet.</li>'}</ul>`;
    pop.hidden=false;
  }
  async function saveVersion() {
    await save();
    if(!current||!editable())return;
    const result=await api(`/api/documents/${current.id}/versions?user_id=${me}`,{method:'POST'});
    notice(result.created?'version saved':'latest version already saved');
    await renderVersions();
  }
  async function restoreVersion(id) {
    if(!current||!editable())return;
    if(!confirm('Restore this version? The current draft will be saved to history first.'))return;
    await save();
    const result=await api(`/api/documents/${current.id}/versions/${id}/restore?user_id=${me}`,{method:'POST'});
    await refreshDoc();await loadDocs();await renderVersions();
    notice(result.restored?'version restored · previous draft kept':'already showing this version');
  }

  async function loadDocs() {
    docs = await api(`/api/documents?user_id=${me}`);
    renderLists();
  }
  function renderLists() {
    let html = '';
    const selected = docs.filter(d => filter === 'mine' ? d.is_owner : filter === 'shared' ? !d.is_owner : true);
    for (const [caption,own] of [['yours',true],['shared with you',false]]) {
      if ((filter === 'mine' && !own) || (filter === 'shared' && own)) continue;
      const subset = selected.filter(d => !!d.is_owner === own);
      html += `<section><h2 class="mono"><span class="dot ${own?'full':''}"></span>${caption}</h2>`;
      html += subset.length ? subset.map(d => `<button class="row" type="button" data-open="${d.id}" ${current?.id===d.id?'aria-current="page"':''}>
          <span class="t">${escape(d.title)}</span><span class="mono">${own?'private / owned by you':'from '+escape(d.owner_name)+' / '+(d.role === 'view' ? 'can view':'can edit')}</span></button>`).join('') : '<p class="mono" style="margin:8px 0 0 17px">none yet</p>';
      html += '</section>';
    }
    $('lists').innerHTML = html;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  }
  function renderMeta() {
    if (!current) return;
    $('ownerDot').className = `dot${current.is_owner ? ' full' : ''}`;
    $('ownerLine').textContent = current.is_owner ? `yours · ${current.access.length ? `shared with ${current.access.length}`:'private'}` : `owned by ${current.owner_name.toLowerCase()} · ${editable()?'can edit':'view only'}`;
    $('saveLine').textContent = !editable() ? 'read only' : dirty ? 'unsaved changes · ⌘s' : `saved ${time(current.updated_at)}`;
    $('saveBtn').textContent = dirty ? 'save' : 'saved';
    $('saveBtn').classList.toggle('ghost',!dirty);
    $('saveBtn').disabled = !editable() || saving;
  }
  function renderShare() {
    const pop = $('pop');
    $('shareBtn').textContent = `[share${current?.access.length ? ' · '+current.access.length : ''}]`;
    $('shareBtn').setAttribute('aria-expanded',String(shareOpen));
    if (!current || !shareOpen) {pop.hidden = true;return;}
    const owner = current.is_owner;
    const listed = (current.access || []).map(a => `<li><span class="who"><span class="dot"></span>${escape(userName(a.user_id))}${a.user_id===me?' (you)':''}</span>
      <span style="display:inline-flex;gap:2px"><button class="tool" data-toggle="${a.user_id}" ${owner?'':'disabled'}>${a.role === 'view'?'can view':'can edit'}</button>${owner?`<button class="tool" data-remove="${a.user_id}">[x]</button>`:''}</span></li>`).join('');
    const available = users.filter(u => u.id !== current.owner_id && !current.access.some(a=>a.user_id===u.id));
    pop.innerHTML = `<div class="pop-head"><span class="mono">who has access</span><button class="tool" data-action="share">[close]</button></div>
      <ul><li><span class="who"><span class="dot full"></span>${escape(current.owner_name.toLowerCase())}${owner?' (you)':''}</span><span class="mono">owner</span></li>${listed}</ul>
      ${owner ? `<form id="shareForm"><label class="sr" for="shareIn">demo collaborator</label>
      <select id="shareIn" class="field" aria-label="demo collaborator" ${available.length?'':'disabled'}>${available.map(u=>`<option value="${u.id}">${escape(u.name.toLowerCase())}</option>`).join('')}</select>
      <select id="shareRole" class="sel" aria-label="permission"><option value="edit" ${shareRole==='edit'?'selected':''}>can edit</option><option value="view" ${shareRole==='view'?'selected':''}>can view</option></select>
      <button class="pill" type="submit" ${available.length?'':'disabled'}>grant</button></form>` : '<p class="mono">only the owner can change access</p>'}`;
    pop.hidden = false;
  }
  function renderDoc() {
    const d = current;
    $('doc').hidden = !d;
    $('empty').hidden = !!d;
    if (!d) return;
    title.value = d.title === 'untitled' ? '' : d.title;
    title.readOnly = !editable();
    selectedImage = null;
    $('imageControls').hidden = true;
    editor.innerHTML = d.content && d.content !== '<p><br></p>' ? d.content : '';
    editor.querySelectorAll('img').forEach(img=>img.setAttribute('draggable','true'));
    editor.contentEditable = editable() ? 'true' : 'false';
    editor.setAttribute('aria-readonly', String(!editable()));
    document.querySelectorAll('.toolbar [data-cmd],.toolbar [data-block],#renameBtn').forEach(b=>b.disabled=!editable());
    $('imgInput').disabled = !editable();
    $('imgTool').classList.toggle('off',!editable());
    updateWordCount();renderMeta();renderShare();renderLists();
  }
  async function openDoc(id) {
    if (current?.id === id) return;
    await save();
    current = await api(`/api/documents/${id}?user_id=${me}`);
    dirty = false;shareOpen = false;versionsOpen = false;
    $('versionsPop').hidden=true;
    sessionStorage.setItem('ruth-docs-active',String(id));
    renderDoc();
  }
  async function save() {
    clearTimeout(saveTimer);
    if (!current || !dirty || !editable() || saving) return;
    saving = true;renderMeta();
    const id=current.id, body={user_id:me,title:title.value.trim() || 'untitled',content:editor.innerHTML};
    try {
      await api(`/api/documents/${id}`,json('PATCH',body));
      if (current?.id===id) {current.title=body.title;current.content=body.content;current.updated_at=new Date().toISOString(); dirty=false;renderMeta();}
      await loadDocs();
    } catch(err) {notice(err.message);throw err;}
    finally {saving=false;renderMeta();}
  }
  async function refreshDoc() {
    if (!current) return;
    const id = current.id;
    current = await api(`/api/documents/${id}?user_id=${me}`);
    renderDoc();
  }
  async function newDoc() {
    await save();
    const d = await api('/api/documents',json('POST',{user_id:me,title:'untitled'}));
    await loadDocs();await openDoc(d.id);
    title.focus();title.select();
  }
  async function switchUser(id) {
    await save(); me=id;current=null;dirty=false;shareOpen=false;versionsOpen=false;
    $('versionsPop').hidden=true;renderSession();
    sessionStorage.removeItem('ruth-docs-active');
    await loadDocs();
    if (docs.length) await openDoc(docs[0].id); else await openLanding();
  }
  async function grant(id,permission) {
    if (!current?.is_owner || !id) return;
    await api(`/api/documents/${current.id}/share`,json('POST',{user_id:me,target_user_id:Number(id),role:permission}));
    notice(`shared with ${userName(Number(id))}`);await refreshDoc();await loadDocs();
  }
  async function remove(id) {
    if (!current?.is_owner) return;
    await api(`/api/documents/${current.id}/share/${id}?user_id=${me}`,{method:'DELETE'});
    notice('access removed');await refreshDoc();await loadDocs();
  }
  async function importFile(file) {
    if (!file) return;
    // A picker can be overridden. Enforce the text-only boundary here too.
    if (!/\.(txt|md)$/i.test(file.name)) throw Error('Upload accepts only .txt and .md. Use [+ image] for pictures.');
    const form = new FormData();form.append('file',file);form.append('user_id',me);
    const d = await api('/api/import',{method:'POST',body:form});
    await loadDocs();await openDoc(d.id);
    notice('imported '+file.name);
  }
  function resizeImage(file) {
    if (!file.type.startsWith('image/')) return Promise.reject(Error('Use [+ image] to choose an image file'));
    return new Promise((resolve,reject)=>{
      const img=new Image(),url=URL.createObjectURL(file);
      img.onload=()=>{
        URL.revokeObjectURL(url);
        const scale=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        let src=canvas.toDataURL('image/jpeg',0.72);
        if (src.length>MAX_IMAGE_BYTES) src=canvas.toDataURL('image/jpeg',0.4);
        src.length>MAX_IMAGE_BYTES?reject(Error('Image too large. Try a smaller picture.')):resolve(src);
      };
      img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not read image'));};
      img.src=url;
    });
  }
  function imageFigure(img) {
    let figure = img.closest('figure');
    if (!figure) {
      figure = document.createElement('figure');
      figure.dataset.align = 'center';
      const parent = img.parentElement;
      if (parent?.tagName === 'P' && parent.textContent.trim() === '' && parent.querySelectorAll('img').length === 1) {
        parent.replaceWith(figure);
      } else {
        img.before(figure);
      }
      figure.appendChild(img);
      changed();
    }
    return figure;
  }
  function selectImage(img) {
    if (selectedImage) selectedImage.classList.remove('selected-image');
    selectedImage = img && editor.contains(img) && editable() ? img : null;
    $('imageControls').hidden = !selectedImage;
    if (selectedImage) {
      selectedImage.classList.add('selected-image');
      const fig = imageFigure(selectedImage);
      $('imageSize').value = Math.min(700, Math.max(120,Number(selectedImage.getAttribute('width'))||400));
      document.querySelectorAll('[data-img-align]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.imgAlign===fig.dataset.align)));
    }
  }
  function insertImage(src) {
    if (!editable()) return;
    editor.focus();
    document.execCommand('insertHTML',false,'<figure data-align="center"><img src="'+escape(src)+'" alt="Inserted image" width="400"></figure><p><br></p>');
    const imgs = [...editor.querySelectorAll('img')];
    if (imgs.length) {imgs[imgs.length-1].setAttribute('draggable','true');selectImage(imgs[imgs.length-1]);}
    changed();
  }
  function setImageWidth(px) {
    if (!selectedImage || !editable()) return;
    selectedImage.setAttribute('width',String(Math.max(120, Math.min(700,Number(px)||400))));
    changed();
  }
  function setImageAlignment(where) {
    if (!selectedImage || !editable()) return;
    imageFigure(selectedImage).dataset.align = where;
    selectImage(selectedImage);changed();
  }
  // Fast center-crop presets keep this assessment prototype deliberately small.
  async function cropImage(ratio) {
    if (!selectedImage || !editable()) return;
    const target = selectedImage;
    const source = new Image();
    source.src = target.src;
    await source.decode();
    const w = source.naturalWidth, h = source.naturalHeight;
    const cropW = Math.min(w,h*ratio), cropH = Math.min(h,w/ratio);
    const out = document.createElement('canvas');
    const scale = Math.min(1,1000/Math.max(cropW,cropH));
    out.width = Math.max(1,Math.round(cropW*scale));
    out.height = Math.max(1,Math.round(cropH*scale));
    out.getContext('2d').drawImage(source,(w-cropW)/2,(h-cropH)/2,cropW,cropH,0,0,out.width,out.height);
    let data = out.toDataURL('image/jpeg',.74);
    if (data.length>MAX_IMAGE_BYTES) data=out.toDataURL('image/jpeg',.4);
    if (data.length>MAX_IMAGE_BYTES) throw Error('Cropped image is too large to save');
    target.src=data;changed();notice('image cropped · center');
  }
  function moveImage(direction) {
    if (!selectedImage || !editable()) return;
    const fig=imageFigure(selectedImage);
    const other=direction==='up'?fig.previousElementSibling:fig.nextElementSibling;
    if (!other) {notice('image is already at the edge');return;}
    if (direction==='up') other.before(fig); else other.after(fig);
    changed();
  }
  function format(cmd,block) {
    if (!editable()) return;
    editor.focus();
    if (block) document.execCommand('formatBlock',false,`<${block}>`);
    else document.execCommand(cmd,false,null);
    changed();
  }
  function handleError(fn) {return async (...args)=>{try{await fn(...args);}catch(e){notice(e.message);}};}
  async function init() {
    users=await api('/api/users');
    const savedUser=Number(sessionStorage.getItem('ruth-docs-demo-user'));
    const returning=users.some(u=>u.id===savedUser);
    me=returning?savedUser:1;
    renderSession();
    if(returning) await openLanding();else showLogin();
    document.addEventListener('click',handleError(async e=>{
      const b=e.target.closest('button');if(!b) return;
      if(b.dataset.loginUser)return chooseLogin(Number(b.dataset.loginUser));
      if(b.dataset.restoreVersion)return restoreVersion(Number(b.dataset.restoreVersion));
      if (b.dataset.imgAlign) return setImageAlignment(b.dataset.imgAlign);
      if (b.dataset.imgCrop) return cropImage(Number(b.dataset.imgCrop));
      if (b.dataset.imgMove) return moveImage(b.dataset.imgMove);
      if (b.dataset.imgDeselect) return selectImage(null);
      if (b.dataset.open) return openDoc(Number(b.dataset.open));
      if (b.dataset.filter) {filter=b.dataset.filter;return renderLists();}
      if (b.dataset.toggle) {const a=current?.access.find(x=>x.user_id===Number(b.dataset.toggle));return a && grant(a.user_id,a.role==='edit'?'view':'edit');}
      if (b.dataset.remove) return remove(Number(b.dataset.remove));
      if (b.dataset.action==='new') return newDoc();
      if (b.dataset.action==='save') {await save();notice('saved');return;}
      if (b.dataset.action==='rename') {title.focus();title.select();return;}
      if(b.dataset.action==='switch-account')return showLogin();
      if(b.dataset.action==='save-version')return saveVersion();
      if(b.dataset.action==='history') {versionsOpen=!versionsOpen;shareOpen=false;renderShare();return renderVersions();}
      if (b.dataset.action==='share') {shareOpen=!shareOpen;versionsOpen=false;$('versionsPop').hidden=true;$('historyBtn').setAttribute('aria-expanded','false');return renderShare();}
    }));
    document.addEventListener('submit',handleError(async e=>{
      if(e.target.id!=='shareForm')return;
      e.preventDefault();shareRole=$('shareRole').value;await grant($('shareIn').value,shareRole);
    }));
    $('upload').addEventListener('change',handleError(async e=>{const files=[...e.target.files];e.target.value='';for(const file of files) await importFile(file);}));
    $('imgInput').addEventListener('change',handleError(async e=>{const f=e.target.files?.[0];e.target.value='';if(f)insertImage(await resizeImage(f));}));
    title.addEventListener('input',changed);editor.addEventListener('input',changed);
    $('imageSize').addEventListener('input',e=>setImageWidth(e.target.value));
    editor.addEventListener('click',e=>{const img=e.target.closest('img');if(img)selectImage(img);});
    // Drag an image onto another document block to reorder it.
    editor.addEventListener('dragstart',e=>{
      const img=e.target.closest('img');
      if (!img || !editable()) return;
      selectImage(img);draggedFigure=imageFigure(img);
      e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','ruth-docs-image');
    });
    editor.addEventListener('dragover',e=>{if(draggedFigure){e.preventDefault();e.dataTransfer.dropEffect='move';}});
    editor.addEventListener('drop',e=>{
      if (!draggedFigure) return;
      e.preventDefault();
      const target=e.target.closest('figure,p,div,h1,h2,h3,ul,ol,blockquote');
      if (target && target!==draggedFigure && editor.contains(target) && !draggedFigure.contains(target)) {
        const rect=target.getBoundingClientRect();
        if(e.clientY < rect.top+rect.height/2) target.before(draggedFigure); else target.after(draggedFigure);
        changed();
      }
      draggedFigure=null;
    });
    editor.addEventListener('dragend',()=>{draggedFigure=null;});
    document.querySelector('.toolbar').addEventListener('mousedown',e=>{const b=e.target.closest('[data-cmd],[data-block]');if(!b || b.disabled)return;e.preventDefault();format(b.dataset.cmd,b.dataset.block);});
    document.querySelector('.toolbar').addEventListener('keydown',e=>{const b=e.target.closest('[data-cmd],[data-block]');if(b && (e.key==='Enter'||e.key===' ')){e.preventDefault();format(b.dataset.cmd,b.dataset.block);}});
    document.addEventListener('keydown',handleError(async e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();await save();notice('saved');}}));
    window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  }
  init().catch(e=>notice(e.message));
})();
