// KUKUMBER MESSENGER - CALLS (через Trystero + Firebase)

import { joinRoom } from 'trystero';

let localStream = null;
let currentCall = null;
let remoteStream = null;
let callTimerInterval = null;
let callSecondsCount = 0;
let room = null;

// Конфигурация ICE (для соединения через NAT)
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};

// Инициализация (нужно вызвать после входа)
function initializePeer() {
    if (!currentUser) return;
    console.log('Trystero готов к звонкам');
}

// Создаём или подключаемся к комнате звонка
function getCallRoom(chatId) {
    if (room) {
        try { room.leave(); } catch(e) {}
    }
    
    // Используем Firebase как стратегию для сигналинга
    room = joinRoom({ 
        appId: firebaseConfig.databaseURL,  // ваш URL Firebase
        strategy: 'firebase' 
    }, `call_${chatId}`);
    
    return room;
}

// === Исходящий звонок ===
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
    
    const room = getCallRoom(currentChatId);
    
    navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true })
        .then(stream => {
            localStream = stream;
            showCallModal(withVideo);
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = localStream;
            if (withVideo) document.getElementById('call-avatar').classList.add('hidden');
            else document.getElementById('call-avatar').classList.remove('hidden');
            
            const otherUserName = currentChatUser.otherUser?.username || 'Пользователь';
            document.getElementById('call-username').textContent = otherUserName;
            document.getElementById('call-status').textContent = 'Соединение...';
            
            // Добавляем свой поток в комнату
            room.addStream(localStream);
            
            // Слушаем поток от другого участника
            room.onPeerStream((stream, peerId) => {
                console.log('Получен поток от:', peerId);
                remoteStream = stream;
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) remoteVideo.srcObject = remoteStream;
                document.getElementById('call-status').textContent = 'Подключено';
                startCallTimer();
            });
            
            // Слушаем уход участника
            room.onPeerLeave(peerId => {
                console.log('Участник покинул:', peerId);
                endCall();
            });
        })
        .catch(err => {
            console.error(err);
            showNotification('Нет доступа к камере/микрофону', 'error');
            endCall();
        });
}

// Входящий звонок (обрабатывается автоматически через Trystero)
function handleIncomingCall(call) {
    // Trystero сам обрабатывает входящие, но для совместимости оставим заглушку
    console.log('Входящий звонок через Trystero');
}

function acceptCall() {
    // Trystero автоматически принимает, когда добавляется поток
    // Эта функция нужна для совместимости со старым интерфейсом
    console.log('Звонок принят');
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
}

function rejectCall() {
    if (room) room.leave();
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
    if (room) {
        try { room.leave(); } catch(e) {}
        room = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    document.getElementById('call-modal').classList.add('hidden');
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
}

// Звук звонка
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
