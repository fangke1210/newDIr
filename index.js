// index.js

const DB_NAME = 'LargeFileDB';
const DB_VERSION = 1;
const STORE_NAME = 'FileChunks';
const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk

let db;

// Initialize IndexDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Save a single file chunk to IndexDB
function saveChunk(chunk) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const request = store.add({ chunk: chunk });

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Save file chunks to IndexDB with progress tracking
async function saveFileChunks(file) {
    let offset = 0;
    let chunkCount = 0;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const progressBar = document.getElementById('uploadProgress');

    while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const reader = new FileReader();

        await new Promise((resolve, reject) => {
            reader.onload = async (event) => {
                try {
                    await saveChunk(event.target.result);
                    offset += CHUNK_SIZE;
                    chunkCount++;
                    // Update progress bar
                    progressBar.value = (chunkCount / totalChunks) * 100;
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (event) => {
                reject(event.target.error);
            };

            reader.readAsArrayBuffer(chunk);
        });
    }

    return chunkCount;
}

// Read file chunks from IndexDB and play video
async function playVideo() {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const chunks = [];
    return new Promise((resolve, reject) => {
        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                chunks.push(cursor.value.chunk);
                cursor.continue();
            } else {
                const blob = new Blob(chunks, { type: 'video/mp4' });
                const videoPlayer = document.getElementById('videoPlayer');
                videoPlayer.src = URL.createObjectURL(blob);
                videoPlayer.play();
                resolve();
            }
        };

        store.openCursor().onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Delete all file chunks from IndexDB
async function deleteVideo() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Event listeners for file upload, video play, and video delete
document.getElementById('uploadBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (file) {
        await initDB();
        try {
            const progressBar = document.getElementById('uploadProgress');
            progressBar.value = 0;
            await saveFileChunks(file);
            alert('File uploaded and saved to IndexDB');
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                alert('Error saving file: Storage quota exceeded');
            } else {
                alert('Error saving file: ' + error.message);
            }
        }
    } else {
        alert('Please select a file');
    }
});

document.getElementById('playBtn').addEventListener('click', async () => {
    await initDB();
    try {
        await playVideo();
    } catch (error) {
        alert('Error playing video: ' + error.message);
    }
});

document.getElementById('deleteBtn').addEventListener('click', async () => {
    await initDB();
    try {
        await deleteVideo();
        alert('Video deleted from IndexDB');
    } catch (error) {
        alert('Error deleting video: ' + error.message);
    }
});

// Update playback progress bar
document.getElementById('videoPlayer').addEventListener('timeupdate', () => {
    const videoPlayer = document.getElementById('videoPlayer');
    const playbackProgress = document.getElementById('playbackProgress');
    const value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    playbackProgress.style.width = value + '%';
});

document.getElementById('playPauseBtn').addEventListener('click', () => {
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer.paused) {
        videoPlayer.play();
    } else {
        videoPlayer.pause();
    }
});

document.getElementById('pauseBtn').addEventListener('click', () => {
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.pause();
});
