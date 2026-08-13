(function(){
  const C = window.WINS_CONFIG || {};
  const pad = n => String(n).padStart(2,'0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const sb = window.supabase?.createClient(C.supabaseUrl, C.supabasePublishableKey);

  function periodFor(dateInput){
    const d = typeof dateInput === 'string' ? parseDate(dateInput) : new Date(dateInput);
    const startDay = C.cycleStartDay || 15;
    const monthDate = new Date(d.getFullYear(), d.getMonth(), 1);
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), startDay);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, startDay-1);
    const label = monthDate.toLocaleDateString('en-AU',{month:'long',year:'numeric'});
    const monthName = monthDate.toLocaleDateString('en-AU',{month:'long'});
    return {month:monthDate,start,end,key:`${monthDate.getFullYear()}-${pad(monthDate.getMonth()+1)}`,label,monthName};
  }

  function currentDisplayPeriod(dateInput=new Date()){
    const d = new Date(dateInput);
    const startDay = C.cycleStartDay || 15;
    const monthDate = d.getDate() >= startDay ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), d.getMonth()-1, 1);
    return periodFor(monthDate);
  }

  const mapRow = r => ({id:r.id,text:r.win_text,name:r.person_name,department:r.department,date:r.win_date,status:r.status,createdAt:r.created_at});

  const Store = {
    async all(includeHidden=false){
      if(!sb) throw new Error('Supabase client not available.');
      let q = sb.from('wins').select('*').order('win_date',{ascending:false}).order('created_at',{ascending:false});
      if(!includeHidden) q = q.eq('status','active');
      const {data,error}=await q;
      if(error) throw error;
      return (data||[]).map(mapRow);
    },
    async add(row){
      const {error}=await sb.from('wins').insert({win_text:row.text,person_name:row.name,department:row.department,win_date:row.date});
      if(error) throw error;
    },
    async update(id,patch){
      const dbPatch={};
      if(patch.text!==undefined) dbPatch.win_text=patch.text;
      if(patch.name!==undefined) dbPatch.person_name=patch.name;
      if(patch.department!==undefined) dbPatch.department=patch.department;
      if(patch.date!==undefined) dbPatch.win_date=patch.date;
      if(patch.status!==undefined) dbPatch.status=patch.status;
      const {error}=await sb.from('wins').update(dbPatch).eq('id',id);
      if(error) throw error;
    },
    async remove(id){
      const {error}=await sb.from('wins').delete().eq('id',id);
      if(error) throw error;
    }
  };

  function winsForPeriod(rows,p){
    return rows.filter(w=>{const d=parseDate(w.date);return d.getFullYear()===p.month.getFullYear()&&d.getMonth()===p.month.getMonth();}).sort((a,b)=>parseDate(b.date)-parseDate(a.date));
  }

  function setError(target,message){ if(target){target.textContent=message;target.classList.remove('is-hidden');} }

  async function initDisplay(){
    const listView=document.querySelector('#listView'), celView=document.querySelector('#celebrationView');
    const rowsEl=document.querySelector('#winsRows');
    const p=currentDisplayPeriod(new Date());
    document.querySelector('#displayTitle').textContent=`Our ${p.monthName} wins`;
    document.querySelector('#celebrationMonth').textContent=`${p.monthName} wins`;
    let allRows=[], celIndex=0, celTimer, idleTimer;

    function render(){
      const wins=winsForPeriod(allRows,p);
      rowsEl.innerHTML=wins.length?wins.map(w=>`<article class="win-row"><div class="win-text">${esc(w.text)}</div><div class="win-person">${esc(w.name)}</div><div class="win-team">${esc(w.department)}</div></article>`).join(''):`<div class="empty-board"><div><h2>First win incoming.</h2><p>Tap “Add a win” to get the board started.</p></div></div>`;
      document.querySelector('#winCount').textContent=wins.length;
      document.querySelector('#departmentCount').textContent=new Set(wins.map(w=>w.department.trim().toLowerCase()).filter(Boolean)).size;
      renderCelebration();
    }
    function renderCelebration(){
      const wins=winsForPeriod(allRows,p);
      if(!wins.length){document.querySelector('#celebrationText').textContent='Your next win starts here.';document.querySelector('#celebrationName').textContent='';document.querySelector('#celebrationDepartment').textContent='';document.querySelector('#celebrationCounter').textContent='0 wins';return;}
      if(celIndex>=wins.length)celIndex=0;
      const w=wins[celIndex];
      document.querySelector('#celebrationText').textContent=w.text;
      document.querySelector('#celebrationName').textContent=w.name;
      document.querySelector('#celebrationDepartment').textContent=w.department;
      document.querySelector('#celebrationCounter').textContent=`${celIndex+1} of ${wins.length} wins`;
    }
    async function refresh(){
      try{ allRows=await Store.all(false); render(); }
      catch(err){ console.error(err); rowsEl.innerHTML='<div class="empty-board"><div><h2>Couldn’t load wins.</h2><p>Please check the connection and refresh.</p></div></div>'; }
    }
    function showList(){clearInterval(celTimer);celView.classList.add('is-hidden');listView.classList.remove('is-hidden');resetIdle();}
    function showCelebrate(){clearTimeout(idleTimer);listView.classList.add('is-hidden');celView.classList.remove('is-hidden');renderCelebration();startCelebrationTimer();}
    function startCelebrationTimer(){clearInterval(celTimer);celTimer=setInterval(()=>{const wins=winsForPeriod(allRows,p);if(!wins.length)return;celView.classList.add('fade');setTimeout(()=>{celIndex=(celIndex+1)%wins.length;renderCelebration();celView.classList.remove('fade');},450);},(C.celebrationSeconds||9)*1000);}
    function resetIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(showCelebrate,(C.idleSeconds||60)*1000);}

    await refresh();
    ['pointerdown','touchstart','keydown'].forEach(evt=>document.addEventListener(evt,()=>{if(!celView.classList.contains('is-hidden'))showList();else resetIdle();},{passive:true}));
    document.querySelector('[data-action="celebrate"]').addEventListener('click',e=>{e.stopPropagation();showCelebrate();});
    if(sb){ sb.channel('wins-display').on('postgres_changes',{event:'*',schema:'public',table:'wins'},()=>refresh()).subscribe(); }
    resetIdle();
  }

  async function initSubmit(){
    const date=document.querySelector('#winDate'); date.value=isoDate(new Date());
    const hint=document.querySelector('#periodHint'), text=document.querySelector('#winText'), form=document.querySelector('#winForm'), submitButton=form.querySelector('button[type="submit"]');
    const errorEl=document.querySelector('#submitError');
    function updateHint(){ const p=periodFor(date.value||isoDate(new Date())); hint.textContent=`This will appear in ${p.monthName} wins.`; }
    function count(){document.querySelector('#charCount').textContent=text.value.length;}
    date.addEventListener('change',updateHint);text.addEventListener('input',count);updateHint();count();
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(errorEl) errorEl.classList.add('is-hidden');
      const row={text:text.value.trim(),name:document.querySelector('#personName').value.trim(),department:document.querySelector('#department').value.trim(),date:date.value};
      if(!row.text||!row.name||!row.department||!row.date)return;
      submitButton.disabled=true;submitButton.textContent='Sharing…';
      try{
        await Store.add(row);
        const p=periodFor(row.date);
        form.classList.add('is-hidden');
        document.querySelector('#successMessage').textContent=`Your win has been added to ${p.label}.`;
        document.querySelector('#submitSuccess').classList.remove('is-hidden');
      }catch(err){console.error(err);setError(errorEl,'Something went wrong. Please try again.');}
      finally{submitButton.disabled=false;submitButton.textContent='Share my win';}
    });
    document.querySelector('#submitAnother').addEventListener('click',()=>{form.reset();date.value=isoDate(new Date());updateHint();count();document.querySelector('#submitSuccess').classList.add('is-hidden');form.classList.remove('is-hidden');text.focus();});
  }

  function getPeriods(rows){
    const map=new Map(); rows.forEach(r=>{const p=periodFor(r.date);map.set(p.key,p);}); const current=currentDisplayPeriod(new Date());map.set(current.key,current);return [...map.values()].sort((a,b)=>b.month-a.month);
  }

  async function initAdmin(){
    await startAdmin();
  }

  async function startAdmin(){
    const list=document.querySelector('#adminList'), search=document.querySelector('#adminSearch'), pFilter=document.querySelector('#periodFilter'), dFilter=document.querySelector('#departmentFilter'), sFilter=document.querySelector('#statusFilter');
    const dialog=document.querySelector('#editDialog'); let editing=null, allRows=[];

    function fillPeriods(){const periods=getPeriods(allRows);const selected=pFilter.value||'all';pFilter.innerHTML='<option value="all">All months</option>'+periods.map(p=>`<option value="${p.key}">${esc(p.label)}</option>`).join('');pFilter.value=[...pFilter.options].some(o=>o.value===selected)?selected:'all';}
    function fillDepartments(){const selected=dFilter.value||'all';const deps=[...new Set(allRows.map(r=>r.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b));dFilter.innerHTML='<option value="all">All departments</option>'+deps.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');dFilter.value=[...dFilter.options].some(o=>o.value===selected)?selected:'all';}
    function render(){
      fillPeriods();fillDepartments();
      const q=search.value.trim().toLowerCase();
      let rows=allRows.filter(r=>{const p=periodFor(r.date);return (pFilter.value==='all'||p.key===pFilter.value)&&(dFilter.value==='all'||r.department===dFilter.value)&&(sFilter.value==='all'||r.status===sFilter.value)&&(!q||`${r.text} ${r.name} ${r.department}`.toLowerCase().includes(q));});
      document.querySelector('#adminCount').textContent=`${rows.length} win${rows.length===1?'':'s'}`;
      list.innerHTML=rows.length?rows.map(r=>`<article class="admin-item ${r.status==='hidden'?'is-hidden-win':''}" data-id="${r.id}"><div><h3>${esc(r.text)}</h3><div class="admin-meta">${esc(r.name)} · ${esc(r.department)} · ${parseDate(r.date).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</div></div><div><span class="status-pill ${r.status==='hidden'?'hidden':''}">${r.status}</span></div><div class="admin-actions"><button class="edit">Edit</button><button class="hide">${r.status==='hidden'?'Show':'Hide'}</button><button class="delete">Delete</button></div></article>`).join(''):'<div class="form-card"><h2>No wins found.</h2><p>Try changing the filters.</p></div>';
    }
    async function refresh(){try{allRows=await Store.all(true);render();}catch(err){console.error(err);list.innerHTML='<div class="form-card"><h2>Couldn’t load admin data.</h2><p>Please check the connection and try again.</p></div>';}}
    ['input','change'].forEach(evt=>{search.addEventListener(evt,render);pFilter.addEventListener(evt,render);dFilter.addEventListener(evt,render);sFilter.addEventListener(evt,render);});
    list.addEventListener('click',async e=>{
      const item=e.target.closest('.admin-item');if(!item)return;
      const id=item.dataset.id,row=allRows.find(r=>r.id===id);if(!row)return;
      if(e.target.classList.contains('edit')){editing=id;document.querySelector('#editText').value=row.text;document.querySelector('#editName').value=row.name;document.querySelector('#editDepartment').value=row.department;document.querySelector('#editDate').value=row.date;dialog.showModal();return;}
      try{
        if(e.target.classList.contains('hide')) await Store.update(id,{status:row.status==='hidden'?'active':'hidden'});
        if(e.target.classList.contains('delete') && confirm('Delete this win permanently?')) await Store.remove(id);
        await refresh();
      }catch(err){console.error(err);alert('That change could not be saved.');}
    });
    document.querySelector('#editForm').addEventListener('submit',async e=>{
      if(e.submitter && e.submitter.value==='cancel')return;
      if(!editing)return;
      e.preventDefault();
      try{await Store.update(editing,{text:document.querySelector('#editText').value.trim(),name:document.querySelector('#editName').value.trim(),department:document.querySelector('#editDepartment').value.trim(),date:document.querySelector('#editDate').value});editing=null;dialog.close();await refresh();}catch(err){console.error(err);alert('Changes could not be saved.');}
    });
    if(sb){ sb.channel('wins-admin').on('postgres_changes',{event:'*',schema:'public',table:'wins'},()=>refresh()).subscribe(); }
    await refresh();
  }

  window.WinsApp={initDisplay,initSubmit,initAdmin,periodFor,Store};
})();
