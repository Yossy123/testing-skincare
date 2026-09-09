/**
 * In-memory mock database for the demo frontend.
 * All state lives for the lifetime of the server instance (resets on cold start),
 * which is intentional: this clone runs WITHOUT any real backend or database.
 */

/* =========================================================================
   Internal types (loose, mock-only)
   ========================================================================= */

export interface MockUser {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'doctor';
  phone: string | null;
  email_verified_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MockCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockProduct {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  weight: number;
  stock: number;
  image: string | null;
  is_active: boolean;
  units_sold: number;
  created_at: string;
  updated_at: string;
}

export interface MockAddress {
  id: number;
  user_id: number;
  label: string | null;
  recipient_name: string | null;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  postal_code: string;
  address: string;
  biteship_area_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockOrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface MockPayment {
  id: number;
  order_id: number;
  provider: string;
  transaction_id: string | null;
  payment_type: string | null;
  status: string;
  amount: number;
  snap_token: string | null;
  redirect_url: string | null;
  paid_at: string | null;
  expires_at: string | null;
}

export interface MockShipment {
  id: number;
  order_id: number;
  courier: string;
  service: string;
  tracking_number: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  biteship_order_id: string | null;
  biteship_tracking_id: string | null;
  biteship_waybill_id: string | null;
}

export interface MockOrder {
  id: number;
  order_number: string;
  user_id: number;
  status: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  shipping_courier: string;
  shipping_service: string;
  shipping_etd: string;
  shipping_address: {
    recipient_name: string;
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    postal_code: string;
    address: string;
  };
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockAuditLog {
  id: number;
  order_id: number;
  admin_id: number | null;
  action: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  note: string | null;
  created_at: string;
}

export interface MockDoctor {
  id: number;
  user_id?: number;
  name: string;
  title: string;
  specialization: string;
  license_number?: string;
  phone?: string;
  experience: string;
  rating: number;
  review_count: number;
  avatar_color: string;
  bio: string;
  skills: string[];
  schedule_days: string;
  available_days: number[];
  work_start_time: string;
  work_end_time: string;
  status: 'active' | 'inactive';
}

export interface MockService {
  id: number;
  code: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
  is_active: boolean;
}

export interface MockPatient {
  id: number;
  user_id: number | null;
  name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  address: string | null;
  skin_type: string | null;
  notes: string | null;
  allergies: string | null;
  medical_history: string | null;
  emergency_contact: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface MockAppointment {
  id: number;
  booking_code: string;
  patient_id: number;
  doctor_id: number;
  service_id: number;
  appointment_date: string;
  appointment_time: string;
  start_time: string;
  end_time: string;
  consultation_mode: 'offline' | 'online';
  meeting_link: string | null;
  complaint: string | null;
  patient_notes: string | null;
  doctor_notes: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  status: string;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockStatusHistory {
  id: number;
  appointment_id: number;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
}

export interface MockDb {
  users: MockUser[];
  categories: MockCategory[];
  products: MockProduct[];
  addresses: MockAddress[];
  orders: MockOrder[];
  orderItems: MockOrderItem[];
  payments: MockPayment[];
  shipments: MockShipment[];
  auditLogs: MockAuditLog[];
  doctors: MockDoctor[];
  services: MockService[];
  patients: MockPatient[];
  appointments: MockAppointment[];
  statusHistories: MockStatusHistory[];
  seq: {
    user: number;
    category: number;
    product: number;
    address: number;
    order: number;
    orderItem: number;
    payment: number;
    shipment: number;
    auditLog: number;
    doctor: number;
    service: number;
    patient: number;
    appointment: number;
    statusHistory: number;
  };
}

/* =========================================================================
   Helpers
   ========================================================================= */

export function rupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function iso(d: Date): string {
  return d.toISOString();
}

export function daysAgo(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function daysAhead(days: number, hour = 10, minute = 0): Date {
  return daysAgo(-days, hour, minute);
}

export function formatDateId(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* =========================================================================
   Seed data
   ========================================================================= */

const U = (img: string) => `https://images.unsplash.com/${img}?auto=format&fit=crop&w=800&q=80`;

function seedCategories(): MockCategory[] {
  const now = iso(daysAgo(120));
  const cats: Array<[string, string, string]> = [
    ['Cleanser', 'cleanser', 'Pembersih wajah lembut untuk semua jenis kulit.'],
    ['Toner', 'toner', 'Penyeimbang pH dan menyiapkan kulit untuk perawatan lanjutan.'],
    ['Serum', 'serum', 'Formula aktif terkonsentrasi untuk target spesifik.'],
    ['Moisturizer', 'moisturizer', 'Hidrasi mendalam dan perkuat skin barrier.'],
    ['Sunscreen', 'sunscreen', 'Pelindung harian dari paparan sinar UV.'],
    ['Mask', 'mask', 'Perawatan intensif mingguan untuk kulit lebih sehat.'],
  ];
  return cats.map(([name, slug, description], i) => ({
    id: i + 1,
    name,
    slug,
    description,
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
}

function seedProducts(): MockProduct[] {
  const items: Array<Partial<MockProduct> & { name: string; slug: string; category_id: number; price: number; weight: number; stock: number; image: string; units_sold: number }> = [
    { name: 'Glow Ritual Gentle Gel Cleanser', slug: 'glow-ritual-gentle-gel-cleanser', category_id: 1, price: 129000, weight: 110, stock: 42, image: U('photo-1556228720-195a672e8a03'), units_sold: 284, description: 'Gel cleanser lembut dengan green tea extract dan panthenol yang mengangkat kotoran tanpa membuat kulit tertarik. Cocok untuk kulit normal hingga berminyak.' },
    { name: 'Hydra Calm Milky Cleanser', slug: 'hydra-calm-milky-cleanser', category_id: 1, price: 139000, weight: 120, stock: 8, image: U('photo-1556228578-8c89e6adf883'), units_sold: 176, description: 'Tekstur susu yang melembapkan, diformulasikan untuk kulit kering dan sensitif dengan oat milk dan ceramide.' },
    { name: 'Botanic Rose Toning Mist', slug: 'botanic-rose-toning-mist', category_id: 2, price: 119000, weight: 100, stock: 25, image: U('photo-1598440947619-2c35fc9aa908'), units_sold: 209, description: 'Hydrating mist dengan rose water dan niacinamide untuk menyegarkan dan menenangkan kulit sepanjang hari.' },
    { name: 'AHA-BHA Clarifying Toner', slug: 'aha-bha-clarifying-toner', category_id: 2, price: 149000, weight: 100, stock: 3, image: U('photo-1616394584738-fc6e612e71b9'), units_sold: 198, description: 'Eksfoliasi lembut dengan 4% AHA dan 1% BHA untuk mencegah komedo dan mencerahkan warna kulit.' },
    { name: 'Lumi Glow Vitamin C Serum', slug: 'lumi-glow-vitamin-c-serum', category_id: 3, price: 259000, weight: 30, stock: 18, image: U('photo-1570194065650-d99fb4bedf0a'), units_sold: 342, description: 'Sodium ascorbyl phosphate 10% dikombinasikan dengan ferulic acid untuk mencerahkan dan melindungi kulit dari radikal bebas.' },
    { name: 'Barrier Repair Niacinamide Serum', slug: 'barrier-repair-niacinamide-serum', category_id: 3, price: 189000, weight: 30, stock: 47, image: U('photo-1612817288484-6f916006741a'), units_sold: 401, description: 'Niacinamide 5% + zinc PCA untuk meredakan jerawat, mengontrol minyak, dan memperkuat skin barrier.' },
    { name: 'Retinol 0.5% Night Renewal Serum', slug: 'retinol-05-night-renewal-serum', category_id: 3, price: 289000, weight: 30, stock: 0, image: U('photo-1631729371254-42c2892f0e6e'), units_sold: 156, description: 'Retinol terenkapsulasi dengan squalane untuk regenerasi kulit malam hari tanpa iritasi berlebih.' },
    { name: 'Cloud Hydra Gel Moisturizer', slug: 'cloud-hydra-gel-moisturizer', category_id: 4, price: 179000, weight: 50, stock: 31, image: U('photo-1556228453-efd6c1ff04f6'), units_sold: 265, description: 'Gel moisturizer ringan dengan hyaluronic acid tiga molekul untuk hidrasi berlapis tanpa rasa lengket.' },
    { name: 'Ceramide Barrier Repair Cream', slug: 'ceramide-barrier-repair-cream', category_id: 4, price: 219000, weight: 50, stock: 6, image: U('photo-1608248543803-ba4f8c70ae0b'), units_sold: 187, description: 'Krim kaya ceramide NP dan shea butter untuk memperbaiki skin barrier kulit sangat kering dan iritasi.' },
    { name: 'Invisible Shield SPF 50+ PA++++', slug: 'invisible-shield-spf-50-pa', category_id: 5, price: 169000, weight: 50, stock: 56, image: U('photo-1620916566398-39f1143ab7be'), units_sold: 378, description: 'Sunscreen ringan dengan proteksi spektrum luas SPF 50+ PA++++, finish satin tanpa whitecast.' },
    { name: 'Tone-Up UV Fluid SPF 35', slug: 'tone-up-uv-fluid-spf-35', category_id: 5, price: 159000, weight: 40, stock: 22, image: U('photo-1596755094514-f87e34085b2c'), units_sold: 143, description: 'Sunscreen sekaligus tone-up dengan efek glow alami untuk pemakaian sehari-hari.' },
    { name: 'Pink Clay Detox Mask', slug: 'pink-clay-detox-mask', category_id: 6, price: 129000, weight: 75, stock: 14, image: U('photo-1620756236308-65c3ef5d25f3'), units_sold: 121, description: 'Masker tanah liat pink kaolin yang menarik minyak berlebih dan mendetoksifikasi pori secara lembut.' },
  ];
  return items.map((item, i) => {
    const created = iso(daysAgo(90 - i * 6));
    return {
      id: i + 1,
      category_id: item.category_id,
      name: item.name,
      slug: item.slug,
      description: item.description ?? null,
      price: item.price,
      weight: item.weight,
      stock: item.stock,
      image: item.image,
      is_active: true,
      units_sold: item.units_sold,
      created_at: created,
      updated_at: iso(daysAgo(5)),
    };
  });
}

function seedUsers(): MockUser[] {
  const mk = (id: number, name: string, email: string, role: MockUser['role'], phone: string | null, days: number): MockUser => ({
    id,
    name,
    email,
    role,
    phone,
    email_verified_at: iso(daysAgo(days)),
    is_active: true,
    created_at: iso(daysAgo(days)),
  });
  return [
    mk(1, 'Admin Lumière', 'admin@lumiere.com', 'admin', '081100000001', 400),
    mk(2, 'dr. Yoshi Wijaya', 'doctor.yoshi@lumiere.com', 'doctor', '081211462862', 380),
    mk(3, 'Salsabila Putri', 'customer@lumiere.com', 'customer', '081234567890', 60),
    mk(4, 'Dewi Ananta', 'dewi.ananta@gmail.com', 'customer', '081399988776', 45),
    mk(5, 'Raka Pramudya', 'raka.pramudya@gmail.com', 'customer', '081277665544', 30),
    mk(6, 'Michelle Tanaya', 'michelle.tanaya@gmail.com', 'customer', '081811223344', 25),
    mk(7, 'Bima Saputra', 'bima.saputra@gmail.com', 'customer', '085677889900', 20),
    mk(8, 'Nadia Kirana', 'nadia.kirana@gmail.com', 'customer', '081299445566', 12),
  ];
}

function seedAddresses(): MockAddress[] {
  return [
    {
      id: 1,
      user_id: 3,
      label: 'Rumah',
      recipient_name: 'Salsabila Putri',
      name: 'Salsabila Putri',
      phone: '081234567890',
      province: 'DKI Jakarta',
      city: 'Jakarta Selatan',
      district: 'Kebayoran Baru',
      postal_code: '12110',
      address: 'Jl. Senopati No. 45, RT 05/RW 03, Gunung',
      biteship_area_id: 'IDNP9010243001',
      is_default: true,
      created_at: iso(daysAgo(55)),
      updated_at: iso(daysAgo(55)),
    },
    {
      id: 2,
      user_id: 3,
      label: 'Kantor',
      recipient_name: 'Salsabila Putri',
      name: 'Salsabila Putri',
      phone: '081234567890',
      province: 'DKI Jakarta',
      city: 'Jakarta Pusat',
      district: 'Menteng',
      postal_code: '10310',
      address: 'Jl. Kebon Sirih Raya No. 12, Menteng',
      biteship_area_id: 'IDNP9010243002',
      is_default: false,
      created_at: iso(daysAgo(40)),
      updated_at: iso(daysAgo(40)),
    },
    {
      id: 3,
      user_id: 4,
      label: 'Rumah',
      recipient_name: 'Dewi Ananta',
      name: 'Dewi Ananta',
      phone: '081399988776',
      province: 'Jawa Barat',
      city: 'Bandung',
      district: 'Coblong',
      postal_code: '40132',
      address: 'Jl. Dago No. 88, Lebakgede',
      biteship_area_id: 'IDNP9020431001',
      is_default: true,
      created_at: iso(daysAgo(44)),
      updated_at: iso(daysAgo(44)),
    },
  ];
}

function seedDoctors(): MockDoctor[] {
  return [
    {
      id: 1,
      user_id: 2,
      name: 'dr. Yoshi Wijaya, Sp.KK',
      title: 'Spesialis Kulit & Kelamin',
      specialization: 'Dermatologist & Laser Specialist',
      license_number: 'SIP.5051.DKI.2024',
      phone: '081211462862',
      experience: '8+ Tahun Pengalaman',
      rating: 4.9,
      review_count: 142,
      avatar_color: 'from-rose-400 to-pink-500',
      bio: 'Fokus pada penanganan jerawat inflamasi, bekas luka atrophic, dan peremajaan kulit modern.',
      skills: ['Laser Treatment', 'Acne Scar Subcision', 'Medical Peeling', 'Anti-Aging Injectables'],
      schedule_days: 'Senin - Jumat',
      available_days: [1, 2, 3, 4, 5],
      work_start_time: '10:00',
      work_end_time: '20:00',
      status: 'active',
    },
    {
      id: 2,
      name: 'dr. Sinta Rahmawati, Sp.DV',
      title: 'Spesialis Dermatologi & Venereologi',
      specialization: 'Anti-Aging & Melasma Expert',
      license_number: 'SIP.7712.Jabar.2023',
      phone: '081211462862',
      experience: '10+ Tahun Pengalaman',
      rating: 4.9,
      review_count: 198,
      avatar_color: 'from-amber-400 to-rose-400',
      bio: 'Ahli terapi hiperpigmentasi membandel, melasma hormonal, dan skin barrier restoration.',
      skills: ['Melasma Therapy', 'Pico Laser', 'Skin Barrier Repair', 'Collagen Booster'],
      schedule_days: 'Selasa - Sabtu',
      available_days: [2, 3, 4, 5, 6],
      work_start_time: '10:00',
      work_end_time: '20:00',
      status: 'active',
    },
    {
      id: 3,
      name: 'dr. Alana Christie, Sp.KK',
      title: 'Dokter Estetika Klinis',
      specialization: 'Clinical Aesthetic Physician',
      license_number: 'SIP.3390.DKI.2025',
      phone: '081211462862',
      experience: '6+ Tahun Pengalaman',
      rating: 4.8,
      review_count: 110,
      avatar_color: 'from-emerald-400 to-teal-500',
      bio: 'Mengedepankan perawatan preventif, glowing radiant finish, dan formulasi home-care presisi.',
      skills: ['Glow Peeling', 'Hydrafacial Pro', 'Botox & Contour', 'Custom Serum Therapy'],
      schedule_days: 'Senin - Kamis & Sabtu',
      available_days: [1, 2, 3, 4, 6],
      work_start_time: '10:00',
      work_end_time: '20:00',
      status: 'active',
    },
    {
      id: 4,
      name: 'dr. Kevin Alfarizi, Sp.KK',
      title: 'Spesialis Kulit Klinik',
      specialization: 'Acne & Scar Specialist',
      license_number: 'SIP.5521.Banten.2024',
      phone: '081211462862',
      experience: '7+ Tahun Pengalaman',
      rating: 4.7,
      review_count: 95,
      avatar_color: 'from-sky-400 to-blue-500',
      bio: 'Berpengalaman menangani jerawat sikatik parah, keloid, dan restorasi tekstur kulit.',
      skills: ['Acne Management', 'Fractional CO2 Laser', 'Microneedling', 'Chemical Peeling'],
      schedule_days: 'Rabu - Minggu',
      available_days: [3, 4, 5, 6, 0],
      work_start_time: '11:00',
      work_end_time: '19:00',
      status: 'active',
    },
    {
      id: 5,
      name: 'dr. Maya Kusuma, Sp.DV',
      title: 'Dokter Kulit Senior',
      specialization: 'Sensitive Skin & Barrier Expert',
      license_number: 'SIP.4407.DKI.2022',
      phone: '081211462862',
      experience: '12+ Tahun Pengalaman',
      rating: 4.9,
      review_count: 221,
      avatar_color: 'from-violet-400 to-purple-500',
      bio: 'Spesialis kulit sensitif, rosacea, dan dermatitis dengan pendekatan perawatan minimal iritasi.',
      skills: ['Rosacea Therapy', 'Barrier Reconstruction', 'Allergy Testing', 'Gentle Peeling'],
      schedule_days: 'Senin, Rabu, Jumat',
      available_days: [1, 3, 5],
      work_start_time: '09:00',
      work_end_time: '17:00',
      status: 'inactive',
    },
  ];
}

function seedServices(): MockService[] {
  return [
    { id: 1, code: 'SRV-CONSULT', name: 'Konsultasi Dokter Kulit', description: 'Konsultasi menyeluruh dengan dokter spesialis untuk analisis kondisi kulit Anda.', duration_minutes: 30, price: 150000, category: 'Konsultasi', is_active: true },
    { id: 2, code: 'SRV-FACIAL', name: 'Signature Glow Facial', description: 'Perawatan facial premium untuk mencerahkan dan menghidrasi kulit secara mendalam.', duration_minutes: 60, price: 350000, category: 'Perawatan Wajah', is_active: true },
    { id: 3, code: 'SRV-ACNE', name: 'Acne Medical Treatment', description: 'Terapi medis komprehensif untuk jerawat aktif dan pencegahan bekas luka.', duration_minutes: 45, price: 275000, category: 'Perawatan Wajah', is_active: true },
    { id: 4, code: 'SRV-LASER', name: 'Laser Rejuvenation', description: 'Peremajaan kulit dengan teknologi laser presisi untuk tekstur dan tone lebih merata.', duration_minutes: 30, price: 850000, category: 'Laser', is_active: true },
    { id: 5, code: 'SRV-BARRIER', name: 'Skin Barrier Repair Therapy', description: 'Terapi intensif pemulihan skin barrier untuk kulit sensitif dan rusak.', duration_minutes: 60, price: 425000, category: 'Terapi Khusus', is_active: true },
  ];
}

function seedPatients(): MockPatient[] {
  const mk = (
    id: number, user_id: number | null, name: string, phone: string, email: string | null,
    gender: MockPatient['gender'], skin_type: string | null, allergies: string | null,
    medical_history: string | null, days: number
  ): MockPatient => ({
    id,
    user_id,
    name,
    phone,
    email,
    date_of_birth: gender === 'female' ? '1998-04-12' : '1994-09-02',
    gender,
    address: null,
    skin_type,
    notes: null,
    allergies,
    medical_history,
    emergency_contact: null,
    status: 'active',
    created_at: iso(daysAgo(days)),
    updated_at: iso(daysAgo(days)),
  });
  return [
    mk(1, 3, 'Salsabila Putri', '081234567890', 'customer@lumiere.com', 'female', 'Kombinasi', 'Tidak ada', 'Jerawat hormonal ringan sejak kuliah (2020), telah selesai terapi 2024.', 60),
    mk(2, null, 'Dewi Ananta', '081399988776', 'dewi.ananta@gmail.com', 'female', 'Kering-Sensitif', 'Fragrance', 'Eksim ringan, keluhan kemerahan pada pipi.', 45),
    mk(3, null, 'Raka Pramudya', '081277665544', 'raka.pramudya@gmail.com', 'male', 'Berminyak', 'Tidak ada', 'Jerawat aktif kategori sedang, mulai terapi sejak 2025.', 30),
    mk(4, null, 'Michelle Tanaya', '081811223344', 'michelle.tanaya@gmail.com', 'female', 'Normal', 'Salicylic acid', 'Melasma pasca hamil di area dahi dan pipi.', 25),
    mk(5, null, 'Bima Saputra', '085677889900', 'bima.saputra@gmail.com', 'male', 'Kombinasi', 'Tidak ada', 'Bekas jerawat atrophic di area pipi kanan.', 20),
    mk(6, null, 'Nadia Kirana', '081299445566', 'nadia.kirana@gmail.com', 'female', 'Sensitif', 'Alkohol denat', 'Skin barrier rusak karena over-exfoliation.', 12),
  ];
}

function seedAppointments(): { appointments: MockAppointment[]; histories: MockStatusHistory[] } {
  const appts: MockAppointment[] = [];
  const histories: MockStatusHistory[] = [];
  let apptId = 0;
  let historyId = 0;

  const mk = (
    date: Date, hour: number, patientId: number, doctorId: number, serviceId: number,
    status: string, mode: 'offline' | 'online', extra: Partial<MockAppointment> = {}
  ): void => {
    apptId += 1;
    const service = seedServices().find((s) => s.id === serviceId)!;
    const end = new Date(date);
    end.setHours(hour, service.duration_minutes, 0, 0);
    const startIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`;
    appts.push({
      id: apptId,
      booking_code: `LB-2026-${String(1000 + apptId)}`,
      patient_id: patientId,
      doctor_id: doctorId,
      service_id: serviceId,
      appointment_date: startIso.slice(0, 10),
      appointment_time: `${String(hour).padStart(2, '0')}:00`,
      start_time: startIso,
      end_time: startIso.slice(0, 11) + `${String(Math.floor((hour * 60 + service.duration_minutes) / 60)).padStart(2, '0')}:${String((hour * 60 + service.duration_minutes) % 60).padStart(2, '0')}:00`,
      consultation_mode: mode,
      meeting_link: mode === 'online' ? 'https://meet.lumiere-beaute.com/room/demo-clinic' : null,
      complaint: 'Konsultasi kondisi kulit wajah.',
      patient_notes: null,
      doctor_notes: extra.diagnosis ? 'Pasien kooperatif, sudah menjalani home care dengan baik.' : null,
      diagnosis: extra.diagnosis ?? null,
      treatment_plan: extra.treatment_plan ?? null,
      prescription: extra.prescription ?? null,
      status,
      cancellation_reason: extra.cancellation_reason ?? null,
      created_at: iso(new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000)),
      updated_at: iso(date),
    });
    histories.push({
      id: (historyId += 1),
      appointment_id: apptId,
      from_status: null,
      to_status: 'pending',
      notes: null,
      created_at: iso(new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000)),
    });
    if (status !== 'pending') {
      histories.push({
        id: (historyId += 1),
        appointment_id: apptId,
        from_status: 'pending',
        to_status: 'confirmed',
        notes: null,
        created_at: iso(new Date(date.getTime() - 1 * 24 * 60 * 60 * 1000)),
      });
    }
    if (['checked_in', 'in_progress', 'completed'].includes(status)) {
      histories.push({
        id: (historyId += 1),
        appointment_id: apptId,
        from_status: 'confirmed',
        to_status: status,
        notes: null,
        created_at: iso(date),
      });
    }
  };

  // Doctor 1 (dr. Yoshi) queue today
  mk(new Date(), 10, 1, 1, 2, 'checked_in', 'offline');
  mk(new Date(), 13, 3, 1, 3, 'in_progress', 'offline');
  mk(new Date(), 16, 4, 1, 1, 'confirmed', 'online');
  // Upcoming
  mk(daysAhead(1, 14), 14, 4, 2, 4, 'confirmed', 'offline');
  mk(daysAhead(2, 11), 11, 1, 1, 2, 'pending', 'offline');
  mk(daysAhead(3, 15), 15, 1, 1, 5, 'confirmed', 'online');
  mk(daysAhead(5, 10), 10, 6, 3, 3, 'pending', 'offline');
  // Past completed with clinical notes
  mk(daysAgo(3, 11), 11, 5, 1, 2, 'completed', 'offline', {
    diagnosis: 'Acne vulgaris grade II dengan bekas jerawat atrophic ringan.',
    treatment_plan: 'Combo peel 3 sesi + micro-needling, lanjutkan home care acne series.',
    prescription: 'Adapalene gel 0.1% malam, clindamycin gel pagi, sunscreen SPF 50.',
  });
  mk(daysAgo(7, 13), 13, 2, 2, 1, 'completed', 'online', {
    diagnosis: 'Dermatitis kontak iritan, skin barrier impaired.',
    treatment_plan: 'Barrier repair therapy 4 sesi, hindari aktif exfoliant 4 minggu.',
    prescription: 'Moisturizer ceramide 3x sehari, hydrocortisone 1% 2x sehari (1 minggu).',
  });
  mk(daysAgo(1, 9), 9, 3, 1, 1, 'cancelled', 'offline', {
    cancellation_reason: 'Pasien berhalangan hadir karena urusan keluarga.',
  });

  return { appointments: appts, histories };
}

/* =========================================================================
   Orders
   ========================================================================= */

interface OrderSeedSpec {
  user: number;
  days: number;
  hour: number;
  status: string;
  items: Array<[number, number]>; // [product_id, quantity]
  courier: string;
  courierName: string;
  service: string;
  etd: string;
  shippingCost: number;
  shipment?: { tracking: string; status: string; shippedDays?: number; deliveredDays?: number };
  payment: { status: string; type: string | null; paidDays?: number };
  cancellation_reason?: string;
}

const ORDER_SEEDS: OrderSeedSpec[] = [
  {
    user: 3, days: 25, hour: 13, status: 'COMPLETED',
    items: [[5, 1], [8, 1]], courier: 'jne', courierName: 'JNE', service: 'REG', etd: '2-3 Hari',
    shippingCost: 25000,
    shipment: { tracking: 'JNE8812345678', status: 'delivered', shippedDays: 24, deliveredDays: 21 },
    payment: { status: 'success', type: 'gopay', paidDays: 25 },
  },
  {
    user: 3, days: 12, hour: 9, status: 'DELIVERED',
    items: [[9, 1]], courier: 'sicepat', courierName: 'SiCepat', service: 'BEST', etd: '1-2 Hari',
    shippingCost: 32000,
    shipment: { tracking: 'SC0098765432', status: 'delivered', shippedDays: 11, deliveredDays: 9 },
    payment: { status: 'success', type: 'bca_va', paidDays: 12 },
  },
  {
    user: 3, days: 5, hour: 16, status: 'SHIPPED',
    items: [[10, 2]], courier: 'jnt', courierName: 'J&T Express', service: 'EZ', etd: '2-3 Hari',
    shippingCost: 24000,
    shipment: { tracking: 'JT4432110099', status: 'shipped', shippedDays: 4 },
    payment: { status: 'success', type: 'gopay', paidDays: 5 },
  },
  {
    user: 3, days: 1, hour: 10, status: 'PROCESSING',
    items: [[4, 1], [1, 1]], courier: 'jne', courierName: 'JNE', service: 'YES', etd: '1-2 Hari',
    shippingCost: 35000,
    payment: { status: 'success', type: 'gopay', paidDays: 1 },
  },
  {
    user: 3, days: 0, hour: 7, status: 'PENDING_PAYMENT',
    items: [[3, 1], [12, 1]], courier: 'tiki', courierName: 'TIKI', service: 'REG', etd: '3-4 Hari',
    shippingCost: 26000,
    payment: { status: 'pending', type: null },
  },
  {
    user: 4, days: 0, hour: 8, status: 'PAID',
    items: [[6, 1], [10, 1]], courier: 'jnt', courierName: 'J&T Express', service: 'EZ', etd: '2-3 Hari',
    shippingCost: 26000,
    payment: { status: 'success', type: 'gopay', paidDays: 0 },
  },
  {
    user: 4, days: 8, hour: 14, status: 'COMPLETED',
    items: [[2, 1], [9, 1]], courier: 'pos', courierName: 'POS Indonesia', service: 'PAKET KILAT KHUSUS', etd: '3-5 Hari',
    shippingCost: 22000,
    shipment: { tracking: 'PO1199887766', status: 'delivered', shippedDays: 7, deliveredDays: 3 },
    payment: { status: 'success', type: 'bca_va', paidDays: 8 },
  },
  {
    user: 5, days: 3, hour: 20, status: 'PAID',
    items: [[6, 2]], courier: 'jne', courierName: 'JNE', service: 'REG', etd: '2-3 Hari',
    shippingCost: 24000,
    payment: { status: 'success', type: 'gopay', paidDays: 3 },
  },
  {
    user: 6, days: 18, hour: 11, status: 'CANCELLED',
    items: [[7, 1]], courier: 'sicepat', courierName: 'SiCepat', service: 'REG', etd: '2-3 Hari',
    shippingCost: 23000,
    payment: { status: 'pending', type: null },
    cancellation_reason: 'Stok produk tidak tersedia saat verifikasi.',
  },
  {
    user: 7, days: 30, hour: 15, status: 'COMPLETED',
    items: [[10, 1], [12, 1], [1, 1]], courier: 'jnt', courierName: 'J&T Express', service: 'EZ', etd: '2-3 Hari',
    shippingCost: 28000,
    shipment: { tracking: 'JT9988776655', status: 'delivered', shippedDays: 29, deliveredDays: 26 },
    payment: { status: 'success', type: 'bri_va', paidDays: 30 },
  },
  {
    user: 8, days: 20, hour: 19, status: 'EXPIRED',
    items: [[5, 1]], courier: 'jne', courierName: 'JNE', service: 'REG', etd: '2-3 Hari',
    shippingCost: 25000,
    payment: { status: 'pending', type: null },
  },
];

function seedOrders(db: Pick<MockDb, 'orders' | 'orderItems' | 'payments' | 'shipments' | 'auditLogs' | 'addresses' | 'products'>): void {
  let orderItemId = 0;
  let paymentId = 0;
  let shipmentId = 0;
  let auditId = 0;

  ORDER_SEEDS.forEach((spec, idx) => {
    const orderId = idx + 1;
    const created = daysAgo(spec.days, spec.hour);
    const address = db.addresses.find((a) => a.user_id === spec.user) ?? db.addresses[0];
    const items = spec.items.map(([productId, quantity]) => {
      const product = db.products.find((p) => p.id === productId)!;
      orderItemId += 1;
      return {
        id: orderItemId,
        order_id: orderId,
        product_id: productId,
        product_name: product.name,
        unit_price: product.price,
        quantity,
        subtotal: product.price * quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal + spec.shippingCost;

    db.orders.push({
      id: orderId,
      order_number: `ORD-${ymd(created)}-${String(100 + orderId)}`,
      user_id: spec.user,
      status: spec.status,
      subtotal,
      shipping_cost: spec.shippingCost,
      total,
      shipping_courier: spec.courierName,
      shipping_service: spec.service,
      shipping_etd: spec.etd,
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
      cancellation_reason: spec.cancellation_reason ?? null,
      cancelled_at: spec.status === 'CANCELLED' ? iso(new Date(created.getTime() + 6 * 60 * 60 * 1000)) : null,
      created_at: iso(created),
      updated_at: iso(created),
    });

    items.forEach((item) => db.orderItems.push(item));

    paymentId += 1;
    db.payments.push({
      id: paymentId,
      order_id: orderId,
      provider: 'midtrans',
      transaction_id: spec.payment.status === 'success' ? `MOCK-TXN-${orderId}${ymd(created)}` : null,
      payment_type: spec.payment.type,
      status: spec.payment.status,
      amount: total,
      snap_token: spec.payment.status === 'success' ? null : `MOCK-SNAP-${orderId}`,
      redirect_url: null,
      paid_at: spec.payment.paidDays !== undefined ? iso(daysAgo(spec.payment.paidDays, spec.hour + 1)) : null,
      expires_at: spec.payment.status === 'pending' ? iso(daysAgo(spec.days - 1, spec.hour)) : null,
    });

    if (spec.shipment) {
      shipmentId += 1;
      db.shipments.push({
        id: shipmentId,
        order_id: orderId,
        courier: spec.courierName,
        service: spec.service,
        tracking_number: spec.shipment.tracking,
        status: spec.shipment.status,
        shipped_at: spec.shipment.shippedDays !== undefined ? iso(daysAgo(spec.shipment.shippedDays, 9)) : null,
        delivered_at: spec.shipment.deliveredDays !== undefined ? iso(daysAgo(spec.shipment.deliveredDays, 15)) : null,
        biteship_order_id: `BSHP-ORD-${orderId}`,
        biteship_tracking_id: spec.shipment.tracking,
        biteship_waybill_id: spec.shipment.tracking,
      });
    }

    auditId += 1;
    db.auditLogs.push({
      id: auditId,
      order_id: orderId,
      admin_id: 1,
      action: 'created',
      previous_status: null,
      new_status: 'PENDING_PAYMENT',
      reason: null,
      note: 'Pesanan dibuat oleh pelanggan.',
      created_at: iso(created),
    });
    if (spec.status !== 'PENDING_PAYMENT') {
      auditId += 1;
      db.auditLogs.push({
        id: auditId,
        order_id: orderId,
        admin_id: 1,
        action: 'status_changed',
        previous_status: 'PENDING_PAYMENT',
        new_status: spec.status,
        reason: spec.cancellation_reason ?? null,
        note: null,
        created_at: iso(new Date(created.getTime() + 2 * 60 * 60 * 1000)),
      });
    }
  });
}

/* =========================================================================
   Database singleton
   ========================================================================= */

export function createSeedDb(): MockDb {
  const categories = seedCategories();
  const products = seedProducts();
  const users = seedUsers();
  const addresses = seedAddresses();
  const doctors = seedDoctors();
  const services = seedServices();
  const patients = seedPatients();
  const { appointments, histories } = seedAppointments();

  const db: MockDb = {
    users,
    categories,
    products,
    addresses,
    orders: [],
    orderItems: [],
    payments: [],
    shipments: [],
    auditLogs: [],
    doctors,
    services,
    patients,
    appointments,
    statusHistories: histories,
    seq: {
      user: users.length,
      category: categories.length,
      product: products.length,
      address: addresses.length,
      order: 0,
      orderItem: 0,
      payment: 0,
      shipment: 0,
      auditLog: 0,
      doctor: doctors.length,
      service: services.length,
      patient: patients.length,
      appointment: appointments.length,
      statusHistory: histories.length,
    },
  };

  seedOrders(db);
  db.seq.order = db.orders.length;
  db.seq.orderItem = db.orderItems.length;
  db.seq.payment = db.payments.length;
  db.seq.shipment = db.shipments.length;
  db.seq.auditLog = db.auditLogs.length;

  return db;
}

export const db: MockDb = createSeedDb();

/** Stateless demo auth token: mock-<userId>-<random> */
export function issueToken(userId: number): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `mock-${userId}-${rand}`;
}

export function userIdFromToken(token: string | null): number | null {
  if (!token) return null;
  const match = /^mock-(\d+)-/.exec(token);
  return match ? Number(match[1]) : null;
}
