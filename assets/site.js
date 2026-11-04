(() => {
  'use strict';
  document.documentElement.classList.remove('no-js');
  const page = document.body.dataset.page || 'home';
  const key = 'torbay-drainage-checks-v1:' + page;
  const boxes = [...document.querySelectorAll('[data-check]')];
  const status = document.getElementById('checklist-progress');
  const reset = document.getElementById('reset-checklist');
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
  const update = () => {
    const count = boxes.filter(box => box.checked).length;
    if (status) status.textContent = count + ' of ' + boxes.length + ' checked';
    if (reset) reset.disabled = count === 0;
  };
  boxes.forEach(box => {
    box.checked = saved[box.dataset.check] === true;
    box.addEventListener('change', () => {
      saved[box.dataset.check] = box.checked;
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch (_) {}
      update();
    });
  });
  if (reset) reset.addEventListener('click', () => {
    boxes.forEach(box => { box.checked = false; }); saved = {};
    try { localStorage.removeItem(key); } catch (_) {}
    update();
  });
  update();
  document.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
  const form = document.getElementById('search-form');
  const field = document.getElementById('search-query');
  const results = document.getElementById('search-results');
  const normal = value => String(value).toLowerCase().replace(/[-\u2013\u2014]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const aliases = { 'suds':'sustainable drainage', 'soakaway':'infiltration', 'soakaways':'infiltration', 'rain garden':'bioretention', 'cda':'critical drainage', 'fra':'flood risk assessment', 'climate':'climate change', 'tank':'attenuation', 'tanks':'attenuation' };
  const runSearch = () => {
    if (!form || !field || !results) return;
    const raw = field.value.trim(); const query = normal(raw);
    results.replaceChildren();
    if (!query) {
      const p = document.createElement('p'); p.textContent = 'Enter a topic or term to search the guide.'; results.append(p); return;
    }
    const expanded = [query, aliases[query]].filter(Boolean);
    const words = query.split(' ');
    const matches = (window.drainageIndex || []).map(item => {
      const title = normal(item.title), keys = normal(item.keywords), text = normal(item.text);
      let score = 0;
      expanded.forEach(q => { if (title === q) score += 40; if (title.includes(q)) score += 20; if (keys.includes(q)) score += 10; if (text.includes(q)) score += 3; });
      if (words.length > 1 && words.every(word => (title+' '+keys+' '+text).includes(word))) score += 4;
      return {item, score};
    }).filter(result => result.score > 0).sort((a,b) => b.score-a.score || a.item.title.localeCompare(b.item.title));
    const heading = document.createElement('h2'); heading.className = 'result-count'; heading.textContent = matches.length ? matches.length+' result'+(matches.length === 1 ? '' : 's')+' for '+raw : 'No results for '+raw; results.append(heading);
    if (!matches.length) {
      const p=document.createElement('p');p.textContent='Try a shorter term, such as infiltration, rainfall or maintenance. You can also use the page menu or drainage glossary.';results.append(p);return;
    }
    const list=document.createElement('ul');list.className='search-results';
    matches.forEach(({item}) => { const li=document.createElement('li'),h=document.createElement('h2'),a=document.createElement('a'),p=document.createElement('p');a.href='../'+item.path;a.textContent=item.title;h.append(a);p.textContent=item.lede;li.append(h,p);list.append(li); });
    results.append(list);
  };
  if (form && field) {
    field.value = new URLSearchParams(location.search).get('q') || '';
    form.addEventListener('submit', event => { event.preventDefault(); const url=new URL(location.href);url.searchParams.set('q',field.value.trim());history.replaceState(null,'',url);runSearch(); });
    runSearch();
  }
})();
