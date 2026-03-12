// ==========================================
// 1. 초기 변수 및 설정
// ==========================================
let isAdmin = false;
let currentYear = 2026;
let currentMonth = 2; // 0-indexed (2 = 3월)
let selectedDate = null;

// 각 객실의 최대 정원 설정
const roomCapacities = {
    room3: 3,
    room4: 4,
    room6: 6
};

// ==========================================
// 2. 페이지 초기화 및 이벤트 리스너
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 실시간 서버 감시 시작 (가장 중요!)
    initRealtimeListeners();
    renderCalendar();
    
    // 모바일 메뉴 토글
    const mobileMenu = document.querySelector('#mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('is-active');
        navMenu.classList.toggle('active');
    });

    // 메뉴 클릭 시 닫기
    const navLinks = document.querySelectorAll('.nav-links');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('is-active');
            navMenu.classList.remove('active');
        });
    });

    // 관리자 로그인/로그아웃 버튼 클릭
    document.getElementById('btn-admin-login').addEventListener('click', () => {
        document.getElementById('admin-modal').classList.add('active');
    });

    document.getElementById('btn-admin-logout').addEventListener('click', async () => {
        await auth.signOut();
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'block';
        document.getElementById('btn-admin-logout').style.display = 'none';
        alert('로그아웃 되었습니다.');
        renderCalendar(); // 관리자 도구 숨기기 위해 재렌더링
    });
});

// ==========================================
// 3. 실시간 데이터 감시 (Firebase)
// ==========================================
function initRealtimeListeners() {
    // 예약 데이터가 바뀌면 달력을 다시 그림
    database.ref('rooms').on('value', () => {
        renderCalendar();
        if (selectedDate) refreshRoomStatusFromDB();
    });

    // LP 스케줄 감시
    database.ref('lp_schedule').on('value', (snapshot) => {
        const val = snapshot.val() || { morning: '아이유 - 꽃갈피', evening: '검정치마 - TeamBaby' };
        document.getElementById('lp-morning-text').innerText = val.morning;
        document.getElementById('lp-evening-text').innerText = val.evening;
        document.getElementById('input-lp-morning').value = val.morning;
        document.getElementById('input-lp-evening').value = val.evening;
    });

    // 안내사항 감시
    database.ref('guide').on('value', (snapshot) => {
        const val = snapshot.val() || "기본 안내사항입니다.";
        document.getElementById('guide-display-content').innerText = val;
        document.getElementById('admin-guide-textarea').value = val;
    });

    // 게시판 감시
    database.ref('posts').on('value', (snapshot) => {
        renderBoard(snapshot.val());
    });
}

// ==========================================
// 4. 관리자 로그인 (admin 비밀번호 입력 시)
// ==========================================
async function attemptAdminLogin() {
    const pw = document.getElementById('admin-pw').value;
    if (pw === 'admin') { 
        try {
            // 파이어베이스 익명 인증으로 서버 쓰기 권한 획득
            await auth.signInAnonymously(); 
            isAdmin = true;
            document.body.classList.add('admin-mode');
            document.getElementById('btn-admin-login').style.display = 'none';
            document.getElementById('btn-admin-logout').style.display = 'block';
            document.getElementById('admin-modal').classList.remove('active');
            document.getElementById('admin-pw').value = '';
            alert('관리자 모드로 접속되었습니다.');
            renderCalendar();
        } catch (e) {
            alert('인증 오류: ' + e.message);
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
// 5. 달력 및 예약 관리 로직
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

    // 공백 채우기
    for (let i = 0; i < firstDay; i++) {
        body.appendChild(Object.assign(document.createElement('div'), {className:'cal-day empty'}));
    }

    // 서버 데이터를 한 번 가져와서 날짜 채우기
    database.ref('rooms').once('value', (snapshot) => {
        const roomsData = snapshot.val() || {};
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const div = document.createElement('div');
            div.className = 'cal-day';
            div.innerText = i;
            div.dataset.date = dateStr;
            if (selectedDate === dateStr) div.classList.add('selected');

            const dayData = roomsData[dateStr] || { room3:{gender:'none',count:0}, room4:{gender:'none',count:0}, room6:{gender:'none',count:0} };

            // 인디케이터(점) 및 마감 여부 계산
            const ind = document.createElement('div');
            ind.className = 'room-indicators';
            let isFull = true;

            ['room3','room4','room6'].forEach(r => {
                const rInfo = dayData[r] || {gender:'none', count:0};
                const dot = document.createElement('div');
                dot.className = `indicator ${rInfo.gender}`;
                ind.appendChild(dot);
                if (rInfo.count < roomCapacities[r]) isFull = false;
            });
            div.appendChild(ind);

            if (isFull) {
                const badge = document.createElement('span');
                badge.className = 'full-text-badge'; badge.innerText = '마감';
                div.appendChild(badge);
            }

            div.onclick = () => {
                document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedDate = dateStr;
                refreshRoomStatusFromDB();
            };
            body.appendChild(div);
        }
    });
}

function refreshRoomStatusFromDB() {
    const container = document.getElementById('room-status-container');
    container.style.display = 'block';
    document.getElementById('selected-date-display').innerText = `${selectedDate} 현황`;
    
    database.ref(`rooms/${selectedDate}`).once('value', (snap) => {
        const data = snap.val() || {};
        ['room3','room4','room6'].forEach(r => {
            const info = data[r] || {gender:'none', count:0};
            const box = document.getElementById(`box-${r}`);
            box.className = `status-box ${info.gender}-room`;
            document.getElementById(`label-${r}`).innerText = info.gender === 'none' ? '미정' : (info.gender === 'male' ? '남성' : '여성');
            document.getElementById(`capa-${r}`).innerText = info.count;
            
            if (isAdmin) {
                document.getElementById(`admin-select-${r}`).value = info.gender;
                document.getElementById(`admin-capa-${r}`).value = info.count;
            }
        });
    });
}

async function saveRoomGender(room) {
    if (!isAdmin) return alert('관리자 로그인이 필요합니다.');
    const g = document.getElementById(`admin-select-${room}`).value;
    const c = parseInt(document.getElementById(`admin-capa-${room}`).value);
    
    if (c < 0 || c > roomCapacities[room]) return alert('정원 범위 초과!');

    await database.ref(`rooms/${selectedDate}/${room}`).set({ gender: g, count: c });
    alert('저장되었습니다.');
}

// ==========================================
// 6. LP, 가이드, 게시판 관리
// ==========================================
async function saveLP() {
    if (!isAdmin) return alert('권한 없음');
    await database.ref('lp_schedule').set({
        morning: document.getElementById('input-lp-morning').value,
        evening: document.getElementById('input-lp-evening').value
    });
    alert('LP 저장 완료');
}

async function saveGuideParams() {
    if (!isAdmin) return alert('권한 없음');
    await database.ref('guide').set(document.getElementById('admin-guide-textarea').value);
    alert('안내사항 저장 완료');
}

async function addBoardContent() {
    const author = document.getElementById('board-author').value;
    const pw = document.getElementById('board-pw').value;
    const content = document.getElementById('board-content').value;
    if (!author || !content) return alert('내용을 입력하세요.');

    await database.ref('posts').push().set({
        author, pw, content, date: new Date().toLocaleDateString()
    });
    document.getElementById('board-author').value = '';
    document.getElementById('board-pw').value = '';
    document.getElementById('board-content').value = '';
    alert('비밀글이 서버에 등록되었습니다.');
}

function renderBoard(posts) {
    const list = document.getElementById('board-list');
    list.innerHTML = '';
    if (!posts) return list.innerHTML = '<p>등록된 글이 없습니다.</p>';

    Object.keys(posts).reverse().forEach(key => {
        const post = posts[key];
        const item = document.createElement('div');
        item.className = 'board-item';
        item.innerHTML = `
            <div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')">
                <span>🔒 비밀글 (작성자: ${post.author})</span>
                <span class="board-item-meta">${post.date}</span>
            </div>
            <div class="board-item-content">
                ${isAdmin ? `<strong>[비밀번호: ${post.pw}]</strong><br>${post.content}<br><button class="btn-secondary mt-3" onclick="deletePost('${key}')">삭제</button>` : 
                `<input type="password" id="check-pw-${key}" placeholder="비밀번호" style="width:100px; background:#111; color:#fff; border:1px solid #444; padding:5px;">
                 <button class="btn-secondary" onclick="verifyPw('${key}', '${post.pw}')">확인</button>
                 <div id="content-display-${key}" style="display:none; margin-top:10px; white-space:pre-wrap;">${post.content}</div>`}
            </div>
        `;
        list.appendChild(item);
    });
}

window.verifyPw = (key, realPw) => {
    const inputPw = document.getElementById(`check-pw-${key}`).value;
    if (inputPw === realPw) document.getElementById(`content-display-${key}`).style.display = 'block';
    else alert('비밀번호가 틀렸습니다.');
};

window.deletePost = async (key) => {
    if (confirm('삭제하시겠습니까?')) await database.ref(`posts/${key}`).remove();
};

// 달력 이동
document.getElementById('prev-month').onclick = () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(); };
