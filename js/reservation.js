// /js/reservation.js
import { initPublicAuth } from './firebase.js';
import { submitNewReservation, getReservationByCode, checkIfDateIsClosed } from './reservationService.js';
import { showNotification, showSuccessModal } from './ui.js';
import { allPrices, equipPrices, actPrices, comboPricing, durationDiscounts, childPricing, names } from './prices.js';

// 1. تسجيل الدخول
initPublicAuth();

let currentSpecialNotes = [];

const setInitialDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('visit-date');
    if (dateInput) dateInput.value = tomorrow.toISOString().split('T')[0];
};
setInitialDate();

const adjustQty = (elementId, amount) => {
    const span = document.getElementById(elementId);
    if (!span) return;
    let current = parseInt(span.innerText);
    current += amount;
    if (current < 0) current = 0;
    span.innerText = current;

    // إذا نقصت كمية "Chaise Longue" عن عدد الأطفال المسجلين عليها، نصحح عدد الأطفال تلقائياً
    if (elementId === 'qty-chaise') {
        const childSpan = document.getElementById('qty-chaise-enfant');
        if (childSpan && parseInt(childSpan.innerText) > current) {
            childSpan.innerText = current;
        }
    }

    calculateTotal();
};

// عداد "عدد الأطفال" من ضمن كراسي الاستلقاء (لا يمكن أن يتجاوز qty-chaise)
const adjustChildChaise = (amount) => {
    const span = document.getElementById('qty-chaise-enfant');
    const chaiseSpan = document.getElementById('qty-chaise');
    if (!span || !chaiseSpan) return;
    const maxAllowed = parseInt(chaiseSpan.innerText) || 0;
    let current = parseInt(span.innerText) + amount;
    if (current < 0) current = 0;
    if (current > maxAllowed) current = maxAllowed;
    span.innerText = current;
    calculateTotal();
};

const calculateTotal = () => {
    let subtotalEquip = 0, subtotalAct = 0;
    currentSpecialNotes = []; 

    const qtyChaise = parseInt(document.getElementById('qty-chaise')?.innerText || 0);
    const qtyChaiseEnfant = Math.min(parseInt(document.getElementById('qty-chaise-enfant')?.innerText || 0), qtyChaise);
    const qtyTransat = parseInt(document.getElementById('qty-transat')?.innerText || 0);
    const qtyBaldaquin = parseInt(document.getElementById('qty-baldaquin')?.innerText || 0);

    // العرض التركيبي (Combo) يبقى فعّالاً حتى لو كان أحد الكرسيين لطفل، مع خصم ثابت لكل طفل من الإجمالي
    if (qtyChaise === 2 && qtyTransat === 0) {
        let comboTotal = comboPricing.chaiseOnly2;
        currentSpecialNotes.push(`2 Chaise Longues = ${comboPricing.chaiseOnly2.toLocaleString()} DA (Parasol + Table inclus)`);

        if (qtyChaiseEnfant > 0) {
            const childRebate = equipPrices['qty-chaise'] * childPricing.childWithChairDiscount;
            comboTotal -= (qtyChaiseEnfant * childRebate);
            currentSpecialNotes.push(`${qtyChaiseEnfant} enfant(s) sur Chaise Longue : -${(qtyChaiseEnfant * childRebate).toLocaleString()} DA (-${childPricing.childWithChairDiscount * 100}% par enfant)`);
        }

        subtotalEquip += comboTotal;
    } 
    else if (qtyTransat === 2 && qtyChaise === 0) {
        subtotalEquip += comboPricing.transatOnly2;
        currentSpecialNotes.push(`2 Transats en bois = ${comboPricing.transatOnly2.toLocaleString()} DA (Parasol + Table inclus)`);
    } 
    else if (qtyChaise === 1 && qtyTransat === 0) {
        // كرسي استلقاء واحد بمفرده يحتاج مظلة وطاولة خاصة به
        let soloTotal = equipPrices['qty-chaise'] + comboPricing.parasolTable;

        if (qtyChaiseEnfant > 0) {
            const childRebate = equipPrices['qty-chaise'] * childPricing.childWithChairDiscount;
            soloTotal -= (qtyChaiseEnfant * childRebate);
            currentSpecialNotes.push(`${qtyChaiseEnfant} enfant(s) sur Chaise Longue : -${(qtyChaiseEnfant * childRebate).toLocaleString()} DA (-${childPricing.childWithChairDiscount * 100}% par enfant)`);
        }

        subtotalEquip += soloTotal;
        currentSpecialNotes.push(`+ ${comboPricing.parasolTable.toLocaleString()} DA pour Parasol + Table`);
    }
    else if (qtyTransat === 1 && qtyChaise === 0) {
        // ترانزا واحد بمفرده يحتاج مظلة وطاولة خاصة به
        subtotalEquip += equipPrices['qty-transat'] + comboPricing.parasolTable;
        currentSpecialNotes.push(`+ ${comboPricing.parasolTable.toLocaleString()} DA pour Parasol + Table`);
    }
    else {
        subtotalEquip += (qtyChaise * equipPrices['qty-chaise']);

        if (qtyChaiseEnfant > 0) {
            const childRebate = equipPrices['qty-chaise'] * childPricing.childWithChairDiscount;
            const childRebateTotal = qtyChaiseEnfant * childRebate;
            subtotalEquip -= childRebateTotal;
            currentSpecialNotes.push(`${qtyChaiseEnfant} enfant(s) sur Chaise Longue : -${childRebateTotal.toLocaleString()} DA (-${childPricing.childWithChairDiscount * 100}% par enfant)`);
        }

        subtotalEquip += (qtyTransat * equipPrices['qty-transat']);
    }

    subtotalEquip += (qtyBaldaquin * equipPrices['qty-baldaquin']);

    for (let id in actPrices) {
        const el = document.getElementById(id);
        if (el) subtotalAct += parseInt(el.innerText) * actPrices[id];
    }
    
    const durationSelect = document.getElementById('duration');
    const duration = durationSelect ? parseInt(durationSelect.value) : 1;
    let totalEquip = subtotalEquip * duration;
    
    let discountApplied = false;
    if (durationDiscounts[duration]) {
        totalEquip *= (1 - durationDiscounts[duration]);
        discountApplied = true;
    }

    const discountBadge = document.getElementById('discount-badge');
    if (discountBadge) {
        if (discountApplied && subtotalEquip > 0) discountBadge.classList.remove('hidden');
        else discountBadge.classList.add('hidden');
    }

    const notesContainer = document.getElementById('special-pricing-notes');
    if (notesContainer) {
        if (currentSpecialNotes.length > 0) {
            notesContainer.innerHTML = currentSpecialNotes.map(note => 
                `<div class="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 p-2 rounded-lg font-bold flex items-center gap-1.5 transition-all">
                    <i class="fa-solid fa-tags text-teal-600"></i>
                    <span>${note}</span>
                 </div>`
            ).join('');
            notesContainer.classList.remove('hidden');
        } else {
            notesContainer.innerHTML = '';
            notesContainer.classList.add('hidden');
        }
    }

    let finalTotal = totalEquip + subtotalAct;
    document.getElementById('total-price').innerText = finalTotal.toLocaleString() + ' DA';
    return finalTotal;
};

const submitReservation = async () => {
    const clientName = document.getElementById('client-name').value.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const visitDate = document.getElementById('visit-date').value;

    if (!clientName || !clientPhone || !visitDate) {
        return showNotification("Veuillez remplir tous les champs obligatoires.", "error");
    }

    // 🔴 التحقق مما إذا كان اليوم مغلقاً 
    try {
        const isClosed = await checkIfDateIsClosed(visitDate);
        if (isClosed) {
            return showNotification("Ce jour est fermé. Les réservations sont indisponibles. / هذا اليوم مغلق، الحجز غير متاح.", "error");
        }
    } catch (error) {
        console.error("Erreur vérification date:", error);
        return showNotification("Erreur de connexion. Veuillez réessayer.", "error");
    }

    let hasItems = false;
    let chosenItems = {};
    for (let id in allPrices) {
        const el = document.getElementById(id);
        if(el) {
            const qty = parseInt(el.innerText);
            if (qty > 0) { 
                hasItems = true; 
                chosenItems[names[id]] = qty; 
            }
        }
    }
    
    if (!hasItems) return showNotification("Veuillez choisir au moins un équipement ou activité.", "error");

    const qtyChaiseEnfant = Math.min(parseInt(document.getElementById('qty-chaise-enfant')?.innerText || 0), parseInt(document.getElementById('qty-chaise')?.innerText || 0));

    const duration = parseInt(document.getElementById('duration').value);
    const totalStr = document.getElementById('total-price').innerText;
    const trackingCode = 'MLD-' + Math.floor(1000 + Math.random() * 9000);

    const reservationData = {
        clientName: clientName,
        clientPhone: clientPhone,
        visitDate: visitDate,
        items: chosenItems,
        duration: duration,
        totalPrice: totalStr,
        status: 'pending',
        trackingCode: trackingCode,
        isArchived: false,
        createdAt: new Date().toISOString(),
        childrenChaiseCount: qtyChaiseEnfant
    };

    document.getElementById('booking-success-code').innerText = '#' + trackingCode;
    document.getElementById('summary-items').innerHTML = `<div class="text-xs py-1 text-maldiva-teal font-bold mb-1 border-b border-gray-100"><i class="fa-solid fa-clock"></i> الأيام المحددة: ${duration} يوم / Jour(s)</div>` + 
        Object.entries(chosenItems).map(([name, qty]) => `<div class="text-xs py-0.5">• ${qty} x ${name}</div>`).join('');
    document.getElementById('summary-total').innerText = totalStr;

    const summaryNotesContainer = document.getElementById('summary-special-notes');
    if (summaryNotesContainer) {
        if (currentSpecialNotes.length > 0) {
            summaryNotesContainer.innerHTML = currentSpecialNotes.map(note =>
                `<div class="text-[11px] text-teal-800 font-bold flex items-center gap-1.5 mt-1.5">
                    <i class="fa-solid fa-tags text-teal-600"></i> <span>${note}</span>
                 </div>`
            ).join('');
            summaryNotesContainer.classList.remove('hidden');
        } else {
            summaryNotesContainer.innerHTML = '';
            summaryNotesContainer.classList.add('hidden');
        }
    }

    try {
        await submitNewReservation(reservationData);
        showSuccessModal();
        resetForm();
    } catch (error) {
        console.error("خطأ أثناء الإرسال:", error);
        showNotification("حدث خطأ في الاتصال، يرجى المحاولة مجدداً.", "error");
    }
};

const resetForm = () => {
    document.getElementById('client-name').value = ''; 
    document.getElementById('client-phone').value = ''; 
    for (let id in allPrices) { 
        const el = document.getElementById(id);
        if(el) el.innerText = '0'; 
    } 
    const childChaiseEl = document.getElementById('qty-chaise-enfant');
    if (childChaiseEl) childChaiseEl.innerText = '0';
    calculateTotal();
};

const trackReservation = async () => {
    let code = document.getElementById('track-code-input').value.trim().toUpperCase();
    if (!code) return showNotification("Entrez votre code", "error");
    if (code.startsWith('#')) code = code.substring(1);
    if (!code.startsWith('MLD-')) code = 'MLD-' + code; 

    try {
        const data = await getReservationByCode(code);
        if (!data) return showNotification("Aucun حجز trouvé avec ce رمز !", "error");

        document.getElementById('track-result-box').classList.remove('hidden');
        document.getElementById('track-res-code').innerText = '#' + code;
        document.getElementById('track-res-name').innerText = data.clientName;
        document.getElementById('track-res-date').innerText = data.visitDate;
        document.getElementById('track-res-dur').innerText = data.duration + " Jour(s)";
        
        let itemsHTML = '';
        for (let [name, qty] of Object.entries(data.items || {})) itemsHTML += `<div>• ${qty} x ${name}</div>`;
        if (data.childrenChaiseCount > 0) {
            itemsHTML += `<div class="text-purple-700 font-semibold"><i class="fa-solid fa-child-reaching"></i> ${data.childrenChaiseCount} enfant(s) sur Chaise Longue (-${childPricing.childWithChairDiscount * 100}%)</div>`;
        }
        itemsHTML += `<div class="pt-2 border-t font-bold text-maldiva-dark">Total : ${data.totalPrice}</div>`;
        document.getElementById('track-res-items').innerHTML = itemsHTML;

        const statusConfig = {
            'pending': { label: 'En attente ⏳', class: 'bg-yellow-100 text-yellow-800', icon: 'bg-yellow-100 text-yellow-600', fa: 'fa-clock', ar: 'طلبك قيد المراجعة والدراسة حالياً.' },
            'approved': { label: 'Confirmé ✔', class: 'bg-green-100 text-green-800', icon: 'bg-green-100 text-green-600', fa: 'fa-circle-check', ar: 'تهانينا! حجزك مقبول ومثبت بنجاح.' },
            'declined': { label: 'Refusé ❌', class: 'bg-red-100 text-red-800', icon: 'bg-red-100 text-red-600', fa: 'fa-circle-xmark', ar: 'نعتذر، لم نتمكن من قبول حجزك نظراً لعدم توفر الأماكن.' }
        };
        const current = statusConfig[data.status || 'pending'];
        
        const badge = document.getElementById('track-status-badge');
        badge.innerText = current.label; 
        badge.className = `px-3 py-1 rounded-full text-xs font-bold inline-block ${current.class}`;
        
        const iconBox = document.getElementById('track-status-icon');
        iconBox.className = `w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl ${current.icon}`;
        iconBox.innerHTML = `<i class="fa-solid ${current.fa}"></i>`;
        document.getElementById('track-status-arabic').innerText = current.ar;

    } catch (error) {
        showNotification("Erreur de connexion.", "error");
    }
};

window.adjustQty = adjustQty;
window.adjustChildChaise = adjustChildChaise;
window.calculateTotal = calculateTotal;
window.submitReservation = submitReservation;
window.trackReservation = trackReservation;
