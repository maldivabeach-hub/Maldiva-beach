// /js/ui.js

// --------------------------------------------------------
// 1. نظام الإشعارات (Toasts)
// --------------------------------------------------------
export const showNotification = (msg, type = 'info') => {
    const toast = document.getElementById('custom-toast');
    const icon = document.getElementById('toast-icon');
    const message = document.getElementById('toast-message');
    
    if (!toast || !icon || !message) return;

    message.innerText = msg;
    if (type === 'success') {
        icon.innerHTML = '<i class="fa-solid fa-circle-check text-green-400 text-lg"></i>';
    } else if (type === 'error') {
        icon.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-400 text-lg"></i>';
    } else {
        icon.innerHTML = '<i class="fa-solid fa-circle-info text-blue-400 text-lg"></i>';
    }
    
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => { 
        toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'); 
    }, 3500);
};

// --------------------------------------------------------
// 2. دوال النوافذ المنبثقة (Modals)
// --------------------------------------------------------
const openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.add('opacity-100'); 
        modal.querySelector('div').classList.remove('translate-y-4'); 
    }, 10);
};

const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('opacity-100');
    modal.querySelector('div').classList.add('translate-y-4');
    setTimeout(() => { 
        modal.classList.add('hidden'); 
    }, 300);
};

// دوال مخصصة لكل نافذة
export const showSuccessModal = () => openModal('success-modal');
export const hideSuccessModal = () => closeModal('success-modal');

export const openArchiveModal = () => openModal('archive-modal');
export const closeArchiveModal = () => closeModal('archive-modal');

export const openConfirmModal = () => openModal('confirm-modal');
export const closeConfirmModal = () => closeModal('confirm-modal');

export const openParasolModal = () => openModal('parasol-modal');
export const closeParasolModal = () => closeModal('parasol-modal');

export const openEditModal = () => openModal('edit-modal');
export const closeEditModal = () => closeModal('edit-modal');


// --------------------------------------------------------
// 3. نظام التبديل بين الصفحات (Tabs)
// --------------------------------------------------------
export const switchTab = (tabId) => {
    const tabs = ['booking-form', 'tracking-section'];
    const inactive = "flex-1 py-4 text-center text-xs font-bold uppercase tracking-wider text-gray-400 border-b-2 border-transparent transition-all flex flex-col items-center gap-1";
    const active = "flex-1 py-4 text-center text-xs font-bold uppercase tracking-wider text-maldiva-teal border-b-2 border-maldiva-teal transition-all flex flex-col items-center gap-1 hover:text-maldiva-teal";
    
    tabs.forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        const btn = document.getElementById(`btn-tab-${id.split('-')[0]}`);
        if (el) el.classList.add('hidden');
        if (btn) btn.className = inactive;
    });

    const activeEl = document.getElementById(`tab-${tabId}`);
    const activeBtn = document.getElementById(`btn-tab-${tabId.split('-')[0]}`);
    
    if (activeEl) activeEl.classList.remove('hidden');
    if (activeBtn) activeBtn.className = active;
};

export const switchAdminSubTab = (subTabId) => {
    const subTabs = ['reservations', 'loyalty', 'settings', 'parasols', 'restaurant'];
    const activeClass = "py-3 px-4 font-bold text-xs uppercase border-b-2 border-maldiva-orange text-maldiva-orange flex items-center gap-1.5 whitespace-nowrap";
    const inactiveClass = "py-3 px-4 font-bold text-xs uppercase border-b-2 border-transparent text-gray-500 hover:text-gray-800 flex items-center gap-1.5 whitespace-nowrap";

    subTabs.forEach(id => {
        const btnId = id === 'reservations' ? 'res' : id;
        const btn = document.getElementById(`admin-subtab-btn-${btnId}`);
        const view = document.getElementById(`admin-subview-${id}`);
        if(btn) btn.className = inactiveClass;
        if(view) view.classList.add('hidden');
    });

    const activeBtnId = subTabId === 'reservations' ? 'res' : subTabId;
    const activeBtn = document.getElementById(`admin-subtab-btn-${activeBtnId}`);
    const activeView = document.getElementById(`admin-subview-${subTabId}`);

    if(activeBtn) activeBtn.className = activeClass;
    if(activeView) activeView.classList.remove('hidden');
};

// --------------------------------------------------------
// 4. تسجيل الدوال لتصبح متاحة في HTML (Global Scope)
// --------------------------------------------------------
window.showNotification = showNotification;
window.showSuccessModal = showSuccessModal;
window.hideSuccessModal = hideSuccessModal;
window.openArchiveModal = openArchiveModal;
window.closeArchiveModal = closeArchiveModal;
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.openParasolModal = openParasolModal;
window.closeParasolModal = closeParasolModal;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.switchTab = switchTab;
window.switchAdminSubTab = switchAdminSubTab;
