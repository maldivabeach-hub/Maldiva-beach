// /js/reservationService.js
import { db, appId } from './firebase.js'; 
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 💡 التحسين: تعريف المسارات كدوال لضمان تحميل appId بشكل صحيح وقت الاستدعاء
const getReservationsPath = () => `artifacts/${appId}/public/data/reservations`;
const getClosedDaysPath = () => `artifacts/${appId}/public/data/closedDays`;

let cachedReservations = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

export const submitNewReservation = async (reservationData) => {
    const docRef = doc(db, getReservationsPath(), reservationData.trackingCode);
    await setDoc(docRef, reservationData);
    return reservationData.trackingCode;
};

export const getReservationByCode = async (trackingCode) => {
    const docRef = doc(db, getReservationsPath(), trackingCode);
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
    const q = query(collection(db, getReservationsPath()));
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    cachedReservations = results;
    lastFetchTime = now;
    return results;
};

export const updateReservationData = async (trackingCode, newData) => {
    const docRef = doc(db, getReservationsPath(), trackingCode);
    await updateDoc(docRef, newData);
    if (cachedReservations) {
        const index = cachedReservations.findIndex(r => r.trackingCode === trackingCode);
        if (index > -1) {
            cachedReservations[index] = { ...cachedReservations[index], ...newData };
        }
    }
};

export const deleteReservation = async (trackingCode) => {
    const docRef = doc(db, getReservationsPath(), trackingCode);
    await deleteDoc(docRef);
    if (cachedReservations) {
        cachedReservations = cachedReservations.filter(r => r.trackingCode !== trackingCode);
    }
};

// ==========================================
// دوال إدارة الأيام المغلقة (Closed Days) المحدثة
// ==========================================

export const checkIfDateIsClosed = async (dateStr) => {
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'closedDays', dateStr);
    const snap = await getDoc(docRef);
    return snap.exists();
};

export const setDateClosedStatus = async (dateStr, isClosed) => {
    // نستخدم الطريقة المباشرة والأكثر أماناً لمسار Firestore
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'closedDays', dateStr);
    if (isClosed) {
        await setDoc(docRef, { closedAt: new Date().toISOString() });
    } else {
        await deleteDoc(docRef);
    }
};

export const getClosedDays = async () => {
    const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'closedDays');
    const q = query(collRef);
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        results.push(doc.id); 
    });
    results.sort((a, b) => new Date(a) - new Date(b));
    return results;
};
