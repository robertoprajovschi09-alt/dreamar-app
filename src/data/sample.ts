/**
 * PREVIEW DATA — illustrative only, to showcase the UI design.
 * The production app renders live workspace data (and proper empty states).
 * Nothing here is seeded into any database.
 */

export type Risk = "low" | "medium" | "high";
export type Niche =
  | "real_estate"
  | "restaurant"
  | "dental_clinic"
  | "fitness_gym"
  | "lounge"
  | "beauty"
  | "auto"
  | "hotel"
  | "local_store"
  | "custom";

export const nicheLabels: Record<Niche, string> = {
  real_estate: "Imobiliare",
  restaurant: "Restaurant",
  dental_clinic: "Clinică stomatologică",
  fitness_gym: "Fitness",
  lounge: "Lounge",
  beauty: "Beauty",
  auto: "Auto",
  hotel: "Hotel",
  local_store: "Magazin local",
  custom: "Personalizat",
};

export const agencyKpis = [
  { label: "Clienți activi", value: "12", trend: 9.1, sub: "2 în onboarding săptămâna aceasta", spark: [6, 7, 7, 8, 9, 10, 12], tone: "primary" },
  { label: "Programate săptămâna aceasta", value: "38", trend: 12.4, sub: "postări pe 6 platforme", spark: [20, 24, 22, 30, 28, 34, 38], tone: "info" },
  { label: "Aprobări în așteptare", value: "7", trend: -4.0, sub: "3 întârziate > 48h", spark: [10, 9, 11, 8, 9, 8, 7], tone: "warning" },
  { label: "Rapoarte de predat", value: "5", trend: 0, sub: "Ciclu iunie · 2 trimise", spark: [3, 4, 4, 5, 5, 5, 5], tone: "primary" },
];

export const growthTrend = [
  { label: "Ian", followers: 18, reach: 120, impact: 6 },
  { label: "Feb", followers: 22, reach: 142, impact: 8 },
  { label: "Mar", followers: 31, reach: 168, impact: 11 },
  { label: "Apr", followers: 28, reach: 158, impact: 9 },
  { label: "Mai", followers: 39, reach: 201, impact: 14 },
  { label: "Iun", followers: 47, reach: 232, impact: 18 },
];

export const platformMix = [
  { label: "Ian", instagram: 42, tiktok: 28, facebook: 18 },
  { label: "Feb", instagram: 48, tiktok: 34, facebook: 20 },
  { label: "Mar", instagram: 55, tiktok: 41, facebook: 22 },
  { label: "Apr", instagram: 51, tiktok: 47, facebook: 19 },
  { label: "Mai", instagram: 63, tiktok: 58, facebook: 24 },
  { label: "Iun", instagram: 69, tiktok: 66, facebook: 26 },
];

export const trafficVeracity = [
  { name: "Calificat", value: 50 },
  { name: "Cald", value: 32 },
  { name: "Rece", value: 18 },
];

// How the agency is paid by this client. "barter" and "comision" clients have
// no fixed monthly retainer (retainer is hidden for them in the UI).
export type BillingType = "retainer" | "barter" | "comision";
export const billingTypeLabels: Record<BillingType, string> = {
  retainer: "Retainer",
  barter: "Barter",
  comision: "Comision",
};

export type Client = {
  id: string;
  name: string;
  niche: Niche;
  city: string;
  contact: string;
  retainer: number;
  billingType?: BillingType;
  deliverables?: number; // livrabile pe lună
  clipBuffer?: number; // clipuri gata de postat (tampon)
  phone?: string;
  notes?: string;
  status: "active" | "paused";
  health: number;
  risk: Risk;
  platforms: string[];
  trend: number;
};

export const clients: Client[] = [
  { id: "altmark", name: "Altmark Residences", niche: "real_estate", city: "Cluj-Napoca", contact: "Diana Pop", retainer: 2400, status: "active", health: 86, risk: "low", platforms: ["Instagram", "TikTok", "Facebook"], trend: 12 },
  { id: "verde", name: "Verde Bistro", niche: "restaurant", city: "București", contact: "Andrei Ionescu", retainer: 1600, status: "active", health: 72, risk: "medium", platforms: ["Instagram", "TikTok"], trend: 6 },
  { id: "smile", name: "SmileLab Clinic", niche: "dental_clinic", city: "Timișoara", contact: "Dr. Mara Ene", retainer: 1900, status: "active", health: 64, risk: "medium", platforms: ["Instagram", "Facebook"], trend: -3 },
  { id: "ironpeak", name: "IronPeak Gym", niche: "fitness_gym", city: "Brașov", contact: "Vlad Dima", retainer: 1300, status: "active", health: 91, risk: "low", platforms: ["Instagram", "TikTok", "YouTube"], trend: 18 },
  { id: "lumen", name: "Lumen Lounge", niche: "lounge", city: "Constanța", contact: "Sofia Marin", retainer: 1100, status: "paused", health: 48, risk: "high", platforms: ["Instagram"], trend: -9 },
  { id: "auralux", name: "AuraLux Beauty", niche: "beauty", city: "Iași", contact: "Elena Radu", retainer: 1450, status: "active", health: 79, risk: "low", platforms: ["Instagram", "TikTok"], trend: 8 },
  { id: "drivex", name: "DriveX Motors", niche: "auto", city: "Oradea", contact: "Paul Crisan", retainer: 2100, status: "active", health: 55, risk: "medium", platforms: ["Facebook", "YouTube"], trend: 0 },
  { id: "mareluna", name: "Mare Luna Hotel", niche: "hotel", city: "Mamaia", contact: "Irina Voicu", retainer: 2800, status: "active", health: 83, risk: "low", platforms: ["Instagram", "Facebook"], trend: 11 },
  { id: "maple", name: "Maple Market", niche: "local_store", city: "Sibiu", contact: "Ana Dragoș", retainer: 1200, status: "active", health: 77, risk: "low", platforms: ["Instagram", "TikTok"], trend: 14 },
];

export type VideoRow = {
  id: string;
  client: string;
  platform: string;
  date: string;
  hook: string;
  format: string;
  views: number;
  reach: number;
  watchTime: number; // avg seconds
  duration: number; // seconds
  retention3s: number;
  retention50: number;
  completion: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  dms: number;
  calls: number;
  bodyAngle: string;
  cta: string;
  objective: string;
  salesImpact: string;
  feedback: string;
  aiInsight: string;
  aiScore: number;
  rec: "repeat" | "improve" | "stop";
};

export const videos: VideoRow[] = [
  { id: "v1", client: "Altmark Residences", platform: "TikTok", date: "18 Iun", hook: "Acest apartament de 450k € s-a vândut în 3 zile pentru că…", format: "Tur", views: 184200, reach: 240100, watchTime: 11, duration: 32, retention3s: 71, retention50: 44, completion: 38, likes: 9200, comments: 410, shares: 880, saves: 2140, dms: 64, calls: 12, bodyAngle: "Tur ghidat + ancoră de preț + dovadă de cerere", cta: "Scrie-ne în DM 'TUR' pentru următorul anunț", objective: "Generare de lead-uri", salesImpact: "~430k € pipeline atribuibil", feedback: "Client încântat — 11 vizionări rezervate în 48h.", aiInsight: "Curiozitatea + ancora concretă de preț în primele 2s au generat 71% retenție. Transformă-l în șablon pentru Garden 3BR și Riverside Villa.", aiScore: 92, rec: "repeat" },
  { id: "v2", client: "IronPeak Gym", platform: "Instagram", date: "17 Iun", hook: "POV: prima ta săptămână la IronPeak", format: "Transformare", views: 96400, reach: 128300, watchTime: 9, duration: 28, retention3s: 66, retention50: 39, completion: 41, likes: 7100, comments: 320, shares: 540, saves: 1230, dms: 88, calls: 6, bodyAngle: "POV relatabil + dovadă de comunitate", cta: "Comentează 'TRIAL' pentru o ședință gratuită", objective: "Înscrieri la trial", salesImpact: "21 de ședințe de trial rezervate", feedback: "I-a plăcut — vrea o serie POV săptămânală.", aiInsight: "Formatul POV relatabil convertește bine DM-urile. Combină-l cu un CTA clar de trial în primul comentariu.", aiScore: 88, rec: "repeat" },
  { id: "v3", client: "Verde Bistro", platform: "TikTok", date: "16 Iun", hook: "Am lăsat un copil de 4 ani să creeze meniul", format: "Sketch", views: 51200, reach: 78400, watchTime: 7, duration: 41, retention3s: 52, retention50: 28, completion: 29, likes: 3400, comments: 290, shares: 210, saves: 410, dms: 22, calls: 3, bodyAngle: "Premisă absurdă + recompensă", cta: "Rezervă o masă în acest weekend", objective: "Rezervări", salesImpact: "~2.4k € comenzi atribuite", feedback: "Amuzant, dar CTA neclar.", aiInsight: "Hook puternic, recompensă slabă la 14s. Scurtează la 25s și mută CTA-ul mai devreme.", aiScore: 74, rec: "improve" },
  { id: "v4", client: "SmileLab Clinic", platform: "Instagram", date: "15 Iun", hook: "Ce nu îți spune dentistul despre albire", format: "Talking head", views: 18300, reach: 31200, watchTime: 5, duration: 38, retention3s: 44, retention50: 22, completion: 22, likes: 940, comments: 86, shares: 70, saves: 180, dms: 12, calls: 4, bodyAngle: "Secret din interior", cta: "Scrie-ne în DM pentru o consultație", objective: "Lead-uri calificate", salesImpact: "4 consultații rezervate", feedback: "Prea lung, început lent.", aiInsight: "Hook-ul e bun, dar începutul e cu 4s prea lent. Taie umplutura și adaugă B-roll.", aiScore: 61, rec: "improve" },
  { id: "v5", client: "AuraLux Beauty", platform: "TikTok", date: "14 Iun", hook: "Glass skin în 60 de secunde", format: "Tutorial", views: 142800, reach: 198600, watchTime: 12, duration: 58, retention3s: 69, retention50: 47, completion: 44, likes: 11200, comments: 530, shares: 1320, saves: 3010, dms: 51, calls: 2, bodyAngle: "Rezultat + promisiune cu termen", cta: "Salvează și rezervă un facial", objective: "Rezervări", salesImpact: "18 faciale rezervate", feedback: "Cel mai bun rezultat din luna asta.", aiInsight: "Hook-urile cu rezultat + termen se salvează extrem de bine. Fă o serie: '___ în 60 de secunde'.", aiScore: 90, rec: "repeat" },
  { id: "v6", client: "Lumen Lounge", platform: "Instagram", date: "12 Iun", hook: "Vineri seara la Lumen", format: "Aftermovie", views: 7400, reach: 12100, watchTime: 4, duration: 47, retention3s: 31, retention50: 12, completion: 14, likes: 210, comments: 18, shares: 14, saves: 42, dms: 4, calls: 0, bodyAngle: "Montaj de atmosferă, fără hook", cta: "—", objective: "Notorietate", salesImpact: "Neglijabil", feedback: "Fără CTA sau hook real.", aiInsight: "Rata de finalizare scade brusc după 14s. Renunță la formatul generic de aftermovie; începe cu o persoană + o replică.", aiScore: 38, rec: "stop" },
];

export const bestContent = [
  { title: "Apartament de 450k € vândut în 3 zile", client: "Altmark Residences", platform: "TikTok", views: 184200, eng: 9.2 },
  { title: "Glass skin în 60 de secunde", client: "AuraLux Beauty", platform: "TikTok", views: 142800, eng: 11.4 },
  { title: "POV: prima săptămână la IronPeak", client: "IronPeak Gym", platform: "Instagram", views: 96400, eng: 8.1 },
];

export const alerts = [
  { id: 1, tone: "danger" as const, client: "Lumen Lounge", text: "Scorul de sănătate a scăzut la 48 — 3 aprobări ratate și nicio postare de 9 zile.", time: "acum 2h" },
  { id: 2, tone: "warning" as const, client: "SmileLab Clinic", text: "Retenția scade cu 14% față de luna trecută. AI sugerează hook-uri mai scurte.", time: "acum 5h" },
  { id: 3, tone: "info" as const, client: "Altmark Residences", text: "Turul de pe TikTok a depășit benchmark-ul de 3,2× — replică formatul.", time: "acum 1z" },
];

export type TaskStatus = "todo" | "in_progress" | "overdue" | "done" | "archived";
export type SampleTask = {
  id: string; title: string; client: string; assignee: string;
  due: string; priority: "high" | "medium" | "low"; status: TaskStatus; type: string;
};

export const tasks: SampleTask[] = [
  { id: "t1", title: "Filmează turul proprietății pentru iunie", client: "Altmark Residences", assignee: "Robert Casco", due: "Astăzi", priority: "high" as const, status: "in_progress" as const, type: "Filmare" },
  { id: "t2", title: "Editează reel-ul de transformare", client: "IronPeak Gym", assignee: "Ana Mihai", due: "Mâine", priority: "medium" as const, status: "todo" as const, type: "Editare" },
  { id: "t3", title: "Scrie 8 hook-uri pentru campania de albire", client: "SmileLab Clinic", assignee: "Marius L.", due: "21 Iun", priority: "high" as const, status: "todo" as const, type: "Scriptare" },
  { id: "t4", title: "Pregătește draftul raportului pe iunie", client: "Mare Luna Hotel", assignee: "Robert Casco", due: "19 Iun", priority: "low" as const, status: "overdue" as const, type: "Raportare" },
];

export const approvals = [
  { id: "a1", item: "Script · 'De ce cumpărătorii din Cluj aleg Altmark'", client: "Altmark Residences", type: "Script", status: "pending" as const, requested: "acum 1h" },
  { id: "a2", item: "Reel · Tutorial glass skin v2", client: "AuraLux Beauty", type: "Video", status: "approved" as const, requested: "acum 3h" },
  { id: "a3", item: "Descriere · Programul de vineri", client: "Lumen Lounge", type: "Descriere", status: "rejected" as const, requested: "acum 1z" },
  { id: "a4", item: "Raport · Performanță mai", client: "IronPeak Gym", type: "Raport", status: "changes" as const, requested: "acum 2z" },
];

export const hooks = [
  { id: "h1", text: "Acest apartament de 450k € s-a vândut în 3 zile pentru că…", niche: "Imobiliare", platform: "TikTok", uses: 9, avgScore: 88, pattern: "Curiozitate + ancoră de preț" },
  { id: "h2", text: "POV: prima ta săptămână la [brand]", niche: "Fitness", platform: "Instagram", uses: 14, avgScore: 84, pattern: "Relatabilitate POV" },
  { id: "h3", text: "Ce nu îți spune [expertul] despre…", niche: "Stomatologie", platform: "Instagram", uses: 7, avgScore: 79, pattern: "Secret din interior" },
  { id: "h4", text: "Glass skin în 60 de secunde", niche: "Beauty", platform: "TikTok", uses: 11, avgScore: 90, pattern: "Rezultat + termen" },
  { id: "h5", text: "Am lăsat un copil de 4 ani să creeze meniul", niche: "Restaurant", platform: "TikTok", uses: 3, avgScore: 74, pattern: "Premisă absurdă" },
];

export const integrations = [
  { name: "Instagram", status: "connected", note: "Sincronizat acum 2 min", color: "from-pink-500 to-orange-400" },
  { name: "TikTok", status: "connected", note: "Sincronizat acum 6 min", color: "from-slate-900 to-slate-700" },
  { name: "Facebook", status: "connected", note: "Sincronizat acum 11 min", color: "from-blue-600 to-blue-500" },
  { name: "YouTube", status: "connected", note: "Sincronizat acum 1h", color: "from-red-600 to-red-500" },
  { name: "Google Business", status: "disconnected", note: "Neconectat", color: "from-emerald-500 to-teal-500" },
  { name: "LinkedIn", status: "connected", note: "Sincronizat acum 3h", color: "from-sky-700 to-sky-600" },
  { name: "Stripe", status: "connected", note: "Facturare activă", color: "from-indigo-600 to-violet-500" },
  { name: "WhatsApp Business", status: "disconnected", note: "Neconectat", color: "from-green-600 to-green-500" },
];

/* Real estate niche dashboard */
export const realEstateKpis = [
  { label: "Proprietăți promovate", value: "14", sub: "6 campanii active" },
  { label: "Vizionări rezervate", value: "37", sub: "+11 față de mai" },
  { label: "Oferte primite", value: "9", sub: "3 peste prețul cerut" },
  { label: "Cost / Lead", value: "€6.40", sub: "-18% față de luna trecută" },
];

export const properties = [
  { id: "p1", name: "Altmark Sky · 2 camere", type: "Apartament", price: 189000, area: "78 m²", views: 18400, messages: 142, viewings: 11, offers: 3, status: "Rezervat" },
  { id: "p2", name: "Altmark Garden · 3 camere", type: "Apartament", price: 245000, area: "104 m²", views: 24100, messages: 208, viewings: 16, offers: 4, status: "Disponibil" },
  { id: "p3", name: "Old Town Loft", type: "Loft", price: 162000, area: "61 m²", views: 9800, messages: 74, viewings: 6, offers: 1, status: "Disponibil" },
  { id: "p4", name: "Riverside Villa", type: "Vilă", price: 480000, area: "320 m²", views: 31200, messages: 95, viewings: 4, offers: 1, status: "În negociere" },
];

export const realEstateFunnel = [
  { label: "Vizualizări", value: 83 },
  { label: "Mesaje", value: 52 },
  { label: "Vizionări", value: 37 },
  { label: "Oferte", value: 9 },
];

/* Plans */
export const plans = [
  {
    name: "Starter Agency",
    price: 99,
    tagline: "Pentru operatori individuali la început de drum",
    features: ["Până la 5 clienți", "1 proprietar de agenție", "Rapoarte de bază", "Calendar de conținut de bază", "Stocare documente"],
    current: false,
  },
  {
    name: "Growth Agency",
    price: 150,
    tagline: "Pentru echipe în creștere care au nevoie de AI",
    features: ["Până la 15 clienți", "Până la 3 membri în echipă", "Rapoarte AI", "Portal client", "Tablouri de bord pe nișă", "Flux de aprobare"],
    current: true,
  },
  {
    name: "Unlimited Agency",
    price: 249,
    tagline: "Pentru agenții în scalare",
    features: ["Clienți nelimitați", "Echipă nelimitată", "Rapoarte white-label", "Cameră de strategie AI", "Analiză avansată", "Monitorizare competitori"],
    current: false,
  },
  {
    name: "White Label Pro",
    price: 399,
    tagline: "Brandul tău, domeniul tău",
    features: ["Tot ce include Unlimited", "Branding personalizat", "Domeniu propriu inclus", "Permisiuni avansate", "Rapoarte PDF premium"],
    current: false,
  },
];

export const adminAgencies = [
  { id: "ag1", name: "Nova Creative", plan: "Growth", clients: 12, mrr: 150, status: "active", owner: "Robert Casco" },
  { id: "ag2", name: "Peak Studio", plan: "Unlimited", clients: 41, mrr: 249, status: "active", owner: "Lena Wolf" },
  { id: "ag3", name: "Bright Loop", plan: "Starter", clients: 4, mrr: 99, status: "past_due", owner: "Ovidiu T." },
  { id: "ag4", name: "Halo Media", plan: "White Label Pro", clients: 88, mrr: 399, status: "active", owner: "Sara K." },
  { id: "ag5", name: "Tide Agency", plan: "Growth", clients: 9, mrr: 150, status: "trialing", owner: "Mihai B." },
];

export const strategySuggestions = [
  { title: "Planul de conținut pentru luna viitoare", desc: "Construiește un plan de 30 de zile pornind de la formatele câștigătoare ale acestui client" },
  { title: "Ce hook-uri au funcționat cel mai bine?", desc: "Clasează hook-urile după retenție și impact în afacere" },
  { title: "Ce ar trebui să nu mai facem?", desc: "Identifică formatele cu performanță slabă pe care să le elimini" },
  { title: "Generează 5 scripturi video", desc: "Scripturi adaptate la vocea brandului și la obiective" },
];

export const reportSections = [
  "Rezumat executiv",
  "Lucrări finalizate",
  "Conținut cu cea mai bună performanță",
  "Conținut cu cea mai slabă performanță",
  "Creștere pe platforme",
  "Analiza hook-urilor",
  "Analiza formatelor de conținut",
  "Impact în afacere",
  "Feedback de la client",
  "Probleme observate",
  "Strategia pentru luna viitoare",
  "Plan de conținut recomandat",
  "Concluzia finală a agenției",
];

/* ───────────────────────── Restaurant niche (Verde Bistro) ───────────────────────── */
export const restaurantKpis = [
  { label: "Rezervări", value: "312", sub: "+42 față de mai" },
  { label: "Comenzi online", value: "1,284", sub: "+18% față de luna trecută" },
  { label: "Trafic estimat în local", value: "4.6K", sub: "medie săptămânală" },
  { label: "Impact în vânzări", value: "€38.2K", sub: "atribuit conținutului" },
];
export const restaurantDishes = [
  { name: "Paste cu trufe", orders: 214, trend: 22, intent: "Ridicat" },
  { name: "Smash Burger", orders: 198, trend: 15, intent: "Ridicat" },
  { name: "Aperol Spritz", orders: 162, trend: 28, intent: "Mediu" },
  { name: "Tiramisu", orders: 176, trend: 9, intent: "Mediu" },
];
export const restaurantTrend = [
  { label: "S1", reservations: 62, orders: 240 },
  { label: "S2", reservations: 71, orders: 286 },
  { label: "S3", reservations: 84, orders: 322 },
  { label: "S4", reservations: 95, orders: 436 },
];
export const menuCampaigns = [
  { name: "Lansare meniu de vară", status: "Live", reach: "82K", orders: 340 },
  { name: "Weekenduri de brunch", status: "Programat", reach: "—", orders: 0 },
  { name: "Seri cu asociere de vinuri", status: "Încheiat", reach: "54K", orders: 120 },
];
export const buyingIntentComments = [
  { text: "Aveți rezervări pentru 8 persoane vinerea asta? 🙌", handle: "@andrei.m" },
  { text: "Pastele cu trufe se pot comanda cu livrare?", handle: "@ioana_r" },
  { text: "Rezerv o cină aniversară — puteți face un tort?", handle: "@paul.vintila" },
  { text: "La ce oră se închide bucătăria în weekend?", handle: "@elena.d" },
];
export const restaurantEvents = [
  { name: "Seară de jazz live", date: "21 Iun", bookings: 48 },
  { name: "Degustare de vinuri", date: "28 Iun", bookings: 22 },
];

/* ───────────────────────── Dental niche (SmileLab Clinic) ───────────────────────── */
export const dentalKpis = [
  { label: "Lead-uri calificate", value: "84", sub: "+19 față de mai" },
  { label: "Programări rezervate", value: "57", sub: "68% din lead-uri" },
  { label: "Pacienți prezentați", value: "49", sub: "rată de prezență 86%" },
  { label: "Cost / Programare", value: "€11.20", sub: "-14% față de luna trecută" },
];
export const dentalTreatments = [
  { name: "Albire dentară", leads: 38, interest: 82, conversion: "Ridicată" },
  { name: "Invisalign", leads: 24, interest: 74, conversion: "Medie" },
  { name: "Implanturi", leads: 14, interest: 61, conversion: "Medie" },
  { name: "Detartraj de rutină", leads: 8, interest: 48, conversion: "Scăzută" },
];
export const dentalFunnel = [
  { label: "Lead-uri", value: 84 },
  { label: "Rezervate", value: 57 },
  { label: "Prezentați", value: 49 },
  { label: "Convertiți", value: 31 },
];
export const dentalConversion = [
  { name: "Convertiți", value: 31 },
  { name: "Programați", value: 18 },
  { name: "În cultivare", value: 35 },
];
export const dentalObjections = [
  "Îngrijorat de cost / opțiuni de finanțare",
  "Frică de durere în timpul procedurii",
  "Vrea să verifice mai întâi acoperirea asigurării",
  "Prea ocupat — vrea să amâne pentru luna viitoare",
];

/* ───────────────────────── Fitness niche (IronPeak Gym) ───────────────────────── */
export const fitnessKpis = [
  { label: "Abonamente vândute", value: "63", sub: "+21 față de mai" },
  { label: "Ședințe de trial", value: "148", sub: "rezervate din conținut" },
  { label: "Mesaje primite", value: "412", sub: "DM-uri + solicitări" },
  { label: "Membri noi (conținut)", value: "38", sub: "atribuiți videoclipurilor" },
];
export const fitnessClasses = [
  { name: "HIIT Bootcamp", signups: 84, fill: 92 },
  { name: "Spinning", signups: 72, fill: 88 },
  { name: "Forță 101", signups: 61, fill: 78 },
  { name: "Mobilitate și recuperare", signups: 39, fill: 55 },
];
export const fitnessTrend = [
  { label: "Feb", memberships: 34, trials: 90 },
  { label: "Mar", memberships: 41, trials: 104 },
  { label: "Apr", memberships: 38, trials: 98 },
  { label: "Mai", memberships: 52, trials: 126 },
  { label: "Iun", memberships: 63, trials: 148 },
];
export const trainerContent = [
  { trainer: "Vlad D.", posts: 18, avgViews: "42K", topFormat: "Transformare" },
  { trainer: "Ioana R.", posts: 14, avgViews: "31K", topFormat: "Tutorial" },
  { trainer: "Marius P.", posts: 9, avgViews: "22K", topFormat: "Întrebări și răspunsuri" },
];
export const transformations = [
  { name: "Andrei", result: "-8 kg în 12 săptămâni" },
  { name: "Maria", result: "Prima tracțiune din viață" },
  { name: "Paul", result: "Pregătit de maraton" },
];

/* ───────────────────────── Lounge niche (Lumen Lounge) ───────────────────────── */
export const loungeKpis = [
  { label: "Venituri din intrări", value: "€18.4K", sub: "+22% față de mai" },
  { label: "Mese rezervate", value: "184", sub: "84% din capacitate" },
  { label: "Înscrieri pe lista de invitați", value: "612", sub: "din conținut" },
  { label: "Bon mediu de bar", value: "€42", sub: "+8% față de luna trecută" },
];
export const loungeTraffic = [
  { label: "Lun", guests: 12 }, { label: "Mar", guests: 18 }, { label: "Mie", guests: 24 },
  { label: "Joi", guests: 78 }, { label: "Vin", guests: 142 }, { label: "Sâm", guests: 168 }, { label: "Dum", guests: 36 },
];
export const loungeNights = [
  { name: "Sâmbătă — Jazz Live", date: "21 Iun", guests: 168, revenue: "€7.4K" },
  { name: "Vineri — Open Deck", date: "20 Iun", guests: 142, revenue: "€5.8K" },
  { name: "Joi — Curs de cocktailuri", date: "19 Iun", guests: 78, revenue: "€2.1K" },
  { name: "Sâmbătă — House Night", date: "14 Iun", guests: 156, revenue: "€6.9K" },
];
export const loungeDoorFunnel = [
  { label: "Atinși", value: 92 },
  { label: "Au confirmat", value: 64 },
  { label: "Au venit", value: 42 },
  { label: "Au stat >1h", value: 36 },
];
export const loungeDjs = [
  { name: "DJ Nox", sets: 6, peakHr: "01:30" },
  { name: "Vela B2B Iris", sets: 4, peakHr: "00:45" },
  { name: "House of Mae", sets: 3, peakHr: "23:30" },
];

/* ───────────────────────── Beauty niche (AuraLux Beauty) ───────────────────────── */
export const beautyKpis = [
  { label: "Rezervări", value: "284", sub: "+34 față de mai" },
  { label: "Rată de revenire", value: "62%", sub: "+4pp" },
  { label: "Vânzări retail", value: "€6.8K", sub: "din etichetele din conținut" },
  { label: "Bon mediu", value: "€86", sub: "+€7 față de luna trecută" },
];
export const beautyServiceMix = [
  { name: "Faciale", value: 38 },
  { name: "Coafură", value: 31 },
  { name: "Gene și sprâncene", value: 18 },
  { name: "Unghii", value: 13 },
];
export const beautyTreatments = [
  { name: "Facial Glass Skin", bookings: 64, revenue: "€5.1K", waitlist: 22, trend: 28 },
  { name: "Balayage", bookings: 41, revenue: "€8.6K", waitlist: 14, trend: 12 },
  { name: "Lash Lift", bookings: 38, revenue: "€2.3K", waitlist: 6, trend: 19 },
  { name: "Manichiură rusească", bookings: 32, revenue: "€1.9K", waitlist: 4, trend: 6 },
];
export const beautyRetention = [
  { label: "Ian", clients: 88, repeat: 42 },
  { label: "Feb", clients: 102, repeat: 58 },
  { label: "Mar", clients: 118, repeat: 71 },
  { label: "Apr", clients: 130, repeat: 80 },
  { label: "Mai", clients: 152, repeat: 96 },
  { label: "Iun", clients: 184, repeat: 114 },
];
export const beautyCollabs = [
  { handle: "@ioana.glow", reach: "84K", bookings: 18 },
  { handle: "@thecitybeauty", reach: "62K", bookings: 11 },
  { handle: "@elenabeauty", reach: "41K", bookings: 7 },
];

/* ───────────────────────── Auto niche (DriveX Motors) ───────────────────────── */
export const autoKpis = [
  { label: "Test drive-uri", value: "62", sub: "+18 față de mai" },
  { label: "Vehicule vândute", value: "11", sub: "din lead-uri din conținut" },
  { label: "Zile medii în stoc", value: "26", sub: "-9 zile față de luna trecută" },
  { label: "Finanțări aprobate", value: "9", sub: "conversie 82%" },
];
export const autoInventory = [
  { name: "Audi A4 — 2024", price: 38900, daysOnLot: 12, testDrives: 14, leads: 38, status: "Fierbinte" },
  { name: "BMW X3 — 2023", price: 52400, daysOnLot: 31, testDrives: 9, leads: 22, status: "Activ" },
  { name: "Tesla Model 3 — 2024", price: 47800, daysOnLot: 8, testDrives: 18, leads: 51, status: "Fierbinte" },
  { name: "VW Golf GTI — 2022", price: 32100, daysOnLot: 44, testDrives: 6, leads: 14, status: "Învechit" },
  { name: "Skoda Octavia — 2024", price: 27600, daysOnLot: 19, testDrives: 11, leads: 24, status: "Activ" },
];
export const autoFunnel = [
  { label: "Solicitări", value: 184 },
  { label: "Calificate", value: 96 },
  { label: "Test drive-uri", value: 62 },
  { label: "Vândute", value: 11 },
];
export const autoTradeIn = [
  { make: "VW Polo — 2018", offer: "€8.4K", status: "Acceptat" },
  { make: "Renault Clio — 2019", offer: "€7.1K", status: "Contraofertă" },
  { make: "Ford Focus — 2017", offer: "€6.2K", status: "În așteptare" },
];
export const autoSalesTrend = [
  { label: "Feb", sold: 4, leads: 92 },
  { label: "Mar", sold: 6, leads: 118 },
  { label: "Apr", sold: 5, leads: 102 },
  { label: "Mai", sold: 8, leads: 156 },
  { label: "Iun", sold: 11, leads: 184 },
];

/* ───────────────────────── Hotel niche (Mare Luna Hotel) ───────────────────────── */
export const hotelKpis = [
  { label: "Grad de ocupare", value: "86%", sub: "+9pp față de mai" },
  { label: "ADR", value: "€184", sub: "tarif mediu zilnic" },
  { label: "RevPAR", value: "€158", sub: "+€18 față de luna trecută" },
  { label: "Timp mediu de rezervare", value: "12z", sub: "înainte de sejur" },
];
export const hotelOccupancy = [
  { label: "Ian", occupancy: 42, adr: 142 },
  { label: "Feb", occupancy: 48, adr: 150 },
  { label: "Mar", occupancy: 58, adr: 162 },
  { label: "Apr", occupancy: 71, adr: 174 },
  { label: "Mai", occupancy: 77, adr: 178 },
  { label: "Iun", occupancy: 86, adr: 184 },
];
export const hotelRoomMix = [
  { name: "Suită cu vedere la mare", bookings: 68, revenue: "€14.2K" },
  { name: "Dublă cu vedere la grădină", bookings: 92, revenue: "€11.8K" },
  { name: "Apartament de familie", bookings: 41, revenue: "€9.4K" },
  { name: "Penthouse", bookings: 12, revenue: "€8.6K" },
];
export const hotelChannels = [
  { name: "Direct (conținut)", value: 38 },
  { name: "Booking.com", value: 32 },
  { name: "Airbnb", value: 18 },
  { name: "Expedia", value: 12 },
];
export const hotelReviews = [
  { rating: 5, text: "Priveliștea din suită ne-a tăiat respirația — deja rezervăm pentru anul viitor.", guest: "Andrea M." },
  { rating: 5, text: "Cocktailurile la apus pe terasă sunt fără egal.", guest: "Lukas R." },
  { rating: 4, text: "Camere superbe — micul dejun ar putea fi un pic mai rapid.", guest: "Sara T." },
];

/* ───────────────────────── Local Store niche (Maple Market) ───────────────────────── */
export const localStoreKpis = [
  { label: "Trafic în magazin", value: "5.4K", sub: "+12% față de luna trecută" },
  { label: "Tranzacții", value: "1,820", sub: "+204 față de mai" },
  { label: "Coș mediu", value: "€34", sub: "+€3 față de luna trecută" },
  { label: "Înscrieri în programul de fidelitate", value: "212", sub: "din cod QR din conținut" },
];
export const localStoreTraffic = [
  { label: "Săpt. 1", visits: 1080, transactions: 412 },
  { label: "Săpt. 2", visits: 1240, transactions: 468 },
  { label: "Săpt. 3", visits: 1380, transactions: 484 },
  { label: "Săpt. 4", visits: 1700, transactions: 456 },
];
export const localStoreSkus = [
  { sku: "Miere locală 500g", units: 184, revenue: "€1.4K", trend: 32 },
  { sku: "Pâine cu maia artizanală", units: 312, revenue: "€1.9K", trend: 18 },
  { sku: "Ulei de măsline presat la rece", units: 96, revenue: "€2.1K", trend: 24 },
  { sku: "Cafea single-origin 250g", units: 142, revenue: "€1.7K", trend: 11 },
  { sku: "Ciocolată artizanală", units: 78, revenue: "€940", trend: -4 },
];
export const localStorePromos = [
  { name: "Reel cu degustare de miere", redemptions: 84, conv: "11%" },
  { name: "Cod QR Piața de sâmbătă", redemptions: 142, conv: "18%" },
  { name: "Boost de fidelitate la cafea", redemptions: 56, conv: "7%" },
];
export const localStoreClickCollect = [
  { label: "Mai", online: 84, instore: 142 },
  { label: "Iun", online: 118, instore: 198 },
];
