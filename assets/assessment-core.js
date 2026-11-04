/* Record operations shared by the browser and deterministic compatibility checks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TorbayAssessment=api;})(typeof window!=='undefined'?window:this,function(){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v)),now=()=>new Date().toISOString();
const localDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function validDate(s,blank=false){if(s===''&&blank)return true;if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);if(y<1||m<1||m>12||d<1)return false;return d<=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][m-1];}
function requestOrigin(c,id){const v=c.checks?.[id]||{};return JSON.stringify({round:c.draft?.number,status:v.status||'unreviewed',note:v.note||'',basis:v.basisVersion||c.version});}
function requestStale(item,c){return !item.origin||item.origin!==requestOrigin(c,item.rule);}
const validStatus=new Set(['unreviewed','met','information','not-met','na']);
function label(rule,status){
 if(!validStatus.has(status)||status==='unreviewed')return 'Not reviewed';if(status==='information')return 'More information needed';if(status==='na')return 'Not applicable';
 if(rule.status==='rec')return status==='met'?'Recommendation followed':'Alternative approach';
 if(rule.status==='off')return status==='met'?'Check completed':'Issue identified';
 return status==='met'?'Satisfied':'Not satisfied';
}
function migrate(input,data){
 const c=clone(input);c.format='torbay-drainage-assessment';c.schema=4;c.checks=c.checks||{};c.rounds=Array.isArray(c.rounds)?c.rounds:[];c.bases=c.bases||{};c.guidancePending=c.guidancePending||{};c.guidanceReviewed=c.guidanceReviewed||[];c.rfi=Array.isArray(c.rfi)?c.rfi:[];
 let oldVersion=c.version||'Version not recorded';const old=(Object.hasOwn(c.bases,oldVersion)?c.bases[oldVersion]:null)||(Object.hasOwn(data.previousBases,oldVersion)?data.previousBases[oldVersion]:null);
 if(oldVersion===data.version&&old&&data.rules.some(r=>old.rules[r.id]?.fingerprint!==data.basis.rules[r.id].fingerprint)){
  const key=oldVersion+' · earlier captured basis '+(c.updated||c.created||now());c.bases[key]=clone(old);
  for(const v of Object.values(c.checks))if(!v.basisVersion||v.basisVersion===oldVersion)v.basisVersion=key;
  c.roundBasisAliases=c.roundBasisAliases||{};c.rounds.forEach((round,index)=>{const aliases=c.roundBasisAliases[index]||(c.roundBasisAliases[index]={});if(round.version===oldVersion||Object.values(round.checks).some(v=>v.basisVersion===oldVersion))if(!aliases[oldVersion])aliases[oldVersion]=key;});
  c.basisAliases=c.basisAliases||{};c.basisAliases[oldVersion]=key;
  oldVersion=key;
 }
 if(old&&!c.bases[oldVersion])c.bases[oldVersion]=clone(old);
 if(c.bases[data.version]&&JSON.stringify(c.bases[data.version])!==JSON.stringify(data.basis)){
  c.importedBases=c.importedBases||[];if(!c.importedBases.some(v=>JSON.stringify(v)===JSON.stringify(c.bases[data.version])))c.importedBases.push(clone(c.bases[data.version]));
 }
 c.bases[data.version]=clone(data.basis);
 if(!c.draft)c.draft={number:(c.rounds.at(-1)?.number||0)+1,revision:'',date:localDate(),state:'open',started:now()};
 Object.values(c.checks).forEach(v=>{if(!v.basisVersion)v.basisVersion=oldVersion;});
 if(oldVersion!==data.version){
  c.earlierAssessments=c.earlierAssessments||[];if(!c.earlierAssessments.some(v=>v.version===oldVersion))c.earlierAssessments.push({version:oldVersion,saved:c.updated||c.created||null,checks:clone(c.checks),conclusion:c.conclusion||'',basisKnown:!!old});
  const changed=[];for(const r of data.rules){const prior=old?.rules[r.id];if(!prior||prior.fingerprint!==data.basis.rules[r.id].fingerprint)changed.push(r.id);}
  const flags={};for(const id of changed){flags[id]={cause:'Check or cited source changed',direct:id};for(const dependency of data.dependencies[id]||[])if(!changed.includes(dependency))flags[dependency]={cause:'Depends on changed check '+id,direct:id};}
  for(const [id,f] of Object.entries(flags))c.guidancePending[id]={...f,from:oldVersion,to:data.version,detected:now(),basisKnown:!!old};
  c.version=data.version;
 }
 return c;
}
function group(rule,state={}){const s=state.status||'unreviewed';if(s==='unreviewed')return 'unreviewed';if(s==='information')return 'information';if(s==='na')return 'na';if(s==='not-met')return rule.status==='rec'?'alternatives':rule.status==='off'?'officer':rule.status==='tby'?'local':'unmet';return null;}
function summary(c,data){const result={unmet:[],local:[],information:[],alternatives:[],na:[],unreviewed:[],officer:[],reasons:[],guidance:[],revisionOutstanding:[],revisionResolved:[]};for(const r of data.rules){const v=c.checks[r.id]||{},k=group(r,v);if(k)result[k].push(r.id);if(['na','not-met','information'].includes(v.status)&&!String(v.note||'').trim())result.reasons.push(r.id);if(c.guidancePending[r.id])result.guidance.push(r.id);const f=followup(c,r.id);if(f)result[f.resolved?'revisionResolved':'revisionOutstanding'].push(r.id);}return result;}
function finish(c){if(c.draft.state!=='open')throw Error('This review round is already complete.');if(!c.draft.revision.trim()||!validDate(c.draft.date))throw Error('Record the submission documents/revisions and the review date before completing this round.');const snapshot={...clone(c.draft),completed:now(),checks:clone(c.checks),conclusion:c.conclusion||'',version:c.version,guidancePending:clone(c.guidancePending),rfi:clone(c.rfi)};for(const k of ['site','constraints','response','numbers'])if(c[k]!==undefined)snapshot[k]=clone(c[k]);snapshot.state='complete';c.rounds.push(snapshot);c.draft.state='complete';return snapshot;}
function newRound(c,revision,date){if(c.draft.state!=='complete')throw Error('Complete the current round before starting another.');if(!revision.trim()||!validDate(date))throw Error('Enter the revised document references and review date.');const prior=c.rounds.find(r=>r.number===c.draft.number);if(!prior||c.rounds.some(r=>r.number>prior.number))throw Error('The completed rounds are inconsistent. Import a valid assessment record.');c.checks=clone(prior.checks);const aliases=c.roundBasisAliases?.[c.rounds.indexOf(prior)]||{};for(const v of Object.values(c.checks))if(aliases[v.basisVersion||prior.version])v.basisVersion=aliases[v.basisVersion||prior.version];for(const [id,v] of Object.entries(c.checks)){const rec=c.bases[c.version]?.rules[id]?.status==='rec',acceptedAlternative=rec&&v.status==='not-met'&&!!v.note?.trim();if(v.status==='information'||v.status==='not-met'&&!acceptedAlternative){v.previousFinding=clone(v);delete v.previousFinding.previousFinding;v.status='unreviewed';v.note='';v.applicantResponse='';v.revisedEvidence='';v.needsRevisionReview=true;}else{v.carriedFrom=prior.number;}}c.draft={number:prior.number+1,revision:revision.trim(),date,state:'open',started:now(),previousRound:prior.number};c.rfi=[];c.conclusion='';if(c.response)c.response={recommendation:'',reasons:[],conditions:[],informatives:[],officer:c.response.officer||'',role:c.response.role||'',date:'',added:''};return c;}
function reviewGuidance(c,id){const flag=c.guidancePending[id];if(flag)c.guidanceReviewed.push({id,...clone(flag),reviewed:now()});delete c.guidancePending[id];const v=c.checks[id]||(c.checks[id]={status:'unreviewed',note:''});v.basisVersion=c.version;}
function followup(c,id){const v=c.checks[id],prior=v?.previousFinding,rec=c.bases?.[c.version]?.rules[id]?.status==='rec';return prior?{original:prior,resolved:!!v.note?.trim()&&!c.guidancePending[id]&&(v.status==='na'||(v.status==='met'||rec&&v.status==='not-met')&&!!v.applicantResponse?.trim()&&!!v.revisedEvidence?.trim()),current:v}:null;}
function requestText(r,v){return ['Check '+r.id+' — '+r.title,'Finding: '+(v.note?.trim()||'[Enter the officer’s finding and the missing evidence.]'),'Why it is needed: '+r.text,'Please provide: '+r.check,'Relevant evidence: '+r.evidence[0],'Applies when: '+r.when,'Source: '+r.links.map(l=>l.label+' — '+l.url).join('; ')].join('\n\n');}
function validate(v){
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x),fail=()=>{throw Error('The exported assessment contains an invalid record structure.');};
 function checkMap(map){if(!object(map))fail();for(const value of Object.values(map)){if(!object(value))fail();for(const field of ['note','applicantResponse','revisedEvidence','basisVersion'])if(value[field]!==undefined&&typeof value[field]!=='string')fail();if(value.previousFinding)checkMap({prior:value.previousFinding});if(!validStatus.has(value.status)){value.importedStatus=value.status;value.status='unreviewed';}}}
 function requests(items){if(!Array.isArray(items)||items.some(r=>!object(r)||typeof r.rule!=='string'||typeof r.text!=='string'||r.origin!==undefined&&typeof r.origin!=='string'||r.generatedText!==undefined&&typeof r.generatedText!=='string'))fail();}
 if(!object(v)||v.format!=='torbay-drainage-assessment'||typeof v.ref!=='string'||!v.ref.trim()||v.ref.length>100||!['h','n','m','o','r','c','p'].includes(v.type))throw Error('Choose an exported Torbay drainage assessment.');
 if(v.version!==undefined&&(typeof v.version!=='string'||!v.version.trim()||v.version.length>100||['__proto__','constructor','prototype'].includes(v.version)))fail();
 const c=clone(v);c.ref=c.ref.trim().toUpperCase();checkMap(c.checks);if(c.conclusion!==undefined&&typeof c.conclusion!=='string')fail();
 if(c.rounds!==undefined){if(!Array.isArray(c.rounds))fail();let previous=0;for(const round of c.rounds){if(!object(round)||!Number.isInteger(round.number)||round.number<1||typeof round.revision!=='string'||typeof round.date!=='string'||!validDate(round.date))fail();if(round.number<=previous)fail();previous=round.number;checkMap(round.checks);if(round.rfi!==undefined)requests(round.rfi);}}
 if(c.draft!==undefined&&(!object(c.draft)||!['open','complete'].includes(c.draft.state)||!Number.isInteger(c.draft.number)||c.draft.number<1||typeof c.draft.revision!=='string'||typeof c.draft.date!=='string'||!validDate(c.draft.date,c.draft.state==='open')))fail();
 if(c.earlierAssessments!==undefined){if(!Array.isArray(c.earlierAssessments))fail();for(const prior of c.earlierAssessments){if(!object(prior))fail();checkMap(prior.checks);}}
 if(c.bases!==undefined){if(!object(c.bases))fail();for(const basis of Object.values(c.bases)){if(!object(basis)||!object(basis.rules)||!object(basis.sources)||Object.values(basis.rules).some(r=>!object(r))||Object.values(basis.sources).some(s=>!object(s)))fail();}}
 if(c.draft?.state==='complete'&&c.rounds?.at(-1)?.number!==c.draft.number)fail();if(c.draft?.state==='open'&&c.rounds?.length&&c.draft.number<=c.rounds.at(-1).number)fail();
 if(c.guidancePending!==undefined&&(!object(c.guidancePending)||Object.values(c.guidancePending).some(f=>!object(f)||['cause','direct','from','to'].some(k=>typeof f[k]!=='string'||!f[k].trim())||f.detected!==undefined&&typeof f.detected!=='string'||f.basisKnown!==undefined&&typeof f.basisKnown!=='boolean')))fail();
 if(c.guidanceReviewed!==undefined&&(!Array.isArray(c.guidanceReviewed)||c.guidanceReviewed.some(f=>!object(f)||typeof f.id!=='string'||typeof f.from!=='string'||typeof f.to!=='string'||typeof f.reviewed!=='string')))fail();
 if(c.basisAliases!==undefined&&(!object(c.basisAliases)||Object.values(c.basisAliases).some(a=>typeof a!=='string')))fail();
 if(c.roundBasisAliases!==undefined&&(!object(c.roundBasisAliases)||Object.values(c.roundBasisAliases).some(aliases=>!object(aliases)||Object.values(aliases).some(a=>typeof a!=='string'))))fail();
 if(c.route!==undefined&&(!object(c.route)||!Array.isArray(c.route.ids)||c.route.ids.some(id=>typeof id!=='string')||['features','constraints'].some(k=>c.route[k]!==undefined&&(!Array.isArray(c.route[k])||c.route[k].some(v=>typeof v!=='string')))||['stage','dest','summary','added'].some(k=>c.route[k]!==undefined&&typeof c.route[k]!=='string')))fail();
 if(c.rfi!==undefined)requests(c.rfi);
 if(c.draft?.state==='complete'){const round=c.rounds.at(-1);if(c.draft.revision!==round.revision||c.draft.date!==round.date)throw Error('The completed assessment disagrees with its saved round. Restore an unchanged export.');
  const aliases={...(c.basisAliases||{}),...(c.roundBasisAliases?.[c.rounds.length-1]||{})};
  const canonical=x=>{if(Array.isArray(x))return x.map(canonical);if(!object(x))return x;return Object.fromEntries(Object.keys(x).sort().map(k=>[k,k==='basisVersion'&&aliases[x[k]]?aliases[x[k]]:canonical(x[k])]));};
  for(const k of ['checks','conclusion','rfi','site','constraints','response','numbers'])if(round[k]!==undefined&&(c[k]===undefined||JSON.stringify(canonical(c[k]))!==JSON.stringify(canonical(round[k]))))throw Error('The completed assessment '+k+' disagrees with its saved round. Restore an unchanged export.');
 }return c;
}
return {clone,localDate,validDate,requestOrigin,requestStale,label,migrate,group,summary,finish,newRound,reviewGuidance,followup,requestText,validate};
});
