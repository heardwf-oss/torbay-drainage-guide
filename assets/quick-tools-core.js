/* Shared transfer contract: tool details never include findings or review rounds. */
(function(root,factory){const R=typeof module==='object'&&module.exports?require('./assessment-response.js'):root.TorbayResponse;const api=factory(R);if(typeof module==='object'&&module.exports)module.exports=api;else root.TorbayQuickTools=api;})(typeof window!=='undefined'?window:this,function(R){
'use strict';
const storageKey='torbay-drainage-quick-tools-v1',transferKey='torbay-drainage-tools-transfer-v1';
function details(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('The saved tool details could not be read.');const out=JSON.parse(JSON.stringify({site:input.site||{},constraints:input.constraints||{},numbers:input.numbers||R.blankNumbers()}));R.validateAdditions(out);R.ensure(out);return {site:out.site,constraints:out.constraints,numbers:out.numbers};}
return {storageKey,transferKey,details};
});
