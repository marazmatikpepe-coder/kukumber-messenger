// KUKUMBER MESSENGER - CALLS (диагностическая версия)
let peer = null;
let localStream = null;
let currentCall = null;
let incomingCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let callTimerInterval = null;
let callSecondsCount = 0;

// Список серверов для перебора (попробуем разные)
const PEER_SERVERS = [
    { host: '0.peerjs.com', port: 443, secure: true, path: '/' },
    { host: 'peerjs-server.herokuapp.com', port: 443, secure: true, path: '/' },
    { host: 'my-peer-server.herokuapp.com', port: 443, secure: true, path: '/' }
];

let currentServerIndex = 0;

function initializePeer() {
    if (!currentUser) {
        console.warn('Нет currentUser');
        return;
    }
    if (peer && !peer.disconnected && peer.open) {
        console.log('Peer уже подключён');
        return;
    }
    if (peer) {
        try { peer.destroy(); } catch(e) { console.warn(e); }
        peer = null;
    }
    
    const config = PEER_SERVERS[currentServerIndex];
    console.log(`Попытка подключения к серверу ${currentServerIndex + 1}:`, config.host);
    
    peer = new Peer(currentUser.uid, {
        host: config.host,
        port: config.port,
        path: config.path,
        secure: config.secure,
        debug: 3, // Включаем подробное логирование
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // Публичные TURN серверы (для обхода NAT)
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
        }
    });
    
    peer.on('open', (id) => {
        console.log('✅ PeerJS подключён! ID:', id);
        console.log('Сервер:', PEER_SERVERS[currentServerIndex].host);
        showNotification('Готов к звонкам', 'success');
        currentServerIndex = 0; // Сброс при успешном подключении
    });
    
    peer.on('call', (call) => {
        console.log('📞 Входящий звонок от:', call.peer);
        handleIncomingCall(call);
    });
    
    peer.on('error', (err) => {
        console.error('❌ Peer ошибка:', err.type, err.message);
        
        if (err.type === 'peer-unavailable') {
            showNotification('Пользователь не в сети или не доступен', 'error');
        }
        
        if (err.type === 'disconnected' || err.type === 'network' || err.type === 'server-error') {
            // Пробуем следующий сервер
            if (currentServerIndex < PEER_SERVERS.length - 1) {
                currentServerIndex++;
                console.log(`Переключаемся на сервер ${currentServerIndex + 1}...`);
                setTimeout(() => initializePeer(), 1000);
            } else {
                console.log('Все серверы перепробованы, ждём...');
                currentServerIndex = 0;
                setTimeout(() => initializePeer(), 5000);
            }
        }
        
        endCall();
    });
    
    peer.on('disconnected', () => {
        console.log('⚠️ Peer отключён, переподключаемся...');
        setTimeout(() => initializePeer(), 2000);
    });
}

function startCallTimer(){
    callSecondsCount=0;
    updateCallTimerDisplay();
    if(callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval=setInterval(()=>{ callSecondsCount++; updateCallTimerDisplay(); },1000);
}
function stopCallTimer(){ 
    if(callTimerInterval) clearInterval(callTimerInterval); 
    callSecondsCount=0; 
    var t=document.getElementById('call-timer'); 
    if(t) t.textContent='00:00'; 
}
function updateCallTimerDisplay(){ 
    let mins=Math.floor(callSecondsCount/60).toString().padStart(2,'0'); 
    let secs=(callSecondsCount%60).toString().padStart(2,'0'); 
    var t=document.getElementById('call-timer'); 
    if(t) t.textContent=mins+':'+secs; 
}

function startVoiceCall(){ startCall(false); }
function startVideoCall(){ startCall(true); }

function startCall(withVideo){
    console.log('Начинаем звонок, видео:', withVideo);
    
    if(!currentChatId || !currentChatUser){ 
        showNotification('Выберите чат','error'); 
        return; 
    }
    if(currentChatUser.type !== 'private'){ 
        showNotification('Звонки только в личных чатах','info'); 
        return; 
    }
    
    let otherUserId = currentChatUser.otherUserId;
    if(!otherUserId && currentChatUser.participants){
        otherUserId = currentChatUser.participants.find(id => id !== currentUser.uid);
    }
    if(!otherUserId){
        showNotification('Не удалось определить собеседника','error');
        console.error('otherUserId не найден', currentChatUser);
        return;
    }
    
    console.log('Звоним пользователю:', otherUserId);
    currentChatUser.otherUserId = otherUserId;
    
    initializePeer();
    if(!peer){ 
        showNotification('Ошибка подключения к звонку','error'); 
        return; 
    }
    
    navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true })
        .then(stream=>{
            console.log('Медиапоток получен');
            localStream=stream;
            isVideoEnabled=withVideo;
            isAudioEnabled=true;
            showCallModal(withVideo);
            var localVideo=document.getElementById('local-video');
            if(localVideo) localVideo.srcObject=localStream;
            if(withVideo) document.getElementById('call-avatar').classList.add('hidden');
            else document.getElementById('call-avatar').classList.remove('hidden');
            
            var otherUserName = currentChatUser.otherUser?.username || 'Пользователь';
            document.getElementById('call-username').textContent = otherUserName;
            document.getElementById('call-status').textContent='Вызов...';
            
            console.log('Создаём звонок для:', otherUserId);
            currentCall = peer.call(otherUserId, localStream, { 
                metadata: { 
                    callerName: currentUserData?.username || 'Пользователь', 
                    isVideo: withVideo 
                } 
            });
            if(currentCall){
                setupCallListeners(currentCall);
            } else {
                showNotification('Не удалось начать звонок','error');
                endCall();
            }
        })
        .catch(err=>{ 
            console.error('Ошибка getUserMedia:', err); 
            let msg = err.name === 'NotAllowedError' ? 'Разрешите доступ к камере/микрофону' : 'Ошибка доступа к медиа';
            showNotification(msg, 'error'); 
            endCall(); 
        });
}

function handleIncomingCall(call){
    console.log('Обработка входящего звонка от:', call.peer);
    incomingCall=call;
    var callerName=call.metadata?.callerName||'Неизвестный';
    var isVideo=call.metadata?.isVideo||false;
    
    document.getElementById('incoming-call-username').textContent=callerName;
    document.getElementById('incoming-call-type').textContent=isVideo?'Видеозвонок':'Аудиозвонок';
    document.getElementById('incoming-call-modal').classList.remove('hidden');
    playRingtone();
}

function acceptCall(){
    console.log('Принимаем звонок');
    if(!incomingCall) return;
    var isVideo=incomingCall.metadata?.isVideo||false;
    
    navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true })
        .then(stream=>{
            console.log('Медиапоток получен для ответа');
            localStream=stream;
            isVideoEnabled=isVideo;
            isAudioEnabled=true;
            document.getElementById('incoming-call-modal').classList.add('hidden');
            stopRingtone();
            showCallModal(isVideo);
            var localVideo=document.getElementById('local-video');
            if(localVideo) localVideo.srcObject=localStream;
            if(isVideo) document.getElementById('call-avatar').classList.add('hidden');
            else document.getElementById('call-avatar').classList.remove('hidden');
            document.getElementById('call-username').textContent=incomingCall.metadata?.callerName||'Пользователь';
            document.getElementById('call-status').textContent='Соединение...';
            incomingCall.answer(localStream);
            currentCall=incomingCall;
            incomingCall=null;
            setupCallListeners(currentCall);
        })
        .catch(err=>{ 
            console.error('Ошибка при ответе:', err); 
            rejectCall(); 
        });
}

function rejectCall(){
    console.log('Отклоняем звонок');
    if(incomingCall) try{ incomingCall.close(); }catch(e){}
    incomingCall=null;
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
}

function setupCallListeners(call){
    call.on('stream', remoteStream=>{
        console.log('Получен удалённый поток');
        var remoteVideo=document.getElementById('remote-video');
        if(remoteVideo) remoteVideo.srcObject=remoteStream;
        document.getElementById('call-status').textContent='Подключено';
        startCallTimer();
    });
    call.on('close',()=>{
        console.log('Звонок закрыт');
        endCall();
    });
    call.on('error',(err)=>{
        console.error('Ошибка звонка:', err);
        endCall();
    });
}

function toggleMute(){
    if(!localStream) return;
    var audioTracks=localStream.getAudioTracks();
    if(audioTracks.length){
        isAudioEnabled=!isAudioEnabled;
        audioTracks.forEach(t=>t.enabled=isAudioEnabled);
        var btn=document.getElementById('mute-btn');
        if(btn){ btn.textContent=isAudioEnabled?'🎤':'🔇'; if(isAudioEnabled) btn.classList.remove('muted'); else btn.classList.add('muted'); }
    }
}

function toggleVideo(){
    if(!localStream) return;
    var videoTracks=localStream.getVideoTracks();
    if(videoTracks.length){
        isVideoEnabled=!isVideoEnabled;
        videoTracks.forEach(t=>t.enabled=isVideoEnabled);
        var btn=document.getElementById('video-btn');
        if(btn){ btn.textContent=isVideoEnabled?'📹':'📷'; if(isVideoEnabled) btn.classList.remove('muted'); else btn.classList.add('muted'); }
    }
}

function endCall(){
    console.log('Завершаем звонок');
    stopCallTimer();
    if(currentCall) try{ currentCall.close(); }catch(e){}
    currentCall=null;
    if(localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream=null; }
    var localVideo=document.getElementById('local-video'), remoteVideo=document.getElementById('remote-video');
    if(localVideo) localVideo.srcObject=null;
    if(remoteVideo) remoteVideo.srcObject=null;
    document.getElementById('call-modal').classList.add('hidden');
    isVideoEnabled=true; isAudioEnabled=true;
    var muteBtn=document.getElementById('mute-btn'), videoBtn=document.getElementById('video-btn');
    if(muteBtn){ muteBtn.textContent='🎤'; muteBtn.classList.remove('muted'); }
    if(videoBtn){ videoBtn.textContent='📹'; videoBtn.classList.remove('muted'); }
}

function showCallModal(isVideo){
    document.getElementById('call-modal').classList.remove('hidden');
    var videoBtn=document.getElementById('video-btn');
    if(videoBtn) videoBtn.style.display=isVideo?'':'none';
    var localVideo=document.getElementById('local-video');
    if(localVideo) localVideo.style.display=isVideo?'':'none';
}

let ringtoneInterval=null, ringtoneCtx=null;
function playRingtone(){
    try{
        ringtoneCtx=new (window.AudioContext||window.webkitAudioContext)();
        function beep(){
            if(!ringtoneCtx) return;
            var osc=ringtoneCtx.createOscillator();
            var gain=ringtoneCtx.createGain();
            osc.connect(gain);
            gain.connect(ringtoneCtx.destination);
            osc.frequency.value=440;
            gain.gain.value=0.2;
            osc.start();
            setTimeout(()=>osc.stop(),200);
        }
        beep();
        ringtoneInterval=setInterval(beep,1000);
        setTimeout(stopRingtone,30000);
    }catch(e){}
}
function stopRingtone(){
    if(ringtoneInterval) clearInterval(ringtoneInterval);
    if(ringtoneCtx) try{ ringtoneCtx.close(); }catch(e){}
    ringtoneCtx=null;
}
