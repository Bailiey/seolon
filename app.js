let isAdmin = false;
const ADMIN_PW = "2134";
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
        await auth.signOut(); isAdmin = false;
        document.body.classList.remove('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'block';
        document.getElementById('btn-admin-logout').style.display = 'none';
        renderCalendar();
    };
});

function initRealtimeListeners() {
    database.ref('rooms').on('value', (snap) => updateCalendarWithData(snap.val() || {}));
    database.ref('lp_schedule').on('value', (snap) => {
        const val = snap.val() || { morning: '-', evening: '-' };
        document.getElementById('lp-morning-text').innerText = val.morning;
        document.getElementById('lp-evening-text').innerText = val.evening;
    });
    database.ref('guide').on('value', (snap) => {
        const val = snap.val() || "내용을 입력해주세요.";
        document.getElementById('guide-display-content').innerText = val;
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

    // 요일 헤더
    ['일','월','화','수','목','금','토'].forEach(d => {
        const h = document.createElement('div'); h.className = 'cal-day head'; h.innerText = d;
        body.appendChild(h);
    });

    for(let i=0; i<firstDay; i++) body.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const div = document.createElement('div');
        div.className = 'cal-day'; div.innerText = i;
        if(selectedDate === dateStr) div.classList.add('selected');
        
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

function refreshRoomStatus(data) {
    document.getElementById('room-status-container').style.display = 'block';
    document.getElementById('selected-date-display').innerText = `${selectedDate} 현황`;
    ['room3','room4','room6'].forEach(r => {
        const rd = (data || {})[r] || {gender:'none', count:0};
        document.getElementById(`box-${r}`).className = `status-box ${rd.gender}-room`;
        document.getElementById(`label-${r}`).innerText = rd.gender === 'none' ? '미정' : (rd.gender === 'male' ? '남성' : '여성');
        document.getElementById(`capa-${r}`).innerText = rd.count;
        if(isAdmin) {
            document.getElementById(`admin-select-${r}`).value = rd.gender;
            document.getElementById(`admin-capa-${r}`).value = rd.count;
        }
    });
}

async function attemptAdminLogin() {
    if (document.getElementById('admin-pw').value === ADMIN_PW) { 
        await auth.signInAnonymously(); isAdmin = true;
        document.body.classList.add('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'none';
        document.getElementById('btn-admin-logout').style.display = 'block';
        document.getElementById('admin-modal').classList.remove('active');
        renderCalendar();
    } else alert('비밀번호 틀림');
}

function closeAdminModal() { document.getElementById('admin-modal').classList.remove('active'); }

async function addBoardContent() {
    const a = document.getElementById('board-author').value;
    const p = document.getElementById('board-pw').value;
    const c = document.getElementById('board-content').value;
    if(!a || !c) return alert('닉네임과 내용을 적어주세요.');
    await database.ref('posts').push().set({ author: a, pw: p, content: c, date: new Date().toLocaleDateString() });
    alert('등록되었습니다.');
    document.getElementById('board-author').value = ''; document.getElementById('board-pw').value = ''; document.getElementById('board-content').value = '';
}

function renderBoard(posts) {
    const list = document.getElementById('board-list'); list.innerHTML = '';
    if(!posts) return;
    Object.keys(posts).reverse().forEach(k => {
        const p = posts[k];
        const item = document.createElement('div'); item.className = 'board-item';
        item.innerHTML = `<div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')"><span>🔒 비밀글 (${p.author})</span><span>${p.date}</span></div>
            <div class="board-item-content">${isAdmin ? `[비번:${p.pw}]<br>${p.content}<br><button onclick="deletePost('${k}')">삭제</button>` : 
            `<input type="password" id="pw-${k}" style="width:80px; background:#111; color:#fff;"><button onclick="checkPw('${k}','${p.pw}')">확인</button><div id="tx-${k}" style="display:none; margin-top:10px;">${p.content}</div>`}</div>`;
        list.appendChild(item);
    });
}

window.checkPw = (k, p) => { if(document.getElementById(`pw-${k}`).value === p) document.getElementById(`tx-${k}`).style.display = 'block'; else alert('비밀번호 틀림'); };
window.deletePost = (k) => { if(confirm('삭제?')) database.ref(`posts/${k}`).remove(); };

async function saveRoomGender(r) { if(!isAdmin) return; await database.ref(`rooms/${selectedDate}/${r}`).set({ gender: document.getElementById(`admin-select-${r}`).value, count: parseInt(document.getElementById(`admin-capa-${r}`).value) }); alert('저장됨'); }
async function saveLP() { if(!isAdmin) return; await database.ref('lp_schedule').set({ morning: document.getElementById('input-lp-morning').value, evening: document.getElementById('input-lp-evening').value }); alert('LP 저장됨'); }
async function saveGuideParams() { if(!isAdmin) return; await database.ref('guide').set(document.getElementById('admin-guide-textarea').value); alert('안내사항 저장됨'); }

document.getElementById('prev-month').onclick = () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(); };

// [수정된 부분] 달력 업데이트 로직에 '마감 배지' 추가
function updateCalendarWithData(roomsData) {
    const body = document.getElementById('calendar-body');
    if (!body) return;
    body.innerHTML = '';
    document.getElementById('current-month-display').innerText = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;
    
    // 요일 헤더 생략 (기존과 동일)
    ['일','월','화','수','목','금','토'].forEach(d => {
        const h = document.createElement('div'); h.className = 'cal-day head'; h.innerText = d;
        body.appendChild(h);
    });

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for(let i=0; i<firstDay; i++) body.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const div = document.createElement('div');
        div.className = 'cal-day'; div.innerText = i;
        if(selectedDate === dateStr) div.classList.add('selected');
        
        const dayData = roomsData[dateStr] || {};
        
        // [핵심] 만실 체크 로직 (3개 방이 모두 꽉 찼을 때)
        const isFull = (dayData.room3?.count >= 3) && (dayData.room4?.count >= 4) && (dayData.room6?.count >= 6);
        if(isFull) {
            const badge = document.createElement('span');
            badge.className = 'full-text-badge';
            badge.innerText = '마감';
            div.appendChild(badge);
        }

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

// [수정된 부분] 관리자 저장 시 인원수 제한 체크
async function saveRoomGender(r) { 
    if(!isAdmin) return; 
    const count = parseInt(document.getElementById(`admin-capa-${r}`).value);
    const max = roomCapacities[r];

    // 방 인원 이상 입력 방지
    if (count > max) {
        alert(`${max}명을 초과할 수 없습니다.`);
        return;
    }

    await database.ref(`rooms/${selectedDate}/${r}`).set({ 
        gender: document.getElementById(`admin-select-${r}`).value, 
        count: count 
    }); 
    alert('저장되었습니다.'); 
}
