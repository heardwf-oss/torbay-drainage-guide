// Shared extraction and upload bounds; evidence is rejected, never silently truncated.
export const REPORT_LIMITS=Object.freeze({files:3,bytes:20*1024*1024,pdfSections:150,wordSections:600,sectionCharacters:16000,totalCharacters:180000,totalSections:900,nameCharacters:180,locatorCharacters:200});
export function appendReportSegment(segments,segment,type,totals={characters:0,sections:0}){
 const l=REPORT_LIMITS;
 if(typeof segment.text!=='string'||typeof segment.locator!=='string'||segment.locator.length>l.locatorCharacters||segment.text.length>l.sectionCharacters)throw Error('A report section exceeds the extraction limit. Split the report into smaller files.');
 if(segments.length>=(type==='pdf'?l.pdfSections:l.wordSections))throw Error('A report can contain at most 150 PDF pages or 600 Word paragraphs and tables.');
 if(totals.characters+segment.text.length>l.totalCharacters||totals.sections+1>l.totalSections)throw Error('The reports exceed 180,000 characters or 900 text sections. Upload a smaller report set.');
 totals.characters+=segment.text.length;totals.sections++;segments.push(segment);
}
