// /js/reservationService.js
import { db, appId } from './firebase.js'; 
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const CACHE_DURATION = 300000;      // 5 min (au lieu de 60 s) : les données changent peu en session admin
let inFlight = null;                // évite N appels simultanés pour la même requête

// ── Cache : pourquoi ne PAS le vider après une écriture ──
// Firestore facture 1 lecture PAR DOCUMENT. Recharger toute la collection
// après chaque petite action coûtait N lectures à chaque clic.
// On applique donc la modification directement au cache local : le résultat
// affiché est identique, pour 0 lecture.
const patchCache = (trackingCode, changes) => {
    if (!cachedReservations) return;
    const i = cachedReservations.findIndex(r => r.trackingCode === trackingCode);
    if (i > -1) cachedReservations[i] = { ...cachedReservations[i], ...changes };
};

const dropFromCache = (trackingCode) => {
    if (!cachedReservations) return;
    cachedReservations = cachedReservations.filter(r => r.trackingCode !== trackingCode);
};

// Vide le cache : à n'utiliser que pour le bouton « Actualiser » explicite
export const invalidateReservationsCache = () => {
    cachedReservations = null;
    lastFetchTime = 0;
};

// ══════════════════════════════════════════════════════════════
// 🔑 MODE TEMPS RÉEL — la vraie réponse au coût des lectures
// ══════════════════════════════════════════════════════════════
// Problème : getDocs() relit TOUTE la collection. Avec 100 documents,
// chaque rechargement coûtait 100 lectures, même si un seul champ avait changé.
//
// onSnapshot fonctionne autrement :
//   • 1re fois          → N lectures (la collection entière, inévitable)
//   • ensuite           → Firestore n'envoie QUE les documents modifiés
//     approuver 1 réservation = 1 lecture, pas N.
//     13 approbations = 13 lectures au lieu de 13 × N.
//
// Bonus : le panneau devient à jour en direct, donc le cache de 5 minutes
// et son problème de données périmées (check-ins du scanner) disparaissent.
let liveMode = false;

const buildList = (snapshot) => {
    const results = [];
    snapshot.forEach(d => {
        // on exclut toujours le document système des jours fermés
        if (d.id !== SYSTEM_DOC_ID && d.data().trackingCode) {
            results.push({ id: d.id, ...d.data() });
        }
    });
    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return results;
};

// Retourne la fonction de désabonnement. TOUJOURS l'appeler à la déconnexion,
// sinon l'écoute continue et consomme des lectures en arrière-plan.
export const subscribeAdminReservations = (onUpdate, onError) => {
    liveMode = true;
    const unsub = onSnapshot(
        query(getReservationsCollection()),
        (snapshot) => {
            cachedReservations = buildList(snapshot);
            lastFetchTime = Date.now();
            if (typeof onUpdate === 'function') onUpdate(cachedReservations);
        },
        (err) => {
            console.error("Écoute des réservations interrompue:", err);
            liveMode = false;
            if (typeof onError === 'function') onError(err);
        }
    );
    return () => { liveMode = false; unsub(); };
};

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

// ── Cache navigateur des réglages d'images ──
// Ces URLs changent quelques fois par an, mais la lecture s'exécutait à CHAQUE
// chargement de page par CHAQUE visiteur : c'était une lecture facturée par visite.
// On garde le résultat 12 h dans le navigateur du visiteur → ~1 lecture par
// visiteur et par demi-journée au lieu d'une par page vue.
const SETTINGS_CACHE_KEY = 'maldiva_site_images_v1';
const SETTINGS_TTL = 12 * 60 * 60 * 1000;

export const getSiteImageSettings = async ({ fresh = false } = {}) => {
    if (!fresh) {
        try {
            const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
            if (raw) {
                const c = JSON.parse(raw);
                if (c && (Date.now() - c.t) < SETTINGS_TTL) return c.v;
            }
        } catch (e) { /* localStorage indisponible : on lit Firestore */ }
    }

    try {
        const snap = await getDoc(getSettingsDocRef());
        const data = snap.exists() ? snap.data() : {};
        try { localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ t: Date.now(), v: data })); } catch (e) {}
        return data;
    } catch (e) {
        console.error("Erreur getSiteImageSettings:", e);
        return {};   // في حال الفشل نُرجع فراغاً → الموقع يستعمل صوره الافتراضية
    }
};

// كتابة للأدمن فقط (يفرضها firestore.rules)
export const saveSiteImageSettings = async (urls) => {
    await setDoc(getSettingsDocRef(), { ...urls, updatedAt: new Date().toISOString() }, { merge: true });
    // l'admin doit voir son changement tout de suite : on invalide son cache local
    try { localStorage.removeItem(SETTINGS_CACHE_KEY); } catch (e) {}
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
    // En mode temps réel, l'écoute maintient déjà le cache à jour.
    // Refetcher ici coûterait une 2e lecture complète pour rien.
    if (liveMode) return cachedReservations || [];

    const now = Date.now();
    if (!forceRefresh && cachedReservations && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedReservations;
    }

    // Si une requête est déjà en cours, on attend la même au lieu d'en lancer
    // une seconde : c'est ce qui évite de payer 2× N lectures au démarrage.
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
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
            lastFetchTime = Date.now();
            return results;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
};

export const updateReservationData = async (trackingCode, newData) => {
    const docRef = getReservationDoc(trackingCode);
    await updateDoc(docRef, newData);
    patchCache(trackingCode, newData);   // 0 lecture : on met à jour le cache local
};

export const deleteReservation = async (trackingCode) => {
    const docRef = getReservationDoc(trackingCode);
    await deleteDoc(docRef);
    dropFromCache(trackingCode);          // 0 lecture
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
