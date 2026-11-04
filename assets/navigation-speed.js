// Warm at most two public HTML destinations when a user pauses on a link.
// Normal links, browser history, form state and in-flight chat keep their native behaviour.
(() => {
  const connection=navigator.connection;
  if(connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType||''))return;
  const seen=new Set();let timer;
  function warm(event){
    clearTimeout(timer);
    const link=event.target.closest?.('a[href]');
    if(!link||link.target||link.hasAttribute('download'))return;
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin||url.search||!url.pathname.endsWith('/')||url.pathname.startsWith('/torbay-drainage-guide/api/')||url.pathname.startsWith('/torbay-drainage-guide/assets/')||url.pathname===location.pathname||seen.has(url.pathname)||seen.size>=2)return;
    timer=setTimeout(()=>{
      seen.add(url.pathname);
      const hint=document.createElement('link');hint.rel='prefetch';hint.href=url.origin+url.pathname;hint.as='document';document.head.append(hint);
    },100);
  }
  document.addEventListener('pointerover',warm,{passive:true});
  document.addEventListener('focusin',warm);
  document.addEventListener('pointerout',()=>clearTimeout(timer),{passive:true});
})();
