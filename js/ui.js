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

    // 🎨 هوية لونية لكل قسم: حجز = تركواز، تتبع = برتقالي (نفس لوني الهوية في تدرّج الهيدر)
    // الفرق يبان قبل أي ضغطة عبر أيقونة ملوّنة دائماً داخل مربّع صغير،
    // وعند التفعيل يمتلئ المربّع باللون الكامل + يظهر خط تحت الزر.
    // ملاحظة: نص الزر غير النشط يبقى رمادياً مقروءاً (لا نستعمل شفافية منخفضة حتى لا يبدو معطّلاً).
    const btnBase = "flex-1 py-3.5 flex flex-col items-center gap-1.5 border-b-2 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-maldiva-dark/30";
    const chipBase = "w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all duration-200";
    const labelBase = "t-label transition-colors duration-200";

    const theme = {
        'booking-form': {
            inactive: {
                btn: `${btnBase} border-transparent hover:bg-maldiva-teal/5`,
                chip: `${chipBase} bg-maldiva-teal/10 text-maldiva-teal`,
                label: `${labelBase} text-gray-400 group-hover:text-maldiva-teal`
            },
            active: {
                btn: `${btnBase} border-maldiva-teal bg-maldiva-teal/5`,
                chip: `${chipBase} bg-maldiva-teal text-white shadow-md shadow-maldiva-teal/25`,
                label: `${labelBase} text-maldiva-teal`
            }
        },
        'tracking-section': {
            inactive: {
                btn: `${btnBase} border-transparent hover:bg-maldiva-orange/5`,
                chip: `${chipBase} bg-maldiva-orange/10 text-maldiva-orange`,
                label: `${labelBase} text-gray-400 group-hover:text-maldiva-orange`
            },
            active: {
                btn: `${btnBase} border-maldiva-orange bg-maldiva-orange/5`,
                chip: `${chipBase} bg-maldiva-orange text-white shadow-md shadow-maldiva-orange/25`,
                label: `${labelBase} text-maldiva-orange`
            }
        }
    };

    const paint = (id, state) => {
        const btn = document.getElementById(`btn-tab-${id.split('-')[0]}`);
        if (!btn) return;
        const style = (theme[id] || theme['booking-form'])[state];
        btn.className = style.btn;
        const chip = btn.querySelector('.tab-chip');
        const label = btn.querySelector('.tab-label');
        if (chip) chip.className = `tab-chip ${style.chip}`;
        if (label) label.className = `tab-label ${style.label}`;
    };

    tabs.forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        if (el) el.classList.add('hidden');
        paint(id, 'inactive');
    });

    const activeEl = document.getElementById(`tab-${tabId}`);
    if (activeEl) activeEl.classList.remove('hidden');
    paint(tabId, 'active');
};

export const switchAdminSubTab = (subTabId) => {
    // ces trois sous-onglets sont les seuls présents dans admin.html
    // ('parasols' et 'restaurant' figuraient ici sans exister dans le HTML — retirés)
    const subTabs = ['reservations', 'loyalty', 'settings'];
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
