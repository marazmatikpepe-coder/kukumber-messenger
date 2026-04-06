// KUKUMBER MESSENGER - REELS (только фото, через ImgBB)
var currentReelFile = null;
var currentReelsTab = 'feed';
var viewingReelId = null;

function loadReels() {
    var feed = document.getElementById('reels-feed');
    feed.innerHTML = '<div class="empty-reels"><span>🎬</span><p>Загрузка...</p></div>';
    var query = (currentReelsTab === 'my') ? database.ref('reels').orderByChild('authorId').equalTo(currentUser.uid) : database.ref('reels').orderByChild('createdAt').limitToLast(50);
    if(currentReelsTab === 'liked') { loadLikedReels(); return; }
    query.once('value').then(snapshot=>{
        var reels = snapshot.val();
        feed.innerHTML = '';
        if(!reels){ feed.innerHTML='<div class="empty-reels"><span>🎬</span><p>Пока нет реелсов</p></div>'; return; }
        var arr = Object.keys(reels).map(id=>({id, data:reels[id]}));
        arr.sort((a,b)=>(b.data.createdAt||0)-(a.data.createdAt||0));
        arr.forEach(reel=>feed.appendChild(createReelCard(reel.id, reel.data)));
    }).catch(err=>{ feed.innerHTML='<div class="empty-reels"><span>❌</span><p>Ошибка</p></div>'; });
}
function loadLikedReels(){ document.getElementById('reels-feed').innerHTML='<div class="empty-reels"><span>❤️</span><p>В разработке</p></div>'; }
function createReelCard(reelId, reelData){
    var div=document.createElement('div');
    div.className='reel-card';
    div.onclick=()=>viewReel(reelId, reelData);
    div.innerHTML = `<img src="${reelData.mediaUrl}"><div class="reel-card-overlay"><div class="reel-card-stats"><span>❤️ ${reelData.likesCount||0}</span><span>💬 ${reelData.commentsCount||0}</span></div></div>`;
    return div;
}
function switchReelsTab(tab){
    currentReelsTab=tab;
    document.querySelectorAll('.reel-tab-btn').forEach(btn=>btn.classList.remove('active'));
    event.target.classList.add('active');
    loadReels();
}
function showCreateReelModal(){
    document.getElementById('create-reel-modal').classList.remove('hidden');
    currentReelFile=null;
    document.getElementById('reel-preview').classList.add('hidden');
    document.getElementById('reel-preview').innerHTML='';
    document.getElementById('reel-caption').value='';
    document.getElementById('reel-upload-area').style.display='';
}
function closeCreateReelModal(){ document.getElementById('create-reel-modal').classList.add('hidden'); }
function previewReelMedia(event){
    var file=event.target.files[0];
    if(!file) return;
    if(!file.type.startsWith('image/')){ showNotification('Только фото','error'); return; }
    currentReelFile=file;
    var preview=document.getElementById('reel-preview');
    preview.innerHTML='';
    preview.classList.remove('hidden');
    document.getElementById('reel-upload-area').style.display='none';
    var reader=new FileReader();
    reader.onload=e=>{ preview.innerHTML = `<img src="${e.target.result}">`; };
    reader.readAsDataURL(file);
}
function publishReel(){
    if(!currentReelFile){ showNotification('Выберите фото','error'); return; }
    var caption=document.getElementById('reel-caption').value.trim();
    var commentsEnabled=document.getElementById('reel-comments-enabled').checked;
    showNotification('Загрузка...','info');
    uploadImageToImgBB(currentReelFile).then(data=>{
        var reelId='reel_'+Date.now()+'_'+Math.random().toString(36).substr(2,9);
        return database.ref('reels/'+reelId).set({
            authorId:currentUser.uid, authorName:currentUserData.username||'Пользователь', authorAvatar:currentUserData.avatar||'',
            mediaUrl:data.url, mediaType:'image', caption:caption, commentsEnabled:commentsEnabled,
            likesCount:0, commentsCount:0, viewsCount:0, createdAt:firebase.database.ServerValue.TIMESTAMP
        });
    }).then(()=>{ closeCreateReelModal(); showNotification('Реелс опубликован!','success'); loadReels(); }).catch(err=>showNotification('Ошибка','error'));
}
function viewReel(reelId, reelData){
    viewingReelId=reelId;
    document.getElementById('view-reel-modal').classList.remove('hidden');
    document.getElementById('reel-media-container').innerHTML = `<img src="${reelData.mediaUrl}">`;
    var avatarDiv=document.getElementById('reel-author-avatar');
    if(reelData.authorAvatar){ avatarDiv.style.backgroundImage=`url(${reelData.authorAvatar})`; avatarDiv.style.backgroundSize='cover'; avatarDiv.textContent=''; }
    else{ avatarDiv.style.backgroundImage=''; avatarDiv.textContent='👤'; }
    document.getElementById('reel-author-name').textContent=reelData.authorName||'Пользователь';
    document.getElementById('reel-caption-view').textContent=reelData.caption||'';
    document.getElementById('reel-likes-count').textContent=reelData.likesCount||0;
    document.getElementById('reel-comments-count').textContent=reelData.commentsCount||0;
    var delBtn=document.getElementById('delete-reel-btn');
    if(reelData.authorId===currentUser.uid || isSuperAdmin) delBtn.style.display='flex';
    else delBtn.style.display='none';
    database.ref('reels/'+reelId+'/viewsCount').transaction(v=>(v||0)+1);
    checkIfLiked(reelId);
}
function closeViewReelModal(){ document.getElementById('view-reel-modal').classList.add('hidden'); viewingReelId=null; }
function checkIfLiked(reelId){
    database.ref('reelLikes/'+reelId+'/'+currentUser.uid').once('value').then(snap=>{
        var btn=document.getElementById('like-reel-btn');
        if(snap.exists()) btn.classList.add('liked');
        else btn.classList.remove('liked');
    });
}
function likeReel(){
    if(!viewingReelId) return;
    var likeRef=database.ref('reelLikes/'+viewingReelId+'/'+currentUser.uid);
    var countRef=database.ref('reels/'+viewingReelId+'/likesCount');
    likeRef.once('value').then(snap=>{
        if(snap.exists()){
            likeRef.remove();
            countRef.transaction(c=>Math.max((c||1)-1,0));
            document.getElementById('like-reel-btn').classList.remove('liked');
        } else {
            likeRef.set(true);
            countRef.transaction(c=>(c||0)+1);
            document.getElementById('like-reel-btn').classList.add('liked');
        }
        countRef.once('value').then(s=>document.getElementById('reel-likes-count').textContent=s.val()||0);
    });
}
function showReelComments(){ showNotification('Комментарии в разработке','info'); }
function shareReel(){
    if(navigator.share) navigator.share({title:'Реелс Kukumber', text:'Посмотри!', url:window.location.href});
    else showNotification('Скопируйте ссылку','info');
}
function deleteCurrentReel(){
    if(!viewingReelId) return;
    database.ref('reels/'+viewingReelId).once('value').then(snap=>{
        var reel=snap.val();
        if(reel.authorId===currentUser.uid || isSuperAdmin){
            if(confirm('Удалить реелс?')){
                database.ref('reels/'+viewingReelId).remove().then(()=>{ showNotification('Удалён','success'); closeViewReelModal(); loadReels(); });
            }
        } else showNotification('Нет прав','error');
    });
}
