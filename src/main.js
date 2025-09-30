import { initDB, getAllActivities, addActivity, deleteActivity, getActivity, updateActivity } from './db/indexedDB.js';
import { initMap, setInitialView, invalidateMapSize, startTracking, stopTracking, drawPath, getPathCoordinates, clearPath } from './map/mapHandler.js';
import { renderCalendar } from './ui/calendar.js';

// DOM 요소 선택
const $calendarView = document.getElementById('calendar-view');
const $detailView = document.getElementById('detail-view');
const $mapContainer = document.getElementById('map'); // 상세 뷰의 일부
const $backToCalendarBtn = document.getElementById('back-to-calendar-btn');
const $detailDate = document.getElementById('detail-date');
const $detailTitleInput = document.getElementById('detail-title-input');
const $startTrackingBtn = document.getElementById('start-tracking-btn');
const $pauseTrackingBtn = document.getElementById('pause-tracking-btn'); // '중지' 버튼은 아직 기능 미구현
const $stopTrackingBtn = document.getElementById('stop-tracking-btn');
const $saveActivityBtn = document.getElementById('save-activity-btn');

// 애플리케이션 상태
let state = {
  currentView: 'calendar', // 'calendar' or 'detail'
  currentDate: new Date(),
  activities: [],
  currentActivityId: null,
  isMapInitialized: false, // 지도 초기화 여부 플래그
};

/**
 * 상태를 기반으로 전체 UI를 다시 렌더링합니다.
 */
function rerender() {
  renderCalendar($calendarView, state.currentDate, state.activities);
  // 뷰 전환
  if (state.currentView === 'calendar') {
    $calendarView.classList.remove('hidden');
    $detailView.classList.add('hidden');
  } else {
    $calendarView.classList.add('hidden');
    $detailView.classList.remove('hidden');
    invalidateMapSize(); // 지도가 다시 표시될 때 크기 재계산
  }
}

/**
 * 데이터베이스에서 활동을 로드하고 상태를 업데이트합니다.
 */
async function loadActivities() {
  state.activities = await getAllActivities();
  rerender();
}

/**
 * 활동 기록 제어 버튼의 활성화/비활성화 상태를 업데이트합니다.
 * @param {boolean} disabled - 비활성화 여부
 */
function updateTrackingButtonsState(disabled) {
  $startTrackingBtn.disabled = disabled;
  $pauseTrackingBtn.disabled = disabled;
  $stopTrackingBtn.disabled = disabled;
}

/**
 * 상세 뷰를 표시하고 데이터를 채웁니다.
 * @param {number | null} activityId - 표시할 활동의 ID. null이면 새 활동 등록.
 * @param {string} date - 활동 날짜 (YYYY-MM-DD)
 */
async function showDetailView(activityId, date) {
  // 상세 뷰가 처음 열릴 때 딱 한 번만 지도를 초기화합니다.
  if (!state.isMapInitialized) {
    initMap($mapContainer);
    setInitialView();
    state.isMapInitialized = true;
  }

  state.currentActivityId = activityId;
  state.currentView = 'detail';

  // 상세 뷰를 열 때마다 이전 경로를 초기화합니다.
  clearPath();

  let activity = { title: '', date, path_coordinates: [], location_markers: [] };
  if (activityId) {
    activity = await getActivity(activityId);
    updateTrackingButtonsState(false); // 기존 활동이므로 버튼 활성화
  }

  // 상세 뷰 데이터 설정
  const displayDate = new Date(date.replace(/-/g, '/')); // Safari 호환성
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  $detailDate.textContent = `${displayDate.getFullYear()}. ${String(displayDate.getMonth() + 1).padStart(2, '0')}. ${String(displayDate.getDate()).padStart(2, '0')}. ${dayNames[displayDate.getDay()]}.`;
  $detailTitleInput.value = activity.title;

  // 새 활동인 경우 버튼 비활성화
  if (!activityId) {
    updateTrackingButtonsState(true);
  }

  // DB에서 불러온 활동의 기존 경로를 지도에 그립니다.
  drawPath(activity.path_coordinates || []);

  rerender();
}

function showCalendarView() {
  state.currentView = 'calendar';
  rerender();
}

/**
 * 애플리케이션 초기화 함수
 */
async function initializeApp() {
  try {
    // 1. IndexedDB 초기화
    await initDB();
    console.log('Database initialized successfully.');

    // 2. 활동 데이터 로드 및 캘린더 뷰 렌더링
    // 지도 초기화는 상세 뷰가 처음 열릴 때로 이동했습니다.
    await loadActivities();
  } catch (error) {
    console.error('Failed to initialize the application:', error);
    alert('애플리케이션 초기화에 실패했습니다. 페이지를 새로고침 해주세요.');
  }
}

// --- 이벤트 핸들러 ---

/**
 * 상세 뷰에서 '저장' 버튼 클릭을 처리하는 핸들러
 */
async function handleSaveActivity() {
  const newTitle = $detailTitleInput.value.trim();
  if (!newTitle) {
    alert('활동 제목을 입력해주세요.');
    return;
  }

  try {
    if (state.currentActivityId) {
      // 기존 활동 업데이트
      const activity = await getActivity(state.currentActivityId);
      activity.title = newTitle;
      activity.path_coordinates = getPathCoordinates(); // 현재까지 기록된 경로 저장
      await updateActivity(activity);
      alert('활동이 수정되었습니다.');
    } else {
      // 새 활동 생성
      const date = $detailDate.textContent.split('. ').slice(0, 3).join('-').replace(/\s/g, '');
      const newActivity = {
        date,
        title: newTitle,
        path_coordinates: getPathCoordinates(), // 현재까지 기록된 경로 저장
        location_markers: [],
      };
      const newId = await addActivity(newActivity);
      state.currentActivityId = newId; // 상태에 새로운 ID 저장
      updateTrackingButtonsState(false); // 새 활동 저장 후 버튼 활성화
      alert('새로운 활동이 저장되었습니다.');
    }
    // 저장이 성공하면 활동 목록을 다시 불러와 UI를 갱신합니다.
    // 이렇게 하면 캘린더 뷰로 돌아갔을 때 변경사항이 반영됩니다.
    await loadActivities();
  } catch (error) {
    alert('저장에 실패했습니다: ' + error);
  }
}

/**
 * '시작' 버튼 클릭을 처리하는 핸들러
 */
function handleStartTracking() {
  startTracking();
  alert('활동 기록을 시작합니다.');
}

/**
 * '종료' 버튼 클릭을 처리하는 핸들러
 */
function handleStopTracking() {
  stopTracking();
  alert('활동 기록을 종료합니다. 변경사항을 저장해주세요.');
}
/**
 * 캘린더 뷰의 클릭 이벤트를 처리하는 핸들러 (이벤트 위임)
 * @param {MouseEvent} e - 클릭 이벤트 객체
 */
async function handleCalendarClick(e) {
  const target = e.target;

  // 연/월 탐색
  if (target.id === 'prev-year-btn') state.currentDate.setFullYear(state.currentDate.getFullYear() - 1);
  else if (target.id === 'next-year-btn') state.currentDate.setFullYear(state.currentDate.getFullYear() + 1);
  else if (target.id === 'prev-month-btn') state.currentDate.setMonth(state.currentDate.getMonth() - 1);
  else if (target.id === 'next-month-btn') state.currentDate.setMonth(state.currentDate.getMonth() + 1);

  // 활동 추가
  else if (target.classList.contains('add-activity-btn')) {
    // CONTEXT.md에 따라 상세 뷰를 보여줌 (새 활동 등록)
    const dateForNewActivity = target.dataset.date;
    showDetailView(null, dateForNewActivity);
    return;
  }

  // 활동 메뉴 (삭제)
  else if (target.classList.contains('activity-menu-btn')) {
    const activityId = Number(target.dataset.activityId);
    // TODO: '..' 버튼 클릭 시 팝업 메뉴(삭제 등) 표시 로직 구현
    if (confirm('이 활동을 삭제하시겠습니까?')) {
      await deleteActivity(activityId);
      await loadActivities();
    }
    return;
  }

  // 활동 제목 클릭 (상세보기)
  else if (target.classList.contains('activity-title')) {
    const activityId = Number(target.parentElement.dataset.activityId);
    const activity = state.activities.find(a => a.activityId === activityId);
    showDetailView(activityId, activity.date);
    return;
  }

  // 날짜 변경이 있었을 경우에만 리렌더링
  if (target.id.includes('-btn')) {
    rerender();
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
$calendarView.addEventListener('click', handleCalendarClick);
$backToCalendarBtn.addEventListener('click', showCalendarView);
$saveActivityBtn.addEventListener('click', handleSaveActivity);
$startTrackingBtn.addEventListener('click', handleStartTracking);
$stopTrackingBtn.addEventListener('click', handleStopTracking);