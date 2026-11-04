import {extractWord} from './word-extraction.mjs';
self.onmessage=({data})=>{
 try{
  const result=extractWord(new Uint8Array(data.bytes),data.name,text=>self.postMessage({progress:text}),data.totals);
  self.postMessage({result});
 }catch(error){self.postMessage({error:error.message||String(error)});}
};
