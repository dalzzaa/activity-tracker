import { initDB, getAllActivities, addActivity, deleteActivity, getActivity, updateActivity, addMedia, getMedia } from './db/indexedDB.js';
import { initMap, setInitialView, invalidateMapSize, startTracking, stopTracking, drawPath, getPathCoordinates, clearPath, snapToRoad, addLocationMarker } from './map/mapHandler.js';
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
const $memoModal = document.getElementById('memo-modal');
const $modalBackdrop = document.getElementById('modal-backdrop');
const $memoCoords = document.getElementById('memo-coords');
const $memoTextarea = document.getElementById('memo-textarea');
const $memoSaveBtn = document.getElementById('memo-save-btn');
const $memoCancelBtn = document.getElementById('memo-cancel-btn');
const $takePhotoBtn = document.getElementById('take-photo-btn');
const $selectPhotoBtn = document.getElementById('select-photo-btn');
const $takePhotoInput = document.getElementById('take-photo-input');
const $selectPhotoInput = document.getElementById('select-photo-input');
const $photoPreviewContainer = document.getElementById('photo-preview-container'); 
const $imageZoomModal = document.getElementById('image-zoom-modal');
const $zoomedImage = document.getElementById('zoomed-image');

// 애플리케이션 상태
let state = {
  currentView: 'calendar', // 'calendar' or 'detail'
  currentDate: new Date(),
  activities: [],
  currentActivityId: null,
  currentActivityDate: null, // 상세 뷰에 표시 중인 활동의 날짜
  isMapInitialized: false, // 지도 초기화 여부 플래그 
  currentMemo: { latlng: null, photoBlobs: [], markerId: null }, // 현재 편집 중인 메모 정보
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
    // 상세 뷰가 다시 활성화될 때, 백그라운드에서 변경되었을 수 있는
    // 경로를 다시 그려주어 최신 상태를 반영합니다.
    // (요구사항 3: 다른 화면 전환 후 복귀 시 경로 업데이트)
    drawPath(getPathCoordinates());
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
    initMap($mapContainer, handleMapClick); // 지도 클릭 핸들러 전달
    setInitialView();
    state.isMapInitialized = true;
  }

  state.currentActivityId = activityId;
  state.currentActivityDate = date; // 현재 활동의 날짜를 상태에 저장
  state.currentView = 'detail';

  // 상세 뷰를 열 때마다 이전 경로를 초기화합니다.
  clearPath();

  let activity = { title: '', date, path_coordinates: [], location_markers: [] };
  if (activityId) {
    activity = await getActivity(activityId);
    updateTrackingButtonsState(false); // 기존 활동이므로 버튼 활성화
  }

  // 상세 뷰 데이터 설정
  const displayDate = new Date(date); // YYYY-MM-DD 형식의 날짜를 안정적으로 파싱
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  $detailDate.textContent = `${displayDate.getFullYear()}. ${String(displayDate.getMonth() + 1).padStart(2, '0')}. ${String(displayDate.getDate()).padStart(2, '0')}. ${dayNames[displayDate.getDay()]}.`;
  $detailTitleInput.value = activity.title;

  // 새 활동인 경우 버튼 비활성화
  if (!activityId) {
    updateTrackingButtonsState(true);
  }

  // DB에서 불러온 활동의 기존 경로를 지도에 그립니다.
  drawPath(activity.path_coordinates || []);
  // DB에서 불러온 위치 마커(메모)를 지도에 그립니다.
  if (activity.location_markers) {
    activity.location_markers.forEach(markerData => {
      // 각 마커에 클릭 핸들러를 바인딩합니다.
      // markerId를 사용해 수정할 메모를 식별합니다.
      addLocationMarker(markerData, handleMarkerClick);
    });
  }

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
      // 경로가 추적 중일 때만 경로를 업데이트합니다.
      const currentPath = getPathCoordinates();
      if (currentPath && currentPath.length > 0) {
        activity.path_coordinates = currentPath;
      }
      await updateActivity(activity);
      alert('활동이 수정되었습니다.');
    } else {
      // 새 활동 생성
      const newActivity = {
        date: state.currentActivityDate, // 상태에 저장된 정확한 날짜 사용
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
async function handleStopTracking() {
  stopTracking();
  await snapToRoad(); // 마지막으로 경로 보정
  alert('활동 기록을 종료합니다. 보정된 최종 경로를 확인하고 저장해주세요.');
}

/**
 * 지도 클릭을 처리하고 메모 모달을 표시하는 핸들러
 * @param {L.LatLng} latlng - 클릭된 위치의 좌표
 */
function handleMapClick(latlng) {
  // 활동이 저장된 후에만 메모를 추가할 수 있습니다.
  if (!state.currentActivityId) {
    alert('활동을 먼저 저장해주세요.');
    return;
  }
  // 새 메모 생성을 위해 모달을 엽니다.
  showMemoModal(latlng);
}

/**
 * 기존 마커 클릭을 처리하고 메모 모달을 표시하는 핸들러
 * @param {object} markerData - 클릭된 마커의 데이터
 */
function handleMarkerClick(markerData) {
  // 기존 메모 수정을 위해 모달을 엽니다.
  showMemoModal(L.latLng(markerData.lat, markerData.lng), markerData);
}

/**
 * 메모 모달을 표시합니다.
 * @param {L.LatLng} latlng - 메모를 추가할 위치의 좌표
 * @param {object | null} memoData - 기존 메모 데이터 (수정 시)
 */
async function showMemoModal(latlng, memoData = null) {
  state.currentMemo.latlng = latlng;
  state.currentMemo.photoBlobs = []; // 모달 열 때마다 사진 블랍 초기화
  state.currentMemo.markerId = memoData ? memoData.markerId : null;

  $memoCoords.textContent = `위치: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
  $memoTextarea.value = memoData ? memoData.memo : '';
  
  // 미리보기 초기화
  $photoPreviewContainer.innerHTML = '';

  // 기존 메모의 사진 데이터 로드 및 미리보기 표시
  if (memoData && memoData.mediaKeys && memoData.mediaKeys.length > 0) {
    const photoPromises = memoData.mediaKeys.map(key => getMedia(key).catch(e => { console.error(e); return null; }));
    const photoDatas = await Promise.all(photoPromises);
    photoDatas.forEach((photoData, index) => {
      if (photoData) {
        const key = memoData.mediaKeys[index];
        const src = URL.createObjectURL(photoData);
        addPhotoPreview(src, 'db', key);
      }
    });
  }

  $memoModal.classList.remove('hidden');
  $modalBackdrop.classList.remove('hidden');
}

/**
 * 메모 모달을 숨깁니다.
 */
function hideMemoModal() {
  // 모든 미리보기 이미지의 Object URL 메모리 해제
  $photoPreviewContainer.querySelectorAll('.photo-preview').forEach(img => {
    if (img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
  });
  state.currentMemo = { latlng: null, photoBlobs: [], markerId: null };
  // 파일 입력값 초기화 (같은 파일 다시 선택 가능하도록)
  $takePhotoInput.value = '';
  $selectPhotoInput.value = '';
  $memoModal.classList.add('hidden');
  $modalBackdrop.classList.add('hidden');
}

/**
 * 메모 저장 버튼 클릭을 처리하는 핸들러
 */
async function handleSaveMemo() {
  const memoText = $memoTextarea.value; // 빈 메모도 허용할 수 있으므로 trim() 제거
  const photoBlobs = state.currentMemo.photoBlobs;

  if (!memoText && photoBlobs.length === 0) {
    alert('메모 내용이나 사진을 추가해주세요.');
    return;
  }

  const { lat, lng } = state.currentMemo.latlng;
  const markerId = state.currentMemo.markerId || (lat + ',' + lng);

  try {
    const activity = await getActivity(state.currentActivityId);
    let mediaKeys = [];

    if (photoBlobs.length > 0) {
      // 새로 추가된 사진들을 DB에 저장하고 키를 받음
      mediaKeys = await Promise.all(photoBlobs.map(blob => addMedia(blob)));
    }

    // 기존 메모 수정 시, 새로 추가된 사진 외 기존 사진들의 키도 유지
    if (state.currentMemo.markerId) {
      const existingMarker = activity.location_markers.find(m => m.markerId === state.currentMemo.markerId);
      if (existingMarker && existingMarker.mediaKeys) { 
        // 새 사진 키와 기존 사진 키를 합침 (중복 제거는 필요 시 추가)
        mediaKeys = [...mediaKeys, ...existingMarker.mediaKeys];
      }
    }

    const newMarkerData = { markerId, lat, lng, memo: memoText, mediaKeys };
    activity.location_markers = activity.location_markers || [];

    const existingMarkerIndex = state.currentMemo.markerId
      ? activity.location_markers.findIndex(m => m.markerId === state.currentMemo.markerId)
      : -1;

    if (existingMarkerIndex > -1) {
      // 기존 마커 업데이트
      activity.location_markers[existingMarkerIndex] = newMarkerData;
    } else {
      // 새 마커 추가
      activity.location_markers.push(newMarkerData);
    }

    const activityDate = activity.date; // 날짜 정보를 미리 저장
    await updateActivity(activity);

    // 저장이 완료되면, DB에서 최신 데이터를 가져와 상세 뷰를 다시 렌더링합니다.
    await showDetailView(state.currentActivityId, activityDate);

    hideMemoModal();
  } catch (error) {
    alert('메모 저장에 실패했습니다: ' + error);
  }
}

/**
 * 파일 입력(사진) 변경을 처리하는 핸들러
 * @param {Event} e
 */
function handlePhotoSelected(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  // 선택된 모든 파일을 Blob 배열에 추가하고 미리보기를 생성합니다. 
  Array.from(files).forEach(file => {
    const blobIndex = state.currentMemo.photoBlobs.push(file) - 1;

    // 미리보기 표시
    const src = URL.createObjectURL(file);
    addPhotoPreview(src, 'local', blobIndex);
  });
}

/**
 * 사진 미리보기를 DOM에 추가합니다.
 * @param {string} src - 이미지 src (Object URL)
 * @param {'local'|'db'} type - 사진 출처 (로컬 파일 또는 DB)
 * @param {number} identifier - 식별자 (로컬: blob 인덱스, DB: mediaKey)
 */
function addPhotoPreview(src, type, identifier) {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-image-wrapper';

  const img = document.createElement('img');
  img.src = src;
  img.className = 'photo-preview';
  img.dataset.type = type;
  img.dataset.identifier = identifier;

  const deleteBtn = document.createElement('div');
  deleteBtn.className = 'delete-photo-btn';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.dataset.type = type;
  deleteBtn.dataset.identifier = identifier;

  wrapper.appendChild(img);
  wrapper.appendChild(deleteBtn);
  $photoPreviewContainer.appendChild(wrapper);
}

/**
 * 사진 미리보기 영역의 클릭 이벤트를 처리합니다 (삭제, 확대).
 * @param {MouseEvent} e
 */
async function handlePreviewClick(e) {
  const target = e.target;

  if (target.classList.contains('delete-photo-btn')) {
    const { type, identifier } = target.dataset;
    if (type === 'local') {
      state.currentMemo.photoBlobs[parseInt(identifier, 10)] = null; // 배열에서 null로 표시
    } else if (type === 'db') {
      // DB에서 불러온 사진 삭제 로직 (기존 mediaKeys에서 해당 키 제거)
      // TODO: DB에서 직접 media를 삭제하는 로직도 추가 가능
    }
    target.parentElement.remove(); // DOM에서 제거
  } else if (target.classList.contains('photo-preview')) {
    $zoomedImage.src = target.src;
    $imageZoomModal.classList.remove('hidden');
  }
}

/**
 * '사진 찍기' 버튼 클릭 핸들러
 */
function handleTakePhoto() {
  $takePhotoInput.click();
}

/**
 * '사진 선택' 버튼 클릭 핸들러
 */
function handleSelectPhoto() {
  $selectPhotoInput.click();
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
$memoSaveBtn.addEventListener('click', handleSaveMemo);
$memoCancelBtn.addEventListener('click', hideMemoModal);
$takePhotoBtn.addEventListener('click', handleTakePhoto);
$selectPhotoBtn.addEventListener('click', handleSelectPhoto);
$takePhotoInput.addEventListener('change', handlePhotoSelected);
$selectPhotoInput.addEventListener('change', handlePhotoSelected);
$photoPreviewContainer.addEventListener('click', handlePreviewClick);
$imageZoomModal.addEventListener('click', () => $imageZoomModal.classList.add('hidden'));
$modalBackdrop.addEventListener('click', hideMemoModal);