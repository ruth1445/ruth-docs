/* Ruth Docs: the supplied minimalist interface, connected to FastAPI + SQLite.
   Demo account switching is not authentication; use synthetic documents only. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const MAX_IMAGE_BYTES = 450000;
  let users = [], me = 1, docs = [], current = null, dirty = false;
  let filter = 'all', shareOpen = false, shareRole = 'edit', saving = false, saveTimer = null, noticeTimer;
  const editor = $('editor'), title = $('title');

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
    renderMeta();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save().catch(e => notice(e.message)), 1300);
  }
  const time = s => s ? new Date(s.endsWith('Z') ? s : s.replace(' ', 'T')+'Z').toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}).toLowerCase() : 'now';

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
    title.value = d.title;
    title.readOnly = !editable();
    editor.innerHTML = d.content || '<p><br></p>';
    editor.contentEditable = editable() ? 'true' : 'false';
    editor.setAttribute('aria-readonly', String(!editable()));
    document.querySelectorAll('.toolbar [data-cmd],.toolbar [data-block],#renameBtn').forEach(b=>b.disabled=!editable());
    $('imgInput').disabled = !editable();
    $('imgTool').classList.toggle('off',!editable());
    renderMeta();renderShare();renderLists();
  }
  async function openDoc(id) {
    if (current?.id === id) return;
    await save();
    current = await api(`/api/documents/${id}?user_id=${me}`);
    dirty = false;shareOpen = false;
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
    await save(); me=id;current=null;dirty=false;shareOpen=false;
    sessionStorage.removeItem('ruth-docs-active');
    await loadDocs();
    if (docs.length) await openDoc(docs[0].id); else renderDoc();
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
    const name = file.name.toLowerCase();
    if (/\.(txt|md|markdown)$/.test(name)) {
      const form = new FormData();form.append('file',file);form.append('user_id',me);
      const d = await api('/api/import',{method:'POST',body:form});await loadDocs();await openDoc(d.id);
    } else if (name.endsWith('.docx')) {
      if (!window.mammoth) throw Error('.docx importer could not load');
      const result = await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
      const d=await api('/api/documents',json('POST',{user_id:me,title:file.name.slice(0,-5).slice(0,120)}));
      await api(`/api/documents/${d.id}`,json('PATCH',{user_id:me,content:result.value}));
      await loadDocs();await openDoc(d.id);
    } else if (file.type.startsWith('image/')) {
      const src=await resizeImage(file);
      if (current && editable()) insertImage(src);
      else {const d=await api('/api/documents',json('POST',{user_id:me,title:file.name.slice(0,120)}));await loadDocs();await openDoc(d.id);insertImage(src);}
    } else {throw Error('Use .txt, .md, .docx or a PNG/JPEG/WebP image');}
    notice('imported '+file.name);
  }
  function resizeImage(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return Promise.reject(Error('Please choose a PNG, JPEG, or WebP image'));
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
  function insertImage(src) {
    if (!editable()) return;
    editor.focus();document.execCommand('insertHTML',false,`<img src="${escape(src)}" alt="Inserted image"><p><br></p>`);changed();
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
    $('me').replaceChildren(...users.map(u=>new Option(u.name.toLowerCase(),u.id)));
    $('me').value=String(me);
    await loadDocs();
    const saved=Number(sessionStorage.getItem('ruth-docs-active'));
    const first=docs.find(d=>d.id===saved) || docs[0];
    if (first) await openDoc(first.id); else renderDoc();
    document.addEventListener('click',handleError(async e=>{
      const b=e.target.closest('button');if(!b) return;
      if (b.dataset.open) return openDoc(Number(b.dataset.open));
      if (b.dataset.filter) {filter=b.dataset.filter;return renderLists();}
      if (b.dataset.toggle) {const a=current?.access.find(x=>x.user_id===Number(b.dataset.toggle));return a && grant(a.user_id,a.role==='edit'?'view':'edit');}
      if (b.dataset.remove) return remove(Number(b.dataset.remove));
      if (b.dataset.action==='new') return newDoc();
      if (b.dataset.action==='save') {await save();notice('saved');return;}
      if (b.dataset.action==='rename') {title.focus();title.select();return;}
      if (b.dataset.action==='share') {shareOpen=!shareOpen;return renderShare();}
    }));
    document.addEventListener('submit',handleError(async e=>{
      if(e.target.id!=='shareForm')return;
      e.preventDefault();shareRole=$('shareRole').value;await grant($('shareIn').value,shareRole);
    }));
    $('me').addEventListener('change',handleError(async e=>switchUser(Number(e.target.value))));
    $('upload').addEventListener('change',handleError(async e=>{const files=[...e.target.files];e.target.value='';for(const file of files) await importFile(file);}));
    $('imgInput').addEventListener('change',handleError(async e=>{const f=e.target.files?.[0];e.target.value='';if(f)insertImage(await resizeImage(f));}));
    title.addEventListener('input',changed);editor.addEventListener('input',changed);
    document.querySelector('.toolbar').addEventListener('mousedown',e=>{const b=e.target.closest('[data-cmd],[data-block]');if(!b || b.disabled)return;e.preventDefault();format(b.dataset.cmd,b.dataset.block);});
    document.querySelector('.toolbar').addEventListener('keydown',e=>{const b=e.target.closest('[data-cmd],[data-block]');if(b && (e.key==='Enter'||e.key===' ')){e.preventDefault();format(b.dataset.cmd,b.dataset.block);}});
    document.addEventListener('keydown',handleError(async e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();await save();notice('saved');}}));
    window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  }
  init().catch(e=>notice(e.message));
})();
