const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let uploading=false;const findingDrafts=new Map();
let ready=false,job=null,jobs=[],guide,findings=[],plan=null,busy=false,previousFocus=null,choosingJob=false,jobSelection=0,findingsGeneration=0,findingsLoading=false,planning=false;
let initializing=null,initializationError='The guidance chat is unavailable. Use search or the rule register.';
const uuid=()=>crypto.randomUUID(),money=n=>'£'+Number(n).toFixed(2);
async function api(path,body){const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},...(path==='chat'?{keepalive:true}:{}),...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'The service is unavailable.'),{status:r.status});return data;}
function message(id,text){if($(id)&&$(id).textContent!==text)$(id).textContent=text;}
const findingDraftKey=f=>JSON.stringify([f.evidenceSource?.jobId,f.evidenceSource?.round,f.evidenceSource?.assessmentRevision,f.ruleId]);
function historyKey(){return 'torbay-guidance-conversation:'+ (job?.id||'guide');}
function history(){try{return JSON.parse(sessionStorage.getItem(historyKey())||'[]');}catch{return [];}}
function storeHistory(items){try{sessionStorage.setItem(historyKey(),JSON.stringify(items.slice(-12)));}catch{}}
function saved(key,value){try{if(value===undefined)return sessionStorage.getItem(key);if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,value);}catch{}return null;}
function clearSubmittedDraft(key,draft){if(saved(key+':draft')===draft)saved(key+':draft',null);if(historyKey()===key&&$('assistant-question').value===draft)$('assistant-question').value='';}
function panelChanged(){document.dispatchEvent(new Event('torbay:guidance-panel-change'));}
function evidenceHtml(items){return items?.length?'<ul class="assistant-evidence">'+items.map(v=>'<li><strong>'+esc(v.document)+' · '+esc(v.locator)+'</strong><blockquote>'+esc(v.quote)+'</blockquote></li>').join('')+'</ul>':'';}
function answerHtml(a){return '<div class="assistant-answer"><p>'+esc(a.answer).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')+'</p>'+(a.rules?.length?'<div class="assistant-references"><strong>Guidance</strong><ul>'+a.rules.map(r=>'<li><a href="'+esc(r.url)+'">'+esc(r.id)+' · '+esc(r.title)+'</a>'+ (r.links?.length?'<details><summary>Original sources</summary><ul>'+r.links.map(l=>'<li><a href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.label)+'</a></li>').join('')+'</ul></details>':'')+'</li>').join('')+'</ul></div>':'')+evidenceHtml(a.evidence)+'</div>';}
function renderChat(){const list=history();$('assistant-conversation').innerHTML=list.map(h=>'<section class="assistant-turn"><h3>'+esc(h.question)+'</h3>'+answerHtml(h.response||{answer:h.answer})+'</section>').join('')||'<p class="assistant-empty">Ask about a drainage requirement, a Torbay criterion or the evidence needed for a check.</p>';showLatest();}
function appendAnswer(question,response){const c=$('assistant-conversation');if(!c.querySelector('.assistant-turn'))c.innerHTML='';c.insertAdjacentHTML('beforeend','<section class="assistant-turn"><h3>'+esc(question)+'</h3>'+answerHtml(response)+'</section>');showLatest();}
function showLatest(){const c=$('assistant-conversation'),t=c.querySelector('.assistant-turn:last-of-type');c.scrollTop=t?t.offsetTop-c.offsetTop:0;}
function openPanel(question='',focus=true){
 ensureInitialized();
 if(focus)previousFocus=document.activeElement;document.body.classList.add('guidance-open');panelChanged();if(!$('guidance-dialog').open)$('guidance-dialog').show();saved('torbay-guidance-open','true');$('guidance-launcher').setAttribute('aria-expanded','true');$('assistant-page').textContent=$('page-title')?.textContent||'Drainage and SuDS';renderChat();
 $('assistant-question').value=question||saved(historyKey()+':draft')||'';if(focus)$('assistant-question').focus();
}
function closePanel(){$('guidance-dialog').close();document.body.classList.remove('guidance-open');saved('torbay-guidance-open',null);$('guidance-launcher').setAttribute('aria-expanded','false');panelChanged();previousFocus?.focus();}
function addShell(){
 if(!$('guidance-launcher'))document.body.insertAdjacentHTML('beforeend','<button id="guidance-launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="guidance-dialog">Ask drainage guidance</button>');
 document.body.insertAdjacentHTML('beforeend',`
 <dialog id="guidance-dialog" aria-labelledby="assistant-heading"><div class="assistant-heading"><div><p class="eyebrow">Drainage and SuDS</p><h2 id="assistant-heading">Ask drainage guidance</h2></div><button id="assistant-close" type="button" class="secondary" aria-label="Close drainage guidance">Close</button></div>
 <div class="assistant-context"><span>Viewing: <strong id="assistant-page"></strong></span><label for="assistant-job">Use evidence from</label><select id="assistant-job"><option value="">Guidance only</option></select><p id="assistant-job-detail"></p></div>
 <div id="assistant-conversation" class="assistant-conversation" aria-live="polite" aria-relevant="additions"></div>
 <form id="assistant-form"><label class="visually-hidden" for="assistant-question">Your question</label><textarea id="assistant-question" maxlength="2000" rows="2" required placeholder="For example, what evidence is needed for a soakaway?"></textarea><div class="button-row"><button id="assistant-send" type="submit">Ask</button><button id="assistant-clear" type="button" class="text-button">Clear conversation</button></div><p id="assistant-status" role="status"></p><p class="assistant-footnote">Answers use this guide, checked 1 October 2026. Follow the sources and check the original evidence.</p></form></dialog>`);
 $('guidance-launcher').addEventListener('click',()=>openPanel());$('assistant-close').addEventListener('click',closePanel);
 $('guidance-dialog').addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();closePanel();}});
 $('assistant-question').addEventListener('input',()=>saved(historyKey()+':draft',$('assistant-question').value));
 $('assistant-clear').addEventListener('click',()=>{if(busy)return;storeHistory([]);renderChat();message('assistant-status','Conversation cleared.');});
 $('assistant-job').addEventListener('change',async()=>{try{await chooseJob($('assistant-job').value);renderChat();message('assistant-status','');}catch(err){message('assistant-status',err.message);}});
 $('assistant-form').addEventListener('submit',ask);
 const home=document.querySelector('.pg-home .search-panel');if(home&&!document.querySelector('.home-guidance'))home.insertAdjacentHTML('afterend',`<section class="home-guidance" aria-labelledby="home-guidance-heading"><div><h2 id="home-guidance-heading">Ask drainage guidance</h2><p>Find the relevant rule and the evidence to check.</p></div><form id="home-guidance-form"><label class="visually-hidden" for="home-guidance-question">Your drainage question</label><input id="home-guidance-question" maxlength="2000" placeholder="Ask a question about drainage"><button type="submit">Ask</button></form><p id="home-guidance-status" role="status"></p></section>`);
 $('home-guidance-form')?.addEventListener('submit',ev=>{ev.preventDefault();openPanel($('home-guidance-question').value);if($('assistant-question').value.trim())$('assistant-form').requestSubmit();});
}
async function ask(event){
 event.preventDefault();if(busy||choosingJob||uploading)return;const draft=$('assistant-question').value,question=draft.trim();if(!question)return;
 if(saved('torbay-guidance-pending')){await recoverQuestion();return;}
 if(!ready&&!initializing)ensureInitialized();
 if(!ready&&initializing){busy=true;$('assistant-send').disabled=true;message('assistant-status','Connecting to drainage guidance…');try{await initializing;}finally{busy=false;$('assistant-send').disabled=false;}if(!ready){message('assistant-status',initializationError);return;}}
 if($('guidance-dialog').open&&$('guidance-dialog').contains(document.activeElement))$('assistant-question').focus();
 busy=true;$('assistant-clear').disabled=true;$('assistant-send').disabled=true;$('assistant-job').disabled=true;message('assistant-status','Looking up the guidance'+(job?' and '+job.reference:'')+'…');
 const selectedJob=job?.id||null,requestId=uuid(),earlier=history(),key=historyKey();
 saved('torbay-guidance-pending',JSON.stringify({requestId,question,key,draft,started:Date.now()}));
 try{const response=await api('chat',{question,page:location.pathname,jobId:selectedJob,requestId,history:earlier.slice(-2).map(h=>({question:String(h.question).slice(0,1200),answer:String(h.response?.answer||h.answer||'').slice(0,2000)}))});saved(key,JSON.stringify([...earlier,{question,response}].slice(-12)));saved('torbay-guidance-pending',null);clearSubmittedDraft(key,draft);if(historyKey()===key)appendAnswer(question,response);message('assistant-status','Answer ready.');}
 catch(err){if(err.status&&err.status<500)saved('torbay-guidance-pending',null);message('assistant-status',err.message);}finally{busy=false;$('assistant-clear').disabled=false;$('assistant-send').disabled=choosingJob;$('assistant-job').disabled=reviewing||planning;}
}
async function recoverQuestion(){
 let pending;try{pending=JSON.parse(saved('torbay-guidance-pending')||'null');}catch{}if(!pending)return;
 busy=true;$('assistant-clear').disabled=true;$('assistant-send').disabled=true;$('assistant-job').disabled=true;message('assistant-status','Finishing your earlier question…');
 try{let response;do{try{response=await api('chat-result?id='+encodeURIComponent(pending.requestId));}catch(err){if(err.status===404&&Date.now()-pending.started<10000){await new Promise(resolve=>setTimeout(resolve,1000));continue;}throw err;}if(!response.pending)break;if(Date.now()-pending.started<190000)await new Promise(resolve=>setTimeout(resolve,2000));}while(Date.now()-pending.started<190000);
  if(!response||response.pending)throw Error('The earlier answer has not arrived. Reload to check again. No repeat request has been sent.');
  let list;try{list=JSON.parse(saved(pending.key)||'[]');}catch{list=[];}saved(pending.key,JSON.stringify([...list,{question:pending.question,response}].slice(-12)));saved('torbay-guidance-pending',null);clearSubmittedDraft(pending.key,pending.draft??pending.question);if(historyKey()===pending.key)appendAnswer(pending.question,response);message('assistant-status','Answer ready.');
 }catch(err){if([401,404,409].includes(err.status))saved('torbay-guidance-pending',null);message('assistant-status',err.message);}finally{busy=false;$('assistant-clear').disabled=false;$('assistant-send').disabled=choosingJob;$('assistant-job').disabled=reviewing||planning;}
}
function evidenceOption(j){
 const reference=String(j.reference||'Uploaded reports').replace(/\s+/g,' ').trim()||'Uploaded reports',letters=Array.from(reference);
 const label=letters.length>24?letters.slice(0,23).join('')+'…':reference;
 return '<option value="'+esc(j.id)+'" title="'+esc(reference+' · '+(j.revision||''))+'">'+esc(label)+'</option>';
}
async function refreshJobs(){jobs=await api('jobs');$('assistant-job').innerHTML='<option value="">Guidance only</option>'+jobs.map(evidenceOption).join('');$('assistant-job').value=job?.id||'';}
async function chooseJob(id,fromUpload=false){
 if(uploading&&!fromUpload){$('assistant-job').value=job?.id||'';throw Error('Wait for the report upload to finish before switching evidence.');}
 if((reviewing||planning)&&id!==job?.id){$('assistant-job').value=job?.id||'';throw Error('Finish or stop the current review before switching jobs.');}
 const selection=++jobSelection;choosingJob=true;++findingsGeneration;findings=[];findingsLoading=false;$('assistant-send').disabled=true;if($('report-run')){$('report-run').disabled=true;delete $('report-run').dataset.confirm;$('report-run').textContent='Prepare preliminary review';}renderFindings();
 try{
  const next=id?await api('job?id='+encodeURIComponent(id)):null;
  if(selection!==jobSelection)return job;
  if(id!==job?.id)reviewRef=null;job=next;
  try{if(id)sessionStorage.setItem('torbay-current-evidence-job',id);else sessionStorage.removeItem('torbay-current-evidence-job');}catch{}
  $('assistant-job').value=id||'';if(ready||!$('guidance-dialog').open)$('assistant-question').value=saved(historyKey()+':draft')||'';$('assistant-job-detail').textContent=job?job.reference+' · Documents: '+job.documents.map(d=>d.name).join(', ')+' · '+job.revision:'Upload reports in Assess an application to ask about a job.';
  if($('evidence-job-summary')){renderJob();await loadFindings();}return job;
 }catch(error){if(selection!==jobSelection)return job;$('assistant-job').value=job?.id||'';throw error;}
 finally{if(selection===jobSelection){choosingJob=false;$('assistant-send').disabled=busy;if($('report-run'))$('report-run').disabled=reviewing||planning;renderFindings();}}
}

function addReview(){
 const anchor=document.querySelector('#case-workspace .case-bar');if(!anchor||$('report-review'))return;
 anchor.insertAdjacentHTML('afterend',`<section class="report-review case-panel" id="report-review" aria-labelledby="report-review-heading"><div class="section-heading"><div><p class="eyebrow">Report evidence</p><h2 id="report-review-heading">Review uploaded evidence</h2></div><button type="button" id="review-guidance" class="secondary">Ask about this job</button></div>
 <p>Upload text-based reports to prepare a finding for each of the 126 checks. Review and accept each finding before it enters the assessment.</p>
 <details id="report-upload-panel" class="report-upload"><summary>Upload reports</summary><form id="report-upload-form"><div class="form-grid"><div><label for="report-revision">Report titles and revisions</label><input id="report-revision" required maxlength="300" placeholder="Drainage strategy, Rev B, 2 October 2026"></div><div><label for="report-files">PDF or Word .docx reports</label><input id="report-files" type="file" accept=".pdf,.docx" multiple required><p class="note">Up to three reports, 20 MB each. Scans, drawings and images need a manual check.</p></div></div>
 <label class="choice"><input type="checkbox" id="report-permission" required><span>These reports are published or anonymised and may be sent to OpenAI for this review.</span></label><details class="report-data-note"><summary>How the reports are used</summary><p>Readable text is sent to the answer service. Reports are available only in this browser’s session for seven days. OpenAI may retain abuse-monitoring logs for up to 30 days. Do not upload confidential or personal information. Word references identify sections and paragraphs, rather than page numbers.</p></details><button type="submit" id="report-upload">Read and upload reports</button></form></details>
 <p id="report-upload-status" role="status"></p><div id="evidence-job-summary"></div><div id="review-plan" hidden><p id="review-cost"></p><div class="button-row"><button type="button" id="report-run">Prepare preliminary review</button><button type="button" id="report-stop" class="secondary" hidden>Stop after this section</button></div><progress id="report-progress" max="126" value="0" aria-label="Checks reviewed"></progress><p id="report-status" role="status"></p></div>
 <details id="preliminary-results" hidden><summary id="preliminary-heading">Preliminary findings</summary><div class="preliminary-filter"><label for="preliminary-filter">Show</label><select id="preliminary-filter"><option value="all">All checks</option><option value="information">More information needed</option><option value="met">Evidence supports the check</option><option value="not-met">Conflict with the check</option><option value="na">Suggested not applicable</option><option value="unreviewed">Not reviewed</option></select></div><div id="preliminary-list"></div></details></section>`);
 $('report-upload-form').addEventListener('submit',upload);$('report-run').addEventListener('click',review);$('report-stop').addEventListener('click',()=>{stop=true;message('report-status','The current section will finish; remaining sections will stay unreviewed.');});
 $('report-upload-panel').addEventListener('toggle',()=>{if($('report-upload-panel').open)ensureInitialized();});
 $('review-guidance').addEventListener('click',()=>openPanel());$('preliminary-filter').addEventListener('change',renderFindings);$('preliminary-list').addEventListener('click',accept);$('preliminary-list').addEventListener('input',event=>{const m=event.target.id?.match(/^preliminary-(note|outcome)-(.+)$/),f=m&&findings.find(f=>f.ruleId===m[2]);if(!f?.evidenceSource)return;const key=findingDraftKey(f),draft=findingDrafts.get(key)||{};draft[m[1]]=event.target.value;findingDrafts.set(key,draft);});
 if(job){renderJob();loadFindings();}
}
let reviewing=false,stop=false,reviewRef=null;
function workspace(){return window.TorbayAssessmentWorkspace?.current();}
async function upload(event){
 event.preventDefault();if(reviewing||planning||choosingJob||uploading||busy)return;let current=workspace();if(!current||current.state!=='open'){message('report-upload-status','Open an assessment round before uploading.');return;}
 if(!ready){await ensureInitialized();if(!ready){message('report-upload-status',initializationError);return;}}
 if(reviewing||planning||choosingJob||uploading||busy)return;current=workspace();if(!current||current.state!=='open'){message('report-upload-status','Open an assessment round before uploading.');return;}
 const files=[...$('report-files').files];if(!files.length||files.length>3){message('report-upload-status','Select one to three reports.');return;}
 const uploadRef={ref:current.ref,round:current.round,revision:current.revision},reportRevision=$('report-revision').value,permission=$('report-permission').checked;
 const stillCurrent=()=>{const active=workspace();return active?.state==='open'&&active.ref===uploadRef.ref&&active.round===uploadRef.round&&active.revision===uploadRef.revision;};
 uploading=true;$('report-upload').disabled=true;$('report-run').disabled=true;$('assistant-job').disabled=true;renderFindings();
 try{const names=files.map(f=>f.name.trim().toLowerCase());if(new Set(names).size!==names.length)throw Error('Give each report a distinct filename, including its revision, before uploading.');const {extractReport}=await import('./report-extraction.mjs');const documents=[],totals={characters:0,sections:0};for(const file of files)documents.push(await extractReport(file,text=>message('report-upload-status',text),totals));
   if(!stillCurrent())throw Error('The assessment changed while reading the reports. Open the intended round and upload again.');
   const next=await api('upload',{reference:uploadRef.ref,revision:reportRevision,publishedOrAnonymised:permission,documents});
   await refreshJobs();if(!stillCurrent())throw Error('The reports were uploaded for '+uploadRef.ref+', but the open round changed. Select the intended assessment before using that evidence.');await chooseJob(next.id,true);message('report-upload-status','Reports ready. Check the extracted text below before starting the review.');$('report-files').value='';$('report-upload-panel').open=false;
 }catch(err){message('report-upload-status',err.message);}finally{uploading=false;$('report-upload').disabled=false;$('report-run').disabled=reviewing||planning||choosingJob;$('assistant-job').disabled=busy||reviewing||planning;renderFindings();}
}
function renderJob(){if(!job){$('evidence-job-summary').innerHTML='';$('review-plan').hidden=true;return;}
 const warnings=job.documents.flatMap(d=>d.segments.filter(s=>s.unreadable).map(s=>d.name+' · '+s.locator));
 $('evidence-job-summary').innerHTML='<div class="uploaded-job"><h3>'+esc(job.reference)+' · '+esc(job.revision)+'</h3><p>'+job.documents.length+' report'+(job.documents.length===1?'':'s')+' ready.</p>'+(warnings.length?'<p class="report-warning"><strong>Manual evidence checks needed:</strong> '+warnings.map(esc).join('; ')+'.</p>':'')+'<details><summary>Check the extracted report text</summary>'+job.documents.map(d=>'<section class="extracted-report"><h4>'+esc(d.name)+'</h4>'+d.segments.map(s=>'<details id="evidence-'+esc(s.id)+'"><summary>'+esc(s.locator)+(s.unreadable?' · no readable evidence':'')+'</summary><p class="preserve-lines">'+esc(s.text||'No readable text. Check the original page or image.')+'</p></details>').join('')+'</section>').join('')+'</details></div>';
 $('review-plan').hidden=false;message('review-cost','Shared spending limit: £2 across testing and use. The request allowance will be checked before starting.');
}
async function loadFindings(){
 const selected=job?.id,request=++findingsGeneration;findings=[];findingsLoading=true;renderFindings();
 try{const result=selected?await api('results?id='+encodeURIComponent(selected)):{findings:[]};if(request!==findingsGeneration||selected!==job?.id)return;if(selected&&(result.jobId!==selected||result.revision!==job.revision))throw Error('The recovered findings do not match the selected report revision.');findings=result.findings.map(f=>({...f,evidenceSource:{ref:job?.reference,jobId:result.jobId,revision:result.revision,round:f.reviewRound||1,assessmentRevision:f.assessmentRevision}}));const current=workspace();if(guide?.version)findings=findings.filter(f=>f.guidanceVersion===guide.version);if(current)findings=findings.filter(f=>(f.reviewRound||1)===current.round&&(!f.assessmentRevision||f.assessmentRevision===current.revision));}
 finally{if(request===findingsGeneration){findingsLoading=false;renderFindings();}}
}

function findingNote(f){return [f.finding,...f.evidence.map(v=>v.document+' · '+v.locator+': “'+v.quote+'”'),f.unresolved?'Next check: '+f.unresolved:'','Guidance: '+f.ruleId+' · '+f.guidanceVersion,'Reports: '+(f.evidenceSource?.revision||job.revision)].filter(Boolean).join('\n\n');}
function renderFindings(){if(!$('preliminary-results'))return;const by=new Map(findings.map(f=>[f.ruleId,f])),current=workspace(),filter=$('preliminary-filter').value;
 $('preliminary-results').hidden=!findings.length;$('preliminary-heading').textContent='Preliminary findings · '+findings.length+' of 126 checks prepared';$('report-progress').value=findings.length;
 const labels={met:'Evidence supports the check',information:'More information needed','not-met':'Conflict with the check',na:'Suggested not applicable',unreviewed:'Not reviewed'};
 $('preliminary-list').innerHTML=(guide?.rules||[]).map(r=>{const f=by.get(r.id)||{ruleId:r.id,outcome:'unreviewed',finding:'No preliminary finding has been prepared.',evidence:[],unresolved:''};if(filter!=='all'&&f.outcome!==filter)return '';
 const existing=current?.checks[r.id],protectedFinding=existing&&((existing.status||'unreviewed')!=='unreviewed'||['note','applicantResponse','revisedEvidence'].some(k=>String(existing[k]||'').trim())),canAccept=!!by.has(r.id)&&f.guidanceVersion===guide.version&&!protectedFinding&&current?.ref===job?.reference&&current?.state==='open'&&(f.reviewRound||1)===current.round&&!reviewing&&!choosingJob&&!findingsLoading&&!uploading&&f.evidenceSource?.jobId===job.id&&f.evidenceSource?.revision===job.revision&&typeof f.evidenceSource?.assessmentRevision==='string'&&f.evidenceSource.assessmentRevision===current.revision;
 return `<details class="preliminary-finding"><summary><strong>${r.id}</strong><span>${esc(r.title)}</span><span class="preliminary-state">${f.outcome==='not-met'&&r.status==='rec'?'Alternative to recommendation':f.outcome==='not-met'&&r.status==='off'?'Officer issue':labels[f.outcome]}</span><span class="badge badge-${r.status}">${({req:'Requirement',cond:'Conditional',rec:'Recommendation',tby:'Torbay criterion',off:'Officer guidance'})[r.status]}</span></summary><div class="preliminary-body"><p>${esc(f.finding)}</p>${evidenceHtml(f.evidence)}${f.unresolved?'<p class="report-warning"><strong>Next check:</strong> '+esc(f.unresolved)+'</p>':''}<p><a href="/${r.topicSlug}/#${r.id}">Read ${r.id} and its sources</a> · <a href="${r.evidenceUrl}">Evidence guide</a></p>${canAccept?`<label for="preliminary-note-${r.id}">Your finding and evidence</label><textarea id="preliminary-note-${r.id}" rows="5">${esc(findingNote(f))}</textarea><label for="preliminary-outcome-${r.id}">Outcome to record</label><select id="preliminary-outcome-${r.id}"><option value="">Choose after checking the evidence</option><option value="met">${r.status==='rec'?'Recommendation followed':r.status==='off'?'Check completed':'Satisfied'}</option><option value="information">More information needed</option><option value="not-met">${r.status==='rec'?'Alternative approach':r.status==='off'?'Issue identified':'Not satisfied'}</option><option value="na">Not applicable</option></select><button type="button" data-accept-finding="${r.id}" aria-label="Accept ${r.id} · ${esc(r.title)} into the assessment">Accept this finding</button>`:protectedFinding?'<p class="note">An engineer’s finding is already recorded. Edit it in Checks.</p>':by.has(r.id)?'<p class="note">Open the matching assessment and an active round to accept this finding.</p>':''}<p id="preliminary-message-${r.id}" role="status"></p></div></details>`;
 }).join('');
 for(const f of findings){const draft=findingDrafts.get(findingDraftKey(f));if(!draft)continue;if($('preliminary-note-'+f.ruleId)&&draft.note!==undefined)$('preliminary-note-'+f.ruleId).value=draft.note;if($('preliminary-outcome-'+f.ruleId)&&draft.outcome!==undefined)$('preliminary-outcome-'+f.ruleId).value=draft.outcome;}
}
async function review(){
 if(reviewing||planning||choosingJob||findingsLoading||uploading||!job)return;const current=workspace();if(!current||current.ref!==job.reference||current.state!=='open'){message('report-status','Open the matching assessment and an active review round.');return;}
 planning=true;$('report-run').disabled=true;$('assistant-job').disabled=true;$('report-upload').disabled=true;const plannedJob=job.id;
 try {
   if(saved('torbay-review-pending')){await recoverReview();if(saved('torbay-review-pending'))return;await loadFindings();}
   plan=await api('review-plan',{jobId:plannedJob,applicationType:current.type,reviewRound:current.round,assessmentRevision:current.revision});
   const active=workspace();if(job?.id!==plannedJob||active?.ref!==current.ref||active?.round!==current.round||active?.revision!==current.revision||active?.state!=='open'){message('report-status','The assessment changed. Prepare the review again for the current job.');return;}
   findings=findings.filter(f=>(f.reviewRound||1)===current.round);const pending=plan.batches.filter(b=>b.ids.some(id=>!findings.some(f=>f.ruleId===id&&f.guidanceVersion===guide.version&&f.assessmentRevision===current.revision))),remainingBound=pending.reduce((n,b)=>n+b.boundUnits,0)/1e6;
   if(!pending.length){message('report-status','All 126 preliminary checks are ready. Review each finding below.');return;}
   message('review-cost','Remaining request allowance: '+money(plan.budget.availableUnits/1e6)+'. Maximum reserved for the remaining sections: '+money(remainingBound)+'. Unused reservations are released after confirmed responses.');
   if(remainingBound>plan.budget.availableUnits/1e6){message('report-status','The shared £2 allowance cannot cover the maximum cost of this complete review. Use fewer or shorter reports, or continue with the manual checks. No review has started.');return;}
   // First click prepares the concrete allowance; a second starts the paid review.
   const confirmation=JSON.stringify([job.id,current.round,current.revision]);if($('report-run').dataset.confirm!==confirmation){$('report-run').dataset.confirm=confirmation;$('report-run').textContent='Start review — up to '+money(remainingBound);message('report-status','Check the allowance above, then press Start review.');return;}
   reviewing=true;$('assistant-job').disabled=true;stop=false;reviewRef={ref:current.ref,round:current.round,jobId:job.id,revision:job.revision,assessmentRevision:current.revision};$('report-run').disabled=true;$('report-upload').disabled=true;$('report-stop').hidden=false;
   renderFindings();const j=job;
   for(const b of pending){if(stop)break;message('report-status','Checking '+b.title+' · '+findings.length+' of 126 findings ready…');
     const body={jobId:j.id,batch:b.index,applicationType:current.type,reviewRound:current.round,assessmentRevision:current.revision,requestId:uuid()};saved('torbay-review-pending',JSON.stringify({...body,started:Date.now()}));
     let result;try{result=await api('review',body);saved('torbay-review-pending',null);}catch(err){if(err.status&&err.status<500&&err.status!==409)saved('torbay-review-pending',null);throw err;}
     const active=workspace();if(job?.id!==reviewRef.jobId||active?.ref!==reviewRef.ref||active?.round!==reviewRef.round||active?.revision!==current.revision||active?.state!=='open'||result.jobId!==j.id||result.revision!==j.revision)throw Error('The assessment or evidence changed. The completed section is saved, but has not been added to this round.');
     result.findings=result.findings.map(f=>({...f,evidenceSource:{...reviewRef}}));
     const ids=new Set(result.findings.map(f=>f.ruleId));findings=[...findings.filter(f=>!ids.has(f.ruleId)),...result.findings];renderFindings();
   }
   message('report-status',findings.length===126?'All 126 preliminary checks are ready. Check the citations, choose each outcome and accept the findings you agree with.':'Review stopped. '+findings.length+' checks are ready; remaining checks are unreviewed.');$('preliminary-results').open=true;
 }catch(err){message('report-status',err.message+' Completed sections remain available.');}
 finally{planning=false;if(!reviewing){$('assistant-job').disabled=busy;$('report-run').disabled=choosingJob;$('report-upload').disabled=false;}if(reviewing){reviewing=false;$('assistant-job').disabled=busy;$('report-run').disabled=false;$('report-upload').disabled=false;$('report-stop').hidden=true;$('report-run').textContent='Prepare preliminary review';delete $('report-run').dataset.confirm;renderFindings();}}
}
async function recoverReview(){let pending;try{pending=JSON.parse(saved('torbay-review-pending')||'null');}catch{}if(!pending)return;
 message('report-status','Checking the saved result of the earlier review section…');try{const result=await api('review-result?id='+encodeURIComponent(pending.requestId)+'&job='+encodeURIComponent(pending.jobId));if(result.pending){message('report-status','The earlier section is still running or its outcome is uncertain. No repeat request has been sent. Try Prepare preliminary review again later.');return;}if(result.jobId!==pending.jobId||!Array.isArray(result.findings)||result.findings.some(f=>f.reviewRound!==pending.reviewRound||f.assessmentRevision!==pending.assessmentRevision))throw Error('The saved section does not match the original assessment round and submission. The request has been retained for review.');saved('torbay-review-pending',null);message('report-status','The earlier section is saved.');}
 catch(err){if([401,404,409].includes(err.status)&&!(err.status===404&&Date.now()-pending.started<10000))saved('torbay-review-pending',null);message('report-status',err.message);}
}
function accept(event){const button=event.target.closest('[data-accept-finding]');if(!button)return;const id=button.dataset.acceptFinding,f=findings.find(f=>f.ruleId===id),current=workspace();
 try{if(choosingJob||findingsLoading||reviewing||uploading)throw Error('Wait for the selected evidence to finish loading.');if(f?.guidanceVersion!==guide.version)throw Error('Prepare the review against the current guidance basis.');if(!f||!job)throw Error('Choose an available preliminary finding.');if(!f.evidenceSource||f.evidenceSource.jobId!==job.id||f.evidenceSource.revision!==job.revision||f.evidenceSource.ref!==job.reference||f.evidenceSource.round!==current?.round||typeof f.evidenceSource.assessmentRevision!=='string'||f.evidenceSource.assessmentRevision!==current?.revision)throw Error('This finding belongs to a different assessment revision or review round. Prepare the review for the current submission.');window.TorbayAssessmentWorkspace.accept(f,$('preliminary-note-'+id).value,$('preliminary-outcome-'+id).value,f.evidenceSource);findingDrafts.delete(findingDraftKey(f));renderFindings();message('report-status',id+' accepted into the assessment.');$('report-status').tabIndex=-1;$('report-status').focus();}catch(err){message('preliminary-message-'+id,err.message);}
}
addShell();document.addEventListener('torbay:workspace-ready',addReview);if(window.TorbayAssessmentWorkspace)addReview();
document.addEventListener('torbay:assessment-open',()=>{if(job)loadFindings().catch(err=>message('report-status',err.message));else renderFindings();if(workspace()&&!$('report-revision')?.value)$('report-revision').value=workspace().revision;});
document.addEventListener('torbay:assessment-basis-change',()=>{stop=true;delete $('report-run')?.dataset.confirm;renderFindings();});
function ensureInitialized(){if(initializing)return initializing;return initializing=(async()=>{try{const status=await api('status');if(status.enabled){await Promise.all([api('session',{}),$('assessment-app')?Promise.resolve(window.TorbayAssessmentWorkspace?.data()).then(async v=>{if(v){guide=v;return;}const r=await fetch('/assets/guide-data.json');if(!r.ok)throw Error('The guidance could not be loaded. Reload the page.');guide=await r.json();}):Promise.resolve()]);await refreshJobs();let selected;try{selected=sessionStorage.getItem('torbay-current-evidence-job');}catch{}if(selected&&jobs.some(j=>j.id===selected))await chooseJob(selected);ready=true;await recoverQuestion();if($('report-review'))message('report-upload-status','');}
 else{if($('report-review'))$('report-review').hidden=true;message('assistant-status',initializationError);message('home-guidance-status',initializationError);}}
catch(err){initializationError='The guidance chat could not connect. Reload the page to try again.';message('assistant-status',initializationError);message('home-guidance-status',initializationError);if($('report-upload-status'))message('report-upload-status',err.message);}})();}
if(saved('torbay-guidance-open')==='true')openPanel('',false);
document.addEventListener('torbay:assessment-open',()=>ensureInitialized());
