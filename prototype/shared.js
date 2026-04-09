// ============================================================
// SHARED DATA
// ============================================================
const GROUPS = [
  { id: 1, name: 'Weekend Warriors', code: '28451', emoji: '⚔️', color: '#0F5132', members: 8, upcoming: 3 },
  { id: 2, name: 'Bay Area Golf Club', code: '10392', emoji: '🌉', color: '#3B82F6', members: 15, upcoming: 5 },
  { id: 3, name: 'Office Crew', code: '77204', emoji: '🏢', color: '#8B5CF6', members: 6, upcoming: 1 },
  { id: 4, name: 'Sunday Skins Game', code: '55018', emoji: '💰', color: '#D4A843', members: 12, upcoming: 2 },
];

let currentGroupId = 1;

const MEMBERS = [
  { name: 'Mike C.', initials: 'MC', color: '#0F5132' },
  { name: 'Jason L.', initials: 'JL', color: '#3B82F6' },
  { name: 'David W.', initials: 'DW', color: '#D4A843' },
  { name: 'Tommy K.', initials: 'TK', color: '#E04545' },
  { name: 'Ryan P.', initials: 'RP', color: '#8B5CF6' },
  { name: 'Chris H.', initials: 'CH', color: '#06B6D4' },
  { name: 'Alex T.', initials: 'AT', color: '#EC4899' },
  { name: 'Sam N.', initials: 'SN', color: '#F97316' },
];

const TEE_TIMES = [
  {
    id: 1, date: '2026-04-05', time: '6:45 AM', course: 'Torrey Pines South',
    status: 'completed', players: [0,1,2,3],
    waitlist: [], price: '$180', maxPlayers: 4
  },
  {
    id: 2, date: '2026-04-11', time: '7:30 AM', course: 'Torrey Pines South',
    status: 'upcoming', players: [0,1,2],
    waitlist: [4], price: '$180', maxPlayers: 4
  },
  {
    id: 3, date: '2026-04-11', time: '1:00 PM', course: 'Riviera CC',
    status: 'upcoming', players: [3,5,6,7],
    waitlist: [], price: '$250', maxPlayers: 4
  },
  {
    id: 4, date: '2026-04-18', time: '8:00 AM', course: 'Pebble Beach',
    status: 'upcoming', players: [0,2],
    waitlist: [], price: '$575', maxPlayers: 4
  },
  {
    id: 5, date: '2026-04-20', time: '7:00 AM', course: 'Pebble Beach',
    status: 'upcoming', players: [0,1,2,3],
    waitlist: [4,5,6], price: '$575', maxPlayers: 4
  },
  {
    id: 6, date: '2026-04-08', time: '9:00 AM', course: 'Torrey Pines North',
    status: 'in_progress', players: [3,5,6,7],
    waitlist: [], price: '$150', maxPlayers: 4
  },
  {
    id: 7, date: '2026-04-13', time: '2:00 PM', course: 'Riviera CC',
    status: 'upcoming', players: [1,3,5,7],
    waitlist: [], price: '$250', maxPlayers: 4
  },
];

// Scorecard data: par for Torrey Pines South
const COURSE_PAR = [4,4,3,4,5,4,4,3,5, 4,4,3,4,5,4,4,3,5]; // par 72
const PLAYER_SCORES = {
  0: [4,5,3,4,4,4,5,3,5, 4,4,2,5,5,4,3,3,6], // Mike: 73
  1: [4,4,3,5,5,3,4,4,5, 5,4,3,4,6,4,4,3,5], // Jason: 75
  2: [5,4,4,4,5,4,4,3,4, 4,5,3,4,5,5,4,2,5], // David: 74
  3: [4,5,3,5,6,4,4,2,5, 5,4,3,5,5,4,5,3,5], // Tommy: 77
};

// My index (current user)
const MY_INDEX = 0;

// Mock scores for completed tee times
const COMPLETED_SCORES = {
  1: { 0: '+1', 1: '+3', 2: '+2', 3: '+5' },
};

// Mock hole progress for in-progress tee times
const IN_PROGRESS_HOLES = {
  6: [
    'par','birdie','par','par','par','par','birdie','par','par',
    'par','par',null,null,null,null,null,null,null
  ],
};

// Chat data
const TEE_TIME_CHAT = [
  { pi: 1, text: 'Should we get carts or walk?', time: '2d ago' },
  { pi: 0, text: 'Cart is included in the price 👍', time: '2d ago' },
  { pi: 2, text: "Nice, I'll bring the speaker", time: '1d ago' },
  { pi: 3, text: "Let's meet at the clubhouse at 7:00", time: '3h ago' },
];

const ROUND_COMMENTS = [
  { pi: 1, text: 'Great round today guys! The weather was perfect ☀️', time: '30m ago' },
  { pi: 0, text: 'David was on fire on the back nine', time: '25m ago' },
];

const HOLE_COMMENTS = {
  2: [
    { pi: 1, text: 'Almost aced it! Ball was 2 inches from the pin 😱', time: '1h ago' },
    { pi: 0, text: 'That was insane, we all thought it went in', time: '1h ago' },
  ],
  4: [
    { pi: 2, text: 'Eagle! Best shot I have ever hit on this hole 🦅', time: '45m ago' },
    { pi: 3, text: "David you're on fire today", time: '44m ago' },
    { pi: 0, text: 'Driver was absolutely pure', time: '43m ago' },
  ],
  12: [
    { pi: 3, text: 'Lost my ball in the canyon again...', time: '20m ago' },
    { pi: 1, text: '😂 same spot as last time', time: '19m ago' },
  ],
};

// ============================================================
// NAVIGATION — page-based
// ============================================================
function navigate(page, data) {
  const params = data !== undefined ? `?id=${data}` : '';
  switch (page) {
    case 'group':       location.href = 'index.html'; break;
    case 'tee-detail':  location.href = `tee-detail.html${params}`; break;
    case 'scorecard':   location.href = `scorecard.html${params}`; break;
    case 'comments':    location.href = `comments.html${params}`; break;
    case 'create-tee-time': location.href = 'create-tee-time.html'; break;
    case 'create-course':   location.href = 'create-course.html'; break;
    case 'member-stats':    location.href = `member-stats.html${params}`; break;
  }
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// ============================================================
// TOAST
// ============================================================
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================================
// DRAWER
// ============================================================
function openDrawer() {
  document.getElementById('drawerOverlay').classList.add('show');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('show');
  document.getElementById('drawer').classList.remove('open');
}

// ============================================================
// GROUP SWITCHER
// ============================================================
function renderGroupDropdown() {
  const list = document.getElementById('groupDropdownList');
  list.innerHTML = GROUPS.map(g => `
    <button class="group-dropdown-item${g.id === currentGroupId ? ' active' : ''}"
            onclick="event.stopPropagation(); switchGroup(${g.id})">
      <div class="group-icon" style="background: ${g.color}15; color: ${g.color};">${g.emoji}</div>
      <div class="group-detail">
        <div class="group-name">${g.name}</div>
        <div class="group-meta">#${g.code} · ${g.members} members · ${g.upcoming} upcoming</div>
      </div>
      <div class="group-check">✓</div>
    </button>
  `).join('');
}

function toggleGroupDropdown(e) {
  e.stopPropagation();
  const switcher = document.getElementById('groupSwitcher');
  const dropdown = document.getElementById('groupDropdown');
  const overlay = document.getElementById('dropdownOverlay');
  const isOpen = dropdown.classList.contains('show');

  if (isOpen) {
    closeGroupDropdown();
  } else {
    dropdown.classList.add('show');
    switcher.classList.add('open');
    overlay.classList.add('show');
    renderGroupDropdown();
  }
}

function closeGroupDropdown() {
  document.getElementById('groupDropdown').classList.remove('show');
  document.getElementById('groupSwitcher').classList.remove('open');
  document.getElementById('dropdownOverlay').classList.remove('show');
}

function switchGroup(groupId) {
  currentGroupId = groupId;
  const group = GROUPS.find(g => g.id === groupId);
  document.getElementById('currentGroupName').textContent = group.name;

  const announcements = {
    1: 'Spring Tournament on Apr 20th at Pebble Beach! Sign up before Apr 15. Top 3 get prizes 🏆',
    2: 'Welcome new members! Check out our monthly handicap rankings in Stats 📊',
    3: 'Q2 team building — golf outing on May 1st. HR will cover green fees!',
    4: 'Skins pot is up to $240 this week. Don\'t miss Sunday\'s round! 💵',
  };

  const announcementEl = document.querySelector('.announcement-text');
  if (announcementEl) announcementEl.textContent = announcements[groupId] || '';

  closeGroupDropdown();
  showToast(`Switched to ${group.name}`);
}

// ============================================================
// SHARED RENDER: Tee Time Card
// ============================================================
function renderTeeTimeCard(tt) {
  const statusClass = tt.status.replace('_', '-');

  // Completed: use history-style layout with player score chips
  if (tt.status === 'completed' && COMPLETED_SCORES[tt.id]) {
    const scores = COMPLETED_SCORES[tt.id];
    const playerChips = tt.players.map(pi => {
      const m = MEMBERS[pi];
      const score = scores[pi] || '0';
      const cls = score === '0' ? '' : (score.startsWith('+') ? 'over' : 'under');
      return `
        <span class="history-player-chip">
          <span class="hp-avatar" style="background:${m.color}">${m.initials}</span>
          ${m.name.split('.')[0]}
          <span class="hp-score ${cls}">${score}</span>
        </span>
      `;
    }).join('');

    return `
      <div class="tee-time-card" onclick="navigate('tee-detail', ${tt.id})">
        <div class="tt-top">
          <div class="tt-time">${tt.time}</div>
          <span class="tt-status ${statusClass}">Completed</span>
        </div>
        <div class="tt-course" style="margin-bottom: var(--space-sm);">${tt.course}</div>
        <div class="history-players">${playerChips}</div>
      </div>
    `;
  }

  // Upcoming / In Progress: normal layout
  const playerNames = tt.players.slice(0, 4).map(pi => MEMBERS[pi].name.split('.')[0]).join(', ');
  const remaining = tt.players.length > 4 ? ` +${tt.players.length - 4}` : '';

  // Hole progress for in_progress
  let holeProgressHtml = '';
  if (tt.status === 'in_progress' && IN_PROGRESS_HOLES[tt.id]) {
    const holes = IN_PROGRESS_HOLES[tt.id];
    const front9 = holes.slice(0, 9).map(h => {
      const cls = h === 'birdie' ? 'birdie' : (h ? 'scored' : '');
      return `<span class="tt-hole-dot ${cls}"></span>`;
    }).join('');
    const back9 = holes.slice(9, 18).map(h => {
      const cls = h === 'birdie' ? 'birdie' : (h ? 'scored' : '');
      return `<span class="tt-hole-dot ${cls}"></span>`;
    }).join('');
    const scored = holes.filter(h => h !== null).length;
    holeProgressHtml = `
      <div class="tt-hole-progress">
        ${front9}
        <span class="hole-gap"></span>
        ${back9}
        <span class="tt-hole-label">${scored}/18</span>
      </div>
    `;
  }

  return `
    <div class="tee-time-card" onclick="navigate('tee-detail', ${tt.id})">
      <div class="tt-top">
        <div class="tt-time">${tt.time}</div>
        <span class="tt-status ${statusClass}">${tt.status === 'in_progress' ? 'In Progress' : tt.status.charAt(0).toUpperCase() + tt.status.slice(1)}</span>
      </div>
      <div class="tt-course" style="margin-bottom: var(--space-sm);">${tt.course}</div>
      <div class="tt-bottom">
        <div class="tt-players">
          <span class="tt-player-names">${playerNames}${remaining}</span>
          <span class="tt-player-count">${tt.players.length}/${tt.maxPlayers}</span>
        </div>
        <div class="tt-price">${tt.price}</div>
      </div>
      ${holeProgressHtml}
    </div>
  `;
}

// ============================================================
// SHARED RENDER: Chat message
// ============================================================
function renderChatMsg(msg) {
  const m = MEMBERS[msg.pi];
  return `
    <div class="chat-msg">
      <div class="cm-avatar" style="background:${m.color}">${m.initials}</div>
      <div class="cm-bubble">
        <div class="cm-name">${m.name}</div>
        <div class="cm-text">${msg.text}</div>
        ${msg.time ? `<div class="cm-time">${msg.time}</div>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// SHARED: HTML head
// ============================================================
function htmlHead(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>${title} — TeeLab AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>`;
}
