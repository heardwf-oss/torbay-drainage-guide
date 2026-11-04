export function extractWordInWorker(bytes,name,onProgress,totals,WorkerClass=globalThis.Worker){
 return new Promise((resolve,reject)=>{
  let worker,timer,settled=false;
  const finish=(error,result)=>{
   if(settled)return;settled=true;clearTimeout(timer);worker?.terminate();
   if(error){reject(Error(name+' could not be read. Use a text-based .docx report. '+error));return;}
   // A failed or interrupted file never consumes the shared upload allowance.
   Object.assign(totals,result.totals);resolve(result.report);
  };
  try{
   if(!WorkerClass)throw Error('This browser cannot read Word reports in the background.');
   const url=typeof TORBAY_WORD_WORKER_URL==='undefined'?'/assets/word-extraction-worker.mjs':TORBAY_WORD_WORKER_URL;
   worker=new WorkerClass(url,{type:'module'});
   worker.onmessage=({data})=>{
    if(settled)return;
    if(data.progress){try{onProgress(data.progress);}catch(error){finish(error.message);}return;}
    if(data.error)finish(data.error);else if(data.result)finish(null,data.result);
   };
   worker.onerror=()=>finish('Background Word reading failed.');
   worker.onmessageerror=()=>finish('The Word report could not be transferred.');
   timer=setTimeout(()=>finish('Word reading exceeded two minutes. Split the report into smaller files.'),120000);
   worker.postMessage({bytes:bytes.buffer,name,totals:{...totals}},[bytes.buffer]);
  }catch(error){finish(error.message||String(error));}
 });
}
