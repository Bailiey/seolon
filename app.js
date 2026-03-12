// ==========================================
// 1. 공통 설정 및 변수
// ==========================================
let isAdmin = false;
let currentYear = 2026;
let currentMonth = 2; // 0-indexed (2 = 3월)
let selectedDate = null;

const roomCapacities = { room3: 3, room4: 4, room6: 6 };

const mobileMenu = document.querySelector('#mobile-menu');
const navMenu = document.querySelector('.nav-menu');

// 모바일 메뉴 토글
mobileMenu.addEventListener('click', () => {
    mobileMenu.classList.toggle('is-active');
    navMenu.classList.toggle('active');
});

const navLinks = document.querySelectorAll('.nav-links');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('is-active');
        navMenu.classList.remove('active');
    });
});

// ==========================================
// 2. 관리자 로그인 (서버 권한 획득)
// ==========================================
async function attemptAdminLogin() {
    const pw = document.getElementById('admin-pw').value;
    if (pw === 'admin') { 
        try {
            await auth.signInAnonymously(); // 잠금 모드에서 쓰기 권한을 얻기 위해 로그인
            isAdmin = true;
            document.body.classList.add('admin-mode');
            document.getElementById('btn-admin-login').style.display = 'none';
            document.getElementById('btn-admin-logout').style.display = 'block';
            document.getElementById('admin-modal').classList.remove('active');
            document.getElementById('admin-pw').value = '';
            alert('관리자 모드로 접속되었습니다. 수정 사항이 실시간으로 모든 손님에게 반영됩니다.');
            renderCalendar(); 
        } catch (e) { alert('로그인 실패: ' + e.message); }
    } else { alert('비밀번호가 틀렸습니다.'); }
}

document.getElementById('btn-admin-logout').addEventListener('click', () => {
    auth.signOut().then(() => {
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'block';
        document.getElementById('btn-admin-logout').style.display = 'none';
        alert('로그아웃 되었습니다.');
        renderCalendar();
    });
});

document.getElementById('btn-admin-login').addEventListener('click', () => {
    document.getElementById('admin-modal').classList.add('active');
});

// ==========================================
// 3. 실시간 데이터 감시 (핵심: 새로고침 없이 화면이 바뀜)
// ==========================================
function initRealtimeListeners() {
    // 예약 현황 감시
    database.ref('rooms').on('value', () => {
        renderCalendar();
        if (selectedDate) renderRoomStatus(selectedDate);
    });

    // LP 스케줄 감시
    database.ref('lp_schedule').on('value', (snap) => {
        const val = snap.val() || { morning: '아이유 - 꽃갈피', evening: '검정치마 - TeamBaby' };
        document.getElementById('lp-morning-text').innerText = val.morning;
        document.getElementById('lp-evening-text').innerText = val.evening;
        document.getElementById('input-lp-morning').value = val.morning;
        document.getElementById('input-lp-evening').value = val.evening;
    });

    // 가이드 감시
    database.ref('guide').on('value', (snap) => {
        const val = snap.val() || `주차 안내:\n- 서론 앞 50m 공영주차장을 이용하실 수 있습니다. (무료)\n\n통금 및 에티켓:\n- 자정 24:00 에는 모든 공용 공간이 소등되며 외출입이 통제됩니다.\n- 밤 10시 이후에는 다른 게스트들의 숙면을 위해 소음을 자제해 주세요.\n\n체크인 / 체크아웃:\n- 체크인: 16:00 부터\n- 체크아웃: 10:30 까지`;
        document.getElementById('guide-display-content').innerText = val;
        document.getElementById('admin-guide-textarea').value = val;
    });

    // 게시판 감시
    database.ref('posts').on('value', (snap) => {
        loadBoard(snap.val());
    });
}

// ==========================================
// 4. 달력 및 예약 관리 (서버 연동)
// ==========================================
function renderCalendar() {
    const calendarBody = document.getElementById('calendar-body');
    calendarBody.innerHTML = '';
    document.getElementById('current-month-display').innerText = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    dayNames.forEach(d => {
        const div = document.createElement('div');
        div.className = 'cal-day head'; div.innerText = d;
        calendarBody.appendChild(div);
    });

    for (let i = 0; i < firstDay; i++) {
        calendarBody.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));
    }

    // 서버 데이터를 비동기로 가져와서 그림
    database.ref('rooms').once('value', (snap) => {
        const allRoomsData = snap.val() || {};
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const div = document.createElement('div');
            div.className = 'cal-day'; div.innerText = i; div.dataset.date = dateStr;
            if (selectedDate === dateStr) div.classList.add('selected');

            const dayData = allRoomsData[dateStr] || { room3: {gender:'none',count:0}, room4: {gender:'none',count:0}, room6: {gender:'none',count:0} };
            
            const indicatorContainer = document.createElement('div');
            indicatorContainer.className = 'room-indicators';
            let isFull = true;

            ['room3', 'room4', 'room6'].forEach(room => {
                const r = dayData[room];
                const dot = document.createElement('div');
                dot.className = `indicator ${r.gender}`;
                indicatorContainer.appendChild(dot);
                if (r.count < roomCapacities[room]) isFull = false;
            });

            div.appendChild(indicatorContainer);
            if (isFull) {
                const badge = document.createElement('span');
                badge.className = 'full-text-badge'; badge.innerText = '마감';
                div.appendChild(badge);
            }

            div.onclick = () => {
                document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedDate = dateStr;
                renderRoomStatus(dateStr);
            };
            calendarBody.appendChild(div);
        }
    });
}

function renderRoomStatus(dateStr) {
    document.getElementById('room-status-container').style.display = 'block';
    document.getElementById('selected-date-display').innerText = `${dateStr} 예약 현황`;
    
    database.ref(`rooms/${dateStr}`).once('value', (snap) => {
        const data = snap.val() || { room3: {gender:'none',count:0}, room4: {gender:'none',count:0}, room6: {gender:'none',count:0} };
        ['room3', 'room4', 'room6'].forEach(room => {
            const r = data[room];
            const box = document.getElementById(`box-${room}`);
            box.className = `status-box ${r.gender}-room`;
            document.getElementById(`label-${room}`).innerText = r.gender === 'none' ? '성별 미정' : (r.gender === 'male' ? '남성 전용' : '여성 전용');
            document.getElementById(`capa-${room}`).innerText = r.count;
            if (isAdmin) {
                document.getElementById(`admin-select-${room}`).value = r.gender;
                document.getElementById(`admin-capa-${room}`).value = r.count;
            }
        });
    });
}

async function saveRoomGender(room) {
    if (!isAdmin) return alert('관리자 로그인이 필요합니다.');
    const gender = document.getElementById(`admin-select-${room}`).value;
    const count = parseInt(document.getElementById(`admin-capa-${room}`).value, 10);
    if (count < 0 || count > roomCapacities[room]) return alert('인원수를 확인해주세요.');

    await database.ref(`rooms/${selectedDate}/${room}`).set({ gender, count });
    alert('저장되었습니다.');
}

// ==========================================
// 5. 기타 관리 기능 (LP, 가이드, 게시판)
// ==========================================
async function saveLP() {
    if (!isAdmin) return alert('권한이 없습니다.');
    await database.ref('lp_schedule').set({
        morning: document.getElementById('input-lp-morning').value,
        evening: document.getElementById('input-lp-evening').value
    });
    alert('LP 스케줄이 실시간 반영되었습니다.');
}

async function saveGuideParams() {
    if (!isAdmin) return alert('권한이 없습니다.');
    await database.ref('guide').set(document.getElementById('admin-guide-textarea').value);
    alert('안내사항이 반영되었습니다.');
}

async function addBoardContent() {
    const author = document.getElementById('board-author').value;
    const pw = document.getElementById('board-pw').value;
    const content = document.getElementById('board-content').value;
    if (!author || !content) return alert('내용을 입력해주세요.');

    await database.ref('posts').push().set({
        author, pw, content, date: new Date().toLocaleDateString()
    });
    document.getElementById('board-author').value = '';
    document.getElementById('board-pw').value = '';
    document.getElementById('board-content').value = '';
    alert('비밀글이 서버에 등록되었습니다.');
}

function loadBoard(postsObj) {
    const boardList = document.getElementById('board-list');
    boardList.innerHTML = '';
    if (!postsObj) return boardList.innerHTML = '<p style="color:#777;">등록된 글이 없습니다.</p>';

    Object.keys(postsObj).reverse().forEach(key => {
        const post = postsObj[key];
        const item = document.createElement('div'); item.className = 'board-item';
        item.innerHTML = `
            <div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')">
                <span>🔒 비밀글입니다. (작성자: ${post.author})</span>
                <span class="board-item-meta">${post.date}</span>
            </div>
            <div class="board-item-content">
                ${isAdmin ? `<strong>[PW: ${post.pw}]</strong><br>${post.content}<br><button class="btn-secondary mt-3" onclick="deletePost('${key}')">삭제</button>` : 
                `<input type="password" id="pw-${key}" placeholder="비밀번호"><button class="btn-secondary" onclick="verifyPw('${key}', '${post.pw}')">확인</button>
                 <div id="text-${key}" style="display:none; margin-top:10px; white-space:pre-wrap;">${post.content}</div>`}
            </div>`;
        boardList.appendChild(item);
    });
}

window.verifyPw = (key, real) => {
    if (document.getElementById(`pw-${key}`).value === real) document.getElementById(`text-${key}`).style.display = 'block';
    else alert('틀렸습니다.');
};

window.deletePost = (key) => { if(confirm('삭제할까요?')) database.ref(`posts/${key}`).remove(); };

// ==========================================
// 6. 시작
// ==========================================
document.getElementById('prev-month').onclick = () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(); };

document.addEventListener('DOMContentLoaded', () => {
    initRealtimeListeners();
});
