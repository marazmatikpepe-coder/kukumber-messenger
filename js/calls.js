// KUKUMBER MESSENGER - WEBRTC CALLS (через Firebase сигналинг)
// Полностью заменяет старый calls.js, ничего менять в index.html не нужно

let localStream = null;
let currentPeerConnection = null;
let callTimerInterval = null;
let callSecondsCount = 0;

// Конфигурация ICE (STUN/TURN) - бесплатные серверы
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// === Инициализация (заглушка для совместимости со старым кодом) ===
function initializePeer() {
    console.log('WebRTC звонки готовы (через Firebase сигналинг)');
}

// === Исходящие звонки ===
function startVoiceCall() { startCall(false); }
function startVideoCall() { startCall(true); }

function startCall(withVideo) {
    if (!currentChatId || !currentChatUser) {
        showNotification('Выберите чат', 'error');
        return;
    }
    if (currentChatUser.type !== 'private') {
        showNotification('Звонки только в личных чатах', 'info');
        return;
    }

    const otherUserId = currentChatUser.otherUserId;
    if (!otherUserId) {
        showNotification('Не удалось определить собеседника', 'error');
        return;
    }

    // Очищаем предыдущие слушатели
    cleanupCallListeners(currentChatId);

    navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true })
        .then(stream => {
            localStream = stream;
            showCallModal(withVideo);
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = localStream;
            document.getElementById('call-status').textContent = 'Соединение...';
            document.getElementById('call-username').textContent = currentChatUser.otherUser?.username || 'Пользователь';

            currentPeerConnection = new RTCPeerConnection(iceServers);
            localStream.getTracks().forEach(track => {
                currentPeerConnection.addTrack(track, localStream);
            });

            currentPeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    saveIceCandidateToFirebase(currentChatId, otherUserId, event.candidate);
                }
            };

            currentPeerConnection.ontrack = (event) => {
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) remoteVideo.srcObject = event.streams[0];
                document.getElementById('call-status').textContent = 'Подключено';
                startCallTimer();
            };

            currentPeerConnection.createOffer()
                .then(offer => currentPeerConnection.setLocalDescription(offer))
                .then(() => {
                    saveOfferToFirebase(currentChatId, otherUserId, currentPeerConnection.localDescription);
                })
                .catch(err => {
                    console.error('Ошибка создания offer:', err);
                    endCall();
                });

            setupCallSignaling(currentChatId, otherUserId, true);
        })
        .catch(err => {
            console.error('Ошибка getUserMedia:', err);
            showNotification('Не удалось получить доступ к камере/микрофону', 'error');
            endCall();
        });
}

// === Сигналинг через Firebase ===
function saveOfferToFirebase(chatId, toUserId, offer) {
    database.ref(`calls/${chatId}/offer`).set({
        from: currentUser.uid,
        to: toUserId,
        sdp: offer,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function saveAnswerToFirebase(chatId, fromUserId, answer) {
    database.ref(`calls/${chatId}/answer`).set({
        from: fromUserId,
        sdp: answer,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function saveIceCandidateToFirebase(chatId, toUserId, candidate) {
    database.ref(`calls/${chatId}/candidates`).push({
        to: toUserId,
        candidate: candidate,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function setupCallSignaling(chatId, otherUserId, isInitiator) {
    // Слушаем offer (если мы не инициатор)
    if (!isInitiator) {
        database.ref(`calls/${chatId}/offer`).on('value', snapshot => {
            const data = snapshot.val();
            if (data && data.from === otherUserId && !currentPeerConnection) {
                handleIncomingOffer(chatId, otherUserId, data.sdp);
            }
        });
    }

    // Слушаем answer (если мы инициатор)
    database.ref(`calls/${chatId}/answer`).on('value', snapshot => {
        const data = snapshot.val();
        if (data && data.from === otherUserId && currentPeerConnection && currentPeerConnection.signalingState === 'have-local-offer') {
            const answer = new RTCSessionDescription(data.sdp);
            currentPeerConnection.setRemoteDescription(answer).catch(err => console.error(err));
        }
    });

    // Слушаем ICE кандидаты
    database.ref(`calls/${chatId}/candidates`).on('child_added', snapshot => {
        const data = snapshot.val();
        if (data && data.to === currentUser.uid && currentPeerConnection) {
            const candidate = new RTCIceCandidate(data.candidate);
            currentPeerConnection.addIceCandidate(candidate).catch(err => console.error(err));
        }
    });
}

function handleIncomingOffer(chatId, fromUserId, offerSdp) {
    window.pendingCallData = {
        chatId: chatId,
        from: fromUserId,
        offer: offerSdp
    };
    document.getElementById('incoming-call-modal').classList.remove('hidden');
    document.getElementById('incoming-call-username').textContent = currentChatUser?.otherUser?.username || 'Пользователь';
    document.getElementById('incoming-call-type').textContent = offerSdp.sdp.includes('video') ? 'Видеозвонок' : 'Аудиозвонок';
    playRingtone();
}

function acceptCall() {
    if (!window.pendingCallData) return;

    const { chatId, from, offer } = window.pendingCallData;
    window.pendingCallData = null;
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();

    const isVideo = offer.sdp.includes('video');
    navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true })
        .then(stream => {
            localStream = stream;
            showCallModal(isVideo);
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = localStream;
            document.getElementById('call-username').textContent = currentChatUser.otherUser?.username || 'Пользователь';
            document.getElementById('call-status').textContent = 'Соединение...';

            currentPeerConnection = new RTCPeerConnection(iceServers);
            localStream.getTracks().forEach(track => {
                currentPeerConnection.addTrack(track, localStream);
            });

            currentPeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    saveIceCandidateToFirebase(chatId, from, event.candidate);
                }
            };

            currentPeerConnection.ontrack = (event) => {
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) remoteVideo.srcObject = event.streams[0];
                document.getElementById('call-status').textContent = 'Подключено';
                startCallTimer();
            };

            currentPeerConnection.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => currentPeerConnection.createAnswer())
                .then(answer => currentPeerConnection.setLocalDescription(answer))
                .then(() => {
                    saveAnswerToFirebase(chatId, currentUser.uid, currentPeerConnection.localDescription);
                })
                .catch(err => console.error(err));

            setupCallSignaling(chatId, from, false);
        })
        .catch(err => {
            console.error(err);
            rejectCall();
        });
}

function rejectCall() {
    if (window.pendingCallData) {
        window.pendingCallData = null;
    }
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
    endCall();
}

// === Управление звонком ===
function toggleMute() {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length) {
        const enabled = !audioTracks[0].enabled;
        audioTracks.forEach(t => t.enabled = enabled);
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            muteBtn.textContent = enabled ? '🎤' : '🔇';
            muteBtn.classList.toggle('muted', !enabled);
        }
    }
}

function toggleVideo() {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length) {
        const enabled = !videoTracks[0].enabled;
        videoTracks.forEach(t => t.enabled = enabled);
        const videoBtn = document.getElementById('video-btn');
        if (videoBtn) {
            videoBtn.textContent = enabled ? '📹' : '📷';
            videoBtn.classList.toggle('muted', !enabled);
        }
    }
}

function endCall() {
    stopCallTimer();
    if (currentPeerConnection) {
        currentPeerConnection.close();
        currentPeerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (currentChatId) {
        database.ref(`calls/${currentChatId}`).remove();
        cleanupCallListeners(currentChatId);
    }
    document.getElementById('call-modal').classList.add('hidden');
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) remoteVideo.srcObject = null;
    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.srcObject = null;
}

// === Таймер ===
function startCallTimer() {
    callSecondsCount = 0;
    updateCallTimerDisplay();
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        callSecondsCount++;
        updateCallTimerDisplay();
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    document.getElementById('call-timer').textContent = '00:00';
}

function updateCallTimerDisplay() {
    const mins = Math.floor(callSecondsCount / 60).toString().padStart(2, '0');
    const secs = (callSecondsCount % 60).toString().padStart(2, '0');
    document.getElementById('call-timer').textContent = `${mins}:${secs}`;
}

function showCallModal(isVideo) {
    document.getElementById('call-modal').classList.remove('hidden');
    const videoBtn = document.getElementById('video-btn');
    if (videoBtn) videoBtn.style.display = isVideo ? '' : 'none';
    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.style.display = isVideo ? '' : 'none';
    document.getElementById('call-avatar').classList.toggle('hidden', isVideo);
}

function cleanupCallListeners(chatId) {
    database.ref(`calls/${chatId}/offer`).off();
    database.ref(`calls/${chatId}/answer`).off();
    database.ref(`calls/${chatId}/candidates`).off();
}

// === Звук звонка ===
let ringtoneInterval = null;
function playRingtone() {
    if (ringtoneInterval) return;
    ringtoneInterval = setInterval(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            gain.gain.value = 0.2;
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, 200);
        } catch(e) {}
    }, 1000);
}

function stopRingtone() {
    if (ringtoneInterval) clearInterval(ringtoneInterval);
    ringtoneInterval = null;
}
