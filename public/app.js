// ── Sport map ────────────────────────────────────────────────────────────────
const SPORTS = {
  0:'Running',1:'Cycling',16:'Baseball',17:'Basketball',18:'Rowing',
  19:'Fencing',20:'Field Hockey',21:'Football',22:'Golf',24:'Ice Hockey',
  25:'Lacrosse',27:'Rugby',28:'Sailing',29:'Skiing',30:'Soccer',
  31:'Softball',32:'Squash',33:'Swimming',34:'Tennis',35:'Track & Field',
  36:'Volleyball',37:'Water Polo',38:'Wrestling',39:'Boxing',42:'Dance',
  43:'Pilates',44:'Yoga',45:'Weightlifting',47:'Cross Country Skiing',
  48:'Functional Fitness',49:'Duathlon',51:'Gymnastics',52:'Hiking',
  53:'Horseback Riding',55:'Kayaking',56:'Martial Arts',57:'Mountain Biking',
  59:'Paddleboarding',60:'Racquetball',61:'Rock Climbing',62:'Rowing Machine',
  63:'Spinning',64:'Stairmaster',65:'Surfing',66:'Triathlon',
  71:'Obstacle Racing',72:'Meditation',73:'Other',74:'Diving',
  82:'Pickleball',85:'HIIT',86:'Elliptical',87:'Treadmill',
};

// ── Chart registry (destroy before re-create on refresh) ─────────────────────
const charts = {};

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  green:  '#00e5c0',
  blue:   '#4a9eff',
  purple: '#a855f7',
  amber:  '#f59e0b',
  red:    '#ff4d6d',
  muted:  '#5a6278',
};

const TT = {
  backgroundColor: '#1a1f2a',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function sportName(id) { return SPORTS[id] || ('Sport ' + id); }
function fmt(n, d) { d = d == null ? 1 : d; return n == null ? '—' : Number(n).toFixed(d); }
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function msToHours(ms) {
  if (ms == null || ms <= 0) return '—';
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  return h + 'h ' + m + 'm';
}
function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// ── Ring animation ────────────────────────────────────────────────────────────
function setRing(ringId, value, max) {
  var el = document.getElementById(ringId);
  if (!el || value == null) return;
  var filled = clamp(value / max, 0, 1);
  el.style.strokeDashoffset = 201 - filled * 201;
}

// ── Mini progress bars ────────────────────────────────────────────────────────
function setBar(id, pct) {
  var el = document.getElementById(id);
  if (el) el.style.width = clamp(pct, 0, 100) + '%';
}

// ── Tab switching (called from HTML onclick) ──────────────────────────────────
function switchPanel(id, el) {
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.page-tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('panel-' + id).classList.add('active');
  el.classList.add('active');
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
function makeChart(id, config) {
  var canvas = document.getElementById(id);
  if (!canvas || typeof Chart === 'undefined') return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(canvas.getContext('2d'), config);
}

function lineOpts(unit, min, max) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: Object.assign({}, TT, { callbacks: { label: function(c) { return ' ' + c.raw + unit; } } }),
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: C.muted } },
      y: Object.assign(
        { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: C.muted, callback: function(v) { return v + unit; } } },
        min != null ? { min: min } : {},
        max != null ? { max: max } : {}
      ),
    },
  };
}

function barOpts(unit, min, max) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: Object.assign({}, TT, { callbacks: { label: function(c) { return ' ' + c.raw + unit; } } }),
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: C.muted, maxRotation: 0 } },
      y: Object.assign(
        { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: C.muted, callback: function(v) { return v + unit; } } },
        min != null ? { min: min } : {},
        max != null ? { max: max } : {}
      ),
    },
  };
}

function dayLabels(records) {
  var names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return records.map(function(r) {
    var d = new Date(r.updated_at || r.created_at || r.start || '');
    return isNaN(d.getTime()) ? '?' : names[d.getDay()];
  });
}

function dateLabels(records) {
  return records.map(function(r) {
    var d = new Date(r.updated_at || r.created_at || r.start || '');
    if (isNaN(d.getTime())) return '?';
    return (d.getMonth() + 1) + '/' + d.getDate();
  });
}

function safeRecords(result) {
  return result.status === 'fulfilled' && !result.value?.error
    ? (result.value?.records || [])
    : [];
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = C.muted;
    Chart.defaults.font.family = "'Space Grotesk', sans-serif";
    Chart.defaults.font.size = 11;
  }

  const btn = document.getElementById('btn-refresh');
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }

  let profile;
  try {
    const res = await fetch('/api/profile');
    if (res.status === 401) { showLoginScreen(); return; }
    profile = await res.json();
  } catch {
    showLoginScreen();
    return;
  }

  showDashboard(profile);

  const [recovery, cycle, sleep, workouts, sleepHistory, body] = await Promise.allSettled([
    fetch('/api/recovery').then(r => r.json()),
    fetch('/api/cycle').then(r => r.json()),
    fetch('/api/sleep').then(r => r.json()),
    fetch('/api/workouts').then(r => r.json()),
    fetch('/api/sleep-history').then(r => r.json()),
    fetch('/api/body').then(r => r.json()),
  ]);

  renderOverview(recovery, cycle, sleep, sleepHistory);
  renderHistory(recovery, sleepHistory);
  renderWorkouts(workouts);
  renderProfile(profile, body);

  setText('sync-time', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
}

function showDashboard(profile) {
  document.getElementById('dashboard').classList.remove('hidden');
  if (profile && profile.first_name) {
    const name = (profile.first_name + ' ' + (profile.last_name || '')).trim();
    setText('user-name', name);
    const initials = (profile.first_name[0] + (profile.last_name ? profile.last_name[0] : '')).toUpperCase();
    setText('user-avatar', initials);
  }
}

// ── Overview ──────────────────────────────────────────────────────────────────
function renderOverview(recoveryResult, cycleResult, sleepResult, sleepHistoryResult) {
  const recRecords = safeRecords(recoveryResult);
  const latest = recRecords[0];

  // Recovery ring + sub-label
  const score = latest && latest.score ? latest.score.recovery_score : null;
  setText('val-recovery', score != null ? Math.round(score) + '%' : '—');
  setText('sub-recovery', score != null
    ? (score >= 67 ? '🟢 Well recovered' : score >= 34 ? '🟡 Moderate' : '🔴 Rest today')
    : 'No data');
  if (score != null) setTimeout(function() { setRing('ring-recovery', score, 100); }, 100);

  // Biometrics from latest recovery record
  const sc       = (latest && latest.score) || {};
  const hrv      = sc.hrv_rmssd_milli;
  const rhr      = sc.resting_heart_rate;
  const spo2     = sc.spo2_percentage;
  const skinTemp = sc.skin_temp_celsius;

  setText('val-hrv',       hrv      != null ? Math.round(hrv)         : '—');
  setText('val-rhr',       rhr      != null ? Math.round(rhr)         : '—');
  setText('val-spo2',      spo2     != null ? fmt(spo2, 1)            : '—');
  setText('val-skin-temp', skinTemp != null ? (skinTemp > 0 ? '+' : '') + fmt(skinTemp, 2) : '—');

  if (hrv  != null) setBar('bar-hrv',  clamp(hrv / 100 * 100, 0, 100));
  if (rhr  != null) setBar('bar-rhr',  clamp((80 - rhr) / 40 * 100, 0, 100));
  if (spo2 != null) setBar('bar-spo2', clamp((spo2 - 85) / 15 * 100, 0, 100));

  // Cycle — strain + calories
  const cycleRecords = safeRecords(cycleResult);
  const latestCycle  = cycleRecords[0];
  const csc    = (latestCycle && latestCycle.score) || {};
  const strain = csc.strain;
  const kcal   = csc.kilojoule != null ? Math.round(csc.kilojoule / 4.184) : null;

  setText('val-strain',   strain != null ? fmt(strain, 1)              : '—');
  setText('val-calories', kcal   != null ? kcal.toLocaleString()       : '—');
  if (strain != null) setTimeout(function() { setRing('ring-strain', strain, 21); }, 200);
  if (kcal   != null) setBar('bar-calories', clamp(kcal / 4000 * 100, 0, 100));

  // Sleep
  const sleepRecords = safeRecords(sleepResult);
  const latestSleep  = sleepRecords[0];
  const ssc       = (latestSleep && latestSleep.score) || {};
  const stages    = ssc.stage_summary || {};
  const perf      = ssc.sleep_performance_percentage;
  const respRate  = ssc.respiratory_rate;
  const durMs     = stages.total_in_bed_time_milli;

  setText('val-sleep-perf',   perf     != null ? Math.round(perf) + '%' : '—');
  setText('sub-sleep',        durMs    != null ? msToHours(durMs) + ' in bed' : 'No data');
  setText('val-resp',         respRate != null ? fmt(respRate, 1)        : '—');
  setText('sleep-total-badge', durMs   != null ? msToHours(durMs) + ' total' : '— total');

  if (perf     != null) setTimeout(function() { setRing('ring-sleep', perf, 100); }, 300);
  if (respRate != null) setBar('bar-resp', clamp((20 - respRate) / 8 * 100, 0, 100));

  // Sleep efficiency, consistency, cycles, disturbances
  setText('val-sleep-eff', ssc.sleep_efficiency_percentage != null ? Math.round(ssc.sleep_efficiency_percentage) + '%' : '—');
  setText('val-sleep-cons', ssc.sleep_consistency_percentage != null ? Math.round(ssc.sleep_consistency_percentage) + '%' : '—');
  setText('val-sleep-cycles', stages.sleep_cycle_count != null ? stages.sleep_cycle_count : '—');
  setText('val-disturbances', stages.disturbance_count != null ? stages.disturbance_count : '—');

  // Sleep need breakdown
  var sleepNeeded = ssc.sleep_needed || {};
  var totalNeededMs = (sleepNeeded.baseline_milli || 0)
    + (sleepNeeded.need_from_sleep_debt_milli || 0)
    + (sleepNeeded.need_from_recent_strain_milli || 0)
    - (sleepNeeded.need_from_recent_nap_milli || 0);
  var actualMs = stages.total_in_bed_time_milli || 0;
  if (totalNeededMs > 0) {
    var pct = Math.min(100, (actualMs / totalNeededMs) * 100);
    var needBar = document.getElementById('sleep-need-bar');
    if (needBar) needBar.style.width = pct + '%';
    setText('sleep-need-values', 'needed ' + msToHours(totalNeededMs) + ' · got ' + msToHours(actualMs));
  }

  renderSleepStages(ssc.stage_summary);
  renderCharts(recRecords, sleepHistoryResult);
}

function renderSleepStages(stages) {
  if (!stages) return;
  const total = stages.total_in_bed_time_milli || 1;
  const data = [
    { ms: stages.total_awake_time_milli           || 0, color: '#1e2535', label: 'Awake' },
    { ms: stages.total_light_sleep_time_milli     || 0, color: '#5a3d8a', label: 'Light' },
    { ms: stages.total_slow_wave_sleep_time_milli || 0, color: '#2d5aa8', label: 'Deep'  },
    { ms: stages.total_rem_sleep_time_milli       || 0, color: '#8b5cf6', label: 'REM'   },
  ].filter(s => s.ms > 0);

  const bar    = document.getElementById('sleep-stages-bar');
  const legend = document.getElementById('sleep-stages-legend');

  if (bar) {
    bar.innerHTML = data.map(s => {
      const pct = (s.ms / total * 100).toFixed(1);
      return '<div class="sleep-stage-seg" style="flex:' + pct + ';background:' + s.color + '" title="' + s.label + ' ' + msToHours(s.ms) + '"></div>';
    }).join('');
  }

  if (legend) {
    legend.innerHTML = data.map(s =>
      '<div class="legend-item"><div class="legend-dot" style="background:' + s.color + '"></div>' + s.label + ' ' + msToHours(s.ms) + '</div>'
    ).join('');
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────
function renderCharts(recRecords, sleepHistoryResult) {
  if (typeof Chart === 'undefined') return;

  const asc    = recRecords.slice().reverse();
  const last7  = asc.slice(-7);
  const last14 = asc.slice(-14);

  // HRV 7-day
  makeChart('chart-hrv', {
    type: 'line',
    data: {
      labels: dayLabels(last7),
      datasets: [{
        data: last7.map(r => r.score && r.score.hrv_rmssd_milli != null ? Math.round(r.score.hrv_rmssd_milli) : null),
        borderColor: C.green,
        backgroundColor: 'rgba(0,229,192,0.08)',
        borderWidth: 2, pointRadius: 4,
        pointBackgroundColor: C.green, pointBorderColor: 'transparent',
        tension: 0.4, fill: true, spanGaps: true,
      }],
    },
    options: lineOpts(' ms', 20, null),
  });

  // RHR 7-day
  makeChart('chart-rhr', {
    type: 'line',
    data: {
      labels: dayLabels(last7),
      datasets: [{
        data: last7.map(r => r.score && r.score.resting_heart_rate != null ? Math.round(r.score.resting_heart_rate) : null),
        borderColor: C.blue,
        backgroundColor: 'rgba(74,158,255,0.08)',
        borderWidth: 2, pointRadius: 4,
        pointBackgroundColor: C.blue, pointBorderColor: 'transparent',
        tension: 0.4, fill: true, spanGaps: true,
      }],
    },
    options: lineOpts(' bpm', 30, 90),
  });

  // Recovery 30-day bar
  const recScores = asc.map(r => r.score && r.score.recovery_score != null ? Math.round(r.score.recovery_score) : null);
  makeChart('chart-recovery', {
    type: 'bar',
    data: {
      labels: dateLabels(asc),
      datasets: [{
        data: recScores,
        backgroundColor: recScores.map(v =>
          v == null ? 'transparent' : v >= 67 ? 'rgba(0,229,192,0.7)' : v >= 34 ? 'rgba(245,158,11,0.6)' : 'rgba(255,77,109,0.6)'
        ),
        borderRadius: 3, borderWidth: 0,
      }],
    },
    options: barOpts('%', 0, 100),
  });

  // SpO2 7-day
  makeChart('chart-spo2', {
    type: 'line',
    data: {
      labels: dayLabels(last7),
      datasets: [{
        data: last7.map(r => r.score && r.score.spo2_percentage != null ? +Number(r.score.spo2_percentage).toFixed(1) : null),
        borderColor: C.blue,
        backgroundColor: 'rgba(74,158,255,0.08)',
        borderWidth: 2, pointRadius: 4,
        pointBackgroundColor: C.blue, pointBorderColor: 'transparent',
        tension: 0.4, fill: true, spanGaps: true,
      }],
    },
    options: lineOpts('%', 90, 100),
  });

  // Skin temp 14-day bar
  const skinData = last14.map(r => r.score && r.score.skin_temp_celsius != null ? +Number(r.score.skin_temp_celsius).toFixed(2) : null);
  makeChart('chart-skin-temp', {
    type: 'bar',
    data: {
      labels: dateLabels(last14),
      datasets: [{
        data: skinData,
        backgroundColor: skinData.map(v =>
          v == null ? 'transparent' : v > 0.5 ? 'rgba(255,77,109,0.7)' : v > 0 ? 'rgba(245,158,11,0.55)' : 'rgba(74,158,255,0.55)'
        ),
        borderRadius: 4, borderWidth: 0,
      }],
    },
    options: barOpts('°C'),
  });

  // Sleep performance 7-day bar (from sleep-history)
  const sleepRecs = safeRecords(sleepHistoryResult);
  const sleepAsc  = sleepRecs.slice().reverse().slice(-7);
  const sleepPerf = sleepAsc.map(r => r.score && r.score.sleep_performance_percentage != null ? Math.round(r.score.sleep_performance_percentage) : null);

  makeChart('chart-sleep', {
    type: 'bar',
    data: {
      labels: sleepAsc.length ? dayLabels(sleepAsc) : ['No data'],
      datasets: [{
        data: sleepPerf.length ? sleepPerf : [null],
        backgroundColor: sleepPerf.map(v =>
          v == null ? 'transparent' : v >= 85 ? 'rgba(139,92,246,0.75)' : v >= 70 ? 'rgba(139,92,246,0.45)' : 'rgba(139,92,246,0.2)'
        ),
        borderRadius: 4, borderWidth: 0, spanGaps: true,
      }],
    },
    options: barOpts('%', 0, 100),
  });
}

// ── History ───────────────────────────────────────────────────────────────────
function renderHistory(recoveryResult, sleepHistoryResult) {
  const recRecords   = safeRecords(recoveryResult);
  const sleepRecords = safeRecords(sleepHistoryResult);

  const recBody = document.getElementById('recovery-history-body');
  if (recBody) {
    if (!recRecords.length) {
      recBody.innerHTML = '<tr><td colspan="7" class="empty-row">No recovery history available</td></tr>';
    } else {
      recBody.innerHTML = recRecords.map(function(r) {
        const s     = r.score || {};
        const score = s.recovery_score != null ? Math.round(s.recovery_score) : null;
        const cls   = score != null ? (score >= 67 ? 'badge-green' : score >= 34 ? 'badge-amber' : 'badge-red') : '';
        const zone  = score != null ? (score >= 67 ? 'Green' : score >= 34 ? 'Yellow' : 'Red') : '—';
        return '<tr>'
          + '<td>' + fmtDate(r.updated_at || r.created_at) + '</td>'
          + '<td class="' + cls + '">' + (score != null ? score + '%' : '—') + '</td>'
          + '<td class="' + cls + '">' + zone + '</td>'
          + '<td>' + (s.hrv_rmssd_milli != null ? Math.round(s.hrv_rmssd_milli) : '—') + '</td>'
          + '<td>' + (s.resting_heart_rate != null ? Math.round(s.resting_heart_rate) + ' bpm' : '—') + '</td>'
          + '<td>' + (s.spo2_percentage != null ? fmt(s.spo2_percentage, 1) + '%' : '—') + '</td>'
          + '<td>' + (s.skin_temp_celsius != null ? (s.skin_temp_celsius > 0 ? '+' : '') + fmt(s.skin_temp_celsius, 2) + '°C' : '—') + '</td>'
          + '</tr>';
      }).join('');
    }
  }

  const sleepBody = document.getElementById('sleep-history-body');
  if (sleepBody) {
    if (!sleepRecords.length) {
      sleepBody.innerHTML = '<tr><td colspan="8" class="empty-row">No sleep history available</td></tr>';
    } else {
      sleepBody.innerHTML = sleepRecords.map(function(r) {
        const s      = r.score || {};
        const stages = s.stage_summary || {};
        const perf   = s.sleep_performance_percentage;
        return '<tr>'
          + '<td>' + fmtDate(r.start) + '</td>'
          + '<td>' + (perf != null ? Math.round(perf) + '%' : '—') + '</td>'
          + '<td>' + (s.sleep_efficiency_percentage != null ? Math.round(s.sleep_efficiency_percentage) + '%' : '—') + '</td>'
          + '<td>' + (s.sleep_consistency_percentage != null ? Math.round(s.sleep_consistency_percentage) + '%' : '—') + '</td>'
          + '<td>' + msToHours(stages.total_in_bed_time_milli) + '</td>'
          + '<td>' + msToHours(stages.total_slow_wave_sleep_time_milli) + '</td>'
          + '<td>' + msToHours(stages.total_rem_sleep_time_milli) + '</td>'
          + '<td>' + (stages.disturbance_count != null ? stages.disturbance_count : '—') + '</td>'
          + '</tr>';
      }).join('');
    }
  }
}

// ── Workouts ──────────────────────────────────────────────────────────────────
function renderWorkouts(result) {
  const tbody = document.getElementById('workouts-body');
  if (!tbody) return;

  const records = safeRecords(result);

  // Zone bars for most recent workout
  var latest = records[0];
  var zonesEl = document.getElementById('hr-zones-bars');
  var zonesLabel = document.getElementById('zones-workout-label');
  if (zonesEl && latest) {
    var zd = (latest.score && latest.score.zone_durations) || {};
    var zones = [
      { label: 'Zone 0', ms: zd.zone_zero_milli  || 0, color: '#334155' },
      { label: 'Zone 1', ms: zd.zone_one_milli   || 0, color: '#1d4ed8' },
      { label: 'Zone 2', ms: zd.zone_two_milli   || 0, color: '#065f46' },
      { label: 'Zone 3', ms: zd.zone_three_milli || 0, color: '#92400e' },
      { label: 'Zone 4', ms: zd.zone_four_milli  || 0, color: '#7f1d1d' },
      { label: 'Zone 5', ms: zd.zone_five_milli  || 0, color: '#4c0519' },
    ];
    var totalMs = zones.reduce(function(s, z) { return s + z.ms; }, 0) || 1;
    zonesEl.innerHTML = zones.map(function(z) {
      var pct = (z.ms / totalMs * 100).toFixed(1);
      var labelColor = z.color === '#334155' ? '#94a3b8' : z.color;
      return '<div class="zone-row">'
        + '<div class="zone-label" style="color:' + labelColor + '">' + z.label + '</div>'
        + '<div class="zone-bar-bg"><div class="zone-bar" style="width:' + pct + '%;background:' + z.color + '"></div></div>'
        + '<div class="zone-time">' + msToHours(z.ms) + '</div>'
        + '</div>';
    }).join('');
    if (zonesLabel) zonesLabel.textContent = (latest.sport_name || sportName(latest.sport_id)) + ' · Strain ' + (latest.score && latest.score.strain != null ? fmt(latest.score.strain, 1) : '—');
  }

  if (!records.length) {
    const isErr = result.status === 'rejected' || (result.value && result.value.error);
    tbody.innerHTML = '<tr><td colspan="7" class="' + (isErr ? 'error-row' : 'empty-row') + '">'
      + (isErr ? 'Workout data unavailable' : 'No recent workouts found') + '</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(function(w) {
    const s    = w.score || {};
    const dur  = w.end && w.start ? msToHours(new Date(w.end) - new Date(w.start)) : '—';
    const kcal = s.kilojoule != null ? Math.round(s.kilojoule / 4.184) : null;
    return '<tr>'
      + '<td>' + fmtDate(w.start) + '</td>'
      + '<td>' + (w.sport_name || sportName(w.sport_id)) + '</td>'
      + '<td>' + (s.strain != null ? fmt(s.strain, 1) : '—') + '</td>'
      + '<td>' + dur + '</td>'
      + '<td>' + (s.average_heart_rate != null ? Math.round(s.average_heart_rate) + ' bpm' : '—') + '</td>'
      + '<td>' + (s.max_heart_rate != null ? Math.round(s.max_heart_rate) + ' bpm' : '—') + '</td>'
      + '<td>' + (kcal != null ? kcal.toLocaleString() + ' kcal' : '—') + '</td>'
      + '</tr>';
  }).join('');
}

// ── Profile ───────────────────────────────────────────────────────────────────
function renderProfile(profile, bodyResult) {
  var initials = profile && profile.first_name
    ? (profile.first_name[0] + (profile.last_name ? profile.last_name[0] : '')).toUpperCase()
    : '?';
  setText('profile-avatar-lg', initials);
  setText('profile-full-name', profile && profile.first_name
    ? (profile.first_name + ' ' + (profile.last_name || '')).trim()
    : '—');
  setText('profile-email', (profile && profile.email) || '—');

  var body = bodyResult && bodyResult.status === 'fulfilled' && !bodyResult.value.error
    ? bodyResult.value : null;
  if (body) {
    setText('stat-height', body.height_meter ? Math.round(body.height_meter * 100) : '—');
    setText('stat-weight', body.weight_kilogram ? Number(body.weight_kilogram).toFixed(1) : '—');
    setText('stat-max-hr', body.max_heart_rate || '—');
  }
}

// ── Refresh button ────────────────────────────────────────────────────────────
var refreshBtn = document.getElementById('btn-refresh');
if (refreshBtn) {
  refreshBtn.addEventListener('click', function() {
    Object.values(charts).forEach(function(c) { c.destroy(); });
    Object.keys(charts).forEach(function(k) { delete charts[k]; });
    init();
  });
}

init();
