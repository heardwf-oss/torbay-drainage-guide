import {extractWordInWorker} from './word-worker-client.mjs';
import { REPORT_LIMITS,appendReportSegment } from './report-limits.mjs';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=typeof TORBAY_PDF_WORKER_URL==='undefined'?'/assets/pdf.worker.min.mjs':TORBAY_PDF_WORKER_URL;
export async function extractReport(file,onProgress=()=>{},totals={characters:0,sections:0}) {
  if(file.size>REPORT_LIMITS.bytes)throw Error(file.name+' exceeds 20 MB.');
  if(!file.name.trim()||file.name.length>REPORT_LIMITS.nameCharacters)throw Error('Use a report filename of up to 180 characters.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(/\.pdf$/i.test(file.name)){
    let pdf;try{pdf=await pdfjs.getDocument({data:bytes,isEvalSupported:false,disableFontFace:true,useSystemFonts:true}).promise;}catch{throw Error(file.name+' could not be read. Use an unencrypted text-based PDF.');}
    try {
      if(pdf.numPages>150)throw Error('Split '+file.name+' into reports of no more than 150 pages.');
      const segments=[];
      for(let p=1;p<=pdf.numPages;p++){
        onProgress('Reading '+file.name+' — page '+p+' of '+pdf.numPages);
        const page=await pdf.getPage(p),content=await page.getTextContent();
        const text=content.items.map(v=>v.str+(v.hasEOL?'\n':' ')).join('').trim();
        if(text.length>16000)throw Error('PDF page '+p+' contains too much text. Split the report into smaller files.');
        appendReportSegment(segments,{locator:'PDF page '+p,text,unreadable:text.replace(/\s/g,'').length<30},'pdf',totals);page.cleanup();
      }
      if(segments.every(s=>s.unreadable))throw Error(file.name+' has no readable report text. Scans and drawings need a manual check.');
      return {name:file.name,type:'pdf',segments};
    }finally{await pdf.destroy();}
  }
  if(/\.docx$/i.test(file.name))return extractWordInWorker(bytes,file.name,onProgress,totals);
  throw Error('Use a text-based PDF or Word .docx report. Convert older .doc files to .docx first.');
}
