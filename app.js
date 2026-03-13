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
        
        // 3. [중요!] 데이터 즉시 갱신
        renderCalendar(); // 예약현황 갱신
        
        // ★ 이 코드를 추가하세요! ★
        // 게시판 데이터를 다시 불러와서 관리자 모드로 즉시 다시 그립니다.
        database.ref('posts').once('value', (snap) => {
            renderBoard(snap.val());
        });
        
        alert('관리자 모드로 로그인되었습니다.');
    } else {
        alert('비밀번호가 틀렸습니다.');
    }
}

function closeAdminModal() { 
    document.getElementById('admin-modal').classList.remove('active'); 
}

/* =========================================
   게시판 운영 로직 (관리자 프리패스 포함)
   ========================================= */

let currentPage = 1;
const postsPerPage = 5;

// 1. 게시글 등록
async function addBoardContent() {
    const author = document.getElementById('board-author').value.trim();
    const pw = document.getElementById('board-pw').value.trim();
    const content = document.getElementById('board-content').value.trim();

    if (!author || !content) return alert('닉네임과 내용을 입력해주세요.');

    try {
        await database.ref('posts').push({
            author, pw, content,
            date: new Date().toLocaleDateString(),
            reply: "" 
        });
        alert('이야기가 등록되었습니다.');
        document.getElementById('board-author').value = '';
        document.getElementById('board-pw').value = '';
        document.getElementById('board-content').value = '';
    } catch (e) { alert('저장에 실패했습니다.'); }
}

// 2. 관리자 답변 저장
async function saveReply(key) {
    const replyText = document.getElementById(`reply-input-${key}`).value;
    await database.ref(`posts/${key}/reply`).set(replyText);
    alert('답변이 등록되었습니다.');
}

// 3. 게시글 삭제
async function deletePost(key) {
    if(confirm('정말 이 글을 삭제하시겠습니까?')) {
        await database.ref(`posts/${key}`).remove();
        alert('삭제되었습니다.');
    }
}

// 4. 비밀번호 확인 (손님용)
window.checkPw = (key, correctPw) => {
    const inputPw = document.getElementById(`pw-${key}`).value;
    if(inputPw === correctPw) {
        document.getElementById(`pw-area-${key}`).style.display = 'none';
        document.getElementById(`tx-${key}`).style.display = 'block';
    } else {
        alert('비밀번호가 일치하지 않습니다.');
    }
};

// 5. 게시판 렌더링 (핵심: 관리자 프리패스 로직)
function renderBoard(posts) {
    const list = document.getElementById('board-list');
    if (!list) return;
    list.innerHTML = '';

    if (!posts) {
        list.innerHTML = '<p style="text-align:center; padding:20px;">아직 작성된 이야기가 없습니다.</p>';
        return;
    }

    const postKeys = Object.keys(posts).reverse();
    const totalPosts = postKeys.length;
    
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const paginatedKeys = postKeys.slice(startIndex, endIndex);

    paginatedKeys.forEach(key => {
        const p = posts[key];
        const item = document.createElement('div');
        item.className = 'board-item';
        
        // 관리자(isAdmin)인 경우 처음부터 내용을 보여주고 답변창을 띄움
        const boardBody = isAdmin ? `
            <div class="admin-view-area">
                <div style="color:var(--accent-color); margin-bottom:10px; font-size:0.9rem;">[비밀번호: ${p.pw}]</div>
                <div style="white-space:pre-wrap; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">${p.content}</div>
                <div class="reply-section">
                    <textarea id="reply-input-${key}" placeholder="답변을 입력하세요" style="width:100%; background:#111; color:#fff; border:1px solid #444; padding:10px; font-size:0.9rem;">${p.reply || ''}</textarea>
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <button class="btn-primary" style="padding:5px 15px; font-size:0.8rem;" onclick="saveReply('${key}')">답변저장</button>
                        <button class="btn-secondary" style="padding:5px 15px; font-size:0.8rem;" onclick="deletePost('${key}')">삭제</button>
                    </div>
                </div>
            </div>
        ` : `
            <div id="pw-area-${key}">
                <input type="password" id="pw-${key}" placeholder="비밀번호" style="width:100px; background:#111; color:#fff; border:1px solid #333; padding:5px;">
                <button class="btn-secondary" style="padding:5px 10px;" onclick="checkPw('${key}', '${p.pw}')">확인</button>
            </div>
            <div id="tx-${key}" style="display:none; margin-top:10px;">
                <div style="white-space:pre-wrap; margin-bottom:15px;">${p.content}</div>
                ${p.reply ? `<div style="background:#222; padding:15px; border-left:3px solid var(--accent-color);">
                    <strong style="color:var(--accent-color); display:block; margin-bottom:5px;">서론 사장님 답변</strong>
                    <div style="white-space:pre-wrap; font-size:0.95rem;">${p.reply}</div>
                </div>` : ''}
            </div>
        `;

        item.innerHTML = `
            <div class="board-item-title" onclick="this.nextElementSibling.classList.toggle('active')">
                <span>🔒 비밀글 (${p.author}) ${p.reply ? '<span style="color:var(--accent-color); font-size:0.8rem; margin-left:5px;">[답변완료]</span>' : ''}</span>
                <span>${p.date}</span>
            </div>
            <div class="board-item-content">
                ${boardBody}
            </div>
        `;
        list.appendChild(item);
    });

    renderPagination(totalPosts);
}

// 6. 페이징 번호
function renderPagination(totalPosts) {
    const list = document.getElementById('board-list');
    const totalPages = Math.ceil(totalPosts / postsPerPage);
    if(totalPages <= 1) return;

    const nav = document.createElement('div');
    nav.style = "display:flex; justify-content:center; gap:10px; margin-top:25px;";

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('span');
        btn.innerText = i;
        btn.style = `cursor:pointer; padding:5px 12px; border:1px solid ${i === currentPage ? 'var(--accent-color)' : '#444'}; color:${i === currentPage ? 'var(--accent-color)' : '#fff'}; border-radius:4px; font-size:0.9rem;`;
        btn.onclick = () => { currentPage = i; database.ref('posts').once('value', snap => renderBoard(snap.val())); };
        nav.appendChild(btn);
    }
    list.appendChild(nav);
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
