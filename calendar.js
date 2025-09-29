// date-fns 라이브러리를 사용하기 위해선 npm/yarn으로 설치 후 import 해야 합니다.
// 여기서는 CDN이나 로컬 파일로 가져왔다고 가정합니다.
// import { format } from 'date-fns';

/**
 * 지정된 날짜를 기반으로 캘린더 뷰를 렌더링합니다.
 * @param {HTMLElement} $container - 캘린더를 렌더링할 DOM 요소
 * @param {Date} date - 표시할 기준 날짜
 */
export function renderCalendar($container, date) {
  // TODO: date-fns와 같은 라이브러리를 사용하여 실제 캘린더 UI를 구현합니다.
  // 지금은 간단히 현재 연도와 월만 표시합니다.
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  $container.innerHTML = `<h2>${year}년 ${month}월</h2>`;
}