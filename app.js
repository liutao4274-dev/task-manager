// ============================================================
// CONFIG
// ============================================================
const GIST_ID = '8e2e897ce3802f1d3d3bf9070b746312';
const GH_TOKEN = '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';
const FILENAME = 'tasks.json';
// ============================================================

let tasks = [];
let editId = null;
let curFilter = 'all';
let selPriority = 'normal';
let selTeamVal = '';
let saveTimer = null;

const syncDot = document.getElementById('sync-dot');

function setSyncState(state) {
  syncDot.className = 'sync-dot' + (state === 'syncing' ? ' syncing' : state === 'error' ? ' error' : '');
}

async function loadFromGist() {
  setSyncState('syncing');
  try {
    const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { 'Authorization': `token ${GH_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const data = await r.json();
    const content = data.files[FILENAME]?.content || '[]';
    tasks = JSON.parse(content);
    setSyncState('ok');
  } catch(e) {
    setSyncState('error');
    showToast('加载失败，请检查网络连接');
  }
  render();
}

async function saveToGist() {
  setSyncState('syncing');
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(tasks, null, 2) } } })
    });
    setSyncState('ok');
  } catch(e) {
    setSyncState('error');
    showToast('同步失败，请检查网络');
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToGist, 800);
}

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dateStr); due.setHours(0,0,0,0);
  return Math.round((due - now) / 86400000);
}

function cardStatus(t) {
  if (t.done) return 'done';
  const d = daysDiff(t.due);
  if (d === null) return t.priority === 'low' ? 'low' : 'normal';
  if (d < 0) return 'overdue';
  if (d <= (t.remind || 3)) return 'soon';
  return t.priority === 'low' ? 'low' : 'normal';
}

function priLabel(p) { return {urgent:'紧急重要',important:'重要不紧急',normal:'紧急不重要',low:'可延后'}[p]||p; }
function priBadge(p) { return {urgent:'b-urgent',important:'b-important',normal:'b-normal',low:'b-low'}[p]||'b-low'; }
function teamBadge(t) { return {金属:'b-metal',电子:'b-elec'}[t]||'b-low'; }

function dueHTML(t) {
  const d = daysDiff(t.due);
  if (d === null) return '';
  if (d < 0) return `<span class="due-tag overdue">⚠ 已过期${Math.abs(d)}天</span>`;
  if (d === 0) return `<span class="due-tag soon">⏰ 今天到期</span>`;
  if (d <= (t.remind||3)) return `<span class="due-tag soon">⏰ 还剩${d}天</span>`;
  return `<span class="due-tag">📅 ${t.due}</span>`;
}

function render() {
  const priOrder = {urgent:0,important:1,normal:2,low:3};
  let list = tasks;
  if (curFilter === 'urgent') list = tasks.filter(t => t.priority==='urgent' && !t.done);
  else if (curFilter === 'important') list = tasks.filter(t => t.priority==='important' && !t.done);
  else if (curFilter === 'metal') list = tasks.filter(t => t.team==='金属' && !t.done);
  else if (curFilter === 'elec') list = tasks.filter(t => t.team==='电子' && !t.done);
  else if (curFilter === 'overdue') list = tasks.filter(t => { const d=daysDiff(t.due); return d!==null&&d<0&&!t.done; });
  else if (curFilter === 'done') list = tasks.filter(t => t.done);

  list = [...list].sort((a,b) => {
    if (a.done !== b.done) return a.done?1:-1;
    const da=daysDiff(a.due), db=daysDiff(b.due);
    const ao=da!==null&&da<0, bo=db!==null&&db<0;
    if (ao!==bo) return ao?-1:1;
    return (priOrder[a.priority]??2)-(priOrder[b.priority]??2);
  });

  const overdue = tasks.filter(t=>{const d=daysDiff(t.due);return d!==null&&d<0&&!t.done;}).length;
  const soon = tasks.filter(t=>{const d=daysDiff(t.due);return d!==null&&d>=0&&d<=(t.remind||3)&&!t.done;}).length;
  document.getElementById('s-active').textContent = tasks.filter(t=>!t.done).length;
  document.getElementById('s-overdue').textContent = overdue;
  document.getElementById('s-soon').textContent = soon;
  document.getElementById('s-done').textContent = tasks.filter(t=>t.done).length;

  const wrap = document.getElementById('main-content');
  if (!list.length) {
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">暂无任务</div></div>';
    return;
  }

  const active = list.filter(t=>!t.done);
  const done = list.filter(t=>t.done);
  let html = '';
  if (active.length) {
    html += `<div class="section-label">进行中 · ${active.length}</div><div class="task-list">`;
    active.forEach(t => html += taskCard(t));
    html += '</div>';
  }
  if (done.length) {
    html += `<div class="section-label" style="margin-top:6px">已完成 · ${done.length}</div><div class="task-list">`;
    done.forEach(t => html += taskCard(t));
    html += '</div>';
  }
  wrap.innerHTML = html;
}

function taskCard(t) {
  const st = cardStatus(t);
  return `<div class="task-card s-${st}">
    <div class="task-row1">
      <div class="task-check ${t.done?'done':''}" onclick="toggleDone('${t.id}')"></div>
      <div class="task-title ${t.done?'done':''}">${escHtml(t.title)}</div>
      <div class="task-btns">
        <button class="icon-btn" onclick="editTask('${t.id}')" title="编辑">✏️</button>
        <button class="icon-btn" onclick="delTask('${t.id}')" title="删除">🗑</button>
      </div>
    </div>
    <div class="task-row2">
      <span class="badge ${priBadge(t.priority)}">${priLabel(t.priority)}</span>
      ${t.team ? `<span class="badge ${teamBadge(t.team)}">${t.team}团队</span>` : ''}
      ${t.due && !t.done ? dueHTML(t) : ''}
      ${t.note ? `<span class="task-note">${escHtml(t.note)}</span>` : ''}
    </div>
  </div>`;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function toggleDone(id) {
  const t = tasks.find(x=>x.id===id);
  if (t) { t.done = !t.done; scheduleSave(); render(); }
}

function delTask(id) {
  if (!confirm('确认删除这个任务？')) return;
  tasks = tasks.filter(x=>x.id!==id);
  scheduleSave(); render();
}

function editTask(id) {
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  editId = id;
  document.getElementById('modal-title').textContent = '编辑任务';
  document.getElementById('f-title').value = t.title;
  document.getElementById('f-due').value = t.due || '';
  document.getElementById('f-remind').value = t.remind || 3;
  document.getElementById('f-note').value = t.note || '';
  selPriority = t.priority || 'normal';
  selTeamVal = t.team || '';
  refreshSelUI();
  document.getElementById('modal').classList.add('open');
}

function openModal() {
  editId = null;
  document.getElementById('modal-title').textContent = '新建任务';
  document.getElementById('f-title').value = '';
  document.getElementById('f-due').value = '';
  document.getElementById('f-remind').value = '3';
  document.getElementById('f-note').value = '';
  selPriority = 'normal'; selTeamVal = '';
  refreshSelUI();
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.getElementById('f-title').focus(), 100);
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }
function overlayClick(e) { if (e.target.id === 'modal') closeModal(); }

function selPri(val) { selPriority = val; refreshSelUI(); }
function selTeam(val) { selTeamVal = selTeamVal === val ? '' : val; refreshSelUI(); }

function refreshSelUI() {
  document.querySelectorAll('[data-pri]').forEach(el => {
    el.className = 'seg-opt' + (el.dataset.pri === selPriority ? ` sel-${selPriority}` : '');
  });
  document.querySelectorAll('[data-team]').forEach(el => {
    const key = {金属:'metal',电子:'elec'}[el.dataset.team];
    el.className = 'seg-opt' + (el.dataset.team === selTeamVal ? ` sel-${key}` : '');
  });
}

function saveTask() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').style.borderColor='var(--red)'; return; }
  document.getElementById('f-title').style.borderColor='';
  const task = {
    id: editId || Date.now().toString(),
    title,
    team: selTeamVal,
    priority: selPriority,
    due: document.getElementById('f-due').value,
    remind: parseInt(document.getElementById('f-remind').value),
    note: document.getElementById('f-note').value.trim(),
    done: editId ? (tasks.find(x=>x.id===editId)?.done || false) : false,
    created: editId ? (tasks.find(x=>x.id===editId)?.created || Date.now()) : Date.now()
  };
  if (editId) tasks = tasks.map(x => x.id===editId ? task : x);
  else tasks.unshift(task);
  scheduleSave(); closeModal(); render();
  showToast(editId ? '任务已更新' : '任务已添加');
}

function setFilter(f, btn) {
  curFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

loadFromGist();
setInterval(loadFromGist, 5 * 60 * 1000);
