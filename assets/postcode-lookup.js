/* Postcode lookup sends only the postcode, never the entered property address. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else api.mount();})(this,function(){
'use strict';
function postcode(text){
  const matches=String(text).toUpperCase().match(/\b(?:GIR\s*0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/g)||[];
  const unique=[...new Set(matches.map(p=>p.replace(/\s/g,'')))];
  if(unique.length!==1)throw Error(unique.length?'Enter one postcode at a time.':'Include a full UK postcode, for example TQ1 3DR.');
  const value=unique[0];return value.slice(0,-3)+' '+value.slice(-3);
}
function location(result){
  if(!result||!Number.isInteger(result.eastings)||!Number.isInteger(result.northings)||result.eastings<0||result.eastings>=700000||result.northings<0||result.northings>=1300000)throw Error('This postcode has no usable British National Grid location. Enter the site grid reference manually.');
  return {postcode:postcode(result.postcode),easting:result.eastings,northing:result.northings};
}
function mount(){
  const address=document.getElementById('site-address'),input=document.getElementById('site-location'),R=window.TorbayResponse;
  if(!address||!input||!R)return;
  const box=document.createElement('div');box.className='postcode-lookup';
  box.innerHTML='<button type="button" class="secondary" id="postcode-find">Find grid reference from postcode</button><p role="status" id="postcode-status"></p><button type="button" class="secondary" id="postcode-use" hidden>Use this grid reference</button>';
  address.after(box);
  const find=box.querySelector('#postcode-find'),use=box.querySelector('#postcode-use'),status=box.querySelector('#postcode-status');let generation=0,selected=null;
  function reset(){generation++;selected=null;use.hidden=true;status.textContent='';find.disabled=input.disabled;}
  address.addEventListener('input',reset);input.addEventListener('input',reset);document.addEventListener('torbay:assessment-open',reset);document.addEventListener('torbay:tools-reset',reset);
  new MutationObserver(()=>{if(input.disabled)reset();find.disabled=input.disabled;}).observe(input,{attributes:true,attributeFilter:['disabled']});
  find.addEventListener('click',async()=>{
    reset();if(input.disabled)return;const token=++generation;
    try{
      const code=postcode(address.value);find.disabled=true;status.textContent='Finding '+code+'…';
      const response=await fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(code),{signal:AbortSignal.timeout(10000),referrerPolicy:'no-referrer'});
      if(response.status===404)throw Error('Postcode not found. Check it or enter the grid reference manually.');
      if(!response.ok)throw Error('Postcode lookup is unavailable. Try again or enter the grid reference manually.');
      const body=await response.json(),loc=location(body?.result);
      if(token!==generation||input.disabled)return;
      selected={...loc,grid:R.toGridRef(loc.easting,loc.northing)};
      status.textContent='Postcode location for '+loc.postcode+': '+selected.grid+' · E '+loc.easting+', N '+loc.northing+'. This postcode may cover several properties. Check the site on the map.';
      use.hidden=false;
    }catch(error){if(token===generation)status.textContent=error.name==='TimeoutError'?'Postcode lookup took too long. Try again or enter the grid reference manually.':/^(Include a full UK postcode|Enter one postcode|Postcode not found|Postcode lookup is unavailable|This postcode has no usable)/.test(error.message)?error.message:'Postcode lookup is unavailable. Try again or enter the grid reference manually.';}
    finally{if(token===generation)find.disabled=input.disabled;}
  });
  use.addEventListener('click',()=>{
    if(!selected||input.disabled)return;
    document.dispatchEvent(new CustomEvent('torbay:postcode-location',{detail:{...selected,source:'Postcode '+selected.postcode+' location — approximate; check the property on the map.'}}));
    status.textContent='Postcode location added. Check the property using the maps below.';use.hidden=true;
  });
}
return {postcode,location,mount};
});
