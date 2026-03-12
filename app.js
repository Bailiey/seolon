// ==========================================
// 1. 초기 변수 및 설정
// ==========================================
let isAdmin = false;
let currentYear = 2026;
let currentMonth = 2; // 3월
let selectedDate = null;
const roomCapacities = { room3: 3, room4: 4, room6: 6 };

// ==========================================
// 2. 페이지 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initRealtimeListeners();
    renderCalendar(); // 페이지 열자마자 달력부터 그리기
    
    // 모바일 메뉴
    const mobileMenu = document.querySelector('#mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    mobileMenu.onclick = () => {
        mobileMenu.classList.toggle('is-active');
        navMenu.classList.toggle('active');
    };

    // 관리자 로그인/로그아웃 버튼
    document.getElementById('btn-admin-login').onclick = () => document.getElementById('admin-modal').classList.add('active');
    document.getElementById('btn-admin-logout').onclick = async () => {
        await auth.signOut();
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'block';
        document.getElementById('btn-admin-logout').style.display = 'none';
        alert('로그아웃 되었습니다.');
        renderCalendar();
    };
});

// ==========================================
// 3. 실시간 데이터 감시 (Firebase)
// ==========================================
function initRealtimeListeners() {
    // 서버 데이터가 바뀌면 달력을 다시 그림
    database.ref('rooms').on('value', () => {
        renderCalendar();
        if (selectedDate) refreshRoomStatus();
    });

    database.ref('lp_schedule').on('value', (snap) => {
        const val = snap.val() || { morning: '아이유 - 꽃갈피', evening: '검정치마 - TeamBaby' };
        document.getElementById('lp-morning-text').innerText = val.morning;
        document.getElementById('lp-evening-text').innerText = val.evening;
        document.getElementById('input-lp-morning').value = val.morning;
        document.getElementById('input-lp-evening').value = val.evening;
    });

    database.ref('guide').on('value', (snap) => {
        const val = snap.val() || "안내사항을 입력해주세요.";
        document.getElementById('guide-display-content').innerText = val;
        document.getElementById('admin-guide-textarea').value = val;
    });

    database.ref('posts').on('value', (snap) => renderBoard(snap.val()));
}

// ==========================================
// 4. 달력 렌더링 (날짜가 무조건 뜨도록 수정)
// ==========================================
function renderCalendar() {
    const body = document.getElementById('calendar-body');
    body.innerHTML = '';
    document.getElementById('current-month-display').innerText = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // 요일 헤더
    ['일','월','화','수','목','금','토'].forEach(d => {
        const h = document.createElement('div'); h.className = 'cal-day head'; h.innerText = d;
        body.appendChild(h);
    });

    // 공백
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div'); div.className = 'cal-day empty';
        body.appendChild(div);
    }

    // 일단 날짜부터 싹 그립니다 (서버 데이터 기다리지 않음)
    database.ref('rooms').once('value', (snapshot) => {
        const roomsData = snapshot.val() || {};
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const div = document.createElement('div');
            div.className = 'cal-day';
            div.innerText = i;
            div.dataset.date = dateStr;
            if (selectedDate === dateStr) div.classList.add('selected');

            const dayData = roomsData[dateStr] || {};
            const ind = document.createElement('div'); ind.className = 'room-indicators';
            let full = true;

            ['room3', 'room4', 'room6'].forEach(r => {
                const rData = dayData[r] || { gender: 'none', count: 0 };
                const dot = document.createElement('div');
                dot.className = `indicator ${rData.gender}`;
                ind.appendChild(dot);
                if (rData.count < roomCapacities[r]) full = false;
            });
            div.appendChild(ind);

            if (full && dayData.room3) { // 데이터가 있을 때만 마감 표시
                const b = document.createElement('span'); b.className = 'full-text-badge'; b.innerText = '마감';
                div.appendChild(b);
            }

            div.onclick = () => {
                document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected'); selectedDate = dateStr;
                refreshRoomStatus();
            };
            body.appendChild(div);
        }
    });
}

// 나머지 함수들 (생략 없이 통으로 유지)
function refreshRoomStatus() {
    document.getElementById('room-status-container').style.display = 'block';
    document.getElementById('selected-date-display').innerText = `${selectedDate} 현황`;
    database.ref(`rooms/${selectedDate}`).once('value', (snap) => {
        const data = snap.val() || { room3:{gender:'none',count:0}, room4:{gender:'none',count:0}, room6:{gender:'none',count:0} };
        ['room3','room4','room6'].forEach(r => {
            const rd = data[r] || {gender:'none', count:0};
            document.getElementById(`box-${r}`).className = `status-box ${rd.gender}-room`;
            document.getElementById(`label-${r}`).innerText = rd.gender === 'none' ? '미정' : (rd.gender === 'male' ? '남성' : '여성');
            document.getElementById(`capa-${r}`).innerText = rd.count;
            if(isAdmin) {
                document.getElementById(`admin-select-${r}`).value = rd.gender;
                document.getElementById(`admin-capa-${r}`).value = rd.count;
            }
        });
    });
}

async function attemptAdminLogin() {
    const pw = document.getElementById('admin-pw').value;
    if (pw === 'admin') { 
        await auth.signInAnonymously();
        isAdmin = true;
        document.body.classList.add('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'none';
        document.getElementById('btn-admin-logout').style.display = 'block';
        document.getElementById('admin-modal').classList.remove('active');
        alert('관리자 모드 활성화');
        renderCalendar();
    } else alert('비번 틀림');
}

function closeAdminModal() { document.getElementById('admin-modal').classList.remove('active'); }

async function saveRoomGender(room) {
    if(!isAdmin) return alert('권한 없음');
    const g = document.getElementById(`admin-select-${room}`).value;
    const c = parseInt(document.getElementById(`admin-capa-${room}`).value);
    await database.ref(`rooms/${selectedDate}/${room}`).set({ gender: g, count: c });
    alert('저장됨');
}

async function saveLP() {
    if(!isAdmin) return;
    await database.ref('lp_schedule').set({
        morning: document.getElementById('input-lp-morning').value,
        evening: document.getElementById('input-lp-evening').value
    });
    alert('LP 저장됨');
}

async function saveGuideParams() {
    if(!isAdmin) return;
    await database.ref('guide').set(document.getElementById('admin-guide-textarea').value);
    alert('안내사항 저장됨');
}

async function addBoardContent() {
    const a = document.getElementById('board-author').value;
    const p = document.getElementById('board-pw').value;
    const c = document.getElementById('board-content').value;
    if(!a || !c) return alert('내용 입력!');
    await database.ref('posts').push().set({ author: a, pw: p, content: c, date: new Date().toLocaleDateString() });
    alert('글 등록됨');
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
            `<input type="password" id="pw-${k}"><button onclick="checkPw('${k}','${p.pw}')">확인</button><div id="tx-${k}" style="display:none; margin-top:10px;">${p.content}</div>`}</div>`;
        list.appendChild(item);
    });
}

window.checkPw = (k, p) => { if(document.getElementById(`pw-${k}`).value === p) document.getElementById(`tx-${k}`).style.display = 'block'; else alert('땡'); };
window.deletePost = (k) => { if(confirm('삭제?')) database.ref(`posts/${k}`).remove(); };

document.getElementById('prev-month').onclick = () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(); };
