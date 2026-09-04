/**
 * Faurlunds Have-Partner
 * ----------------------------------------------------------------------------
 * Interaktivt 6-trins lead-modul for Faurlund Anlægsgartner ApS.
 *
 * Modulet er en pædagogisk rejse, ikke bare en prisberegner: undervejs
 * uddannes kunden i, hvad kvalitetshåndværk faktisk kræver — og hvorfor det
 * koster det, det koster.
 *
 * Afhængigheder:  react, lucide-react, tailwindcss
 * Valgfri:        jspdf  (falder pænt tilbage til console.log, hvis den mangler)
 *
 * Hele modulet ligger bevidst i én fil, så det kan droppes direkte ind i et
 * eksisterende projekt: <FaurlundHavePartner onLead={fn} />
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Hammer,
  ImagePlus,
  Info,
  Leaf,
  Lightbulb,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";

/* ==========================================================================
   1. BRAND — farver, typografi og småting hentet fra faurlund.dk
   ========================================================================== */

const BRAND = {
  green: "#4d7c0f", // knapper, primær handling
  greenDark: "#3f660c",
  greenBright: "#5a9e24", // overskrifter, logo-grøn
  lime: "#8cbe3f", // accent / streger
  sage: "#dfe6cf", // lys baggrundsblok
  sageDeep: "#cdd8b6",
  charcoal: "#454542", // footer / mørke flader
  charcoalSoft: "#5c5c58",
  paper: "#ffffff",
  muted: "#7a7a72",
};

const VIRKSOMHED = {
  navn: "Faurlund Anlægsgartner",
  citat:
    "”Rådgivningen skal være i orden og kunden skal være med i projektet fra start”",
  telefon: "+45 20 20 16 66",
  email: "jan@faurlund.dk",
  adresser: [
    { by: "Langå", vej: "Houlbjergvej 23", post: "8870 Langå" },
    { by: "Aarhus V", vej: "Oktobervej 51", post: "8210 Aarhus V" },
  ],
};

/* Skrifttyper matcher sitet: en kondenseret sans til UI/brødtekst og en
   rund geometrisk sans til de store overskrifter. Injiceres lokalt, så
   komponenten virker out-of-the-box uden ændringer i index.html.          */
const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700&family=Poppins:wght@500;600;700&display=swap');

.fhp-root {
  --fhp-green: ${BRAND.green};
  --fhp-lime: ${BRAND.lime};
  --fhp-sage: ${BRAND.sage};
  font-family: 'Barlow Condensed', 'Oswald', 'Segoe UI', system-ui, sans-serif;
  font-size: 17px;
  letter-spacing: 0.01em;
  color: ${BRAND.charcoal};
  -webkit-font-smoothing: antialiased;
}
.fhp-display {
  font-family: 'Poppins', 'Museo Sans Rounded', 'Segoe UI', system-ui, sans-serif;
  letter-spacing: -0.02em;
}
.fhp-root input,
.fhp-root button,
.fhp-root select,
.fhp-root textarea { font-family: inherit; }

/* Diskret pulserende nål, så brugeren opdager sine markeringer */
@keyframes fhpDrop { 0% { transform: translate(-50%, -140%) scale(.6); opacity: 0 } 60% { transform: translate(-50%, -95%) scale(1.12) } 100% { transform: translate(-50%, -100%) scale(1); opacity: 1 } }
.fhp-pin { animation: fhpDrop .35s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes fhpFade { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
.fhp-fade { animation: fhpFade .35s ease both; }
@media (prefers-reduced-motion: reduce) {
  .fhp-pin, .fhp-fade { animation: none !important; }
}
`;

/* ==========================================================================
   2. DATAMODEL — kategorier, materialer, arbejdsfordeling og service
   ========================================================================== */

/**
 * Kategorier man kan sætte en "nål" i på sit havebillede.
 * `rate` er en vejledende enhedspris inkl. moms ved totalentreprise.
 */
const CATEGORIES = {
  belaegning: {
    label: "Ny belægning",
    short: "Belægning",
    unit: "m²",
    rate: 2250,
    defaultQty: 40,
    color: "#8a7e6d",
    icon: Ruler,
    education: {
      title: "Vidste du?",
      body:
        "Et solidt bærelag udgør 80% af en langtidsholdbar terrasse. Vi graver altid 30-40 cm ud og opbygger med stabilgrus for at frostsikre.",
    },
  },
  traeterrasse: {
    label: "Træterrasse",
    short: "Træterrasse",
    unit: "m²",
    rate: 2650,
    defaultQty: 25,
    color: "#a4703c",
    icon: Hammer,
    education: {
      title: "Derfor holder vores terrasser",
      body:
        "Vi bygger på justerbare fødder eller punktfundamenter — aldrig direkte på jorden. Det giver luft under brædderne, så træet tørrer ud efter regn og ikke rådner nedefra.",
    },
  },
  graes: {
    label: "Ny græsplæne",
    short: "Græsplæne",
    unit: "m²",
    rate: 340,
    defaultQty: 120,
    color: "#5a9e24",
    icon: Leaf,
    education: {
      title: "Muldlaget afgør resultatet",
      body:
        "En plæne, der skal kunne tåle fodbold og tørke, kræver mindst 10-15 cm veldrænet muld. Lægger man rullegræs direkte på råjord, brænder den af den første tørre sommer.",
    },
  },
  bed: {
    label: "Bed & beplantning",
    short: "Bed",
    unit: "m²",
    rate: 900,
    defaultQty: 20,
    color: "#7a4f9c",
    icon: Sparkles,
    education: {
      title: "Rette plante, rette sted",
      body:
        "Vi vælger planter efter jordbund, lys og skygge — ikke kun efter udseende. Et bed plantet rigtigt fra start kræver markant mindre lugning og udskiftning de næste 10 år.",
    },
  },
  haek: {
    label: "Hæk",
    short: "Hæk",
    unit: "lbm",
    rate: 475,
    defaultQty: 30,
    color: "#3f7d3f",
    icon: Leaf,
    education: {
      title: "Plantetidspunktet betyder alt",
      body:
        "Barrodsplanter må kun sættes i hvileperioden fra november til marts. Plantes de rigtigt og vandes det første år, får du en tæt hæk år 3 i stedet for år 6.",
    },
  },
  mur: {
    label: "Støttemur & trapper",
    short: "Mur / trappe",
    unit: "lbm",
    rate: 4400,
    defaultQty: 8,
    color: "#5c6b7a",
    icon: Shield,
    education: {
      title: "Jordtryk er ingen spøg",
      body:
        "En støttemur skal holde på flere tons jord, der bliver tungere, når det regner. Vi fundamenterer under frostfri dybde og lægger dræn bag muren, så vandet ikke skubber den ud.",
    },
  },
  lys: {
    label: "Belysning & el",
    short: "Belysning",
    unit: "stk",
    rate: 1650,
    defaultQty: 6,
    color: "#c9a227",
    icon: Lightbulb,
    education: {
      title: "Læg kablerne før fliserne",
      body:
        "Det billigste tidspunkt at trække el i haven er, mens der alligevel er gravet op. Vi lægger altid tomrør, så du kan udvide med flere lamper senere uden at bryde belægningen op.",
    },
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

/**
 * Materialer og stilvalg. `factor` justerer enhedsprisen på den kategori,
 * materialet hører til. `blurb` er den pædagogiske tekst bag info-ikonet.
 */
const MATERIALS = [
  /* --- Belægning ------------------------------------------------------- */
  {
    id: "herregaardssten",
    cat: "belaegning",
    label: "Herregårdssten",
    tag: "Klassisk",
    factor: 1.0,
    swatch: "#9a9186",
    blurb:
      "Herregårdssten er en betonsten med fasede kanter og et roligt, tidløst udtryk. Den tåler biltrafik, kan lægges i mange forbandter og er let at optage igen, hvis der senere skal graves ned til rør.",
  },
  {
    id: "granit",
    cat: "belaegning",
    label: "Granit chaussésten",
    tag: "Eksklusiv",
    factor: 1.45,
    swatch: "#6f7276",
    blurb:
      "Granit er stort set uopslideligt og bliver kønnere med årene. Det er dyrere i både materiale og arbejdsløn, fordi hver sten sættes og bankes i hånden — til gengæld holder belægningen i generationer.",
  },
  {
    id: "betonfliser",
    cat: "belaegning",
    label: "Betonfliser, store formater",
    tag: "Moderne",
    factor: 1.15,
    swatch: "#b9b4ab",
    blurb:
      "Store fliser giver få fuger og et roligt, moderne gulv. De kræver til gengæld et ekstra præcist afretterlag — en flise på 80x80 cm afslører enhver ujævnhed i underlaget.",
  },
  {
    id: "klinker",
    cat: "belaegning",
    label: "Keramiske klinker",
    tag: "Vedligeholdelsesfri",
    factor: 1.55,
    swatch: "#8d7f74",
    blurb:
      "Keramik optager stort set intet vand. Det betyder minimal alge- og mosvækst og en flade, der kan spules ren — men fliserne er skøre under lægning og kræver et helt stabilt bærelag.",
  },
  /* --- Træterrasse ----------------------------------------------------- */
  {
    id: "cumaru",
    cat: "traeterrasse",
    label: "Cumaru hårdttræ",
    tag: "Livstidsvalg",
    factor: 1.35,
    swatch: "#8a5a2b",
    blurb:
      "Cumaru er ekstremt hårdt træ med 30+ års levetid. Kan stå ubehandlet og patinere smukt sølvgråt.",
  },
  {
    id: "laerk",
    cat: "traeterrasse",
    label: "Sibirisk lærk",
    tag: "God balance",
    factor: 1.0,
    swatch: "#c08a4e",
    blurb:
      "Lærk er et nordisk nåletræ med naturligt høj kernevedsandel. Det holder typisk 15-20 år ubehandlet og koster omkring det halve af hårdttræ — et fornuftigt valg, hvis terrassen ikke skal holde en menneskealder.",
  },
  {
    id: "komposit",
    cat: "traeterrasse",
    label: "Komposit",
    tag: "Nem pleje",
    factor: 1.2,
    swatch: "#6b6b63",
    blurb:
      "Komposit splintrer ikke og skal aldrig olieres. Til gengæld bliver den varm i solen og kan ikke slibes op — bliver den ridset, bliver den ved med at være ridset.",
  },
  /* --- Græs ------------------------------------------------------------ */
  {
    id: "rullegraes",
    cat: "graes",
    label: "Rullegræs",
    tag: "Færdig samme dag",
    factor: 1.3,
    swatch: "#4e8f27",
    blurb:
      "Rullegræs giver en færdig plæne på én dag og kan betrædes efter få uger. Prisen ligger i selve græstæppet — men du slipper for et halvt års ukrudt i en spirende såning.",
  },
  {
    id: "saaet",
    cat: "graes",
    label: "Sået græs",
    tag: "Økonomisk",
    factor: 1.0,
    swatch: "#7bb043",
    blurb:
      "Såning er markant billigere og giver et stærkere rodnet på sigt, fordi græsset gror op i sin egen jord. Kræver til gengæld tålmodighed og daglig vanding de første 4-6 uger.",
  },
  /* --- Bed ------------------------------------------------------------- */
  {
    id: "staudebed",
    cat: "bed",
    label: "Staudebed med sæsonflor",
    tag: "Frodigt",
    factor: 1.15,
    swatch: "#a05a9c",
    blurb:
      "Stauder kommer igen hvert år og bliver større. Vi sammensætter bedet, så noget blomstrer fra maj til oktober — det kræver flere plantesorter, men giver en have, der aldrig står tom.",
  },
  {
    id: "prydgraesser",
    cat: "bed",
    label: "Prydgræsser & solitærer",
    tag: "Arkitektonisk",
    factor: 1.25,
    swatch: "#b39b6a",
    blurb:
      "Græsser og enkeltstående solitærplanter giver struktur hele vinteren og bevæger sig i vinden. Færre planter pr. m² betyder mindre pasning — men de får først deres fulde udtryk efter 2-3 sæsoner.",
  },
  {
    id: "bunddaekke",
    cat: "bed",
    label: "Bunddække & barkflis",
    tag: "Lav pasning",
    factor: 0.85,
    swatch: "#6d7f52",
    blurb:
      "Et tæt bunddække udkonkurrerer ukrudtet, når det først er etableret. Vi lægger 7-10 cm flis ovenpå, så jorden holder på fugten og du slipper for at luge hver anden weekend.",
  },
  /* --- Hæk ------------------------------------------------------------- */
  {
    id: "boegehaek",
    cat: "haek",
    label: "Bøgehæk",
    tag: "Dansk klassiker",
    factor: 1.0,
    swatch: "#8a6b3d",
    blurb:
      "Bøg beholder sine visne, kobberbrune blade hele vinteren og giver derfor læ og afskærmning året rundt. Den skal klippes én gang om året — helst i juni, når fuglene er fløjet fra reden.",
  },
  {
    id: "liguster",
    cat: "haek",
    label: "Ligusterhæk",
    tag: "Hurtig",
    factor: 0.85,
    swatch: "#4f7a3a",
    blurb:
      "Liguster vokser hurtigt og er billig i indkøb — du har en tæt hæk på ganske få år. Prisen er, at den kræver klipning to gange årligt for ikke at blive gistrig forneden.",
  },
  {
    id: "thuja",
    cat: "haek",
    label: "Thuja / stedsegrøn",
    tag: "Tæt hele året",
    factor: 1.3,
    swatch: "#2f6b4a",
    blurb:
      "En stedsegrøn hæk er 100% tæt året rundt og fungerer som støjdæmpning. Husk at den ikke skyder igen fra det gamle ved — klipper man ind i det brune, bliver det brunt.",
  },
  /* --- Mur ------------------------------------------------------------- */
  {
    id: "betonmur",
    cat: "mur",
    label: "Betonstøttemur",
    tag: "Robust",
    factor: 1.0,
    swatch: "#9c9c96",
    blurb:
      "Systemblokke i beton er hurtige at rejse og meget stærke. De kan efterbeklædes senere, hvis udtrykket skal blødes op — konstruktionen er den samme.",
  },
  {
    id: "granitmur",
    cat: "mur",
    label: "Granit / natursten",
    tag: "Eksklusiv",
    factor: 1.6,
    swatch: "#6a6d70",
    blurb:
      "Natursten sættes i hånden, sten for sten, og bliver aldrig to ens mure. Det er den dyreste løsning i arbejdstid — og den eneste, der stadig ser rigtig ud om 50 år.",
  },
  {
    id: "corten",
    cat: "mur",
    label: "Cortenstål",
    tag: "Skarpt design",
    factor: 1.35,
    swatch: "#8c4a2f",
    blurb:
      "Cortenstål ruster kontrolleret og danner sit eget beskyttende lag. Det giver knivskarpe kanter og smalle bede — men vær opmærksom på, at rusten kan farve lyse fliser de første sæsoner.",
  },
  /* --- Belysning ------------------------------------------------------- */
  {
    id: "led12v",
    cat: "lys",
    label: "12V LED-spots",
    tag: "Stemning",
    factor: 1.0,
    swatch: "#d9b64a",
    blurb:
      "Lavvolt-anlæg er ufarligt at arbejde med og må lægges uden autoriseret elinstallatør. Perfekt til at lyse træer, trapper og bede op — og let at udvide senere.",
  },
  {
    id: "pullert",
    cat: "lys",
    label: "230V pullertlamper",
    tag: "Funktion",
    factor: 1.4,
    swatch: "#b8b2a4",
    blurb:
      "Pullerter giver et bredt, blændfrit lys langs stier og indkørsler. Kræver autoriseret elarbejde og nedgravet kabel i den rigtige dybde — det tager vi os af sammen med vores elektriker.",
  },
];

/** Arbejdsfordeling: hvor meget laver kunden selv? */
const WORK_LEVELS = [
  {
    id: "selv",
    title: "Du knokler lidt, vi bygger",
    subtitle: "Du rydder selv – vi udfører håndværket",
    factor: 0.8,
    icon: Hammer,
    bullets: [
      "Du fjerner eksisterende belægning, planter og græs",
      "Du graver af og bortskaffer jorden inden opstart",
      "Vi kommer, når fladen er klar, og bygger konstruktionen",
    ],
    warn: true,
  },
  {
    id: "samarbejde",
    title: "Samarbejdet",
    subtitle: "Vi bygger – du planter og rydder op",
    factor: 0.9,
    icon: Leaf,
    bullets: [
      "Vi står for udgravning, bærelag og den bærende konstruktion",
      "Du planter, fuger, koster af og rydder op efter os",
      "Vi laver en plantetegning, du kan følge",
    ],
    warn: true,
  },
  {
    id: "total",
    title: "Totalentreprise – Læn dig tilbage",
    subtitle: "Vi tager det hele, fra første spadestik til fejekost",
    factor: 1.0,
    icon: Shield,
    bullets: [
      "Vi klarer nedrivning, bortkørsel, opbygning og beplantning",
      "Én kontaktperson og én samlet tidsplan",
      "Du får haven afleveret rengjort og klar til brug",
    ],
    warn: false,
  },
];

/** Serviceaftaler — priser er vejledende pr. år inkl. moms. */
const SERVICES = [
  {
    id: "alge",
    label: "Årlig algebehandling",
    hint: "Belægning og fliser",
    base: 2400,
    perUnit: 22,
    unitCats: ["belaegning", "traeterrasse"],
    icon: Sparkles,
  },
  {
    id: "haekklip",
    label: "Hækklipning 2x årligt",
    hint: "Inkl. bortkørsel af afklip",
    base: 1400,
    perUnit: 46,
    unitCats: ["haek"],
    icon: Leaf,
  },
  {
    id: "graespleje",
    label: "Græspleje – klipning & gødning",
    hint: "Sæsonen igennem",
    base: 3200,
    perUnit: 14,
    unitCats: ["graes"],
    icon: Leaf,
  },
  {
    id: "bedpleje",
    label: "Bedpleje & lugning 4x årligt",
    hint: "Holder bedet skarpt",
    base: 2600,
    perUnit: 48,
    unitCats: ["bed"],
    icon: Sparkles,
  },
  {
    id: "vinter",
    label: "Vinterklargøring & beskæring",
    hint: "Én gang årligt i vinterhalvåret",
    base: 1900,
    perUnit: 0,
    unitCats: [],
    icon: Shield,
  },
];

/* Faurlunds tips til kundens egen indsats — ryger med i PDF'en. */
const EGEN_INDSATS_TIPS = [
  "Vand nyplantet hæk og træer grundigt én gang om ugen det første år — hellere 30 liter én gang end 5 liter hver dag.",
  "Lad være med at højtryksspule nye fliser. Det river cementhuden af overfladen, og så sætter algerne sig endnu hurtigere næste år.",
  "Kost fugesand ned i belægningen igen efter den første vinter — fugen er det, der låser stenene sammen.",
  "Klip hækken smallere foroven end forneden. Så får de nederste grene lys, og hækken bliver tæt hele vejen ned.",
  "Vent med at gøde den nye plæne til den har været klippet 2-3 gange. Ellers brænder du de unge spirer af.",
];

/* ==========================================================================
   3. PRISLOGIK (mock) — gennemsigtig og let at skifte ud med rigtige tal
   ========================================================================== */

const OPSTART_GEBYR = 6500; // opmåling, projektering, opstart og afrigning
const SPREAD_LOW = 0.92; // usikkerhed nedad
const SPREAD_HIGH = 1.14; // usikkerhed opad
const JORD_TONS_PR_M2 = 0.45; // 40 m² udgravning ≈ 18 tons jord

/** Finder den valgte materialefaktor for en kategori (1.0 hvis intet valgt). */
function materialFactorFor(catKey, selectedMaterials) {
  const m = MATERIALS.find(
    (x) => x.cat === catKey && selectedMaterials.includes(x.id)
  );
  return m ? m.factor : 1;
}

/** Beregner hele estimatet ud fra den samlede state. */
function calculateEstimate(state) {
  const { pins, materials, workLevel, services } = state;

  // 1) Læg nålene sammen pr. kategori
  const perCategory = CATEGORY_KEYS.map((key) => {
    const relevant = pins.filter((p) => p.cat === key);
    if (!relevant.length) return null;
    const qty = relevant.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
    const cat = CATEGORIES[key];
    const factor = materialFactorFor(key, materials);
    return {
      key,
      label: cat.label,
      unit: cat.unit,
      qty,
      count: relevant.length,
      factor,
      sum: qty * cat.rate * factor,
    };
  }).filter(Boolean);

  const arbejdssum = perCategory.reduce((s, c) => s + c.sum, 0);

  // 2) Arbejdsfordeling
  const level = WORK_LEVELS.find((w) => w.id === workLevel) || WORK_LEVELS[2];
  const efterFordeling = arbejdssum * level.factor;
  const egenBesparelse = arbejdssum - efterFordeling;

  // 3) Opstart lægges kun på, hvis der overhovedet er et projekt
  const total = arbejdssum > 0 ? efterFordeling + OPSTART_GEBYR : 0;

  // 4) Spænd
  const low = roundTo(total * SPREAD_LOW, 500);
  const high = roundTo(total * SPREAD_HIGH, 500);

  // 5) Serviceaftaler pr. år
  const serviceLines = SERVICES.filter((s) => services.includes(s.id)).map(
    (s) => {
      const qty = s.unitCats.reduce((sum, catKey) => {
        const c = perCategory.find((p) => p.key === catKey);
        return sum + (c ? c.qty : 0);
      }, 0);
      return { id: s.id, label: s.label, sum: s.base + qty * s.perUnit };
    }
  );
  const servicePrAar = serviceLines.reduce((s, l) => s + l.sum, 0);

  // 6) Jordmængde til forventningsafstemning i trin 3
  const udgravetM2 = perCategory
    .filter((c) => c.key === "belaegning" || c.key === "traeterrasse")
    .reduce((s, c) => s + c.qty, 0);

  return {
    perCategory,
    arbejdssum,
    level,
    egenBesparelse,
    total,
    low,
    high,
    serviceLines,
    servicePrAar: roundTo(servicePrAar, 100),
    udgravetM2,
    jordTons: Math.round(udgravetM2 * JORD_TONS_PR_M2),
  };
}

/* ==========================================================================
   4. SMÅ HJÆLPERE
   ========================================================================== */

const nf = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const kr = (n) => `${nf.format(Math.round(n || 0))} kr.`;
const roundTo = (n, step) => Math.round(n / step) * step;
const cx = (...parts) => parts.filter(Boolean).join(" ");
const uid = () => Math.random().toString(36).slice(2, 9);

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPhone = (v) => v.replace(/[^\d]/g, "").length >= 8;

/** Enkel placeholder-have, hvis brugeren ikke uploader et billede. */
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfdcc0"/><stop offset="1" stop-color="#e9eede"/>
    </linearGradient>
    <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fae4c"/><stop offset="1" stop-color="#5d8f31"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#sky)"/>
  <rect y="150" width="800" height="350" fill="url(#lawn)"/>
  <rect x="60" y="60" width="230" height="120" rx="4" fill="#cdc6ba"/>
  <path d="M40 60 L175 10 L310 60 Z" fill="#8e8477"/>
  <rect x="120" y="110" width="46" height="70" fill="#6f665b"/>
  <rect x="200" y="95" width="52" height="42" fill="#aebdc9"/>
  <path d="M300 300 Q470 250 800 285 L800 380 Q470 350 300 355 Z" fill="#b9b3a7"/>
  <path d="M300 300 Q470 250 800 285" stroke="#a49d90" stroke-width="3" fill="none"/>
  <circle cx="640" cy="150" r="62" fill="#4d7c0f"/>
  <rect x="632" y="150" width="14" height="80" fill="#6b5636"/>
  <rect x="0" y="196" width="800" height="26" fill="#3f7d3f" opacity=".85"/>
  <g fill="#456b2a" opacity=".5">
    <circle cx="120" cy="400" r="26"/><circle cx="170" cy="420" r="20"/><circle cx="80" cy="430" r="18"/>
  </g>
  <text x="400" y="470" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#ffffff" opacity=".92">
    Eksempel-have · upload dit eget billede for et præcist estimat
  </text>
</svg>`);

/* ==========================================================================
   5. GENBRUGELIGE UI-BYGGEKLODSER
   ========================================================================== */

function SectionHeading({ eyebrow, title, children }) {
  return (
    <header className="mb-6">
      {eyebrow && (
        <div className="mb-2 flex items-center gap-2">
          <span className="h-px w-8" style={{ background: BRAND.green }} />
          <span
            className="text-sm font-semibold uppercase tracking-[0.18em]"
            style={{ color: BRAND.green }}
          >
            {eyebrow}
          </span>
        </div>
      )}
      <h2
        className="fhp-display text-2xl font-bold leading-tight sm:text-3xl"
        style={{ color: BRAND.greenBright }}
      >
        {title}
      </h2>
      {children && (
        <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-stone-600">
          {children}
        </p>
      )}
    </header>
  );
}

/** Grøn "vidste du"-boks — modulets pædagogiske signatur. */
function EducationBox({ title, children, icon: Icon = Leaf, onClose }) {
  return (
    <div
      className="fhp-fade flex gap-3 rounded-lg border-l-4 p-4"
      style={{ background: BRAND.sage, borderColor: BRAND.green }}
      role="note"
    >
      <Icon
        className="mt-0.5 h-5 w-5 shrink-0"
        style={{ color: BRAND.green }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {title && (
          <p
            className="text-[15px] font-bold uppercase tracking-wider"
            style={{ color: BRAND.greenDark }}
          >
            {title}
          </p>
        )}
        <p className="mt-1 text-[16px] leading-relaxed text-stone-700">
          {children}
        </p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Luk infoboks"
          className="-mr-1 -mt-1 h-7 w-7 shrink-0 rounded text-stone-500 transition hover:bg-white/70 hover:text-stone-800"
        >
          <X className="mx-auto h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Gul/rød forventningsafstemning. */
function WarningBox({ title, children }) {
  return (
    <div
      className="fhp-fade flex gap-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4"
      role="alert"
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <div className="min-w-0">
        {title && (
          <p className="text-[15px] font-bold uppercase tracking-wider text-amber-800">
            {title}
          </p>
        )}
        <p className="mt-1 text-[16px] leading-relaxed text-amber-900">
          {children}
        </p>
      </div>
    </div>
  );
}

/** Info-ikon der folder en pædagogisk tekst ud. */
function InfoToggle({ open, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={open}
      aria-label={label}
      className={cx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
        open
          ? "border-transparent text-white"
          : "border-stone-300 bg-white text-stone-500 hover:border-stone-400 hover:text-stone-700"
      )}
      style={open ? { background: BRAND.green } : undefined}
    >
      <Info className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function PrimaryButton({ children, className, style, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-[17px] font-semibold uppercase tracking-[0.12em] text-white transition",
        "hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-300",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      style={{ background: BRAND.green, ...style }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, className, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-5 py-3 text-[17px] font-semibold uppercase tracking-[0.12em] text-stone-600 transition",
        "hover:border-stone-400 hover:text-stone-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-stone-200",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ==========================================================================
   6. PROGRESS-BAR
   ========================================================================== */

const STEP_LABELS = [
  "Kortlæg",
  "Materialer",
  "Arbejdet",
  "Fremtiden",
  "Estimat",
  "Rapport",
];

function ProgressBar({ step, maxReached, onJump }) {
  const pct = ((step + 1) / STEP_LABELS.length) * 100;
  return (
    <div className="border-b border-stone-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-baseline justify-between">
          <p
            className="text-[15px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: BRAND.green }}
          >
            Trin {step + 1} af {STEP_LABELS.length}
          </p>
          <p className="text-[15px] uppercase tracking-wider text-stone-500">
            {STEP_LABELS[step]}
          </p>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEP_LABELS.length}
          aria-valuenow={step + 1}
          aria-label="Fremdrift"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${BRAND.green}, ${BRAND.lime})`,
            }}
          />
        </div>

        {/* Trin-prikker: skjult på de mindste skærme for at holde luften */}
        <ol className="mt-3 hidden justify-between sm:flex">
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            const clickable = i <= maxReached;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onJump(i)}
                  className={cx(
                    "group flex items-center gap-2 rounded px-1 py-0.5 text-[14px] uppercase tracking-wider transition",
                    clickable ? "cursor-pointer" : "cursor-default",
                    active
                      ? "font-bold"
                      : done
                      ? "text-stone-500 hover:text-stone-800"
                      : "text-stone-300"
                  )}
                  style={active ? { color: BRAND.green } : undefined}
                >
                  <span
                    className={cx(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                      active || done ? "text-white" : "bg-stone-200 text-stone-400"
                    )}
                    style={
                      active || done ? { background: BRAND.green } : undefined
                    }
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ==========================================================================
   TRIN 1 — Kortlæg projektet
   ========================================================================== */

function Step1Kortlaeg({ state, update }) {
  const { image, pins, activeCat } = state;
  const [lastPinnedCat, setLastPinnedCat] = useState(null);
  const fileRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    update({ image: url, imageName: file.name });
  };

  const placePin = (e) => {
    if (!image || !activeCat) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const cat = CATEGORIES[activeCat];
    update({
      pins: [
        ...pins,
        { id: uid(), cat: activeCat, x, y, qty: cat.defaultQty, note: "" },
      ],
    });
    setLastPinnedCat(activeCat);
  };

  const removePin = (id) => update({ pins: pins.filter((p) => p.id !== id) });

  const setQty = (id, qty) =>
    update({
      pins: pins.map((p) =>
        p.id === id ? { ...p, qty: qty === "" ? "" : Math.max(0, Number(qty)) } : p
      ),
    });

  const eduCat = lastPinnedCat ? CATEGORIES[lastPinnedCat] : null;

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Trin 1" title="Kortlæg dit projekt">
        Tag et billede af haven — eller upload en tegning. Sæt derefter en nål
        dér, hvor arbejdet skal ske. Jo flere nåle, jo mere præcist bliver dit
        estimat.
      </SectionHeading>

      {/* --- Upload ------------------------------------------------------ */}
      {!image ? (
        <div
          className="rounded-xl border-2 border-dashed p-8 text-center sm:p-12"
          style={{ borderColor: BRAND.sageDeep, background: "#fbfcf8" }}
        >
          <ImagePlus
            className="mx-auto h-12 w-12"
            style={{ color: BRAND.lime }}
            aria-hidden="true"
          />
          <p className="fhp-display mt-4 text-lg font-semibold text-stone-800">
            Upload et billede af din have
          </p>
          <p className="mx-auto mt-1 max-w-md text-stone-500">
            Stå gerne så du får hele arealet med. Vi bruger billedet til at
            forstå adgangsforhold, fald og eksisterende beplantning.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-5 w-5" /> Vælg billede
            </PrimaryButton>
            <GhostButton
              onClick={() =>
                update({ image: PLACEHOLDER_IMAGE, imageName: "Eksempel-have" })
              }
            >
              Brug eksempel-have
            </GhostButton>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <p className="mt-4 text-[15px] text-stone-400">
            Billedet forlader ikke din browser, før du selv sender rapporten.
          </p>
        </div>
      ) : (
        <>
          {/* --- Kategori-palet ------------------------------------------ */}
          <div>
            <p className="mb-2 text-[15px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              1. Vælg hvad du vil markere
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_KEYS.map((key) => {
                const cat = CATEGORIES[key];
                const Icon = cat.icon;
                const active = activeCat === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ activeCat: active ? null : key })}
                    aria-pressed={active}
                    className={cx(
                      "flex items-center gap-2 rounded-full border px-4 py-2 text-[16px] font-medium transition",
                      active
                        ? "border-transparent text-white shadow-sm"
                        : "border-stone-300 bg-white text-stone-600 hover:border-stone-400"
                    )}
                    style={active ? { background: BRAND.green } : undefined}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* --- Billede med nåle ---------------------------------------- */}
          <div>
            <p className="mb-2 text-[15px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              2. Klik på billedet for at sætte nålen
            </p>
            <div
              onClick={placePin}
              className={cx(
                "relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 select-none",
                activeCat ? "cursor-crosshair" : "cursor-default"
              )}
            >
              <img
                src={image}
                alt="Din have"
                className="block w-full"
                draggable={false}
              />

              {!activeCat && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-center">
                  <p className="text-[16px] font-medium text-white">
                    Vælg en kategori ovenfor for at sætte en nål
                  </p>
                </div>
              )}

              {pins.map((pin, i) => {
                const cat = CATEGORIES[pin.cat];
                const Icon = cat.icon;
                return (
                  <span
                    key={pin.id}
                    className="fhp-pin absolute flex flex-col items-center"
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                      transform: "translate(-50%, -100%)",
                    }}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-lg"
                      style={{ background: cat.color }}
                      title={`${i + 1}. ${cat.label}`}
                    >
                      <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                    </span>
                    <span
                      className="h-3 w-0.5"
                      style={{ background: cat.color }}
                    />
                  </span>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[15px] text-stone-500">
              <span>
                {pins.length === 0
                  ? "Ingen nåle sat endnu"
                  : `${pins.length} ${
                      pins.length === 1 ? "nål" : "nåle"
                    } placeret`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (objectUrlRef.current) {
                    URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = null;
                  }
                  update({ image: null, imageName: "", pins: [] });
                  setLastPinnedCat(null);
                }}
                className="underline underline-offset-4 hover:text-stone-800"
              >
                Skift billede
              </button>
            </div>
          </div>

          {/* --- Pædagogisk pop-op --------------------------------------- */}
          {eduCat && (
            <EducationBox
              title={eduCat.education.title}
              icon={eduCat.icon}
              onClose={() => setLastPinnedCat(null)}
            >
              {eduCat.education.body}
            </EducationBox>
          )}

          {/* --- Nålelisten med mængder ---------------------------------- */}
          {pins.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-100 px-4 py-3">
                <p className="text-[15px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  3. Sæt cirka-mængderne
                </p>
                <p className="text-[15px] text-stone-400">
                  Gæt roligt — vi måler op på stedet, inden vi giver en fast pris.
                </p>
              </div>
              <ul className="divide-y divide-stone-100">
                {pins.map((pin, i) => {
                  const cat = CATEGORIES[pin.cat];
                  const Icon = cat.icon;
                  return (
                    <li
                      key={pin.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                        style={{ background: cat.color }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-2 font-medium text-stone-700">
                        <Icon className="h-4 w-4 text-stone-400" aria-hidden="true" />
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <label className="flex items-center gap-2">
                        <span className="sr-only">
                          Mængde for {cat.label} i {cat.unit}
                        </span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={pin.qty}
                          onChange={(e) => setQty(pin.id, e.target.value)}
                          className="w-24 rounded-md border border-stone-300 px-3 py-2 text-right tabular-nums focus:border-lime-600 focus:outline-none focus:ring-2 focus:ring-lime-200"
                        />
                        <span className="w-10 text-[15px] text-stone-500">
                          {cat.unit}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removePin(pin.id)}
                        aria-label={`Fjern nål ${i + 1}`}
                        className="rounded p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   TRIN 2 — Materialevalg og stil
   ========================================================================== */

function MaterialCard({ material, selected, onSelect, openInfo, onToggleInfo }) {
  return (
    <div
      className={cx(
        "flex flex-col overflow-hidden rounded-xl border-2 bg-white transition",
        selected
          ? "shadow-md"
          : "border-stone-200 hover:border-stone-300 hover:shadow-sm"
      )}
      style={selected ? { borderColor: BRAND.green } : undefined}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="relative block h-24 w-full focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-300"
        style={{
          background: `linear-gradient(135deg, ${material.swatch} 0%, ${material.swatch}cc 55%, ${material.swatch}88 100%)`,
        }}
      >
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[13px] font-semibold uppercase tracking-wider text-stone-700">
          {material.tag}
        </span>
        {selected && (
          <span
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-white shadow"
            style={{ background: BRAND.green }}
          >
            <Check className="h-4 w-4" />
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 flex-1 text-left"
          >
            <p className="fhp-display text-[17px] font-semibold leading-snug text-stone-800">
              {material.label}
            </p>
            <p className="mt-0.5 text-[15px] text-stone-500">
              {material.factor === 1
                ? "Basisniveau"
                : material.factor > 1
                ? `+${Math.round((material.factor - 1) * 100)} % på prisen`
                : `${Math.round((material.factor - 1) * 100)} % på prisen`}
            </p>
          </button>
          <InfoToggle
            open={openInfo}
            onToggle={onToggleInfo}
            label={`Læs om ${material.label}`}
          />
        </div>

        {openInfo && (
          <p
            className="fhp-fade mt-3 rounded-lg p-3 text-[16px] leading-relaxed text-stone-700"
            style={{ background: BRAND.sage }}
          >
            {material.blurb}
          </p>
        )}
      </div>
    </div>
  );
}

function Step2Materialer({ state, update }) {
  const { pins, materials } = state;
  const [openInfo, setOpenInfo] = useState(null);

  // Vis kun de materialegrupper, der er relevante for kundens nåle.
  const activeCats = useMemo(() => {
    const fromPins = CATEGORY_KEYS.filter((k) => pins.some((p) => p.cat === k));
    return fromPins.length ? fromPins : CATEGORY_KEYS;
  }, [pins]);

  const toggleMaterial = (mat) => {
    const others = materials.filter((id) => {
      const m = MATERIALS.find((x) => x.id === id);
      return m && m.cat !== mat.cat;
    });
    const alreadySelected = materials.includes(mat.id);
    update({ materials: alreadySelected ? others : [...others, mat.id] });
  };

  return (
    <div className="space-y-8">
      <SectionHeading eyebrow="Trin 2" title="Materialer og stil">
        Materialet afgør både prisen og hvor længe haven holder. Tryk på
        info-ikonet ved hvert kort — så fortæller vi, hvad du reelt får for
        pengene.
      </SectionHeading>

      {activeCats.map((catKey) => {
        const cat = CATEGORIES[catKey];
        const Icon = cat.icon;
        const list = MATERIALS.filter((m) => m.cat === catKey);
        if (!list.length) return null;
        return (
          <section key={catKey}>
            <h3 className="mb-3 flex items-center gap-2 text-[18px] font-semibold uppercase tracking-[0.12em] text-stone-700">
              <Icon className="h-5 w-5" style={{ color: BRAND.green }} />
              {cat.label}
            </h3>
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  selected={materials.includes(m.id)}
                  onSelect={() => toggleMaterial(m)}
                  openInfo={openInfo === m.id}
                  onToggleInfo={() =>
                    setOpenInfo((cur) => (cur === m.id ? null : m.id))
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      <EducationBox title="Faurlunds anbefaling" icon={Lightbulb}>
        Spar hellere på antallet af kvadratmeter end på kvaliteten af dem. En
        lille terrasse i ordentligt materiale med et rigtigt bærelag er en bedre
        investering end en stor flade, der skal rettes op om fem år.
      </EducationBox>
    </div>
  );
}

/* ==========================================================================
   TRIN 3 — Arbejdsfordelingen
   ========================================================================== */

function Step3Arbejde({ state, update, estimate }) {
  const { workLevel } = state;
  const valgt = WORK_LEVELS.find((w) => w.id === workLevel);
  const jord = estimate.jordTons;

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Trin 3" title="Hvem laver hvad?">
        Du kan spare penge ved at tage en del af arbejdet selv. Men vær ærlig
        omkring, hvad du har tid og maskiner til — det er her, de fleste
        haveprojekter går i stå.
      </SectionHeading>

      <div className="grid gap-4 lg:grid-cols-3">
        {WORK_LEVELS.map((level, i) => {
          const Icon = level.icon;
          const active = workLevel === level.id;
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => update({ workLevel: level.id })}
              aria-pressed={active}
              className={cx(
                "flex h-full flex-col rounded-xl border-2 bg-white p-5 text-left transition",
                active
                  ? "shadow-md"
                  : "border-stone-200 hover:border-stone-300 hover:shadow-sm"
              )}
              style={active ? { borderColor: BRAND.green } : undefined}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-lg"
                  style={{
                    background: active ? BRAND.green : BRAND.sage,
                    color: active ? "#fff" : BRAND.greenDark,
                  }}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-stone-400">
                  Niveau {i + 1}
                </span>
              </div>

              <p className="fhp-display text-[19px] font-semibold leading-snug text-stone-800">
                {level.title}
              </p>
              <p className="mt-1 text-[16px] text-stone-500">{level.subtitle}</p>

              <ul className="mt-4 flex-1 space-y-2">
                {level.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-[16px] text-stone-600">
                    <Check
                      className="mt-1 h-4 w-4 shrink-0"
                      style={{ color: BRAND.lime }}
                      aria-hidden="true"
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <p
                className="mt-4 border-t border-stone-100 pt-3 text-[16px] font-semibold uppercase tracking-wider"
                style={{ color: BRAND.green }}
              >
                {level.factor === 1
                  ? "Fuld pris – intet ansvar hos dig"
                  : `Du sparer ca. ${Math.round((1 - level.factor) * 100)} %`}
              </p>
            </button>
          );
        })}
      </div>

      {valgt?.warn && (
        <WarningBox title="Forventningsafstemning">
          Advarsel: At grave ud til f.eks. 40m2 belægning svarer til at håndtere
          og bortskaffe ca. 18 tons jord. Det kræver maskiner eller ekstremt god
          fysik.
          {jord > 0 && (
            <>
              {" "}
              <strong>
                På dit projekt taler vi om ca. {nf.format(jord)} tons jord
              </strong>{" "}
              — det svarer til omkring {Math.max(1, Math.round(jord / 3.5))}{" "}
              containere, der skal køres væk.
            </>
          )}
        </WarningBox>
      )}

      {valgt?.id === "total" && (
        <EducationBox title="Det betyder totalentreprise" icon={Shield}>
          Vi står med hele ansvaret — også for det, ingen kunne se på forhånd.
          Dukker der en gammel betonsål eller et rør op under udgravningen, er
          det vores opgave at løse det, ikke din.
        </EducationBox>
      )}
    </div>
  );
}

/* ==========================================================================
   TRIN 4 — Fremtidssikring
   ========================================================================== */

function Step4Service({ state, update, estimate }) {
  const { services } = state;

  const toggle = (id) =>
    update({
      services: services.includes(id)
        ? services.filter((s) => s !== id)
        : [...services, id],
    });

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Trin 4" title="Fremtidssikring af haven">
        En have er ikke færdig, når vi kører hjem. Vælg de opgaver, du hellere
        vil lade os om — så bevarer anlægget sin værdi år efter år.
      </SectionHeading>

      <EducationBox title="Flisepest og andre fjender" icon={Sparkles}>
        Nye fliser er modtagelige for flisepest. En årlig algebehandling
        forsegler overfladen og forlænger levetiden.
      </EducationBox>

      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICES.map((s) => {
          const Icon = s.icon;
          const checked = services.includes(s.id);
          const line = estimate.serviceLines.find((l) => l.id === s.id);
          return (
            <label
              key={s.id}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-white p-4 transition",
                checked ? "shadow-sm" : "border-stone-200 hover:border-stone-300"
              )}
              style={checked ? { borderColor: BRAND.green } : undefined}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(s.id)}
                className="sr-only"
              />
              <span
                className={cx(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition",
                  checked ? "border-transparent" : "border-stone-300 bg-white"
                )}
                style={checked ? { background: BRAND.green } : undefined}
                aria-hidden="true"
              >
                {checked && <Check className="h-4 w-4 text-white" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: BRAND.green }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-stone-800">{s.label}</span>
                </span>
                <span className="mt-0.5 block text-[15px] text-stone-500">
                  {s.hint}
                </span>
                {checked && line && (
                  <span
                    className="mt-2 block text-[16px] font-semibold"
                    style={{ color: BRAND.green }}
                  >
                    ca. {kr(line.sum)} / år
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-5 py-4"
        style={{ background: BRAND.sage }}
      >
        <span className="text-[17px] font-semibold uppercase tracking-wider text-stone-700">
          Serviceaftale i alt
        </span>
        <span
          className="fhp-display text-2xl font-bold"
          style={{ color: BRAND.greenDark }}
        >
          {estimate.servicePrAar > 0 ? `${kr(estimate.servicePrAar)} / år` : "—"}
        </span>
      </div>

      <p className="text-[16px] text-stone-500">
        Serviceaftalen er valgfri, holdes adskilt fra anlægsprisen og kan opsiges
        med en sæsons varsel.
      </p>
    </div>
  );
}

/* ==========================================================================
   TRIN 5 — Prisestimatet afsløres
   ========================================================================== */

function Step5Estimat({ state, estimate }) {
  const { level } = estimate;

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Trin 5" title="Dit prisestimat">
        Her er tallet — før vi beder om noget som helst fra dig. Sådan arbejder
        vi: rådgivningen skal være i orden, og du skal være med i projektet fra
        start.
      </SectionHeading>

      {/* --- Det store tal ------------------------------------------------ */}
      <div
        className="rounded-2xl p-6 text-center text-white sm:p-10"
        style={{
          background: `linear-gradient(135deg, ${BRAND.charcoal} 0%, #35352f 100%)`,
        }}
      >
        <p className="text-[16px] font-semibold uppercase tracking-[0.24em] text-stone-300">
          Dit projekt-estimat
        </p>

        {estimate.total > 0 ? (
          <>
            <p className="fhp-display mt-3 text-3xl font-bold leading-tight sm:text-5xl">
              <span style={{ color: BRAND.lime }}>{nf.format(estimate.low)}</span>
              <span className="mx-2 text-stone-400">–</span>
              <span style={{ color: BRAND.lime }}>
                {nf.format(estimate.high)}
              </span>
              <span className="ml-2 text-2xl sm:text-3xl">kr.</span>
            </p>
            <p className="mt-2 text-[17px] uppercase tracking-[0.14em] text-stone-300">
              inkl. moms · {level.title}
            </p>
          </>
        ) : (
          <p className="fhp-display mt-4 text-xl">
            Sæt mindst én nål i trin 1 for at få et estimat.
          </p>
        )}

        {estimate.egenBesparelse > 0 && (
          <p
            className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[16px] font-semibold"
            style={{ background: "rgba(140,190,63,.16)", color: BRAND.lime }}
          >
            <Hammer className="h-4 w-4" aria-hidden="true" />
            Din egen indsats sparer ca. {kr(estimate.egenBesparelse)}
          </p>
        )}
      </div>

      {/* --- Specifikation ------------------------------------------------ */}
      {estimate.perCategory.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-5 py-3">
            <p className="text-[15px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Sådan er estimatet sat sammen
            </p>
          </div>
          <ul className="divide-y divide-stone-100">
            {estimate.perCategory.map((c) => (
              <li
                key={c.key}
                className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3"
              >
                <span className="text-stone-700">
                  {c.label}
                  <span className="ml-2 text-[15px] text-stone-400">
                    {nf.format(c.qty)} {c.unit}
                    {c.factor !== 1 &&
                      ` · materialevalg ${c.factor > 1 ? "+" : ""}${Math.round(
                        (c.factor - 1) * 100
                      )} %`}
                  </span>
                </span>
                <span className="whitespace-nowrap tabular-nums font-semibold text-stone-800">
                  {kr(c.sum * estimate.level.factor)}
                </span>
              </li>
            ))}

            <li className="flex items-baseline justify-between gap-2 px-5 py-3">
              <span className="text-stone-700">
                Opmåling, projektering & opstart
                <span className="ml-2 text-[15px] text-stone-400">
                  fast beløb
                </span>
              </span>
              <span className="whitespace-nowrap tabular-nums font-semibold text-stone-800">
                {kr(OPSTART_GEBYR)}
              </span>
            </li>

            {estimate.servicePrAar > 0 && (
              <li
                className="flex items-baseline justify-between gap-2 px-5 py-3"
                style={{ background: "#fbfcf8" }}
              >
                <span className="text-stone-700">
                  Serviceaftale
                  <span className="ml-2 text-[15px] text-stone-400">
                    løbende, ikke en del af anlægsprisen
                  </span>
                </span>
                <span
                  className="whitespace-nowrap tabular-nums font-semibold"
                  style={{ color: BRAND.green }}
                >
                  {kr(estimate.servicePrAar)} / år
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* --- Disclaimer --------------------------------------------------- */}
      <div className="flex gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-stone-400"
          aria-hidden="true"
        />
        <p className="text-[16px] leading-relaxed text-stone-600">
          <strong className="text-stone-800">Hvorfor et spænd og ikke ét tal?</strong>{" "}
          Spændet dækker de forhold, ingen kan se fra et billede: jordbunden kan
          være blød eller fyldt med gammelt byggeaffald, der kan ligge skjulte
          fundamenter og rør, og adgangsforholdene afgør, om vi kan komme til med
          maskiner eller skal køre jorden ud i trillebør. Vi låser prisen fast i
          et bindende tilbud efter et gratis besøg i haven.
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   TRIN 6 — Lead capture
   ========================================================================== */

/** Henter jsPDF hvis den findes (npm-pakke eller UMD-global). */
async function loadJsPDF() {
  if (typeof window !== "undefined" && window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }
  try {
    const mod = await import("jspdf");
    return mod.jsPDF || mod.default?.jsPDF || mod.default || null;
  } catch {
    return null;
  }
}

/** Bygger et struktureret objekt, der både bruges til PDF og til CRM/mail. */
function buildReport(state, estimate) {
  return {
    genereret: new Date().toISOString(),
    kunde: state.lead,
    billede: state.imageName || "Ikke uploadet",
    markeringer: state.pins.map((p, i) => ({
      nr: i + 1,
      kategori: CATEGORIES[p.cat].label,
      maengde: `${p.qty} ${CATEGORIES[p.cat].unit}`,
    })),
    materialer: state.materials.map((id) => {
      const m = MATERIALS.find((x) => x.id === id);
      return { kategori: CATEGORIES[m.cat].label, materiale: m.label };
    }),
    arbejdsfordeling: estimate.level.title,
    serviceaftaler: estimate.serviceLines.map((l) => l.label),
    estimat: {
      lav: estimate.low,
      hoej: estimate.high,
      servicePrAar: estimate.servicePrAar,
      valuta: "DKK inkl. moms",
    },
    tips: EGEN_INDSATS_TIPS,
  };
}

/** Genererer PDF med jsPDF — eller logger rapporten, hvis jsPDF mangler. */
async function generatePdf(report) {
  const JsPDF = await loadJsPDF();

  if (!JsPDF) {
    console.log(
      "[Faurlunds Have-Partner] jsPDF er ikke installeret — rapporten ville se sådan ud:",
      report
    );
    return { ok: true, mode: "console" };
  }

  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const M = 48;
  const W = doc.internal.pageSize.getWidth();
  let y = 0;

  const line = (text, size = 11, opts = {}) => {
    const { bold = false, color = [69, 69, 66], gap = 16, indent = 0 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(text, W - M * 2 - indent);
    wrapped.forEach((t) => {
      if (y > doc.internal.pageSize.getHeight() - M) {
        doc.addPage();
        y = M;
      }
      doc.text(t, M + indent, y);
      y += gap;
    });
  };

  // Forside-banner
  doc.setFillColor(77, 124, 15);
  doc.rect(0, 0, W, 132, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Faurlunds Have-Partner", M, 62);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("Dit personlige haveprojekt og prisestimat", M, 86);
  doc.setFontSize(10);
  doc.text(
    `${VIRKSOMHED.navn} · ${VIRKSOMHED.telefon} · ${VIRKSOMHED.email}`,
    M,
    110
  );

  y = 176;
  line(`Udarbejdet til ${report.kunde.navn}`, 15, { bold: true });
  line(
    `${report.kunde.email} · ${report.kunde.telefon}`,
    10,
    { color: [122, 122, 114], gap: 22 }
  );

  line("Dit estimat", 14, { bold: true, color: [90, 158, 36], gap: 22 });
  line(
    `${nf.format(report.estimat.lav)} kr. – ${nf.format(
      report.estimat.hoej
    )} kr. inkl. moms`,
    18,
    { bold: true, gap: 24 }
  );
  line(
    "Spændet dækker ukendte jordbunds- og adgangsforhold. Vi låser prisen fast i et bindende tilbud efter et gratis besøg i haven.",
    10,
    { color: [122, 122, 114], gap: 14 }
  );
  y += 12;

  line("Dine markeringer", 14, { bold: true, color: [90, 158, 36], gap: 20 });
  report.markeringer.forEach((m) =>
    line(`${m.nr}.  ${m.kategori} — ${m.maengde}`, 11, { indent: 8 })
  );
  y += 12;

  line("Valgte materialer", 14, { bold: true, color: [90, 158, 36], gap: 20 });
  if (report.materialer.length) {
    report.materialer.forEach((m) =>
      line(`•  ${m.kategori}: ${m.materiale}`, 11, { indent: 8 })
    );
  } else {
    line("Ingen materialer valgt endnu.", 11, { indent: 8 });
  }
  y += 12;

  line("Arbejdsfordeling", 14, { bold: true, color: [90, 158, 36], gap: 20 });
  line(report.arbejdsfordeling, 11, { indent: 8, gap: 22 });

  line("Serviceaftale", 14, { bold: true, color: [90, 158, 36], gap: 20 });
  if (report.serviceaftaler.length) {
    report.serviceaftaler.forEach((s) => line(`•  ${s}`, 11, { indent: 8 }));
    line(
      `I alt ca. ${nf.format(report.estimat.servicePrAar)} kr. / år`,
      11,
      { bold: true, indent: 8, gap: 22 }
    );
  } else {
    line("Ingen serviceaftale valgt.", 11, { indent: 8, gap: 22 });
  }

  line("Vores anlægsgartners tips til din egen indsats", 14, {
    bold: true,
    color: [90, 158, 36],
    gap: 20,
  });
  report.tips.forEach((t) => line(`•  ${t}`, 11, { indent: 8, gap: 15 }));

  y += 10;
  line(VIRKSOMHED.citat, 10, { color: [122, 122, 114] });

  doc.save("Faurlund-haveprojekt.pdf");
  return { ok: true, mode: "pdf" };
}

function Field({ id, label, icon: Icon, error, ...rest }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-stone-600"
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
        <input
          id={id}
          {...rest}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cx(
            "w-full rounded-md border bg-white py-3 pl-11 pr-3 text-[17px] transition focus:outline-none focus:ring-2",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-200"
              : "border-stone-300 focus:border-lime-600 focus:ring-lime-200"
          )}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[15px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Step6Lead({ state, update, estimate, onLead }) {
  const { lead, consent } = state;
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | done
  const [pdfMode, setPdfMode] = useState(null);

  const setLead = (patch) => update({ lead: { ...lead, ...patch } });

  const validate = () => {
    const e = {};
    if (lead.navn.trim().length < 2) e.navn = "Skriv venligst dit navn.";
    if (!isEmail(lead.email)) e.email = "Tjek lige e-mailadressen.";
    if (!isPhone(lead.telefon)) e.telefon = "Vi skal bruge mindst 8 cifre.";
    if (!consent) e.consent = "Du skal acceptere, at vi må kontakte dig.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setStatus("sending");
    const report = buildReport(state, estimate);
    try {
      const res = await generatePdf(report);
      setPdfMode(res.mode);
      onLead?.(report);
      console.log("[Faurlunds Have-Partner] Nyt lead:", report);
    } catch (err) {
      console.error("[Faurlunds Have-Partner] PDF-generering fejlede:", err);
      console.log("[Faurlunds Have-Partner] Rapportdata:", report);
      setPdfMode("console");
      onLead?.(report);
    }
    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className="fhp-fade space-y-6 text-center">
        <span
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: BRAND.sage }}
        >
          <CheckCircle2 className="h-10 w-10" style={{ color: BRAND.green }} />
        </span>

        <div>
          <h2
            className="fhp-display text-2xl font-bold sm:text-3xl"
            style={{ color: BRAND.greenBright }}
          >
            Tak, {lead.navn.split(" ")[0]}!
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[17px] leading-relaxed text-stone-600">
            {pdfMode === "pdf"
              ? "Din projekt-rapport er hentet til din enhed, og en kopi er på vej til "
              : "Din projekt-rapport er klar, og den er på vej til "}
            <strong className="text-stone-800">{lead.email}</strong>. Vi ringer
            typisk inden for én hverdag på {lead.telefon} for at aftale et gratis
            besøg i haven.
          </p>
        </div>

        <div
          className="mx-auto max-w-md rounded-xl p-5"
          style={{ background: BRAND.sage }}
        >
          <p className="text-[15px] font-semibold uppercase tracking-[0.16em] text-stone-600">
            Dit estimat
          </p>
          <p
            className="fhp-display mt-1 text-2xl font-bold"
            style={{ color: BRAND.greenDark }}
          >
            {nf.format(estimate.low)} – {nf.format(estimate.high)} kr.
          </p>
          <p className="text-[15px] text-stone-500">inkl. moms</p>
        </div>

        <p className="text-[16px] text-stone-500">
          Haster det? Ring til os på{" "}
          <a
            href={`tel:${VIRKSOMHED.telefon.replace(/\s/g, "")}`}
            className="font-semibold underline underline-offset-4"
            style={{ color: BRAND.green }}
          >
            {VIRKSOMHED.telefon}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Trin 6" title="Download dit fulde Have-Projekt">
        Få tilsendt en lækker, skræddersyet PDF med billeder, materialer, vores
        anlægsgartners tips til din egen-indsats og det udspecificerede
        prisestimat.
      </SectionHeading>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Hvad man får */}
        <div
          className="rounded-xl p-5 lg:col-span-2"
          style={{ background: BRAND.sage }}
        >
          <p className="fhp-display mb-3 flex items-center gap-2 text-[18px] font-semibold text-stone-800">
            <FileText className="h-5 w-5" style={{ color: BRAND.green }} />
            Det får du i rapporten
          </p>
          <ul className="space-y-2.5">
            {[
              "Dit havebillede med alle dine markeringer",
              "Materialevalg med levetid og vedligehold",
              "Din arbejdsfordeling — sort på hvidt",
              "Anlægsgartnerens tips til din egen indsats",
              "Det udspecificerede prisestimat",
            ].map((t) => (
              <li key={t} className="flex gap-2 text-[16px] text-stone-700">
                <Check
                  className="mt-1 h-4 w-4 shrink-0"
                  style={{ color: BRAND.green }}
                  aria-hidden="true"
                />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-stone-300/60 pt-4">
            <p className="text-[16px] font-semibold uppercase tracking-wider text-stone-600">
              Dit estimat
            </p>
            <p
              className="fhp-display text-xl font-bold"
              style={{ color: BRAND.greenDark }}
            >
              {estimate.total > 0
                ? `${nf.format(estimate.low)} – ${nf.format(estimate.high)} kr.`
                : "—"}
            </p>
          </div>
        </div>

        {/* Formular */}
        <div className="space-y-4 lg:col-span-3">
          <Field
            id="fhp-navn"
            label="Navn"
            icon={User}
            type="text"
            autoComplete="name"
            placeholder="Fornavn Efternavn"
            value={lead.navn}
            error={errors.navn}
            onChange={(e) => setLead({ navn: e.target.value })}
          />
          <Field
            id="fhp-email"
            label="E-mail"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="dig@eksempel.dk"
            value={lead.email}
            error={errors.email}
            onChange={(e) => setLead({ email: e.target.value })}
          />
          <Field
            id="fhp-tlf"
            label="Telefonnummer"
            icon={Phone}
            type="tel"
            autoComplete="tel"
            placeholder="12 34 56 78"
            value={lead.telefon}
            error={errors.telefon}
            onChange={(e) => setLead({ telefon: e.target.value })}
          />

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => update({ consent: e.target.checked })}
              className="sr-only"
            />
            <span
              className={cx(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition",
                consent ? "border-transparent" : "border-stone-300 bg-white"
              )}
              style={consent ? { background: BRAND.green } : undefined}
              aria-hidden="true"
            >
              {consent && <Check className="h-4 w-4 text-white" />}
            </span>
            <span className="text-[16px] leading-relaxed text-stone-600">
              Ja tak — {VIRKSOMHED.navn} må kontakte mig om dette projekt. Vi
              videregiver aldrig dine oplysninger, og du kan altid bede os slette
              dem igen.
            </span>
          </label>
          {errors.consent && (
            <p className="text-[15px] text-red-600">{errors.consent}</p>
          )}

          <PrimaryButton
            onClick={submit}
            disabled={status === "sending"}
            className="w-full py-4 text-[18px]"
          >
            {status === "sending" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Bygger din rapport…
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Få min projekt-rapport og pris
              </>
            )}
          </PrimaryButton>

          <p className="flex items-center justify-center gap-2 text-[15px] text-stone-400">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Ingen binding, ingen skjulte betingelser — og aldrig spam.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   7. HOVEDKOMPONENT
   ========================================================================== */

const INITIAL_STATE = {
  image: null,
  imageName: "",
  pins: [],
  activeCat: "belaegning",
  materials: [],
  workLevel: "total",
  services: [],
  lead: { navn: "", email: "", telefon: "" },
  consent: false,
};

export default function FaurlundHavePartner({ onLead, className }) {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [state, setState] = useState(INITIAL_STATE);
  const topRef = useRef(null);

  const update = useCallback(
    (patch) => setState((prev) => ({ ...prev, ...patch })),
    []
  );

  const estimate = useMemo(() => calculateEstimate(state), [state]);

  /* Hvornår må man gå videre? */
  const blocker = useMemo(() => {
    if (step === 0 && state.pins.length === 0)
      return "Sæt mindst én nål på billedet for at komme videre.";
    if (step === 1 && state.materials.length === 0)
      return "Vælg mindst ét materiale.";
    if (step === 2 && !state.workLevel)
      return "Vælg hvordan arbejdet skal fordeles.";
    return null;
  }, [step, state]);

  const goTo = useCallback((next) => {
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const next = () => !blocker && step < 5 && goTo(step + 1);
  const back = () => step > 0 && goTo(step - 1);

  const stepProps = { state, update, estimate };

  return (
    <div
      ref={topRef}
      className={cx(
        "fhp-root scroll-mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl",
        className
      )}
    >
      <style>{FONT_CSS}</style>

      {/* --- Header --------------------------------------------------- */}
      <header
        className="px-4 py-6 sm:px-8 sm:py-8"
        style={{ background: BRAND.sage }}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5" style={{ color: BRAND.green }} />
              <span
                className="text-[15px] font-bold uppercase tracking-[0.24em]"
                style={{ color: BRAND.green }}
              >
                {VIRKSOMHED.navn}
              </span>
            </div>
            <h1
              className="fhp-display mt-1 text-3xl font-bold leading-tight sm:text-4xl"
              style={{ color: BRAND.greenBright }}
            >
              Faurlunds Have-Partner
            </h1>
            <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-stone-600">
              Seks trin til overblik over dit haveprojekt — materialer, arbejde
              og pris. Du får estimatet at se, før vi beder om dine oplysninger.
            </p>
          </div>

          <div className="shrink-0 text-[16px] uppercase tracking-wider text-stone-600 sm:text-right">
            <p className="flex items-center gap-2 sm:justify-end">
              <Phone className="h-4 w-4" style={{ color: BRAND.green }} />
              {VIRKSOMHED.telefon}
            </p>
            <p className="mt-1 flex items-center gap-2 sm:justify-end">
              <MapPin className="h-4 w-4" style={{ color: BRAND.green }} />
              Langå · Aarhus V
            </p>
          </div>
        </div>
      </header>

      <ProgressBar step={step} maxReached={maxReached} onJump={goTo} />

      {/* --- Trinnet --------------------------------------------------- */}
      <main className="px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-4xl">
          {step === 0 && <Step1Kortlaeg {...stepProps} />}
          {step === 1 && <Step2Materialer {...stepProps} />}
          {step === 2 && <Step3Arbejde {...stepProps} />}
          {step === 3 && <Step4Service {...stepProps} />}
          {step === 4 && <Step5Estimat {...stepProps} />}
          {step === 5 && <Step6Lead {...stepProps} onLead={onLead} />}
        </div>
      </main>

      {/* --- Navigation ------------------------------------------------ */}
      {step < 5 && (
        <div className="sticky bottom-0 border-t border-stone-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <GhostButton onClick={back} disabled={step === 0}>
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Tilbage</span>
            </GhostButton>

            <div className="flex min-w-0 flex-1 flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
              {blocker && (
                <p className="text-right text-[15px] text-stone-500">
                  {blocker}
                </p>
              )}
              {!blocker && step >= 1 && estimate.total > 0 && step < 4 && (
                <p className="text-right text-[15px] uppercase tracking-wider text-stone-500">
                  Foreløbigt:{" "}
                  <span className="font-bold" style={{ color: BRAND.green }}>
                    {nf.format(estimate.low)}–{nf.format(estimate.high)} kr.
                  </span>
                </p>
              )}
              <PrimaryButton onClick={next} disabled={!!blocker}>
                {step === 3
                  ? "Se mit estimat"
                  : step === 4
                  ? "Hent min rapport"
                  : "Næste"}
                {step === 4 ? (
                  <Download className="h-5 w-5" />
                ) : (
                  <ArrowRight className="h-5 w-5" />
                )}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* --- Trust-footer ---------------------------------------------- */}
      <footer
        className="px-4 py-8 text-stone-300 sm:px-8"
        style={{ background: BRAND.charcoal }}
      >
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          <div>
            <p className="fhp-display text-[17px] font-semibold text-white">
              {VIRKSOMHED.navn}
            </p>
            <p className="mt-2 text-[16px] italic leading-relaxed">
              {VIRKSOMHED.citat}
            </p>
          </div>

          <div>
            <p className="text-[15px] font-bold uppercase tracking-[0.18em] text-white">
              Kontakt os
            </p>
            <p className="mt-2 text-[16px] leading-relaxed">
              Tlf.: {VIRKSOMHED.telefon}
              <br />
              Email: {VIRKSOMHED.email}
            </p>
          </div>

          <div>
            <p className="text-[15px] font-bold uppercase tracking-[0.18em] text-white">
              Find os
            </p>
            <p className="mt-2 text-[16px] leading-relaxed">
              {VIRKSOMHED.adresser.map((a) => (
                <span key={a.by} className="mb-2 block">
                  <strong className="text-white">{a.by}</strong>
                  <br />
                  {a.vej}, {a.post}
                </span>
              ))}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
