// /js/reservationService.js
import { db, appId } from './firebase.js'; 
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// دالة ذكية لجلب معرف التطبيق لتفادي أي أخطاء وقت التحميل
const getAppId = () => {
    if (typeof window !== 'undefined' && window.__app_id) return window.__app_id;
    return appId;
};

// مسار الحجوزات (المسار الوحيد المسموح به في قواعد الأمان لديك)
const getReservationsCollection = () => collection(db, 'artifacts', getAppId(), 'public', 'data', 'reservations');
const getReservationDoc = (code) => doc(db, 'artifacts', getAppId(), 'public', 'data', 'reservations', code);

// 💡 الحل الجذري: إنشاء ملف مخفي داخل مجلد الحجوزات المسموح به لحفظ الأيام المغلقة
const SYSTEM_DOC_ID = 'SYSTEM_CLOSED_DAYS';
const getSystemDocRef = () => doc(db, 'artifacts', getAppId(), 'public', 'data', 'reservations', SYSTEM_DOC_ID);

let cachedReservations = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

// ==========================================
// إعدادات الموقع (روابط الصور)
// ==========================================
// المفتاح = id حقل الإدخال في admin.html، القيمة = id عنصر <img> في index.html
// حقل فارغ = استعمل الصورة المكتوبة أصلاً في index.html (لا حاجة لتكرار الروابط في مكانين)
export const SITE_IMAGE_KEYS = {
    'setting-logo-url':      'custom-logo-img',
    'setting-chaise-url':    'img-item-chaise',
    'setting-transat-url':   'img-item-transat',
    'setting-baldaquin-url': 'img-item-baldaquin',
    'setting-jetski-url':    'img-item-jetski',
    'setting-pedalo-url':    'img-item-pedalo',
    'setting-kayak-url':     'img-item-kayak',
    'setting-bouee-url':     'img-item-bouee',
    'setting-bateau-url':    'img-item-bateau'
};

const getSettingsDocRef = () => doc(db, 'artifacts', getAppId(), 'public', 'data', 'settings', 'site-images');

// قراءة عامة (يقرأها كل زائر) — مسموحة في firestore.rules
export const getSiteImageSettings = async () => {
    try {
        const snap = await getDoc(getSettingsDocRef());
        return snap.exists() ? snap.data() : {};
    } catch (e) {
        console.error("Erreur getSiteImageSettings:", e);
        return {};   // في حال الفشل نُرجع فراغاً → الموقع يستعمل صوره الافتراضية
    }
};

// كتابة للأدمن فقط (يفرضها firestore.rules)
export const saveSiteImageSettings = async (urls) => {
    await setDoc(getSettingsDocRef(), { ...urls, updatedAt: new Date().toISOString() }, { merge: true });
};

// 🆕 يتحقق إذا كان كود التتبع مستعملاً مسبقاً (لتفادي تصادم/مسح حجز موجود)
export const isTrackingCodeTaken = async (code) => {
    const docRef = getReservationDoc(code);
    const snap = await getDoc(docRef);
    return snap.exists();
};

export const submitNewReservation = async (reservationData) => {
    const docRef = getReservationDoc(reservationData.trackingCode);
    await setDoc(docRef, reservationData);
    return reservationData.trackingCode;
};

export const getReservationByCode = async (trackingCode) => {
    const docRef = getReservationDoc(trackingCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return snap.data();
    }
    return null; 
};

export const getAdminReservations = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedReservations && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedReservations;
    }
    const q = query(getReservationsCollection());
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        // 🔴 مهم جداً: نستثني الملف المخفي الخاص بالأيام المغلقة حتى لا يظهر كحجز
        if (doc.id !== SYSTEM_DOC_ID && doc.data().trackingCode) {
            results.push({ id: doc.id, ...doc.data() });
        }
    });
    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    cachedReservations = results;
    lastFetchTime = now;
    return results;
};

export const updateReservationData = async (trackingCode, newData) => {
    const docRef = getReservationDoc(trackingCode);
    await updateDoc(docRef, newData);
    if (cachedReservations) {
        const index = cachedReservations.findIndex(r => r.trackingCode === trackingCode);
        if (index > -1) {
            cachedReservations[index] = { ...cachedReservations[index], ...newData };
        }
    }
};

export const deleteReservation = async (trackingCode) => {
    const docRef = getReservationDoc(trackingCode);
    await deleteDoc(docRef);
    if (cachedReservations) {
        cachedReservations = cachedReservations.filter(r => r.trackingCode !== trackingCode);
    }
};

// ==========================================
// التذاكر: التحقق وتسجيل الدخول (واجهة الاستقبال)
// ==========================================

// تاريخ اليوم بصيغة YYYY-MM-DD حسب توقيت الجهاز (لا UTC — الجزائر UTC+1)
export const todayKey = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

// هل اليوم يقع ضمن مدة الحجز؟ visitDate = يوم البداية، duration = عدد الأيام
export const isDateWithinStay = (visitDate, duration, dayKey) => {
    if (!visitDate) return false;
    const start = new Date(visitDate + 'T00:00:00');
    const day = new Date(dayKey + 'T00:00:00');
    if (isNaN(start) || isNaN(day)) return false;
    const diff = Math.round((day - start) / 86400000);
    return diff >= 0 && diff < (parseInt(duration) || 1);
};

// يفحص تذكرة ويُرجع نتيجة واضحة — لا يكتب أي شيء
// الكود المُرجَع: ok | not_found | not_approved | declined | wrong_date | already_used
export const validateTicket = async (rawCode) => {
    const code = (rawCode || '').trim().toUpperCase().replace(/^#/, '');
    if (!code) return { ok: false, reason: 'not_found', code };

    const data = await getReservationByCode(code);
    if (!data) return { ok: false, reason: 'not_found', code };

    const day = todayKey();

    if (data.status === 'declined') return { ok: false, reason: 'declined', code, data };
    if (data.status !== 'approved')  return { ok: false, reason: 'not_approved', code, data };
    if (!isDateWithinStay(data.visitDate, data.duration, day)) {
        return { ok: false, reason: 'wrong_date', code, data, day };
    }

    // الحجوزات متعددة الأيام تُمسح مرة واحدة كل يوم، لذلك نفهرس الدخول بالتاريخ
    const already = (data.checkIns || {})[day];
    if (already) return { ok: false, reason: 'already_used', code, data, already, day };

    return { ok: true, code, data, day };
};

// يسجّل الدخول ليوم واحد. merge حتى لا نمسح أيام سابقة.
// نكتب checkIns فقط — أي حقل آخر ترفضه قواعد Firestore للموظف.
export const recordCheckIn = async (code, staffLabel) => {
    const day = todayKey();
    await setDoc(getReservationDoc(code), {
        checkIns: { [day]: { at: new Date().toISOString(), by: staffLabel || 'inconnu' } }
    }, { merge: true });

    if (cachedReservations) {
        const r = cachedReservations.find(x => x.trackingCode === code);
        if (r) r.checkIns = { ...(r.checkIns || {}), [day]: { at: new Date().toISOString(), by: staffLabel } };
    }
    return day;
};

// حالة الدفع (اختياري — للحصول على مكان في الصفوف الأمامية). يضبطها الأدمن فقط.
export const setPaymentStatus = async (code, paid, adminLabel) => {
    await updateDoc(getReservationDoc(code), {
        payment: paid ? { paid: true, at: new Date().toISOString(), by: adminLabel || 'admin' } : { paid: false }
    });
    if (cachedReservations) {
        const r = cachedReservations.find(x => x.trackingCode === code);
        if (r) r.payment = paid ? { paid: true, at: new Date().toISOString(), by: adminLabel } : { paid: false };
    }
};


export const checkIfDateIsClosed = async (dateStr) => {
    try {
        const docRef = getSystemDocRef();
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().closedDates) {
            return snap.data().closedDates.includes(dateStr);
        }
        return false;
    } catch (e) {
        console.error("Erreur checkIfDateIsClosed:", e);
        return false; 
    }
};

export const toggleDateClosure = async (dateStr, isClosing) => {
    const docRef = getSystemDocRef();
    const snap = await getDoc(docRef);
    
    let days = [];
    if (snap.exists() && snap.data().closedDates) {
        days = snap.data().closedDates;
    }
    
    if (isClosing) {
        if (!days.includes(dateStr)) days.push(dateStr);
    } else {
        days = days.filter(d => d !== dateStr);
    }
    
    // نستخدم الملف المخفي داخل reservations لنتجاوز حظر الأمان
    await setDoc(docRef, { closedDates: days }, { merge: true });
};

export const getClosedDays = async () => {
    const docRef = getSystemDocRef();
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().closedDates) {
        return snap.data().closedDates.sort();
    }
    return [];
};
