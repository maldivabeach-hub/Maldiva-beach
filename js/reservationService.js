// /js/reservationService.js
import { db, appId } from './firebase.js';
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const COLLECTION_PATH = `artifacts/${appId}/public/data/reservations`;

// نظام التخزين المؤقت
let cachedReservations = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

export const submitNewReservation = async (reservationData) => {
    const docRef = doc(db, COLLECTION_PATH, reservationData.trackingCode);
    await setDoc(docRef, reservationData);
    
    // تفريغ الذاكرة المؤقتة لضمان تحديث البيانات فوراً (مهم جداً لأيام الإغلاق)
    cachedReservations = null; 
    
    return reservationData.trackingCode;
};

export const getReservationByCode = async (trackingCode) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
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
    const q = query(collection(db, COLLECTION_PATH));
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });
    // ترتيب تنازلي (الأحدث أولاً)
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    cachedReservations = results;
    lastFetchTime = now;
    return results;
};

export const updateReservationData = async (trackingCode, newData) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
    await updateDoc(docRef, newData);
    
    // تفريغ الذاكرة المؤقتة لضمان التحديث
    cachedReservations = null;
};

export const deleteReservation = async (trackingCode) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
    await deleteDoc(docRef);
    
    // تفريغ الذاكرة المؤقتة لضمان التحديث (هذا ما كان يمنع إلغاء الأيام المغلقة)
    cachedReservations = null;
};
