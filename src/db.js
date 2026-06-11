const DB_NAME = 'EcosistemaOrdenesDB';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders';
const STORE_FILES = 'files';

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        db.createObjectStore(STORE_ORDERS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'name' });
      }
    };
  });
}

export async function saveOrders(ordersList) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ORDERS], 'readwrite');
    const store = transaction.objectStore(STORE_ORDERS);
    
    // Clear old orders first
    store.clear();

    let completed = 0;
    if (ordersList.length === 0) {
      resolve();
      return;
    }

    ordersList.forEach((order) => {
      const request = store.add(order);
      request.onsuccess = () => {
        completed++;
        if (completed === ordersList.length) {
          resolve();
        }
      };
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  });
}

export async function getOrders() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ORDERS], 'readonly');
    const store = transaction.objectStore(STORE_ORDERS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

export async function saveFilesLog(filesList) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FILES], 'readwrite');
    const store = transaction.objectStore(STORE_FILES);
    
    store.clear();

    if (filesList.length === 0) {
      resolve();
      return;
    }

    let completed = 0;
    filesList.forEach((file) => {
      const request = store.put(file);
      request.onsuccess = () => {
        completed++;
        if (completed === filesList.length) {
          resolve();
        }
      };
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  });
}

export async function getFilesLog() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FILES], 'readonly');
    const store = transaction.objectStore(STORE_FILES);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

export async function clearAllDB() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ORDERS, STORE_FILES], 'readwrite');
    transaction.objectStore(STORE_ORDERS).clear();
    transaction.objectStore(STORE_FILES).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
}
