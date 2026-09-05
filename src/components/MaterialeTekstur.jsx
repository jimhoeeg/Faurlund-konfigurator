/**
 * MaterialeTekstur
 * ----------------------------------------------------------------------------
 * Tegner et materiale som en gentagende SVG-tekstur i stedet for et fladt
 * farvefelt. Granit skal ligne granit, og cumaru skal ligne træ — ellers er
 * der ingen grund til, at kunden betaler for forskellen.
 *
 * Alt er proceduralt. Ingen billedfiler, ingen fotorettigheder, ingen
 * indlæsningstid — og det skalerer knivskarpt på alle skærme. Skulle Faurlund
 * senere levere rigtige projektfotos, kan de lægges ovenpå som `photo`-prop,
 * og teksturen bliver stående som fallback.
 *
 * Mønstrene er håndtegnede frem for tilfældige, så et materiale ser ens ud
 * hver gang og ikke flimrer mellem gengivelser.
 */

import React, { useId } from "react";

/**
 * @param {string} tex - mønstertype, se MØNSTRE nedenfor
 * @param {object} palette - { a: grundtone, b: mørk, c: lys, j: fuge/kontrast }
 */
export default function MaterialeTekstur({
  tex = "slab",
  palette,
  className,
  photo,
  children,
}) {
  const raw = useId();
  const id = `m${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const p = { a: "#9a9186", b: "#7d766c", c: "#b3aca1", j: "#6b655c", ...palette };
  const { tile, content } = moenster(tex, p, id);

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden" }}>
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern
            id={`${id}-p`}
            width={tile[0]}
            height={tile[1]}
            patternUnits="userSpaceOnUse"
          >
            <rect width={tile[0]} height={tile[1]} fill={p.a} />
            {content}
          </pattern>

          {/* Lyset falder ovenfra. Uden det bliver fladen livløs. */}
          <linearGradient id={`${id}-lys`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="1" stopColor="#000" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill={`url(#${id}-p)`} />
        <rect width="100%" height="100%" fill={`url(#${id}-lys)`} />
      </svg>

      {photo && (
        <img
          src={photo}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      <div style={{ position: "relative", height: "100%" }}>{children}</div>
    </div>
  );
}

/* ==========================================================================
   Mønstrene
   ========================================================================== */

const MØNSTRE = [
  "brick",  // herregårdssten — løberforbandt
  "cobble", // chaussésten — små, håndsatte
  "slab",   // storformat betonfliser — få fuger
  "tile",   // keramiske klinker — fint, blankt net
  "plank",  // terrassebrædder med åring
  "hedge",  // tæt løvværk
  "grass",  // græsstrå
  "bed",    // spredt beplantning
  "block",  // murblokke i skifter
  "rubble", // natursten, uregelmæssig
  "steel",  // cortenplade med samling
  "glow",   // belysning i mørke
];

export { MØNSTRE };

function moenster(tex, p, id) {
  switch (tex) {
    /* --- Belægninger -------------------------------------------------- */
    case "brick":
      // Løberforbandt: hver anden række forskudt en halv sten.
      return {
        tile: [48, 24],
        content: (
          <g>
            <rect x="0.6" y="0.6" width="46.8" height="10.8" rx="1" fill={p.c} />
            <rect x="-23.4" y="12.6" width="46.8" height="10.8" rx="1" fill={p.b} />
            <rect x="24.6" y="12.6" width="46.8" height="10.8" rx="1" fill={p.b} />
            <rect x="0.6" y="0.6" width="46.8" height="10.8" rx="1" fill="none" stroke={p.j} strokeWidth="0.5" opacity=".5" />
          </g>
        ),
      };

    case "cobble":
      // Chaussésten sættes i hånden — små sten, let varierede toner.
      return {
        tile: [24, 24],
        content: (
          <g stroke={p.j} strokeWidth="0.6">
            <rect x="1" y="1" width="9.5" height="9.5" rx="1.5" fill={p.c} />
            <rect x="13" y="1.6" width="9.5" height="9.5" rx="1.5" fill={p.b} />
            <rect x="1.6" y="13" width="9.5" height="9.5" rx="1.5" fill={p.b} />
            <rect x="13" y="13" width="9.5" height="9.5" rx="1.5" fill={p.c} />
          </g>
        ),
      };

    case "slab":
      // Storformat: store flader, meget få fuger.
      return {
        tile: [64, 64],
        content: (
          <g>
            <rect x="1" y="1" width="62" height="62" rx="1.5" fill={p.c} />
            <path d="M8 46 Q26 40 54 50" stroke={p.b} strokeWidth="1.4" fill="none" opacity=".4" />
            <path d="M14 20 Q34 26 58 18" stroke={p.b} strokeWidth="1.1" fill="none" opacity=".3" />
            <path d="M20 34 Q38 30 60 36" stroke={p.b} strokeWidth="0.9" fill="none" opacity=".22" />
            <rect x="1" y="1" width="62" height="62" rx="1.5" fill="none" stroke={p.j} strokeWidth="2" opacity=".9" />
          </g>
        ),
      };

    case "tile":
      // Klinker: stramt net, blank overflade.
      return {
        tile: [32, 32],
        content: (
          <g>
            <rect x="0.5" y="0.5" width="31" height="31" fill={p.c} />
            <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke={p.j} strokeWidth="0.7" opacity=".5" />
            <path d="M2 28 L28 2" stroke="#fff" strokeWidth="2.5" opacity=".07" />
          </g>
        ),
      };

    /* --- Træ ----------------------------------------------------------- */
    case "plank":
      // Brædder med åring og synlig fuge — det er fugen, der siger "terrasse".
      return {
        tile: [80, 30],
        content: (
          <g>
            <rect x="0" y="0" width="80" height="28" fill={p.c} />
            <path d="M0 8 Q26 5.4 52 8.6 T80 7.4" stroke={p.b} strokeWidth="0.9" fill="none" opacity=".45" />
            <path d="M0 15 Q22 18 46 14.4 T80 16" stroke={p.b} strokeWidth="0.7" fill="none" opacity=".35" />
            <path d="M0 21.5 Q30 19.4 58 22.4 T80 21" stroke={p.b} strokeWidth="0.8" fill="none" opacity=".3" />
            <ellipse cx="62" cy="14" rx="3.2" ry="2" fill={p.b} opacity=".3" />
            <rect x="0" y="28" width="80" height="2" fill={p.j} opacity=".75" />
          </g>
        ),
      };

    /* --- Grønt --------------------------------------------------------- */
    case "hedge":
      // Tæt løv: mange små blade i tre toner, så fladen ikke bliver ensfarvet.
      return {
        tile: [40, 40],
        content: (
          <g>
            {[
              [6, 7, p.c, -18], [20, 4, p.b, 22], [33, 9, p.c, 8],
              [12, 18, p.b, 30], [27, 20, p.c, -25], [38, 22, p.b, 12],
              [4, 30, p.c, 16], [18, 33, p.b, -14], [31, 34, p.c, 28],
            ].map(([x, y, fill, r], i) => (
              <ellipse key={i} cx={x} cy={y} rx="5.4" ry="3.4" fill={fill}
                transform={`rotate(${r} ${x} ${y})`} opacity=".92" />
            ))}
          </g>
        ),
      };

    case "grass":
      // Strå i to længder giver dybde uden at blive rodet.
      return {
        tile: [24, 20],
        content: (
          <g stroke={p.c} strokeWidth="1.1" strokeLinecap="round" fill="none">
            <path d="M2 20 Q3 13 1.6 8" />
            <path d="M7 20 Q6 14 7.6 9" stroke={p.b} />
            <path d="M12 20 Q13.4 12 12 6" />
            <path d="M17 20 Q16 14 17.4 10" stroke={p.b} />
            <path d="M22 20 Q21 13 22.4 8" />
          </g>
        ),
      };

    case "bed":
      // Et bed er tuer, ikke prikker: bløde klumper af løv i flere størrelser,
      // med jord og bark synlig imellem og enkelte blomster som accent.
      return {
        tile: [56, 56],
        content: (
          <g>
            {/* løvtuer */}
            {[
              [11, 12, 11, 7.5, -14, p.c, 0.95],
              [36, 8, 9, 6, 20, p.c, 0.8],
              [47, 26, 10, 6.5, -8, p.c, 0.9],
              [22, 27, 12, 8, 10, p.c, 0.7],
              [7, 40, 9.5, 6, 24, p.c, 0.85],
              [33, 45, 11, 7, -18, p.c, 0.78],
            ].map(([x, y, rx, ry, r, fill, o], i) => (
              <ellipse key={`l${i}`} cx={x} cy={y} rx={rx} ry={ry} fill={fill}
                opacity={o} transform={`rotate(${r} ${x} ${y})`} />
            ))}
            {/* enkelte blade i mørkere tone giver dybde */}
            {[
              [17, 6, 5, 3, 30], [43, 16, 4.5, 3, -22], [28, 36, 5, 3.2, 14],
              [3, 26, 4, 2.6, -30], [50, 44, 4.6, 3, 18],
            ].map(([x, y, rx, ry, r], i) => (
              <ellipse key={`d${i}`} cx={x} cy={y} rx={rx} ry={ry} fill={p.j}
                opacity=".45" transform={`rotate(${r} ${x} ${y})`} />
            ))}
            {/* blomsterflor — få og små, ellers bliver det til konfetti */}
            {[[13, 16], [39, 30], [26, 49], [49, 9]].map(([x, y], i) => (
              <circle key={`b${i}`} cx={x} cy={y} r="2.1" fill={p.b} opacity=".9" />
            ))}
          </g>
        ),
      };

    /* --- Mure og stål --------------------------------------------------- */
    case "block":
      // Systemblokke: regelmæssige skifter, tydelig vandret linje.
      return {
        tile: [56, 34],
        content: (
          <g>
            <rect x="1" y="1" width="54" height="14.5" rx="1" fill={p.c} />
            <rect x="-27" y="18" width="54" height="14.5" rx="1" fill={p.b} />
            <rect x="29" y="18" width="54" height="14.5" rx="1" fill={p.b} />
            <rect x="1" y="1" width="54" height="14.5" rx="1" fill="none" stroke={p.j} strokeWidth="0.7" opacity=".45" />
          </g>
        ),
      };

    case "rubble":
      // Natursten: ingen to ens. Uregelmæssigheden ER udtrykket.
      return {
        tile: [56, 56],
        content: (
          <g stroke={p.j} strokeWidth="0.8" strokeLinejoin="round">
            <path d="M1 1 L24 3 L21 17 L2 15 Z" fill={p.c} />
            <path d="M26 2 L55 1 L54 14 L23 17 Z" fill={p.b} />
            <path d="M2 18 L20 19 L17 33 L1 31 Z" fill={p.b} />
            <path d="M22 19 L41 18 L44 34 L18 34 Z" fill={p.c} />
            <path d="M45 16 L55 17 L55 33 L46 34 Z" fill={p.b} />
            <path d="M1 34 L28 35 L26 55 L2 54 Z" fill={p.c} />
            <path d="M30 35 L55 35 L55 55 L27 55 Z" fill={p.b} />
          </g>
        ),
      };

    case "steel":
      // Corten ruster i marmorering, ikke i pletter. Mange brede, meget lave
      // kontraster oven i hinanden — plus en vandret grain, så det læses som
      // valset plade og ikke som en flade med bobler.
      return {
        tile: [72, 72],
        content: (
          <g>
            <ellipse cx="18" cy="16" rx="34" ry="20" fill={p.b} opacity=".22" />
            <ellipse cx="58" cy="30" rx="30" ry="22" fill={p.c} opacity=".18" />
            <ellipse cx="34" cy="52" rx="38" ry="18" fill={p.b} opacity=".2" />
            <ellipse cx="66" cy="62" rx="26" ry="16" fill={p.c} opacity=".14" />
            <ellipse cx="4" cy="40" rx="22" ry="14" fill={p.c} opacity=".12" />
            <g stroke={p.b} strokeWidth="0.5" opacity=".16">
              <path d="M0 9 H72" /><path d="M0 25 H72" /><path d="M0 43 H72" />
              <path d="M0 59 H72" /><path d="M0 68 H72" />
            </g>
            <rect x="0" y="35.5" width="72" height="1" fill={p.j} opacity=".3" />
          </g>
        ),
      };

    /* --- Belysning ------------------------------------------------------ */
    case "glow":
      return {
        tile: [72, 48],
        content: (
          <g>
            <circle cx="20" cy="24" r="14" fill={p.c} opacity=".28" />
            <circle cx="20" cy="24" r="7" fill={p.c} opacity=".5" />
            <circle cx="20" cy="24" r="2.6" fill={p.c} />
            <circle cx="56" cy="34" r="9" fill={p.c} opacity=".18" />
            <circle cx="56" cy="34" r="1.8" fill={p.c} opacity=".8" />
          </g>
        ),
      };

    default:
      return { tile: [16, 16], content: null };
  }
}
