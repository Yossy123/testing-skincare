/**
 * Mock API handler that emulates the Laravel backend endpoints consumed by
 * this frontend. Mounted via the catch-all route at /api/[...path].
 * All data comes from the in-memory mock database (src/lib/mock/db.ts).
 */

import {
  db,
  rupiah,
  issueToken,
  userIdFromToken,
  daysAgo,
  formatDateId,
  type MockOrder,
  type MockProduct,
  type MockPatient,
  type MockAppointment,
  type MockAddress,
  type MockUser,
} from './db';

/* =========================================================================
   Small helpers
   ========================================================================= */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function apiError(message: string, status: number): Response {
  return json({ message }, status);
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.get('authorization');
  return header ? header.replace(/^Bearer\s+/i, '').trim() : null;
}

function authUser(req: Request): MockUser | null {
  const userId = userIdFromToken(bearer(req));
  return db.users.find((u) => u.id === userId) ?? null;
}

function requireAdmin(req: Request): MockUser | Response {
  const user = authUser(req);
  if (!user) return apiError('Unauthenticated.', 401);
  if (user.role !== 'admin') return apiError('This action is unauthorized.', 403);
  return user;
}

function requireAuth(req: Request): MockUser | Response {
  const user = authUser(req);
  if (!user) return apiError('Unauthenticated.', 401);
  return user;
}

function requireStaff(req: Request): MockUser | Response {
  const user = authUser(req);
  if (!user) return apiError('Unauthenticated.', 401);
  if (user.role !== 'doctor' && user.role !== 'admin') return apiError('This action is unauthorized.', 403);
  return user;
}

const asNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ymdDash(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function orderNumberYmd(d: Date): string {
  return ymdDash(d).replace(/-/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function paginate<T>(items: T[], rawPage: number, perPage: number) {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, rawPage), lastPage);
  const slice = items.slice((current - 1) * perPage, current * perPage);
  const from = total === 0 ? null : (current - 1) * perPage + 1;
  const to = total === 0 ? null : (current - 1) * perPage + slice.length;
  return {
    slice,
    meta: {
      current_page: current,
      from,
      last_page: lastPage,
      path: '/api/mock',
      per_page: perPage,
      to,
      total,
    },
    flat: {
      current_page: current,
      last_page: lastPage,
      per_page: perPage,
      total,
      from,
      to,
    },
  };
}

/* =========================================================================
   Shipping (mock Biteship)
   ========================================================================= */

interface CourierService {
  service: string;
  description: string;
  base: number;
  perKg: number;
  etd: string;
}

const COURIERS: Array<{ code: string; name: string; services: CourierService[] }> = [
  {
    code: 'jne',
    name: 'JNE',
    services: [
      { service: 'REG', description: 'Layanan Reguler', base: 20000, perKg: 5000, etd: '2-3' },
      { service: 'YES', description: 'Yakin Eskpres', base: 35000, perKg: 8000, etd: '1-2' },
    ],
  },
  {
    code: 'sicepat',
    name: 'SiCepat Ekspres',
    services: [
      { service: 'REG', description: 'Regular Service', base: 18000, perKg: 5000, etd: '2-3' },
      { service: 'BEST', description: 'Besok Sampai Tujuan', base: 32000, perKg: 8000, etd: '1' },
    ],
  },
  {
    code: 'jnt',
    name: 'J&T Express',
    services: [
      { service: 'EZ', description: 'Economy Express', base: 19000, perKg: 5000, etd: '2-3' },
      { service: 'REG', description: 'Regular Service', base: 22000, perKg: 5500, etd: '2-3' },
    ],
  },
  {
    code: 'tiki',
    name: 'TIKI',
    services: [
      { service: 'REG', description: 'Regular Service', base: 21000, perKg: 5500, etd: '3-4' },
      { service: 'HDS', description: 'Holiday Service', base: 36000, perKg: 9000, etd: '1-2' },
    ],
  },
  {
    code: 'pos',
    name: 'POS Indonesia',
    services: [
      { service: 'PAKET KILAT KHUSUS', description: 'Layanan Kilat Khusus', base: 17000, perKg: 4500, etd: '3-5' },
      { service: 'PAKET POS NEXTDAY', description: 'Paket Pos Next Day', base: 32000, perKg: 8000, etd: '1-2' },
    ],
  },
];

function rateOut(courier: { code: string; name: string }, svc: CourierService, weight: number) {
  const price = svc.base + Math.ceil(weight / 1000) * svc.perKg;
  return {
    courier: courier.code,
    courier_name: courier.name,
    service: svc.service,
    description: svc.description,
    price,
    formatted_price: rupiah(price),
    etd: svc.etd,
    formatted_etd: `${svc.etd} Hari`,
  };
}

function ratesFor(weight: number, courierCodes?: string[]) {
  const requested =
    courierCodes && courierCodes.length > 0
      ? COURIERS.filter((c) => courierCodes.includes(c.code))
      : COURIERS;
  const rates = requested.flatMap((courier) =>
    courier.services.map((svc) => rateOut(courier, svc, weight))
  );
  return rates.sort((a, b) => a.price - b.price);
}

function computeShipping(courierCode: string, service: string, weight: number): { price: number; etd: string; name: string } {
  const courier =
    COURIERS.find((c) => c.code.toLowerCase() === courierCode.toLowerCase()) ??
    COURIERS.find((c) => c.name.toLowerCase() === courierCode.toLowerCase());
  const svc = courier?.services.find((s) => s.service.toLowerCase() === service.toLowerCase())
    ?? courier?.services[0];
  if (!courier || !svc) {
    return { price: 25000, etd: '2-3 Hari', name: courier?.name ?? courierCode.toUpperCase() };
  }
  const rate = rateOut(courier, svc, weight);
  return { price: rate.price, etd: rate.formatted_etd, name: courier.name };
}

const DESTINATIONS = [
  ['IDNP9010243001', 'DKI Jakarta', 'Jakarta Selatan', 'Kebayoran Baru', 'Gunung', '12110'],
  ['IDNP9010243002', 'DKI Jakarta', 'Jakarta Pusat', 'Menteng', 'Menteng', '10310'],
  ['IDNP9010243003', 'DKI Jakarta', 'Jakarta Selatan', 'Setiabudi', 'Karet', '12920'],
  ['IDNP9010243004', 'DKI Jakarta', 'Jakarta Selatan', 'Tebet', 'Tebet Barat', '12810'],
  ['IDNP9010243005', 'DKI Jakarta', 'Jakarta Selatan', 'Kebayoran Lama', 'Grogol Utara', '12210'],
  ['IDNP9010243006', 'DKI Jakarta', 'Jakarta Barat', 'Grogol Petamburan', 'Tanjung Duren Utara', '11440'],
  ['IDNP9010243007', 'DKI Jakarta', 'Jakarta Barat', 'Cengkareng', 'Kapuk', '11720'],
  ['IDNP9010243008', 'DKI Jakarta', 'Jakarta Utara', 'Kelapa Gading', 'Kelapa Gading Barat', '14240'],
  ['IDNP9010243009', 'DKI Jakarta', 'Jakarta Utara', 'Penjaringan', 'Pluit', '14440'],
  ['IDNP9010243010', 'DKI Jakarta', 'Jakarta Timur', 'Matraman', 'Palmeriam', '13150'],
  ['IDNP9010243011', 'DKI Jakarta', 'Jakarta Timur', 'Cakung', 'Cakung Timur', '13910'],
  ['IDNP9010427001', 'Banten', 'Tangerang Selatan', 'Serpong', 'Rawa Buntu', '15318'],
  ['IDNP9010427002', 'Banten', 'Tangerang Selatan', 'Serpong Utara', 'Pakulonan', '15325'],
  ['IDNP9010427003', 'Banten', 'Tangerang Selatan', 'Pamulang', 'Pamulang Barat', '15417'],
  ['IDNP9010427004', 'Banten', 'Kota Tangerang', 'Pinang', 'Pinang', '15120'],
  ['IDNP9010427005', 'Banten', 'Kota Tangerang', 'Karawaci', 'Karawaci Baru', '15113'],
  ['IDNP9010435001', 'Jawa Barat', 'Kota Bekasi', 'Bekasi Selatan', 'Jaka Sampurna', '17141'],
  ['IDNP9010435002', 'Jawa Barat', 'Kota Bekasi', 'Bekasi Timur', 'Duren Jaya', '17111'],
  ['IDNP9010435003', 'Jawa Barat', 'Kab. Bekasi', 'Cikarang Selatan', 'Sukatani', '17530'],
  ['IDNP9010436001', 'Jawa Barat', 'Kota Depok', 'Beji', 'Tanah Baru', '16426'],
  ['IDNP9010436002', 'Jawa Barat', 'Kota Depok', 'Sukmajaya', 'Bakti Jaya', '16411'],
  ['IDNP9010437001', 'Jawa Barat', 'Kota Bogor', 'Bogor Selatan', 'Empang', '16133'],
  ['IDNP9010437002', 'Jawa Barat', 'Kota Bogor', 'Ciomas', 'Pagelaran', '16610'],
  ['IDNP9020431001', 'Jawa Barat', 'Kota Bandung', 'Coblong', 'Lebakgede', '40132'],
  ['IDNP9020431002', 'Jawa Barat', 'Kota Bandung', 'Sukajadi', 'Pasteur', '40161'],
  ['IDNP9020431003', 'Jawa Barat', 'Kab. Bandung Barat', 'Cimahi Utara', 'Cibabat', '40514'],
  ['IDNP9030439001', 'Jawa Timur', 'Kota Surabaya', 'Gubeng', 'Airlangga', '60286'],
  ['IDNP9030439002', 'Jawa Timur', 'Kota Surabaya', 'Wonokromo', 'Darmo', '60241'],
  ['IDNP9040450001', 'DI Yogyakarta', 'Kota Yogyakarta', 'Gondokusuman', 'Demangan', '55221'],
  ['IDNP9050460001', 'Jawa Tengah', 'Kota Semarang', 'Semarang Tengah', 'Pandansari', '50138'],
];

function destinationOut(row: string[]) {
  return {
    id: row[0],
    label: `${row[3]}, ${row[2]}, ${row[1]}`,
    province_name: row[1],
    city_name: row[2],
    district_name: row[3],
    subdistrict_name: row[4],
    zip_code: row[5],
  };
}

/* =========================================================================
   Mappers
   ========================================================================= */

function productOut(p: MockProduct) {
  return {
    ...p,
    formatted_price: rupiah(p.price),
    category: db.categories.find((c) => c.id === p.category_id) ?? null,
  };
}

function categoryOut(c: (typeof db.categories)[number]) {
  return {
    ...c,
    products_count: db.products.filter((p) => p.category_id === c.id && p.is_active).length,
  };
}

function itemsOfOrder(orderId: number) {
  return db.orderItems.filter((i) => i.order_id === orderId);
}

function paymentOfOrder(orderId: number) {
  return db.payments.find((p) => p.order_id === orderId) ?? null;
}

function shipmentOfOrder(orderId: number) {
  return db.shipments.find((s) => s.order_id === orderId) ?? null;
}

function orderCustomerOut(o: MockOrder) {
  return {
    id: o.id,
    user_id: o.user_id,
    status: o.status,
    subtotal: o.subtotal,
    formatted_subtotal: rupiah(o.subtotal),
    shipping_cost: o.shipping_cost,
    formatted_shipping_cost: rupiah(o.shipping_cost),
    total: o.total,
    formatted_total: rupiah(o.total),
    shipping_courier: o.shipping_courier,
    shipping_service: o.shipping_service,
    shipping_etd: o.shipping_etd,
    shipping_address: { ...o.shipping_address },
    items: itemsOfOrder(o.id).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit_price: item.unit_price,
      formatted_unit_price: rupiah(item.unit_price),
      quantity: item.quantity,
      subtotal: item.subtotal,
      formatted_subtotal: rupiah(item.subtotal),
    })),
    shipment: shipmentOfOrder(o.id),
    payment: (() => {
      const p = paymentOfOrder(o.id);
      if (!p) return null;
      return {
        id: p.id,
        payment_type: p.payment_type,
        status: p.status,
        amount: p.amount,
        snap_token: p.snap_token,
        redirect_url: p.redirect_url,
        expires_at: p.expires_at,
      };
    })(),
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

const ALLOWED_ACTIONS: Record<string, Array<'process' | 'ship' | 'deliver' | 'complete' | 'cancel'>> = {
  PENDING_PAYMENT: ['cancel'],
  PAID: ['process', 'cancel'],
  PROCESSING: ['ship'],
  SHIPPED: ['deliver'],
  DELIVERED: ['complete'],
};

const REVENUE_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];

function adminOrderItemOut(o: MockOrder) {
  const user = db.users.find((u) => u.id === o.user_id) ?? null;
  const payment = paymentOfOrder(o.id);
  const shipment = shipmentOfOrder(o.id);
  return {
    id: o.id,
    user_id: o.user_id,
    status: o.status,
    subtotal: o.subtotal,
    shipping_cost: o.shipping_cost,
    total: o.total,
    shipping_courier: o.shipping_courier,
    shipping_service: o.shipping_service,
    shipping_etd: o.shipping_etd,
    shipping_address: { ...o.shipping_address },
    cancellation_reason: o.cancellation_reason,
    cancellation_note: o.cancellation_reason,
    cancelled_at: o.cancelled_at,
    allowed_actions: ALLOWED_ACTIONS[o.status] ?? [],
    user: user
      ? { id: user.id, name: user.name, email: user.email, phone: user.phone }
      : null,
    payment: payment
      ? {
          id: payment.id,
          order_id: payment.order_id,
          provider: payment.provider,
          transaction_id: payment.transaction_id,
          status: payment.status,
          amount: payment.amount,
          paid_at: payment.paid_at,
        }
      : null,
    shipment,
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

function adminOrderDetailOut(o: MockOrder) {
  const cancelledBy = o.status === 'CANCELLED' ? db.users.find((u) => u.id === 1) ?? null : null;
  return {
    ...adminOrderItemOut(o),
    order_items: itemsOfOrder(o.id).map((item) => {
      const product = db.products.find((p) => p.id === item.product_id) ?? null;
      return {
        id: item.id,
        order_id: item.order_id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        product: product ? productOut(product) : null,
      };
    }),
    cancelled_by_user: cancelledBy
      ? { id: cancelledBy.id, name: cancelledBy.name, email: cancelledBy.email }
      : null,
    audit_logs: db.auditLogs
      .filter((log) => log.order_id === o.id)
      .map((log) => ({
        ...log,
        admin: log.admin_id
          ? (() => {
              const admin = db.users.find((u) => u.id === log.admin_id);
              return admin ? { id: admin.id, name: admin.name, email: admin.email } : null;
            })()
          : null,
      })),
  };
}

function pushAudit(orderId: number, action: string, previous: string | null, next: string, reason: string | null = null) {
  db.auditLogs.push({
    id: ++db.seq.auditLog,
    order_id: orderId,
    admin_id: 1,
    action,
    previous_status: previous,
    new_status: next,
    reason,
    note: null,
    created_at: nowIso(),
  });
}

function patientOut(p: MockPatient) {
  return {
    ...p,
    appointments_count: db.appointments.filter((a) => a.patient_id === p.id).length,
  };
}

function appointmentOut(a: MockAppointment) {
  const patient = db.patients.find((p) => p.id === a.patient_id) ?? null;
  const doctor = db.doctors.find((d) => d.id === a.doctor_id) ?? null;
  const service = db.services.find((s) => s.id === a.service_id) ?? null;
  return {
    ...a,
    patient: patient ? patientOut(patient) : null,
    doctor,
    service,
    status_histories: db.statusHistories
      .filter((h) => h.appointment_id === a.id)
      .map((h) => ({
        ...h,
        changer: h.to_status
          ? (() => {
              const admin = db.users.find((u) => u.id === 1);
              return admin ? { id: admin.id, name: admin.name, email: admin.email, role: admin.role } : null;
            })()
          : null,
      })),
  };
}

function pushAppointmentHistory(appointmentId: number, from: string | null, to: string, notes: string | null = null) {
  db.statusHistories.push({
    id: ++db.seq.statusHistory,
    appointment_id: appointmentId,
    from_status: from,
    to_status: to,
    notes,
    created_at: nowIso(),
  });
}

/* =========================================================================
   Analytics builders
   ========================================================================= */

function revenueSeries(days: number) {
  const out: Array<{ date: string; label: string; revenue: number; formatted_revenue: string; orders: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const seed = d.getDate() * 31 + (d.getMonth() + 1) * 7;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const revenue = 2_200_000 + (seed % 37) * 165_000 + (weekend ? 1_450_000 : 250_000);
    const orders = 3 + (seed % 9) + (weekend ? 4 : 1);
    out.push({
      date: ymdDash(d),
      label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      revenue,
      formatted_revenue: rupiah(revenue),
      orders,
    });
  }
  return out;
}

function statusDistribution() {
  const statuses = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
  const total = db.orders.length || 1;
  return statuses
    .map((status) => {
      const orders = db.orders.filter((o) => o.status === status);
      return {
        status,
        count: orders.length,
        percentage: Math.round((orders.length / total) * 1000) / 10,
        total_amount: orders.reduce((sum, o) => sum + o.total, 0),
        formatted_amount: rupiah(orders.reduce((sum, o) => sum + o.total, 0)),
      };
    })
    .filter((row) => row.count > 0);
}

function inventoryAlerts() {
  const low = db.products.filter((p) => p.stock > 0 && p.stock <= 5);
  const out = db.products.filter((p) => p.stock === 0);
  const shape = (p: MockProduct) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    stock: p.stock,
    price: p.price,
    formatted_price: rupiah(p.price),
    status: p.is_active ? 'active' : 'inactive',
  });
  return {
    low_stock: low.map(shape),
    low_stock_count: low.length,
    out_of_stock: out.map(shape),
    out_of_stock_count: out.length,
  };
}

function recentOrdersAdmin(limit: number) {
  return [...db.orders]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((o) => {
      const user = db.users.find((u) => u.id === o.user_id);
      const payment = paymentOfOrder(o.id);
      return {
        id: o.id,
        order_number: o.order_number,
        customer: {
          name: user?.name ?? 'Pelanggan',
          email: user?.email ?? '-',
        },
        created_at: o.created_at,
        formatted_date: formatDateId(new Date(o.created_at)),
        total: o.total,
        formatted_total: rupiah(o.total),
        order_status: o.status,
        payment_status: payment?.status ?? 'pending',
        courier: o.shipping_courier,
      };
    });
}

function paidTotal(): number {
  return db.orders
    .filter((o) => REVENUE_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);
}

function buildDashboardOverview() {
  const today = ymdDash(new Date());
  const todayOrders = db.orders.filter((o) => o.created_at.slice(0, 10) === today);
  const revenue = paidTotal();
  const customers = db.users.filter((u) => u.role === 'customer');
  const low = db.products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outOfStock = db.products.filter((p) => p.stock === 0).length;

  return {
    kpis: {
      total_revenue: { value: revenue, formatted: rupiah(revenue), label: 'Total Pendapatan' },
      total_orders: { value: db.orders.length, formatted: String(db.orders.length), label: 'Total Pesanan' },
      total_customers: { value: customers.length, formatted: String(customers.length), label: 'Total Pelanggan' },
      total_products: { value: db.products.length, formatted: String(db.products.length), label: 'Total Produk' },
      today_revenue: {
        value: todayOrders.filter((o) => REVENUE_STATUSES.includes(o.status)).reduce((s, o) => s + o.total, 0),
        formatted: rupiah(todayOrders.filter((o) => REVENUE_STATUSES.includes(o.status)).reduce((s, o) => s + o.total, 0)),
        label: 'Pendapatan Hari Ini',
      },
      today_orders: { value: todayOrders.length, formatted: String(todayOrders.length), label: 'Pesanan Hari Ini' },
      pending_payments: {
        value: db.orders.filter((o) => o.status === 'PENDING_PAYMENT').length,
        formatted: String(db.orders.filter((o) => o.status === 'PENDING_PAYMENT').length),
        label: 'Menunggu Pembayaran',
      },
      low_stock_products: { value: low + outOfStock, formatted: String(low + outOfStock), label: 'Produk Stok Menipis' },
    },
    sales_trend_7d: revenueSeries(7),
    status_distribution: statusDistribution(),
    recent_orders: recentOrdersAdmin(5),
    top_products: [...db.products]
      .sort((a, b) => b.units_sold * b.price - a.units_sold * a.price)
      .slice(0, 5)
      .map((p) => ({
        product_id: p.id,
        name: p.name,
        units_sold: p.units_sold,
        revenue: p.units_sold * p.price,
        formatted_revenue: rupiah(p.units_sold * p.price),
      })),
    inventory_alerts: inventoryAlerts(),
    clinical: {
      total_patients: db.patients.length,
      new_patients_this_month: db.patients.filter((p) => {
        const created = new Date(p.created_at);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length,
      bookings_today: db.appointments.filter((a) => a.appointment_date === today).length,
      bookings_pending: db.appointments.filter((a) => a.status === 'pending').length,
      bookings_confirmed: db.appointments.filter((a) => a.status === 'confirmed').length,
      bookings_completed: db.appointments.filter((a) => a.status === 'completed').length,
      today_doctor_schedules: db.doctors
        .filter((d) => d.status === 'active')
        .map((d) => ({
          id: d.id,
          name: d.name,
          specialization: d.specialization,
          appointments_count: db.appointments.filter((a) => a.doctor_id === d.id && a.appointment_date === today).length,
        })),
    },
  };
}

function buildSalesAnalytics(period: string) {
  const series = revenueSeries(30);
  const revenue = series.reduce((s, r) => s + r.revenue, 0);
  const orders = series.reduce((s, r) => s + r.orders, 0);
  const end = new Date();
  const start = daysAgo(29);
  return {
    period,
    start_date: ymdDash(start),
    end_date: ymdDash(end),
    summary: {
      revenue,
      formatted_revenue: rupiah(revenue),
      orders,
      average_order_value: Math.round(revenue / Math.max(1, orders)),
      formatted_average_order_value: rupiah(Math.round(revenue / Math.max(1, orders))),
    },
    series,
  };
}

function buildCustomerAnalytics(period: string) {
  const customers = db.users.filter((u) => u.role === 'customer');
  const topCustomers = customers
    .map((c) => {
      const orders = db.orders.filter((o) => o.user_id === c.id && REVENUE_STATUSES.includes(o.status));
      const spent = orders.reduce((s, o) => s + o.total, 0);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        orders_count: orders.length,
        total_spent: spent,
        formatted_total_spent: rupiah(spent),
        last_order_date: orders.length > 0 ? [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at : null,
      };
    })
    .sort((a, b) => b.total_spent - a.total_spent);
  const purchasing = topCustomers.filter((c) => c.orders_count > 0).length;
  const repeat = topCustomers.filter((c) => c.orders_count > 1).length;
  return {
    period,
    summary: {
      total_customers: customers.length,
      new_customers: customers.filter((c) => {
        const created = new Date(c.created_at);
        const now = new Date();
        return now.getTime() - created.getTime() < 30 * 24 * 60 * 60 * 1000;
      }).length,
      purchasing_customers: purchasing,
      repeat_customers: repeat,
      repeat_rate_percentage: purchasing > 0 ? Math.round((repeat / purchasing) * 1000) / 10 : 0,
    },
    top_customers: topCustomers.slice(0, 5),
  };
}

function buildPaymentAnalytics(period: string) {
  const payments = db.payments;
  const byStatus = (status: string) => payments.filter((p) => p.status === status);
  const sumAmount = (list: typeof payments) => list.reduce((s, p) => s + p.amount, 0);
  const successful = byStatus('success');
  const totalTx = payments.length || 1;
  const methods = ['gopay', 'bca_va', 'bri_va', 'simulated_qris'];
  return {
    period,
    summary: {
      total_transactions: payments.length,
      success_rate_percentage: Math.round((successful.length / totalTx) * 1000) / 10,
      successful: { count: successful.length, amount: sumAmount(successful), formatted_amount: rupiah(sumAmount(successful)) },
      pending: { count: byStatus('pending').length, amount: sumAmount(byStatus('pending')), formatted_amount: rupiah(sumAmount(byStatus('pending'))) },
      failed: { count: byStatus('failed').length, amount: sumAmount(byStatus('failed')), formatted_amount: rupiah(sumAmount(byStatus('failed'))) },
      expired: { count: byStatus('expired').length, amount: sumAmount(byStatus('expired')), formatted_amount: rupiah(sumAmount(byStatus('expired'))) },
    },
    payment_methods: methods
      .map((method) => {
        const list = successful.filter((p) => p.payment_type === method);
        return { method, count: list.length, amount: sumAmount(list), formatted_amount: rupiah(sumAmount(list)) };
      })
      .filter((m) => m.count > 0),
  };
}

function buildShippingAnalytics(period: string) {
  const shippedOrders = db.orders.filter((o) => shipmentOfOrder(o.id) !== null);
  const totalCost = shippedOrders.reduce((s, o) => s + o.shipping_cost, 0);
  const courierMap = new Map<string, { count: number; cost: number }>();
  const serviceMap = new Map<string, { count: number; cost: number }>();
  shippedOrders.forEach((o) => {
    const c = courierMap.get(o.shipping_courier) ?? { count: 0, cost: 0 };
    courierMap.set(o.shipping_courier, { count: c.count + 1, cost: c.cost + o.shipping_cost });
    const key = `${o.shipping_courier} — ${o.shipping_service}`;
    const s = serviceMap.get(key) ?? { count: 0, cost: 0 };
    serviceMap.set(key, { count: s.count + 1, cost: s.cost + o.shipping_cost });
  });
  const totalShipped = shippedOrders.length || 1;
  return {
    period,
    summary: {
      total_shipped_orders: shippedOrders.length,
      total_shipping_cost: totalCost,
      formatted_total_shipping_cost: rupiah(totalCost),
      average_shipping_cost: Math.round(totalCost / totalShipped),
      formatted_average_shipping_cost: rupiah(Math.round(totalCost / totalShipped)),
    },
    courier_usage: [...courierMap.entries()].map(([courier, agg]) => ({
      courier,
      orders_count: agg.count,
      percentage: Math.round((agg.count / totalShipped) * 1000) / 10,
      total_cost: agg.cost,
      formatted_total_cost: rupiah(agg.cost),
    })),
    service_usage: [...serviceMap.entries()].map(([key, agg]) => {
      const [courier, service] = key.split(' — ');
      return { courier, service, orders_count: agg.count, total_cost: agg.cost, formatted_total_cost: rupiah(agg.cost) };
    }),
    destinations: [
      { region: 'DKI Jakarta', orders_count: 5, percentage: 45.5 },
      { region: 'Jawa Barat', orders_count: 3, percentage: 27.2 },
      { region: 'Banten', orders_count: 2, percentage: 18.2 },
      { region: 'Jawa Timur', orders_count: 1, percentage: 9.1 },
    ],
  };
}

/* =========================================================================
   Endpoint handlers
   ========================================================================= */

function handleProducts(searchParams: URLSearchParams): Response {
  const search = (searchParams.get('search') ?? '').toLowerCase();
  const category = searchParams.get('category') ?? '';
  const sort = searchParams.get('sort') ?? 'latest';
  const page = asNumber(searchParams.get('page'), 1);
  const perPage = asNumber(searchParams.get('per_page'), 12);

  let items = db.products.filter((p) => p.is_active);
  if (search) {
    items = items.filter((p) => p.name.toLowerCase().includes(search));
  }
  if (category) {
    const cat = db.categories.find((c) => c.slug === category);
    items = cat ? items.filter((p) => p.category_id === cat.id) : [];
  }
  switch (sort) {
    case 'price_asc': items.sort((a, b) => a.price - b.price); break;
    case 'price_desc': items.sort((a, b) => b.price - a.price); break;
    case 'name_asc': items.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name_desc': items.sort((a, b) => b.name.localeCompare(a.name)); break;
    default: items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const { slice, meta } = paginate(items, page, perPage);
  return json({
    data: slice.map(productOut),
    links: { first: null, last: null, prev: null, next: null },
    meta,
  });
}

function handleCheckoutValidate(body: Record<string, unknown>, user: MockUser): Response {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const addressId = body.address_id != null ? asNumber(body.address_id) : null;

  const items = rawItems.map((raw) => {
    const entry = raw as { product_id?: unknown; quantity?: unknown };
    const productId = asNumber(entry.product_id);
    const quantity = Math.max(1, asNumber(entry.quantity, 1));
    const product = db.products.find((p) => p.id === productId);
    return { productId, quantity, product };
  });

  if (items.some((i) => !i.product)) {
    return apiError('Produk tidak ditemukan atau sudah tidak aktif.', 422);
  }

  const address: MockAddress | undefined = addressId
    ? db.addresses.find((a) => a.id === addressId && a.user_id === user.id)
    : undefined;

  const mapped = items.map(({ product, quantity }) => {
    const p = product as MockProduct;
    const category = db.categories.find((c) => c.id === p.category_id) ?? null;
    return {
      product_id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.image,
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      price: p.price,
      formatted_price: rupiah(p.price),
      weight: p.weight,
      stock: p.stock,
      quantity,
      line_subtotal: p.price * quantity,
      formatted_line_subtotal: rupiah(p.price * quantity),
    };
  });

  const subtotal = mapped.reduce((s, i) => s + i.line_subtotal, 0);
  const totalWeight = mapped.reduce((s, i) => s + i.weight * i.quantity, 0);
  const totalItems = mapped.reduce((s, i) => s + i.quantity, 0);
  const isValid = mapped.every((i) => i.stock >= i.quantity);

  return json({
    items: mapped,
    summary: {
      subtotal,
      formatted_subtotal: rupiah(subtotal),
      total_weight: totalWeight,
      formatted_total_weight: `${(totalWeight / 1000).toLocaleString('id-ID')} kg`,
      total_items: totalItems,
    },
    shipping_address: address
      ? {
          id: address.id,
          user_id: address.user_id,
          label: address.label,
          recipient_name: address.recipient_name,
          name: address.name,
          phone: address.phone,
          province: address.province,
          city: address.city,
          district: address.district,
          postal_code: address.postal_code,
          address: address.address,
          address_line: address.address,
          address_detail: null,
          biteship_area_id: address.biteship_area_id,
          is_default: address.is_default,
          created_at: address.created_at,
          updated_at: address.updated_at,
        }
      : null,
    is_valid: isValid,
  });
}

function createOrderFromPayload(body: Record<string, unknown>, user: MockUser): Response {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const addressId = asNumber(body.address_id);
  const courier = asString(body.courier);
  const service = asString(body.service);

  const address = db.addresses.find((a) => a.id === addressId && a.user_id === user.id);
  if (!address) {
    return apiError('Alamat pengiriman tidak ditemukan.', 422);
  }
  if (!courier || !service) {
    return apiError('Kurir dan layanan pengiriman wajib dipilih.', 422);
  }

  const resolved = rawItems.map((raw) => {
    const entry = raw as { product_id?: unknown; quantity?: unknown };
    const product = db.products.find((p) => p.id === asNumber(entry.product_id));
    return { product, quantity: Math.max(1, asNumber(entry.quantity, 1)) };
  });
  if (resolved.some((r) => !r.product)) {
    return apiError('Produk tidak ditemukan.', 422);
  }

  const subtotal = resolved.reduce((s, r) => s + (r.product as MockProduct).price * r.quantity, 0);
  const weight = resolved.reduce((s, r) => s + (r.product as MockProduct).weight * r.quantity, 0);
  const shipping = computeShipping(courier, service, weight);
  const total = subtotal + shipping.price;

  const orderId = ++db.seq.order;
  const created = new Date();
  const items = resolved.map(({ product, quantity }) => {
    const p = product as MockProduct;
    p.stock = Math.max(0, p.stock - quantity);
    return {
      id: ++db.seq.orderItem,
      order_id: orderId,
      product_id: p.id,
      product_name: p.name,
      unit_price: p.price,
      quantity,
      subtotal: p.price * quantity,
    };
  });
  items.forEach((item) => db.orderItems.push(item));

  db.orders.push({
    id: orderId,
    order_number: `ORD-${orderNumberYmd(created)}-${String(100 + orderId)}`,
    user_id: user.id,
    status: 'PENDING_PAYMENT',
    subtotal,
    shipping_cost: shipping.price,
    total,
    shipping_courier: shipping.name,
    shipping_service: service,
    shipping_etd: shipping.etd,
    shipping_address: {
      recipient_name: address.recipient_name ?? address.name,
      name: address.name,
      phone: address.phone,
      province: address.province,
      city: address.city,
      district: address.district,
      postal_code: address.postal_code,
      address: address.address,
    },
    cancellation_reason: null,
    cancelled_at: null,
    created_at: created.toISOString(),
    updated_at: created.toISOString(),
  });

  db.payments.push({
    id: ++db.seq.payment,
    order_id: orderId,
    provider: 'midtrans',
    transaction_id: null,
    payment_type: null,
    status: 'pending',
    amount: total,
    snap_token: `MOCK-SNAP-${orderId}`,
    redirect_url: null,
    paid_at: null,
    expires_at: new Date(created.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });

  pushAudit(orderId, 'created', null, 'PENDING_PAYMENT');

  const order = db.orders.find((o) => o.id === orderId) as MockOrder;
  return json({ data: orderCustomerOut(order) }, 201);
}

function availableSlots(doctorId: number, date: string, serviceId: number | null): Response {
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return apiError('Dokter tidak ditemukan.', 404);
  const service = serviceId ? db.services.find((s) => s.id === serviceId) ?? null : null;
  const duration = service?.duration_minutes ?? 60;

  const [y, m, d] = date.split('-').map(Number);
  const dayDate = new Date(y, (m || 1) - 1, d || 1);
  const isAvailable = doctor.available_days.includes(dayDate.getDay());

  const toMinutes = (t: string) => {
    const [h, mm] = t.split(':').map(Number);
    return h * 60 + mm;
  };
  const startMin = toMinutes(doctor.work_start_time);
  const endMin = toMinutes(doctor.work_end_time);
  const busyTimes = db.appointments
    .filter((a) => a.doctor_id === doctorId && a.appointment_date === date && !['cancelled', 'no_show'].includes(a.status))
    .map((a) => a.appointment_time);

  const slots: Array<{ start: string; end: string; is_booked: boolean }> = [];
  for (let t = startMin; t + duration <= endMin; t += 60) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    const endTime = t + duration;
    slots.push({
      start: `${hh}:${mm}`,
      end: `${String(Math.floor(endTime / 60)).padStart(2, '0')}:${String(endTime % 60).padStart(2, '0')}`,
      is_booked: busyTimes.includes(`${hh}:${mm}`),
    });
  }

  return json({
    data: {
      doctor,
      date,
      is_doctor_available: isAvailable,
      slots: isAvailable ? slots : [],
    },
  });
}

function createBooking(body: Record<string, unknown>, user: MockUser | null): Response {
  const serviceId = asNumber(body.service_id);
  const doctorId = asNumber(body.doctor_id);
  const mode = asString(body.consultation_mode, 'offline') === 'online' ? 'online' : 'offline';
  const date = asString(body.date);
  const startTime = asString(body.start_time);
  const name = asString(body.name);
  const phone = asString(body.phone);

  const service = db.services.find((s) => s.id === serviceId);
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!service || !doctor || !date || !startTime || !name || !phone) {
    return apiError('Data reservasi tidak lengkap.', 422);
  }

  let patient = db.patients.find((p) => p.phone === phone);
  if (!patient) {
    patient = {
      id: ++db.seq.patient,
      user_id: user?.id ?? null,
      name,
      phone,
      email: asString(body.email) || null,
      date_of_birth: null,
      gender: null,
      address: null,
      skin_type: null,
      notes: null,
      allergies: null,
      medical_history: null,
      emergency_contact: null,
      status: 'active',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.patients.push(patient);
  } else if (user && !patient.user_id) {
    patient.user_id = user.id;
  }

  const [h, mm] = startTime.split(':').map(Number);
  const endMinutes = h * 60 + mm + service.duration_minutes;
  const appointmentId = ++db.seq.appointment;
  const created = nowIso();

  const appointment: MockAppointment = {
    id: appointmentId,
    booking_code: `LB-${new Date().getFullYear()}-${String(2000 + appointmentId)}`,
    patient_id: patient.id,
    doctor_id: doctor.id,
    service_id: service.id,
    appointment_date: date,
    appointment_time: `${String(h).padStart(2, '0')}:${String(mm ?? 0).padStart(2, '0')}`,
    start_time: `${date}T${String(h).padStart(2, '0')}:${String(mm ?? 0).padStart(2, '0')}:00`,
    end_time: `${date}T${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`,
    consultation_mode: mode,
    meeting_link: mode === 'online' ? 'https://meet.nobyderm.com/room/demo-clinic' : null,
    complaint: asString(body.notes) || null,
    patient_notes: asString(body.notes) || null,
    doctor_notes: null,
    diagnosis: null,
    treatment_plan: null,
    prescription: null,
    status: 'pending',
    cancellation_reason: null,
    created_at: created,
    updated_at: created,
  };
  db.appointments.push(appointment);
  pushAppointmentHistory(appointmentId, null, 'pending');

  return json({ data: appointmentOut(appointment) }, 201);
}

function doctorForUser(user: MockUser) {
  return db.doctors.find((d) => d.user_id === user.id) ?? db.doctors[0];
}

function buildDoctorOverview(user: MockUser) {
  const doctor = doctorForUser(user);
  const today = ymdDash(new Date());
  const mine = db.appointments.filter((a) => a.doctor_id === doctor.id);
  const todayQueue = mine
    .filter((a) => a.appointment_date === today)
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  const upcoming = mine
    .filter((a) => a.appointment_date > today && ['confirmed', 'pending'].includes(a.status))
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  const recentCompleted = mine
    .filter((a) => a.status === 'completed')
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
    .slice(0, 5);
  const patientIds = new Set(mine.map((a) => a.patient_id));

  return {
    doctor,
    today_date: today,
    metrics: {
      today_appointments: todayQueue.length,
      waiting_patients: todayQueue.filter((a) => a.status === 'checked_in').length,
      in_progress: todayQueue.filter((a) => a.status === 'in_progress').length,
      completed_today: todayQueue.filter((a) => a.status === 'completed').length,
      upcoming_appointments: upcoming.length,
      total_patients: patientIds.size,
    },
    today_queue: todayQueue.map(appointmentOut),
    upcoming_queue: upcoming.slice(0, 5).map(appointmentOut),
    recent_patients: recentCompleted.map(appointmentOut),
    today_appointments: todayQueue.map(appointmentOut),
    upcoming_appointments: upcoming.map(appointmentOut),
  };
}

function adminAppointmentsFiltered(searchParams: URLSearchParams) {
  const date = searchParams.get('date') ?? '';
  const doctorId = searchParams.get('doctor_id');
  const serviceId = searchParams.get('service_id');
  const status = searchParams.get('status') ?? '';
  const search = (searchParams.get('search') ?? '').toLowerCase();
  const page = asNumber(searchParams.get('page'), 1);

  let items = [...db.appointments].sort((a, b) => b.start_time.localeCompare(a.start_time));
  if (date) items = items.filter((a) => a.appointment_date === date);
  if (doctorId) items = items.filter((a) => a.doctor_id === asNumber(doctorId));
  if (serviceId) items = items.filter((a) => a.service_id === asNumber(serviceId));
  if (status) items = items.filter((a) => a.status === status);
  if (search) {
    items = items.filter((a) => {
      const patient = db.patients.find((p) => p.id === a.patient_id);
      return a.booking_code.toLowerCase().includes(search) || (patient?.name.toLowerCase().includes(search) ?? false);
    });
  }
  return { items, page };
}

function adminPatientsFiltered(searchParams: URLSearchParams) {
  const search = (searchParams.get('search') ?? '').toLowerCase();
  const status = searchParams.get('status') ?? '';
  const page = asNumber(searchParams.get('page'), 1);

  let items = [...db.patients].sort((a, b) => a.name.localeCompare(b.name));
  if (search) {
    items = items.filter((p) => p.name.toLowerCase().includes(search) || p.phone.includes(search));
  }
  if (status) items = items.filter((p) => p.status === status);
  return { items, page };
}

/* =========================================================================
   Main router
   ========================================================================= */

export async function handleMockApi(req: Request, segments: string[]): Promise<Response> {
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  const sp = url.searchParams;
  const path = segments.join('/');

  /* ---------- Public: health ---------- */
  if (path === 'health' && method === 'GET') {
    return json({ status: 'ok', service: 'nobyderm-mock-api', timestamp: nowIso() });
  }

  /* ---------- Auth ---------- */
  if (path === 'auth/login' && method === 'POST') {
    const body = await readBody(req);
    const email = asString(body.email).trim().toLowerCase();
    let user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      const inferredRole = email.includes('admin')
        ? 'admin' as const
        : email.includes('doctor') || email.includes('dokter')
          ? 'doctor' as const
          : 'customer' as const;
      const nameGuess = email.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Demo User';
      user = {
        id: ++db.seq.user,
        name: nameGuess.replace(/\b\w/g, (c) => c.toUpperCase()),
        email,
        role: inferredRole,
        phone: null,
        email_verified_at: nowIso(),
        is_active: true,
        created_at: nowIso(),
      };
      db.users.push(user);
    }
    return json({
      message: 'Login berhasil (mode demo).',
      token: issueToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        email_verified_at: user.email_verified_at,
        created_at: user.created_at,
      },
    });
  }

  if (path === 'auth/register' && method === 'POST') {
    const body = await readBody(req);
    const email = asString(body.email).trim().toLowerCase();
    let user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      user = {
        id: ++db.seq.user,
        name: asString(body.name, 'Pelanggan Baru'),
        email,
        role: 'customer',
        phone: asString(body.phone) || null,
        email_verified_at: nowIso(),
        is_active: true,
        created_at: nowIso(),
      };
      db.users.push(user);
    }
    return json(
      {
        message: 'Registrasi berhasil (mode demo).',
        token: issueToken(user.id),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          email_verified_at: user.email_verified_at,
          created_at: user.created_at,
        },
      },
      201
    );
  }

  if (path === 'auth/logout' && method === 'POST') {
    return json({ message: 'Logout berhasil.' });
  }

  if (path === 'me' && method === 'GET') {
    const user = authUser(req);
    if (!user) return apiError('Unauthenticated.', 401);
    return json({ user });
  }

  /* ---------- Catalog ---------- */
  if (path === 'products' && method === 'GET') return handleProducts(sp);

  if (segments[0] === 'products' && segments.length === 2 && method === 'GET') {
    const product = db.products.find((p) => p.slug === segments[1] || String(p.id) === segments[1]);
    if (!product) return apiError('Produk tidak ditemukan.', 404);
    return json({ data: productOut(product) });
  }

  if (path === 'categories' && method === 'GET') {
    return json({ data: db.categories.filter((c) => c.is_active).map(categoryOut) });
  }

  if (segments[0] === 'categories' && segments.length === 2 && method === 'GET') {
    const category = db.categories.find((c) => c.slug === segments[1]);
    if (!category) return apiError('Kategori tidak ditemukan.', 404);
    return json({ data: categoryOut(category) });
  }

  /* ---------- Shipping ---------- */
  if (path === 'shipping/rates' && method === 'POST') {
    const body = await readBody(req);
    const weight = Math.max(1, asNumber(body.weight, 1000));
    const courierParam = body.couriers;
    const courierCodes = Array.isArray(courierParam)
      ? courierParam.map((c) => asString(c))
      : typeof courierParam === 'string'
        ? courierParam.split(',')
        : undefined;
    return json({ data: ratesFor(weight, courierCodes) });
  }

  if (path === 'shipping/destinations' && method === 'GET') {
    const search = (sp.get('search') ?? '').toLowerCase();
    const matches = DESTINATIONS.filter((row) =>
      row.slice(1).join(' ').toLowerCase().includes(search)
    );
    return json({ data: (matches.length > 0 ? matches : DESTINATIONS).slice(0, 10).map(destinationOut) });
  }

  /* ---------- Checkout & orders ---------- */
  if (path === 'checkout/validate' && method === 'POST') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    return handleCheckoutValidate(body, auth);
  }

  if (path === 'orders' && method === 'POST') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    return createOrderFromPayload(body, auth);
  }

  if (path === 'orders' && method === 'GET') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const page = asNumber(sp.get('page'), 1);
    const mine = db.orders
      .filter((o) => o.user_id === auth.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { slice, meta } = paginate(mine, page, 10);
    return json({ data: slice.map(orderCustomerOut), links: { first: null, last: null, prev: null, next: null }, meta });
  }

  if (segments[0] === 'orders' && segments.length === 2 && method === 'GET') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const order = db.orders.find((o) => o.id === asNumber(segments[1]) && o.user_id === auth.id);
    if (!order) return apiError('Pesanan tidak ditemukan.', 404);
    return json({ data: orderCustomerOut(order) });
  }

  /* ---------- Payments ---------- */
  if (path === 'payments' && method === 'POST') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    const order = db.orders.find((o) => o.id === asNumber(body.order_id) && o.user_id === auth.id);
    if (!order) return apiError('Pesanan tidak ditemukan.', 404);
    const payment = paymentOfOrder(order.id);
    return json({
      data: {
        payment_id: payment?.id ?? 0,
        token: payment?.snap_token ?? `MOCK-SNAP-${order.id}`,
        redirect_url: null,
        amount: order.total,
      },
    });
  }

  if (path === 'payments/simulate' && method === 'POST') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    const order = db.orders.find((o) => o.id === asNumber(body.order_id) && o.user_id === auth.id);
    if (!order) return apiError('Pesanan tidak ditemukan.', 404);
    if (order.status !== 'PENDING_PAYMENT') {
      return apiError('Pesanan ini tidak sedang menunggu pembayaran.', 422);
    }
    order.status = 'PAID';
    order.updated_at = nowIso();
    const payment = paymentOfOrder(order.id);
    if (payment) {
      payment.status = 'success';
      payment.payment_type = 'simulated_qris';
      payment.transaction_id = `MOCK-TXN-${order.id}-${Date.now()}`;
      payment.paid_at = nowIso();
      payment.snap_token = null;
    }
    pushAudit(order.id, 'paid', 'PENDING_PAYMENT', 'PAID', 'Simulasi pembayaran demo');
    return json({ data: { message: 'Pembayaran simulasi berhasil.', order: orderCustomerOut(order) } });
  }

  /* ---------- Addresses ---------- */
  if (path === 'addresses' && method === 'GET') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    return json({ data: db.addresses.filter((a) => a.user_id === auth.id) });
  }

  if (path === 'addresses' && method === 'POST') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    if (body.is_default) {
      db.addresses.filter((a) => a.user_id === auth.id).forEach((a) => { a.is_default = false; });
    }
    const address: MockAddress = {
      id: ++db.seq.address,
      user_id: auth.id,
      label: asString(body.label) || null,
      recipient_name: asString(body.recipient_name) || asString(body.name),
      name: asString(body.name),
      phone: asString(body.phone),
      province: asString(body.province),
      city: asString(body.city),
      district: asString(body.district),
      postal_code: asString(body.postal_code),
      address: asString(body.address),
      biteship_area_id: asString(body.biteship_area_id) || null,
      is_default: Boolean(body.is_default),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.addresses.push(address);
    return json({ data: address }, 201);
  }

  if (segments[0] === 'addresses' && segments.length === 2 && (method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const address = db.addresses.find((a) => a.id === asNumber(segments[1]) && a.user_id === auth.id);
    if (!address) return apiError('Alamat tidak ditemukan.', 404);
    if (method === 'DELETE') {
      db.addresses = db.addresses.filter((a) => a.id !== address.id);
      return json({ message: 'Alamat dihapus.' });
    }
    const body = await readBody(req);
    if (body.is_default) {
      db.addresses.filter((a) => a.user_id === auth.id).forEach((a) => { a.is_default = false; });
    }
    const fields: Array<keyof MockAddress> = ['label', 'recipient_name', 'name', 'phone', 'province', 'city', 'district', 'postal_code', 'address', 'biteship_area_id'];
    fields.forEach((field) => {
      if (body[field as string] !== undefined) {
        (address as unknown as Record<string, unknown>)[field as string] =
          field === 'is_default' ? Boolean(body[field as string]) : body[field as string];
      }
    });
    if (body.is_default !== undefined) address.is_default = Boolean(body.is_default);
    address.updated_at = nowIso();
    return json({ data: address });
  }

  /* ---------- Public booking ---------- */
  if (path === 'booking/services' && method === 'GET') {
    return json({ data: db.services.filter((s) => s.is_active) });
  }

  if (path === 'booking/doctors' && method === 'GET') {
    return json({ data: db.doctors.filter((d) => d.status === 'active') });
  }

  if (path === 'booking/available-slots' && method === 'GET') {
    const doctorId = asNumber(sp.get('doctor_id'));
    const date = sp.get('date') ?? ymdDash(new Date());
    const serviceId = sp.get('service_id') ? asNumber(sp.get('service_id')) : null;
    return availableSlots(doctorId, date, serviceId);
  }

  if (path === 'booking' && method === 'POST') {
    const auth = authUser(req);
    const body = await readBody(req);
    return createBooking(body, auth);
  }

  if (path === 'booking/lookup' && method === 'GET') {
    const code = sp.get('booking_code') ?? '';
    const appointment = db.appointments.find((a) => a.booking_code.toLowerCase() === code.toLowerCase());
    if (!appointment) return apiError('Booking tidak ditemukan.', 404);
    return json({ data: appointmentOut(appointment) });
  }

  /* ---------- Customer appointments ---------- */
  if (path === 'my-appointments' && method === 'GET') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const patient = db.patients.find((p) => p.user_id === auth.id);
    const mine = patient
      ? db.appointments
          .filter((a) => a.patient_id === patient.id)
          .sort((a, b) => b.start_time.localeCompare(a.start_time))
          .map(appointmentOut)
      : [];
    return json({ data: { data: mine, total: mine.length } });
  }

  if (segments[0] === 'my-appointments' && segments[2] === 'cancel' && method === 'PATCH') {
    const auth = requireAuth(req);
    if (auth instanceof Response) return auth;
    const patient = db.patients.find((p) => p.user_id === auth.id);
    const appointment = db.appointments.find(
      (a) => a.id === asNumber(segments[1]) && patient !== undefined && a.patient_id === patient.id
    );
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    const body = await readBody(req);
    pushAppointmentHistory(appointment.id, appointment.status, 'cancelled', asString(body.reason) || null);
    appointment.status = 'cancelled';
    appointment.cancellation_reason = asString(body.reason) || 'Dibatalkan oleh pasien.';
    appointment.updated_at = nowIso();
    return json({ data: appointmentOut(appointment) });
  }

  /* ---------- Admin: dashboard & analytics ---------- */
  if (path === 'admin/dashboard/overview' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    return json({ data: buildDashboardOverview() });
  }

  if (segments[0] === 'admin' && segments[1] === 'analytics' && segments.length === 3 && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const period = sp.get('period') ?? '30d';
    switch (segments[2]) {
      case 'sales': return json({ data: buildSalesAnalytics(period) });
      case 'orders':
        return json({
          data: {
            period,
            total_orders: db.orders.length,
            status_distribution: statusDistribution(),
            recent_orders: recentOrdersAdmin(10),
          },
        });
      case 'products':
        return json({
          data: {
            period,
            low_stock_threshold: 5,
            best_selling: [...db.products].sort((a, b) => b.units_sold - a.units_sold).slice(0, 5)
              .map((p) => ({ product_id: p.id, name: p.name, units_sold: p.units_sold, revenue: p.units_sold * p.price, formatted_revenue: rupiah(p.units_sold * p.price) })),
            top_revenue: [...db.products].sort((a, b) => b.units_sold * b.price - a.units_sold * a.price).slice(0, 5)
              .map((p) => ({ product_id: p.id, name: p.name, units_sold: p.units_sold, revenue: p.units_sold * p.price, formatted_revenue: rupiah(p.units_sold * p.price) })),
            inventory_alerts: inventoryAlerts(),
          },
        });
      case 'customers': return json({ data: buildCustomerAnalytics(period) });
      case 'payments': return json({ data: buildPaymentAnalytics(period) });
      case 'shipping': return json({ data: buildShippingAnalytics(period) });
      default: return apiError('Analytics endpoint tidak ditemukan.', 404);
    }
  }

  /* ---------- Admin: orders ---------- */
  if (path === 'admin/orders' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const page = asNumber(sp.get('page'), 1);
    const perPage = asNumber(sp.get('per_page'), 10);
    const search = (sp.get('search') ?? '').toLowerCase();
    const orderStatus = sp.get('order_status') ?? '';
    const paymentStatus = sp.get('payment_status') ?? '';
    const courier = sp.get('courier') ?? '';

    let items = [...db.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (search) {
      items = items.filter((o) => {
        const user = db.users.find((u) => u.id === o.user_id);
        return o.order_number.toLowerCase().includes(search) || (user?.name.toLowerCase().includes(search) ?? false);
      });
    }
    if (orderStatus) items = items.filter((o) => o.status === orderStatus);
    if (paymentStatus) items = items.filter((o) => (paymentOfOrder(o.id)?.status ?? 'pending') === paymentStatus);
    if (courier) items = items.filter((o) => o.shipping_courier.toLowerCase() === courier.toLowerCase());

    const { slice, flat } = paginate(items, page, perPage);
    return json({ data: slice.map(adminOrderItemOut), ...flat });
  }

  if (segments[0] === 'admin' && segments[1] === 'orders' && segments.length === 3 && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const order = db.orders.find((o) => o.id === asNumber(segments[2]));
    if (!order) return apiError('Pesanan tidak ditemukan.', 404);
    return json({ data: adminOrderDetailOut(order) });
  }

  if (segments[0] === 'admin' && segments[1] === 'orders' && segments.length === 4 && method === 'POST') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const order = db.orders.find((o) => o.id === asNumber(segments[2]));
    if (!order) return apiError('Pesanan tidak ditemukan.', 404);
    const action = segments[3];
    const body = await readBody(req);
    const previous = order.status;

    const restoreStock = () => {
      itemsOfOrder(order.id).forEach((item) => {
        const product = db.products.find((p) => p.id === item.product_id);
        if (product) product.stock += item.quantity;
      });
    };

    switch (action) {
      case 'process': {
        if (order.status !== 'PAID') return apiError('Pesanan harus berstatus PAID untuk diproses.', 422);
        order.status = 'PROCESSING';
        break;
      }
      case 'ship': {
        if (order.status !== 'PROCESSING') return apiError('Pesanan harus berstatus PROCESSING untuk dikirim.', 422);
        order.status = 'SHIPPED';
        const tracking = asString(body.tracking_number) || `MOCK${Date.now()}`;
        const shipment = shipmentOfOrder(order.id);
        if (shipment) {
          shipment.tracking_number = tracking;
          shipment.status = 'shipped';
          shipment.shipped_at = nowIso();
        } else {
          db.shipments.push({
            id: ++db.seq.shipment,
            order_id: order.id,
            courier: asString(body.courier) || order.shipping_courier,
            service: asString(body.service) || order.shipping_service,
            tracking_number: tracking,
            status: 'shipped',
            shipped_at: nowIso(),
            delivered_at: null,
            biteship_order_id: `BSHP-ORD-${order.id}`,
            biteship_tracking_id: tracking,
            biteship_waybill_id: tracking,
          });
        }
        break;
      }
      case 'deliver': {
        if (order.status !== 'SHIPPED') return apiError('Pesanan harus berstatus SHIPPED.', 422);
        order.status = 'DELIVERED';
        const shipment = shipmentOfOrder(order.id);
        if (shipment) {
          shipment.status = 'delivered';
          shipment.delivered_at = nowIso();
        }
        break;
      }
      case 'complete': {
        if (order.status !== 'DELIVERED') return apiError('Pesanan harus berstatus DELIVERED.', 422);
        order.status = 'COMPLETED';
        break;
      }
      case 'cancel': {
        if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(order.status)) {
          return apiError('Pesanan pada status ini tidak dapat dibatalkan.', 422);
        }
        order.status = 'CANCELLED';
        order.cancellation_reason = asString(body.reason) || 'Dibatalkan oleh admin.';
        order.cancelled_at = nowIso();
        restoreStock();
        break;
      }
      case 'refund': {
        if (!REVENUE_STATUSES.includes(order.status)) {
          return apiError('Refund hanya untuk pesanan yang sudah dibayar.', 422);
        }
        order.status = 'CANCELLED';
        order.cancellation_reason = asString(body.reason) || 'Refund diproses oleh admin.';
        order.cancelled_at = nowIso();
        const payment = paymentOfOrder(order.id);
        if (payment) payment.status = 'refunded';
        restoreStock();
        break;
      }
      default:
        return apiError('Aksi tidak dikenal.', 404);
    }

    order.updated_at = nowIso();
    pushAudit(order.id, `order_${action}`, previous, order.status, asString(body.reason) || null);
    return json({ data: adminOrderDetailOut(order) });
  }

  /* ---------- Admin: products ---------- */
  if (path === 'admin/products' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const page = asNumber(sp.get('page'), 1);
    const perPage = asNumber(sp.get('per_page'), 10);
    const search = (sp.get('search') ?? '').toLowerCase();
    const categoryId = sp.get('category_id');
    const isActive = sp.get('is_active');
    const stockStatus = sp.get('stock_status') ?? '';

    let items = [...db.products].sort((a, b) => b.id - a.id);
    if (search) items = items.filter((p) => p.name.toLowerCase().includes(search));
    if (categoryId) items = items.filter((p) => p.category_id === asNumber(categoryId));
    if (isActive !== null && isActive !== '') items = items.filter((p) => String(p.is_active) === isActive);
    if (stockStatus === 'low') items = items.filter((p) => p.stock > 0 && p.stock <= 5);
    if (stockStatus === 'out') items = items.filter((p) => p.stock === 0);

    const { slice, flat } = paginate(items, page, perPage);
    return json({ data: slice.map(productOut), ...flat });
  }

  if (path === 'admin/products' && method === 'POST') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    const name = asString(body.name);
    if (!name) return apiError('Nama produk wajib diisi.', 422);
    const product: MockProduct = {
      id: ++db.seq.product,
      category_id: asNumber(body.category_id, 1),
      name,
      slug: asString(body.slug) || slugify(name),
      description: asString(body.description) || null,
      price: asNumber(body.price),
      weight: asNumber(body.weight, 100),
      stock: asNumber(body.stock),
      image: asString(body.image) || null,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      units_sold: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.products.push(product);
    return json({ data: productOut(product) }, 201);
  }

  if (segments[0] === 'admin' && segments[1] === 'products' && segments.length === 3 && method === 'PUT') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const product = db.products.find((p) => p.id === asNumber(segments[2]));
    if (!product) return apiError('Produk tidak ditemukan.', 404);
    const body = await readBody(req);
    if (body.category_id !== undefined) product.category_id = asNumber(body.category_id, product.category_id);
    if (body.name !== undefined) product.name = asString(body.name);
    if (body.slug !== undefined) product.slug = asString(body.slug) || product.slug;
    if (body.description !== undefined) product.description = asString(body.description) || null;
    if (body.price !== undefined) product.price = asNumber(body.price, product.price);
    if (body.weight !== undefined) product.weight = asNumber(body.weight, product.weight);
    if (body.stock !== undefined) product.stock = asNumber(body.stock, product.stock);
    if (body.image !== undefined) product.image = asString(body.image) || null;
    if (body.is_active !== undefined) product.is_active = Boolean(body.is_active);
    product.updated_at = nowIso();
    return json({ data: productOut(product) });
  }

  if (segments[0] === 'admin' && segments[1] === 'products' && segments[3] === 'toggle' && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const product = db.products.find((p) => p.id === asNumber(segments[2]));
    if (!product) return apiError('Produk tidak ditemukan.', 404);
    product.is_active = !product.is_active;
    product.updated_at = nowIso();
    return json({ data: productOut(product) });
  }

  if (segments[0] === 'admin' && segments[1] === 'products' && segments[3] === 'stock' && method === 'POST') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const product = db.products.find((p) => p.id === asNumber(segments[2]));
    if (!product) return apiError('Produk tidak ditemukan.', 404);
    const body = await readBody(req);
    const amount = asNumber(body.amount);
    const type = asString(body.type, 'set');
    if (type === 'set') product.stock = Math.max(0, amount);
    else if (type === 'increment') product.stock += amount;
    else if (type === 'decrement') product.stock = Math.max(0, product.stock - amount);
    product.updated_at = nowIso();
    return json({ data: productOut(product) });
  }

  /* ---------- Admin: categories ---------- */
  if (path === 'admin/categories' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    return json({ data: db.categories.map(categoryOut) });
  }

  if (path === 'admin/categories' && method === 'POST') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    const name = asString(body.name);
    if (!name) return apiError('Nama kategori wajib diisi.', 422);
    const category = {
      id: ++db.seq.category,
      name,
      slug: asString(body.slug) || slugify(name),
      description: asString(body.description) || null,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.categories.push(category);
    return json({ data: categoryOut(category) }, 201);
  }

  if (segments[0] === 'admin' && segments[1] === 'categories' && segments.length === 3 && method === 'PUT') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const category = db.categories.find((c) => c.id === asNumber(segments[2]));
    if (!category) return apiError('Kategori tidak ditemukan.', 404);
    const body = await readBody(req);
    if (body.name !== undefined) category.name = asString(body.name);
    if (body.slug !== undefined) category.slug = asString(body.slug) || category.slug;
    if (body.description !== undefined) category.description = asString(body.description) || null;
    if (body.is_active !== undefined) category.is_active = Boolean(body.is_active);
    category.updated_at = nowIso();
    return json({ data: categoryOut(category) });
  }

  if (segments[0] === 'admin' && segments[1] === 'categories' && segments[3] === 'toggle' && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const category = db.categories.find((c) => c.id === asNumber(segments[2]));
    if (!category) return apiError('Kategori tidak ditemukan.', 404);
    category.is_active = !category.is_active;
    category.updated_at = nowIso();
    return json({ data: categoryOut(category) });
  }

  if (segments[0] === 'admin' && segments[1] === 'categories' && segments.length === 3 && method === 'DELETE') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const id = asNumber(segments[2]);
    const category = db.categories.find((c) => c.id === id);
    if (!category) return apiError('Kategori tidak ditemukan.', 404);
    if (db.products.some((p) => p.category_id === id)) {
      return apiError('Kategori masih memiliki produk dan tidak dapat dihapus.', 422);
    }
    db.categories = db.categories.filter((c) => c.id !== id);
    return json({ message: 'Kategori dihapus.' });
  }

  /* ---------- Admin: customers ---------- */
  if (path === 'admin/customers' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const page = asNumber(sp.get('page'), 1);
    const perPage = asNumber(sp.get('per_page'), 10);
    const search = (sp.get('search') ?? '').toLowerCase();
    const isActive = sp.get('is_active');

    let items = db.users.filter((u) => u.role === 'customer');
    if (search) items = items.filter((u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    if (isActive !== null && isActive !== '') items = items.filter((u) => String(u.is_active) === isActive);

    const rows = items.map((u) => {
      const orders = db.orders.filter((o) => o.user_id === u.id);
      const paid = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
      const last = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        is_active: u.is_active,
        total_orders: orders.length,
        paid_orders_count: paid.length,
        total_spending: paid.reduce((s, o) => s + o.total, 0),
        last_order_at: last?.created_at ?? null,
        created_at: u.created_at,
      };
    });

    const { slice, flat } = paginate(rows, page, perPage);
    return json({ data: slice, ...flat });
  }

  if (segments[0] === 'admin' && segments[1] === 'customers' && segments.length === 3 && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const user = db.users.find((u) => u.id === asNumber(segments[2]));
    if (!user) return apiError('Pelanggan tidak ditemukan.', 404);
    const orders = db.orders.filter((o) => o.user_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const paid = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
    const cancelled = orders.filter((o) => ['CANCELLED', 'EXPIRED'].includes(o.status));
    const totalSpending = paid.reduce((s, o) => s + o.total, 0);
    return json({
      data: {
        customer: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
        },
        statistics: {
          total_orders: orders.length,
          completed_orders: orders.filter((o) => o.status === 'COMPLETED').length,
          cancelled_orders: cancelled.length,
          paid_orders_count: paid.length,
          total_spending: totalSpending,
          formatted_total_spending: rupiah(totalSpending),
          average_order_value: paid.length > 0 ? Math.round(totalSpending / paid.length) : 0,
          formatted_aov: rupiah(paid.length > 0 ? Math.round(totalSpending / paid.length) : 0),
          last_order_at: orders[0]?.created_at ?? null,
        },
        addresses: db.addresses.filter((a) => a.user_id === user.id),
        orders: orders.map((o) => ({
          id: o.id,
          created_at: o.created_at,
          status: o.status,
          total: o.total,
          shipping_courier: o.shipping_courier,
          payment_status: paymentOfOrder(o.id)?.status ?? 'pending',
          payment_provider: paymentOfOrder(o.id)?.provider ?? 'midtrans',
          tracking_number: shipmentOfOrder(o.id)?.tracking_number ?? null,
        })),
        audit_logs: [
          {
            id: 1,
            action: 'customer_created',
            reason: null,
            note: 'Akun pelanggan terdaftar (data demo).',
            admin: null,
            created_at: user.created_at,
          },
        ],
      },
    });
  }

  if (segments[0] === 'admin' && segments[1] === 'customers' && segments[3] === 'toggle' && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const user = db.users.find((u) => u.id === asNumber(segments[2]));
    if (!user) return apiError('Pelanggan tidak ditemukan.', 404);
    user.is_active = !user.is_active;
    return json({
      data: {
        customer: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
        },
        statistics: {
          total_orders: 0,
          completed_orders: 0,
          cancelled_orders: 0,
          paid_orders_count: 0,
          total_spending: 0,
          formatted_total_spending: rupiah(0),
          average_order_value: 0,
          formatted_aov: rupiah(0),
          last_order_at: null,
        },
        addresses: db.addresses.filter((a) => a.user_id === user.id),
        orders: [],
        audit_logs: [
          {
            id: Date.now(),
            action: user.is_active ? 'customer_reactivated' : 'customer_deactivated',
            reason: null,
            note: null,
            admin: { id: auth.id, name: auth.name, email: auth.email },
            created_at: nowIso(),
          },
        ],
      },
    });
  }

  /* ---------- Admin: operations ---------- */
  if (path === 'admin/operations/alerts' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const paidUnprocessed = db.orders.filter((o) => o.status === 'PAID').length;
    const stalePending = db.orders.filter((o) => {
      if (o.status !== 'PENDING_PAYMENT') return false;
      return Date.now() - new Date(o.created_at).getTime() > 24 * 60 * 60 * 1000;
    }).length;
    return json({
      data: {
        unprocessed_paid_orders: paidUnprocessed,
        stale_pending_orders: stalePending,
        low_stock_products: db.products.filter((p) => p.stock > 0 && p.stock <= 5).length,
        out_of_stock_products: db.products.filter((p) => p.stock === 0).length,
        recent_refunds_count: db.payments.filter((p) => p.status === 'refunded').length,
      },
    });
  }

  if (path === 'admin/operations/expire-pending' && method === 'POST') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    const hours = asNumber(body.hours, 24);
    let expired = 0;
    db.orders.forEach((o) => {
      if (o.status !== 'PENDING_PAYMENT') return;
      if (Date.now() - new Date(o.created_at).getTime() > hours * 60 * 60 * 1000) {
        o.status = 'EXPIRED';
        o.updated_at = nowIso();
        pushAudit(o.id, 'expired', 'PENDING_PAYMENT', 'EXPIRED');
        expired += 1;
      }
    });
    return json({ message: `${expired} pesanan pending kedaluwarsa.`, expired_count: expired });
  }

  if (path === 'admin/operations/sync-shipments' && method === 'POST') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const synced = db.shipments.filter((s) => s.status === 'shipped').length;
    return json({ message: `${synced} pengiriman disinkronkan dengan kurir.`, synced_count: synced });
  }

  /* ---------- Admin: clinic (appointments, patients, doctors) ---------- */
  if (path === 'admin/appointments' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const { items, page } = adminAppointmentsFiltered(sp);
    const { slice } = paginate(items, page, 10);
    return json({
      data: { data: slice.map(appointmentOut), total: items.length, current_page: page, last_page: Math.max(1, Math.ceil(items.length / 10)) },
    });
  }

  if (segments[0] === 'admin' && segments[1] === 'appointments' && segments.length === 3 && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const appointment = db.appointments.find((a) => a.id === asNumber(segments[2]));
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    return json({ data: appointmentOut(appointment) });
  }

  if (segments[0] === 'admin' && segments[1] === 'appointments' && segments[3] === 'status' && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const appointment = db.appointments.find((a) => a.id === asNumber(segments[2]));
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    const body = await readBody(req);
    const nextStatus = asString(body.status, appointment.status);
    pushAppointmentHistory(appointment.id, appointment.status, nextStatus, asString(body.notes) || null);
    appointment.status = nextStatus;
    if (body.cancellation_reason !== undefined) appointment.cancellation_reason = asString(body.cancellation_reason) || null;
    appointment.updated_at = nowIso();
    return json({ data: appointmentOut(appointment) });
  }

  if (segments[0] === 'admin' && segments[1] === 'appointments' && segments.length === 3 && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const appointment = db.appointments.find((a) => a.id === asNumber(segments[2]));
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    const body = await readBody(req);
    const fields: Array<keyof MockAppointment> = ['appointment_date', 'appointment_time', 'start_time', 'end_time', 'consultation_mode', 'complaint', 'patient_notes', 'doctor_notes', 'status', 'meeting_link'];
    fields.forEach((field) => {
      if (body[field as string] !== undefined) {
        (appointment as unknown as Record<string, unknown>)[field as string] = body[field as string];
      }
    });
    appointment.updated_at = nowIso();
    return json({ data: appointmentOut(appointment) });
  }

  if (segments[0] === 'admin' && segments[1] === 'appointments' && segments.length === 3 && method === 'DELETE') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const id = asNumber(segments[2]);
    const appointment = db.appointments.find((a) => a.id === id);
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    db.appointments = db.appointments.filter((a) => a.id !== id);
    db.statusHistories = db.statusHistories.filter((h) => h.appointment_id !== id);
    return json({ message: 'Appointment dihapus.' });
  }

  if (path === 'admin/patients' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const { items, page } = adminPatientsFiltered(sp);
    const { slice } = paginate(items, page, 10);
    return json({
      data: { data: slice.map(patientOut), total: items.length, current_page: page, last_page: Math.max(1, Math.ceil(items.length / 10)) },
    });
  }

  if (segments[0] === 'admin' && segments[1] === 'patients' && segments.length === 3 && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const patient = db.patients.find((p) => p.id === asNumber(segments[2]));
    if (!patient) return apiError('Pasien tidak ditemukan.', 404);
    return json({ data: { ...patientOut(patient), appointments: db.appointments.filter((a) => a.patient_id === patient.id).map(appointmentOut) } });
  }

  if (segments[0] === 'admin' && segments[1] === 'patients' && segments.length === 3 && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const patient = db.patients.find((p) => p.id === asNumber(segments[2]));
    if (!patient) return apiError('Pasien tidak ditemukan.', 404);
    const body = await readBody(req);
    const fields: Array<keyof MockPatient> = ['name', 'phone', 'email', 'date_of_birth', 'gender', 'address', 'skin_type', 'notes', 'allergies', 'medical_history', 'emergency_contact', 'status'];
    fields.forEach((field) => {
      if (body[field as string] !== undefined) {
        (patient as unknown as Record<string, unknown>)[field as string] = body[field as string];
      }
    });
    patient.updated_at = nowIso();
    return json({ data: patientOut(patient) });
  }

  if (path === 'admin/doctors' && method === 'GET') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    return json({ data: db.doctors });
  }

  if (path === 'admin/doctors' && method === 'POST') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const body = await readBody(req);
    const name = asString(body.name);
    if (!name) return apiError('Nama dokter wajib diisi.', 422);
    const doctor = {
      id: ++db.seq.doctor,
      name,
      title: asString(body.title, 'Dokter Kulit'),
      specialization: asString(body.specialization, 'General Dermatology'),
      license_number: asString(body.license_number) || undefined,
      phone: asString(body.phone) || undefined,
      experience: asString(body.experience, '1+ Tahun Pengalaman'),
      rating: asNumber(body.rating, 4.5),
      review_count: asNumber(body.review_count, 0),
      avatar_color: asString(body.avatar_color, 'from-rose-400 to-pink-500'),
      bio: asString(body.bio, 'Dokter spesialis kulit NOBYDERM.'),
      skills: Array.isArray(body.skills) ? body.skills.map((s) => asString(s)) : [],
      schedule_days: asString(body.schedule_days, 'Senin - Jumat'),
      available_days: Array.isArray(body.available_days) ? body.available_days.map((d) => asNumber(d, 1)) : [1, 2, 3, 4, 5],
      work_start_time: asString(body.work_start_time, '10:00'),
      work_end_time: asString(body.work_end_time, '18:00'),
      status: 'active' as const,
    };
    db.doctors.push(doctor);
    return json({ data: doctor }, 201);
  }

  if (segments[0] === 'admin' && segments[1] === 'doctors' && segments.length === 3 && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const doctor = db.doctors.find((d) => d.id === asNumber(segments[2]));
    if (!doctor) return apiError('Dokter tidak ditemukan.', 404);
    const body = await readBody(req);
    const fields: Array<keyof typeof doctor> = ['name', 'title', 'specialization', 'license_number', 'phone', 'experience', 'rating', 'review_count', 'avatar_color', 'bio', 'skills', 'schedule_days', 'available_days', 'work_start_time', 'work_end_time', 'status'];
    fields.forEach((field) => {
      if (body[field as string] !== undefined) {
        (doctor as unknown as Record<string, unknown>)[field as string] = body[field as string];
      }
    });
    return json({ data: doctor });
  }

  if (segments[0] === 'admin' && segments[1] === 'doctors' && segments[3] === 'toggle' && method === 'PATCH') {
    const auth = requireAdmin(req);
    if (auth instanceof Response) return auth;
    const doctor = db.doctors.find((d) => d.id === asNumber(segments[2]));
    if (!doctor) return apiError('Dokter tidak ditemukan.', 404);
    doctor.status = doctor.status === 'active' ? 'inactive' : 'active';
    return json({ data: doctor });
  }

  /* ---------- Doctor portal ---------- */
  if (path === 'doctor/dashboard/overview' && method === 'GET') {
    const auth = requireStaff(req);
    if (auth instanceof Response) return auth;
    return json({ data: buildDoctorOverview(auth) });
  }

  if (path === 'doctor/appointments' && method === 'GET') {
    const auth = requireStaff(req);
    if (auth instanceof Response) return auth;
    const doctor = doctorForUser(auth);
    const date = sp.get('date') ?? '';
    const status = sp.get('status') ?? '';
    const search = (sp.get('search') ?? '').toLowerCase();
    const page = asNumber(sp.get('page'), 1);

    let items = db.appointments.filter((a) => a.doctor_id === doctor.id).sort((a, b) => b.start_time.localeCompare(a.start_time));
    if (date) items = items.filter((a) => a.appointment_date === date);
    if (status) items = items.filter((a) => a.status === status);
    if (search) {
      items = items.filter((a) => {
        const patient = db.patients.find((p) => p.id === a.patient_id);
        return a.booking_code.toLowerCase().includes(search) || (patient?.name.toLowerCase().includes(search) ?? false);
      });
    }
    const { slice } = paginate(items, page, 10);
    return json({
      data: { data: slice.map(appointmentOut), total: items.length, current_page: page, last_page: Math.max(1, Math.ceil(items.length / 10)) },
    });
  }

  if (segments[0] === 'doctor' && segments[1] === 'appointments' && segments.length === 3 && method === 'GET') {
    const auth = requireStaff(req);
    if (auth instanceof Response) return auth;
    const appointment = db.appointments.find((a) => a.id === asNumber(segments[2]));
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    const patient = db.patients.find((p) => p.id === appointment.patient_id);
    const history = patient
      ? db.appointments
          .filter((a) => a.patient_id === patient.id && a.id !== appointment.id && a.status === 'completed')
          .sort((a, b) => b.start_time.localeCompare(a.start_time))
          .map(appointmentOut)
      : [];
    return json({ data: { appointment: appointmentOut(appointment), patient_history: history } });
  }

  if (segments[0] === 'doctor' && segments[1] === 'appointments' && segments[3] === 'status' && method === 'PATCH') {
    const auth = requireStaff(req);
    if (auth instanceof Response) return auth;
    const appointment = db.appointments.find((a) => a.id === asNumber(segments[2]));
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    const body = await readBody(req);
    const nextStatus = asString(body.status, appointment.status);
    pushAppointmentHistory(appointment.id, appointment.status, nextStatus, asString(body.notes) || null);
    appointment.status = nextStatus;
    appointment.updated_at = nowIso();
    return json({ data: appointmentOut(appointment) });
  }

  if (segments[0] === 'doctor' && segments[1] === 'appointments' && segments[3] === 'notes' && method === 'POST') {
    const auth = requireStaff(req);
    if (auth instanceof Response) return auth;
    const appointment = db.appointments.find((a) => a.id === asNumber(segments[2]));
    if (!appointment) return apiError('Appointment tidak ditemukan.', 404);
    const body = await readBody(req);
    if (body.diagnosis !== undefined) appointment.diagnosis = asString(body.diagnosis) || null;
    if (body.doctor_notes !== undefined) appointment.doctor_notes = asString(body.doctor_notes) || null;
    if (body.treatment_plan !== undefined) appointment.treatment_plan = asString(body.treatment_plan) || null;
    if (body.prescription !== undefined) appointment.prescription = asString(body.prescription) || null;
    if (body.mark_completed) {
      pushAppointmentHistory(appointment.id, appointment.status, 'completed');
      appointment.status = 'completed';
    }
    appointment.updated_at = nowIso();
    return json({ data: appointmentOut(appointment) });
  }

  if (path === 'doctor/patients' && method === 'GET') {
    const auth = requireStaff(req);
    if (auth instanceof Response) return auth;
    const doctor = doctorForUser(auth);
    const search = (sp.get('search') ?? '').toLowerCase();
    const page = asNumber(sp.get('page'), 1);
    const patientIds = new Set(db.appointments.filter((a) => a.doctor_id === doctor.id).map((a) => a.patient_id));
    let items = db.patients.filter((p) => patientIds.has(p.id));
    if (search) items = items.filter((p) => p.name.toLowerCase().includes(search) || p.phone.includes(search));
    const { slice } = paginate(items, page, 10);
    return json({
      data: { data: slice.map(patientOut), total: items.length, current_page: page, last_page: Math.max(1, Math.ceil(items.length / 10)) },
    });
  }

  if (segments[0] === 'doctor' && segments[1] === 'patients' && segments[3] === 'medical-record' && method === 'PATCH') {
    const auth = requireStaff(req);
    if (auth instanceof Response) return auth;
    const patient = db.patients.find((p) => p.id === asNumber(segments[2]));
    if (!patient) return apiError('Pasien tidak ditemukan.', 404);
    const body = await readBody(req);
    const fields: Array<keyof MockPatient> = ['allergies', 'medical_history', 'skin_type', 'notes'];
    fields.forEach((field) => {
      if (body[field as string] !== undefined) {
        (patient as unknown as Record<string, unknown>)[field as string] = asString(body[field as string]) || null;
      }
    });
    patient.updated_at = nowIso();
    return json({ data: patientOut(patient) });
  }

  /* ---------- Fallback ---------- */
  return apiError(`Mock API endpoint tidak ditemukan: ${method} /${path}`, 404);
}
