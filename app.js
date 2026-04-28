/**
 * UNIFRANZ WiFi Simulator — app.js
 * Simulación técnica RF basada en el análisis completo del Piso 5
 * Fórmulas: FSPL (Friis), Log-Distance Path Loss, Link Budget
 */

// ═══════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════
const RF = {
  freq_mhz: 2400,
  pt_dbm: 20,
  gt_dbi: 3,
  gr_dbi: 2,
  eirp: 25,         // pt + gt + gr
  sens_opt: -65,    // optimal sensitivity dBm
  sens_lim: -80,    // limit sensitivity dBm
  nominal_mbps: 130,
  n_indoor: 3,      // path loss exponent
  pl_d0: 40,        // path loss at 1m reference
  bw_per_user: 3,   // default Mbps per user
};

const FLOOR = { w: 30, h: 15 };

// ═══════════════════════════════════════════════
// RF CALCULATION ENGINE
// ═══════════════════════════════════════════════

function calcFSPL(d_m) {
  if (d_m < 0.5) d_m = 0.5;
  const d_km = d_m / 1000;
  const log_f = 20 * Math.log10(RF.freq_mhz);
  const log_d = 20 * Math.log10(d_km);
  return 32.44 + log_f + log_d;
}

function calcPL_indoor(d_m) {
  if (d_m < 1) d_m = 1;
  return RF.pl_d0 + 10 * RF.n_indoor * Math.log10(d_m / 1);
}

function calcPr(fspl, loss_db) {
  return RF.eirp - fspl - loss_db;
}

function calcLatency(d_m, users, max_users) {
  const prop = (d_m / 3e8) * 1000;                         // propagation ms
  const proc = 2 + (d_m / 5) * 0.3;                        // processing
  const contention = users > max_users
    ? Math.pow(users / max_users, 1.4) * 12
    : (users / max_users) * 4;
  const walls_lat = parseInt(document.getElementById('walls').value) * 1.2;
  return prop + proc + contention + walls_lat;
}

function signalQuality(pr) {
  if (pr >= -65) return { label: 'Excelente', color: '#00ff94', barColor: '#00ff94', bars: 4, cls: 'q-ex' };
  if (pr >= -72) return { label: 'Buena',     color: '#378add', barColor: '#378add', bars: 3, cls: 'q-bk' };
  if (pr >= -80) return { label: 'Marginal',  color: '#f5a623', barColor: '#f5a623', bars: 2, cls: 'q-mg' };
  return            { label: 'Crítico',  color: '#ff4757', barColor: '#ff4757', bars: 1, cls: 'q-cr' };
}

// ═══════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════

function $(id) { return document.getElementById(id); }

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function animNumber(id, target, decimals, suffix, duration = 700) {
  const el = $(id);
  if (!el) return;
  const start = parseFloat(el.textContent) || 0;
  const startTime = performance.now();
  function frame(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const val = start + (target - start) * ease;
    el.textContent = (decimals === 0 ? Math.round(val) : val.toFixed(decimals)) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function setBarWidth(id, pct, color) {
  const el = $(id);
  if (!el) return;
  el.style.width = Math.min(100, Math.max(0, pct)) + '%';
  if (color) el.style.background = color;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════
// CONTROL BINDINGS
// ═══════════════════════════════════════════════

function initControls() {
  $('dist').addEventListener('input', () => {
    $('dist-display').textContent = $('dist').value + ' m';
  });

  $('users').addEventListener('input', () => {
    $('users-display').textContent = $('users').value;
  });

  $('bw').addEventListener('input', () => {
    $('bw-display').textContent = parseFloat($('bw').value).toFixed(1) + ' Mbps';
  });

  // Wall buttons
  document.querySelectorAll('.wall-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wall-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('walls').value = btn.dataset.val;
      const labels = ['Sin paredes (0 dB)', '1 pared (8 dB)', '2 paredes (16 dB)'];
      $('walls-display').textContent = labels[parseInt(btn.dataset.val)];
    });
  });

  // Efficiency buttons
  document.querySelectorAll('.eff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.eff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('eff').value = btn.dataset.val;
      $('eff-display').textContent = Math.round(parseFloat(btn.dataset.val) * 100) + '%';
    });
  });

  $('runBtn').addEventListener('click', runSimulation);
}

// ═══════════════════════════════════════════════
// THREE RING GAUGES
// ═══════════════════════════════════════════════

// Each gauge maps an absolute dBm value (0–max) onto the ring arc.
// We treat the absolute value (dropping the minus sign) for visual fill.
// Gauge 1: FSPL-only Pr  → max 90 dBm  → red palette
// Gauge 2: Pr (FSPL + L) → max 150 dBm → orange palette
// Gauge 3: Pr interior   → max 200 dBm → purple palette

const GAUGE_CFG = [
  { id: 'ring1-fill', circumference: 465, max: 90,
    colors: ['#ff2020','#ff4444','#ff6464','#ff9090'],   // red ramp low→high abs
    speedEl: 'g1-speed', qualEl: 'g1-quality', valEl: 'g1-val' },
  { id: 'ring2-fill', circumference: 578, max: 150,
    colors: ['#ff6800','#f5a623','#ffc44d','#ffe099'],   // orange ramp
    speedEl: 'g2-speed', qualEl: 'g2-quality', valEl: 'g2-val' },
  { id: 'ring3-fill', circumference: 465, max: 200,
    colors: ['#6a00ff','#9b4dff','#b47aff','#d4b0ff'],   // purple ramp
    speedEl: 'g3-speed', qualEl: 'g3-quality', valEl: 'g3-val' },
];

function gaugeColor(cfg, abs_val) {
  // pick color from ramp based on fill level (0=weak → 3=strong)
  const t = Math.min(1, abs_val / cfg.max);
  const idx = Math.floor(t * (cfg.colors.length - 1));
  return cfg.colors[idx];
}

function updateGauge(cfg_idx, pr_dbm, speed_mbps, quality_label) {
  const cfg = GAUGE_CFG[cfg_idx];
  const ring = document.getElementById(cfg.id);
  if (!ring) return;

  const abs_val = Math.abs(pr_dbm);             // e.g. 60.58
  const t = Math.min(1, abs_val / cfg.max);
  const offset = cfg.circumference * (1 - t);
  const color = gaugeColor(cfg, abs_val);

  ring.style.strokeDashoffset = offset;
  ring.style.stroke = color;

  const valEl = document.getElementById(cfg.valEl);
  if (valEl) { valEl.textContent = pr_dbm.toFixed(1); valEl.style.color = color; }

  const speedEl = document.getElementById(cfg.speedEl);
  if (speedEl) { speedEl.textContent = speed_mbps.toFixed(2) + ' Mbps'; speedEl.style.color = color; }

  const qualEl = document.getElementById(cfg.qualEl);
  if (qualEl) { qualEl.textContent = quality_label; qualEl.style.color = color; }
}

// ═══════════════════════════════════════════════
// FLOOR MAP (Canvas)
// ═══════════════════════════════════════════════

function drawFloorMap(aps_needed, d_m, users) {
  const canvas = $('floorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = 40;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#0d1120';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(0,255,148,0.04)';
  ctx.lineWidth = 1;
  for (let x = PAD; x <= W - PAD; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, H - PAD); ctx.stroke();
  }
  for (let y = PAD; y <= H - PAD; y += 20) {
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  }

  // Floor outline
  const fw = W - PAD * 2, fh = H - PAD * 2;
  ctx.strokeStyle = 'rgba(0,255,148,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PAD, PAD, fw, fh);

  // Dimension labels
  ctx.fillStyle = 'rgba(136,146,164,0.8)';
  ctx.font = '11px Space Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('30 metros', W / 2, H - 12);
  ctx.save();
  ctx.translate(14, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('15 metros', 0, 0);
  ctx.restore();

  // Rooms sketched inside
  const rooms = [
    { x: 0, y: 0, w: 0.35, h: 0.5, label: 'Aula 501' },
    { x: 0, y: 0.5, w: 0.35, h: 0.5, label: 'Aula 502' },
    { x: 0.35, y: 0, w: 0.3, h: 1, label: 'Pasillo' },
    { x: 0.65, y: 0, w: 0.35, h: 0.5, label: 'Aula 503' },
    { x: 0.65, y: 0.5, w: 0.35, h: 0.5, label: 'Lab 504' },
  ];

  rooms.forEach(r => {
    const rx = PAD + r.x * fw, ry = PAD + r.y * fh;
    const rw = r.w * fw, rh = r.h * fh;
    ctx.strokeStyle = 'rgba(30,42,64,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(136,146,164,0.3)';
    ctx.font = '10px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(r.label, rx + rw / 2, ry + rh / 2 + 4);
  });

  // AP placement
  const ap_count = Math.min(aps_needed, 15);
  const ap_positions = computeAPPositions(ap_count, fw, fh, PAD);

  // Draw coverage circles
  ap_positions.forEach((ap, i) => {
    const radius = (d_m / 30) * (fw * 0.35);
    const gradient = ctx.createRadialGradient(ap.x, ap.y, 0, ap.x, ap.y, radius);
    gradient.addColorStop(0, 'rgba(0,255,148,0.12)');
    gradient.addColorStop(0.6, 'rgba(0,255,148,0.04)');
    gradient.addColorStop(1, 'rgba(0,255,148,0)');
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  // Draw AP icons
  ap_positions.forEach((ap, i) => {
    // AP base
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff94';
    ctx.fill();

    // AP signal rings
    [14, 21].forEach((r, ri) => {
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,148,${0.3 - ri * 0.12})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // AP label
    ctx.fillStyle = '#00ff94';
    ctx.font = '9px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AP' + (i + 1), ap.x, ap.y + 20);
  });

  // User dot (current position)
  const userX = PAD + (d_m / 30) * fw * 0.85 + 10;
  const userY = PAD + fh * 0.6;
  ctx.beginPath();
  ctx.arc(userX, userY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#f5a623';
  ctx.fill();
  ctx.fillStyle = '#f5a623';
  ctx.font = '9px Space Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Usuario', userX, userY + 16);

  // Distance line from first AP to user
  if (ap_positions.length > 0) {
    const ap0 = ap_positions[0];
    ctx.beginPath();
    ctx.moveTo(ap0.x, ap0.y);
    ctx.lineTo(userX, userY);
    ctx.strokeStyle = 'rgba(245,166,35,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance label on line
    const mx = (ap0.x + userX) / 2, my = (ap0.y + userY) / 2 - 6;
    ctx.fillStyle = 'rgba(245,166,35,0.9)';
    ctx.font = '10px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d_m + ' m', mx, my);
  }

  // Floor title
  ctx.fillStyle = 'rgba(136,146,164,0.5)';
  ctx.font = '10px Space Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PLANTA PISO 5 — EDIFICIO ACADÉMICO UNIFRANZ', PAD, PAD - 10);
}

function computeAPPositions(count, fw, fh, PAD) {
  const positions = [];
  if (count === 0) return positions;
  const cols = count <= 3 ? count : Math.ceil(Math.sqrt(count * (fw / fh)));
  const rows = Math.ceil(count / cols);
  let placed = 0;
  for (let r = 0; r < rows && placed < count; r++) {
    const rowCount = Math.min(cols, count - r * cols);
    for (let c = 0; c < rowCount; c++) {
      const x = PAD + (fw / (rowCount + 1)) * (c + 1);
      const y = PAD + (fh / (rows + 1)) * (r + 1);
      positions.push({ x, y });
      placed++;
    }
  }
  return positions;
}

// ═══════════════════════════════════════════════
// MAIN SIMULATION
// ═══════════════════════════════════════════════

async function runSimulation() {
  const btn = $('runBtn');
  btn.disabled = true;
  $('run-label').textContent = 'Calculando...';

  // Gather inputs
  const d = parseFloat($('dist').value);
  const walls = parseInt($('walls').value);
  const users = parseInt($('users').value);
  const eff = parseFloat($('eff').value);
  const bw_user = parseFloat($('bw').value);

  await sleep(300);

  // ── RF Calculations ──
  const L = walls * 8;
  const d_km = d / 1000;
  const log_f_val = 20 * Math.log10(RF.freq_mhz);
  const log_d_val = 20 * Math.log10(d_km);
  const fspl = 32.44 + log_f_val + log_d_val;
  const pr = RF.eirp - fspl - L;
  const pl_int = calcPL_indoor(d);
  const pr_int = RF.eirp - pl_int;
  const margin_opt = pr - RF.sens_opt;
  const margin_lim = pr - RF.sens_lim;

  // ── Capacity ──
  const cap_real = RF.nominal_mbps * eff;
  const max_users_ap = Math.floor(cap_real / bw_user);
  const demand = users * bw_user;
  const aps_needed = Math.ceil(demand / cap_real);
  const per_user = cap_real / users;

  // ── Latency ──
  const latency = calcLatency(d, users, max_users_ap);

  // ── Quality ──
  const q = signalQuality(pr);

  // ══ UPDATE UI ══

  // ── Gauge 1: FSPL signal → red → 0–90 dBm, speed = per_user
  const pr_fspl_only = RF.eirp - fspl;   // no material losses
  updateGauge(0, pr_fspl_only, per_user, signalQuality(pr_fspl_only).label);

  // ── Gauge 2 (center): Pr with losses → orange → 0–150 dBm, speed = cap_real
  updateGauge(1, pr, cap_real, signalQuality(pr).label);

  // ── Gauge 3: Interior model → purple → 0–200 dBm, speed = cap_degraded
  const cap_degraded = RF.nominal_mbps * 0.40;
  updateGauge(2, pr_int, cap_degraded, signalQuality(pr_int).label);

  // Signal bars (center gauge)
  const orange_color = gaugeColor(GAUGE_CFG[1], Math.abs(pr));
  for (let i = 1; i <= 4; i++) {
    const bar = $('sb' + i);
    if (!bar) continue;
    bar.style.background = i <= q.bars ? orange_color : 'var(--panel-border)';
  }

  // Speed cards
  animNumber('dl-val', per_user, 2, '');
  animNumber('cap-val', cap_real, 0, '');
  animNumber('lat-val', latency, 0, '');

  const dl_pct = Math.min(100, (per_user / (bw_user * 2)) * 100);
  const cap_pct = Math.min(100, (cap_real / RF.nominal_mbps) * 100);
  const lat_pct = Math.min(100, (latency / 200) * 100);
  const dl_color = per_user >= bw_user ? '#00ff94' : per_user >= bw_user * 0.5 ? '#f5a623' : '#ff4757';
  const lat_color = latency < 20 ? '#00ff94' : latency < 50 ? '#f5a623' : '#ff4757';

  await sleep(100);
  setBarWidth('dl-bar', dl_pct, dl_color);
  setBarWidth('cap-bar', cap_pct, '#378add');
  setBarWidth('lat-bar', lat_pct, lat_color);

  $('dl-ref').textContent = `objetivo: ${bw_user.toFixed(1)} Mbps/usuario`;
  $('lat-ref').textContent = latency < 20 ? 'Excelente' : latency < 50 ? 'Aceptable' : 'Alta latencia';
  $('dl-val').style.color = dl_color;
  $('lat-val').style.color = lat_color;

  // AP counter
  animNumber('ap-number', aps_needed, 0, '');
  const ap_color = aps_needed <= 1 ? '#00ff94' : aps_needed <= 10 ? '#f5a623' : '#ff4757';
  $('ap-number').style.color = ap_color;
  $('ap-sublabel').textContent = aps_needed === 1
    ? `1 AP es suficiente para ${users} usuarios`
    : `APs necesarios · ${users} usuarios · ${bw_user} Mbps c/u`;
  $('formula-result').textContent =
    `= ⌈ ${demand.toFixed(0)} / ${cap_real.toFixed(0)} ⌉ = ${aps_needed}`;

  // RF calculation panel
  setText('s-logd', `20·log(${d_km.toFixed(4)}) = ${log_d_val.toFixed(2)} dB`);
  setText('s-fspl', `FSPL = ${fspl.toFixed(2)} dB`);
  setText('s-loss', `L (${walls} pared${walls !== 1 ? 'es' : ''}) = ${L} dB`);
  setText('s-pr', `Pr = ${pr.toFixed(2)} dBm`);
  setText('s-m-opt', `vs. −65 dBm (óptima) = ${margin_opt >= 0 ? '+' : ''}${margin_opt.toFixed(2)} dB`);
  setText('s-m-lim', `vs. −80 dBm (límite) = ${margin_lim >= 0 ? '+' : ''}${margin_lim.toFixed(2)} dB`);
  setText('s-pl', `PL(${d}m) = ${pl_int.toFixed(2)} dB`);
  setText('s-pr-int', `Pr interior = ${pr_int.toFixed(2)} dBm`);
  setText('s-diff', `Δ vs FSPL = +${(pl_int - fspl).toFixed(2)} dB`);
  setText('s-cap', `Cap real = ${cap_real.toFixed(0)} Mbps (${Math.round(eff * 100)}%)`);
  setText('s-maxu', `Usuarios/AP = ⌊${cap_real.toFixed(0)}/${bw_user}⌋ = ${max_users_ap}`);
  setText('s-demand', `Demanda = ${users}×${bw_user} = ${demand.toFixed(0)} Mbps`);
  setText('s-aps', `APs = ⌈${demand.toFixed(0)}/${cap_real.toFixed(0)}⌉ = ${aps_needed}`);

  const verdict_rf = margin_opt >= 10 ? '✓ Enlace robusto (>10 dB)' : margin_opt >= 0 ? '⚠ Enlace marginal' : '✗ Sin cobertura';
  const verdict_rf_el = $('s-verdict-rf');
  if (verdict_rf_el) {
    verdict_rf_el.textContent = `Estado: ${verdict_rf}`;
    verdict_rf_el.style.color = margin_opt >= 10 ? '#00ff94' : margin_opt >= 0 ? '#f5a623' : '#ff4757';
  }

  // Verdict box
  renderVerdict(pr, margin_opt, users, max_users_ap, per_user, aps_needed, demand, cap_real, bw_user);

  // Floor map
  drawFloorMap(aps_needed, d, users);
  $('floor-badge').textContent = `${aps_needed} AP${aps_needed !== 1 ? 's' : ''} recomendados · ${demand.toFixed(0)} Mbps demanda`;

  btn.disabled = false;
  $('run-label').textContent = 'Reiniciar simulación';
}

function renderVerdict(pr, margin_opt, users, max_users, per_user, aps, demand, cap, bw_user) {
  const el = $('verdict');
  if (!el) return;

  let cls = '', title = '', body = '';

  const coverage_ok = margin_opt >= 0;
  const coverage_good = margin_opt >= 10;
  const capacity_ok = users <= max_users;

  if (!coverage_ok) {
    cls = 'v-fail';
    title = 'Sin cobertura de señal';
    body = `La señal recibida de ${pr.toFixed(1)} dBm está por debajo del umbral mínimo operativo (−80 dBm). El usuario no puede conectarse. Reduzca la distancia o elimine obstáculos.`;
  } else if (!coverage_good && !capacity_ok) {
    cls = 'v-fail';
    title = 'Cobertura marginal + capacidad insuficiente';
    body = `Señal: ${pr.toFixed(1)} dBm (margen ${margin_opt.toFixed(1)} dB, por debajo de los 10 dB recomendados). Además, ${users} usuarios superan el límite de ${max_users} por AP. Throughput efectivo: ${per_user.toFixed(2)} Mbps/usuario (necesario: ${bw_user} Mbps). Se requieren ${aps} APs.`;
  } else if (!coverage_good) {
    cls = 'v-warn';
    title = 'Señal marginal — conexión inestable';
    body = `Señal de ${pr.toFixed(1)} dBm con margen ${margin_opt.toFixed(1)} dB (mínimo recomendado: 10 dB). La conexión puede interrumpirse por interferencias. Recomendación: acercar el AP o reducir obstáculos.`;
  } else if (!capacity_ok) {
    cls = 'v-warn';
    title = 'Cobertura OK — capacidad insuficiente';
    body = `Señal excelente (${pr.toFixed(1)} dBm, margen +${margin_opt.toFixed(1)} dB). Sin embargo, ${users} usuarios superan el límite de ${max_users} por AP. Throughput por usuario: ${per_user.toFixed(2)} Mbps vs. ${bw_user} Mbps requeridos. Demanda total: ${demand.toFixed(0)} Mbps → se necesitan ${aps} APs. La limitación es de CAPACIDAD, no de cobertura.`;
  } else {
    cls = 'v-ok';
    title = 'Red óptima para este escenario';
    body = `Señal: ${pr.toFixed(1)} dBm (margen +${margin_opt.toFixed(1)} dB) · ${users} usuarios dentro del límite de ${max_users} por AP · Throughput por usuario: ${per_user.toFixed(2)} Mbps. Todos los parámetros dentro de rangos operativos.`;
  }

  el.className = 'verdict ' + cls;
  el.innerHTML = `<div class="verdict-title">${title}</div><div class="verdict-body">${body}</div>`;
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initControls();
  // Draw empty floor map on load
  drawFloorMap(0, 15, 50);
  // Auto-run with defaults
  runSimulation();
});
