// /js/admin.js

// تم إضافة submitNewReservation لإنشاء أيام الإغلاق
import { getAdminReservations, updateReservationData, deleteReservation, submitNewReservation } from './reservationService.js';
import { showNotification, openConfirmModal, closeConfirmModal } from './ui.js';

// ========================================================
// 0. إعدادات الأسعار (مطابقة تماماً لنظام الزبون)
// ========================================================
const BASE_PRICES = {
    'Chaise Longue': 2000, 'Transat en Bois': 3000, 'Baldaquin Royal': 10000,
    'Jet-Ski (15 Min)': 6000, 'Jet-Ski (30 Min)': 12000, 'Jet-Ski (1 Heure)': 20000,
    'Pédalo (30 Min)': 1000, 'Pédalo (1 Heure)': 2000, 'Kayak (30 Min)': 1000, 'Kayak (1 Heure)': 2000,
    'Bouée Tractée (2 pers)': 3000, 'Bouée Tractée (3 pers)': 4000, 'Bateau (+4 pers)': 4000,
    'Chaise longue': 2000, 'Transat': 3000, 'Baldaquin': 10000, 'Jet-Ski': 6000, 'Pédalo': 1000,
    'Kayak': 1000, 'Bouée tractée': 3000, 'Bateau': 4000
};

const STANDARD_ITEMS = [
    'Chaise Longue', 'Transat en Bois', 'Baldaquin Royal', 'Jet-Ski (15 Min)', 'Jet-Ski (30 Min)', 'Jet-Ski (1 Heure)', 
    'Pédalo (30 Min)', 'Pédalo (1 Heure)', 'Kayak (30 Min)', 'Kayak (1 Heure)', 'Bouée Tractée (2 pers)', 'Bouée Tractée (3 pers)', 'Bateau (+4 pers)'
];

// ========================================================
// 1. المتغيرات العامة
// ========================================================
let adminAuthorized = false;
let currentStatusFilter = 'all';
let filterNautique = false;
let pendingDeleteId = null;

// ========================================================
// 2. نظام تسجيل الدخول
// ========================================================
export const verifyAdminLogin = async () => {
    const pass = document.getElementById('admin-password').value;
    const error = document.getElementById('admin-login-error');
    if (pass === 'mhdrb26') {
        adminAuthorized = true;
        error.classList.add('hidden'); 
        document.getElementById('admin-login-view').classList.add('hidden'); 
        document.getElementById('admin-dashboard-view').classList.remove('hidden');
        showNotification("Bienvenue, Administrateur !", "success");
        await renderAdminReservations(true); 
    } else { error.classList.remove('hidden'); }
};
export const logoutAdmin = () => {
    adminAuthorized = false; document.getElementById('admin-password').value = ''; 
    document.getElementById('admin-login-view').classList.remove('hidden'); 
    document.getElementById('admin-dashboard-view').classList.add('hidden'); 
    showNotification("Déconnecté.", "info"); 
};

// ========================================================
// 3. نظام الفلترة والبحث
// ========================================================
export const setAdminDateFilterToday = () => {
    const today = new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0];
    document.getElementById('admin-filter-date').value = today; renderAdminReservations();
};
export const clearAdminDateFilter = () => {
    document.getElementById('admin-filter-date').value = ''; document.getElementById('admin-search-mld').value = '';
    currentStatusFilter = 'all'; filterNautique = false;
    const btnNautique = document.getElementById('btn-filter-nautique');
    if (btnNautique) { btnNautique.classList.remove('bg-blue-600', 'text-white'); btnNautique.classList.add('bg-blue-50', 'text-blue-600'); }
    renderAdminReservations();
};
export const toggleNautiqueFilter = () => {
    filterNautique = !filterNautique;
    const btn = document.getElementById('btn-filter-nautique');
    if (filterNautique) { btn.classList.add('bg-blue-600', 'text-white'); btn.classList.remove('bg-blue-50', 'text-blue-600'); } 
    else { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('bg-blue-50', 'text-blue-600'); }
    renderAdminReservations();
};
export const setStatusFilter = (status) => { currentStatusFilter = status; renderAdminReservations(); };

// ========================================================
// 4. دالة عرض الحجوزات 
// ========================================================
export const renderAdminReservations = async (forceRefresh = false) => {
    if (!adminAuthorized) return;

    const filterDate = document.getElementById('admin-filter-date').value;
    const searchInput = document.getElementById('admin-search-mld').value.toLowerCase().trim();
    
    let allReservationsList = await getAdminReservations(forceRefresh);
    let totalRevenue = 0;
    let blockedDaysList = [];
    
    // فلترة القائمة وعزل أيام الإغلاق المخفية
    let matchingList = allReservationsList.filter(res => {
        // عزل الأيام المغلقة لكي لا تظهر في جدول الحجوزات
        if (res.trackingCode && res.trackingCode.startsWith('BLK-') && res.status === 'blocked') {
            blockedDaysList.push(res);
            return false;
        }

        if (filterDate && res.visitDate !== filterDate) return false;
        if (searchInput) {
            const matchCode = res.trackingCode.toLowerCase().includes(searchInput);
            const matchName = res.clientName.toLowerCase().includes(searchInput);
            const matchPhone = res.clientPhone.includes(searchInput);
            if (!matchCode && !matchName && !matchPhone) return false;
        }
        if (filterNautique) {
            const hasNautique = Object.keys(res.items || {}).some(item => 
                item.includes('Jet-Ski') || item.includes('Pédalo') || item.includes('Kayak') || item.includes('Bouée') || item.includes('Bateau')
            );
            if (!hasNautique) return false;
        }
        return true;
    });

    // تحديث واجهة الأيام المغلقة في قسم الإعدادات
    renderBlockedDaysUI(blockedDaysList);

    matchingList.forEach(res => {
        if (res.status === 'approved' || res.status === 'pending') { totalRevenue += (parseInt(res.totalPrice.replace(/[^\d]/g, '')) || 0); }
    });
    
    document.getElementById('stat-revenue').innerText = totalRevenue.toLocaleString() + ' DA';

    let activeList = matchingList.filter(res => !res.isArchived);
    let archivedList = matchingList.filter(res => res.isArchived);

    document.getElementById('stat-total').innerText = activeList.length;
    document.getElementById('stat-pending').innerText = activeList.filter(i => i.status === 'pending').length;
    document.getElementById('stat-approved').innerText = activeList.filter(i => i.status === 'approved').length;
    document.getElementById('stat-declined').innerText = activeList.filter(i => i.status === 'declined').length;
    document.getElementById('stat-archived').innerText = archivedList.length;

    let viewList = activeList;
    if (currentStatusFilter === 'archived') viewList = archivedList;
    else if (currentStatusFilter !== 'all') viewList = activeList.filter(res => res.status === currentStatusFilter);

    const setBtnStyle = (id, isActive, activeColors, inactiveColors) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.className = `cursor-pointer p-3 rounded-2xl border shadow-sm text-center transition-all ${isActive ? activeColors + ' transform scale-105' : inactiveColors}`;
    };

    setBtnStyle('filter-btn-all', currentStatusFilter === 'all', 'bg-gray-200 border-gray-300', 'bg-gray-50 border-gray-200 hover:bg-gray-100');
    setBtnStyle('filter-btn-pending', currentStatusFilter === 'pending', 'bg-yellow-200 border-yellow-300', 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100');
    setBtnStyle('filter-btn-approved', currentStatusFilter === 'approved', 'bg-green-200 border-green-300', 'bg-green-50 border-green-100 hover:bg-green-100');
    setBtnStyle('filter-btn-declined', currentStatusFilter === 'declined', 'bg-red-200 border-red-300', 'bg-red-50 border-red-100 hover:bg-red-100');
    setBtnStyle('filter-btn-archived', currentStatusFilter === 'archived', 'bg-purple-200 border-purple-300', 'bg-purple-50 border-purple-100 hover:bg-purple-100');
    
    const container = document.getElementById('admin-reservations-list');
    if (viewList.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs">Aucune réservation trouvée.</div>`; return;
    }

    let html = '';
    viewList.forEach(res => {
        let itemsHTML = '';
        for (let [name, qty] of Object.entries(res.items || {})) {
            itemsHTML += `<span class="bg-teal-50 text-teal-800 text-[10px] px-2 py-0.5 rounded border border-teal-100 font-semibold mb-1 mr-1 inline-block">${qty} x ${name}</span> `;
        }
        
        const statusStyles = { 'pending': 'bg-yellow-100 text-yellow-800', 'approved': 'bg-green-100 text-green-800', 'declined': 'bg-red-100 text-red-800' };

        let archiveBtn = res.isArchived 
            ? `<button onclick="window.setArchiveStatus('${res.trackingCode}', false)" class="bg-purple-100 hover:bg-purple-200 text-purple-600 p-1.5 rounded text-[10px]" title="Désarchiver"><i class="fa-solid fa-box-open"></i></button>`
            : `<button onclick="window.setArchiveStatus('${res.trackingCode}', true)" class="bg-purple-100 hover:bg-purple-200 text-purple-600 p-1.5 rounded text-[10px]" title="Archiver"><i class="fa-solid fa-box-archive"></i></button>`;

        let borderClass = res.isArchived ? 'border-purple-200' : 'border-gray-100';
        let archivedBadge = res.isArchived ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-600"><i class="fa-solid fa-box-archive"></i> Archivé</span>` : '';

        let timeStr = '';
        if (res.timestamp || res.createdAt) {
            const dateObj = new Date(res.timestamp || res.createdAt);
            if (!isNaN(dateObj.getTime())) {
                const formatedDate = dateObj.toLocaleDateString('fr-FR');
                const formatedTime = dateObj.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
                timeStr = `<span class="text-[9px] text-gray-400 font-mono ml-2 block sm:inline mt-1 sm:mt-0 bg-gray-100 px-2 py-0.5 rounded"><i class="fa-regular fa-clock"></i> Reçu le: ${formatedDate} à ${formatedTime}</span>`;
            }
        }

        html += `
            <div class="bg-gray-50 border ${borderClass} rounded-2xl p-4 relative hover:border-maldiva-teal transition-all">
                <div class="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap">
                    <div>
                        <h5 class="font-bold text-sm text-gray-800">${res.clientName} <span class="text-xs text-gray-400 font-mono">#${res.trackingCode}</span> ${timeStr}</h5>
                        <a href="tel:${res.clientPhone}" class="text-xs text-maldiva-teal hover:underline font-semibold flex items-center gap-1 mt-0.5"><i class="fa-solid fa-phone"></i> ${res.clientPhone}</a>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${statusStyles[res.status || 'pending']}">${res.status || 'pending'}</span>
                        ${archivedBadge}
                    </div>
                </div>
                <div class="text-xs text-gray-600 space-y-1 my-3 border-t border-b border-gray-100 py-2">
                    <div class="flex items-center gap-2">
                        <strong class="text-maldiva-dark"><i class="fa-regular fa-calendar"></i> ${res.visitDate}</strong>
                        <span class="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold ml-auto"><i class="fa-solid fa-clock"></i> ${res.duration || 1} Jour(s)</span>
                    </div>
                    <div class="pt-1">${itemsHTML}</div>
                    ${res.notes ? `<div class="text-[10px] mt-1 text-gray-500"><i class="fa-solid fa-note-sticky"></i> <b>Notes:</b> ${res.notes}</div>` : ''}
                </div>
                <div class="flex justify-between items-center gap-2 flex-wrap">
                    <span class="text-sm font-extrabold text-maldiva-dark">${res.totalPrice}</span>
                    <div class="flex items-center gap-1">
                        <button onclick="window.setReservationStatus('${res.trackingCode}', 'approved')" class="bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold px-2 py-1.5 rounded" title="Accepter"><i class="fa-solid fa-check"></i></button>
                        <button onclick="window.setReservationStatus('${res.trackingCode}', 'declined')" class="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1.5 rounded" title="Refuser"><i class="fa-solid fa-xmark"></i></button>
                        <button onclick="window.openEditModal('${res.trackingCode}')" class="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold px-2 py-1.5 rounded flex items-center gap-1"><i class="fa-solid fa-pen"></i> Modifier</button>
                        <button onclick="window.printReservation('${res.trackingCode}')" class="bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold px-2 py-1.5 rounded flex items-center gap-1"><i class="fa-solid fa-print"></i> Imprimer</button>
                        <button onclick="window.dispatchWhatsAppMessage('${res.trackingCode}')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i></button>
                        ${archiveBtn}
                        <button onclick="window.prepareDelete('${res.trackingCode}')" class="bg-gray-200 hover:bg-gray-300 text-gray-600 p-1.5 rounded text-[10px]" title="Suppression"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
};

// ========================================================
// ميزة أيام الإغلاق (Blocked Days) المانعة
// ========================================================
export const renderBlockedDaysUI = (blockedDays) => {
    const container = document.getElementById('blocked-dates-list');
    if(!container) return;
    
    // ترتيب الأيام المغلقة
    blockedDays.sort((a,b) => new Date(a.visitDate) - new Date(b.visitDate));
    
    if(blockedDays.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 italic">Aucun jour bloqué pour le moment.</p>';
        return;
    }

    container.innerHTML = blockedDays.map(b => `
        <div class="flex justify-between items-center bg-red-50/80 p-3 rounded-xl border border-red-100">
            <div>
                <span class="font-extrabold text-red-800 text-sm"><i class="fa-solid fa-lock text-red-500 mr-2"></i>${b.visitDate}</span>
                <p class="text-[10px] text-red-600 font-semibold mt-0.5">Raison / السبب: ${b.notes}</p>
            </div>
            <button onclick="window.unblockDate('${b.trackingCode}')" class="text-red-600 hover:bg-red-200 bg-red-100 p-2 rounded-lg transition-colors" title="Débloquer le jour / إلغاء الحظر"><i class="fa-solid fa-unlock"></i></button>
        </div>
    `).join('');
};

export const openBlockDateModal = () => {
    const modal = document.getElementById('block-date-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('translate-y-4');
    }, 10);
};

export const closeBlockDateModal = () => {
    const modal = document.getElementById('block-date-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('translate-y-4');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

export const saveBlockDate = async () => {
    const dateInput = document.getElementById('block-date-input').value;
    const reasonInput = document.getElementById('block-reason-input').value || 'Réservation complète';
    
    if (!dateInput) return showNotification("Veuillez sélectionner une date.", "error");

    const code = 'BLK-' + dateInput;
    
    // التحقق من عدم وجود إغلاق مسبق لنفس اليوم
    const list = await getAdminReservations();
    if (list.some(r => r.trackingCode === code)) {
        return showNotification("Cette journée est déjà bloquée.", "error");
    }

    // إنشاء "حجز وهمي مانع"
    const data = {
        clientName: 'FERMETURE',
        clientPhone: '0000000000',
        visitDate: dateInput,
        status: 'blocked',
        trackingCode: code,
        notes: reasonInput,
        isArchived: true, // لكي لا تؤثر على أي إحصائيات
        totalPrice: '0 DA',
        items: {},
        createdAt: new Date().toISOString()
    };

    try {
        await submitNewReservation(data);
        showNotification("Journée bloquée avec succès.", "success");
        document.getElementById('block-date-input').value = '';
        document.getElementById('block-reason-input').value = '';
        closeBlockDateModal();
        renderAdminReservations(true);
    } catch(e) {
        showNotification("Erreur lors du blocage.", "error");
    }
};

export const unblockDate = async (code) => {
    if (!confirm("Voulez-vous vraiment débloquer cette journée ? / هل أنت متأكد من إلغاء الإغلاق؟")) return;
    try {
        await deleteReservation(code);
        showNotification("Journée débloquée !", "success");
        renderAdminReservations(true);
    } catch(e) {
        showNotification("Erreur de déblocage.", "error");
    }
};

// ========================================================
// العمليات الأخرى (حذف، تعديل، طباعة، رسائل...)
// ========================================================
export const setReservationStatus = async (trackingCode, newStatus) => {
    try { await updateReservationData(trackingCode, { status: newStatus }); showNotification("Statut mis à jour !", "success"); renderAdminReservations(); } 
    catch (e) { showNotification("Erreur.", "error"); }
};
export const setArchiveStatus = async (trackingCode, isArchived) => {
    try { await updateReservationData(trackingCode, { isArchived: isArchived }); showNotification(isArchived ? "Archivée !" : "Restaurée !", "success"); renderAdminReservations(); } 
    catch(e) { showNotification("Erreur.", "error"); }
};
export const prepareDelete = (trackingCode) => { pendingDeleteId = trackingCode; openConfirmModal(); };
export const executePendingDelete = async () => {
    if (!pendingDeleteId) return;
    try { await deleteReservation(pendingDeleteId); showNotification("Supprimée !", "success"); closeConfirmModal(); renderAdminReservations(); } 
    catch(e) { showNotification("Erreur.", "error"); } pendingDeleteId = null;
};

// ... التعديل 
export const openEditModal = async (trackingCode) => {
    const list = await getAdminReservations();
    const res = list.find(item => item.trackingCode === trackingCode);
    if (!res) return;
    document.getElementById('edit-modal-code').innerText = trackingCode;
    document.getElementById('edit-name').value = res.clientName || '';
    document.getElementById('edit-phone').value = res.clientPhone || '';
    document.getElementById('edit-date').value = res.visitDate || '';
    document.getElementById('edit-duration').value = res.duration || '1';
    document.getElementById('edit-notes').value = res.notes || '';
    document.getElementById('edit-total-price').innerText = res.totalPrice || '0 DA';
    
    const currentItemsKeys = res.items ? Object.keys(res.items) : [];
    const itemsToDisplay = [...new Set([...STANDARD_ITEMS, ...currentItemsKeys])];

    let itemsHTML = '';
    itemsToDisplay.forEach((item, index) => {
        const currentQty = (res.items && res.items[item]) ? res.items[item] : 0;
        itemsHTML += `
            <div class="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-100">
                <span class="text-xs font-semibold text-gray-700">${item}</span>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="window.updateEditItemQty('edit-qty-${index}', -1)" class="w-6 h-6 bg-gray-100 rounded-full text-maldiva-dark font-bold flex items-center justify-center hover:bg-gray-200">-</button>
                    <span id="edit-qty-${index}" class="text-xs font-bold w-4 text-center edit-item-qty" data-name="${item}">${currentQty}</span>
                    <button type="button" onclick="window.updateEditItemQty('edit-qty-${index}', 1)" class="w-6 h-6 bg-gray-100 rounded-full text-maldiva-dark font-bold flex items-center justify-center hover:bg-gray-200">+</button>
                </div>
            </div>`;
    });
    document.getElementById('edit-items-container').innerHTML = itemsHTML;
    
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('div').classList.remove('translate-y-4'); }, 10);
};

export const updateEditItemQty = (id, change) => {
    const el = document.getElementById(id);
    if (el) {
        let newQty = parseInt(el.innerText) + change;
        if (newQty < 0) newQty = 0; el.innerText = newQty; calculateEditTotal(); 
    }
};

export const calculateEditTotal = () => {
    let subtotalEquip = 0; let subtotalAct = 0; let qtyChaise = 0; let qtyTransat = 0; let qtyBaldaquin = 0;
    document.querySelectorAll('.edit-item-qty').forEach(el => {
        const qty = parseInt(el.innerText) || 0; const name = el.getAttribute('data-name');
        if (name === 'Chaise Longue' || name === 'Chaise longue') { qtyChaise += qty; } 
        else if (name === 'Transat en Bois' || name === 'Transat') { qtyTransat += qty; } 
        else if (name === 'Baldaquin Royal' || name === 'Baldaquin') { qtyBaldaquin += qty; } 
        else { subtotalAct += qty * (BASE_PRICES[name] || 0); }
    });
    if (qtyChaise === 2 && qtyTransat === 0) { subtotalEquip += 5000; } 
    else if (qtyTransat === 2 && qtyChaise === 0) { subtotalEquip += 7000; } 
    else { subtotalEquip += (qtyChaise * BASE_PRICES['Chaise Longue']); subtotalEquip += (qtyTransat * BASE_PRICES['Transat en Bois']); }
    subtotalEquip += (qtyBaldaquin * BASE_PRICES['Baldaquin Royal']);

    const durationStr = document.getElementById('edit-duration').value;
    const duration = parseInt(durationStr) || 1;
    let totalEquip = subtotalEquip * duration;
    
    if (duration === 5) { totalEquip = totalEquip * 0.90; } else if (duration === 7) { totalEquip = totalEquip * 0.85; }
    
    const finalTotal = totalEquip + subtotalAct;
    document.getElementById('edit-total-price').innerText = Math.round(finalTotal).toLocaleString('fr-FR') + ' DA';
};

export const closeEditModal = () => {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('opacity-0'); modal.querySelector('div').classList.add('translate-y-4');
    setTimeout(() => { modal.classList.add('hidden'); }, 300); 
};

export const saveEditedReservation = async () => {
    const trackingCode = document.getElementById('edit-modal-code').innerText;
    const newItems = {};
    document.querySelectorAll('.edit-item-qty').forEach(el => {
        const qty = parseInt(el.innerText); if (qty > 0) newItems[el.getAttribute('data-name')] = qty;
    });
    const updatedData = {
        clientName: document.getElementById('edit-name').value, clientPhone: document.getElementById('edit-phone').value,
        visitDate: document.getElementById('edit-date').value, duration: document.getElementById('edit-duration').value,
        notes: document.getElementById('edit-notes').value, totalPrice: document.getElementById('edit-total-price').innerText,
        items: newItems
    };
    try { await updateReservationData(trackingCode, updatedData); showNotification("Modifiée !", "success"); closeEditModal(); renderAdminReservations(true); } 
    catch (error) { showNotification("Erreur.", "error"); }
};

// ... الطباعة
export const printReservation = async (trackingCode) => {
    const list = await getAdminReservations();
    const res = list.find(item => item.trackingCode === trackingCode);
    if (!res) return showNotification("Réservation introuvable.", "error");

    document.getElementById('print-code').innerText = res.trackingCode;
    document.getElementById('print-name').innerText = res.clientName;
    document.getElementById('print-phone').innerText = res.clientPhone;
    document.getElementById('print-visit-date').innerText = res.visitDate;
    document.getElementById('print-duration').innerText = (res.duration || 1) + " Jour(s)";
    
    let creationDateFormatted = 'Non disponible';
    if (res.timestamp || res.createdAt) {
        const dateObj = new Date(res.timestamp || res.createdAt);
        if (!isNaN(dateObj.getTime())) creationDateFormatted = dateObj.toLocaleDateString('fr-FR') + ' à ' + dateObj.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
    }
    document.getElementById('print-created-at').innerText = creationDateFormatted;

    const statusEl = document.getElementById('print-status');
    const statusMap = { 'pending': { label: 'En attente', color: 'border-yellow-500 text-yellow-600' }, 'approved': { label: 'Confirmé', color: 'border-green-500 text-green-600' }, 'declined': { label: 'Refusé', color: 'border-red-500 text-red-600' } };
    const st = statusMap[res.status || 'pending'];
    statusEl.innerText = st.label; statusEl.className = `px-3 py-1 border-2 font-bold uppercase rounded-md inline-block mt-1 ${st.color}`;

    let itemsHTML = '';
    if (res.items) {
        for (let [name, qty] of Object.entries(res.items)) {
            itemsHTML += `<tr class="border-b border-gray-200"><td class="p-3 border-r border-gray-200 font-semibold text-gray-800">${name}</td><td class="p-3 text-center font-bold text-lg">${qty}</td></tr>`;
        }
    } else { itemsHTML = '<tr><td colspan="2" class="p-3 text-center text-gray-500">Aucun service</td></tr>'; }
    document.getElementById('print-items-body').innerHTML = itemsHTML;
    document.getElementById('print-total').innerText = res.totalPrice || '0 DA';

    const notesContainer = document.getElementById('print-notes-container');
    if (res.notes && res.notes.trim() !== "") { document.getElementById('print-notes').innerText = res.notes; notesContainer.classList.remove('hidden'); } 
    else { notesContainer.classList.add('hidden'); }

    const now = new Date();
    document.getElementById('print-timestamp').innerText = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR');
    document.getElementById('print-admin-name').innerText = "Administrateur Principal";

    setTimeout(() => { window.print(); }, 100);
};

export const dispatchWhatsAppMessage = async (trackingCode) => {
    // ... [نفس كود الواتساب الموجود في الكود السابق]
    const list = await getAdminReservations();
    const res = list.find(item => item.trackingCode === trackingCode);
    if (!res) return showNotification("Réservation introuvable !", "error");
    
    let cleanPhone = res.clientPhone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.startsWith('00213')) cleanPhone = cleanPhone.substring(5); else if (cleanPhone.startsWith('213')) cleanPhone = cleanPhone.substring(3);
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1); cleanPhone = '213' + cleanPhone;

    const itemsStr = Object.entries(res.items || {}).map(([name, qty]) => `• ${qty} x ${name}`).join('\n');
    let messageText = "";

    if (res.status === 'approved') {
        messageText = `Bonjour ${res.clientName}! 🏖️\n\nVotre demande chez *Maldiva Beach Club* a été *CONFIRMÉE* ✔️\n\n📝 *Détails :*\n• Code : #${res.trackingCode}\n• Date : ${res.visitDate} (Pour ${res.duration || 1} Jours)\n• Équipements :\n${itemsStr}\n• Total : *${res.totalPrice}*\n\n⚠️ Important : Veuillez vous présenter au club avant 10h30.\n\n--- \nمرحباً ${res.clientName}! تم تأكيد حجزك في نادي مالديفا الشاطئي ✔️`;
    } else if (res.status === 'declined') {
        messageText = `Bonjour ${res.clientName},\n\nNous sommes désolés, mais nous ne pouvons pas confirmer votre demande chez *Maldiva Beach Club* pour le ${res.visitDate} (places complètes). ❌\n\n--- \nمرحباً ${res.clientName}! نعتذر لعدم تمكننا من قبول حجزك ليوم ${res.visitDate} نظراً لعدم توفر الأماكن.`;
    } else { return showNotification("Acceptez ou refusez d'abord.", "error"); }

    const anchor = document.createElement('a'); anchor.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`; anchor.target = '_blank'; anchor.click();
};

window.verifyAdminLogin = verifyAdminLogin;
window.logoutAdmin = logoutAdmin;
window.setAdminDateFilterToday = setAdminDateFilterToday;
window.clearAdminDateFilter = clearAdminDateFilter;
window.toggleNautiqueFilter = toggleNautiqueFilter;
window.setStatusFilter = setStatusFilter;
window.renderAdminReservations = renderAdminReservations;
window.setReservationStatus = setReservationStatus;
window.setArchiveStatus = setArchiveStatus;
window.prepareDelete = prepareDelete;
window.executePendingDelete = executePendingDelete;
window.dispatchWhatsAppMessage = dispatchWhatsAppMessage;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.updateEditItemQty = updateEditItemQty;
window.calculateEditTotal = calculateEditTotal;
window.saveEditedReservation = saveEditedReservation;
window.printReservation = printReservation;

// دوال المنع الجديدة
window.openBlockDateModal = openBlockDateModal;
window.closeBlockDateModal = closeBlockDateModal;
window.saveBlockDate = saveBlockDate;
window.unblockDate = unblockDate;
