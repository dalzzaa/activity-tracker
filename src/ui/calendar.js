// date-fns 라이브러리를 사용하기 위해선 npm/yarn으로 설치 후 import 해야 합니다.
// 여기서는 CDN이나 로컬 파일로 가져왔다고 가정합니다.
// import { format } from 'date-fns';
// 우선은 date-fns 없이 순수 JS로 구현합니다.

/**
 * 지정된 날짜를 기반으로 캘린더 뷰를 렌더링합니다.
 * @param {HTMLElement} $container - 캘린더를 렌더링할 DOM 요소
 * @param {Date} date - 표시할 기준 날짜
 * @param {Array<object>} activities - 표시할 활동 목록
 */
export function renderCalendar($container, date, activities = []) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based month

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let html = `
    <style>
      .calendar-header { display: flex; justify-content: space-around; align-items: center; margin-bottom: 1rem; }
      .calendar-header button { background: none; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
      .calendar-nav { display: flex; align-items: center; gap: 10px; }
      .calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
      .calendar-weekday { text-align: center; font-weight: bold; }
      .calendar-day { border: 1px solid #eee; padding: 8px; min-height: 80px; }
      .calendar-day-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.9em; }
      .add-activity-btn { cursor: pointer; color: blue; }
      .activity-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.8em; margin-top: 4px; background-color: #f0f8ff; padding: 2px 4px; border-radius: 3px; }
      .activity-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
      .activity-menu-btn { cursor: pointer; font-weight: bold; padding: 0 5px; }
    </style>
    <div class="calendar-header">
      <div class="calendar-nav">
        <button id="prev-year-btn">&lt;&lt;</button>
        <span>${year}년</span>
        <button id="next-year-btn">&gt;&gt;</button>
      </div>
      <div class="calendar-nav">
        <button id="prev-month-btn">&lt;</button>
        <span>${month + 1}월</span>
        <button id="next-month-btn">&gt;</button>
      </div>
    </div>
    <div class="calendar">
      <div class="calendar-weekday">일</div>
      <div class="calendar-weekday">월</div>
      <div class="calendar-weekday">화</div>
      <div class="calendar-weekday">수</div>
      <div class="calendar-weekday">목</div>
      <div class="calendar-weekday">금</div>
      <div class="calendar-weekday">토</div>
  `;

  // Add empty cells for days before the 1st of the month
  for (let i = 0; i < firstDay.getDay(); i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  // Add cells for each day of the month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; // YYYY-MM-DD
    const activitiesForDay = activities.filter(act => act.date === currentDateStr);

    html += `
      <div class="calendar-day" data-date="${currentDateStr}">
        <div class="calendar-day-header">
          <span>${day}</span>
          <span class="add-activity-btn" title="활동 추가" data-date="${currentDateStr}">+</span>
        </div>
        <div class="activities-list">
    `;

    activitiesForDay.forEach(activity => {
      html += `
        <div class="activity-item" data-activity-id="${activity.activityId}">
          <span class="activity-title" title="${activity.title}">${activity.title}</span>
          <span class="activity-menu-btn" data-activity-id="${activity.activityId}">..</span>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  html += `</div>`;
  $container.innerHTML = html;
}