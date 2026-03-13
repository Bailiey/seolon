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
    
    // 로그인 버튼 클릭 시 모달 열기
    document.getElementById('btn-admin-login').onclick = () => {
        document.getElementById('admin-modal').classList.add('active');
    };
    
    // 로그아웃 로직
    document.getElementById('btn-admin-logout').onclick = async () => {
        await auth.signOut(); 
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        document.getElementById('btn-admin-login').style.display = 'block';
        document.getElementById('btn-admin-logout').style.display = 'none';
        renderCalendar();
        alert('로그아웃 되었습니다.');
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
        
        // [복구] 만실 체크 로직 (디자인 적용)
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
        await auth.signInAnonymously(); 
        isAdmin = true;
        
        // 1. 관리자 모드 시각화 (CSS 연동)
        document.body.classList.add('admin-mode');
        
        // 2. 숨겨진 관리자 요소들 강제 표시
        document.querySelectorAll('.admin-editable, .lp-admin-inputs').forEach(el => {
            el.style.display = 'block';
        });
        
        document.getElementById('btn-admin-login').style.display = 'none';
        document.getElementById('btn-admin-logout').style.display = 'block';
        document.getElementById('admin-modal').classList.remove('active');
        document.getElementById('admin-pw').value = '';
        
        // 3. 데이터 즉시 갱신
        renderCalendar();
        alert('관리자 모드로 로그인되었습니다.');
    } else {
        alert('비밀번호가 틀렸습니다.');
    }
}

function closeAdminModal() { 
    document.getElementById('admin-modal').classList.remove('active'); 
}

async function addBoardContent() {
    const authorInput = document.getElementById('board-author');
    const pwInput = document.getElementById('board-pw');
    const contentInput = document.getElementById('board-content');

    const author = authorInput.value.trim();
    const pw = pwInput.value.trim();
    const content = contentInput.value.trim();

    if (!author || !content) {
        return alert('닉네임과 내용을 입력해주세요.');
    }

    try {
        // Firebase에 데이터 밀어넣기 (id를 자동으로 생성하는 push 사용)
        await database.ref('posts').push({
            author: author,
            pw: pw,
            content: content,
            date: new Date().toLocaleDateString()
        });

        alert('이야기가 등록되었습니다.');

        // 입력창 초기화
        authorInput.value = '';
        pwInput.value = '';
        contentInput.value = '';
        
    } catch (error) {
        console.error("데이터 저장 오류:", error);
        alert('저장에 실패했습니다. 다시 시도해주세요.');
    }
}

// 2. 게시판 렌더링 함수 수정 (데이터 구조 충돌 방지)
function renderBoard(posts) {
    const list = document.getElementById('board-list');
    if (!list) return;
    
    list.innerHTML = '';
    if (!posts) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:20px;">아직 작성된 이야기가 없습니다.</p>';
        return;
    }

    // 최신글이 위로 오도록 역순 정렬하여 출력
    Object.keys(posts).reverse().forEach(key => {
        const p = posts[key];
        const item = document.createElement('div');
        item.className = 'board-item';
        
        // 사장님의 '#2'번 디자인 레이아웃 그대로 유지
        item.innerHTML = `
            <div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')">
                <span>🔒 비밀글 (${p.author})</span>
                <span>${p.date}</span>
            </div>
            <div class="board-item-content">
                ${isAdmin ? `
                    <div style="color:var(--accent-color); margin-bottom:10px;">[비밀번호: ${p.pw}]</div>
                    <div style="margin-bottom:10px;">${p.content}</div>
                    <button class="btn-secondary" style="font-size:0.8rem;" onclick="deletePost('${key}')">삭제</button>
                ` : `
                    <div id="pw-area-${key}">
                        <input type="password" id="pw-${key}" placeholder="비밀번호 입력" style="width:100px; background:#111; color:#fff; border:1px solid #333; padding:5px;">
                        <button class="btn-secondary" style="padding:5px 10px;" onclick="checkPw('${key}', '${p.pw}')">확인</button>
                    </div>
                    <div id="tx-${key}" style="display:none; margin-top:10px; white-space:pre-wrap;">${p.content}</div>
                `}
            </div>
        `;
        list.appendChild(item);
    });
}

// 부가 기능 (체크/삭제/저장)
window.checkPw = (k, p) => { if(document.getElementById(`pw-${k}`).value === p) document.getElementById(`tx-${k}`).style.display = 'block'; else alert('비밀번호 틀림'); };
window.deletePost = (k) => { if(confirm('삭제하시겠습니까?')) database.ref(`posts/${k}`).remove(); };

async function saveRoomGender(r) { 
    if(!isAdmin) return; 
    const count = parseInt(document.getElementById(`admin-capa-${r}`).value);
    const max = roomCapacities[r];
    if (count > max) return alert(`${max}명을 초과할 수 없습니다.`);
    await database.ref(`rooms/${selectedDate}/${r}`).set({ gender: document.getElementById(`admin-select-${r}`).value, count: count }); 
    alert('저장되었습니다.'); 
}

async function saveLP() { 
    if(!isAdmin) return; 
    await database.ref('lp_schedule').set({ morning: document.getElementById('input-lp-morning').value, evening: document.getElementById('input-lp-evening').value }); 
    alert('LP 정보가 저장되었습니다.'); 
}

async function saveGuideParams() { 
    if(!isAdmin) return; 
    await database.ref('guide').set(document.getElementById('admin-guide-textarea').value); 
    alert('안내사항이 저장되었습니다.'); 
}

document.getElementById('prev-month').onclick = () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(); };
