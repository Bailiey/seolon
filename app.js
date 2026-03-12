// ==========================================
// 1. Mobile Menu Toggle
// ==========================================
const mobileMenu = document.querySelector('#mobile-menu');
const navMenu = document.querySelector('.nav-menu');

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
// 2. Admin Login System
// ==========================================
let isAdmin = false;

const btnAdminLogin = document.getElementById('btn-admin-login');
const btnAdminLogout = document.getElementById('btn-admin-logout');
const adminModal = document.getElementById('admin-modal');

btnAdminLogin.addEventListener('click', () => {
    adminModal.classList.add('active');
});

function closeAdminModal() {
    adminModal.classList.remove('active');
    document.getElementById('admin-pw').value = '';
}

function attemptAdminLogin() {
    const pw = document.getElementById('admin-pw').value;
    if (pw === 'admin') { 
        isAdmin = true;
        document.body.classList.add('admin-mode');
        btnAdminLogin.style.display = 'none';
        btnAdminLogout.style.display = 'block';
        closeAdminModal();
        alert('관리자 모드로 접속되었습니다.');
        
        if (selectedDate) renderRoomStatus(selectedDate);
    } else {
        alert('비밀번호가 틀렸습니다.');
    }
}

btnAdminLogout.addEventListener('click', () => {
    isAdmin = false;
    document.body.classList.remove('admin-mode');
    btnAdminLogin.style.display = 'block';
    btnAdminLogout.style.display = 'none';
    alert('로그아웃 되었습니다.');
});


// ==========================================
// 3. Calendar & Room Status (Mock DB via LocalStorage)
// ==========================================
let currentYear = 2026;
let currentMonth = 2; // 0-indexed (2 = 3월)
let selectedDate = null;

// 객실 정원 설정
const roomCapacities = {
    room3: 3,
    room4: 4,
    room6: 6
};

// 로컬 스토리지에서 예측 현황 가져오기
function getRoomData(dateStr) {
    const data = localStorage.getItem('guesthouse_rooms_' + dateStr);
    if (data) return JSON.parse(data);
    // 없으면 기본값
    return { 
        room3: { gender: 'none', count: 0 }, 
        room4: { gender: 'none', count: 0 }, 
        room6: { gender: 'none', count: 0 } 
    };
}

// 로컬 스토리지에 예약 현황 저장
function setRoomData(dateStr, roomData) {
    localStorage.setItem('guesthouse_rooms_' + dateStr, JSON.stringify(roomData));
}

const calendarBody = document.getElementById('calendar-body');
const monthDisplay = document.getElementById('current-month-display');
const roomStatusContainer = document.getElementById('room-status-container');
const selectedDateDisplay = document.getElementById('selected-date-display');

function renderCalendar() {
    calendarBody.innerHTML = '';
    
    // 요일 헤더
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach(d => {
        const div = document.createElement('div');
        div.className = 'cal-day head';
        div.innerText = d;
        calendarBody.appendChild(div);
    });

    monthDisplay.innerText = `${currentYear}. ${String(currentMonth + 1).padStart(2, '0')}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day empty';
        calendarBody.appendChild(div);
    }

    // 날짜 채우기
    for (let i = 1; i <= daysInMonth; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day';
        div.innerText = i;
        
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        div.dataset.date = dateStr;

        const roomData = getRoomData(dateStr);
        let isFullyBooked = true; // 예약이 모두 찼는지 여부 (3,4,6인실 정원 충족시)

        // 점 표시 (인디케이터)
        const indicatorContainer = document.createElement('div');
        indicatorContainer.className = 'room-indicators';
        
        ['room3', 'room4', 'room6'].forEach(room => {
            const rData = roomData[room];
            const dot = document.createElement('div');
            dot.className = `indicator ${rData.gender}`;
            indicatorContainer.appendChild(dot);
            
            if (rData.count < roomCapacities[room]) {
                isFullyBooked = false; // 한 방이라도 자리가 있으면 마감이 아님
            }
        });
        
        div.appendChild(indicatorContainer);

        // 예약 마감(Full) 배지
        if (isFullyBooked) {
            const badge = document.createElement('span');
            badge.className = 'full-text-badge';
            badge.innerText = '마감';
            div.appendChild(badge);
        }

        // 선택 상태 유지
        if (selectedDate === dateStr) {
            div.classList.add('selected');
        }

        div.addEventListener('click', () => {
            // 기존 선택 제거
            document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedDate = dateStr;
            renderRoomStatus(dateStr);
        });

        calendarBody.appendChild(div);
    }
}

document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
});

function renderRoomStatus(dateStr) {
    roomStatusContainer.style.display = 'block';
    selectedDateDisplay.innerText = `${dateStr} 예약 현황`;
    
    const roomData = getRoomData(dateStr);
    
    ['room3', 'room4', 'room6'].forEach(room => {
        const rData = roomData[room];
        
        const box = document.getElementById(`box-${room}`);
        const label = document.getElementById(`label-${room}`);
        const select = document.getElementById(`admin-select-${room}`);
        const capaInput = document.getElementById(`admin-capa-${room}`);
        const capaText = document.getElementById(`capa-${room}`);
        
        // CSS 클래스 정리
        box.classList.remove('male-room', 'female-room', 'none-room');
        
        const gender = rData.gender;
        if (gender === 'male') {
            box.classList.add('male-room');
            label.innerText = '남성 전용 (파랑)';
        } else if (gender === 'female') {
            box.classList.add('female-room');
            label.innerText = '여성 전용 (분홍)';
        } else {
            box.classList.add('none-room');
            label.innerText = '성별 미정';
        }

        // 인원 텍스트 업데이트
        capaText.innerText = rData.count;

        if (isAdmin) {
            select.value = gender;
            capaInput.value = rData.count;
        }
    });
}

// 관리자가 성별 및 예약 인원 강제 지정할 때
function saveRoomGender(room) {
    if (!selectedDate) return;
    const genderVal = document.getElementById(`admin-select-${room}`).value;
    const countVal = parseInt(document.getElementById(`admin-capa-${room}`).value, 10);
    
    const maxCapa = roomCapacities[room];
    if (countVal < 0 || countVal > maxCapa) {
        alert(`${room}의 최대 인원은 ${maxCapa}명입니다. 올바른 숫자를 입력하세요.`);
        return;
    }

    const roomData = getRoomData(selectedDate);
    roomData[room] = { gender: genderVal, count: countVal };
    setRoomData(selectedDate, roomData);
    alert('저장되었습니다.');
    
    // 달력 통째로 다시 렌더링 (마감 상태 갱신 필요)
    renderCalendar();
    renderRoomStatus(selectedDate);
}


// ==========================================
// 4. LP Schedule Management
// ==========================================
function loadLP() {
    const morning = localStorage.getItem('lp_morning') || '아이유 - 꽃갈피';
    const evening = localStorage.getItem('lp_evening') || '검정치마 - TeamBaby';
    
    document.getElementById('lp-morning-text').innerText = morning;
    document.getElementById('lp-evening-text').innerText = evening;
    
    document.getElementById('input-lp-morning').value = morning;
    document.getElementById('input-lp-evening').value = evening;
}

function saveLP() {
    const morning = document.getElementById('input-lp-morning').value;
    const evening = document.getElementById('input-lp-evening').value;
    
    localStorage.setItem('lp_morning', morning);
    localStorage.setItem('lp_evening', evening);
    
    alert('LP 스케줄이 저장되었습니다.');
    loadLP();
}


// ==========================================
// 5. Guide Management
// ==========================================
function loadGuide() {
    const defaultGuide = `주차 안내:
- 서론 앞 50m 공영주차장을 이용하실 수 있습니다. (무료)

통금 및 에티켓:
- 자정 24:00 에는 모든 공용 공간이 소등되며 외출입이 통제됩니다.
- 밤 10시 이후에는 다른 게스트들의 숙면을 위해 소음을 자제해 주세요.

체크인 / 체크아웃:
- 체크인: 16:00 부터
- 체크아웃: 10:30 까지`;

    const guideContent = localStorage.getItem('guesthouse_guide') || defaultGuide;
    
    document.getElementById('guide-display-content').innerText = guideContent;
    document.getElementById('admin-guide-textarea').value = guideContent;
}

function saveGuideParams() {
    const content = document.getElementById('admin-guide-textarea').value;
    localStorage.setItem('guesthouse_guide', content);
    alert('기타 안내사항이 반영되었습니다.');
    loadGuide();
}


// ==========================================
// 6. Community Board (Mock System)
// ==========================================
function loadBoard() {
    const boardList = document.getElementById('board-list');
    const posts = JSON.parse(localStorage.getItem('board_posts') || '[]');
    
    boardList.innerHTML = '';
    
    if (posts.length === 0) {
        boardList.innerHTML = '<p style="color:#777;">등록된 글이 없습니다.</p>';
        return;
    }

    posts.reverse().forEach((post, index) => {
        const item = document.createElement('div');
        item.className = 'board-item';
        
        // 제목 바
        const titleBar = document.createElement('div');
        titleBar.className = 'board-item-title';
        titleBar.innerHTML = `
            <span>🔒 비밀글입니다. (작성자: ${post.author})</span>
            <span class="board-item-meta">${post.date}</span>
        `;
        
        // 내용
        const contentBox = document.createElement('div');
        contentBox.className = 'board-item-content';
        
        if (isAdmin) {
            contentBox.innerText = `[비밀번호: ${post.pw}]\n\n${post.content}`;
            
            // 삭제 버튼 (관리자만)
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-secondary mt-3';
            delBtn.style.padding = '3px 10px';
            delBtn.innerText = '게시글 삭제';
            delBtn.onclick = () => deletePost(index); // reverse 되었으므로 인덱스 주의 - 편의상 나열
            contentBox.appendChild(delBtn);
            
        } else {
            contentBox.innerHTML = `
                <input type="password" id="check-pw-${index}" placeholder="글 작성 시 입력한 비밀번호" style="padding:5px; margin-bottom:10px; background:#111; border:1px solid #444; color:#fff;">
                <button class="btn-secondary" style="padding:5px 10px;" onclick="verifyPostPw(${index}, '${post.pw}')">확인</button>
                <div id="content-display-${index}" style="margin-top:10px; display:none; white-space: pre-wrap;">${post.content}</div>
            `;
        }
        
        titleBar.addEventListener('click', () => {
            contentBox.classList.toggle('active');
        });

        item.appendChild(titleBar);
        item.appendChild(contentBox);
        boardList.appendChild(item);
    });
}

function verifyPostPw(index, realPw) {
    const inputPw = document.getElementById(`check-pw-${index}`).value;
    if (inputPw === realPw) {
        document.getElementById(`content-display-${index}`).style.display = 'block';
    } else {
        alert('비밀번호가 일치하지 않습니다.');
    }
}

function deletePost(reversedIndex) {
    const posts = JSON.parse(localStorage.getItem('board_posts') || '[]');
    // reverse 배열의 인덱스이므로 원본 인덱스는 posts.length - 1 - reversedIndex
    const realIndex = posts.length - 1 - reversedIndex;
    
    if (confirm('이 게시글을 삭제하시겠습니까?')) {
        posts.splice(realIndex, 1);
        localStorage.setItem('board_posts', JSON.stringify(posts));
        loadBoard();
    }
}

function addBoardContent() {
    const author = document.getElementById('board-author').value;
    const pw = document.getElementById('board-pw').value;
    const content = document.getElementById('board-content').value;
    
    if (!author || !pw || !content) {
        alert('모든 항목을 입력해주세요.');
        return;
    }
    
    const posts = JSON.parse(localStorage.getItem('board_posts') || '[]');
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

    posts.push({ author, pw, content, date: dateStr });
    localStorage.setItem('board_posts', JSON.stringify(posts));
    
    alert('비밀글이 등록되었습니다.');
    
    document.getElementById('board-author').value = '';
    document.getElementById('board-pw').value = '';
    document.getElementById('board-content').value = '';
    
    loadBoard();
}

// ==========================================
// 7. Initialize App
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 기존 데이터 포맷이 변경되었으므로 안전을 위해 오래된 버전을 쓰는 경우를 막기 위함
    // (이전 { room3: 'male' } -> 현재 { room3: {gender: 'male', count:0} })
    // 실제 라이브에서는 마이그레이션이 필요함
    
    renderCalendar();
    loadLP();
    loadGuide();
    loadBoard();
});
