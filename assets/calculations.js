'use strict';
/* Pure arithmetic. No result selects or approves a site discharge criterion. */
(function(root){
  function number(value,name,positive=false){
    const n=Number(value);
    if(value==null || (typeof value==='string'&&!value.trim()) || !Number.isFinite(n) || (positive?n<=0:n<0)) throw new Error('Enter a valid '+name+'.');
    if(n===0&&typeof value==='string'&&/[1-9]/.test(value.split(/[eE]/)[0]))throw new Error('The '+name+' is too small to represent. Check the input.');
    return n;
  }
  function rates(input){
    if(!['greater','no-greater','unknown'].includes(input.volume))throw new Error('Choose the developed discharged-volume comparison.');
    const area=number(input.area,'development area',true), q50=number(input.q50,'50% AEP greenfield rate'),q1=number(input.q1,'1% AEP greenfield rate');
    if(q1<q50)throw new Error('The 1% AEP greenfield rate is lower than the 50% AEP rate. Check the inputs.');
    const threshold=3*area;
    if(!Number.isFinite(threshold))throw new Error('The development area is too large to calculate. Check the input.');
    const national50=Math.max(q50,threshold);
    const national1=input.volume==='greater'?national50:input.volume==='no-greater'?Math.max(q1,threshold):null;
    const q10=input.q10===''||input.q10==null?null:number(input.q10,'10% AEP greenfield rate');
    if(q10!=null&&(q10<q50||q10>q1))throw new Error('The 10% AEP greenfield rate should lie between the 50% and 1% AEP rates. Check the inputs.');
    return {area,q50,q1,q10,national50,national1,threshold,local:q10,volume:input.volume};
  }
  function factor(area,risk){area=number(area,'drained area',true);if(!['minor','major'].includes(risk))throw new Error('Choose the consequence of failure.');return risk==='major'?10:area<100?2:area<=1000?3:5;}
  function events(r,q30value){
    const q30=q30value===''||q30value==null?null:number(q30value,'3.3% AEP greenfield rate');
    if(q30!=null&&(q30<(r.q10??r.q50)||q30>r.q1))throw new Error('The 3.3% AEP greenfield rate should lie between the 10% (or 50%) and 1% AEP rates. Check the inputs.');
    const cda=g=>g==null||r.q10==null?null:Math.min(g,r.q10);
    return [
      {event:'50% AEP',period:'1 in 2 year',greenfield:r.q50,national:r.national50,nationalRef:'3.18',cda:cda(r.q50),flooding:''},
      {event:'10% AEP',period:'1 in 10 year',greenfield:r.q10,national:null,nationalRef:'',cda:r.q10,flooding:''},
      {event:'3.3% AEP',period:'1 in 30 year',greenfield:q30,national:null,nationalRef:'',cda:r.q10,flooding:'No flooding on any part of the site, plus climate change, unless an area is designed to hold or convey water.'},
      {event:'1% AEP',period:'1 in 100 year',greenfield:r.q1,national:r.national1,nationalRef:r.volume==='greater'?'3.19':r.volume==='no-greater'?'3.20':'',cda:r.q10,flooding:'No flooding of any building (including basements), utility plant susceptible to water, or safe access and escape routes, plus climate change.'}
    ];
  }
  root.DrainageMath={rates,factor,events};
  if(typeof module!=='undefined')module.exports=root.DrainageMath;
})(globalThis);
