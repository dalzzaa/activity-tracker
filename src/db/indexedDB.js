const DB_NAME = 'ActivityDB';
const DB_VERSION = 1;
const STORES = {
  ACTIVITIES: 'activities',
  MEDIA: 'media', // 사진, 메모 등 바이너리/텍스트 데이터 저장용
};

let db;

/**
 * IndexedDB를 열고 초기화합니다.
 * @returns {Promise<IDBDatabase>} 데이터베이스 인스턴스
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject('IndexedDB를 열 수 없습니다. 브라우저 설정을 확인해주세요.');
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('Database opened successfully.');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const tempDb = event.target.result;
      // CONTEXT.md에 따라 Activity 모델을 정의합니다.
      // keyPath는 'activityId'이며, autoIncrement를 사용합니다.
      if (!tempDb.objectStoreNames.contains(STORES.ACTIVITIES)) {
        tempDb.createObjectStore(STORES.ACTIVITIES, { keyPath: 'activityId', autoIncrement: true });
      }
      // 사진, 메모 데이터 저장을 위한 저장소
      if (!tempDb.objectStoreNames.contains(STORES.MEDIA)) {
        tempDb.createObjectStore(STORES.MEDIA, { autoIncrement: true });
      }
    };
  });
}

/**
 * 활동(Activity)을 데이터베이스에 추가합니다.
 * @param {object} activity - 저장할 활동 객체
 * @returns {Promise<number>} 추가된 활동의 ID
 */
export function addActivity(activity) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ACTIVITIES], 'readwrite');
    const store = transaction.objectStore(STORES.ACTIVITIES);
    const request = store.add(activity);

    request.onsuccess = (event) => {
      resolve(event.target.result); // 새로 생성된 키(ID) 반환
    };

    request.onerror = (event) => {
      console.error('Failed to add activity:', event.target.error);
      reject('활동 기록 저장에 실패했습니다.');
    };
  });
}

/**
 * 데이터베이스에 저장된 모든 활동을 조회합니다.
 * @returns {Promise<Array<object>>} 활동 객체의 배열
 */
export function getAllActivities() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ACTIVITIES], 'readonly');
    const store = transaction.objectStore(STORES.ACTIVITIES);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Failed to get all activities:', event.target.error);
      reject('활동 기록을 불러오는 데 실패했습니다.');
    };
  });
}

/**
 * ID를 사용하여 특정 활동을 조회합니다.
 * @param {number} activityId - 조회할 활동의 ID
 * @returns {Promise<object|undefined>} 활동 객체
 */
export function getActivity(activityId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ACTIVITIES], 'readonly');
    const store = transaction.objectStore(STORES.ACTIVITIES);
    const request = store.get(activityId);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Failed to get activity:', event.target.error);
      reject('활동 정보를 불러오는 데 실패했습니다.');
    };
  });
}

/**
 * ID를 사용하여 활동을 삭제합니다.
 * @param {number} activityId - 삭제할 활동의 ID
 * @returns {Promise<void>}
 */
export function deleteActivity(activityId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ACTIVITIES], 'readwrite');
    const store = transaction.objectStore(STORES.ACTIVITIES);
    const request = store.delete(activityId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      console.error('Failed to delete activity:', event.target.error);
      reject('활동 삭제에 실패했습니다.');
    };
  });
}

/**
 * 활동을 수정합니다. 키가 존재하면 업데이트하고, 없으면 새로 추가합니다.
 * @param {object} activity - 수정할 활동 객체
 * @returns {Promise<number>} 수정/추가된 활동의 ID
 */
export function updateActivity(activity) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.ACTIVITIES], 'readwrite');
    const store = transaction.objectStore(STORES.ACTIVITIES);
    // put은 업데이트와 생성을 모두 처리할 수 있습니다.
    const request = store.put(activity);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Failed to update activity:', event.target.error);
      reject('활동 저장에 실패했습니다.');
    };
  });
}