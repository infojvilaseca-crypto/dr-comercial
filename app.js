// ========================================================
// CRM DISTRIBUÏDORS DE VINS ESCUMOSOS - APP CORE v2
// Amb dades consolidades de Corpinnat, Dinamarca, Espanya i BWW
// ========================================================

const STORAGE_KEY = 'crm_sparkling_distributors_v10';
const SUPABASE_CONFIG_KEY = 'crm_supabase_config_v1';

const COUNTRY_FLAGS = {
  'Espanya': '🇪🇸',
  'Dinamarca': '🇩🇰',
  'Estats Units': '🇺🇸',
  'Regne Unit': '🇬🇧',
  'Països Baixos': '🇳🇱',
  'Bèlgica': '🇧🇪',
  'Alemanya': '🇩🇪',
  'Suècia': '🇸🇪',
  'Suïssa': '🇨🇭',
  'Canadà': '🇨🇦',
  'Japó': '🇯🇵',
  'Irlanda': '🇮🇪',
  'Noruega': '🇳🇴',
  'França': '🇫🇷',
  'Itàlia': '🇮🇹',
  'Àustria': '🇦🇹',
  'Mèxic': '🇲🇽',
  'Puerto Rico': '🇵🇷',
  'Perú': '🇵🇪',
  'Xina': '🇨🇳',
  'Austràlia': '🇦🇺',
  'Singapur': '🇸🇬',
  'Andorra': '🇦🇩',
  'Estònia': '🇪🇪',
  'Finlàndia': '🇫🇮',
  'Lituània': '🇱🇹',
  'Txèquia': '🇨🇿',
  'Letònia': '🇱🇻',
  'Filipines': '🇵🇭',
  'Colòmbia': '🇨🇴',
  'Brasil': '🇧🇷',
  'Panamà': '🇵🇦'
};

function getCountryFlag(country) {
  return COUNTRY_FLAGS[country] || '🌍';
}

const state = {
  distributors: [],
  searchQuery: '',
  activeTab: 'all',
  filterStatus: 'Tots',
  filterCountry: 'Tots',
  filterZone: 'Totes',
  filterRegion: 'Totes',
  filterSpecialty: 'Totes',
  filterWinery: 'Tots',
  quickOnlyActive: false,
  quickOnlyInstagram: false,
  quickOnlyPriority: false,
  viewMode: 'grid',
  selectedDistributor: null,
  activeDetailTab: 'fitxa',
  supabaseClient: null,
  supabaseConfig: {
    url: '',
    key: '',
    connected: false
  }
};

function initApp() {
  loadSupabaseConfig();
  loadDistributors();
  if ((!state.distributors || state.distributors.length === 0) && window.INITIAL_DISTRIBUTORS) {
    state.distributors = JSON.parse(JSON.stringify(window.INITIAL_DISTRIBUTORS));
    saveDistributorsLocally();
  }
  setupEventListeners();
  render();
  updateSyncIndicator();
}

function loadSupabaseConfig() {
  try {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (saved) {
      state.supabaseConfig = JSON.parse(saved);
      if (state.supabaseConfig.url && state.supabaseConfig.key && window.supabase) {
        state.supabaseClient = window.supabase.createClient(
          state.supabaseConfig.url,
          state.supabaseConfig.key
        );
        state.supabaseConfig.connected = true;
      }
    }
  } catch (e) {
    console.error('Error carregant configuració de Supabase:', e);
  }
}

function loadDistributors() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.distributors = parsed;
      } else if (window.INITIAL_DISTRIBUTORS) {
        state.distributors = JSON.parse(JSON.stringify(window.INITIAL_DISTRIBUTORS));
        saveDistributorsLocally();
      }
    } else if (window.INITIAL_DISTRIBUTORS) {
      state.distributors = JSON.parse(JSON.stringify(window.INITIAL_DISTRIBUTORS));
      saveDistributorsLocally();
    }
  } catch (e) {
    console.error('Error carregant distribuïdors:', e);
    state.distributors = window.INITIAL_DISTRIBUTORS || [];
  }
}

function saveDistributorsLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.distributors));
  } catch (e) {
    console.error('Error guardant distribuïdors en local:', e);
  }
}

async function syncWithSupabase() {
  if (!state.supabaseClient) {
    openCloudModal();
    showToast('Configura primer les claus de Supabase a la pestanya Núvol', 'warning');
    return;
  }

  showToast('Sincronitzant amb el núvol...', 'info');
  try {
    const { data, error } = await state.supabaseClient
      .from('distributors')
      .select('*');

    if (error) throw error;

    if (data && data.length > 0) {
      state.distributors = data;
      saveDistributorsLocally();
      showToast('Dades descarregades del núvol amb èxit!', 'success');
    } else {
      showToast(`Pujant ${state.distributors.length} distribuïdors a Supabase...`, 'info');
      for (const d of state.distributors) {
        const copy = { ...d };
        delete copy.contacts;
        delete copy.interactions;
        delete copy.documents;
        await state.supabaseClient.from('distributors').upsert(copy);
      }
      showToast("Totes les dades s'han guardat al núvol!", "success");
    }
    render();
    updateSyncIndicator();
  } catch (err) {
    console.error('Error de sincronització:', err);
    showToast('Error de connexió: ' + (err.message || 'Comprova les credencials'), 'error');
  }
}

function getFilteredDistributors() {
  const q = state.searchQuery.toLowerCase().trim();

  return state.distributors.filter(d => {
    if (state.quickOnlyActive && d.status !== 'Actiu') return false;
    if (state.quickOnlyInstagram && !d.instagram) return false;
    if (state.quickOnlyPriority && d.priority !== 'Alta' && d.priority !== 'Molt alta') return false;

    if (state.filterStatus !== 'Tots' && d.status !== state.filterStatus) return false;
    if (state.filterCountry !== 'Tots' && d.country !== state.filterCountry) return false;
    
    // Filtre de Zona / Província
    if (state.filterZone !== 'Totes') {
      const prov = (d.province || '').toLowerCase();
      const city = (d.city || '').toLowerCase();
      const target = state.filterZone.toLowerCase();
      if (!prov.includes(target) && !city.includes(target)) return false;
    }

    // Filtre de Comunitat / Regió
    if (state.filterRegion !== 'Totes') {
      const reg = (d.region || '').toLowerCase();
      const target = state.filterRegion.toLowerCase();
      if (!reg.includes(target)) return false;
    }

    // Filtre d'especialitat
    if (state.filterSpecialty !== 'Totes') {
      const tags = d.specialty_tags || [];
      const hasSpecialty = tags.some(t => t.toLowerCase().includes(state.filterSpecialty.toLowerCase()));
      if (!hasSpecialty) return false;
    }

    // Filtre per Celler Corpinnat
    if (state.filterWinery && state.filterWinery !== 'Tots') {
      const win = (d.related_wineries || '').toLowerCase();
      const target = state.filterWinery.toLowerCase();
      if (!win.includes(target)) return false;
    }

    if (!q) return true;

    const matchName = (d.name || '').toLowerCase().includes(q);
    const matchLegal = (d.legal_name || '').toLowerCase().includes(q);
    const matchCountry = (d.country || '').toLowerCase().includes(q);
    const matchCity = (d.city || '').toLowerCase().includes(q);
    const matchProvince = (d.province || '').toLowerCase().includes(q);
    const matchRegion = (d.region || '').toLowerCase().includes(q);
    const matchNotes = (d.notes || '').toLowerCase().includes(q);
    const matchWineries = (d.related_wineries || '').toLowerCase().includes(q);
    const matchFocus = (d.sparkling_focus || '').toLowerCase().includes(q);
    const matchChannels = (d.channels || '').toLowerCase().includes(q);
    const matchInstagram = (d.instagram || '').toLowerCase().includes(q);
    const matchWeb = (d.website || '').toLowerCase().includes(q);

    const matchContacts = (d.contacts || []).some(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.mobile || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q)
    );

    return matchName || matchLegal || matchCountry || matchCity || matchProvince || matchRegion || matchNotes || matchWineries || matchFocus || matchChannels || matchContacts || matchInstagram || matchWeb;
  });
}

function getUniqueCountries() {
  const map = {};
  state.distributors.forEach(d => {
    if (d.country) {
      map[d.country] = (map[d.country] || 0) + 1;
    }
  });
  return Object.keys(map).sort((a,b) => {
    if (a === 'Espanya') return -1;
    if (b === 'Espanya') return 1;
    return map[b] - map[a];
  }).map(c => ({ country: c, count: map[c] }));
}

function getStats() {
  const total = state.distributors.length;
  const active = state.distributors.filter(d => d.status === 'Actiu').length;
  const countries = new Set(state.distributors.map(d => d.country)).size;
  const withInstagram = state.distributors.filter(d => d.instagram).length;
  return { total, active, countries, withInstagram };
}

function render() {
  renderStats();
  renderFilters();
  renderDistributorsList();
  if (state.selectedDistributor) {
    renderDetailModal();
  }
}

function renderStats() {
  const { total, active, countries, withInstagram } = getStats();
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-countries').textContent = countries;
  document.getElementById('stat-followups').textContent = withInstagram;
}

function getUniqueZones() {
  const map = {};
  state.distributors.forEach(d => {
    // Si està filtrat per país (o per defecte Espanya)
    if (state.filterCountry === 'Tots' || d.country === state.filterCountry) {
      const p = d.province || d.city;
      if (p) {
        map[p] = (map[p] || 0) + 1;
      }
    }
  });
  return Object.keys(map).sort((a,b) => map[b] - map[a]).map(k => ({ zone: k, count: map[k] }));
}

function renderFilters() {
  const countrySelect = document.getElementById('filter-country');
  const currentCountry = state.filterCountry;
  const countryList = getUniqueCountries();
  
  countrySelect.innerHTML = `<option value="Tots">Tots els Mercats (${state.distributors.length})</option>` +
    countryList.map(item => `
      <option value="${item.country}" ${item.country === currentCountry ? 'selected' : ''}>
        ${getCountryFlag(item.country)} ${item.country} (${item.count})
      </option>
    `).join('');

  // Selector de Cellers Corpinnat (24)
  const winerySelect = document.getElementById('filter-winery');
  if (winerySelect) {
    const CORP_WINERIES = [
      "Gramona", "Llopart", "Nadal", "Recaredo", "Sabaté i Coca", "Torelló",
      "Huguet de Can Feixes", "Júlia Bernet", "Mas Candí", "Can Descregut",
      "Pardas", "Bufadors", "Cisteller", "Viader", "Mas de la Basserola",
      "Celler Kripta", "Demost", "Mas Bertran", "AT Roca", "Celler Mir",
      "Torné & Bel", "Juvé & Camps", "Mas Vilella", "Fèlix Massana Ràfols"
    ];
    const currentWinery = state.filterWinery || 'Tots';
    winerySelect.innerHTML = `<option value="Tots">🍾 Tots els Cellers Corpinnat (24)</option>` +
      CORP_WINERIES.map(w => {
        const count = state.distributors.filter(d => (d.related_wineries || '').toLowerCase().includes(w.toLowerCase())).length;
        return `<option value="${w}" ${w === currentWinery ? 'selected' : ''}>${w} (${count})</option>`;
      }).join('');
  }

  // Selector de Províncies / Zones
  const zoneSelect = document.getElementById('filter-zone');
  if (zoneSelect) {
    const zones = getUniqueZones();
    const currentZone = state.filterZone;
    zoneSelect.innerHTML = `<option value="Totes">Totes les Zones / Províncies (${zones.length})</option>` +
      zones.map(z => `
        <option value="${z.zone}" ${z.zone === currentZone ? 'selected' : ''}>
          📍 ${z.zone} (${z.count})
        </option>
      `).join('');
  }
}

// ==========================================
// CONTROLADORS DE PESTANYES I FILTRES NETS
// ==========================================

function setMainTab(tab) {
  state.activeTab = tab;
  
  // 1. Estil de pestanyes principals
  document.querySelectorAll('.category-tab').forEach(b => {
    b.className = 'category-tab px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200';
  });
  const activeBtn = document.getElementById('tab-' + tab);
  if (activeBtn) {
    activeBtn.className = 'category-tab px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 bg-amber-900 text-white shadow-2xs border-transparent';
  }

  // 2. Mostrar només el sub-panell contextual actiu
  ['all', 'spain', 'corpinnat', 'usa', 'intl'].forEach(t => {
    const p = document.getElementById('subpanel-' + t);
    if (p) {
      if (t === tab) {
        p.classList.remove('hidden');
      } else {
        p.classList.add('hidden');
      }
    }
  });

  // 3. Adaptar l'estat dels filtres segons la pestanya
  if (tab === 'all') {
    state.filterCountry = 'Tots';
    state.filterRegion = 'Totes';
    state.filterZone = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
  } else if (tab === 'spain') {
    state.filterCountry = 'Espanya';
    state.filterRegion = 'Totes';
    state.filterZone = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    setSpainSubZone('Tots');
    return;
  } else if (tab === 'corpinnat') {
    state.filterCountry = 'Tots';
    state.filterRegion = 'Totes';
    state.filterZone = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Corpinnat';
    setCorpinnatSubWinery('Tots');
    return;
  } else if (tab === 'usa') {
    state.filterCountry = 'Estats Units';
    state.filterRegion = 'Totes';
    state.filterZone = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    setUsaSubState('Tots');
    return;
  } else if (tab === 'intl') {
    state.filterCountry = 'Tots';
    state.filterRegion = 'Totes';
    state.filterZone = 'Totes';
    state.filterWinery = 'Tots';
    state.filterSpecialty = 'Totes';
    setIntlSubCountry('Tots');
    return;
  }

  render();
  updateActiveChips();
}

function setSpainSubZone(zone) {
  document.querySelectorAll('.spain-subpill').forEach(b => {
    b.className = 'spain-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });
  
  if (zone === 'Tots') {
    state.filterRegion = 'Totes';
    state.filterZone = 'Totes';
    const allBtn = document.getElementById('subpill-spain-all');
    if (allBtn) allBtn.className = 'spain-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    const isReg = ['Catalunya', 'País Basc', 'Andalusia', 'Galícia'].indexOf(zone) !== -1;
    if (isReg) {
      state.filterRegion = zone;
      state.filterZone = 'Totes';
    } else {
      state.filterRegion = 'Totes';
      state.filterZone = zone;
    }
    const cleanId = 'subpill-spain-' + zone.toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'spain-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  const zoneSelect = document.getElementById('filter-zone');
  if (zoneSelect) zoneSelect.value = state.filterZone;

  renderDistributorsList();
  updateActiveChips();
}

function setCorpinnatSubWinery(winery) {
  state.filterWinery = winery;
  
  document.querySelectorAll('.corp-subpill').forEach(b => {
    b.className = 'corp-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  if (winery === 'Tots') {
    const allBtn = document.getElementById('subpill-winery-all');
    if (allBtn) allBtn.className = 'corp-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    const cleanId = 'subpill-winery-' + winery.replace(/[^a-zA-Z0-9]/g, '');
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'corp-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  const winerySelect = document.getElementById('filter-winery');
  if (winerySelect) winerySelect.value = winery;

  renderDistributorsList();
  updateActiveChips();
}

function setUsaSubState(st) {
  state.filterZone = (st === 'Tots' ? 'Totes' : st);

  document.querySelectorAll('.usa-subpill').forEach(b => {
    b.className = 'usa-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  if (st === 'Tots') {
    const allBtn = document.getElementById('subpill-usa-all');
    if (allBtn) allBtn.className = 'usa-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    const cleanId = 'subpill-usa-' + st.toLowerCase().replace(/[^a-z0-9]/g, '');
    const activeSubBtn = document.getElementById(cleanId);
    if (activeSubBtn) activeSubBtn.className = 'usa-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  renderDistributorsList();
  updateActiveChips();
}

function setIntlSubCountry(country) {
  state.filterCountry = country;

  document.querySelectorAll('.intl-subpill').forEach(b => {
    b.className = 'intl-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-stone-700 border border-stone-200 hover:bg-stone-100 transition-all shrink-0';
  });

  if (country === 'Tots') {
    const allBtn = document.getElementById('subpill-intl-all');
    if (allBtn) allBtn.className = 'intl-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  } else {
    var countryMap = {
      'Alemanya': 'germany', 'Països Baixos': 'nl', 'Regne Unit': 'uk',
      'Canadà': 'ca', 'Dinamarca': 'dk', 'Japó': 'jp', 'Suècia': 'se', 'Suïssa': 'ch'
    };
    var code = countryMap[country] || country.toLowerCase().replace(/[^a-z0-9]/g, '');
    var activeSubBtn = document.getElementById('subpill-intl-' + code);
    if (activeSubBtn) activeSubBtn.className = 'intl-subpill px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-900 text-white border border-amber-900 transition-all shrink-0';
  }

  const countrySelect = document.getElementById('filter-country');
  if (countrySelect) countrySelect.value = country;

  renderDistributorsList();
  updateActiveChips();
}

function toggleAdvancedFilters() {
  const drawer = document.getElementById('advanced-filters-drawer');
  if (drawer) {
    drawer.classList.toggle('hidden');
  }
}

function clearSearch() {
  state.searchQuery = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderDistributorsList();
  updateActiveChips();
}

function toggleQuickStatus(status) {
  state.quickOnlyActive = !state.quickOnlyActive;
  const btn = document.getElementById('btn-quick-active');
  if (btn) {
    if (state.quickOnlyActive) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-emerald-700 text-white border border-emerald-700 font-bold transition-all text-xs';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-emerald-500 hover:text-emerald-800 font-semibold text-stone-700 transition-all text-xs';
    }
  }
  renderDistributorsList();
  updateActiveChips();
}

function toggleQuickInstagram() {
  state.quickOnlyInstagram = !state.quickOnlyInstagram;
  const btn = document.getElementById('btn-quick-instagram');
  if (btn) {
    if (state.quickOnlyInstagram) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-rose-700 text-white border border-rose-700 font-bold transition-all text-xs';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-rose-400 hover:text-rose-800 font-semibold text-stone-700 transition-all text-xs';
    }
  }
  renderDistributorsList();
  updateActiveChips();
}

function toggleQuickPriority() {
  state.quickOnlyPriority = !state.quickOnlyPriority;
  const btn = document.getElementById('btn-quick-priority');
  if (btn) {
    if (state.quickOnlyPriority) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-amber-800 text-white border border-amber-800 font-bold transition-all text-xs';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-amber-500 hover:text-amber-900 font-semibold text-stone-700 transition-all text-xs';
    }
  }
  renderDistributorsList();
  updateActiveChips();
}

function updateActiveChips() {
  const container = document.getElementById('active-filter-chips');
  const clearBtn = document.getElementById('clear-filters-btn');
  const badgeCount = document.getElementById('active-filters-count');
  if (!container) return;

  const chips = [];
  let advCount = 0;

  if (state.searchQuery) {
    chips.push({ label: '"' + state.searchQuery + '"', action: 'clearSearch()' });
  }
  if (state.filterZone && state.filterZone !== 'Totes') {
    chips.push({ label: 'Zona: ' + state.filterZone, action: 'setSpainSubZone("Tots")' });
  }
  if (state.filterRegion && state.filterRegion !== 'Totes') {
    chips.push({ label: 'Regió: ' + state.filterRegion, action: 'setSpainSubZone("Tots")' });
  }
  if (state.filterWinery && state.filterWinery !== 'Tots') {
    chips.push({ label: 'Celler: ' + state.filterWinery, action: 'setCorpinnatSubWinery("Tots")' });
  }
  if (state.filterStatus && state.filterStatus !== 'Tots') {
    chips.push({ label: 'Estat: ' + state.filterStatus, action: 'state.filterStatus="Tots"; if(document.getElementById("filter-status")) document.getElementById("filter-status").value="Tots"; renderDistributorsList(); updateActiveChips();' });
    advCount++;
  }
  if (state.filterSpecialty && state.filterSpecialty !== 'Totes' && state.filterSpecialty !== 'Corpinnat') {
    chips.push({ label: 'Esp.: ' + state.filterSpecialty, action: 'state.filterSpecialty="Totes"; if(document.getElementById("filter-specialty")) document.getElementById("filter-specialty").value="Totes"; renderDistributorsList(); updateActiveChips();' });
    advCount++;
  }
  if (state.quickOnlyActive) {
    chips.push({ label: '🟢 Actius', action: 'toggleQuickStatus()' });
  }
  if (state.quickOnlyInstagram) {
    chips.push({ label: '📸 Amb IG', action: 'toggleQuickInstagram()' });
  }
  if (state.quickOnlyPriority) {
    chips.push({ label: '⭐ Prioritat', action: 'toggleQuickPriority()' });
  }

  container.innerHTML = chips.map(c => `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold">
      ${c.label}
      <button onclick="${c.action}" class="hover:text-black font-extrabold text-xs ml-0.5">✕</button>
    </span>
  `).join('');

  if (clearBtn) {
    if (chips.length > 0 || state.activeTab !== 'all') {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  if (badgeCount) {
    if (advCount > 0) {
      badgeCount.textContent = advCount;
      badgeCount.classList.remove('hidden');
    } else {
      badgeCount.classList.add('hidden');
    }
  }
}

// Funció de compatibilitat anterior
function setQuickFilter(type, value) {
  if (type === 'all') setMainTab('all');
  else if (type === 'country' && value === 'Espanya') setMainTab('spain');
  else if (type === 'region') { setMainTab('spain'); setSpainSubZone(value); }
  else if (type === 'zone') { setMainTab('spain'); setSpainSubZone(value); }
  else if (type === 'us-state') { setMainTab('usa'); setUsaSubState(value); }
  else if (type === 'winery') { setMainTab('corpinnat'); setCorpinnatSubWinery(value); }
  else setMainTab('all');
}

function renderDistributorsList() {
  const filtered = getFilteredDistributors();
  const container = document.getElementById('distributors-container');
  const countBadge = document.getElementById('results-count');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} distribuïdors i importadors`;
  }
  updateActiveChips();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-12 text-center border border-dashed border-stone-300">
        <div class="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-800">
          <i data-lucide="search-x" class="w-8 h-8"></i>
        </div>
        <h3 class="text-lg font-bold text-stone-800 mb-1">Cap distribuïdor trobat</h3>
        <p class="text-stone-500 text-sm max-w-md mx-auto mb-6">No s'han trobat resultats amb aquests filtres o terme de cerca.</p>
        <button onclick="resetFilters()" class="px-5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all">
          Netejar cerca i filtres
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (state.viewMode === 'table') {
    renderTableView(filtered, container);
  } else {
    renderGridView(filtered, container);
  }

  if (window.lucide) lucide.createIcons();
}

function renderGridView(distributors, container) {
  container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5';
  container.innerHTML = distributors.map(d => {
    const primaryContact = (d.contacts || []).find(c => c.is_primary) || (d.contacts || [])[0] || null;
    const phoneNum = (primaryContact && (primaryContact.mobile || primaryContact.phone)) || d.phone || '';
    const emailAddr = (primaryContact && primaryContact.email) || d.email || '';
    const docsCount = (d.documents || []).length;
    
    // Status colors
    let statusClass = 'bg-stone-100 text-stone-700 border-stone-200';
    if (d.status === 'Actiu') statusClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (d.status === 'En negociació') statusClass = 'bg-sky-50 text-sky-800 border-sky-200';
    if (d.status === 'Potencial') statusClass = 'bg-amber-50 text-amber-900 border-amber-200';
    if (d.status === 'Inactiu') statusClass = 'bg-rose-50 text-rose-800 border-rose-200';

    // Priority badge
    let priorityBadge = '';
    if (d.priority === 'Molt alta') {
      priorityBadge = '<span class="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded-full border border-rose-200">⭐ Prioritat Màxima</span>';
    } else if (d.priority === 'Alta') {
      priorityBadge = '<span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">Prioritat Alta</span>';
    }

    return `
      <div onclick="openDetailModal('${d.id}')" 
           class="bg-white rounded-3xl border border-stone-200/90 shadow-xs hover:shadow-md hover:border-amber-900/30 transition-all cursor-pointer p-5 flex flex-col justify-between group relative overflow-hidden">
        
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-700 via-rose-900 to-amber-950 opacity-80 group-hover:opacity-100"></div>

        <div>
          <!-- Capçalera targeta -->
          <div class="flex items-start justify-between gap-2 mb-2 pt-1">
            <div class="min-w-0">
              <div class="flex items-center flex-wrap gap-1 text-xs font-bold text-stone-500 mb-1">
                <span class="flex items-center gap-1">${getCountryFlag(d.country)} ${d.country}</span>
                ${d.province ? `<span class="bg-amber-100/80 text-amber-950 px-2 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1">📍 ${d.province}</span>` : (d.city ? `<span class="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md text-[11px]">• ${d.city}</span>` : '')}
              </div>
              <h3 class="text-base font-black text-stone-900 group-hover:text-amber-900 transition-colors line-clamp-1">
                ${d.name}
              </h3>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusClass}">
                ${d.status}
              </span>
              ${priorityBadge}
            </div>
          </div>

          <!-- Cellers relacionats o Especialitat -->
          ${d.related_wineries ? `
            <div class="mb-2.5 bg-rose-50/70 border border-rose-100 rounded-xl p-2 text-xs text-rose-950">
              <span class="font-bold text-rose-900">🍷 Cellers a cartera:</span> 
              <span class="font-medium text-stone-800 line-clamp-1">${d.related_wineries}</span>
            </div>
          ` : (d.sparkling_focus ? `
            <div class="mb-2.5 bg-amber-50/70 border border-amber-100 rounded-xl p-2 text-xs text-amber-950">
              <span class="font-bold text-amber-900">🍾 Focus:</span> 
              <span class="font-medium text-stone-800 line-clamp-1">${d.sparkling_focus}</span>
            </div>
          ` : '')}

          <!-- Specialty tags -->
          ${(d.specialty_tags && d.specialty_tags.length > 0) ? `
            <div class="flex flex-wrap gap-1 mb-3">
              ${d.specialty_tags.slice(0, 3).map(t => `
                <span class="text-[10px] font-semibold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200">
                  ${t}
                </span>
              `).join('')}
              ${d.specialty_tags.length > 3 ? `<span class="text-[10px] text-stone-400 font-bold">+${d.specialty_tags.length - 3}</span>` : ''}
            </div>
          ` : ''}

          <!-- Condicions o Dades Clau -->
          <div class="grid grid-cols-3 gap-1 py-2 border-y border-stone-100 text-center mb-3">
            <div class="bg-stone-50/80 p-1.5 rounded-lg">
              <div class="text-[9px] uppercase font-bold text-stone-400">Tipus</div>
              <div class="text-xs font-bold text-stone-800 truncate">${d.distribution_type ? d.distribution_type.split(' ')[0] : 'Distribuïdor'}</div>
            </div>
            <div class="bg-stone-50/80 p-1.5 rounded-lg">
              <div class="text-[9px] uppercase font-bold text-stone-400">Incoterm</div>
              <div class="text-xs font-bold text-stone-800">${d.incoterm || 'EXW'}</div>
            </div>
            <div class="bg-stone-50/80 p-1.5 rounded-lg">
              <div class="text-[9px] uppercase font-bold text-stone-400">Pagament</div>
              <div class="text-xs font-bold text-stone-800 truncate">${d.payment_terms || '30 dies'}</div>
            </div>
          </div>
        </div>

        <!-- Botons d'acció directa: WhatsApp, Telèfon, Email, Instagram, Web -->
        <div class="pt-2 flex items-center justify-between gap-1 text-xs" onclick="event.stopPropagation()">
          <div class="flex items-center gap-1.5">
            ${phoneNum ? `
              <a href="https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}" target="_blank" 
                 title="Obrir xat de WhatsApp" 
                 class="w-8 h-8 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl flex items-center justify-center transition-colors shadow-2xs">
                <i data-lucide="message-circle" class="w-4 h-4"></i>
              </a>
              <a href="tel:${phoneNum}" 
                 title="Trucar per telèfon" 
                 class="w-8 h-8 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-xl flex items-center justify-center transition-colors shadow-2xs">
                <i data-lucide="phone" class="w-4 h-4"></i>
              </a>
            ` : ''}

            ${emailAddr ? `
              <a href="mailto:${emailAddr}" 
                 title="Enviar correu" 
                 class="w-8 h-8 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl flex items-center justify-center transition-colors shadow-2xs">
                <i data-lucide="mail" class="w-4 h-4"></i>
              </a>
            ` : ''}

            ${d.instagram ? `
              <a href="${d.instagram}" target="_blank" 
                 title="Veure perfil d'Instagram" 
                 class="w-8 h-8 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 hover:opacity-90 text-white rounded-xl flex items-center justify-center transition-all shadow-2xs">
                <i data-lucide="instagram" class="w-4 h-4"></i>
              </a>
            ` : ''}

            ${d.website ? `
              <a href="${d.website}" target="_blank" 
                 title="Visitar pàgina web" 
                 class="w-8 h-8 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl flex items-center justify-center transition-colors shadow-2xs">
                <i data-lucide="globe" class="w-4 h-4"></i>
              </a>
            ` : ''}
          </div>

          <button onclick="openDetailModal('${d.id}')" class="px-3 py-1.5 bg-stone-100 hover:bg-amber-900 hover:text-white rounded-xl text-stone-700 font-bold transition-all flex items-center gap-1 text-[11px]">
            <span>Fitxa</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

function renderTableView(distributors, container) {
  container.className = 'w-full overflow-x-auto bg-white rounded-3xl border border-stone-200 shadow-xs';
  container.innerHTML = `
    <table class="w-full text-left border-collapse text-xs sm:text-sm">
      <thead>
        <tr class="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold text-xs uppercase tracking-wider">
          <th class="py-3.5 px-4">Distribuïdor / Empresa</th>
          <th class="py-3.5 px-4">País / Àmbit</th>
          <th class="py-3.5 px-4">Estat & Prioritat</th>
          <th class="py-3.5 px-4">Cellers a Cartera / Focus</th>
          <th class="py-3.5 px-4">Contacte Ràpid</th>
          <th class="py-3.5 px-4 text-right">Accions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-stone-100">
        ${distributors.map(d => {
          const c = (d.contacts || []).find(c => c.is_primary) || (d.contacts || [])[0] || {};
          const phone = c.mobile || c.phone || d.phone || '';
          return `
            <tr onclick="openDetailModal('${d.id}')" class="hover:bg-amber-50/40 cursor-pointer transition-colors">
              <td class="py-3 px-4 font-bold text-stone-900">
                <div class="flex items-center gap-1.5">
                  <span>${d.name}</span>
                  ${d.instagram ? `<a href="${d.instagram}" target="_blank" onclick="event.stopPropagation()" class="text-rose-600 hover:text-rose-800"><i data-lucide="instagram" class="w-3.5 h-3.5"></i></a>` : ''}
                </div>
                <div class="text-[11px] font-normal text-stone-500">${d.distribution_type || ''}</div>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-1 font-semibold text-stone-800">
                  <span>${getCountryFlag(d.country)}</span>
                  <span>${d.country}</span>
                </div>
                <div class="text-[11px] text-stone-400">${d.city || '-'}</div>
              </td>
              <td class="py-3 px-4">
                <div class="flex flex-col gap-1 items-start">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    d.status === 'Actiu' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    d.status === 'En negociació' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                    d.status === 'Potencial' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-stone-100 text-stone-700 border-stone-200'
                  }">
                    ${d.status}
                  </span>
                  ${d.priority === 'Molt alta' ? '<span class="text-[9px] text-rose-700 font-extrabold">⭐ Prioritat Màxima</span>' : ''}
                </div>
              </td>
              <td class="py-3 px-4 max-w-xs">
                ${d.related_wineries ? `<div class="font-medium text-stone-800 truncate text-xs"><span class="font-bold text-rose-900">🍷</span> ${d.related_wineries}</div>` : ''}
                ${d.sparkling_focus ? `<div class="text-stone-500 truncate text-[11px]">${d.sparkling_focus}</div>` : ''}
              </td>
              <td class="py-3 px-4" onclick="event.stopPropagation()">
                <div class="flex items-center gap-2">
                  ${phone ? `
                    <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="w-7 h-7 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg flex items-center justify-center">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                  ${c.email || d.email ? `
                    <a href="mailto:${c.email || d.email}" class="w-7 h-7 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center justify-center">
                      <i data-lucide="mail" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                  ${phone ? `<span class="text-xs text-stone-600 font-mono">${phone}</span>` : ''}
                </div>
              </td>
              <td class="py-3 px-4 text-right">
                <button class="px-3 py-1 bg-stone-100 hover:bg-stone-900 hover:text-white rounded-lg text-xs font-bold transition-all">
                  Fitxa
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function openDetailModal(id) {
  const dist = state.distributors.find(d => d.id === id);
  if (!dist) return;
  state.selectedDistributor = dist;
  state.activeDetailTab = 'fitxa';
  renderDetailModal();
  document.getElementById('detail-modal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDetailModal() {
  state.selectedDistributor = null;
  document.getElementById('detail-modal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function switchDetailTab(tab) {
  state.activeDetailTab = tab;
  renderDetailModal();
  if (window.lucide) lucide.createIcons();
}

function renderDetailModal() {
  const d = state.selectedDistributor;
  if (!d) return;

  document.getElementById('modal-dist-name').textContent = d.name;
  document.getElementById('modal-dist-flag').textContent = getCountryFlag(d.country);
  document.getElementById('modal-dist-country').textContent = `${d.country} ${d.city ? `• ${d.city}` : ''}`;
  
  const statusEl = document.getElementById('modal-dist-status');
  statusEl.textContent = d.status;
  statusEl.className = `text-xs font-bold px-3 py-1 rounded-full border ${
    d.status === 'Actiu' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
    d.status === 'En negociació' ? 'bg-sky-50 text-sky-800 border-sky-200' :
    d.status === 'Potencial' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-stone-100 text-stone-700 border-stone-200'
  }`;

  ['fitxa', 'contactes', 'seguiment', 'documents'].forEach(tab => {
    const btn = document.getElementById(`tab-btn-${tab}`);
    if (tab === state.activeDetailTab) {
      btn.className = 'py-3 px-4 text-xs md:text-sm font-bold border-b-2 border-amber-800 text-amber-900 flex items-center gap-2';
    } else {
      btn.className = 'py-3 px-4 text-xs md:text-sm font-semibold text-stone-500 hover:text-stone-800 border-b-2 border-transparent flex items-center gap-2';
    }
  });

  const content = document.getElementById('modal-tab-content');

  if (state.activeDetailTab === 'fitxa') {
    content.innerHTML = `
      <div class="space-y-6">
        
        <!-- Enllaços ràpids directes -->
        <div class="flex flex-wrap items-center gap-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
          <span class="text-xs font-bold uppercase text-stone-400">Canals directes:</span>
          ${d.instagram ? `
            <a href="${d.instagram}" target="_blank" class="px-3 py-1.5 bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs hover:opacity-95">
              <i data-lucide="instagram" class="w-4 h-4"></i> Instagram Oficial
            </a>
          ` : ''}
          ${d.website ? `
            <a href="${d.website}" target="_blank" class="px-3 py-1.5 bg-white border border-stone-300 text-stone-800 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-stone-100">
              <i data-lucide="globe" class="w-4 h-4 text-stone-500"></i> Lloc Web
            </a>
          ` : ''}
          ${d.priority ? `
            <span class="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg border border-amber-200">
              Nivell: ${d.priority}
            </span>
          ` : ''}
        </div>

        <!-- Cellers relacionats / Portfoli -->
        ${d.related_wineries ? `
          <div class="bg-rose-50/70 border border-rose-200 rounded-2xl p-4">
            <h4 class="text-xs font-bold uppercase text-rose-900 tracking-wider mb-2 flex items-center gap-1.5">
              <i data-lucide="wine" class="w-4 h-4 text-rose-800"></i> Cellers de Referència a la Cartera
            </h4>
            <p class="text-sm font-bold text-stone-900">${d.related_wineries}</p>
          </div>
        ` : ''}

        <!-- Dades Empresa -->
        <div class="bg-stone-50 rounded-2xl p-4 border border-stone-200">
          <h4 class="text-xs font-bold uppercase text-stone-400 tracking-wider mb-3 flex items-center gap-1.5">
            <i data-lucide="building-2" class="w-4 h-4 text-amber-800"></i> Dades Generals i Fiscals
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs md:text-sm">
            <div>
              <span class="text-stone-500 block text-xs">Raó Social:</span>
              <span class="font-semibold text-stone-800">${d.legal_name || d.name}</span>
            </div>
            <div>
              <span class="text-stone-500 block text-xs">Tipus d'Actor:</span>
              <span class="font-semibold text-stone-800">${d.distribution_type || 'Distribuïdor'}</span>
            </div>
            <div>
              <span class="text-stone-500 block text-xs">NIF / CAE / Tax ID:</span>
              <span class="font-mono font-semibold text-stone-800">${d.tax_id || 'No informat'}</span>
            </div>
            <div class="md:col-span-2">
              <span class="text-stone-500 block text-xs">Adreça o seu:</span>
              <span class="font-semibold text-stone-800">${d.address || d.city || 'Sense adreça'}</span>
            </div>
            <div>
              <span class="text-stone-500 block text-xs">Canals comercials:</span>
              <span class="font-semibold text-stone-800">${d.channels || 'HORECA, Vinoteques'}</span>
            </div>
          </div>
        </div>

        <!-- Condicions de Vins Escumosos -->
        <div class="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/80">
          <h4 class="text-xs font-bold uppercase text-amber-900 tracking-wider mb-3 flex items-center gap-1.5">
            <i data-lucide="sparkles" class="w-4 h-4 text-amber-800"></i> Condicions Comercials & Escumosos
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs md:text-sm">
            <div class="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
              <span class="text-stone-500 block text-[11px]">Incoterm:</span>
              <span class="text-base font-bold text-amber-900">${d.incoterm || 'EXW'}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
              <span class="text-stone-500 block text-[11px]">Terminis Pagament:</span>
              <span class="text-base font-bold text-stone-800">${d.payment_terms || '30 dies'}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
              <span class="text-stone-500 block text-[11px]">Comanda Mín. (MOQ):</span>
              <span class="text-base font-bold text-stone-800">${d.moq || '1 Palet'}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
              <span class="text-stone-500 block text-[11px]">Marges / Comissió:</span>
              <span class="text-base font-bold text-stone-800">${d.margin_commission || 'Estàndard'}</span>
            </div>
          </div>
          
          ${d.sparkling_focus ? `
            <div class="mt-3 bg-white p-3 rounded-xl border border-amber-100 text-xs md:text-sm">
              <span class="text-stone-500 block text-xs font-semibold mb-1">Focus en vins / escumosos:</span>
              <p class="text-stone-900 font-bold">${d.sparkling_focus}</p>
            </div>
          ` : ''}
        </div>

        <!-- Notes i Verificacions -->
        <div class="bg-stone-50 rounded-2xl p-4 border border-stone-200">
          <h4 class="text-xs font-bold uppercase text-stone-400 tracking-wider mb-2 flex items-center gap-1.5">
            <i data-lucide="file-text" class="w-4 h-4 text-stone-600"></i> Notes del Dossier & Verificació
          </h4>
          <p class="text-stone-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
            ${d.notes || 'No hi ha notes afegides.'}
          </p>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button onclick="deleteDistributor('${d.id}')" class="px-4 py-2 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar Distribuïdor
          </button>
        </div>
      </div>
    `;
  } else if (state.activeDetailTab === 'contactes') {
    const contacts = d.contacts || [];
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase text-stone-500 tracking-wider">Persones de Contacte (${contacts.length})</h4>
          <button onclick="showAddContactForm()" class="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Afegir Contacte
          </button>
        </div>

        <div id="add-contact-form" class="hidden bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-4">
          <h5 class="text-xs font-bold text-amber-900 mb-3">Nou Contacte per a ${d.name}</h5>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <input id="new-contact-name" placeholder="Nom complet *" class="p-2.5 rounded-xl border border-stone-300 bg-white" required>
            <input id="new-contact-role" placeholder="Càrrec (ex: Director de Compres, Sommelier)" class="p-2.5 rounded-xl border border-stone-300 bg-white">
            <input id="new-contact-email" placeholder="Correu electrònic" class="p-2.5 rounded-xl border border-stone-300 bg-white">
            <input id="new-contact-mobile" placeholder="Mòbil / WhatsApp" class="p-2.5 rounded-xl border border-stone-300 bg-white">
          </div>
          <div class="flex justify-end gap-2 mt-3">
            <button onclick="document.getElementById('add-contact-form').classList.add('hidden')" class="px-3.5 py-1.5 bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold">Cancel·lar</button>
            <button onclick="saveNewContact()" class="px-3.5 py-1.5 bg-amber-800 text-white rounded-xl text-xs font-bold">Guardar Contacte</button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          ${contacts.map(c => {
            const p = c.mobile || c.phone || '';
            return `
              <div class="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-stone-900 text-sm md:text-base">${c.name}</span>
                    ${c.is_primary ? '<span class="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">Principal</span>' : ''}
                  </div>
                  <div class="text-xs text-stone-500 font-medium mb-1">${c.role || 'Contacte comercial'}</div>
                  <div class="flex flex-wrap gap-4 text-xs text-stone-600">
                    ${c.email ? `<span class="flex items-center gap-1 font-mono"><i data-lucide="mail" class="w-3 h-3 text-stone-400"></i> ${c.email}</span>` : ''}
                    ${p ? `<span class="flex items-center gap-1 font-mono"><i data-lucide="phone" class="w-3 h-3 text-stone-400"></i> ${p}</span>` : ''}
                  </div>
                </div>
                
                <div class="flex items-center gap-2 shrink-0">
                  ${p ? `
                    <a href="https://wa.me/${p.replace(/[^0-9]/g, '')}" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> WhatsApp
                    </a>
                    <a href="tel:${p}" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
                      <i data-lucide="phone" class="w-3.5 h-3.5"></i> Trucar
                    </a>
                  ` : ''}
                  ${c.email ? `
                    <a href="mailto:${c.email}" class="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
                      <i data-lucide="mail" class="w-3.5 h-3.5"></i> Email
                    </a>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (state.activeDetailTab === 'seguiment') {
    const interactions = (d.interactions || []).sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase text-stone-500 tracking-wider">Historial de Tast de Vins, Fires i Trucades</h4>
          <button onclick="showAddInteractionForm()" class="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Registrar Tast / Nota
          </button>
        </div>

        <div id="add-interaction-form" class="hidden bg-amber-50 p-4 rounded-2xl border border-amber-200 mb-4">
          <h5 class="text-xs font-bold text-amber-900 mb-3">Registrar Interacció / Tast de Mostres</h5>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Data:</label>
              <input id="new-int-date" type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white">
            </div>
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Tipus:</label>
              <select id="new-int-type" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white font-semibold">
                <option value="Tast de vins / Mostres">Tast de vins / Mostres</option>
                <option value="Fira (BWW, ProWein, Wine Paris)">Fira (BWW, ProWein, Wine Paris)</option>
                <option value="Reunió comercial">Reunió comercial</option>
                <option value="Trucada">Trucada de seguiment</option>
                <option value="Email">Correu electrònic</option>
                <option value="Comanda">Comanda tancada</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Resum ràpid:</label>
              <input id="new-int-summary" placeholder="Ex: Tast nova anyada Corpinnat" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white" required>
            </div>
          </div>
          <div class="mt-3 text-xs">
            <label class="block font-semibold text-stone-600 mb-1">Detalls i comentaris sobre el tast:</label>
            <textarea id="new-int-details" rows="2" placeholder="Comentaris del client sobre el vi, valoració de bombolla, preus acordats..." class="w-full p-2.5 rounded-xl border border-stone-300 bg-white"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Propera acció (Següent pas):</label>
              <input id="new-int-nextstep" placeholder="Ex: Enviar ampolles de mostra o tarifes EXW" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white">
            </div>
            <div>
              <label class="block font-semibold text-stone-600 mb-1">Data del proper pas:</label>
              <input id="new-int-nextdate" type="date" class="w-full p-2.5 rounded-xl border border-stone-300 bg-white">
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-3">
            <button onclick="document.getElementById('add-interaction-form').classList.add('hidden')" class="px-3.5 py-1.5 bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold">Cancel·lar</button>
            <button onclick="saveNewInteraction()" class="px-3.5 py-1.5 bg-amber-800 text-white rounded-xl text-xs font-bold">Guardar</button>
          </div>
        </div>

        <div class="relative pl-6 border-l-2 border-amber-800/30 space-y-6">
          ${interactions.length === 0 ? '<div class="text-xs text-stone-400 italic py-4">Encara no hi ha cap interacció registrada.</div>' : ''}
          ${interactions.map(i => `
            <div class="relative group">
              <div class="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-amber-800 border-2 border-white"></div>
              <div class="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">${i.type}</span>
                  <span class="text-stone-400 font-semibold">${i.date}</span>
                </div>
                <h5 class="font-bold text-stone-900 text-sm mb-1">${i.summary}</h5>
                ${i.details ? `<p class="text-xs text-stone-600 mb-2 whitespace-pre-wrap">${i.details}</p>` : ''}
                ${i.next_step ? `
                  <div class="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2 text-stone-700">
                    <div><span class="font-bold text-amber-800">Propera acció:</span> ${i.next_step}</div>
                    ${i.next_date ? `<span class="text-stone-500 font-semibold shrink-0">📅 ${i.next_date}</span>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (state.activeDetailTab === 'documents') {
    const docs = d.documents || [];
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase text-stone-500 tracking-wider">Tarifes, Catàlegs i Fitxes Tècniques (${docs.length})</h4>
          <div>
            <input type="file" id="doc-file-input" class="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onchange="handleFileUpload(event)">
            <button onclick="document.getElementById('doc-file-input').click()" class="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
              <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i> Pujar Nou PDF
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${docs.length === 0 ? '<div class="col-span-full text-xs text-stone-400 italic py-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">Cap document adjuntat encara. Pots pujar tarifes d’exportació o fitxes tècniques en PDF aquí.</div>' : ''}
          ${docs.map(doc => `
            <div class="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-100">
                  <i data-lucide="file-text" class="w-5 h-5"></i>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-xs md:text-sm text-stone-900 truncate">${doc.title}</div>
                  <div class="text-[11px] text-stone-400 truncate">${doc.file_name || 'Document PDF'} • ${doc.category || 'Tarifa'}</div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                ${doc.file_url && doc.file_url !== '#' ? `
                  <a href="${doc.file_url}" download="${doc.file_name}" class="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors" title="Descarregar">
                    <i data-lucide="download" class="w-4 h-4"></i>
                  </a>
                ` : `
                  <button onclick="showToast('Document registrat', 'info')" class="w-8 h-8 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                `}
                <button onclick="deleteDocument('${doc.id}')" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center transition-colors" title="Eliminar">
                  <i data-lucide="trash" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

function showAddContactForm() {
  document.getElementById('add-contact-form').classList.remove('hidden');
}

function saveNewContact() {
  const name = document.getElementById('new-contact-name').value.trim();
  if (!name) {
    showToast('El nom del contacte és obligatori', 'error');
    return;
  }
  const role = document.getElementById('new-contact-role').value.trim();
  const email = document.getElementById('new-contact-email').value.trim();
  const mobile = document.getElementById('new-contact-mobile').value.trim();

  const d = state.selectedDistributor;
  if (!d.contacts) d.contacts = [];
  
  const newContact = {
    id: 'c-' + Date.now(),
    name,
    role,
    email,
    mobile,
    phone: mobile,
    is_primary: d.contacts.length === 0
  };

  d.contacts.push(newContact);
  saveDistributorsLocally();
  render();
  showToast('Contacte afegit!', 'success');
}

function showAddInteractionForm() {
  document.getElementById('add-interaction-form').classList.remove('hidden');
}

function saveNewInteraction() {
  const summary = document.getElementById('new-int-summary').value.trim();
  if (!summary) {
    showToast('El resum de la interacció és obligatori', 'error');
    return;
  }

  const d = state.selectedDistributor;
  if (!d.interactions) d.interactions = [];

  const newInt = {
    id: 'int-' + Date.now(),
    date: document.getElementById('new-int-date').value,
    type: document.getElementById('new-int-type').value,
    summary,
    details: document.getElementById('new-int-details').value.trim(),
    next_step: document.getElementById('new-int-nextstep').value.trim(),
    next_date: document.getElementById('new-int-nextdate').value
  };

  d.interactions.unshift(newInt);
  saveDistributorsLocally();
  render();
  showToast('Interacció registrada correctament!', 'success');
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const d = state.selectedDistributor;
  if (!d.documents) d.documents = [];

  const reader = new FileReader();
  reader.onload = function(e) {
    const newDoc = {
      id: 'doc-' + Date.now(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      category: 'Tarifa / Fitxa Tècnica',
      file_name: file.name,
      file_size: file.size,
      file_url: e.target.result
    };
    d.documents.push(newDoc);
    saveDistributorsLocally();
    render();
    showToast('Fitxer ' + file.name + ' afegit a la fitxa!', 'success');
  };
  reader.readAsDataURL(file);
}

function deleteDocument(docId) {
  const d = state.selectedDistributor;
  if (!d || !d.documents) return;
  d.documents = d.documents.filter(doc => doc.id !== docId);
  saveDistributorsLocally();
  render();
  showToast('Document eliminat', 'info');
}

function deleteDistributor(id) {
  if (!confirm('Segur que vols eliminar aquest distribuïdor i totes les seves dades?')) return;
  state.distributors = state.distributors.filter(d => d.id !== id);
  saveDistributorsLocally();
  closeDetailModal();
  render();
  showToast('Distribuïdor eliminat', 'info');
}

function openAddDistributorModal() {
  document.getElementById('new-dist-modal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) lucide.createIcons();
}

function closeAddDistributorModal() {
  document.getElementById('new-dist-modal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function saveNewDistributorForm(e) {
  e.preventDefault();
  const name = document.getElementById('new-name').value.trim();
  const country = document.getElementById('new-country').value.trim();
  
  if (!name || !country) {
    showToast('El Nom i el País són obligatoris', 'error');
    return;
  }

  const newDist = {
    id: 'dist-' + Date.now(),
    name,
    legal_name: document.getElementById('new-legal-name').value.trim() || name,
    country,
    city: document.getElementById('new-city').value.trim(),
    address: document.getElementById('new-address').value.trim(),
    website: document.getElementById('new-website').value.trim(),
    instagram: document.getElementById('new-instagram').value.trim(),
    tax_id: document.getElementById('new-tax-id').value.trim(),
    status: document.getElementById('new-status').value,
    distribution_type: document.getElementById('new-type').value,
    channels: document.getElementById('new-channels').value.trim(),
    incoterm: document.getElementById('new-incoterm').value,
    payment_terms: document.getElementById('new-payment').value,
    currency: 'EUR',
    moq: document.getElementById('new-moq').value.trim(),
    margin_commission: document.getElementById('new-margin').value.trim(),
    sparkling_focus: document.getElementById('new-focus').value.trim(),
    annual_volume: document.getElementById('new-volume').value.trim(),
    related_wineries: document.getElementById('new-wineries').value.trim(),
    notes: document.getElementById('new-notes').value.trim(),
    specialty_tags: ['Afegit Manualment'],
    contacts: [],
    interactions: [],
    documents: []
  };

  const contactName = document.getElementById('new-contact-person').value.trim();
  if (contactName) {
    newDist.contacts.push({
      id: 'c-' + Date.now(),
      name: contactName,
      role: document.getElementById('new-contact-role').value.trim(),
      email: document.getElementById('new-contact-email').value.trim(),
      mobile: document.getElementById('new-contact-mobile').value.trim(),
      phone: document.getElementById('new-contact-mobile').value.trim(),
      is_primary: true
    });
  }

  state.distributors.unshift(newDist);
  saveDistributorsLocally();
  closeAddDistributorModal();
  render();
  showToast('Nou distribuïdor ' + name + ' afegit!', 'success');
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast("La llibreria Excel s'està carregant...", "warning");
    return;
  }

  const rows = state.distributors.map(d => {
    const c = (d.contacts || []).find(c => c.is_primary) || (d.contacts || [])[0] || {};
    return {
      'Nom Distribuïdor': d.name,
      'Raó Social': d.legal_name || '',
      'País': d.country,
      'Ciutat / Província': d.city || '',
      'Estat': d.status,
      'Prioritat': d.priority || '',
      'Tipus Distribució': d.distribution_type || '',
      'Cellers a Cartera': d.related_wineries || '',
      'Focus Escumosos': d.sparkling_focus || '',
      'Instagram': d.instagram || '',
      'Lloc Web': d.website || '',
      'Contacte Principal': c.name || '',
      'Email Contacte': c.email || '',
      'Telèfon / WhatsApp': c.mobile || c.phone || '',
      'Incoterm': d.incoterm || '',
      'Terminis Pagament': d.payment_terms || '',
      'Comanda Mínima (MOQ)': d.moq || '',
      'Notes & Verificació': d.notes || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dr. Comercial - Distribuïdors');
  XLSX.writeFile(wb, 'Dr_Comercial_Distribuidors_' + new Date().toISOString().split('T')[0] + '.xlsx');
  showToast('Base de dades exportada a Excel!', 'success');
}

function triggerExcelImport() {
  document.getElementById('excel-file-input').click();
}

function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (!jsonData || jsonData.length === 0) {
        showToast('El fitxer Excel està buit', 'error');
        return;
      }

      let importedCount = 0;
      jsonData.forEach((row, index) => {
        const name = row['Nom Distribuïdor'] || row['Nom'] || row['Empresa'] || row['Name'] || row['Company'] || row['Actor'];
        const country = row['País'] || row['Pais'] || row['Country'] || 'Espanya';

        if (name) {
          const newDist = {
            id: 'dist-import-' + Date.now() + '-' + index,
            name: String(name),
            legal_name: String(row['Raó Social'] || row['Legal Name'] || name),
            country: String(country),
            city: String(row['Ciutat / Província'] || row['Ciutat'] || row['Província'] || row['City'] || ''),
            address: String(row['Adreça'] || row['Address'] || ''),
            status: String(row['Estat'] || row['Status'] || 'Actiu'),
            distribution_type: String(row['Tipus Distribució'] || row['Type'] || 'Distribuïdor'),
            related_wineries: String(row['Cellers a Cartera'] || row['Celler(s) relacionat(s)'] || ''),
            sparkling_focus: String(row['Focus Escumosos'] || row['Especialitat Escumosos'] || ''),
            instagram: String(row['Instagram'] || ''),
            website: String(row['Lloc Web'] || row['Web'] || row['website'] || ''),
            incoterm: String(row['Incoterm'] || 'EXW'),
            payment_terms: String(row['Terminis Pagament'] || '30 dies'),
            moq: String(row['Comanda Mínima (MOQ)'] || '1 Palet'),
            notes: String(row['Notes & Verificació'] || row['Notes'] || ''),
            specialty_tags: ['Importat d’Excel'],
            contacts: [],
            interactions: [],
            documents: []
          };

          const contactName = row['Contacte Principal'] || row['Contacte'] || row['Contact'];
          const phone = row['Telèfon / WhatsApp'] || row['Telèfon'] || row['Phone'] || row['Mòbil'];
          const email = row['Email Contacte'] || row['Email'] || row['Correu'];

          if (contactName || phone || email) {
            newDist.contacts.push({
              id: 'c-imp-' + Date.now() + '-' + index,
              name: String(contactName || 'Contacte Principal'),
              role: String(row['Càrrec'] || 'Comercial'),
              email: String(email || ''),
              mobile: String(phone || ''),
              phone: String(phone || ''),
              is_primary: true
            });
          }

          state.distributors.push(newDist);
          importedCount++;
        }
      });

      saveDistributorsLocally();
      render();
      showToast(`S’han importat ${importedCount} distribuïdors amb èxit!`, "success");
    } catch (err) {
      console.error(err);
      showToast("Error en llegir l’Excel: " + err.message, "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

function openCloudModal() {
  document.getElementById('cloud-url').value = state.supabaseConfig.url || '';
  document.getElementById('cloud-key').value = state.supabaseConfig.key || '';
  document.getElementById('cloud-modal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCloudModal() {
  document.getElementById('cloud-modal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function saveSupabaseConfig() {
  const url = document.getElementById('cloud-url').value.trim();
  const key = document.getElementById('cloud-key').value.trim();

  state.supabaseConfig = { url, key, connected: false };
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(state.supabaseConfig));

  if (url && key && window.supabase) {
    try {
      state.supabaseClient = window.supabase.createClient(url, key);
      state.supabaseConfig.connected = true;
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(state.supabaseConfig));
      showToast('Credencials desades! Prova ara la sincronització.', 'success');
      updateSyncIndicator();
      closeCloudModal();
    } catch (e) {
      showToast('Error amb les dades de connexió', 'error');
    }
  } else {
    showToast("S'ha restablert el mode Local", "info");
    updateSyncIndicator();
    closeCloudModal();
  }
}

function updateSyncIndicator() {
  const badge = document.getElementById('sync-status-badge');
  if (!badge) return;

  if (state.supabaseConfig.connected) {
    badge.className = 'flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold cursor-pointer';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Núvol Actiu (Supabase)';
  } else {
    badge.className = 'flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-600 border border-stone-200 rounded-full text-xs font-bold cursor-pointer hover:bg-stone-200 transition-colors';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-stone-400"></span> Mode Local (Navegador)';
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl text-white font-bold text-xs md:text-sm flex items-center gap-2 transition-all duration-300 transform translate-y-0 opacity-100 ' +
    (type === 'success' ? 'bg-emerald-800' : type === 'error' ? 'bg-rose-800' : type === 'warning' ? 'bg-amber-800' : 'bg-stone-900');

  setTimeout(() => {
    toast.className += ' translate-y-12 opacity-0 pointer-events-none';
  }, 3500);
}

function resetFilters() {
  state.searchQuery = '';
  state.filterStatus = 'Tots';
  state.filterCountry = 'Tots';
  state.filterZone = 'Totes';
  state.filterRegion = 'Totes';
  state.filterSpecialty = 'Totes';
  state.filterWinery = 'Tots';
  state.quickOnlyActive = false;
  state.quickOnlyInstagram = false;
  state.quickOnlyPriority = false;

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

  if (document.getElementById('filter-status')) document.getElementById('filter-status').value = 'Tots';
  if (document.getElementById('filter-country')) document.getElementById('filter-country').value = 'Tots';
  if (document.getElementById('filter-zone')) document.getElementById('filter-zone').value = 'Totes';
  if (document.getElementById('filter-specialty')) document.getElementById('filter-specialty').value = 'Totes';
  if (document.getElementById('filter-winery')) document.getElementById('filter-winery').value = 'Tots';

  // Restablir botons de filtres ràpids
  const btnAct = document.getElementById('btn-quick-active');
  if (btnAct) btnAct.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-emerald-500 hover:text-emerald-800 font-semibold text-stone-700 transition-all text-xs';
  const btnIg = document.getElementById('btn-quick-instagram');
  if (btnIg) btnIg.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-rose-400 hover:text-rose-800 font-semibold text-stone-700 transition-all text-xs';
  const btnPrio = document.getElementById('btn-quick-priority');
  if (btnPrio) btnPrio.className = 'px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-amber-500 hover:text-amber-900 font-semibold text-stone-700 transition-all text-xs';

  setMainTab('all');
}

function setupEventListeners() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn) {
        if (state.searchQuery) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
      renderDistributorsList();
      updateActiveChips();
    });
  }

  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.filterStatus = e.target.value;
    renderDistributorsList();
  });

  document.getElementById('filter-country').addEventListener('change', (e) => {
    state.filterCountry = e.target.value;
    renderDistributorsList();
  });

  document.getElementById('filter-specialty').addEventListener('change', (e) => {
    state.filterSpecialty = e.target.value;
    renderDistributorsList();
  });

  const zoneSelect = document.getElementById('filter-zone');
  if (zoneSelect) {
    zoneSelect.addEventListener('change', (e) => {
      state.filterZone = e.target.value;
      renderDistributorsList();
    });
  }

  const winerySelect = document.getElementById('filter-winery');
  if (winerySelect) {
    winerySelect.addEventListener('change', (e) => {
      state.filterWinery = e.target.value;
      setQuickFilter('winery', e.target.value);
    });
  }

  document.getElementById('view-grid-btn').addEventListener('click', () => {
    state.viewMode = 'grid';
    document.getElementById('view-grid-btn').className = 'p-1.5 rounded-xl bg-amber-800 text-white';
    document.getElementById('view-table-btn').className = 'p-1.5 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200';
    renderDistributorsList();
  });

  document.getElementById('view-table-btn').addEventListener('click', () => {
    state.viewMode = 'table';
    document.getElementById('view-table-btn').className = 'p-1.5 rounded-xl bg-amber-800 text-white';
    document.getElementById('view-grid-btn').className = 'p-1.5 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200';
    renderDistributorsList();
  });
}

document.addEventListener('DOMContentLoaded', initApp);
