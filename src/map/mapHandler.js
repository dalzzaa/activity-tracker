let map;
let watchId = null;
let rawPathCoordinates = []; // GPS에서 수집한 원본 좌표
let rawPathPolyline = null; // 실시간으로 그려지는 원본 경로 Polyline
let snappedPathPolyline = null; // 도로에 맞춰진 경로 Polyline
let startMarker = null; // 시작 위치 마커
let currentPosMarker = null; // 현재 위치 마커
let locationMarkers = []; // 메모/사진 위치 마커 배열
let onMapClickCallback = null; // 지도 클릭 시 호출될 콜백 함수

const OSRM_SERVER_URL = 'https://router.project-osrm.org/match/v1/driving/';
let isSnapping = false; // 스냅 API 호출 중복 방지 플래그
/**
 * Leaflet 지도를 초기화합니다.
 * @param {HTMLElement} mapContainer - 지도를 표시할 DOM 요소
 * @param {function} onMapClick - 지도 클릭 시 호출될 콜백 함수
 */
export function initMap(mapContainer, onMapClick) {
  if (!mapContainer) {
    throw new Error('Map container not found!');
  }
  onMapClickCallback = onMapClick;
  map = L.map(mapContainer);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // 지도 클릭 이벤트 핸들러
  // map 객체가 생성된 후에 이벤트를 바인딩해야 합니다.
  map.on('click', (e) => {
    if (onMapClickCallback) {
      onMapClickCallback(e.latlng);
    }
  });
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
        if (!currentPosMarker) {
          currentPosMarker = L.marker([latitude, longitude]).addTo(map).bindPopup('현재 위치').openPopup();
        }
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
 * OSRM API를 사용하여 수집된 좌표를 실제 도로 경로에 맞춥니다.
 */
export async function snapToRoad() {
  if (rawPathCoordinates.length < 2 || isSnapping) {
    return;
  }
  isSnapping = true;

  try {
    // OSRM API 형식에 맞게 좌표를 '경도,위도' 문자열로 변환
    const coordsString = rawPathCoordinates.map(p => `${p[1]},${p[0]}`).join(';');
    const response = await fetch(`${OSRM_SERVER_URL}${coordsString}?overview=full&geometries=geojson`);

    if (!response.ok) {
      throw new Error(`OSRM API Error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
      // OSRM은 [경도, 위도] 순서로 좌표를 반환하므로, [위도, 경도]로 순서를 바꿔줍니다.
      const snappedCoords = data.matchings[0].geometry.coordinates.map(p => [p[1], p[0]]);

      // 기존 경로가 있으면 지도에서 제거
      if (snappedPathPolyline) {
        map.removeLayer(snappedPathPolyline);
      }

      // 도로에 맞춰진 새로운 경로를 그림
      snappedPathPolyline = L.polyline(snappedCoords, { color: 'blue' }).addTo(map);

      // 경로가 보이도록 지도 뷰 조정 (필요 시 활성화)
      if (snappedPathPolyline.getBounds().isValid()) {
        map.fitBounds(snappedPathPolyline.getBounds());
      }
    } else {
      console.warn('OSRM: No matching route found. Drawing raw path.');
      // 매칭 실패 시 원본 좌표로 경로를 그림
      drawRawPath(rawPathCoordinates);
    }
  } catch (error) {
    console.error('Failed to snap to road:', error);
    // 에러 발생 시 원본 좌표로 경로를 그림
    drawRawPath(rawPathCoordinates);
  } finally {
    isSnapping = false;
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
      const newPoint = [latitude, longitude];

      // 시작 마커가 없고 경로가 비어있으면, 첫 위치를 시작점으로 설정
      if (!startMarker && rawPathCoordinates.length === 0) {
        startMarker = L.marker(newPoint).addTo(map).bindPopup('시작');
      }

      // 현재 위치 마커 업데이트
      updateCurrentPositionMarker(newPoint);

      rawPathCoordinates.push(newPoint);
      updateRawPath(rawPathCoordinates); // 실시간으로 원본 경로를 그림
      console.log('Current position:', latitude, longitude, 'Path length:', rawPathCoordinates.length);
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
    if (currentPosMarker) {
      map.removeLayer(currentPosMarker);
      currentPosMarker = null;
    }
    watchId = null;
    console.log('Position watching stopped.');
  }
}

/**
 * 매칭 실패 또는 오프라인 시 원본 좌표로 경로를 그립니다.
 * @param {Array<[number, number]>} coordinates - 경로를 구성하는 좌표 배열
 */
function drawRawPath(coordinates) {
  if (rawPathPolyline) {
    map.removeLayer(rawPathPolyline);
  }
  if (coordinates && coordinates.length > 1) {
    rawPathPolyline = L.polyline(coordinates, { color: 'gray', dashArray: '5, 5' }).addTo(map);
    if (rawPathPolyline.getBounds().isValid()) {
      map.fitBounds(rawPathPolyline.getBounds());
    }
  }
}

/**
 * 실시간 추적 중 원본 좌표 경로를 업데이트합니다.
 * @param {Array<[number, number]>} coordinates - 경로를 구성하는 좌표 배열
 */
function updateRawPath(coordinates) {
  if (!rawPathPolyline) {
    // 경로가 없으면 새로 생성
    rawPathPolyline = L.polyline(coordinates, { color: 'gray', dashArray: '5, 5' }).addTo(map);
  } else {
    // 기존 경로에 좌표 추가
    rawPathPolyline.setLatLngs(coordinates);
  }
}

/**
 * 현재 위치 마커를 업데이트합니다.
 * @param {Array<number>} latlng - [위도, 경도]
 */
function updateCurrentPositionMarker(latlng) {
  if (!currentPosMarker) {
    currentPosMarker = L.marker(latlng).addTo(map)
      .bindPopup('현재 위치')
      .openPopup();
  } else {
    currentPosMarker.setLatLng(latlng);
  }
}

/**
 * 지도에 경로를 그립니다. 기존 경로는 지우고 새로 그립니다.
 * 이 함수는 주로 DB에서 불러온 경로를 표시할 때 사용됩니다.
 * @param {Array<[number, number]>} coordinates - 경로를 구성하는 좌표 배열
 */
export async function drawPath(coordinates) {
  // DB에서 불러온 경로를 그릴 때, 원본 좌표는 회색 점선으로 표시
  clearPath(); // 우선 기존 경로를 모두 지웁니다.
  if (coordinates && coordinates.length > 1) {
    // 시작 마커 추가
    startMarker = L.marker(coordinates[0]).addTo(map).bindPopup('시작');
    // 원본 경로 그리기
    drawRawPath(coordinates); // 이 함수 안에서 fitBounds가 호출됨
  }
  rawPathCoordinates = coordinates || [];
  await snapToRoad(); // 저장된 경로에 대해서도 스냅 기능을 시도합니다.
}

/**
 * 지도에 그려진 경로와 내부 좌표 데이터를 모두 초기화합니다.
 */
export function clearPath() {
  if (snappedPathPolyline) {
    map.removeLayer(snappedPathPolyline);
    snappedPathPolyline = null;
  }
  if (rawPathPolyline) {
    map.removeLayer(rawPathPolyline);
    rawPathPolyline = null;
  }
  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
  }
  if (currentPosMarker) {
    map.removeLayer(currentPosMarker);
    currentPosMarker = null;
  }
  rawPathCoordinates = [];
  console.log('Path cleared.');
}

/**
 * 현재까지 기록된 **원본** 경로 좌표를 반환합니다.
 * DB에는 보정되지 않은 원본 GPS 좌표를 저장하여, 나중에 더 좋은
 * 라우팅 엔진으로 재보정할 수 있는 가능성을 열어둡니다.
 * @returns {Array<[number, number]>}
 */
export function getPathCoordinates() {
  return rawPathCoordinates;
}

/**
 * 지도가 표시될 때 크기를 재계산하여 깨짐을 방지합니다.
 */
export function invalidateMapSize() {
  if (map) {
    map.invalidateSize();
  }
}

/**
 * 지도에 위치 마커(메모 등)를 추가합니다.
  * @param {object} markerData - 마커 데이터 (lat, lng, memo, markerId 등 포함)
 */
export function addLocationMarker(markerData, onMarkerClick) {
  // 이전에 추가된 동일한 ID의 마커가 있다면 제거하여 중복을 방지합니다.
  const existingMarkerIndex = locationMarkers.findIndex(m => m.options.markerId === markerData.markerId);
  if (existingMarkerIndex > -1) {
    map.removeLayer(locationMarkers[existingMarkerIndex]);
  }

  const { lat, lng, memo, mediaKeys } = markerData;

  // 메모 마커를 위한 커스텀 아이콘 정의
  const greenIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  });

  const violetIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
  });

  // 사진 유무에 따라 다른 아이콘을 사용
  const customIcon = (mediaKeys && mediaKeys.length > 0) ? violetIcon : greenIcon;
  const marker = L.marker([lat, lng], { icon: customIcon, markerId: markerData.markerId }).addTo(map);

  if (memo) {
    marker.bindPopup(`<b>메모:</b><br>${memo}`);
  } else {
    marker.bindPopup('위치');
  }

  // 마커 클릭 시 메모 수정/보기 모달을 열도록 이벤트 핸들러 연결
  marker.on('click', () => {
    if (onMarkerClick) {
      onMarkerClick(markerData);
    }
  });

  // 마커 관리 배열에 추가
  locationMarkers.push(marker);
}