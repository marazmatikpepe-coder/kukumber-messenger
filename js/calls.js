// KUKUMBER MESSENGER - CALLS
let peer = null;
let localStream = null;
let currentCall = null;
let incomingCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let callTimerInterval = null;
let callSecondsCount = 0;

function initializePeer() {
    if (peer && !peer.disconnected) return;
    if (!currentUser) return;
    if (peer) {
        try { peer.destroy(); } catch(e) {}
        peer = null;
    }
    peer = new Peer(currentUser.uid, {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'turn:turn.anyfirewall.com:443?transport=tcp', username: 'webrtc', credential: 'webrtc' }
            ]
        }
    });
    peer.on('open', id => console.log('PeerJS подключён:', id));
    peer.on('call', call => handleIncomingCall(call));
    peer.on('error', err => {
        console.error('Peer ошибка:', err);
        if (err.type === 'peer-unavailable') showNotification('Пользователь недоступен','error');
        endCall();
    });
    peer.on('disconnected', () => {
        console.log('Peer отключён, переподключаемся...');
        setTimeout(() => initializePeer(), 2000);
    });
}

function startCallTimer(){
    callSecondsCount=0;
    updateCallTimerDisplay();
    if(callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval=setInterval(()=>{ callSecondsCount++; updateCallTimerDisplay(); },1000);
}
function stopCallTimer(){ if(callTimerInterval) clearInterval(callTimerInterval); callSecondsCount=0; var t=document.getElementById('call-timer'); if(t) t.textContent='00:00'; }
function updateCallTimerDisplay(){ let mins=Math.floor(callSecondsCount/60).toString().padStart(2,'0'); let secs=(callSecondsCount%60).toString().padStart(2,'0'); var t=document.getElementById('call-timer'); if(t) t.textContent=mins+':'+secs; }

function startVoiceCall(){ startCall(false); }
function startVideoCall(){ startCall(true); }
function startCall(withVideo){
    if(!currentChatId || !currentChatUser){ showNotification('Выберите чат','error'); return; }
    if(currentChatUser.type !== 'private'){ showNotification('Звонки только в личных чатах','info'); return; }
    initializePeer();
    if(!peer){ showNotification('Ошибка Peer','error'); return; }
    navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true }).then(stream=>{
        localStream=stream;
        isVideoEnabled=withVideo;
        isAudioEnabled=true;
        showCallModal(withVideo);
        var localVideo=document.getElementById('local-video');
        if(localVideo) localVideo.srcObject=localStream;
        if(withVideo) document.getElementById('call-avatar').classList.add('hidden');
        else document.getElementById('call-avatar').classList.remove('hidden');
        var otherUserId=currentChatUser.otherUserId;
        document.getElementById('call-username').textContent=currentChatUser.otherUser?.username||'Пользователь';
        document.getElementById('call-status').textContent='Вызов...';
        currentCall=peer.call(otherUserId, localStream, { metadata: { callerName: currentUserData?.username, isVideo: withVideo } });
        if(currentCall) setupCallListeners(currentCall);
        else endCall();
    }).catch(err=>{ console.error(err); showNotification('Нет доступа к камере/микрофону','error'); endCall(); });
}
function handleIncomingCall(call){
    incomingCall=call;
    var callerName=call.metadata?.callerName||'Неизвестный';
    var isVideo=call.metadata?.isVideo||false;
    document.getElementById('incoming-call-username').textContent=callerName;
    document.getElementById('incoming-call-type').textContent=isVideo?'Видеозвонок':'Аудиозвонок';
    document.getElementById('incoming-call-modal').classList.remove('hidden');
    playRingtone();
}
function acceptCall(){
    if(!incomingCall) return;
    var isVideo=incomingCall.metadata?.isVideo||false;
    navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true }).then(stream=>{
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
    }).catch(err=>{ console.error(err); rejectCall(); });
}
function rejectCall(){
    if(incomingCall) try{ incomingCall.close(); }catch(e){}
    incomingCall=null;
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
}
function setupCallListeners(call){
    call.on('stream', remoteStream=>{
        var remoteVideo=document.getElementById('remote-video');
        if(remoteVideo) remoteVideo.srcObject=remoteStream;
        document.getElementById('call-status').textContent='Подключено';
        startCallTimer();
    });
    call.on('close',()=>endCall());
    call.on('error',()=>endCall());
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
