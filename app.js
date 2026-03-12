// ==========================================
// 1. 초기 변수 및 설정
// ==========================================
let isAdmin = false;
const ADMIN_PW = "2134"; 

// 오늘 날짜 기준으로 초기화
const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

let selectedDate = null;
const roomCapacities = { room3: 3, room4: 4, room6: 6 };

// ==========================================
// 2. 페이지 초기화 (한 번만 실행되도록 보장)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 실시간 리스너는 한 번만 등록
    initRealtimeListeners();
    // 달력은 리스너 안에서 데이터를 가져온 후 그리거나 초기 실행
    renderCalendar();

    // 모바일 메뉴
    const mobileMenu = document.querySelector('#mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    if (mobileMenu) {
        mobileMenu.onclick = () => {
            mobileMenu.classList.toggle('is-active');
            navMenu.classList.toggle('active');
        };
    }

    // 관리자 로그인/로그아웃
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
    // .on('value')는 데이터가 바뀔 때마다 실행되므로 내부에서 달력을 새로 그림
    database.ref('rooms').on('value', (snapshot) => {
        // 데이터가 바뀔 때만 달력을 다시 그려서 중복 방지
        const roomsData = snapshot.val() || {};
        updateCalendarWithData(roomsData);
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

    database.ref('posts').on('value', (snap) => {
        renderBoard(snap.val());
    });
}

// ==========================================
// 4. 관리자 로그인 (비밀번호: 2134)
// ==========================================
async function attemptAdminLogin() {
    const inputPw = document.getElementById('admin-pw').value;
    if (inputPw === ADMIN_PW) { 
        try {
            await auth.signInAnonymously();
            isAdmin = true;
            document.body.classList.add('admin-mode');
            document.getElementById('btn-admin-login').style.display = 'none';
            document.getElementById('btn-admin-logout').style.display = 'block';
            document.getElementById('admin-modal').classList.remove('active');
            document.getElementById('admin-pw').value = '';
            alert('관리자 모드가 활성화되었습니다.');
            renderCalendar();
        } catch (e) {
            alert('인증 오류가 발생했습니다.');
        }
    } else {
        alert('비밀번호가 틀렸습니다.');
    }
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.remove('active');
    document.getElementById('admin-pw').value = '';
}

// ==========================================
// 5. 달력 렌더링 (중복 완벽 차단)
// ==========================================
function renderCalendar() {
    // 최초 실행 시 서버 데이터 없이 틀만 먼저 그림
    updateCalendarWithData({});
}

function updateCalendarWithData(roomsData) {
    const body = document.getElementById('calendar-body');
    if (!body) return;
    
    // [중요] 기존 내용을 완전히 비워야 두 번 안 뜹니다.
    body.innerHTML = ''; 

    document.getElementById('current-month-display').innerText = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // 요일 헤더
    ['일','월','화','수','목','금','토'].forEach(d => {
        const h = document.createElement('div'); h.className = 'cal-day head'; h.innerText = d;
        body.appendChild(h);
    });

    // 시작 공백
    for (let i = 0; i < firstDay; i++) {
        body.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));
    }

    // 날짜 그리기
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const div = document.createElement('div');
        div.className = 'cal-day';
        div.innerText = i;
        div.dataset.date = dateStr;
        if (selectedDate === dateStr) div.classList.add('selected');

        const dayData = roomsData[dateStr] || {};
        const ind = document.createElement('div'); ind.className = 'room-indicators';
        let isFull = true;

        ['room3', 'room4', 'room6'].forEach(room => {
            const rData = dayData[room] || { gender: 'none', count: 0 };
            const dot = document.createElement('div');
            dot.className = `indicator ${rData.gender}`;
            ind.appendChild(dot);
            if (rData.count < roomCapacities[room]) isFull = false;
        });
        div.appendChild(ind);

        if (isFull && dayData.room3) { 
            const b = document.createElement('span'); b.className = 'full-text-badge'; b.innerText = '마감';
            div.appendChild(b);
        }

        div.onclick = () => {
            document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedDate = dateStr;
            refreshRoomStatus();
        };
        body.appendChild(div);
    }
}

function refreshRoomStatus() {
    const container = document.getElementById('room-status-container');
    container.style.display = 'block';
    document.getElementById('selected-date-display').innerText = `${selectedDate} 현황`;
    
    database.ref(`rooms/${selectedDate}`).once('value', (snap) => {
        const data = snap.val() || { room3:{gender:'none',count:0}, room4:{gender:'none',count:0}, room6:{gender:'none',count:0} };
        ['room3','room4','room6'].forEach(r => {
            const rd = data[r] || {gender:'none', count:0};
            const box = document.getElementById(`box-${r}`);
            box.className = `status-box ${rd.gender}-room`;
            document.getElementById(`label-${r}`).innerText = rd.gender === 'none' ? '미정' : (rd.gender === 'male' ? '남성' : '여성');
            document.getElementById(`capa-${r}`).innerText = rd.count;
            if(isAdmin) {
                document.getElementById(`admin-select-${r}`).value = rd.gender;
                document.getElementById(`admin-capa-${r}`).value = rd.count;
            }
        });
    });
}

// ==========================================
// 6. 게시판 (등록 즉시 사라짐 방지)
// ==========================================
async function addBoardContent() {
    const a = document.getElementById('board-author').value;
    const p = document.getElementById('board-pw').value;
    const c = document.getElementById('board-content').value;
    
    if(!a || !c) {
        alert('내용을 입력해주세요.');
        return;
    }

    try {
        // 데이터 전송
        await database.ref('posts').push({
            author: a,
            pw: p || "0000",
            content: c,
            date: new Date().toLocaleDateString()
        });
        
        alert('비밀글이 등록되었습니다.');
        
        // 입력창 비우기 (새로고침 방지)
        document.getElementById('board-author').value = '';
        document.getElementById('board-pw').value = '';
        document.getElementById('board-content').value = '';
    } catch (e) {
        alert('등록 실패: ' + e.message);
    }
}

function renderBoard(posts) {
    const list = document.getElementById('board-list');
    if (!list) return;
    list.innerHTML = '';
    if(!posts) {
        list.innerHTML = '<p style="color:#777;">등록된 글이 없습니다.</p>';
        return;
    }

    Object.keys(posts).reverse().forEach(k => {
        const p = posts[k];
        const item = document.createElement('div'); 
        item.className = 'board-item';
        item.innerHTML = `
            <div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')">
                <span>🔒 비밀글 (${p.author})</span>
                <span>${p.date}</span>
            </div>
            <div class="board-item-content">
                ${isAdmin ? `<strong>[비번: ${p.pw}]</strong><br>${p.content}<br><button class="btn-secondary" onclick="deletePost('${k}')">삭제</button>` : 
                `<input type="password" id="pw-${k}" style="width:100px; background:#111; color:#fff; border:1px solid #444;">
                 <button class="btn-secondary" onclick="checkPw('${k}','${p.pw}')">확인</button>
                 <div id="tx-${k}" style="display:none; margin-top:10px; white-space:pre-wrap;">${p.content}</div>`}
            </div>`;
        list.appendChild(item);
    });
}

window.checkPw = (k, p) => {
    const input = document.getElementById(`pw-${k}`).value;
    if(input === p) document.getElementById(`tx-${k}`).style.display = 'block';
    else alert('비밀번호가 틀렸습니다.');
};

window.deletePost = (k) => {
    if(confirm('삭제하시겠습니까?')) database.ref(`posts/${k}`).remove();
};

// ==========================================
// 7. 기타 기능
// ==========================================
async function saveRoomGender(room) {
    if(!isAdmin) return;
    const g = document.getElementById(`admin-select-${room}`).value;
    const c = parseInt(document.getElementById(`admin-capa-${room}`).value);
    await database.ref(`rooms/${selectedDate}/${room}`).set({ gender: g, count: c });
    alert('저장되었습니다.');
}

async function saveLP() {
    if(!isAdmin) return;
    await database.ref('lp_schedule').set({
        morning: document.getElementById('input-lp-morning').value,
        evening: document.getElementById('input-lp-evening').value
    });
    alert('LP 스케줄 저장 완료');
}

async function saveGuideParams() {
    if(!isAdmin) return;
    await database.ref('guide').set(document.getElementById('admin-guide-textarea').value);
    alert('안내사항 반영 완료');
}

// 월 이동
document.getElementById('prev-month').onclick = () => {
    currentMonth--;
    if(currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
};
document.getElementById('next-month').onclick = () => {
    currentMonth++;
    if(currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
};
