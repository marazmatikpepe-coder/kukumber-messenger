// KUKUMBER MESSENGER - SETTINGS
function showEditProfileModal(){
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    document.getElementById('edit-username').value=currentUserData.username||'';
    document.getElementById('edit-bio').value=currentUserData.bio||'';
    var preview=document.getElementById('edit-avatar-preview');
    if(currentUserData.avatar){ preview.style.backgroundImage=`url(${currentUserData.avatar})`; preview.style.backgroundSize='cover'; preview.textContent=''; }
    else{ preview.style.backgroundImage=''; preview.textContent='🥒'; }
}
function closeEditProfileModal(){ document.getElementById('edit-profile-modal').classList.add('hidden'); }
function saveProfile(){
    var newUsername=document.getElementById('edit-username').value.trim();
    var newBio=document.getElementById('edit-bio').value.trim();
    if(!newUsername){ showNotification('Введите имя','error'); return; }
    var updates={ username:newUsername, bio:newBio };
    var saveData=(avatarUrl)=>{ if(avatarUrl) updates.avatar=avatarUrl; database.ref('users/'+currentUser.uid).update(updates).then(()=>{ closeEditProfileModal(); showNotification('Профиль обновлён','success'); }).catch(err=>showNotification('Ошибка','error')); };
    if(window.pendingAvatarFile){
        uploadImageToImgBB(window.pendingAvatarFile).then(data=>{ window.pendingAvatarFile=null; saveData(data.url); }).catch(()=>saveData(null));
    } else saveData(null);
}
function showNotificationSettings(){ showNotification('Уведомления: в разработке','info'); }
function showPrivacySettings(){ showNotification('Конфиденциальность: в разработке','info'); }
function showThemeSettings(){ showNotification('Оформление: в разработке','info'); }
function showLanguageSettings(){ showNotification('Язык: в разработке','info'); }
function showStorageSettings(){ showNotification('Данные и память: в разработке','info'); }
function showAbout(){ alert('Kukumber Messenger v1.0\n\nСвежее общение каждый день 🥒'); }
function showHelp(){ showNotification('Помощь: в разработке','info'); }
