let isAdmin = false;
let currentYear = 2026;
let currentMonth = 2; 
let selectedDate = null;
const roomCapacities = { room3: 3, room4: 4, room6: 6 };

document.addEventListener('DOMContentLoaded', () => {
    initRealtimeData();
    renderCalendar();

    // 메뉴 토글
    const mobileMenu = document.querySelector('#mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('is-active');
        navMenu.classList.toggle('active');
    });

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

// 실시간 데이터 감시 (이 부분이 실시간으로 정보를 업데이트함)
function initRealtimeData() {
    database.ref('rooms').on('value', () => renderCalendar());
    database.ref('lp_schedule').on('value', snap => {
        const val = snap.val() || { morning: '아이유 - 꽃갈피', evening: '검정치마 - TeamBaby' };
        document.getElementById('lp-morning-text').innerText = val.morning;
        document.getElementById('lp-evening-text').innerText = val.evening;
        document.getElementById('input-lp-morning').value = val.morning;
        document.getElementById('input-lp-evening').value = val.evening;
    });
    database.ref('guide').on('value', snap => {
        const val = snap.val() || "기본 안내사항입니다.";
        document.getElementById('guide-display-content').innerText = val;
        document.getElementById('admin-guide-textarea').value = val;
    });
    database.ref('posts').on('value', snap => renderBoard(snap.val()));
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
        alert('관리자 접속 성공');
        renderCalendar();
    } else alert('비번 틀림');
}

function closeAdminModal() { document.getElementById('admin-modal').classList.remove('active'); }

// 달력 그리기 (마감 배지 & 인디케이터 포함)
function renderCalendar() {
    const body = document.getElementById('calendar-body');
    body.innerHTML = '';
    document.getElementById('current-month-display').innerText = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    ['일','월','화','수','목','금','토'].forEach(d => {
        const h = document.createElement('div'); h.className = 'cal-day head'; h.innerText = d;
        body.appendChild(h);
    });

    for (let i = 0; i < firstDay; i++) body.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));

    database.ref('rooms').once('value', (snap) => {
        const roomsData = snap.val() || {};
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const div = document.createElement('div');
            div.className = 'cal-day'; div.innerText = i; div.dataset.date = dateStr;
            if(selectedDate === dateStr) div.classList.add('selected');

            const dayData = roomsData[dateStr] || { room3: {gender:'none',count:0}, room4: {gender:'none',count:0}, room6: {gender:'none',count:0} };
            
            // 인디케이터 (점 표시)
            const ind = document.createElement('div'); ind.className = 'room-indicators';
            let isFullyBooked = true;
            ['room3', 'room4', 'room6'].forEach(room => {
                const r = dayData[room] || {gender:'none', count:0};
                const dot = document.createElement('div');
                dot.className = `indicator ${r.gender}`;
                ind.appendChild(dot);
                if (r.count < roomCapacities[room]) isFullyBooked = false;
            });
            div.appendChild(ind);

            // 마감 배지
            if (isFullyBooked) {
                const badge = document.createElement('span');
                badge.className = 'full-text-badge'; badge.innerText = '마감';
                div.appendChild(badge);
            }

            div.onclick = () => {
                document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedDate = dateStr;
                renderRoomStatus(dateStr, dayData);
            };
            body.appendChild(div);
        }
    });
}

function renderRoomStatus(dateStr, data) {
    document.getElementById('room-status-container').style.display = 'block';
    document.getElementById('selected-date-display').innerText = `${dateStr} 현황`;
    ['room3','room4','room6'].forEach(r => {
        const rData = data[r] || {gender:'none', count:0};
        const box = document.getElementById(`box-${r}`);
        box.className = `status-box ${rData.gender}-room`;
        document.getElementById(`label-${r}`).innerText = rData.gender === 'none' ? '미정' : (rData.gender === 'male' ? '남성' : '여성');
        document.getElementById(`capa-${r}`).innerText = rData.count;
        if(isAdmin) {
            document.getElementById(`admin-select-${r}`).value = rData.gender;
            document.getElementById(`admin-capa-${r}`).value = rData.count;
        }
    });
}

async function saveRoomGender(room) {
    if(!isAdmin) return alert('권한 없음');
    const g = document.getElementById(`admin-select-${room}`).value;
    const c = parseInt(document.getElementById(`admin-capa-${room}`).value);
    await database.ref(`rooms/${selectedDate}/${room}`).set({ gender: g, count: c });
    alert('저장되었습니다.');
}

async function saveLP() {
    if(!isAdmin) return alert('권한 없음');
    await database.ref('lp_schedule').set({
        morning: document.getElementById('input-lp-morning').value,
        evening: document.getElementById('input-lp-evening').value
    });
    alert('LP 저장 완료');
}

async function saveGuideParams() {
    if(!isAdmin) return alert('권한 없음');
    await database.ref('guide').set(document.getElementById('admin-guide-textarea').value);
    alert('안내사항 저장 완료');
}

// 게시판 (사장님 디자인 복구!)
async function addBoardContent() {
    const author = document.getElementById('board-author').value;
    const pw = document.getElementById('board-pw').value;
    const content = document.getElementById('board-content').value;
    if(!author || !content) return alert('내용을 입력하세요.');

    await database.ref('posts').push().set({
        author, pw, content, date: new Date().toLocaleDateString()
    });
    document.getElementById('board-author').value = '';
    document.getElementById('board-pw').value = '';
    document.getElementById('board-content').value = '';
    alert('비밀글이 서버에 등록되었습니다.');
}

function renderBoard(posts) {
    const boardList = document.getElementById('board-list');
    boardList.innerHTML = '';
    if(!posts) return;

    Object.keys(posts).reverse().forEach(key => {
        const post = posts[key];
        const item = document.createElement('div');
        item.className = 'board-item';
        
        item.innerHTML = `
            <div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')">
                <span>🔒 비밀글입니다. (작성자: ${post.author})</span>
                <span class="board-item-meta">${post.date}</span>
            </div>
            <div class="board-item-content">
                ${isAdmin ? `<strong>[PW: ${post.pw}]</strong><br>${post.content}<br><button class="btn-secondary mt-3" onclick="deletePost('${key}')">삭제</button>` : 
                `<input type="password" id="check-pw-${key}" placeholder="비밀번호" style="width:100px; padding:5px; background:#111; color:#fff; border:1px solid #444;">
                 <button class="btn-secondary" onclick="verifyPw('${key}', '${post.pw}')">확인</button>
                 <div id="text-${key}" style="display:none; margin-top:10px; white-space:pre-wrap;">${post.content}</div>`}
            </div>
        `;
        boardList.appendChild(item);
    });
}

window.verifyPw = (key, realPw) => {
    const inputPw = document.getElementById(`check-pw-${key}`).value;
    if (inputPw === realPw) document.getElementById(`text-${key}`).style.display = 'block';
    else alert('비밀번호가 일치하지 않습니다.');
};

window.deletePost = (key) => { if(confirm('삭제하시겠습니까?')) database.ref(`posts/${key}`).remove(); };

document.getElementById('prev-month').onclick = () => { currentMonth--; if(currentMonth < 0){currentMonth = 11; currentYear--;} renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if(currentMonth > 11){currentMonth = 0; currentYear++;} renderCalendar(); };
};

// 달력 이동
document.getElementById('prev-month').onclick = () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(); };
