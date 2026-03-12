let isAdmin = false;
const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let selectedDate = null;
const roomCapacities = { room3: 3, room4: 4, room6: 6 };

document.addEventListener('DOMContentLoaded', () => {
    initRealtimeListeners();
    renderCalendar();

    document.getElementById('btn-admin-login').onclick = () => document.getElementById('admin-modal').classList.add('active');
    document.getElementById('btn-admin-logout').onclick = async () => {
        await auth.signOut();
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'block';
        document.getElementById('btn-admin-logout').style.display = 'none';
        renderCalendar();
    };
});

function initRealtimeListeners() {
    database.ref('rooms').on('value', (snap) => updateCalendarWithData(snap.val() || {}));
    database.ref('lp_schedule').on('value', (snap) => {
        const val = snap.val() || { morning: '아이유 - 꽃갈피', evening: '검정치마 - TeamBaby' };
        document.getElementById('lp-morning-text').innerText = val.morning;
        document.getElementById('lp-evening-text').innerText = val.evening;
    });
    database.ref('posts').on('value', (snap) => renderBoard(snap.val()));
}

function renderCalendar() {
    database.ref('rooms').once('value', (snap) => updateCalendarWithData(snap.val() || {}));
}

function updateCalendarWithData(roomsData) {
    const body = document.getElementById('calendar-body');
    if (!body) return;
    body.innerHTML = '';
    document.getElementById('current-month-display').innerText = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for(let i=0; i<firstDay; i++) body.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const div = document.createElement('div');
        div.className = 'cal-day'; div.innerText = i;
        
        const dayData = roomsData[dateStr] || {};
        const ind = document.createElement('div'); ind.className = 'room-indicators';
        ['room3', 'room4', 'room6'].forEach(r => {
            const dot = document.createElement('div');
            dot.className = `indicator ${(dayData[r] || {}).gender || 'none'}`;
            ind.appendChild(dot);
        });
        div.appendChild(ind);
        
        div.onclick = () => {
            selectedDate = dateStr;
            document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            refreshRoomStatus(dayData);
        };
        body.appendChild(div);
    }
}

async function addBoardContent() {
    const a = document.getElementById('board-author').value;
    const p = document.getElementById('board-pw').value;
    const c = document.getElementById('board-content').value;
    if(!a || !c) return;
    await database.ref('posts').push().set({ author: a, pw: p, content: c, date: new Date().toLocaleDateString() });
    alert('등록되었습니다.');
}

function renderBoard(posts) {
    const list = document.getElementById('board-list'); list.innerHTML = '';
    if(!posts) return;
    Object.keys(posts).reverse().forEach(k => {
        const p = posts[k];
        const item = document.createElement('div'); item.className = 'board-item';
        item.innerHTML = `<div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')"><span>🔒 비밀글 (${p.author})</span><span>${p.date}</span></div>
            <div class="board-item-content">${isAdmin ? `[비번:${p.pw}]<br>${p.content}` : `<input type="password" id="pw-${k}"><button onclick="checkPw('${k}','${p.pw}')">확인</button><div id="tx-${k}" style="display:none;">${p.content}</div>`}</div>`;
        list.appendChild(item);
    });
}
// ... 나머지 save 함수들은 기존과 동일
