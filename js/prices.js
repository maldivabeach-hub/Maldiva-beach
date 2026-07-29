// /js/prices.js
// 💰 ملف الأسعار المركزي — عدّل الأسعار من هنا فقط، بدون الحاجة لتعديل باقي الملفات

// أسعار المعدات (بالفرد)
export const equipPrices = {
    'qty-chaise': 2000,
    'qty-transat': 3000,
    'qty-baldaquin': 10000
};

// أسعار الأنشطة (جيت سكي، بيدالو، كاياك، بويّة مسحوبة، قارب)
export const actPrices = {
    'qty-jetski-15': 6000,
    'qty-jetski-30': 12000,
    'qty-jetski-60': 20000,
    'qty-pedalo-30': 1000,
    'qty-pedalo-60': 2000,
    'qty-kayak-30': 1000,
    'qty-kayak-60': 2000,
    'qty-bouee-2': 3000,
    'qty-bouee-3': 4000,
    'qty-bateau-standard': 4000
};

// دمج كل الأسعار في كائن واحد (تستخدمه reservation.js وأي ملف آخر عند الحاجة)
export const allPrices = { ...equipPrices, ...actPrices };

// أسماء العرض (id ⇄ الاسم الظاهر للزبون/الأدمن) — يستخدمها reservation.js و admin.js
export const names = {
    'qty-chaise': 'Chaise Longue',
    'qty-transat': 'Transat en Bois',
    'qty-baldaquin': 'Baldaquin Royal',
    'qty-jetski-15': 'Jet-Ski (15 Min)',
    'qty-jetski-30': 'Jet-Ski (30 Min)',
    'qty-jetski-60': 'Jet-Ski (1 Heure)',
    'qty-pedalo-30': 'Pédalo (30 Min)',
    'qty-pedalo-60': 'Pédalo (1 Heure)',
    'qty-kayak-30': 'Kayak (30 Min)',
    'qty-kayak-60': 'Kayak (1 Heure)',
    'qty-bouee-2': 'Bouée Tractée (2 pers)',
    'qty-bouee-3': 'Bouée Tractée (3 pers)',
    'qty-bateau-standard': 'Bateau (+4 pers)'
};

// نفس الأسعار، لكن مفهرسة بالاسم الظاهر بدل الـ id (تحتاجها admin.js لأن الحجوزات المخزَّنة في Firestore تُسجَّل بالاسم)
export const pricesByName = {};
for (const id in allPrices) {
    pricesByName[names[id]] = allPrices[id];
}

// عروض تركيبية خاصة (Combos) — أرخص من مجموع الأسعار الفردية
export const comboPricing = {
    chaiseOnly2: 5000,    // 2 Chaise Longues (بدون ترانزا) — يشمل مظلة + طاولة
    transatOnly2: 7000,   // 2 Transats en Bois (بدون كرسي استلقاء) — يشمل مظلة + طاولة
    parasolTable: 1000    // + مظلة وطاولة عند حجز قطعة واحدة بمفردها (كرسي واحد أو ترانزا واحد فقط)
};

// تخفيضات حسب مدة الإقامة (على معدات الشاطئ فقط)
export const durationDiscounts = {
    5: 0.10,  // -10% لمدة 5 أيام
    7: 0.15   // -15% لمدة أسبوع كامل
};

// تعرفة الأطفال والرضّع
// ✅ مُفعّلة تلقائيًا في calculateTotal() (index.html) و calculateEditTotal() (admin.html)
export const childPricing = {
    babyFree: true,               // الرضّع: دخول مجاني
    childNoChairFree: true,       // أطفال بدون كرسي استلقاء: دخول مجاني
    childWithChairDiscount: 0.40  // أطفال على كرسي استلقاء: خصم ثابت = 40% من سعر الكرسي الواحد، يُطبّق حتى ضمن عرض 2 كراسي
};
