// Sport ID → human label (common Whoop sport IDs)
const SPORTS = {
  0: 'Running', 1: 'Cycling', 16: 'Baseball', 17: 'Basketball',
  18: 'Rowing', 19: 'Fencing', 20: 'Field Hockey', 21: 'Football',
  22: 'Golf', 24: 'Ice Hockey', 25: 'Lacrosse', 27: 'Rugby',
  28: 'Sailing', 29: 'Skiing', 30: 'Soccer', 31: 'Softball',
  32: 'Squash', 33: 'Swimming', 34: 'Tennis', 35: 'Track & Field',
  36: 'Volleyball', 37: 'Water Polo', 38: 'Wrestling', 39: 'Boxing',
  42: 'Dance', 43: 'Pilates', 44: 'Yoga', 45: 'Weightlifting',
  47: 'Cross Country Skiing', 48: 'Functional Fitness', 49: 'Duathlon',
  51: 'Gymnastics', 52: 'Hiking', 53: 'Horseback Riding',
  55: 'Kayaking', 56: 'Martial Arts', 57: 'Mountain Biking',
  59: 'Paddleboarding', 60: 'Racquetball', 61: 'Rock Climbing',
  62: 'Rowing Machine', 63: 'Spinning', 64: 'Stairmaster',
  65: 'Surfing', 66: 'Triathlon', 71: 'Obstacle Racing',
  72: 'Meditation', 73: 'Other', 74: 'Diving', 75: 'Operations',
  76: 'Softball', 82: 'Pickleball', 84: 'Esports',
  85: 'HIIT', 86: 'Elliptical', 87: 'Treadmill',
};

function sportName(id) {
  return SPORTS[id] || `Sport ${id}`;
}

function fmt(n, digits = 1) {
  if (n == null) return '—';
  return Number(n).toFixed(digits);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function msToHours(ms) {
  if (ms == null) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showError(id, label) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = 'N/A';
    el.style.color = 'var(--muted)';
  }
  const sub = document.getElementById('sub-' + id.replace('val-', ''));
  if (sub) sub.textContent = label + ' unavailable';
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  // Check auth
  let profile;
  try {
    const res = await fetch('/api/profile');
    if (res.status === 401) {
      showLoginScreen();
      return;
    }
    profile = await res.json();
  } catch {
    showLoginScreen();
    return;
  }

  showDashboard(profile);

  // Fetch all data in parallel
  const [recovery, cycle, sleep, workouts] = await Promise.allSettled([
    fetch('/api/recovery').then(r => r.json()),
    fetch('/api/cycle').then(r => r.json()),
    fetch('/api/sleep').then(r => r.json()),
    fetch('/api/workouts').then(r => r.json()),
  ]);

  renderRecovery(recovery);
  renderCycle(cycle);
  renderSleep(sleep);
  renderWorkouts(workouts);
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
}

function showDashboard(profile) {
  document.getElementById('dashboard').classList.remove('hidden');
  if (profile && profile.first_name) {
    setText('user-name', `${profile.first_name} ${profile.last_name || ''}`.trim());
  }
}

// ── Render functions ─────────────────────────────────────────────────────────

function renderRecovery(result) {
  if (result.status === 'rejected' || result.value?.error) {
    showError('val-recovery', 'Recovery');
    return;
  }
  const records = result.value?.records || [];
  const latest = records[0];
  if (!latest) { showError('val-recovery', 'Recovery'); return; }

  const score = latest.score?.recovery_score;
  const hrv   = latest.score?.hrv_rmssd_milli;
  const rhr   = latest.score?.resting_heart_rate;

  setText('val-recovery', score != null ? `${Math.round(score)}%` : '—');
  setText('sub-recovery', score != null
    ? (score >= 67 ? 'Optimal' : score >= 34 ? 'Moderate' : 'Low')
    : '');

  const card = document.getElementById('card-recovery');
  if (score != null) {
    card.classList.add(score >= 67 ? 'recovery-green' : score >= 34 ? 'recovery-amber' : 'recovery-red');
  }

  // HRV card
  setText('val-hrv', hrv != null ? `${Math.round(hrv)}` : '—');
  const hrvSub = document.getElementById('sub-rhr');
  if (hrvSub) hrvSub.textContent = rhr != null ? `Resting HR: ${Math.round(rhr)} bpm` : 'Resting HR: —';
  const hrvUnit = document.createElement('span');
  hrvUnit.style.cssText = 'font-size:1rem;font-weight:400;color:var(--muted);margin-left:4px';
  hrvUnit.textContent = 'ms';
  const hrvVal = document.getElementById('val-hrv');
  if (hrvVal && hrv != null) hrvVal.appendChild(hrvUnit);
}

function renderCycle(result) {
  if (result.status === 'rejected' || result.value?.error) {
    showError('val-strain', 'Strain');
    return;
  }
  const records = result.value?.records || [];
  const latest = records[0];
  if (!latest) { showError('val-strain', 'Strain'); return; }
  const strain = latest.score?.strain;
  setText('val-strain', strain != null ? fmt(strain) : '—');
}

function renderSleep(result) {
  if (result.status === 'rejected' || result.value?.error) {
    showError('val-sleep-perf', 'Sleep');
    return;
  }
  const records = result.value?.records || [];
  const latest = records[0];
  if (!latest) { showError('val-sleep-perf', 'Sleep'); return; }

  const perf  = latest.score?.sleep_performance_percentage;
  const durMs = latest.score?.stage_summary?.total_in_bed_time_milli;

  setText('val-sleep-perf', perf != null ? `${Math.round(perf)}%` : '—');
  setText('sub-sleep', durMs != null ? msToHours(durMs) + ' in bed' : '');
}

function renderWorkouts(result) {
  const tbody = document.getElementById('workouts-body');
  if (result.status === 'rejected' || result.value?.error) {
    tbody.innerHTML = '<tr><td colspan="4" class="error-row">Workout data unavailable</td></tr>';
    return;
  }
  const records = result.value?.records || [];
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-row">No recent workouts</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(w => {
    const strain = w.score?.strain != null ? fmt(w.score.strain) : '—';
    const avgHr  = w.score?.average_heart_rate != null ? `${Math.round(w.score.average_heart_rate)} bpm` : '—';
    const date   = fmtDate(w.start);
    const sport  = sportName(w.sport_id);
    return `<tr>
      <td>${date}</td>
      <td>${sport}</td>
      <td>${strain}</td>
      <td>${avgHr}</td>
    </tr>`;
  }).join('');
}

init();
