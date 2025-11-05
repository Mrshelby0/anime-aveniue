(function(){
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    products: [],
    filtered: [],
    categories: new Set(),
    admin: false
  };

  function formatPrice(p, currency){
    const value = Number(p) || 0;
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(value);
    } catch(e) {
      return `₹${value}`;
    }
  }

  function productCard(p){
    const imgAlt = p.title || p.id;
    const price = formatPrice(p.price, p.currency);
    return `<div class="product-card" data-category="${escapeHtml(p.category||'')}">
      <div class="image-wrap">
        <img loading="lazy" src="${encodeURI(p.image)}" alt="${escapeHtml(imgAlt)}">
      </div>
      <div class="info">
        <h3 class="title">${escapeHtml(p.title||'Untitled')}</h3>
        <div class="meta">
          <span class="price">${price}</span>
          ${p.category ? `<span class="category">${escapeHtml(p.category)}</span>` : ''}
        </div>
        ${p.description ? `<p class="desc">${escapeHtml(p.description)}</p>` : ''}
      </div>
    </div>`;
  }

  function render(){
    const grid = qs('#catalog-grid');
    if(!grid) return;
    grid.innerHTML = state.filtered.map(productCard).join('');
    const count = qs('#result-count');
    if(count) count.textContent = `${state.filtered.length}`;
  }

  function rebuildFilters(){
    const sel = qs('#category-filter');
    if(!sel) return;
    const categories = Array.from(new Set(state.products.map(p => p.category).filter(Boolean))).sort();
    sel.innerHTML = `<option value="">All categories</option>` + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function applyFilters(){
    const term = (qs('#search-input')?.value || '').trim().toLowerCase();
    const cat = (qs('#category-filter')?.value || '').trim();
    state.filtered = state.products.filter(p => {
      const inCat = !cat || (p.category === cat);
      const inTerm = !term || [p.title, p.description, p.category].filter(Boolean).some(v => String(v).toLowerCase().includes(term));
      return inCat && inTerm;
    });
    render();
  }

  function attachUI(){
    const s = qs('#search-input');
    if(s) s.addEventListener('input', debounce(applyFilters, 120));
    const c = qs('#category-filter');
    if(c) c.addEventListener('change', applyFilters);

    const toggle = qs('#admin-toggle');
    const panel = qs('#admin-panel');
    if(toggle && panel){
      toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
      });
    }

    const fileInput = qs('#data-file');
    if(fileInput){
      fileInput.addEventListener('change', onFileSelected);
    }

    const exportBtn = qs('#export-json');
    if(exportBtn){
      exportBtn.addEventListener('click', () => exportJSON(state.products));
    }

    // Add Product Modal
    const openAdd = qs('#open-add-product');
    const addModal = qs('#addProductModal');
    const closeAdd = qs('#closeAddProduct');
    const form = qs('#addProductForm');
    const resetBtn = qs('#resetAddProduct');
    if(openAdd && addModal){
      openAdd.addEventListener('click', ()=> { addModal.classList.remove('hidden'); addModal.classList.add('flex'); document.body.style.overflow='hidden'; buildCategoryDatalist(); });
    }
    if(closeAdd){ closeAdd.addEventListener('click', ()=> closeAddModal()); }
    if(addModal){ addModal.addEventListener('click', (e)=> { if(e.target===addModal) closeAddModal(); }); }
    function closeAddModal(){ addModal.classList.add('hidden'); addModal.classList.remove('flex'); document.body.style.overflow=''; }

    if(form){
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const fd = new FormData(form);
        const title = String(fd.get('title')||'').trim();
        const description = String(fd.get('description')||'').trim();
        const price = Number(fd.get('price')||0);
        const category = String(fd.get('category')||'').trim();
        const files = fd.getAll('images');
        const images = await Promise.all(files.filter(f=>f && typeof f!=='string').map(file => fileToDataURL(file)));
        const id = title ? title.toLowerCase().replace(/[^a-z0-9-_]+/g,'-') : `item-${Date.now()}`;
        const product = { id, title, price, currency:'INR', category, image: images[0]||'', images, description };
        state.products.unshift(product);
        applyFilters();
        closeAddModal();
      });
      if(resetBtn){ resetBtn.addEventListener('click', ()=> form.reset()); }
    }
  }

  async function fileToDataURL(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function buildCategoryDatalist(){
    const dl = qs('#ap-categories');
    if(!dl) return;
    const cats = Array.from(new Set(state.products.map(p=>p.category).filter(Boolean))).sort();
    dl.innerHTML = cats.map(c=>`<option value="${escapeHtml(c)}"></option>`).join('');
  }

  async function onFileSelected(e){
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const name = file.name.toLowerCase();
    const text = await file.text();
    try {
      let products;
      if(name.endsWith('.json')){
        products = JSON.parse(text);
      } else if(name.endsWith('.csv')){
        products = parseCSV(text);
      } else {
        alert('Unsupported file type. Please upload JSON or CSV.');
        return;
      }
      if(!Array.isArray(products)) throw new Error('Data must be an array of product objects');
      ingestProducts(products);
    } catch(err){
      console.error(err);
      alert('Failed to parse file: ' + err.message);
    }
  }

  function ingestProducts(list){

    const normalized = list.map((p, i) => ({
      id: String(p.id || p.title || `item-${Date.now()}-${i}`).toLowerCase().replace(/[^a-z0-9-_]+/g,'-'),
      title: p.title || 'Untitled',
      price: Number(p.price) || 0,
      currency: p.currency || 'INR',
      category: p.category || '',
      image: p.image || '',
      description: p.description || ''
    }));
    state.products = normalized;
    state.filtered = normalized;
    rebuildFilters();
    applyFilters();
  }

  function exportJSON(items){
    const blob = new Blob([JSON.stringify(items, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function parseCSV(text){
    
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if(lines.length === 0) return [];
    const headers = splitCSVLine(lines[0]);
    const idx = (name) => headers.findIndex(h => h.toLowerCase().trim() === name);
    const iId = idx('id');
    const iTitle = idx('title');
    const iPrice = idx('price');
    const iCurrency = idx('currency');
    const iCategory = idx('category');
    const iImage = idx('image');
    const iDesc = idx('description');

    const data = [];
    for(let i=1;i<lines.length;i++){
      const cells = splitCSVLine(lines[i]);
      const row = {
        id: pick(cells, iId),
        title: pick(cells, iTitle),
        price: pick(cells, iPrice),
        currency: pick(cells, iCurrency),
        category: pick(cells, iCategory),
        image: pick(cells, iImage),
        description: pick(cells, iDesc)
      };
      data.push(row);
    }
    return data;
  }

  function splitCSVLine(line){
    const out = [];
    let cur = '';
    let inQ = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(inQ){
        if(ch === '"'){
          if(line[i+1] === '"'){ 
            cur += '"'; i++;
          } else {
            inQ = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if(ch === '"') { inQ = true; }
        else if(ch === ','){ out.push(cur); cur = ''; }
        else { cur += ch; }
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  function pick(arr, idx){
    return idx >= 0 && idx < arr.length ? arr[idx] : '';
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  function debounce(fn, wait){
    let t; return function(){ clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), wait); };
  }

  async function loadInitial(){
    const url = new URL(location.href);
    state.admin = url.searchParams.get('admin') === '1';

    const adminBar = qs('#admin-bar');
    if(adminBar){
      adminBar.hidden = !state.admin;
    }

    try {
      const res = await fetch('data/products.json', {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const items = await res.json();
      ingestProducts(items);
    } catch(err){
      console.warn('Failed to load products.json', err);
      ingestProducts([]);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    attachUI();
    loadInitial();
  });
})();
