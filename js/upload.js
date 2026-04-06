// UPLOAD - ImgBB (только фото, аудио/видео не поддерживаются)
var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;

function uploadImageToImgBB(file) {
    return new Promise((resolve, reject) => {
        if (!file) { reject(new Error('Нет файла')); return; }
        var allowedTypes = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
        if (allowedTypes.indexOf(file.type) === -1) { showNotification('Только изображения','error'); reject(new Error('Неверный тип')); return; }
        if (file.size > 32*1024*1024) { showNotification('Файл >32 МБ','error'); reject(new Error('Слишком большой')); return; }
        showUploadProgress(true);
        var formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);
        fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData })
        .then(res=>res.json())
        .then(data=>{
            showUploadProgress(false);
            if(data.success) resolve({ url: data.data.url, thumbUrl: data.data.thumb?.url || data.data.url });
            else { showNotification('Ошибка загрузки','error'); reject(new Error('Ошибка')); }
        })
        .catch(err=>{ showUploadProgress(false); showNotification('Ошибка','error'); reject(err); });
    });
}

function showUploadProgress(show){
    var div=document.getElementById('upload-progress');
    if(show && !div){
        div=document.createElement('div');
        div.id='upload-progress';
        div.className='upload-progress';
        div.innerHTML='<div class="upload-progress-content"><div class="spinner"></div><p>Загрузка...</p></div>';
        document.body.appendChild(div);
    } else if(!show && div) div.remove();
}

function handleFileSelect(event){
    var file=event.target.files[0];
    if(file) showImagePreview(file);
    event.target.value='';
}
function showImagePreview(file){
    pendingImageFile=file;
    var reader=new FileReader();
    reader.onload=e=>{
        document.getElementById('preview-image').src=e.target.result;
        document.getElementById('image-caption').value='';
        document.getElementById('image-preview-modal').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
function closeImagePreview(){ document.getElementById('image-preview-modal').classList.add('hidden'); pendingImageFile=null; }
function confirmImageSend(){
    if(!pendingImageFile || !currentChatId){ showNotification('Ошибка','error'); return; }
    var caption=document.getElementById('image-caption').value.trim();
    var file=pendingImageFile;
    closeImagePreview();
    uploadImageToImgBB(file).then(data=>{
        var message={ type:'image', imageUrl:data.url, thumbUrl:data.thumbUrl, caption:caption, senderId:currentUser.uid, timestamp:firebase.database.ServerValue.TIMESTAMP };
        return database.ref('messages/'+currentChatId).push(message);
    }).then(()=>{
        return database.ref('chats/'+currentChatId).update({ lastMessage:'📷 Фото', lastMessageTime:firebase.database.ServerValue.TIMESTAMP });
    }).then(()=>showNotification('Фото отправлено!','success')).catch(err=>showNotification('Ошибка отправки фото','error'));
    pendingImageFile=null;
}

// Аватарки групп, каналов, профиля
function previewGroupAvatar(event){
    var file=event.target.files[0];
    if(file){
        groupAvatarFile=file;
        var reader=new FileReader();
        reader.onload=e=>{
            var preview=document.getElementById('group-avatar-preview');
            preview.style.backgroundImage='url('+e.target.result+')';
            preview.style.backgroundSize='cover';
            preview.textContent='';
        };
        reader.readAsDataURL(file);
    }
}
function previewChannelAvatar(event){
    var file=event.target.files[0];
    if(file){
        channelAvatarFile=file;
        var reader=new FileReader();
        reader.onload=e=>{
            var preview=document.getElementById('channel-avatar-preview');
            preview.style.backgroundImage='url('+e.target.result+')';
            preview.style.backgroundSize='cover';
            preview.textContent='';
        };
        reader.readAsDataURL(file);
    }
}
function previewEditAvatar(event){
    var file=event.target.files[0];
    if(file){
        var reader=new FileReader();
        reader.onload=e=>{
            var preview=document.getElementById('edit-avatar-preview');
            preview.style.backgroundImage='url('+e.target.result+')';
            preview.style.backgroundSize='cover';
            preview.textContent='';
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile=file;
    }
}
