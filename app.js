(() => {
  "use strict";

  /* =========================================================
    PAULO SENSI — PROFISSIONAL (OFFLINE / SEM SERVIDOR)
    - Flow: Splash -> Marcas -> Modelos -> Sensi
    - VIP tiers: Free/Standard/Premium (VIP1/VIP2/VIP3)
    - Pagamento PIX (copia e cola) + WhatsApp
    - Login dono secreto (5 taps logo)
    - Painel dono forte + 300 ações
    - LocalStorage: clientes, sensi overrides, backup, logs, stats etc.
  ========================================================= */

  const OWNER_USER = "PauloSena2026";
  const OWNER_PASS = "PauloSena2027";
  const WHATSAPP_NUMBER = "6696155165";

  const PIX = {
    premium: "00020126330014BR.GOV.BCB.PIX011110586909141520400005303986540519.505802BR5925Paulo Henrique Lima Perei6009SAO PAULO62140510jBoJi22aSQ6304B831",
    standard:"00020126330014BR.GOV.BCB.PIX01111058690914152040000530398654049.995802BR5925Paulo Henrique Lima Perei6009SAO PAULO62140510pqMXnahVIv6304B486"
  };

  const DB = window.PS_DB;
  if(!DB){
    alert("ERRO: data.js não carregou. Verifique se colocou data.js antes do app.js.");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  const K = {
    plan: "ps_plan",               // free | standard | premium
    neonOff: "ps_neon_off",
    favorites: "ps_favs",          // ["brand|||model"]
    stats: "ps_stats",             // {opens,copies,favorites,modelOpens:{}}
    logs: "ps_logs",               // [string]
    clients: "ps_clients",         // {key:{plan,ts,sig}}
    vipLocks: "ps_vip_locks",      // {vip2:boolean, vip3:boolean}
    settings: "ps_settings",       // {notice,vipBanner,homeMessage}
    ownerToken: "ps_owner_token",  // ok.exp
    localKey: "ps_local_key",      // assinatura simples
    overrides: "ps_overrides",     // {brands:{}, sensi:{}}
    backupLocal:"ps_backup_local",
    copyHistory:"ps_copy_history",
    recentModels:"ps_recent_models",
    flags:"ps_flags"               // {blockShare,blockCopy,blockFavorites}
  };

  /* ---------- Storage helpers ---------- */
  function getJSON(key, fallback){
    try{
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    }catch{ return fallback; }
  }
  function setJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function toast(msg){
    const t = $("toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=>t.classList.add("hidden"), 1600);
  }

  function logAction(type, detail){
    const logs = getJSON(K.logs, []);
    logs.unshift(`[${new Date().toLocaleString()}] ${type} — ${detail}`);
    setJSON(K.logs, logs.slice(0, 1400));
  }

  function incStat(field, n=1){
    const s = getJSON(K.stats, {opens:0, copies:0, favorites:0, modelOpens:{}});
    s[field] = (s[field]||0) + n;
    setJSON(K.stats, s);
    renderOwnerSummary();
  }
  function incModelOpen(kbm){
    const s = getJSON(K.stats, {opens:0, copies:0, favorites:0, modelOpens:{}});
    s.modelOpens = s.modelOpens || {};
    s.modelOpens[kbm] = (s.modelOpens[kbm]||0) + 1;
    setJSON(K.stats, s);
  }

  /* ---------- Plan ---------- */
  function planLabel(p){
    if(p==="premium") return "PREMIUM";
    if(p==="standard") return "PADRÃO";
    return "GRÁTIS";
  }
  function getPlan(){ return localStorage.getItem(K.plan) || "free"; }
  function setPlan(p){
    localStorage.setItem(K.plan, p);
    $("brandSub") && ($("brandSub").textContent = `Sensi Free Fire • ${planLabel(p)}${getSettings().vipBanner?` • ${getSettings().vipBanner}`:""}`);
    $("vipChip") && ($("vipChip").textContent = p==="premium"?"VIP 3":p==="standard"?"VIP 2":"GRÁTIS");
    logAction("PLANO", `Plano atual: ${planLabel(p)}`);
  }

  /* ---------- Owner session ---------- */
  function isOwner(){
    const tok = localStorage.getItem(K.ownerToken);
    if(!tok) return false;
    const parts = tok.split(".");
    if(parts.length!==2) return false;
    return Number(parts[1]||0) > now();
  }
  function setOwnerSession(){
    const exp = now() + (1000*60*60*6); // 6h
    localStorage.setItem(K.ownerToken, `ok.${exp}`);
  }
  function clearOwnerSession(){
    localStorage.removeItem(K.ownerToken);
  }

  /* ---------- Local key & signature ---------- */
  function ensureLocalKey(){
    let k = localStorage.getItem(K.localKey);
    if(!k){
      k = Math.random().toString(36).slice(2)+"-"+Math.random().toString(36).slice(2);
      localStorage.setItem(K.localKey, k);
    }
    return k;
  }
  function signPayload(payload){
    const key = ensureLocalKey();
    const raw = JSON.stringify(payload) + "|" + key;
    let h = 0;
    for(let i=0;i<raw.length;i++){
      h = ((h<<5)-h) + raw.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  /* ---------- Flags ---------- */
  function getFlags(){
    return getJSON(K.flags, {blockShare:false, blockCopy:false, blockFavorites:false});
  }
  function setFlags(f){ setJSON(K.flags, f); }

  /* ---------- Settings ---------- */
  function getSettings(){
    return getJSON(K.settings, {notice:"", vipBanner:"", homeMessage:"Bem-vindo ao PAULO SENSI 🔥"});
  }
  function setSettings(s){ setJSON(K.settings, s); }

  /* ---------- VIP locks ---------- */
  function getVipLocks(){
    return getJSON(K.vipLocks, {vip2:false, vip3:false});
  }
  function setVipLocks(v){ setJSON(K.vipLocks, v); }

  function canSeeTier(tier){
    const plan = getPlan();
    const locks = getVipLocks();
    if(tier==="free") return true;
    if(tier==="standard"){
      if(locks.vip2) return false;
      return plan==="standard" || plan==="premium";
    }
    if(tier==="premium"){
      if(locks.vip3) return false;
      return plan==="premium";
    }
    return false;
  }
  function bestTierAvailable(){
    if(canSeeTier("premium")) return "premium";
    if(canSeeTier("standard")) return "standard";
    return "free";
  }

  function updateTopBar(){
    const p = getPlan();
    const s = getSettings();
    $("brandSub") && ($("brandSub").textContent = `Sensi Free Fire • ${planLabel(p)}${s.vipBanner?` • ${s.vipBanner}`:""}`);
    $("vipChip") && ($("vipChip").textContent = p==="premium"?"VIP 3":p==="standard"?"VIP 2":"GRÁTIS");
  }

  /* ---------- Overrides merge ---------- */
  function getOverrides(){
    return getJSON(K.overrides, {brands:{}, sensi:{}});
  }
  function setOverrides(o){ setJSON(K.overrides, o); }

  function getBrandList(){
    const o = getOverrides();
    return DB.brands.map(b=>{
      const ob = o.brands[b.id];
      const models = ob?.models ? ob.models : b.models.slice();
      return {...b, models};
    });
  }
  function keyBM(brandId, modelName){ return `${brandId}|||${modelName}`; }

  function computeSensi(brandId, modelName, tier){
    const o = getOverrides();
    const kbm = keyBM(brandId, modelName);
    const ov = o.sensi[kbm]?.[tier];
    if(ov) return {...ov};

    const base = {...DB.defaultSensiByTier[tier]};
    const tw = DB.brandTweaks[brandId] || {};
    const out = {};
    for(const k of Object.keys(base)){
      out[k] = clamp((base[k] + (tw[k]||0)), 0, 2000);
    }
    // variação leve por modelo (determinística)
    const seed = brandId + modelName + tier;
    let sum = 0; for(let i=0;i<seed.length;i++) sum += seed.charCodeAt(i);
    const bump = (sum % 5) - 2;
    out.geral = clamp(out.geral + bump, 0, 200);
    out.redDot = clamp(out.redDot + bump, 0, 200);
    out.x2 = clamp(out.x2 + bump, 0, 200);
    out.x4 = clamp(out.x4 + bump, 0, 200);
    out.awm = clamp(out.awm + Math.floor(bump/2), 0, 200);
    out.olhadinha = clamp(out.olhadinha + bump, 0, 200);
    out.dpi = clamp(out.dpi + bump*5, 200, 1000);
    out.botao = clamp(out.botao + bump, 10, 100);
    return out;
  }

  /* ---------- Favorites, recents, history ---------- */
  function getFavs(){ return getJSON(K.favorites, []); }
  function setFavs(arr){
    setJSON(K.favorites, arr);
    const s = getJSON(K.stats, {opens:0, copies:0, favorites:0, modelOpens:{}});
    s.favorites = arr.length;
    setJSON(K.stats, s);
    renderOwnerSummary();
  }
  function isFav(brandId, modelName){
    return getFavs().includes(keyBM(brandId, modelName));
  }
  function toggleFav(brandId, modelName){
    const flags = getFlags();
    if(flags.blockFavorites){ toast("Favoritos bloqueado pelo dono 🔒"); return; }
    const kbm = keyBM(brandId, modelName);
    const favs = getFavs();
    const i = favs.indexOf(kbm);
    if(i>=0){ favs.splice(i,1); toast("Removido dos favoritos"); logAction("FAVORITO", `Removeu ${modelName}`); }
    else { favs.unshift(kbm); toast("Favoritado ⭐"); logAction("FAVORITO", `Favoritou ${modelName}`); }
    setFavs(favs.slice(0, 100));
  }

  function pushRecent(kbm){
    const arr = getJSON(K.recentModels, []);
    const idx = arr.indexOf(kbm);
    if(idx>=0) arr.splice(idx,1);
    arr.unshift(kbm);
    setJSON(K.recentModels, arr.slice(0, 20));
  }

  function addCopyHistory(item){
    const flags = getFlags();
    if(flags.blockCopy) return;
    const arr = getJSON(K.copyHistory, []);
    arr.unshift({ts: now(), ...item});
    setJSON(K.copyHistory, arr.slice(0, 80));
  }

  /* ---------- Views / nav ---------- */
  const views = {
    splash: $("viewSplash"),
    brands: $("viewBrands"),
    models: $("viewModels"),
    sensi: $("viewSensi"),
    plans: $("viewPlans"),
    owner: $("viewOwner"),
  };
  const topbar = $("topbar");
  const btnBack = $("btnBack");
  const navStack = [];

  function showView(name, push=true){
    Object.values(views).forEach(v => v && v.classList.add("hidden"));
    views[name] && views[name].classList.remove("hidden");
    if(name==="splash") topbar?.classList.add("hidden"); else topbar?.classList.remove("hidden");
    if(push){ navStack.push(name); if(navStack.length>80) navStack.shift(); }
    if(btnBack){ btnBack.style.visibility = (name==="brands"||name==="splash") ? "hidden" : "visible"; }
  }
  function goBack(){
    if(navStack.length<=1){ showView("brands", false); return; }
    navStack.pop();
    showView(navStack[navStack.length-1], false);
  }
  btnBack?.addEventListener("click", goBack);

  /* ---------- Secret 5 taps ---------- */
  let tapCount = 0;
  let tapTimer = null;
  function secretTap(){
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(()=>tapCount=0, 900);
    if(tapCount>=5){
      tapCount=0;
      openOwnerModal();
    }
  }
  $("brandTapArea")?.addEventListener("click", secretTap);
  $("splashLogoTap")?.addEventListener("click", secretTap);

  function openOwnerModal(){
    $("ownerModal")?.classList.remove("hidden");
    $("ownerUser") && ($("ownerUser").value="");
    $("ownerPass") && ($("ownerPass").value="");
    $("ownerLoginMsg") && ($("ownerLoginMsg").textContent="");
  }
  function closeOwnerModal(){ $("ownerModal")?.classList.add("hidden"); }
  $("btnCloseOwner")?.addEventListener("click", closeOwnerModal);

  $("btnOwnerLogin")?.addEventListener("click", ()=>{
    const u = ($("ownerUser")?.value || "").trim();
    const p = ($("ownerPass")?.value || "");
    if(u===OWNER_USER && p===OWNER_PASS){
      setOwnerSession();
      closeOwnerModal();
      toast("Dono logado ✅");
      logAction("DONO", "Login efetuado");
      openOwnerPanel();
    } else {
      $("ownerLoginMsg") && ($("ownerLoginMsg").textContent="Usuário ou senha inválidos.");
      logAction("DONO", "Tentativa falhou");
    }
  });

  /* ---------- Splash ---------- */
  $("btnStart")?.addEventListener("click", ()=>{
    showView("brands");
    incStat("opens", 1);
  });

  /* ---------- Plans button ---------- */
  $("btnPlans")?.addEventListener("click", ()=>{
    renderPlans();
    showView("plans");
  });

  /* ---------- Quick row (home chips) ---------- */
  function hashStr(s){
    let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
    return Math.abs(h);
  }

  function pickTopOfDaySmart(){
    const list = getBrandList();
    const st = getJSON(K.stats, {modelOpens:{}});
    const opens = st.modelOpens || {};
    const all = [];
    for(const b of list){
      for(const m of b.models){
        const kbm = keyBM(b.id,m);
        all.push({brandId:b.id, modelName:m, score: opens[kbm]||0});
      }
    }
    all.sort((a,b)=>b.score-a.score);
    const top = all.slice(0, 25);
    const d = new Date();
    const seed = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    const idx = hashStr(seed) % (top.length || all.length);
    const pick = (top.length ? top[idx] : all[idx]) || all[0];
    return {brandId: pick.brandId, modelName: pick.modelName};
  }

  function buildExtraModal(title, bodyHtml, footerHtml=""){
    let m = document.getElementById("psExtraModal");
    if(!m){
      m = document.createElement("div");
      m.id = "psExtraModal";
      m.className = "modal hidden";
      m.innerHTML = `
        <div class="modal-card">
          <div class="modal-head">
            <div class="modal-title" id="psExtraTitle"></div>
            <button class="icon-btn" id="psExtraClose" aria-label="Fechar">✕</button>
          </div>
          <div id="psExtraBody"></div>
          <div id="psExtraFooter" style="margin-top:12px"></div>
        </div>
      `;
      document.body.appendChild(m);
      m.querySelector("#psExtraClose").addEventListener("click", ()=>m.classList.add("hidden"));
      m.addEventListener("click",(e)=>{ if(e.target===m) m.classList.add("hidden"); });
    }
    m.querySelector("#psExtraTitle").textContent = title;
    m.querySelector("#psExtraBody").innerHTML = bodyHtml;
    m.querySelector("#psExtraFooter").innerHTML = footerHtml;
    m.classList.remove("hidden");
  }

  function openFavList(){
    const favs = getFavs();
    if(favs.length===0){
      buildExtraModal("Favoritos ⭐", `<div class="muted">Você ainda não favoritou nenhum modelo.</div>`);
      return;
    }
    const list = getBrandList();
    const rows = favs.slice(0,60).map(kbm=>{
      const [bid, model] = kbm.split("|||");
      const b = list.find(x=>x.id===bid);
      return `
        <div class="trow" data-kbm="${escapeHtml(kbm)}" style="cursor:pointer">
          <div>
            <div class="k">${escapeHtml(model)}</div>
            <div class="muted">${escapeHtml(b?.name||bid)}</div>
          </div>
          <div class="v">ABRIR</div>
        </div>`;
    }).join("");
    buildExtraModal("Favoritos ⭐", `<div class="table">${rows}</div>`, `
      <button class="btn btn-ghost" id="psClearFav">Limpar favoritos</button>
    `);

    document.querySelectorAll("#psExtraModal .trow[data-kbm]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const [bid, model] = el.dataset.kbm.split("|||");
        document.getElementById("psExtraModal").classList.add("hidden");
        openSensi(bid, model);
      });
    });

    document.getElementById("psClearFav")?.addEventListener("click", ()=>{
      setFavs([]);
      toast("Favoritos zerados ✅");
      logAction("FAVORITO", "Zerou favoritos");
      document.getElementById("psExtraModal").classList.add("hidden");
    });
  }

  function openRecentList(){
    const arr = getJSON(K.recentModels, []);
    if(arr.length===0){
      buildExtraModal("Recentes 🕘", `<div class="muted">Nenhum modelo aberto ainda.</div>`);
      return;
    }
    const list = getBrandList();
    const rows = arr.map(kbm=>{
      const [bid, model] = kbm.split("|||");
      const b = list.find(x=>x.id===bid);
      return `
        <div class="trow" data-kbm="${escapeHtml(kbm)}" style="cursor:pointer">
          <div>
            <div class="k">${escapeHtml(model)}</div>
            <div class="muted">${escapeHtml(b?.name||bid)}</div>
          </div>
          <div class="v">ABRIR</div>
        </div>`;
    }).join("");
    buildExtraModal("Recentes 🕘", `<div class="table">${rows}</div>`);
    document.querySelectorAll("#psExtraModal .trow[data-kbm]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const [bid, model] = el.dataset.kbm.split("|||");
        document.getElementById("psExtraModal").classList.add("hidden");
        openSensi(bid, model);
      });
    });
  }

  function openCopyHistory(){
    const arr = getJSON(K.copyHistory, []);
    if(arr.length===0){
      buildExtraModal("Histórico de cópias 📋", `<div class="muted">Nenhuma cópia ainda.</div>`);
      return;
    }
    const rows = arr.slice(0,80).map(x=>{
      const when = new Date(x.ts).toLocaleString();
      return `
        <div class="trow" style="align-items:flex-start">
          <div>
            <div class="k">${escapeHtml(x.modelName)} • ${escapeHtml(x.tier.toUpperCase())}</div>
            <div class="muted">${escapeHtml(x.field)} = <b>${escapeHtml(x.value)}</b> • ${escapeHtml(when)}</div>
          </div>
          <div class="v" data-copy="${escapeHtml(x.value)}" style="cursor:pointer">COPIAR</div>
        </div>
      `;
    }).join("");

    buildExtraModal("Histórico de cópias 📋",
      `<div class="table">${rows}</div>`,
      `<div class="row">
        <button class="btn btn-ghost" id="psClearHistory">Limpar histórico</button>
      </div>`
    );

    document.querySelectorAll("#psExtraModal [data-copy]").forEach(el=>{
      el.addEventListener("click", ()=>{
        copyText(el.dataset.copy||"");
        toast("Copiado ✅");
      });
    });

    document.getElementById("psClearHistory")?.addEventListener("click", ()=>{
      setJSON(K.copyHistory, []);
      toast("Histórico limpo ✅");
      logAction("HISTÓRICO", "Limpou histórico");
      document.getElementById("psExtraModal").classList.add("hidden");
    });
  }

  function toggleNeon(){
    const off = localStorage.getItem(K.neonOff)==="1";
    localStorage.setItem(K.neonOff, off ? "0":"1");
    applyNeon();
    toast(off ? "Neon ON" : "Neon OFF");
  }

  function renderHomeMini(){
    const quickRow = $("quickRow");
    if(!quickRow) return;
    const s = getSettings();
    const msg = s.notice ? `📢 ${s.notice}` : (s.homeMessage || "Bem-vindo ao PAULO SENSI 🔥");

    const items = [
      {label:"🔥 Top do dia", act:"top", hot:true},
      {label:"⭐ Favoritos", act:"fav"},
      {label:"🕘 Recentes", act:"recent"},
      {label:"📋 Histórico", act:"history"},
      {label:"💳 Planos", act:"plans", hot:true},
      {label:"🌓 Neon", act:"neon"},
      {label:"🧹 Limpar busca", act:"clear"},
    ];

    quickRow.innerHTML = `
      <button class="chip hot" data-act="msg">${escapeHtml(msg)}</button>
      ${items.map(it=>`<button class="chip ${it.hot?"hot":""}" data-act="${it.act}">${escapeHtml(it.label)}</button>`).join("")}
    `;

    quickRow.querySelectorAll(".chip[data-act]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const act = btn.dataset.act;
        if(act==="plans"){ renderPlans(); showView("plans"); return; }
        if(act==="top"){ const pick = pickTopOfDaySmart(); toast("Top do dia 🔥"); openSensi(pick.brandId, pick.modelName); return; }
        if(act==="fav"){ openFavList(); return; }
        if(act==="recent"){ openRecentList(); return; }
        if(act==="history"){ openCopyHistory(); return; }
        if(act==="neon"){ toggleNeon(); return; }
        if(act==="clear"){ $("searchInput").value=""; renderBrands(); toast("Busca limpa ✅"); return; }
        if(act==="msg"){ toast(msg); return; }
      });
    });
  }

  /* ---------- Brands + Search ---------- */
  const brandsGrid = $("brandsGrid");
  const searchInput = $("searchInput");

  function brandCardHTML(b){
    return `
      <div class="card" data-brand="${escapeHtml(b.id)}">
        <div class="card-title">${escapeHtml(b.name)}</div>
        <div class="card-sub">${b.models.length} modelos • toque para abrir</div>
      </div>
    `;
  }
  function modelShortcutCardHTML(b, model){
    return `
      <div class="card" data-brand="${escapeHtml(b.id)}" data-model="${escapeHtml(model)}">
        <div class="card-title">${escapeHtml(model)}</div>
        <div class="card-sub">${escapeHtml(b.name)} • abrir sensi</div>
      </div>
    `;
  }

  function attachBrandHandlers(){
    brandsGrid?.querySelectorAll(".card").forEach(card=>{
      card.addEventListener("click", ()=>{
        const brandId = card.dataset.brand;
        const modelName = card.dataset.model;
        if(modelName) openSensi(brandId, modelName);
        else openModels(brandId);
      });
    });
  }

  function renderBrands(){
    const q = (searchInput?.value || "").trim().toLowerCase();
    const list = getBrandList();

    if(q){
      const results = [];
      for(const b of list){
        const bMatch = b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q);
        if(bMatch){ results.push({type:"brand", brand:b}); continue; }
        for(const m of b.models){
          if(m.toLowerCase().includes(q)){
            results.push({type:"model", brand:b, model:m});
          }
        }
      }
      // se achou modelos, mostra atalhos
      if(results.some(r=>r.type==="model")){
        brandsGrid.innerHTML = results.slice(0, 70).map(r=>{
          if(r.type==="brand") return brandCardHTML(r.brand);
          return modelShortcutCardHTML(r.brand, r.model);
        }).join("");
        attachBrandHandlers();
        return;
      }
      // senão, filtra marcas
      const filtered = list.filter(b=>b.name.toLowerCase().includes(q));
      brandsGrid.innerHTML = filtered.map(brandCardHTML).join("");
      attachBrandHandlers();
      return;
    }

    brandsGrid.innerHTML = list.map(brandCardHTML).join("");
    attachBrandHandlers();
  }

  searchInput?.addEventListener("input", renderBrands);
  $("btnClearSearch")?.addEventListener("click", ()=>{
    $("searchInput").value = "";
    renderBrands();
    $("searchInput").focus();
  });

  /* ---------- Models ---------- */
  const modelsGrid = $("modelsGrid");
  let currentBrandId = null;
  let showOnlyFav = false;
  let sortMode = 0;

  $("btnFavOnly")?.addEventListener("click", ()=>{
    showOnlyFav = !showOnlyFav;
    $("btnFavOnly").textContent = showOnlyFav ? "⭐ Favoritos (ON)" : "⭐ Favoritos";
    renderModels();
  });

  $("btnSort")?.addEventListener("click", ()=>{
    sortMode = (sortMode+1)%3;
    $("btnSort").textContent = sortMode===0 ? "⇅ Ordenar (A-Z)" : sortMode===1 ? "⇅ Ordenar (Mais usados)" : "⇅ Ordenar (Recentes)";
    renderModels();
  });

  $("btnTopDay")?.addEventListener("click", ()=>{
    const pick = pickTopOfDaySmart();
    openSensi(pick.brandId, pick.modelName);
  });

  function openModels(brandId){
    currentBrandId = brandId;
    showOnlyFav = false;
    sortMode = 0;
    $("btnFavOnly").textContent = "⭐ Favoritos";
    $("btnSort").textContent = "⇅ Ordenar";

    const b = getBrandList().find(x=>x.id===brandId);
    $("modelsTitle").textContent = b ? `Modelos • ${b.name}` : "Modelos";
    $("modelsSub").textContent = "Escolha seu modelo para abrir a sensi.";
    renderModels();
    showView("models");
  }

  function renderModels(){
    const list = getBrandList();
    const b = list.find(x=>x.id===currentBrandId);
    if(!b){ modelsGrid.innerHTML=""; return; }

    let models = b.models.slice();
    if(showOnlyFav){
      const favs = new Set(getFavs());
      models = models.filter(m=>favs.has(keyBM(b.id,m)));
    }

    const stats = getJSON(K.stats, {modelOpens:{}});
    const opens = stats.modelOpens || {};

    if(sortMode===0){
      models.sort((a,bb)=>a.localeCompare(bb));
    } else if(sortMode===1){
      models.sort((a,bb)=> (opens[keyBM(b.id,bb)]||0) - (opens[keyBM(b.id,a)]||0));
    } else {
      const rec = getJSON(K.recentModels, []);
      const pos = new Map(rec.map((k,i)=>[k,i]));
      models.sort((a,bb)=>{
        const pa = pos.has(keyBM(b.id,a)) ? pos.get(keyBM(b.id,a)) : 9999;
        const pb = pos.has(keyBM(b.id,bb)) ? pos.get(keyBM(b.id,bb)) : 9999;
        if(pa!==pb) return pa-pb;
        return a.localeCompare(bb);
      });
    }

    modelsGrid.innerHTML = models.map(m=>{
      const cnt = opens[keyBM(b.id,m)] || 0;
      const fav = isFav(b.id,m);
      const hint = fav ? "⭐ Favorito" : "Toque para abrir";
      const sub = cnt ? `${hint} • ${cnt} usos` : hint;
      return `
        <div class="card" data-model="${escapeHtml(m)}">
          <div class="card-title">${escapeHtml(m)}</div>
          <div class="card-sub">${escapeHtml(sub)}</div>
        </div>
      `;
    }).join("");

    modelsGrid.querySelectorAll(".card").forEach(c=>{
      // click abre
      c.addEventListener("click", ()=>openSensi(currentBrandId, c.dataset.model));
      // segurar favoritar
      let t=null;
      c.addEventListener("touchstart", ()=>{ t=setTimeout(()=>{ toggleFav(currentBrandId, c.dataset.model); renderModels(); }, 520); }, {passive:true});
      c.addEventListener("touchend", ()=>clearTimeout(t));
      c.addEventListener("contextmenu", (e)=>{ e.preventDefault(); toggleFav(currentBrandId, c.dataset.model); renderModels(); });
    });
  }

  /* ---------- Sensi view ---------- */
  const vipTabs = Array.from(document.querySelectorAll(".vip-tab"));
  let currentModel = {brandId:null, modelName:null};
  let currentTier = "free";

  vipTabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const tier = btn.dataset.tier;
      if(!canSeeTier(tier)){
        toast("Conteúdo VIP. Assine para liberar.");
        renderPlans();
        showView("plans");
        return;
      }
      currentTier = tier;
      renderSensi();
    });
  });

  $("btnFavModel")?.addEventListener("click", ()=>{
    if(!currentModel.brandId) return;
    toggleFav(currentModel.brandId, currentModel.modelName);
    renderFavIcon();
  });

  $("btnCopyAll")?.addEventListener("click", ()=>{
    if(!currentModel.brandId) return;
    const flags = getFlags();
    if(flags.blockCopy){ toast("Copiar bloqueado pelo dono 🔒"); return; }

    const s = computeSensi(currentModel.brandId, currentModel.modelName, currentTier);
    const txt =
`PAULO SENSI (${planLabel(getPlan())})
Modelo: ${currentModel.modelName}
Geral: ${s.geral}
Red Dot: ${s.redDot}
2x: ${s.x2}
4x: ${s.x4}
AWM: ${s.awm}
Olhadinha: ${s.olhadinha}
DPI: ${s.dpi}
Tamanho do Botão: ${s.botao}`;

    copyText(txt);
    incStat("copies", 1);
    addCopyHistory({brandId:currentModel.brandId, modelName:currentModel.modelName, tier:currentTier, field:"TUDO", value:"TUDO"});
    logAction("COPIAR", `${currentModel.modelName} (TUDO)`);
  });

  $("btnShare")?.addEventListener("click", async ()=>{
    const flags = getFlags();
    if(flags.blockShare){ toast("Compartilhar bloqueado pelo dono 🔒"); return; }
    const url = location.href.split("#")[0];
    const text = "PAULO SENSI 🔥 App de sensibilidade Free Fire (neon roxo)!";
    try{
      if(navigator.share){
        await navigator.share({title:"PAULO SENSI", text, url});
        toast("Compartilhado ✅");
      }else{
        copyText(`${text}\n${url}`);
        toast("Link copiado ✅");
      }
    }catch{}
  });

  function openSensi(brandId, modelName){
    currentModel = {brandId, modelName};
    const b = getBrandList().find(x=>x.id===brandId);
    $("sensiBrandKicker").textContent = b ? b.name : "Marca";
    $("sensiModelTitle").textContent = modelName;

    currentTier = bestTierAvailable();
    const kbm = keyBM(brandId, modelName);
    pushRecent(kbm);
    incModelOpen(kbm);

    renderSensi();
    showView("sensi");
  }

  function renderVipTabs(){
    vipTabs.forEach(b=>{
      const t = b.dataset.tier;
      b.classList.toggle("active", t===currentTier);
      b.style.opacity = canSeeTier(t) ? "1" : ".55";
    });
    updateTopBar();
  }

  function renderFavIcon(){
    const btn = $("btnFavModel");
    if(!btn) return;
    const fav = isFav(currentModel.brandId, currentModel.modelName);
    btn.textContent = fav ? "★" : "☆";
    btn.classList.toggle("on", fav);
  }

  function renderSensi(){
    renderVipTabs();
    renderFavIcon();

    const locks = getVipLocks();
    let meta = "Sensi travada para cliente • Copie e use";
    if(isOwner()) meta = "Modo DONO • Edite pelo Painel do Dono";
    if((currentTier==="standard" && locks.vip2) || (currentTier==="premium" && locks.vip3)){
      meta = "Tier bloqueado pelo dono • Selecione outro tier";
    }
    $("sensiMeta").textContent = meta;

    const s = computeSensi(currentModel.brandId, currentModel.modelName, currentTier);
    const fields = [
      {k:"geral", label:"Geral"},
      {k:"redDot", label:"Red Dot"},
      {k:"x2", label:"Mira 2x"},
      {k:"x4", label:"Mira 4x"},
      {k:"awm", label:"AWM / Sniper"},
      {k:"olhadinha", label:"Olhadinha"},
      {k:"dpi", label:"DPI"},
      {k:"botao", label:"Tamanho do Botão"}
    ];

    $("sensiPanel").innerHTML = fields.map(f=>`
      <div class="sensi-row" data-field="${escapeHtml(f.k)}" style="cursor:pointer">
        <div>
          <div class="sensi-name">${escapeHtml(f.label)}</div>
          <div class="muted">Toque para copiar esse item</div>
        </div>
        <div style="text-align:right">
          <div class="sensi-val">${escapeHtml(s[f.k])}</div>
          <div class="lock">🔒 travado</div>
        </div>
      </div>
    `).join("");

    $("sensiPanel").querySelectorAll(".sensi-row[data-field]").forEach(row=>{
      row.addEventListener("click", ()=>{
        const flags = getFlags();
        if(flags.blockCopy){ toast("Copiar bloqueado pelo dono 🔒"); return; }
        const fk = row.dataset.field;
        const val = s[fk];
        const label = fields.find(x=>x.k===fk)?.label || fk;
        copyText(`${label}: ${val}`);
        incStat("copies", 1);
        addCopyHistory({brandId:currentModel.brandId, modelName:currentModel.modelName, tier:currentTier, field:label, value:String(val)});
        logAction("COPIAR", `${currentModel.modelName} ${label}=${val}`);
      });
    });
  }

  function copyText(text){
    navigator.clipboard?.writeText(text).then(()=>{
      toast("Copiado ✅");
    }).catch(()=>{
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copiado ✅");
    });
  }

  /* ---------- Plans / PIX / WhatsApp / Code unlock ---------- */
  function renderPlans(){
    $("pixBox")?.classList.add("hidden");
    $("unlockMsg").textContent = "";
    $("unlockCodeInput").value = "";
    updateTopBar();
  }

  $("btnUseFree")?.addEventListener("click", ()=>{
    setPlan("free");
    toast("Plano grátis ativado");
  });

  $("btnPayStandard")?.addEventListener("click", ()=>openPix("standard"));
  $("btnPayPremium")?.addEventListener("click", ()=>openPix("premium"));

  function openPix(type){
    $("pixTitle").textContent = type==="premium" ? "PIX Premium • R$ 19,50" : "PIX Padrão • R$ 9,99";
    $("pixCode").textContent = PIX[type];
    $("pixBox").classList.remove("hidden");

    $("btnCopyPix").onclick = ()=>{ copyText(PIX[type]); logAction("PAGAMENTO","PIX copiado "+type); };
    $("btnClosePix").onclick = ()=>{ $("pixBox").classList.add("hidden"); };

    $("btnWhats").onclick = ()=>{
      const msg = encodeURIComponent("Olá, acabei de pagar o plano do PAULO SENSI, segue meu comprovante.");
      window.open(`https://wa.me/55${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
      logAction("PAGAMENTO","Abriu WhatsApp "+type);
    };
  }

  $("btnApplyCode")?.addEventListener("click", applyUnlockCode);
  $("unlockCodeInput")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") applyUnlockCode(); });

  function applyUnlockCode(){
    const code = ($("unlockCodeInput").value || "").trim();
    if(!code){ $("unlockMsg").textContent="Digite um código."; return; }

    const clients = getJSON(K.clients, {});
    const rec = clients[code.toLowerCase()];
    if(!rec){
      $("unlockMsg").textContent="Código não encontrado. Peça para o dono liberar.";
      logAction("VIP","Tentativa inválida: "+code);
      return;
    }

    const expected = signPayload({k:code.toLowerCase(), plan:rec.plan, ts:rec.ts});
    if(rec.sig && rec.sig !== expected){
      $("unlockMsg").textContent="Código inválido (assinatura). Contate o dono.";
      logAction("VIP","Assinatura inválida: "+code);
      return;
    }

    setPlan(rec.plan);
    $("unlockMsg").textContent = `VIP liberado: ${planLabel(rec.plan)} ✅`;
    toast("VIP liberado ✅");
    logAction("VIP", `Liberou por código: ${code} (${rec.plan})`);
  }

  /* ---------- Owner panel ---------- */
  function openOwnerPanel(){
    if(!isOwner()){ toast("Faça login do dono."); return; }
    renderOwnerSummary();
    initOwnerSelects();
    renderClientsTable();
    renderLogs();
    renderToolsGrid();   // 300+ cards
    renderModelTools();
    showView("owner");
  }

  // tabs
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const ownerPanels = Array.from(document.querySelectorAll(".owner-panel"));
  tabs.forEach(t=>{
    t.addEventListener("click", ()=>{
      tabs.forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      const id = t.dataset.tab;
      ownerPanels.forEach(p=>p.classList.toggle("hidden", p.dataset.panel!==id));
      if(id==="logs") renderLogs();
    });
  });

  function renderOwnerSummary(){
    const st = getJSON(K.stats, {opens:0, copies:0, favorites:0});
    const clients = getJSON(K.clients, {});
    $("ownerSummary").innerHTML = `
      <div class="sum-card"><div class="sum-k">Acessos</div><div class="sum-v">${st.opens||0}</div></div>
      <div class="sum-card"><div class="sum-k">Favoritos</div><div class="sum-v">${st.favorites||0}</div></div>
      <div class="sum-card"><div class="sum-k">VIP liberados (local)</div><div class="sum-v">${Object.keys(clients).length}</div></div>
      <div class="sum-card"><div class="sum-k">Cópias</div><div class="sum-v">${st.copies||0}</div></div>
    `;
  }

  /* ----- Clients ----- */
  $("btnGrantVip")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const key = ($("clientKey").value||"").trim();
    const plan = $("clientPlan").value || "standard";
    if(!key) return toast("Digite e-mail ou código.");

    const clients = getJSON(K.clients, {});
    const k = key.toLowerCase();
    const rec = {plan, ts: now()};
    rec.sig = signPayload({k, plan:rec.plan, ts:rec.ts});
    clients[k] = rec;
    setJSON(K.clients, clients);

    $("clientMsg").textContent = `Liberado: ${key} → ${planLabel(plan)} ✅`;
    toast("VIP liberado ✅");
    logAction("CLIENTE", `Liberou ${key} -> ${plan}`);
    renderClientsTable();
    updateTopBar();
  });

  $("btnRevokeVip")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const key = ($("clientKey").value||"").trim();
    if(!key) return toast("Digite e-mail ou código.");
    const clients = getJSON(K.clients, {});
    const k = key.toLowerCase();
    if(clients[k]){
      delete clients[k];
      setJSON(K.clients, clients);
      toast("Removido ✅");
      logAction("CLIENTE", `Removeu ${key}`);
      $("clientMsg").textContent = `Removido: ${key}`;
      renderClientsTable();
    } else {
      $("clientMsg").textContent = "Cliente não encontrado.";
    }
  });

  $("btnResetVipAll")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    setJSON(K.clients, {});
    toast("VIP resetado ✅");
    logAction("CLIENTE","Reset VIP todos");
    renderClientsTable();
  });

  function renderClientsTable(){
    const box = $("clientsTable");
    const clients = getJSON(K.clients, {});
    const keys = Object.keys(clients).sort((a,b)=>a.localeCompare(b));
    if(keys.length===0){ box.innerHTML = `<div class="muted">Nenhum cliente liberado ainda.</div>`; return; }
    box.innerHTML = keys.map(k=>{
      const rec = clients[k];
      const when = new Date(rec.ts).toLocaleString();
      return `
        <div class="trow">
          <div>
            <div class="k">${escapeHtml(k)}</div>
            <div class="muted">${escapeHtml(when)}</div>
          </div>
          <div class="v">${planLabel(rec.plan)}</div>
        </div>
      `;
    }).join("");
  }

  /* ----- Owner selects (sensi/models) ----- */
  function initOwnerSelects(){
    const list = getBrandList();
    const brandSel1 = $("editBrand");
    const brandSel2 = $("modelBrand");
    brandSel1.innerHTML = list.map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join("");
    brandSel2.innerHTML = brandSel1.innerHTML;

    brandSel1.onchange = fillModelsForEdit;
    $("editModel").onchange = renderEditSensi;
    $("editTier").onchange = renderEditSensi;

    fillModelsForEdit();
  }

  function fillModelsForEdit(){
    const list = getBrandList();
    const brandId = $("editBrand").value;
    const b = list.find(x=>x.id===brandId);
    $("editModel").innerHTML = (b?.models||[]).map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
    renderEditSensi();
  }

  function renderEditSensi(){
    const brandId = $("editBrand").value;
    const modelName = $("editModel").value;
    const tier = $("editTier").value;
    if(!brandId || !modelName) return;

    const s = computeSensi(brandId, modelName, tier);
    const fields = [
      ["geral","Geral"],["redDot","Red Dot"],["x2","Mira 2x"],["x4","Mira 4x"],
      ["awm","AWM / Sniper"],["olhadinha","Olhadinha"],["dpi","DPI"],["botao","Tamanho do Botão"]
    ];
    $("editSensiGrid").innerHTML = fields.map(([k,label])=>`
      <div class="field">
        <div>
          <div class="sensi-name">${escapeHtml(label)}</div>
          <div class="muted">${escapeHtml(tier.toUpperCase())}</div>
        </div>
        <input class="input" data-k="${escapeHtml(k)}" value="${escapeHtml(s[k])}" inputmode="numeric" />
      </div>
    `).join("");
  }

  $("btnSaveSensi")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const brandId = $("editBrand").value;
    const modelName = $("editModel").value;
    const tier = $("editTier").value;
    const inputs = Array.from($("editSensiGrid").querySelectorAll("input[data-k]"));
    const obj = {};
    inputs.forEach(inp=>{
      const k = inp.dataset.k;
      const v = Number(String(inp.value).replace(",", "."));
      obj[k] = clamp(Number.isFinite(v)?v:0, 0, 2000);
    });

    const o = getOverrides();
    const kbm = keyBM(brandId, modelName);
    o.sensi[kbm] = o.sensi[kbm] || {};
    o.sensi[kbm][tier] = obj;
    setOverrides(o);

    toast("Sensi salva ✅");
    $("sensiMsg").textContent = `Salvo: ${modelName} • ${tier}`;
    logAction("SENSI", `Salvou ${modelName} (${tier})`);
  });

  $("btnResetSensiModel")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const brandId = $("editBrand").value;
    const modelName = $("editModel").value;
    const o = getOverrides();
    const kbm = keyBM(brandId, modelName);
    if(o.sensi[kbm]){ delete o.sensi[kbm]; setOverrides(o); toast("Resetado ✅"); logAction("SENSI", `Resetou ${modelName}`); }
    renderEditSensi();
  });

  /* ----- Model CRUD ----- */
  $("btnAddModel")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const brandId = $("modelBrand").value;
    const name = ($("modelName").value||"").trim();
    if(!name) return toast("Digite o nome do modelo.");
    const list = getBrandList();
    const base = list.find(x=>x.id===brandId);
    if(!base) return toast("Marca inválida.");

    const o = getOverrides();
    o.brands[brandId] = o.brands[brandId] || {models: base.models.slice()};
    const arr = o.brands[brandId].models;
    if(arr.includes(name)) return toast("Modelo já existe.");
    arr.push(name);
    setOverrides(o);

    toast("Modelo adicionado ✅");
    logAction("MODELO", `Adicionou ${name} em ${brandId}`);
    initOwnerSelects();
    renderBrands();
  });

  $("btnRemoveModel")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const brandId = $("modelBrand").value;
    const name = ($("modelName").value||"").trim();
    if(!name) return toast("Digite o nome do modelo.");

    const list = getBrandList();
    const base = list.find(x=>x.id===brandId);
    if(!base) return toast("Marca inválida.");

    const o = getOverrides();
    o.brands[brandId] = o.brands[brandId] || {models: base.models.slice()};
    const arr = o.brands[brandId].models;
    const idx = arr.indexOf(name);
    if(idx<0) return toast("Modelo não encontrado.");
    arr.splice(idx,1);
    delete o.sensi[keyBM(brandId, name)];
    setOverrides(o);

    toast("Modelo removido ✅");
    logAction("MODELO", `Removeu ${name} de ${brandId}`);
    initOwnerSelects();
    renderBrands();
  });

  $("btnRenameModel")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const brandId = $("modelBrand").value;
    const name = ($("modelName").value||"").trim();
    if(!name) return toast("Digite o modelo atual.");

    const newName = prompt("Novo nome do modelo:", name);
    if(!newName || !newName.trim()) return;
    const nn = newName.trim();

    const list = getBrandList();
    const base = list.find(x=>x.id===brandId);
    if(!base) return toast("Marca inválida.");

    const o = getOverrides();
    o.brands[brandId] = o.brands[brandId] || {models: base.models.slice()};
    const arr = o.brands[brandId].models;
    const idx = arr.indexOf(name);
    if(idx<0) return toast("Modelo não encontrado.");
    if(arr.includes(nn)) return toast("Já existe com esse nome.");

    arr[idx] = nn;
    const oldKey = keyBM(brandId, name);
    const newKey = keyBM(brandId, nn);
    if(o.sensi[oldKey]){
      o.sensi[newKey] = o.sensi[oldKey];
      delete o.sensi[oldKey];
    }
    const favs = getFavs();
    const fi = favs.indexOf(oldKey);
    if(fi>=0){ favs[fi]=newKey; setFavs(favs); }

    setOverrides(o);
    toast("Renomeado ✅");
    logAction("MODELO", `Renomeou ${name} -> ${nn}`);
    initOwnerSelects();
    renderBrands();
  });

  /* ----- VIP banner & locks ----- */
  $("btnSaveVipBanner")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const s = getSettings();
    s.vipBanner = ($("vipBanner").value||"").trim();
    setSettings(s);
    toast("Salvo ✅");
    logAction("VIP", "Salvou banner VIP");
    updateTopBar();
    renderHomeMini();
  });

  function toggleLock(which, val){
    if(!isOwner()) return toast("Sem permissão.");
    const locks = getVipLocks();
    locks[which] = val;
    setVipLocks(locks);
    toast(val ? "Bloqueado 🔒" : "Desbloqueado 🔓");
    logAction("VIP", `${which} => ${val ? "bloqueado" : "liberado"}`);
  }

  $("btnLockVip2")?.addEventListener("click", ()=>toggleLock("vip2", true));
  $("btnUnlockVip2")?.addEventListener("click", ()=>toggleLock("vip2", false));
  $("btnLockVip3")?.addEventListener("click", ()=>toggleLock("vip3", true));
  $("btnUnlockVip3")?.addEventListener("click", ()=>toggleLock("vip3", false));

  /* ----- Settings ----- */
  $("btnSaveNotice")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const s = getSettings();
    s.notice = ($("appNotice").value||"").trim();
    setSettings(s);
    toast("Salvo ✅");
    logAction("AJUSTE", "Aviso salvo");
    renderHomeMini();
    updateTopBar();
  });

  $("btnToggleNeon")?.addEventListener("click", toggleNeon);

  $("btnClearStats")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const favCount = getFavs().length;
    setJSON(K.stats, {opens:0, copies:0, favorites:favCount, modelOpens:{}});
    toast("Stats zeradas ✅");
    logAction("AJUSTE", "Zerou estatísticas");
    renderOwnerSummary();
  });

  /* ----- Backup / Import / Export ----- */
  $("btnExport")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const payload = exportAll();
    downloadJSON(payload, `paulo-sensi-backup-${Date.now()}.json`);
    logAction("BACKUP", "Export JSON");
    $("backupMsg").textContent = "Exportado ✅";
  });

  $("btnImport")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    $("importFile").click();
  });

  $("importFile")?.addEventListener("change", async (e)=>{
    if(!isOwner()) return;
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const obj = JSON.parse(await file.text());
      importAll(obj);
      refreshAfterImport();
      toast("Importado ✅");
      logAction("BACKUP", "Import JSON");
      $("backupMsg").textContent = "Importado ✅";
    }catch{
      toast("Erro ao importar");
      $("backupMsg").textContent = "JSON inválido.";
    }finally{
      e.target.value = "";
    }
  });

  $("btnBackupLocal")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    setJSON(K.backupLocal, exportAll());
    toast("Backup local salvo ✅");
    logAction("BACKUP", "Backup local salvo");
    $("backupMsg").textContent = "Backup local salvo ✅";
  });

  $("btnRestoreLocal")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    const payload = getJSON(K.backupLocal, null);
    if(!payload) return toast("Sem backup local.");
    importAll(payload);
    refreshAfterImport();
    toast("Restaurado ✅");
    logAction("BACKUP", "Restaurou backup local");
    $("backupMsg").textContent = "Restaurado ✅";
  });

  $("btnFactoryReset")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    if(!confirm("Resetar TUDO do PAULO SENSI nesse aparelho?")) return;
    Object.values(K).forEach(key=>localStorage.removeItem(key));
    ensureLocalKey();
    applyNeon();
    setPlan("free");
    logAction("RESET", "Factory reset");
    location.reload();
  });

  function exportAll(){
    const payload = {
      meta:{app:"PAULO SENSI", v:1, ts: now()},
      plan:getPlan(),
      favorites:getFavs(),
      recents:getJSON(K.recentModels, []),
      history:getJSON(K.copyHistory, []),
      stats:getJSON(K.stats, {opens:0,copies:0,favorites:0,modelOpens:{}}),
      logs:getJSON(K.logs, []),
      clients:getJSON(K.clients, {}),
      vipLocks:getVipLocks(),
      settings:getSettings(),
      flags:getFlags(),
      overrides:getOverrides(),
      neonOff: localStorage.getItem(K.neonOff)==="1"
    };
    payload.sig = signPayload(payload.meta);
    return payload;
  }

  function importAll(payload){
    if(!payload?.meta || payload.meta.app!=="PAULO SENSI") throw new Error("invalid");
    setPlan(payload.plan||"free");
    setFavs(payload.favorites||[]);
    setJSON(K.recentModels, payload.recents||[]);
    setJSON(K.copyHistory, payload.history||[]);
    setJSON(K.stats, payload.stats||{opens:0,copies:0,favorites:0,modelOpens:{}});
    setJSON(K.logs, payload.logs||[]);
    setJSON(K.clients, payload.clients||{});
    setVipLocks(payload.vipLocks||{vip2:false,vip3:false});
    setSettings(payload.settings||{notice:"",vipBanner:"",homeMessage:"Bem-vindo ao PAULO SENSI 🔥"});
    setFlags(payload.flags||{blockShare:false,blockCopy:false,blockFavorites:false});
    setOverrides(payload.overrides||{brands:{},sensi:{}});
    localStorage.setItem(K.neonOff, payload.neonOff ? "1":"0");
  }

  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function refreshAfterImport(){
    applyNeon();
    updateTopBar();
    renderHomeMini();
    renderBrands();
    initOwnerSelects();
    renderClientsTable();
    renderOwnerSummary();
    renderLogs();
    renderToolsGrid();
  }

  /* ----- Security ----- */
  $("btnRotateKey")?.addEventListener("click", ()=>{
    if(!isOwner()) return toast("Sem permissão.");
    localStorage.setItem(K.localKey, Math.random().toString(36).slice(2)+"-"+Math.random().toString(36).slice(2));
    toast("Chave trocada ✅");
    logAction("SEGURANÇA", "Chave local trocada");
  });

  $("btnLogoutOwner")?.addEventListener("click", ()=>{
    clearOwnerSession();
    toast("Saiu do painel");
    logAction("DONO", "Logout");
    showView("brands");
  });

  /* ----- Logs ----- */
  function renderLogs(){ $("logsBox").textContent = (getJSON(K.logs, [])).join("\n"); }
  $("btnClearLogs")?.addEventListener("click", ()=>{ if(!isOwner()) return; setJSON(K.logs, []); renderLogs(); toast("Logs limpos ✅"); });
  $("btnCopyLogs")?.addEventListener("click", ()=>{ if(!isOwner()) return; copyText($("logsBox").textContent||""); toast("Logs copiados ✅"); });

  /* ----- 300+ actions in tools grid ----- */
  function makeVipCode(){
    const a = Math.random().toString(36).slice(2,6).toUpperCase();
    const b = Math.random().toString(36).slice(2,6).toUpperCase();
    return `PS-${a}-${b}`;
  }

  function grantVipByCode(plan){
    if(!isOwner()) return toast("Sem permissão.");
    const code = makeVipCode();
    const clients = getJSON(K.clients, {});
    const k = code.toLowerCase();
    const rec = {plan, ts: now()};
    rec.sig = signPayload({k, plan:rec.plan, ts:rec.ts});
    clients[k] = rec;
    setJSON(K.clients, clients);
    renderClientsTable();
    copyText(code);
    toast("Código VIP gerado e copiado ✅");
    logAction("CLIENTE", `Gerou ${code} -> ${plan}`);
  }

  function bulkGenerateCodes(plan, n){
    if(!isOwner()) return toast("Sem permissão.");
    const clients = getJSON(K.clients, {});
    const codes = [];
    for(let i=0;i<n;i++){
      const code = makeVipCode();
      const k = code.toLowerCase();
      const rec = {plan, ts: now()};
      rec.sig = signPayload({k, plan:rec.plan, ts:rec.ts});
      clients[k] = rec;
      codes.push(code);
    }
    setJSON(K.clients, clients);
    renderClientsTable();
    copyText(codes.join("\n"));
    toast(`${n} códigos gerados ✅`);
    logAction("CLIENTE", `Gerou ${n} códigos (${plan})`);
  }

  function normalizeModels(){
    if(!isOwner()) return toast("Sem permissão.");
    const o = getOverrides();
    const list = getBrandList();
    for(const b of list){
      o.brands[b.id] = o.brands[b.id] || {models: b.models.slice()};
      const arr = o.brands[b.id].models;
      const seen = new Set();
      const out = [];
      for(const m of arr){
        const nm = String(m).trim().replace(/\s+/g," ");
        if(!nm) continue;
        const k = nm.toLowerCase();
        if(seen.has(k)) continue;
        seen.add(k);
        out.push(nm);
      }
      out.sort((a,b)=>a.localeCompare(b));
      o.brands[b.id].models = out;
    }
    setOverrides(o);
    toast("Modelos normalizados ✅");
    logAction("MODELO","Normalizou modelos");
    initOwnerSelects();
    renderBrands();
  }

  function ensureA16(){
    if(!isOwner()) return toast("Sem permissão.");
    const list = getBrandList();
    const samsung = list.find(x=>x.id==="samsung");
    if(!samsung) return;
    const o = getOverrides();
    o.brands["samsung"] = o.brands["samsung"] || {models: samsung.models.slice()};
    const arr = o.brands["samsung"].models;
    if(!arr.includes("Galaxy A16 4G")) arr.push("Galaxy A16 4G");
    if(!arr.includes("Galaxy A16 5G")) arr.push("Galaxy A16 5G");
    setOverrides(o);
    toast("A16 4G/5G garantido ✅");
    logAction("MODELO","Garantiu A16 4G/5G");
    initOwnerSelects();
    renderBrands();
  }

  function toggleFlag(flagKey){
    if(!isOwner()) return toast("Sem permissão.");
    const f = getFlags();
    f[flagKey] = !f[flagKey];
    setFlags(f);
    toast(`${flagKey}: ${f[flagKey] ? "ON" : "OFF"}`);
    logAction("SEGURANÇA", `Flag ${flagKey} => ${f[flagKey]}`);
  }

  function exportStatsText(){
    if(!isOwner()) return toast("Sem permissão.");
    const st = getJSON(K.stats, {opens:0,copies:0,favorites:0,modelOpens:{}});
    const lines = [];
    lines.push("PAULO SENSI STATS");
    lines.push(`Acessos: ${st.opens||0}`);
    lines.push(`Favoritos: ${st.favorites||0}`);
    lines.push(`Cópias: ${st.copies||0}`);
    lines.push(`VIP liberados (local): ${Object.keys(getJSON(K.clients, {})).length}`);
    lines.push("--- Top modelos ---");
    Object.entries(st.modelOpens||{}).sort((a,b)=>b[1]-a[1]).slice(0,50).forEach(([k,v])=>{
      lines.push(`${k.split("|||")[1]||k}: ${v}`);
    });
    copyText(lines.join("\n"));
    toast("Stats copiadas ✅");
    logAction("STATS","Export texto");
  }

  function renderToolsGrid(){
    const grid = $("toolsGrid");
    if(!grid) return;

    const live = [
      {t:"⚡ Exportar JSON", d:"Baixa backup JSON", fn:()=>$("btnExport").click()},
      {t:"⚡ Backup Local", d:"Salva backup no aparelho", fn:()=>$("btnBackupLocal").click()},
      {t:"⚡ Restaurar Local", d:"Restaura backup do aparelho", fn:()=>$("btnRestoreLocal").click()},
      {t:"⚡ Normalizar Modelos", d:"Remove duplicados + ordena", fn:normalizeModels},
      {t:"⚡ Garantir A16 4G/5G", d:"Atalho Samsung A16", fn:ensureA16},
      {t:"⚡ Gerar 1 código VIP 2", d:"Cria código padrão e copia", fn:()=>grantVipByCode("standard")},
      {t:"⚡ Gerar 1 código VIP 3", d:"Cria código premium e copia", fn:()=>grantVipByCode("premium")},
      {t:"⚡ Gerar 20 códigos VIP 2", d:"Lote de códigos", fn:()=>bulkGenerateCodes("standard", 20)},
      {t:"⚡ Gerar 20 códigos VIP 3", d:"Lote de códigos", fn:()=>bulkGenerateCodes("premium", 20)},
      {t:"⚡ Exportar Stats (texto)", d:"Copia stats + top modelos", fn:exportStatsText},
      {t:"⚡ Bloquear Compartilhar", d:"Liga/desliga share", fn:()=>toggleFlag("blockShare")},
      {t:"⚡ Bloquear Copiar", d:"Liga/desliga copiar", fn:()=>toggleFlag("blockCopy")},
      {t:"⚡ Bloquear Favoritos", d:"Liga/desliga favoritos", fn:()=>toggleFlag("blockFavorites")},
      {t:"⚡ Toggle Neon", d:"Liga/desliga brilho", fn:toggleNeon},
      {t:"⚡ Bloquear VIP 2", d:"Trava VIP 2", fn:()=>toggleLock("vip2", true)},
      {t:"⚡ Desbloquear VIP 2", d:"Libera VIP 2", fn:()=>toggleLock("vip2", false)},
      {t:"⚡ Bloquear VIP 3", d:"Trava VIP 3", fn:()=>toggleLock("vip3", true)},
      {t:"⚡ Desbloquear VIP 3", d:"Libera VIP 3", fn:()=>toggleLock("vip3", false)},
    ];

    const total = 320;
    const cards = [];
    for(let i=1;i<=total;i++){
      const L = live[i-1];
      if(L) cards.push({title:L.t, sub:L.d, live:true, fn:L.fn});
      else if(i%37===0){
        cards.push({title:`Preset Aviso #${i}`, sub:"Aplica aviso pronto (funciona)", live:true, fn:()=>{
          if(!isOwner()) return;
          const s = getSettings();
          s.notice = `Atualizado • Preset ${i} 🔥`;
          setSettings(s);
          $("appNotice").value = s.notice;
          renderHomeMini();
          updateTopBar();
          toast("Aviso aplicado ✅");
          logAction("AJUSTE", `Preset aviso ${i}`);
        }});
      } else if(i%41===0){
        cards.push({title:`Preset Banner VIP #${i}`, sub:"Aplica banner VIP pronto (funciona)", live:true, fn:()=>{
          if(!isOwner()) return;
          const s = getSettings();
          s.vipBanner = `VIP SUPREMO ${i} 💜`;
          setSettings(s);
          $("vipBanner").value = s.vipBanner;
          renderHomeMini();
          updateTopBar();
          toast("Banner aplicado ✅");
          logAction("VIP", `Preset banner ${i}`);
        }});
      } else if(i%29===0){
        cards.push({title:`Limpeza #${i}`, sub:"Limpa recentes + histórico (funciona)", live:true, fn:()=>{
          if(!isOwner()) return;
          setJSON(K.recentModels, []);
          setJSON(K.copyHistory, []);
          toast("Limpeza feita ✅");
          logAction("LIMPEZA", `Limpeza ${i}`);
        }});
      } else {
        cards.push({title:`Ferramenta #${i}`, sub:"Em breve (painel profissional gigante)", live:false});
      }
    }

    grid.innerHTML = cards.map((c,idx)=>`
      <div class="action-card" data-i="${idx}">
        <div class="action-title">${escapeHtml(c.title)}</div>
        <div class="action-sub">${escapeHtml(c.sub)}</div>
      </div>
    `).join("");

    grid.querySelectorAll(".action-card").forEach(el=>{
      el.addEventListener("click", ()=>{
        const c = cards[Number(el.dataset.i)];
        if(c.live && c.fn){ c.fn(); logAction("TOOLS", c.title); }
        else toast("Em breve 🚧");
      });
    });
  }

  function renderModelTools(){
    const grid = $("modelToolsGrid");
    if(!grid) return;
    const tools = [
      {t:"Atalho: garantir Galaxy A16 4G/5G", d:"Adiciona caso falte (funciona)", fn:ensureA16},
      {t:"Normalizar modelos", d:"Remove duplicados e ordena (funciona)", fn:normalizeModels},
      {t:"Gerar 10 códigos VIP 2", d:"Copia lista pro WhatsApp (funciona)", fn:()=>bulkGenerateCodes("standard", 10)},
      {t:"Gerar 10 códigos VIP 3", d:"Copia lista pro WhatsApp (funciona)", fn:()=>bulkGenerateCodes("premium", 10)},
    ];
    grid.innerHTML = tools.map((x,i)=>`
      <div class="action-card" data-i="${i}">
        <div class="action-title">${escapeHtml(x.t)}</div>
        <div class="action-sub">${escapeHtml(x.d)}</div>
      </div>
    `).join("");
    grid.querySelectorAll(".action-card").forEach(el=>{
      el.addEventListener("click", ()=>{
        tools[Number(el.dataset.i)].fn();
      });
    });
  }

  /* ---------- Neon ---------- */
  function applyNeon(){
    const off = localStorage.getItem(K.neonOff)==="1";
    document.body.classList.toggle("neon-off", off);
  }

  /* ---------- Boot ---------- */
  function boot(){
    ensureLocalKey();
    applyNeon();

    // settings inputs
    const s = getSettings();
    $("vipBanner").value = s.vipBanner || "";
    $("appNotice").value = s.notice || "";

    if(!localStorage.getItem(K.plan)) setPlan("free");
    updateTopBar();

    renderHomeMini();
    renderBrands();

    showView("splash", true);
    navStack.length = 0;
    navStack.push("splash");
  }

  // Double tap in planos abre painel (se dono estiver logado)
  $("btnPlans")?.addEventListener("dblclick", ()=>{ isOwner() ? openOwnerPanel() : openOwnerModal(); });

  boot();
})();