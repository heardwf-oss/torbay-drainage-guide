(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TorbaySearch=api;})(typeof window!=='undefined'?window:this,function(){
'use strict';
const stop=new Set('a an the is are was were what which who whom whose when where why how many much do does did can could should would shall must need needed i we you us to of on in at for with and or from about use using provide show tell me all this that it my our there please'.split(' '));
const aliases={soakaway:['infiltration','soakaways'],soakaways:['infiltration','soakaway'],tests:['testing','test'],test:['testing','tests'],bre365:['bre','365','infiltration'],cc:['climate','allowance'],sww:['south','west','water','sewer'],cda:['critical','drainage','area'],qbar:['greenfield','runoff','discharge'],q10:['greenfield','rate'],fos:['factor','safety'],porous:['permeable','paving'],pervious:['permeable'],rwh:['rainwater','harvesting'],rain:['rainfall'],raingarden:['bioretention','rain','garden'],rainfall:['rain','climate'],upkeep:['maintenance'],maintain:['maintenance'],lining:['lined','unlined'],adopt:['adoption','adopted'],adopts:['adoption','adopt'],adopted:['adoption','adopt'],adopting:['adoption','adopt']};
function normal(s){return String(s||'').toLowerCase().replace(/[⁻−]/g,'-').replace(/\bbre\s*365\b/g,'bre 365').replace(/\breturn[\s-]+periods?\b/g,'aep').replace(/\b1\s*in\s*(100|30|10|2)\b(?:[\s-]*(?:years?|yr))?/g,(m,n)=>({100:'1%',30:'3.3%',10:'10%',2:'50%'}[n])+' aep').replace(/[²³]/g,m=>m==='²'?'2':'3').replace(/[^a-z0-9.%-]+/g,' ').trim();}
function tokens(s){return normal(s).split(/\s+/).filter(v=>v&&!stop.has(v));}
function near(a,b){if(a.length<5||Math.abs(a.length-b.length)>1)return false;let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=next;}return previous[b.length]<=1;}
// One- and two-character tokens ("h", "3", "cc") match whole words only, so "Part H" does not match every "h".
const abbreviations=new Set(['fra','sfra','fos','cda','qbar','q10','sww','rwh','bre365']);
aliases.fra=['flood risk assessment'];aliases.sfra=['strategic flood risk assessment'];
function literal(token,text,words){return token.length<=2||abbreviations.has(token)?words.includes(token):text.includes(token);}
function code(q,ids){const m=String(q||'').trim().match(/^([a-z]{2})\s*-?\s*0*(\d{1,2})$/i);if(!m)return q;const id=m[1].toUpperCase()+'-'+m[2].padStart(2,'0');return !ids||ids.includes(id)?id:q;}
function match(token,text,words){if(literal(token,text,words))return 3;if(token.length<=2||abbreviations.has(token))return (aliases[token]||[]).some(v=>(' '+text+' ').includes(' '+v+' '))?2:0;const stem=token.endsWith('s')?token.slice(0,-1):token;if(stem.length>3&&text.includes(stem))return 2;if((aliases[token]||[]).some(v=>text.includes(v)))return 2;if(words.some(w=>near(token,w)))return 1;return 0;}
function rank(doc,q){const ts=tokens(q),title=normal(doc.title),body=normal(doc.text),titleWords=title.split(' '),bodyWords=body.split(' ');if(!ts.length)return 0;let score=0,hits=0;for(const t of ts){const a=match(t,title,titleWords),b=match(t,body,bodyWords);if(a||b){hits++;score+=a*8+b*2;if(literal(t,title,titleWords)||literal(t,body,bodyWords))score+=32;}}if(hits<Math.ceil(ts.length*.7))return 0;const phrase=normal(q),hasPhrase=t=>(' '+t+' ').includes(' '+phrase+' ');if(hasPhrase(title))score+=30;else if(ts.length>1&&hasPhrase(body))score+=24;return score+(doc.kind==='rules'?4:0);}
function questions(data,q){const ts=tokens(q),n=normal(q),candidate=data.questions.map(item=>{let score=0;for(const term of item.terms){const nt=normal(term);if((' '+n+' ').includes(' '+nt+' '))score+=15;else{const tt=tokens(term);if(tt.length&&tt.every(t=>ts.some(v=>v===t||(aliases[v]||[]).includes(t)||near(v,t))))score+=7;}}return {...item,score};}).filter(v=>v.score>0).sort((a,b)=>b.score-a.score);
 if(!candidate.length)return [];
 const first=candidate[0],interception=candidate.find(v=>v.id==='interception');if(interception){
  const features=[['paving',['paving','permeable','porous']],['swale',['swale']],['basin',['basin']],['rain-garden',['rain garden','raingarden','bioretention']],['pond',['pond','wetland']],['harvesting',['harvesting','rwh','water butt']],['roof',['green roof','green wall']],['trench',['trench','soakaway']]].filter(([k,terms])=>terms.some(t=>n.includes(t)));
  interception.rules=[...new Set([...interception.rules,...features.flatMap(feature=>(data.featureRules[feature[0]]||[]).filter(id=>id.startsWith('ER-')))])];
 }
 return candidate.filter(v=>v.score>=first.score*.65).slice(0,2);
}
// Locate a display-text offset without applying a length-changing normalisation to it.
function excerpt(text,q,length=300){const s=String(text||'').replace(/\s+/g,' ').trim(),lower=s.toLowerCase(),terms=tokens(q),hits=[];
 for(const term of terms){for(const phrase of [term,...(aliases[term]||[])]){let at=lower.indexOf(phrase);while(at>=0){if(!abbreviations.has(term)||!/[a-z0-9]/i.test(s[at-1]||'')&&!/[a-z0-9]/i.test(s[at+phrase.length]||'')){hits.push(at);break;}at=lower.indexOf(phrase,at+1);}}}
 let at=Math.max(0,(hits.length?Math.min(...hits):0)-70);if(at){const space=s.indexOf(' ',at);if(space>=0&&space<at+30)at=space+1;}return (at?'…':'')+s.slice(at,at+length)+(s.length>at+length?'…':'');}
return {normal,tokens,near,rank,questions,code,excerpt};
});
