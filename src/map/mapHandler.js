let map;
let watchId = null;
let pathCoordinates = [];
let pathPolyline = null;

/**
 * Leaflet 지도를 초기화합니다.
 * @param {HTMLElement} mapContainer - 지도를 표시할 DOM 요소
 */
export function initMap(mapContainer) {
  if (!mapContainer) {
    throw new Error('Map container not found!');
  }
  map = L.map(mapContainer);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

/**
 * 사용자의 현재 위치를 기반으로 지도 뷰를 설정합니다.
 */
export function setInitialView() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 15);
        L.marker([latitude, longitude]).addTo(map).bindPopup('현재 위치').openPopup();
      },
      (error) => {
        // 위치 정보를 얻지 못했을 경우 오류 원인을 파악하고 사용자에게 알림
        let errorMessage = '위치 정보를 가져올 수 없습니다.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '위치 정보 접근 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '현재 위치를 파악할 수 없습니다. 잠시 후 다시 시도해주세요.';
            break;
          case error.TIMEOUT:
            errorMessage = '위치 정보를 가져오는 데 시간이 초과되었습니다.';
            break;
        }
        alert(errorMessage);
        map.setView([37.5665, 126.9780], 13);
      }
    );
  } else {
    // Geolocation API를 지원하지 않을 경우
    map.setView([37.5665, 126.9780], 13);
  }
}

/**
 * Geolocation API를 사용하여 위치 추적을 시작합니다.
 */
export function startTracking() {
  if (watchId !== null) {
    alert('이미 위치 추적이 진행 중입니다.');
    return;
  }
  if (!navigator.geolocation) {
    alert('이 브라우저에서는 위치 추적을 지원하지 않습니다.');
    return;
  }

  watchId = navigator.geolocation.watchPosition( // eslint-disable-line no-undef
    (position) => {
      const { latitude, longitude } = position.coords;
      pathCoordinates.push([latitude, longitude]);
      drawPath(pathCoordinates);
      console.log('Current position:', latitude, longitude);
    },
    (error) => {
      console.error('Error watching position:', error);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/**
 * 위치 추적을 중지합니다.
 */
export function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    console.log('Position watching stopped.');
  }
}

/**
 * 지도에 경로를 그립니다. 기존 경로는 지우고 새로 그립니다.
 * @param {Array<[number, number]>} coordinates - 경로를 구성하는 좌표 배열
 */
export function drawPath(coordinates) {
  // 기존 경로가 있으면 지도에서 제거
  if (pathPolyline) {
    map.removeLayer(pathPolyline);
  }

  // 새로운 좌표로 경로를 다시 그림
  pathCoordinates = coordinates; // 내부 좌표 데이터 업데이트
  if (pathCoordinates && pathCoordinates.length > 1) {
    pathPolyline = L.polyline(pathCoordinates, { color: 'blue' }).addTo(map);
    // 경로가 보이도록 지도 뷰 조정
    // map.fitBounds(pathPolyline.getBounds());
  }
}

/**
 * 지도에 그려진 경로와 내부 좌표 데이터를 모두 초기화합니다.
 */
export function clearPath() {
  if (pathPolyline) {
    map.removeLayer(pathPolyline);
    pathPolyline = null;
  }
  pathCoordinates = [];
  console.log('Path cleared.');
}

/**
 * 현재까지 기록된 경로 좌표를 반환합니다.
 * @returns {Array<[number, number]>}
 */
export function getPathCoordinates() {
  return pathCoordinates;
}

/**
 * 지도가 표시될 때 크기를 재계산하여 깨짐을 방지합니다.
 */
export function invalidateMapSize() {
  if (map) {
    map.invalidateSize();
  }
}

// TODO: addMarker 등 지도 관련 함수들을 추가로 구현합니다.