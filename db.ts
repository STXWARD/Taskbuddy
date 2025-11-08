import { Message, Task } from './types';

const DB_NAME = 'TaskbuddyDB';
const DB_VERSION = 3; // Incremented version to trigger onupgradeneeded for new schema
const MESSAGE_STORE_NAME = 'messages';
const TASK_STORE_NAME = 'tasks';

let db: IDBDatabase;

/**
 * Initializes the IndexedDB database and creates object stores if they don't exist.
 * @returns A promise that resolves with the database instance.
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject('Error opening database');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MESSAGE_STORE_NAME)) {
        const messageStore = db.createObjectStore(MESSAGE_STORE_NAME, { keyPath: 'id' });
        messageStore.createIndex('userName', 'userName', { unique: false });
      }
      if (!db.objectStoreNames.contains(TASK_STORE_NAME)) {
        const taskStore = db.createObjectStore(TASK_STORE_NAME, { keyPath: 'id' });
        taskStore.createIndex('userName', 'userName', { unique: false });
      }
    };
  });
};

// --- Message Functions ---

export const addMessage = async (message: Message): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(MESSAGE_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(MESSAGE_STORE_NAME);
  store.put(message);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getAllMessages = async (userName: string): Promise<Message[]> => {
    const db = await initDB();
    const transaction = db.transaction(MESSAGE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(MESSAGE_STORE_NAME);
    const index = store.index('userName');
    const request = index.getAll(userName);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const messages = request.result.sort((a, b) => {
                 const timeA = parseInt(a.id.split('-')[1] || '0');
                 const timeB = parseInt(b.id.split('-')[1] || '0');
                 return timeA - timeB;
            });
            resolve(messages);
        };
        request.onerror = () => reject(request.error);
    });
};

// --- Task Functions ---

export const addTask = async (task: Task): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(TASK_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(TASK_STORE_NAME);
  store.put(task);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const updateTask = async (task: Task): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(TASK_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(TASK_STORE_NAME);
  store.put(task); // `put` also works for updating
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteTask = async (taskId: string): Promise<void> => {
    const db = await initDB();
    const transaction = db.transaction(TASK_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TASK_STORE_NAME);
    store.delete(taskId);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  };

export const getAllTasks = async (userName: string): Promise<Task[]> => {
    const db = await initDB();
    const transaction = db.transaction(TASK_STORE_NAME, 'readonly');
    const store = transaction.objectStore(TASK_STORE_NAME);
    const index = store.index('userName');
    const request = index.getAll(userName);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};
