// KUKUMBER MESSENGER - CALLS (Cloudflare Worker версия)
let peer = null;
let localStream = null;
let currentCall = null;
let incomingCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let callTimerInterval = null;
let callSecondsCount = 0;
let ws = null;
let pendingCalls = new Map();

// ⚠️ ЗАМЕНИТЕ на адрес вашего Cloudflare Worker
const SIGNALING_SERVER = 'https://peerjs-signaling.marazmatikpepe.workers.dev/';

// Инициализация WebSocket соединения
function initSignaling() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    
    ws = new WebSocket(SIGNALING_SERVER);
    
    ws.onopen = () => {
        console.log('Сигнальный сервер подключён');
        // Регистрируем себя
        ws.send(JSON.stringify({
            type: 'register',
            peerId: currentUser.uid,
            name: currentUserData?.username
        }));
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleSignalingMessage(data);
        } catch (e) {
            console.error('Ошибка парсинга:', e);
        }
    };
    
    ws.onclose = () => {
        console.log('Соединение закрыто, переподключаемся...');
        setTimeout(() => initSignaling(), 3000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
    };
}

// Обработка входящих сигнальных сообщений
function handleSignalingMessage(data) {
    switch (data.type) {
        case 'offer':
            handleOffer(data);
            break;
        case 'answer':
            handleAnswer(data);
            break;
        case 'ice-candidate':
            handleIceCandidate(data);
            break;
        case 'call-request':
            showIncomingCall(data.from, data.isVideo);
            pendingCalls.set(data.from, { isVideo: data.isVideo });
            break;
    }
}

// Отправка сигнального сообщения
function sendSignalingMessage(to, type, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: type,
            to: to,
            from: currentUser.uid,
            payload: payload
        }));
    }
}

// Начало звонка
function startCall(withVideo) {
    if (!currentChatId || !currentChatUser) {
        showNotification('Выберите чат', 'error');
        return;
    }
    if (currentChatUser.type !== 'private') {
        showNotification('Звонки только в личных чатах', 'info');
        return;
    }
    
    let otherUserId = currentChatUser.otherUserId;
    if (!otherUserId && currentChatUser.participants) {
        otherUserId = currentChatUser.participants.find(id => id !== currentUser.uid);
    }
    if (!otherUserId) {
        showNotification('Не удалось определить собеседника', 'error');
        return;
    }
    
    // Инициализируем сигнальный сервер
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        initSignaling();
        setTimeout(() => startCall(withVideo), 500);
        return;
    }
    
    // Создаём RTCPeerConnection
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    };
    
    currentCall = new RTCPeerConnection(configuration);
    
    // Собираем ICE-кандидаты
    currentCall.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage(otherUserId, 'ice-candidate', {
                candidate: event.candidate
            });
        }
    };
    
    // Получаем удалённый поток
    currentCall.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) remoteVideo.srcObject = event.streams[0];
        document.getElementById('call-status').textContent = 'Подключено';
        startCallTimer();
    };
    
    // Запрашиваем медиапоток
    navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true })
        .then(stream => {
            localStream = stream;
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = localStream;
            
            // Добавляем треки в соединение
            localStream.getTracks().forEach(track => {
                currentCall.addTrack(track, localStream);
            });
            
            // Создаём offer
            currentCall.createOffer()
                .then(offer => currentCall.setLocalDescription(offer))
                .then(() => {
                    sendSignalingMessage(otherUserId, 'offer', {
                        sdp: currentCall.localDescription
                    });
                });
            
            showCallModal(withVideo);
            document.getElementById('call-username').textContent = 
                currentChatUser.otherUser?.username || 'Пользователь';
            document.getElementById('call-status').textContent = 'Соединение...';
        })
        .catch(err => {
            console.error(err);
            showNotification('Нет доступа к камере/микрофону', 'error');
            endCall();
        });
}

// Обработка входящего offer
function handleOffer(data) {
    if (!currentCall) {
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        currentCall = new RTCPeerConnection(configuration);
        
        currentCall.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignalingMessage(data.from, 'ice-candidate', {
                    candidate: event.candidate
                });
            }
        };
        
        currentCall.ontrack = (event) => {
            const remoteVideo = document.getElementById('remote-video');
            if (remoteVideo) remoteVideo.srcObject = event.streams[0];
        };
    }
    
    currentCall.setRemoteDescription(new RTCSessionDescription(data.payload.sdp))
        .then(() => currentCall.createAnswer())
        .then(answer => currentCall.setLocalDescription(answer))
        .then(() => {
            sendSignalingMessage(data.from, 'answer', {
                sdp: currentCall.localDescription
            });
        });
}

// Обработка ответа
function handleAnswer(data) {
    if (currentCall) {
        currentCall.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
    }
}

// Обработка ICE-кандидата
function handleIceCandidate(data) {
    if (currentCall) {
        currentCall.addIceCandidate(new RTCIceCandidate(data.payload.candidate));
    }
}

// Показать входящий звонок
let pendingCallFrom = null;
function showIncomingCall(from, isVideo) {
    pendingCallFrom = from;
    document.getElementById('incoming-call-username').textContent = 'Пользователь';
    document.getElementById('incoming-call-type').textContent = isVideo ? 'Видеозвонок' : 'Аудиозвонок';
    document.getElementById('incoming-call-modal').classList.remove('hidden');
    playRingtone();
}

// Принять звонок
function acceptCall() {
    if (!pendingCallFrom) return;
    
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    currentCall = new RTCPeerConnection(configuration);
    
    currentCall.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage(pendingCallFrom, 'ice-candidate', {
                candidate: event.candidate
            });
        }
    };
    
    currentCall.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) remoteVideo.srcObject = event.streams[0];
        document.getElementById('call-status').textContent = 'Подключено';
        startCallTimer();
    };
    
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        .then(stream => {
            localStream = stream;
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = localStream;
            
            localStream.getTracks().forEach(track => {
                currentCall.addTrack(track, localStream);
            });
            
            showCallModal(false);
            document.getElementById('incoming-call-modal').classList.add('hidden');
            stopRingtone();
            
            // Отправляем подтверждение
            sendSignalingMessage(pendingCallFrom, 'call-accepted', {});
        })
        .catch(err => rejectCall());
    
    pendingCallFrom = null;
}

// Отклонить звонок
function rejectCall() {
    if (pendingCallFrom) {
        sendSignalingMessage(pendingCallFrom, 'call-rejected', {});
        pendingCallFrom = null;
    }
    if (incomingCall) incomingCall = null;
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
}

// Функции управления звонком
function toggleMute() {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length) {
        isAudioEnabled = !isAudioEnabled;
        audioTracks.forEach(t => t.enabled = isAudioEnabled);
        const btn = document.getElementById('mute-btn');
        if (btn) {
            btn.textContent = isAudioEnabled ? '🎤' : '🔇';
            btn.classList.toggle('muted', !isAudioEnabled);
        }
    }
}

function toggleVideo() {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length) {
        isVideoEnabled = !isVideoEnabled;
        videoTracks.forEach(t => t.enabled = isVideoEnabled);
        const btn = document.getElementById('video-btn');
        if (btn) {
            btn.textContent = isVideoEnabled ? '📹' : '📷';
            btn.classList.toggle('muted', !isVideoEnabled);
        }
    }
}

function endCall() {
    stopCallTimer();
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    
    document.getElementById('call-modal').classList.add('hidden');
    isAudioEnabled = true;
    isVideoEnabled = true;
    
    const muteBtn = document.getElementById('mute-btn');
    const videoBtn = document.getElementById('video-btn');
    if (muteBtn) {
        muteBtn.textContent = '🎤';
        muteBtn.classList.remove('muted');
    }
    if (videoBtn) {
        videoBtn.textContent = '📹';
        videoBtn.classList.remove('muted');
    }
}

function startCallTimer() {
    let seconds = 0;
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('call-timer');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    const timerEl = document.getElementById('call-timer');
    if (timerEl) timerEl.textContent = '00:00';
}

function showCallModal(isVideo) {
    document.getElementById('call-modal').classList.remove('hidden');
    const videoBtn = document.getElementById('video-btn');
    if (videoBtn) videoBtn.style.display = isVideo ? '' : 'none';
    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.style.display = isVideo ? '' : 'none';
    document.getElementById('call-avatar').classList.toggle('hidden', isVideo);
}

// Функции для удобства вызова
function startVoiceCall() { startCall(false); }
function startVideoCall() { startCall(true); }

// Инициализация при загрузке
function initializePeer() {
    if (currentUser) {
        initSignaling();
    }
}

// Звук звонка
let ringtoneInterval = null;
let ringtoneCtx = null;

function playRingtone() {
    try {
        ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
        function beep() {
            if (!ringtoneCtx) return;
            const osc = ringtoneCtx.createOscillator();
            const gain = ringtoneCtx.createGain();
            osc.connect(gain);
            gain.connect(ringtoneCtx.destination);
            osc.frequency.value = 440;
            gain.gain.value = 0.2;
            osc.start();
            setTimeout(() => osc.stop(), 200);
        }
        beep();
        ringtoneInterval = setInterval(beep, 1000);
        setTimeout(stopRingtone, 30000);
    } catch (e) {}
}

function stopRingtone() {
    if (ringtoneInterval) clearInterval(ringtoneInterval);
    if (ringtoneCtx) {
        try { ringtoneCtx.close(); } catch(e) {}
        ringtoneCtx = null;
    }
}
