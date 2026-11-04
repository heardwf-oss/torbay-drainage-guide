import {unzipSync,strFromU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';
import {appendReportSegment} from './report-limits.mjs';
const children=node=>Array.from(node.childNodes||[]).filter(child=>child.nodeType===1);
function parseXml(bytes){
 const source=strFromU8(bytes);
 // OOXML report parts need no DTD. Reject declarations rather than resolve entities.
 if(/<!DOCTYPE/i.test(source))throw Error('Document type declarations are not supported in Word reports.');
 return new DOMParser({locator:false,onError:(level,message)=>{throw Error('Invalid Word XML: '+message);}}).parseFromString(source,'application/xml');
}
// Runs in a dedicated worker. Commit aggregate totals only after the whole file succeeds.
export function extractWord(bytes,name,onProgress=()=>{},existingTotals={characters:0,sections:0}){
 const file={name},totals={...existingTotals};
    onProgress('Reading '+file.name);
    // Inspect the central directory before inflation to bound zip-bomb memory.
    let total=0,xml;
    try {
      const entries=[];unzipSync(bytes,{filter:f=>{entries.push(f);return false;}});
      const selectedNames=new Set();for(const f of entries){if(f.originalSize>8e6)throw Error('An embedded Word file is too large.');if(/^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/.test(f.name)){if(selectedNames.has(f.name))throw Error('The Word archive contains duplicate report parts.');selectedNames.add(f.name);total+=f.originalSize;if(total>12e6)throw Error('The Word document is too large.');}}
      const files=unzipSync(bytes,{filter:f=>selectedNames.has(f.name)});
      if(!files['word/document.xml'])throw Error();
      xml=parseXml(files['word/document.xml']);
      const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main',body=xml.getElementsByTagNameNS(ns,'body')[0];
      let section='',paragraph=0,table=0;const segments=[];
      const textOf=node=>{
        const read=el=>{
          if(el.nodeType!==1)return '';
          if(el.namespaceURI===ns){if(['del','moveFrom'].includes(el.localName))return '';if(el.localName==='t')return el.textContent;if(el.localName==='tab')return '\t';if(['br','cr'].includes(el.localName))return '\n';}
          const text=children(el).map(read).join('');return text+(el.namespaceURI===ns&&el.localName==='p'?'\n':'');
        };return read(node).trim();
      };
      if(!body)throw Error('The Word document has no readable body.');
      function* blocks(node){for(const el of children(node)){if(el.namespaceURI===ns&&['del','moveFrom','sectPr'].includes(el.localName))continue;if(el.namespaceURI===ns&&['p','tbl'].includes(el.localName))yield el;else yield* blocks(el);}}
      let walked=0;for(const el of blocks(body)){
        if(++walked%25===0){onProgress('Reading '+file.name+' — '+walked+' sections');}
        if(el.localName==='p'){
          paragraph++;const text=textOf(el).trim();if(!text)continue;
          const style=el.getElementsByTagNameNS(ns,'pStyle')[0]?.getAttributeNS(ns,'val')||'';
          if(/^heading/i.test(style))section=text.slice(0,130);
          appendReportSegment(segments,{locator:(section?'“'+section+'” · ':'')+'Word paragraph '+paragraph,text,unreadable:false},'docx',totals);
        }else if(el.localName==='tbl'){
          table++;
          function* contained(node,kind){for(const child of children(node)){if(child.namespaceURI===ns&&['del','moveFrom','tbl'].includes(child.localName))continue;if(child.namespaceURI===ns&&child.localName===kind)yield child;else yield* contained(child,kind);}}
          const rows=[...contained(el,'tr')].map(tr=>[...contained(tr,'tc')].map(textOf).join(' | '));
          appendReportSegment(segments,{locator:(section?'“'+section+'” · ':'')+'Word table '+table,text:rows.join('\n'),unreadable:!rows.some(Boolean)},'docx',totals);
        }
      }
      const grouped=segments;
      for(const name of Object.keys(files).filter(n=>n!=='word/document.xml')){
        const extra=parseXml(files[name]);const text=textOf(extra.documentElement).trim();
        if(text)appendReportSegment(grouped,{locator:'Word '+name.split('/').pop().replace('.xml',''),text,unreadable:false},'docx',totals);
      }
      if(!grouped.length)throw Error('No report text could be extracted.');
      // Objects and pictures are not text evidence; expose them as a manual check.
      if(xml.getElementsByTagNameNS('*','drawing').length||xml.getElementsByTagNameNS('*','pict').length||xml.getElementsByTagNameNS('*','altChunk').length)appendReportSegment(grouped,{locator:'Embedded images, drawings and external content',text:'',unreadable:true},'docx',totals);
      return {report:{name:file.name,type:'docx',segments:grouped},totals};
    }catch(err){throw Error(err.message||'The Word archive is invalid.');}
}
