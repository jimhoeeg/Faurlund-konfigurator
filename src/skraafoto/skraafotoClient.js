/**
 * Skråfoto-klient
 * ----------------------------------------------------------------------------
 * Alt, der taler med Klimadatastyrelsens API'er, ligger her. Ingen React,
 * ingen UI — så det kan testes og skiftes ud isoleret.
 *
 * API-kontrakten er udledt af Klimadatastyrelsens egen viewer
 * (github.com/Klimadatastyrelsen/skraafoto_frontend, MIT-licenseret) og af
 * @dataforsyningen/saul. Konkret:
 *
 *   - Token sendes som HTTP-headeren `token` — ikke som query-parameter.
 *   - Adresser slås op i DAWA, der som den eneste tjeneste er helt uden token.
 *   - Skråfoto søges via STAC med et CQL-JSON-filter på punkt + retning.
 *   - Selve billedet ligger i `item.assets.data.href` som en COG (GeoTIFF).
 *   - Fotogrammetrien (billedpixel <-> verdenskoordinat) klares af saul, der
 *     bruger kameraets indre/ydre orientering plus højdemodellen.
 *
 * Koordinater er gennemgående EPSG:25832 (UTM 32N / ETRS89) i meter.
 */

import { getSTAC, getImageXY, getWorldXYZ, getTerrainGeoTIFF } from "@dataforsyningen/saul";
import { skraafotoConfig } from "./skraafotoConfig.js";

/** De fire skrå retninger plus lodret. Rækkefølgen styrer knapperne i UI'et. */
export const DIRECTIONS = [
  { id: "north", label: "Nord" },
  { id: "east", label: "Øst" },
  { id: "south", label: "Syd" },
  { id: "west", label: "Vest" },
  { id: "nadir", label: "Lodret" },
];

class SkraafotoError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "SkraafotoError";
    this.cause = cause;
  }
}

/* ==========================================================================
   Adressesøgning (DAWA)
   ========================================================================== */

/**
 * Søger danske adresser i DAWA (Danmarks Adressers Web API).
 *
 * DAWA er bevidst valgt frem for gsearch: Dataforsyningens dokumentation
 * undtager udtrykkeligt DAWA fra token-kravet, så adressesøgningen virker,
 * uanset hvilke tjenester der er åbnet på kontoen. Det er én afhængighed og
 * én fejlkilde mindre — og det var netop gsearch, der afviste vores token
 * med 401, mens skråfoto-tjenesten svarede fint.
 *
 * Svaret er en liste af `{ tekst, adresse: { id, x, y, ... } }`, hvor x/y er
 * i den srid, man beder om — altså EPSG:25832 her.
 *
 * @param {string} query - Fritekst, fx "Houlbjergvej 23"
 * @param {object} [opts]
 * @returns {Promise<Array<{id: string, label: string, coord: [number, number]}>>}
 */
export async function searchAddress(query, opts = {}) {
  const cfg = opts.config || skraafotoConfig;
  const limit = opts.limit || 8;

  const trimmed = (query || "").trim();
  if (trimmed.length < 2) return [];

  // Bevidst ingen limit-parameter: DAWA afviser ukendte parametre med 400,
  // og vi er ikke sikre på navnet. Vi skærer i stedet listen til her.
  const url =
    `${cfg.API_DAWA_BASEURL}/adresser/autocomplete` +
    `?q=${encodeURIComponent(trimmed)}&srid=${cfg.SRID}`;

  let response;
  try {
    // Ingen token — DAWA er åben.
    response = await fetch(url, { method: "GET", signal: opts.signal });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new SkraafotoError("Kunne ikke nå adressetjenesten.", err);
  }

  if (!response.ok) {
    throw new SkraafotoError(`Adressesøgningen svarede ${response.status}.`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const a = row.adresse;
      if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
      return {
        id: a.id || `${a.vejkode}-${a.husnr}`,
        label: row.tekst || `${a.vejnavn} ${a.husnr}, ${a.postnr} ${a.postnrnavn}`,
        coord: [a.x, a.y],
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

/* ==========================================================================
   Skråfoto (STAC)
   ========================================================================== */

/**
 * Finder det nyeste skråfoto, der dækker et punkt, set fra en given retning.
 *
 * @param {[number, number]} coord - [X, Y] i EPSG:25832
 * @param {string} direction - north | east | south | west | nadir
 * @param {object} [opts] - { collection, config }
 * @returns {Promise<object|null>} STAC-item, eller null hvis intet dækker punktet
 */
export async function findPhoto(coord, direction, opts = {}) {
  const cfg = opts.config || skraafotoConfig;

  const endpoint = opts.collection
    ? `/collections/${opts.collection}/items`
    : "/search";

  const filter = {
    and: [
      {
        contains: [
          { property: "geometry" },
          { type: "Point", coordinates: [coord[0], coord[1]] },
        ],
      },
      { eq: [{ property: "direction" }, direction] },
    ],
  };

  const query =
    `${endpoint}?limit=1` +
    `&filter=${encodeURI(JSON.stringify(filter))}` +
    `&filter-lang=cql-json` +
    `&filter-crs=${cfg.CRS_URI}` +
    `&crs=${cfg.CRS_URI}`;

  const response = await getSTAC(query, cfg);

  if (!response || response.name === "Error") {
    throw new SkraafotoError("Skråfoto-tjenesten svarede ikke som forventet.");
  }
  return response.features?.[0] || null;
}

/**
 * Henter listen af tilgængelige årgange (collections), nyeste først.
 * Test-collections filtreres fra, præcis som i viewer'en.
 */
export async function listCollections(opts = {}) {
  const cfg = opts.config || skraafotoConfig;
  const data = await getSTAC("/collections", cfg);
  if (!data?.collections) return [];
  return data.collections
    .filter((c) => !/test/i.test(c.id))
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

/** Læsevenlig årgang ud fra et STAC-item, fx "2021". */
export function photoYear(item) {
  const stamp = item?.properties?.datetime || item?.properties?.["datetime"];
  if (stamp) {
    const year = new Date(stamp).getFullYear();
    if (!Number.isNaN(year)) return String(year);
  }
  const match = /(\d{4})/.exec(item?.collection || "");
  return match ? match[1] : "";
}

/** URL til selve billedet (Cloud Optimized GeoTIFF). */
export function photoHref(item) {
  return item?.assets?.data?.href || null;
}

/* ==========================================================================
   Højdemodel og fotogrammetri
   ========================================================================== */

/**
 * Henter terrændata for det område, et foto dækker. Kræves for at kunne
 * omregne et klik på billedet til et punkt i virkeligheden.
 */
export async function loadTerrain(item, opts = {}) {
  const cfg = opts.config || skraafotoConfig;
  try {
    return await getTerrainGeoTIFF(item, cfg, cfg.TERRAIN_PRECISION);
  } catch (err) {
    throw new SkraafotoError(
      "Kunne ikke hente højdemodellen. Opmåling er ikke tilgængelig.",
      err
    );
  }
}

/**
 * Billedpixel -> verdenskoordinat. Itererer mod terrænmodellen, indtil
 * punktet ligger på jordoverfladen.
 *
 * @returns {Promise<[number, number, number]>} [X, Y, Z] i EPSG:25832
 */
export async function imageToWorld(item, terrain, imageXY, opts = {}) {
  const cfg = opts.config || skraafotoConfig;
  return getWorldXYZ(
    { image: item, terrain, xy: imageXY },
    cfg.WORLD_XYZ_PRECISION
  );
}

/**
 * Verdenskoordinat -> billedpixel. Synkron, da kameraets orientering er kendt.
 *
 * Det er den her vej, der gør, at en nål bliver liggende det rigtige sted,
 * når kunden skifter mellem nord/syd/øst/vest: nålen gemmes som et punkt i
 * verden, ikke som en pixel på ét bestemt foto.
 *
 * @returns {[number, number]} [kolonne, række]
 */
export function worldToImage(item, world) {
  return getImageXY(item, world[0], world[1], world[2] || 0);
}

/* ==========================================================================
   Opmåling
   ========================================================================== */

/**
 * Arealet af en polygon givet i verdenskoordinater, via snøresnorformlen.
 *
 * Bemærk: vi regner på X/Y og får dermed *plan-arealet* — altså arealet set
 * ovenfra. Det er præcis det, man bestiller fliser og græs efter. På en meget
 * skrånende grund er den faktiske overflade lidt større.
 *
 * @param {Array<[number, number, number]>} ring
 * @returns {number} Areal i m²
 */
export function polygonAreaM2(ring) {
  if (!ring || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/**
 * Længden af en åben linje i verdenskoordinater — til hæk og kantsten,
 * der måles i løbende meter.
 *
 * @param {Array<[number, number, number]>} points
 * @returns {number} Længde i meter
 */
export function lineLengthM(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    total += Math.hypot(dx, dy);
  }
  return total;
}

export { SkraafotoError };
