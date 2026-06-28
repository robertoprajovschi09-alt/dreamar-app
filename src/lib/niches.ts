// drea.mar — the niche "brain". A single source of truth per business niche that
// drives client onboarding questions, suggested monthly objectives, the monthly
// self-report fields, and the client-portal KPIs. Generated with niche-expert input,
// then curated. Editing one niche here updates onboarding + portal + objectives at once.
import type { LucideIcon } from "lucide-react";
import { Building2, UtensilsCrossed, Martini, Stethoscope, Dumbbell, Store, Scissors, Car, Hotel, LayoutGrid } from "lucide-react";

export type NicheKey =
  | "real_estate" | "restaurant" | "lounge" | "dental_clinic" | "fitness_gym"
  | "local_store" | "beauty" | "auto" | "hotel" | "custom";

export type QuestionType = "text" | "textarea" | "chips" | "select";
export type OnboardingQuestion = {
  id: string;
  label: string;
  help?: string;
  type: QuestionType;
  placeholder?: string;
  options?: string[];
};

export type MetricField =
  | "calls_received" | "relevant_dms" | "bookings" | "appointments"
  | "orders" | "sales" | "viewings" | "contracts" | "revenue_estimate";
export type Metric = { field: MetricField; label: string };

export type NicheSpec = {
  niche: NicheKey;
  displayLabel: string;
  extraQuestions: OnboardingQuestion[];
  objectivePresets: string[];
  monthlyMetrics: Metric[];
  portalKpis: Metric[];
  portalNote: string;
};

// Questions every client answers regardless of niche. brand_voice -> clients.brand_voice,
// target_audience -> clients.target_audience, top_goals -> clients.goals; the rest land in
// clients.brand_profile keyed by id.
export const SHARED_QUESTIONS: OnboardingQuestion[] = [
  { id: "brand_voice", label: "Vocea și tonul brandului", help: "Cum ar trebui să sune fiecare caption și videoclip — alege tot ce ți se potrivește.", type: "chips",
    options: ["Prietenos", "Profesional", "Jucăuș", "Premium / Lux", "Îndrăzneț și sigur", "Cald și personal", "La modă", "Minimalist", "Inspirațional", "Distractiv și relaxat"] },
  { id: "target_audience", label: "Cine sunt clienții tăi ideali?", help: "Oamenii cărora ar trebui să le vorbim în fiecare postare.", type: "textarea",
    placeholder: "ex. Familii din Cluj, 30–50 de ani, care își caută prima locuință" },
  { id: "usps", label: "Ce te face diferit?", help: "De ce te aleg clienții pe tine în locul concurenței.", type: "textarea",
    placeholder: "ex. Singura clinică din oraș cu implanturi în aceeași zi; 12 ani de recenzii de 5 stele" },
  { id: "primary_goal", label: "Obiectivul tău #1 de pe social media", help: "Vom pondera strategia spre acesta.", type: "select",
    options: ["Mai multe lead-uri și solicitări", "Mai multe rezervări / programări", "Mai multe vânzări și venituri", "Mai mult trafic / vizite", "Notorietate de brand și followeri", "Lansarea unui produs / a unei locații", "Recrutare / angajări"] },
  { id: "top_goals", label: "Cele mai importante obiective de business acum", help: "Câte unul pe rând — reușitele de ansamblu pe care le vrei în următoarele luni.", type: "textarea",
    placeholder: "Să devii clinica de referință din oraș\nSă umpli calendarul în fiecare săptămână\nSă lansezi noua locație" },
  { id: "current_offers", label: "Promoții sau oferte curente de promovat", help: "Opțional — orice vrei să evidențiem luna aceasta.", type: "textarea",
    placeholder: "ex. 20% reducere la prima vizită, înghețarea abonamentului pe vară, consultație gratuită" },
  { id: "avoid", label: "Există ceva ce ar trebui să evităm?", help: "Opțional — subiecte, cuvinte, afirmații sau concurenți de evitat.", type: "textarea",
    placeholder: "ex. Nu menționa prețurile public; evită afirmațiile medicale" },
];

export const NICHE_ICONS: Record<NicheKey, LucideIcon> = {
  real_estate: Building2, restaurant: UtensilsCrossed, lounge: Martini, dental_clinic: Stethoscope,
  fitness_gym: Dumbbell, local_store: Store, beauty: Scissors, auto: Car, hotel: Hotel, custom: LayoutGrid,
};

export const NICHE_SPECS: Record<NicheKey, NicheSpec> = {
  real_estate: {
  "niche": "real_estate",
  "displayLabel": "Imobiliare",
  "extraQuestions": [
    {
      "id": "property_types",
      "label": "Ce vinzi?",
      "help": "Alege fiecare tip de proprietate pe care îl listezi activ, ca să se potrivească conținutul cu inventarul tău real.",
      "type": "chips",
      "options": [
        "Apartamente",
        "Case / Vile",
        "Terenuri / Loturi",
        "Ansambluri noi",
        "Comercial / Birouri",
        "Închirieri",
        "Lux / Premium",
        "Case de vacanță"
      ]
    },
    {
      "id": "areas_served",
      "label": "Zone / cartiere pe care le acoperi",
      "help": "Enumeră orașele, sectoarele sau cartierele în care lucrezi — conținutul hiper-local convertește cel mai bine în imobiliare.",
      "type": "textarea",
      "placeholder": "ex. București - Pipera, Floreasca, Băneasa; plus ansambluri noi în Otopeni"
    },
    {
      "id": "price_range",
      "label": "Interval de preț tipic",
      "help": "Ne ajută să încadrăm listările, targetarea reclamelor și tipul de cumpărător căruia îi vorbim.",
      "type": "select",
      "options": [
        "Sub 100k EUR",
        "100k - 250k EUR",
        "250k - 500k EUR",
        "500k - 1M EUR",
        "Peste 1M EUR",
        "Mixt / variază mult"
      ]
    },
    {
      "id": "signature_listings",
      "label": "Listări sau ansambluri reprezentative de evidențiat",
      "help": "Numește 2-3 proprietăți sau proiecte remarcabile, cu hook-ul (preț, priveliște, finisaj, locație) în jurul căruia să construim conținutul.",
      "type": "textarea",
      "placeholder": "ex. Penthouse Sky Tower (480k EUR, terasă pe acoperiș); ansamblu nou Green Park (47 de unități de la 95k EUR)"
    },
    {
      "id": "proof_points",
      "label": "Argumente de încredere și acreditări",
      "help": "Semnale de încredere care îi fac pe cumpărători și vânzători să te aleagă — alege-le pe cele pe care le poți susține.",
      "type": "chips",
      "options": [
        "Ani de experiență",
        "Proprietăți vândute până acum",
        "Zile medii până la vânzare",
        "Listări exclusive",
        "Agenți autorizați",
        "Recenzii / testimoniale de 5 stele",
        "Expert pe piața locală",
        "Parteneriate cu dezvoltatori"
      ]
    }
  ],
  "objectivePresets": [
    "Generează 30 de lead-uri calificate de cumpărători și vânzători pe lună din social media",
    "Programează 12 vizionări de proprietăți pe lună provenite de pe Instagram și Facebook",
    "Primește 20 de apeluri de solicitare pe lună atribuite conținutului social",
    "Publică 12 reel-uri cu listări și proprietăți pe lună, ajungând la 25.000 de conturi locale",
    "Crește baza locală de followeri cu 400 de followeri relevanți pe lună",
    "Obține 4 noi programări de listare cu vânzători pe lună din DM-uri și apeluri sociale",
    "Închide 2 vânzări de proprietăți pe lună influențate de social media"
  ],
  "monthlyMetrics": [
    {
      "field": "calls_received",
      "label": "Apeluri de la cumpărători/vânzători"
    },
    {
      "field": "relevant_dms",
      "label": "DM-uri de interes pentru proprietăți"
    },
    {
      "field": "viewings",
      "label": "Vizionări programate"
    },
    {
      "field": "appointments",
      "label": "Programări de listare"
    },
    {
      "field": "contracts",
      "label": "Contracte semnate"
    },
    {
      "field": "sales",
      "label": "Proprietăți vândute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate (comision)"
    }
  ],
  "portalKpis": [
    {
      "field": "relevant_dms",
      "label": "DM-uri de interes pentru proprietăți"
    },
    {
      "field": "viewings",
      "label": "Vizionări programate"
    },
    {
      "field": "sales",
      "label": "Proprietăți vândute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate"
    }
  ],
  "portalNote": "Pune accent pe traseul lead → vizionare → vânzare: câte solicitări și DM-uri a generat conținutul, câte s-au transformat în vizionări efective și programări de listare și ce venituri estimate din comision a influențat. Clienții din imobiliare măsoară succesul prin vizionări programate și tranzacții închise, nu prin reach de suprafață, așa că ține-le pe acestea în prim-plan."
},
  restaurant: {
  "niche": "restaurant",
  "displayLabel": "Restaurant",
  "extraQuestions": [
    {
      "id": "cuisine_and_format",
      "label": "Tipul de bucătărie și formatul de servire",
      "help": "Alege tot ce se aplică — asta modelează stilul vizual și preparatele pe care le evidențiem.",
      "type": "chips",
      "options": [
        "Italiană",
        "Mediteraneană",
        "Asiatică / Sushi",
        "Burgeri și Grătar",
        "Pizza",
        "Steakhouse",
        "Fructe de mare",
        "Vegan / Pe bază de plante",
        "Cafenea / Brunch",
        "Brutărie și Patiserie",
        "Fine dining",
        "Casual dining",
        "Bar / Pub",
        "Fast casual",
        "Food truck"
      ]
    },
    {
      "id": "signature_dishes",
      "label": "Preparate și băuturi semnătură de evidențiat",
      "help": "3-6 preparate vedetă care arată grozav pe cameră și se vând bine (ex. paste cu trufe, margherita la cuptor pe lemne, platou de brunch de weekend, cocktail semnătură). Acestea devin conținutul nostru cel mai postat.",
      "type": "textarea",
      "placeholder": "ex. Margherita la cuptor pe lemne, ribeye maturat 48h, Aperol spritz, platou de brunch duminical"
    },
    {
      "id": "booking_and_ordering_channels",
      "label": "Cum rezervă și comandă clienții",
      "help": "Unde ar trebui să direcționăm fiecare postare — alege tot ce folosești, ca CTA-urile și linkurile să indice locul potrivit.",
      "type": "chips",
      "options": [
        "Rezervări telefonice",
        "Doar walk-in",
        "Rezervare online (TheFork / OpenTable / etc.)",
        "Formular de rezervare pe site",
        "DM pe Instagram / WhatsApp",
        "Livrare proprie",
        "Glovo / Bolt Food / Uber Eats",
        "La pachet / ridicare",
        "Catering și evenimente private"
      ]
    },
    {
      "id": "service_occasions",
      "label": "Intervale de servire și ocazii cheie",
      "help": "Când ai cea mai mare nevoie să umpli locurile — ca să temporizăm conținutul și promoțiile în jurul lor.",
      "type": "chips",
      "options": [
        "Prânz în timpul săptămânii",
        "Prânz de business",
        "Cină de weekend",
        "Date night",
        "Weekenduri în familie",
        "Brunch",
        "Happy hour",
        "Târziu în noapte",
        "Rezervări de grup / aniversări",
        "Evenimente private și catering",
        "Sărbători și meniuri sezoniere"
      ]
    },
    {
      "id": "proof_and_atmosphere",
      "label": "Argumente de încredere și atmosferă",
      "help": "Premii, recenzii/rating-uri, povestea bucătarului-șef, ingrediente locale, atmosfera (intim, animat, romantic, terasă/priveliște). Ce îi face pe oameni să te aleagă și să aibă încredere.",
      "type": "textarea",
      "placeholder": "ex. 4.8 pe Google (600+ recenzii), apariții în presa locală, terasă pe acoperiș, ingrediente din surse locale, bucătar-șef format la Lyon"
    }
  ],
  "objectivePresets": [
    "Crește rezervările lunare de masă cu 20% față de luna trecută",
    "Crește comenzile de livrare și la pachet cu 15% prin promoții generate din social",
    "Ajunge la 50.000 de oameni locali (pe o rază de 10km) pe Instagram și Facebook în fiecare lună",
    "Umple 30 de locuri la prânzurile slabe din timpul săptămânii prin oferte de prânz targetate",
    "Crește numărul de followeri pe Instagram cu 400 de pasionați de mâncare locali pe lună",
    "Adună 25 de recenzii noi pe Google pentru a întări dovada socială",
    "Generează 40 de DM-uri de rezervare / solicitări pe WhatsApp pe lună"
  ],
  "monthlyMetrics": [
    {
      "field": "bookings",
      "label": "Rezervări de masă"
    },
    {
      "field": "orders",
      "label": "Comenzi livrare și la pachet"
    },
    {
      "field": "calls_received",
      "label": "Apeluri de rezervare primite"
    },
    {
      "field": "relevant_dms",
      "label": "DM-uri de rezervare și solicitări"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalKpis": [
    {
      "field": "bookings",
      "label": "Rezervări de masă"
    },
    {
      "field": "orders",
      "label": "Comenzi livrare și la pachet"
    },
    {
      "field": "relevant_dms",
      "label": "Solicitări de rezervare"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri est. din social"
    }
  ],
  "portalNote": "Pune accent pe locurile umplute și comenzile generate: începe cu rezervările și comenzile de livrare/la pachet, ca proprietarul să vadă instant cum social-ul se transformă în mese ocupate și venituri. Asociază KPI-urile cu postările de preparate cu cele mai bune rezultate și cu un trend clar de la o lună la alta, ca valoarea să fie evidentă dintr-o privire."
},
  lounge: {
  "niche": "lounge",
  "displayLabel": "Lounge / Bar / Club",
  "extraQuestions": [
    {
      "id": "venue_type",
      "label": "Ce tip de local este acesta?",
      "help": "Alege varianta cea mai apropiată, ca să potrivim tonul și stilul de conținut potrivit.",
      "type": "select",
      "options": [
        "Cocktail lounge",
        "Sports bar",
        "Wine bar",
        "Pub / tavernă",
        "Rooftop bar",
        "Club de noapte",
        "Local cu muzică live",
        "Beach club / day club",
        "Lounge cu narghilea / shisha",
        "Speakeasy"
      ]
    },
    {
      "id": "signature_offerings",
      "label": "Băuturi semnătură, experiențe și ce te recomandă",
      "help": "Cocktailurile tale vedetă, pachetele de bottle service, serile tematice, vedetele din bucătărie — lucrurile despre care oamenii postează.",
      "type": "textarea",
      "placeholder": "ex. Smoked Old Fashioned, pachete de sticle de 350€, seri Afro-House vinerea, ora apusului pe rooftop, cartofi cu trufe târziu în noapte"
    },
    {
      "id": "recurring_events",
      "label": "Seri recurente și formate de evenimente",
      "help": "Selectează formatele săptămânale/lunare în jurul cărora să construim un ritm de conținut.",
      "type": "chips",
      "options": [
        "Seri de DJ",
        "Trupe live",
        "Ladies' night",
        "Happy hour",
        "Karaoke",
        "Petreceri tematice",
        "DJ invitați / headlineri",
        "Seri de trivia / quiz",
        "Brunch / day party",
        "Seară de comedie",
        "Proiecții de sport",
        "Evenimente private / corporate"
      ]
    },
    {
      "id": "booking_focus",
      "label": "Ce vrei cel mai mult ca oamenii să rezerve sau să cumpere?",
      "help": "Unde sunt banii — asta ghidează fiecare call-to-action pe care îl scriem.",
      "type": "chips",
      "options": [
        "Mese VIP / bottle service",
        "Guestlist / bilete de intrare",
        "Pachete de grup / aniversări",
        "Bilete la evenimente",
        "Închiriere privată a localului",
        "Walk-in (trafic la fața locului)",
        "Precomenzi de consumație la bar"
      ]
    },
    {
      "id": "vibe_and_crowd",
      "label": "Serile de vârf, publicul și atmosfera",
      "help": "Cele mai aglomerate seri, intervalul tipic de vârstă, dress code-ul, genurile muzicale și energia la care se pot aștepta oaspeții.",
      "type": "textarea",
      "placeholder": "ex. Joi–Sâmbătă, public 25–35, dress code smart-casual, house și R&B, rafinat dar animat, vârf între 23:00–02:00"
    }
  ],
  "objectivePresets": [
    "Generează 40+ rezervări de mese VIP / bottle service pe lună prin Instagram și DM-uri",
    "Crește înscrierile pe guestlist la 250+ pe lună din conținutul social",
    "Epuizează biletele la evenimentul principal de weekend de cel puțin 2 ori luna aceasta prin conținut promo",
    "Ajunge la 60.000+ de conturi locale (pe o rază de 20km) pe lună cu Reels și Stories",
    "Crește DM-urile și apelurile cu intenție de rezervare la 120+ pe lună",
    "Crește numărul de followeri pe Instagram ai localului cu 800+ followeri locali activi luna aceasta",
    "Umple 15+ pachete de grup / aniversări pe lună din solicitări sociale"
  ],
  "monthlyMetrics": [
    {
      "field": "relevant_dms",
      "label": "DM-uri de rezervare și guestlist"
    },
    {
      "field": "calls_received",
      "label": "Apeluri de rezervare primite"
    },
    {
      "field": "bookings",
      "label": "Rezervări de mese / VIP confirmate"
    },
    {
      "field": "orders",
      "label": "Bilete la evenimente și pachete vândute"
    },
    {
      "field": "sales",
      "label": "Total rezervări plătite"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalKpis": [
    {
      "field": "bookings",
      "label": "Rezervări de mese / VIP"
    },
    {
      "field": "relevant_dms",
      "label": "DM-uri de rezervare și guestlist"
    },
    {
      "field": "orders",
      "label": "Bilete și pachete vândute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri est. din social"
    }
  ],
  "portalNote": "Începe cu rezervările și DM-urile cu intenție de rezervare, ca localul să vadă cum social-ul aduce mese și guestlist, nu doar like-uri. Pune accent pe ritmul de weekend/evenimente — leagă reach-ul și DM-urile de rezervările confirmate și vânzările de bilete din jurul fiecărei seri principale."
},
  dental_clinic: {
  "niche": "dental_clinic",
  "displayLabel": "Clinică stomatologică",
  "extraQuestions": [
    {
      "id": "treatments_offered",
      "label": "Ce tratamente vrei să promovăm activ?",
      "help": "Alege serviciile pentru care vrei cel mai mult să umpli scaunele. Acestea ghidează temele noastre de conținut.",
      "type": "chips",
      "options": [
        "Implanturi dentare",
        "All-on-4 / arcadă completă",
        "Invisalign / gutiere transparente",
        "Aparate dentare tradiționale",
        "Albire dentară",
        "Fațete / refacerea zâmbetului",
        "Coroane și punți",
        "Tratament de canal",
        "Control general și detartraj",
        "Stomatologie pediatrică",
        "Urgențe stomatologice",
        "Tratament gingival / parodontal"
      ]
    },
    {
      "id": "hero_treatment",
      "label": "Tratamentul tău cel mai profitabil, pe care să-l promovăm cel mai intens",
      "help": "Singurul tratament de mare valoare pentru care vrei cei mai mulți pacienți noi (ex. implanturi sau Invisalign).",
      "type": "select",
      "options": [
        "Implanturi dentare",
        "All-on-4 / arcadă completă",
        "Invisalign / gutiere transparente",
        "Fațete / refacerea zâmbetului",
        "Albire dentară",
        "Îngrijire generală și de familie",
        "Controale pentru pacienți noi"
      ]
    },
    {
      "id": "service_area",
      "label": "Orașul și zonele pe care le deservești",
      "help": "Orașul clinicii tale plus cartierele sau localitățile din apropiere din care vin pacienții. Folosit pentru targetare locală.",
      "type": "text",
      "placeholder": "ex. Cluj-Napoca + Florești, Apahida, în ~30 min de mers"
    },
    {
      "id": "proof_points",
      "label": "Argumente de încredere și acreditări de evidențiat",
      "help": "Orice construiește încredere: ani de funcționare, cazuri rezolvate, înainte/după disponibile, calificările medicilor, tehnologie, recenzii/premii.",
      "type": "textarea",
      "placeholder": "ex. 12 ani de funcționare, 2.000+ implanturi montate, Dr. Pop certificat ITI, 4.9 stele pe Google (300+ recenzii), scaner CBCT propriu, bibliotecă înainte/după disponibilă"
    },
    {
      "id": "new_patient_offer",
      "label": "Ofertă pentru pacienți noi sau finanțare de promovat",
      "help": "Hook-ul pentru pacienții la prima vizită: consultație gratuită, albire cu reducere, planuri de plată pentru implanturi, finanțare 0%, asigurare acceptată.",
      "type": "textarea",
      "placeholder": "ex. Consultație implant gratuită + scanare CBCT, albire de la X, finanțare 0% pe 12 luni, majoritatea asigurărilor acceptate"
    }
  ],
  "objectivePresets": [
    "Generează 30 de solicitări de programare de la pacienți noi pe lună din social",
    "Programează 8 consultații pentru tratamente de mare valoare pe lună (implanturi, Invisalign, fațete)",
    "Generează 40 de apeluri/DM-uri pe lună din conținut organic + plătit",
    "Crește numărul de followeri locali pe Instagram și Facebook cu 250 de followeri locali relevanți pe lună",
    "Publică 16 postări/reel-uri pe lună, incluzând 4 materiale de tip înainte/după sau poveste de pacient",
    "Ajunge la 25.000 de oameni locali pe lună în zona deservită de clinică",
    "Obține 12 programări pe lună atribuibile unei singure oferte sezoniere (ex. albire sau control)"
  ],
  "monthlyMetrics": [
    {
      "field": "calls_received",
      "label": "Apeluri de la pacienți"
    },
    {
      "field": "relevant_dms",
      "label": "DM-uri și mesaje de interes pentru tratamente"
    },
    {
      "field": "appointments",
      "label": "Programări de pacienți noi"
    },
    {
      "field": "bookings",
      "label": "Consultații de mare valoare programate (implanturi/orto/fațete)"
    },
    {
      "field": "sales",
      "label": "Tratamente acceptate / începute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate de la pacienții din social"
    }
  ],
  "portalKpis": [
    {
      "field": "appointments",
      "label": "Programări de pacienți noi"
    },
    {
      "field": "calls_received",
      "label": "Apeluri de la pacienți"
    },
    {
      "field": "relevant_dms",
      "label": "Solicitări de tratamente"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate"
    }
  ],
  "portalNote": "Portalul ar trebui să înceapă cu programările de pacienți noi și cu apelurile/DM-urile care le generează, pentru că scaunele umplute sunt ceea ce contează pentru clinică. Leagă aceste solicitări de venitul estimat, ca proprietarul să vadă un ROI clar din tratamentele de mare valoare precum implanturile și Invisalign, nu doar reach sau număr de followeri."
},
  fitness_gym: {
  "niche": "fitness_gym",
  "displayLabel": "Fitness",
  "extraQuestions": [
    {
      "id": "facility_type",
      "label": "Ce tip de spațiu ești?",
      "help": "Alege varianta cea mai apropiată — modelează unghiul de conținut și tipul de dovezi pe care le evidențiem.",
      "type": "select",
      "options": [
        "Sală mare (big-box)",
        "Studio boutique",
        "CrossFit / box funcțional",
        "Studio de Yoga / Pilates",
        "Studio de personal training",
        "Sală de sporturi de contact / arte marțiale",
        "Sală exclusiv pentru femei",
        "Sală cu acces 24/7"
      ]
    },
    {
      "id": "signature_programs",
      "label": "Clase, programe sau servicii semnătură",
      "help": "Ofertele tale vedetă — cele pe care ar trebui să le evidențiem cel mai mult (ex. HYROX, spinning, Pilates reformer, PT 1:1, antrenament în grupuri mici, provocări de transformare).",
      "type": "chips",
      "options": [
        "Clase de grup",
        "Personal training (1:1)",
        "Antrenament în grupuri mici",
        "Spinning / cycling",
        "HIIT / bootcamp",
        "Pilates reformer",
        "Yoga",
        "CrossFit / funcțional",
        "Forță și condiție fizică",
        "Box / kickboxing",
        "Provocare de transformare",
        "Coaching nutrițional"
      ]
    },
    {
      "id": "trial_offer",
      "label": "Oferta ta de probă / introducere de la intrare",
      "help": "Primul pas, cât mai simplu, pe care vrei să-l facă cei mai mulți oameni. Acesta devine principalul call-to-action din conținut.",
      "type": "select",
      "options": [
        "Clasă de probă / abonament de o zi gratuit",
        "Probă gratuită de 7 zile",
        "PT introductiv / consultație gratuită",
        "Săptămână introductivă plătită (cost mic)",
        "Înscriere la provocarea de transformare",
        "Fără ofertă de probă permanentă"
      ]
    },
    {
      "id": "membership_pricing",
      "label": "Structura de abonamente și prețuri",
      "help": "Aproximativ cât și cum percepi (ex. 40€/lună nelimitat, pachet 10 clase 120€, PT 50€/ședință, taxă de înscriere). Ne ajută să încadrăm valoarea și să decidem când afișăm prețul.",
      "type": "textarea",
      "placeholder": "ex. Nelimitat 49€/lună, pachet 10 clase 110€, PT 55€/ședință, fără taxă de înscriere până la sfârșitul lunii"
    },
    {
      "id": "social_proof",
      "label": "Argumente de încredere și credibilitate",
      "help": "Rezultatele membrilor, calificările antrenorilor, ani de funcționare, mărimea comunității, recenzii — dovezile care îi fac pe oameni să aibă încredere.",
      "type": "textarea",
      "placeholder": "ex. 400+ membri, antrenori certificați în forță și condiție, 4.9★ pe Google (180 recenzii), 50+ transformări înainte/după"
    }
  ],
  "objectivePresets": [
    "Generează 40 de înscrieri la probă / oferta introductivă luna aceasta",
    "Generează 30 de lead-uri noi de abonament (DM-uri + formulare) pe lună",
    "Convertește 12 membri noi plătitori luna aceasta",
    "Programează 20 de consultații introductive de personal training pe lună",
    "Ajunge la 25.000 de conturi locale (pe o rază de 15km) pe lună",
    "Umple 2 provocări de grup / serii de bootcamp la capacitate maximă luna aceasta",
    "Adună 15 recenzii noi de la membri sau testimoniale video luna aceasta"
  ],
  "monthlyMetrics": [
    {
      "field": "relevant_dms",
      "label": "DM-uri de interes pentru abonamente și clase"
    },
    {
      "field": "bookings",
      "label": "Rezervări de clase de probă / introductive"
    },
    {
      "field": "appointments",
      "label": "Consultații PT programate"
    },
    {
      "field": "calls_received",
      "label": "Apeluri primite"
    },
    {
      "field": "sales",
      "label": "Abonamente noi vândute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalKpis": [
    {
      "field": "bookings",
      "label": "Rezervări de probă"
    },
    {
      "field": "sales",
      "label": "Abonamente noi"
    },
    {
      "field": "relevant_dms",
      "label": "DM-uri de interes"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri est."
    }
  ],
  "portalNote": "Pune accent pe traseul de la reach la probă la membru plătitor: începe portalul cu rezervările de probă și abonamentele noi vândute, pentru că acestea sunt ceea ce proprietarii echivalează cu un program care funcționează. Menține focusul pe volumul de lead-uri locale și pe conversie, nu pe reach de suprafață, și scoate în evidență rezultatele și testimonialele membrilor ca dovadă că conținutul generează înscrieri reale."
},
  local_store: {
  "niche": "local_store",
  "displayLabel": "Magazin local / Retail",
  "extraQuestions": [
    {
      "id": "product_categories",
      "label": "Ce vinzi? Categoriile principale de produse",
      "help": "Alege categoriile care îți aduc cea mai mare parte din venituri, ca să evidențiem produsele potrivite.",
      "type": "chips",
      "options": [
        "Modă și îmbrăcăminte",
        "Încălțăminte",
        "Bijuterii și accesorii",
        "Casă și decor",
        "Mobilier",
        "Beauty și cosmetice",
        "Sănătate și suplimente",
        "Cadouri și papetărie",
        "Jucării și copii",
        "Electronice și gadgeturi",
        "Cărți și hobby",
        "Articole pentru animale",
        "Mâncare și băutură de specialitate",
        "Flori și plante",
        "Sport și outdoor",
        "Bricolaj și DIY"
      ]
    },
    {
      "id": "hero_products",
      "label": "Produse semnătură / vedetă de evidențiat",
      "help": "Bestsellerele tale, liniile exclusive sau produsele vedetă pe care ar trebui să le tot punem în fața oamenilor, cu prețuri aproximative.",
      "type": "textarea",
      "placeholder": "ex. genți din piele handmade (300-500 RON), setul cadou de lumânări, blendul nostru exclusiv de cafea locală..."
    },
    {
      "id": "locations_areas",
      "label": "Locațiile magazinului și zonele pe care le deservești",
      "help": "Fiecare adresă fizică plus cartierele/localitățile din care vin majoritatea clienților și zilele tale cele mai aglomerate sau vârfurile sezoniere. Ghidează geo-targetarea locală și momentul.",
      "type": "textarea",
      "placeholder": "ex. Str. Victoriei 12, Cluj-Napoca; clienți mai ales din centru + Mărăști. Weekendurile cele mai aglomerate, vârf mare în decembrie."
    },
    {
      "id": "sales_channels",
      "label": "Cum cumpără clienții de la tine",
      "help": "Unde se întâmplă efectiv vânzarea, ca fiecare postare să indice acțiunea potrivită.",
      "type": "chips",
      "options": [
        "În magazin / walk-in",
        "Magazin online / website",
        "Click & collect",
        "Livrare locală",
        "Livrare la nivel național",
        "Comandă prin DM",
        "Comenzi pe WhatsApp",
        "Marketplace (eMAG, etc.)"
      ]
    },
    {
      "id": "proof_points",
      "label": "Argumente de încredere și semnale de credibilitate",
      "help": "Ani de funcționare, premii, numărul de clienți mulțumiți, recenzii, reputație locală — credibilitatea pe care o putem evidenția.",
      "type": "textarea",
      "placeholder": "ex. Deschis din 2009, 4.8 stele / 600+ recenzii Google, votat cel mai bun magazin de cadouri din oraș în 2024, afacere de familie."
    }
  ],
  "objectivePresets": [
    "Generează 300+ vizite de profil și 40+ click-uri pe site/hartă magazin pe lună din audiențe locale",
    "Generează 25+ solicitări calificate de produse prin DM, WhatsApp sau comentarii în fiecare lună",
    "Promovează 2 oferte lunare/noutăți și atribuie 30+ folosiri în magazin (menționează postarea / cupon din story)",
    "Crește baza locală de followeri cu 150-250 de followeri cu adevărat locali pe lună",
    "Ajunge la 8.000+ conturi din zona de acoperire a magazinului în fiecare lună",
    "Publică 12-16 postări plus 20+ story-uri lunar, cu cel puțin 4 videoclipuri scurte (Reels) care prezintă produsele",
    "Atinge 15+ comenzi click-and-collect sau online atribuibile social-ului în fiecare lună"
  ],
  "monthlyMetrics": [
    {
      "field": "relevant_dms",
      "label": "Solicitări de produse (DM-uri / WhatsApp)"
    },
    {
      "field": "calls_received",
      "label": "Apeluri către magazin"
    },
    {
      "field": "orders",
      "label": "Comenzi online și click-and-collect"
    },
    {
      "field": "sales",
      "label": "Vânzări în magazin din social (cupon / mențiune)"
    },
    {
      "field": "bookings",
      "label": "Rezervări și produse puse deoparte"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalKpis": [
    {
      "field": "relevant_dms",
      "label": "Solicitări de produse"
    },
    {
      "field": "orders",
      "label": "Comenzi"
    },
    {
      "field": "sales",
      "label": "Vânzări în magazin din social"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate"
    }
  ],
  "portalNote": "Pune accent pe legătura dintre reach-ul local și acțiunea din lumea reală: trafic la fața locului și vânzări în magazin alături de comenzile online, ca proprietarul să vadă cum social-ul aduce oameni pe ușă, nu doar like-uri. Ține produsele vedetă și ofertele curente în prim-plan și formulează rezultatele în bani (venituri estimate), pentru că proprietarii de retail gândesc în vânzări, nu în impresii."
},
  beauty: {
  "niche": "beauty",
  "displayLabel": "Beauty / Salon",
  "extraQuestions": [
    {
      "id": "services_offered",
      "label": "Ce servicii oferi?",
      "help": "Alege toate categoriile de tratamente pe care vrei să le promovăm. Ghidează ce evidențiem.",
      "type": "chips",
      "options": [
        "Tuns și coafat",
        "Vopsit și balayage",
        "Extensii de păr",
        "Keratină / îndreptare",
        "Unghii (mani / pedi)",
        "Gel / acril / BIAB",
        "Gene (extensii / lifting)",
        "Sprâncene (conturare / laminare / vopsire)",
        "Tratamente faciale și îngrijirea pielii",
        "Epilare cu ceară / sugaring",
        "Machiaj / mireasă",
        "Microblading / PMU",
        "Injectabile / estetică",
        "Laser / IPL",
        "Masaj / spa"
      ]
    },
    {
      "id": "signature_treatments",
      "label": "Tratamente semnătură și vedetă",
      "help": "Cele 2-4 servicii ale tale cele mai cunoscute sau mai profitabile — cele pe care ar trebui să le împingem cel mai tare (ex. 'Transformări balayage', 'Gene Russian volume', 'HydraFacial').",
      "type": "textarea",
      "placeholder": "ex. Balayage lived-in, gene Russian volume, HydraFacial semnătură..."
    },
    {
      "id": "price_positioning",
      "label": "Poziționare de preț",
      "help": "Cât de premium ești? Stabilește tonul și ce oferte rulăm.",
      "type": "select",
      "options": [
        "Buget / accesibil",
        "Mediu",
        "Premium",
        "Lux / high-end"
      ]
    },
    {
      "id": "service_area",
      "label": "Locații și zone deservite",
      "help": "Adresa(ele) salonului plus cartierele, localitățile sau codurile poștale din care îți atragi clienții. Geo-targetăm conținutul către acestea.",
      "type": "textarea",
      "placeholder": "ex. Studio în centrul Cluj-Napoca; clienți din Mărăști, Gheorgheni, Florești..."
    },
    {
      "id": "booking_and_proof",
      "label": "Cum rezervă clienții + argumentele tale de încredere",
      "help": "Linkul/sistemul tău de rezervare (Fresha, Booksy, telefon, DM) și acreditările/dovezile pe care le putem evidenția — ani de funcționare, premii, certificări de brand, număr de recenzii/rating.",
      "type": "textarea",
      "placeholder": "ex. Rezervă prin linkul Fresha din bio; 8 ani de funcționare, 4.9★ pe Google (320+ recenzii), colorist certificat L'Oréal, Wella Master..."
    }
  ],
  "objectivePresets": [
    "Generează 40+ cereri noi de rezervare pe lună prin DM-uri pe Instagram și TikTok și prin linkul de rezervare",
    "Crește numărul de followeri locali pe Instagram cu 250 de followeri calificați din zona deservită în fiecare lună",
    "Publică 12 materiale de conținut din salon (8 Reels + 4 carusele) care prezintă transformări",
    "Ajunge la 25.000 de conturi locale pe lună cu Reels geo-targetate",
    "Umple zilele lente din săptămână — generează 15 rezervări la mijlocul săptămânii prin oferte limitate",
    "Adună 20 de recenzii noi de 5 stele pe Google/Booksy pe lună de la clienți mulțumiți",
    "Promovează un tratament semnătură până la 30 de programări în luna respectivă"
  ],
  "monthlyMetrics": [
    {
      "field": "relevant_dms",
      "label": "DM-uri de interes pentru rezervări"
    },
    {
      "field": "calls_received",
      "label": "Apeluri primite"
    },
    {
      "field": "bookings",
      "label": "Programări făcute"
    },
    {
      "field": "appointments",
      "label": "Programări finalizate"
    },
    {
      "field": "sales",
      "label": "Clienți noi la prima vizită"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalKpis": [
    {
      "field": "relevant_dms",
      "label": "DM-uri de interes pentru rezervări"
    },
    {
      "field": "bookings",
      "label": "Programări făcute"
    },
    {
      "field": "sales",
      "label": "Clienți noi la prima vizită"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalNote": "Pune accent pe rezervările generate de social — începe portalul cu DM-urile de interes și programările făcute, apoi leagă-le de clienții noi la prima vizită și de venitul estimat, ca proprietarul salonului să vadă o cale clară de la conținut la timpul petrecut în scaun. Asociază cifrele cu Reels-urile de transformare cu cele mai bune rezultate ale lunii, ca să vadă exact ce conținut a umplut calendarul."
},
  auto: {
  "niche": "auto",
  "displayLabel": "Auto",
  "extraQuestions": [
    {
      "id": "business_type",
      "label": "Ce tip de afacere auto este aceasta?",
      "help": "Alege tot ce se aplică — unghiurile de conținut diferă mult între vânzarea de mașini și service-ul lor.",
      "type": "chips",
      "options": [
        "Dealer de mașini noi",
        "Dealer de mașini second-hand",
        "Dealer multi-brand",
        "Service și reparații",
        "Vulcanizare și jante",
        "Tinichigerie / detailing",
        "Spălătorie auto",
        "Piese și accesorii",
        "Specialist EV",
        "Închiriere / leasing"
      ]
    },
    {
      "id": "brands_inventory",
      "label": "Ce branduri sau tipuri de vehicule comercializezi?",
      "help": "Enumeră mărcile pe care le vinzi sau pe care te specializezi (ex. Dacia, VW, BMW) și notează SUV-uri / dube / electrice / 4x4 dacă e relevant. Ghidează mașinile pe care le evidențiem.",
      "type": "textarea",
      "placeholder": "ex. Dacia și Renault noi, VW/Skoda second-hand sub 15k€, gamă EV în creștere (Spring, Megane E-Tech)"
    },
    {
      "id": "signature_offers",
      "label": "Oferte semnătură și hook-uri pentru clienți",
      "help": "Ofertele și serviciile care atrag oamenii — acestea devin formate de postare recurente.",
      "type": "chips",
      "options": [
        "Trade-in / buy-back",
        "Finanțare 0% sau cu dobândă mică",
        "Test drive gratuit la domiciliu",
        "Schimb sezonier de anvelope",
        "Verificare gratuită a stării vehiculului",
        "Mașină de schimb pe durata service-ului",
        "Garanție extinsă",
        "Plan de service / abonament",
        "Inspecție pre-achiziție",
        "Perioade promoționale de la producător"
      ]
    },
    {
      "id": "service_area",
      "label": "Zona deservită și locații",
      "help": "Orașul/regiunea din care îți atragi clienții, numărul de showroom-uri sau ateliere și cât de departe vin oamenii la tine.",
      "type": "text",
      "placeholder": "ex. Cluj-Napoca + rază de 60km, 1 showroom și centru de service cu 8 boxe"
    },
    {
      "id": "proof_points",
      "label": "Argumente de încredere și acreditări",
      "help": "Semnale de încredere de inclus în conținut — ani de experiență, unități vândute, rating Google, certificări, premii.",
      "type": "textarea",
      "placeholder": "ex. 18 ani de experiență, 4.8★ (900+ recenzii Google), partener oficial de service VW, 1.200 de mașini vândute în 2025"
    }
  ],
  "objectivePresets": [
    "Generează 40 de solicitări calificate de vehicule (apeluri + DM-uri) pe lună",
    "Programează 25 de test drive-uri pe lună din canalele sociale",
    "Generează 60 de programări de service/reparații pe lună",
    "Ajunge la 30.000 de cumpărători locali în piață pe lună (rază de 25-60km)",
    "Crește numărul de followeri pe Instagram + TikTok cu 400 de followeri locali pe lună",
    "Publică 16 postări/lună, incluzând 8 reel-uri cu vehicule și 2 videoclipuri de predare către client",
    "Captează 20 de lead-uri de trade-in / evaluare pe lună"
  ],
  "monthlyMetrics": [
    {
      "field": "calls_received",
      "label": "Apeluri de la cumpărători și pentru service"
    },
    {
      "field": "relevant_dms",
      "label": "Solicitări de vehicule și rezervări (DM-uri)"
    },
    {
      "field": "appointments",
      "label": "Test drive-uri programate"
    },
    {
      "field": "bookings",
      "label": "Programări de service / reparații"
    },
    {
      "field": "sales",
      "label": "Vehicule vândute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalKpis": [
    {
      "field": "appointments",
      "label": "Test drive-uri programate"
    },
    {
      "field": "bookings",
      "label": "Programări de service"
    },
    {
      "field": "sales",
      "label": "Vehicule vândute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri est. din social"
    }
  ],
  "portalNote": "Pune accent pe funnelul complet de la reach la venituri: volumul de lead-uri (apeluri + solicitări) în partea de sus, apoi cele două căi de conversie care contează pentru un client auto — test drive-urile care duc la vânzări de vehicule și programările de service/reparații — încununate de venitul estimat, ca dealerul să vadă banii din spatele activității. Ține test drive-urile și programările de service distincte vizual, pentru că reprezintă cele două laturi ale afacerii (showroom vs. atelier)."
},
  hotel: {
  "niche": "hotel",
  "displayLabel": "Hotel / Ospitalitate",
  "extraQuestions": [
    {
      "id": "property_type",
      "label": "Tipul și mărimea proprietății",
      "help": "Ce fel de proprietate este aceasta și aproximativ câte camere are? Modelează unghiul de conținut (intim vs. la scară de resort).",
      "type": "select",
      "options": [
        "Hotel boutique",
        "Hotel urban / de business",
        "Resort la mare sau pe litoral",
        "Resort montan / de schi",
        "Hotel spa și wellness",
        "Pensiune / bed & breakfast",
        "Aparthotel / apartamente cu servicii",
        "Agroturism / refugiu la țară"
      ]
    },
    {
      "id": "signature_experiences",
      "label": "Experiențe semnătură și facilități la fața locului",
      "help": "Lucrurile pe care oaspeții și le amintesc și care fac conținut grozav: rooftop bar, spa, piscină, restaurant fine-dining, vedere la mare, saună, spațiu de evenimente.",
      "type": "chips",
      "options": [
        "Spa și wellness",
        "Piscină / piscină pe acoperiș",
        "Restaurant la fața locului",
        "Bar / rooftop bar",
        "Vedere la mare / lac",
        "Vedere la munte",
        "Mic dejun inclus",
        "Pet-friendly",
        "Parcare gratuită",
        "Spațiu de conferințe / evenimente",
        "Nunți și celebrări",
        "Facilități pentru copii / familii"
      ]
    },
    {
      "id": "booking_channel",
      "label": "Unde vrei să ajungă rezervările",
      "help": "Ca să putem direcționa oaspeții către canalul cu marja cea mai mare și să urmărim CTA-ul potrivit.",
      "type": "select",
      "options": [
        "Direct pe site-ul nostru",
        "Telefon / recepție",
        "WhatsApp sau DM",
        "Booking.com / Expedia / OTA-uri",
        "Solicitare pe email"
      ]
    },
    {
      "id": "peak_seasons_events",
      "label": "Sezoane de vârf, sezoane slabe și atracții locale",
      "help": "Lunile tale aglomerate și liniștite, plus evenimentele, festivalurile sau atracțiile din apropiere pe care le putem valorifica pentru conținut și oferte.",
      "type": "textarea",
      "placeholder": "ex. Iul-Aug vârf (sezon de mare), Noi-Feb liniștit; aproape de festivalul din centrul vechi în septembrie; pârtiile la 10 min"
    },
    {
      "id": "rooms_and_rates",
      "label": "Tipuri de camere și tarif tipic pe noapte",
      "help": "Categoriile tale de camere/apartamente și prețul mediu pe noapte, ca să se potrivească conținutul cu oaspetele și pragul de preț potrivit.",
      "type": "textarea",
      "placeholder": "ex. Dublă standard 90€, apartament cu vedere la mare 160€, cameră de familie 140€; medie 110€/noapte, minim 2 nopți vara"
    }
  ],
  "objectivePresets": [
    "Generează 40+ solicitări de rezervare directă pe lună prin DM, WhatsApp și link-in-bio",
    "Ajunge la 60.000 de călători locali și regionali pe lună cu conținut axat pe destinație",
    "Crește numărul de followeri pe Instagram cu 600 de followeri calificați pe lună din piețele-sursă vizate",
    "Publică 16 postări și 12 reel-uri pe lună care prezintă camerele, priveliștile și experiențele semnătură",
    "Umple 15 nopți-cameră suplimentare în extrasezon pe lună printr-o ofertă targetată de sezon intermediar",
    "Adună și redistribuie 10 recenzii noi de la oaspeți sau clipuri UGC pe lună ca dovadă socială",
    "Generează 1.200 de click-uri pe link pe lună către pagina de rezervare directă"
  ],
  "monthlyMetrics": [
    {
      "field": "relevant_dms",
      "label": "Solicitări de rezervare prin DM / WhatsApp"
    },
    {
      "field": "calls_received",
      "label": "Apeluri de rezervare primite"
    },
    {
      "field": "bookings",
      "label": "Rezervări directe confirmate"
    },
    {
      "field": "sales",
      "label": "Nopți-cameră vândute"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din rezervări (EUR)"
    }
  ],
  "portalKpis": [
    {
      "field": "bookings",
      "label": "Rezervări directe"
    },
    {
      "field": "relevant_dms",
      "label": "Solicitări de rezervare"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri din rezervări (EUR)"
    }
  ],
  "portalNote": "Pune accent pe cum social-ul umple camerele: solicitări de rezervare directă și rezervări confirmate generate de conținut, cu venitul estimat și nopțile-cameră pentru a dovedi ROI-ul raportat la ritmul de vârf/extrasezon al proprietății. Ține dovada socială (recenzii, UGC de la oaspeți) și rata de ocupare în extrasezon în prim-plan, pentru că acolo simt proprietarii cel mai mult impactul."
},
  custom: {
  "niche": "custom",
  "displayLabel": "Personalizat / Altele",
  "extraQuestions": [
    {
      "id": "products_services",
      "label": "Ce vinzi? (principalele produse sau servicii)",
      "help": "Enumeră ofertele tale de bază, ca să știm ce conținut să evidențiem în fiecare lună.",
      "type": "textarea",
      "placeholder": "ex. genți din piele handmade, detailing auto la fața locului, workshop-uri de contabilitate în grup..."
    },
    {
      "id": "signature_offerings",
      "label": "Oferte semnătură sau best-sellere",
      "help": "Cele 2-4 lucruri pentru care ești cunoscut și pe care vrei cel mai mult să le promovezi.",
      "type": "textarea",
      "placeholder": "ex. pachetul nostru de curățenie aprofundată de 90 de minute, monogramarea personalizată, pachetul de weekend"
    },
    {
      "id": "business_type",
      "label": "Cum cumpără clienții de la tine?",
      "help": "Alege modelul care se potrivește cel mai bine cu felul în care faci bani.",
      "type": "chips",
      "options": [
        "Walk-in / magazin fizic",
        "Cu programare",
        "Comenzi online / e-commerce",
        "Servicii la locația clientului",
        "Solicitare prin telefon / DM, apoi ofertă",
        "Membership / abonament",
        "Evenimente și rezervări",
        "Angro / B2B"
      ]
    },
    {
      "id": "service_area",
      "label": "Locații sau zone deservite",
      "help": "Orașe, cartiere sau rază de livrare — ca postările să țintească audiența locală potrivită.",
      "type": "text",
      "placeholder": "ex. Cluj-Napoca + 30km, sau livrare la nivel național"
    },
    {
      "id": "typical_customer_and_proof",
      "label": "Clientul tipic și cele mai bune argumente de încredere",
      "help": "Cine cumpără cel mai des și credibilitatea pe care o poți arăta (ani de experiență, premii, recenzii, înainte/după, clienți notabili).",
      "type": "textarea",
      "placeholder": "ex. părinți ocupați 30-45; 12 ani de experiență, 4.9 stele / 400+ recenzii, apariții în presa locală"
    }
  ],
  "objectivePresets": [
    "Generează 40+ lead-uri calificate (apeluri + DM-uri + formulare) pe lună",
    "Generează 25+ rezervări sau comenzi noi atribuite social-ului în fiecare lună",
    "Ajunge la 20.000+ conturi locale pe lună cu conținut organic",
    "Crește baza locală de followeri cu 300+ followeri relevanți pe lună",
    "Publică 16 postări on-brand pe lună (4 pe săptămână) cu calitate constantă",
    "Adună 8+ recenzii sau testimoniale noi de la clienți pe lună prin îndemnuri în postări",
    "Atinge o rată medie de engagement de 4%+ pe postările publicate"
  ],
  "monthlyMetrics": [
    {
      "field": "calls_received",
      "label": "Apeluri primite"
    },
    {
      "field": "relevant_dms",
      "label": "DM-uri și solicitări calificate"
    },
    {
      "field": "bookings",
      "label": "Rezervări făcute"
    },
    {
      "field": "orders",
      "label": "Comenzi plasate"
    },
    {
      "field": "sales",
      "label": "Clienți noi / vânzări închise"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri estimate din social"
    }
  ],
  "portalKpis": [
    {
      "field": "relevant_dms",
      "label": "DM-uri și solicitări calificate"
    },
    {
      "field": "bookings",
      "label": "Rezervări făcute"
    },
    {
      "field": "sales",
      "label": "Clienți noi"
    },
    {
      "field": "revenue_estimate",
      "label": "Venituri est. din social"
    }
  ],
  "portalNote": "Menține portalul flexibil și axat pe rezultate: începe cu KPI-urile de lead-uri și venituri care dovedesc că social-ul aduce business real, pentru că mixul exact de apeluri, DM-uri, rezervări și comenzi variază în funcție de modelul de afacere. Asociază cifrele cu un flux vizibil de conținut publicat recent, ca clientul să vadă mereu munca din spatele rezultatelor."
},
};

export function nicheSpec(niche: string | null | undefined): NicheSpec {
  return NICHE_SPECS[(niche as NicheKey)] ?? NICHE_SPECS.custom;
}

// Onboarding steps the wizard renders, grouping shared + niche-specific questions.
export function onboardingSteps(niche: string): { title: string; subtitle: string; questions: OnboardingQuestion[] }[] {
  const spec = nicheSpec(niche);
  const q = (id: string) => SHARED_QUESTIONS.find((x) => x.id === id)!;
  return [
    { title: "Despre brandul tău", subtitle: "Ca fiecare postare să sune ca tine", questions: [q("brand_voice"), q("target_audience"), q("usps")] },
    { title: "Obiectivele tale", subtitle: "Cum arată succesul", questions: [q("primary_goal"), q("top_goals")] },
    { title: `Despre afacerea ta de ${spec.displayLabel.toLowerCase()}`, subtitle: "Detaliile care fac conținutul să dea rezultate", questions: spec.extraQuestions },
    { title: "Ultimele retușuri", subtitle: "Opțional, dar util", questions: [q("current_offers"), q("avoid")] },
  ];
}

// ---- Niche "items" — the things an agency promotes for a client (properties,
// dishes, treatments…). Stored in public.niche_items (name + attributes jsonb).
// Drives the live Overview table + its add/edit form, per niche.
export type FieldType = "text" | "number" | "money" | "select";
export type ItemField = { key: string; label: string; type: FieldType; options?: string[] };
export type NicheItemConfig = { singular: string; plural: string; itemType: string; nameLabel: string; namePlaceholder: string; fields: ItemField[] };

export const NICHE_ITEMS: Record<NicheKey, NicheItemConfig> = {
  real_estate: { singular: "Proprietate", plural: "Proprietăți promovate", itemType: "property", nameLabel: "Proprietate", namePlaceholder: "ex. Sky Tower — penthouse cu 2 camere",
    fields: [
      { key: "type", label: "Tip", type: "select", options: ["Apartament", "Casă / Vilă", "Teren", "Comercial", "Ansamblu nou", "Închiriere"] },
      { key: "area", label: "Suprafață / zonă", type: "text" },
      { key: "price", label: "Preț", type: "money" },
      { key: "status", label: "Status", type: "select", options: ["Listat", "Vizionare", "În negociere", "Rezervat", "Vândut"] },
    ] },
  restaurant: { singular: "Preparat", plural: "Recomandări din meniu", itemType: "dish", nameLabel: "Preparat / băutură", namePlaceholder: "ex. Margherita la cuptor pe lemne",
    fields: [
      { key: "category", label: "Categorie", type: "select", options: ["Aperitiv", "Fel principal", "Desert", "Băutură", "Special", "Combo"] },
      { key: "price", label: "Preț", type: "money" },
      { key: "tag", label: "Etichetă", type: "select", options: ["Semnătură", "Bestseller", "Nou", "Sezonier", "Promo"] },
    ] },
  lounge: { singular: "Ofertă", plural: "Oferte și seri", itemType: "offering", nameLabel: "Ofertă", namePlaceholder: "ex. Masă VIP — Afro-House vineri",
    fields: [
      { key: "type", label: "Tip", type: "select", options: ["Cocktail", "Sticlă / VIP", "Seară de eveniment", "Pachet de masă", "Intrare / bilet"] },
      { key: "price", label: "Preț", type: "money" },
      { key: "night", label: "Când", type: "text" },
    ] },
  dental_clinic: { singular: "Tratament", plural: "Tratamente promovate", itemType: "treatment", nameLabel: "Tratament", namePlaceholder: "ex. Implant dentar unic",
    fields: [
      { key: "category", label: "Categorie", type: "select", options: ["Implanturi", "Ortodonție", "Albire", "Estetică / fațete", "General", "Urgență"] },
      { key: "price_from", label: "Preț de la", type: "money" },
      { key: "duration", label: "Durată tipică", type: "text" },
    ] },
  fitness_gym: { singular: "Program", plural: "Programe și abonamente", itemType: "program", nameLabel: "Program / abonament", namePlaceholder: "ex. Transformare în 12 săptămâni",
    fields: [
      { key: "type", label: "Tip", type: "select", options: ["Abonament", "Clasă de grup", "Personal training", "Provocare", "Nutriție"] },
      { key: "price", label: "Preț", type: "money" },
      { key: "level", label: "Nivel", type: "select", options: ["Începător", "Intermediar", "Avansat", "Toate nivelurile"] },
    ] },
  local_store: { singular: "Produs", plural: "Produse evidențiate", itemType: "product", nameLabel: "Produs", namePlaceholder: "ex. Portofel din piele handmade",
    fields: [
      { key: "category", label: "Categorie", type: "text" },
      { key: "price", label: "Preț", type: "money" },
      { key: "status", label: "Status", type: "select", options: ["În stoc", "Bestseller", "Nou", "La reducere", "Stoc epuizat"] },
    ] },
  beauty: { singular: "Serviciu", plural: "Servicii evidențiate", itemType: "service", nameLabel: "Serviciu", namePlaceholder: "ex. Balayage lived-in",
    fields: [
      { key: "category", label: "Categorie", type: "select", options: ["Păr", "Unghii", "Piele / facial", "Gene / sprâncene", "Machiaj", "Estetică", "Masaj / spa"] },
      { key: "price_from", label: "Preț de la", type: "money" },
      { key: "duration", label: "Durată tipică", type: "text" },
    ] },
  auto: { singular: "Listare", plural: "Inventar și servicii", itemType: "listing", nameLabel: "Vehicul / serviciu", namePlaceholder: "ex. BMW 320d 2021",
    fields: [
      { key: "type", label: "Tip", type: "select", options: ["Mașină nouă", "Mașină second-hand", "Service", "Piesă", "Ofertă de finanțare"] },
      { key: "price", label: "Preț", type: "money" },
      { key: "status", label: "Status", type: "select", options: ["Disponibil", "Rezervat", "Vândut", "În curs"] },
    ] },
  hotel: { singular: "Cameră / Pachet", plural: "Camere și pachete", itemType: "package", nameLabel: "Cameră / pachet", namePlaceholder: "ex. Apartament cu vedere la mare — escapadă de vară",
    fields: [
      { key: "type", label: "Tip", type: "select", options: ["Cameră", "Apartament", "Pachet", "Experiență", "Spațiu de evenimente"] },
      { key: "price", label: "Preț / noapte", type: "money" },
      { key: "status", label: "Disponibilitate", type: "text" },
    ] },
  custom: { singular: "Element", plural: "Elemente evidențiate", itemType: "item", nameLabel: "Nume", namePlaceholder: "ex. Produsul sau serviciul tău",
    fields: [
      { key: "category", label: "Categorie", type: "text" },
      { key: "price", label: "Preț", type: "money" },
      { key: "status", label: "Status", type: "text" },
    ] },
};

export function nicheItem(niche: string): NicheItemConfig {
  return NICHE_ITEMS[(niche as NicheKey)] ?? NICHE_ITEMS.custom;
}
