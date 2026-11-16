/* Token Radar — renders window.RADAR (written by main.ts from the sealed snapshot).
   No fetch, no network: every number on the page comes from data.js beside it.
   The model lives here too: modelBreakdown(row) re-derives a row's implied value
   from its four stored factors, so any number on the board can be checked. */
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) { document.body.textContent = 'Token Radar: no data.js found beside this page.'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var money = function (n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var moneyFull = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var pct = function (n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  };
  var ageText = function (days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  };

  /* Re-derive a row's implied value from its stored factors (the model, in code):
     implied = TVL x peerMultiple x growthMult x maturityMult x chainMult. */
  function modelBreakdown(row) {
    var m = row.model;
    var recomputed = Math.max(1, Math.round(row.tvl_usd * m.peer_multiple * m.growth_multiplier * m.maturity_multiplier * m.chain_multiplier));
    return {
      base: row.tvl_usd * m.peer_multiple,
      recomputed: recomputed,
      matches: recomputed === row.implied_value_usd,
      parts: [
        { k: 'Peer multiple', v: '×' + m.peer_multiple.toFixed(3), w: m.peer_multiple, d: 'Median market-cap / TVL of live tokens in ' + (row.category || 'this category') + ', shrunk toward the snapshot median and clamped to 0.05–1.00.' },
        { k: 'Growth', v: '×' + m.growth_multiplier.toFixed(3), w: (m.growth_multiplier - 0.825) / 0.7, d: '7-day TVL change ' + pct(m.growth_pct) + ', clamped to −50%…+150%, weighted 0.35.' },
        { k: 'Maturity', v: '×' + m.maturity_multiplier.toFixed(3), w: (m.maturity_multiplier - 0.75) / 0.25, d: 'Tracked ' + ageText(m.age_days) + ' — 0.75 when just listed, 1.00 after three years.' },
        { k: 'Breadth', v: '×' + m.chain_multiplier.toFixed(2), w: (m.chain_multiplier - 1) / 0.1, d: row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ' — 2% per extra chain, up to five.' }
      ]
    };
  }

  /* ---- state from the URL hash, so a view can be linked and screenshotted ---- */
  function hashParams() {
    var out = {};
    var h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }
  var hash = hashParams();
  var state = {
    q: hash.q || '',
    category: hash.category || 'all',
    chain: hash.chain || 'all',
    watchlistOnly: hash.watchlist === '1',
    sort: hash.sort || 'implied',
    dir: -1,
    view: hash.view || 'board',
    selected: hash.protocol || null
  };

  /* ---- header ---- */
  $('as-of').textContent = DATA.as_of;
  $('as-of-2').textContent = DATA.as_of;
  $('source').textContent = DATA.source;
  $('model-version').textContent = DATA.model_version;
  var top = DATA.rows[0];
  $('stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + DATA.board_size + '</dd></div>' +
    '<div><dt>Watchlist covered</dt><dd>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</dd></div>' +
    '<div><dt>Total implied value</dt><dd>' + money(DATA.total_implied_usd) + '</dd></div>' +
    '<div><dt>Top row</dt><dd>' + esc(top.name) + ' <small>' + money(top.implied_value_usd) + '</small></dd></div>';

  /* ---- controls ---- */
  var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
  cats.forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c;
    $('category').appendChild(o);
  });
  var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains); }, []))).sort();
  chains.forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c;
    $('chain').appendChild(o);
  });
  $('q').value = state.q;
  $('category').value = state.category;
  $('chain').value = state.chain;
  $('watchlist-only').checked = state.watchlistOnly;
  $('sort').value = state.sort;

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
  }
  function sortedRows(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var d = 0;
      if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'growth') d = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') d = (a.age_days || 0) - (b.age_days || 0);
      else if (key === 'name') d = a.name.localeCompare(b.name);
      else d = a.implied_value_usd - b.implied_value_usd;
      if (d === 0) d = a.slug < b.slug ? -1 : 1;
      return d * dir;
    });
  }

  /* Show at most three chains in the table; the detail view lists them all. */
  function chainsShort(r) {
    if (r.chains.length <= 3) return esc(r.chains.join(', '));
    return esc(r.chains.slice(0, 3).join(', ')) + ' <span title="' + esc(r.chains.join(', ')) + '">+' + (r.chains.length - 3) + ' more</span>';
  }

  function renderBoard() {
    var list = sortedRows(filteredRows());
    $('count').textContent = list.length + ' of ' + DATA.board_size + ' protocols — ' +
      list.filter(function (r) { return r.watchlist; }).length + ' on the house watchlist, ' +
      list.filter(function (r) { return !r.watchlist; }).length + ' early finds.';
    $('rows').innerHTML = list.map(function (r) {
      var chg = r.change_7d === null ? '<td class="num">—</td>'
        : '<td class="num ' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</td>';
      var badge = r.watchlist
        ? '<span class="badge watch" title="On the house watchlist">WATCHLIST</span>'
        : '<span class="badge early" title="Passes the no-token rule; the house watchlist leaves it out">EARLY FIND</span>';
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="rank">#' + r.rank + '</td>' +
        '<td class="name">' + esc(r.name) + badge + '<small>' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chainsShort(r) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' + chg +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td></tr>';
    }).join('');
    Array.prototype.forEach.call($('rows').querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () { select(tr.getAttribute('data-slug')); });
    });
  }

  function select(slug) {
    state.selected = slug;
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    var box = $('detail');
    if (!row) { box.hidden = true; return; }
    var bd = modelBreakdown(row);
    var why = 'DefiLlama records no token for ' + row.name + ' as of ' + DATA.as_of +
      ': no CoinGecko id, no symbol and no market cap in the snapshot. ' +
      (row.watchlist
        ? 'It is on the house watchlist — TVL at or above $' + (DATA.floor_usd / 1e6).toFixed(0) + 'M, no token recorded, and not a wrapped, staked or bridged product of one that trades.'
        : 'It is an early find below or beyond the watchlist floor: it passes the same no-token rule, but the house watchlist leaves it out, so verify it is not a sub-product of another protocol before farming.');
    box.innerHTML =
      '<h2>' + esc(row.name) + ' <span class="rank">#' + row.rank + '</span></h2>' +
      '<p class="sub">' + esc(row.category || 'Uncategorised') + ' &middot; ' + esc(row.chains.join(', ')) +
      ' &middot; TVL ' + moneyFull(row.tvl_usd) + ' &middot; 7d ' + pct(row.change_7d) +
      ' &middot; tracked ' + ageText(row.age_days) + ' &middot; listed ' + esc(row.listed_at || 'unknown') + '</p>' +
      '<h3>Implied value — ' + moneyFull(row.implied_value_usd) + '</h3>' +
      '<div class="factors">' + bd.parts.map(function (f) {
        return '<div class="factor"><div class="k">' + esc(f.k) + '</div><div class="v">' + esc(f.v) + '</div>' +
          '<div class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, f.w)) * 100) + '%"></i></div>' +
          '<div class="d">' + esc(f.d) + '</div></div>';
      }).join('') + '</div>' +
      '<p>Base: TVL ' + moneyFull(row.tvl_usd) + ' &times; peer multiple ' + row.model.peer_multiple.toFixed(3) +
      ' = ' + moneyFull(bd.base) + '. The four factors multiply to ' + moneyFull(bd.recomputed) +
      (bd.matches ? ', matching the board value.' : '.') + '</p>' +
      '<h3>Why it records no token</h3><p>' + esc(why) + '</p>' +
      '<h3>How to farm it — six steps</h3>' +
      '<ol class="steps">' + row.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    box.hidden = false;
    renderBoard();
    box.scrollIntoView({ block: 'nearest' });
  }

  function renderLive() {
    $('live-rows').innerHTML = DATA.live.map(function (r) {
      var ratio = r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : '—';
      return '<tr><td class="name">' + esc(r.name) + '<small>' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || '—') + '</td><td>' + chainsShort(r) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + (r.mcap_usd ? money(r.mcap_usd) : '—') + '</td>' +
        '<td class="num">' + ratio + '</td>' +
        '<td class="num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
  }

  function renderModel() {
    var mults = Object.entries(DATA.category_multiples).sort(function (a, b) { return b[1] - a[1]; });
    var m = DATA.model;
    $('model-body').innerHTML =
      '<p>Peer multiple per category — the median market-cap / TVL of that category&rsquo;s live tokens, ' +
      'shrunk toward the snapshot-wide median of ' + m.global_peer_multiple.toFixed(3) +
      ' (weight ' + m.shrink_weight + ') and clamped to ' + m.multiple_low + '–' + m.multiple_high + '.</p>' +
      '<div class="table-wrap"><table class="mult-table"><thead><tr><th scope="col">Category</th>' +
      '<th scope="col" class="num">Peer multiple</th></tr></thead><tbody>' +
      mults.map(function (kv) {
        return '<tr><td>' + esc(kv[0]) + '</td><td class="num">' + kv[1].toFixed(3) + '×</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p>Growth uses the protocol&rsquo;s own 7-day TVL change, clamped to ' + m.growth_floor + '%…+' + m.growth_cap +
      '% and weighted ' + m.growth_weight + '. Maturity runs from ' + m.maturity_floor + ' at listing to 1.00 after ' +
      m.maturity_days + ' days (' + m.unknown_age_days + ' days assumed when no listing date is reported). ' +
      'Breadth adds ' + (m.chain_step * 100).toFixed(0) + '% per extra chain, up to ' + m.chain_max_extra + '.</p>';
  }

  function setView(view) {
    state.view = view;
    ['board', 'live', 'model'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === view);
    });
    if (view === 'live') renderLive();
    if (view === 'model') renderModel();
  }

  /* ---- events ---- */
  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('watchlist-only').addEventListener('change', function (e) { state.watchlistOnly = e.target.checked; renderBoard(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
  Array.prototype.forEach.call(document.querySelectorAll('th button[data-sort]'), function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = -1; }
      $('sort').value = state.sort;
      renderBoard();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { setView(t.getAttribute('data-view')); });
  });

  renderBoard();
  setView(state.view);
  if (state.selected) select(state.selected);
})();
