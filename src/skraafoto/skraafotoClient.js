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
   Adressesøgning (gsearch)
   ========================================================================== */

/**
 * Søger adresser via gsearch.
 * Ressourcen `husnummer` giver adresser; `stednavn` giver stednavne.
 *
 * @param {string} query - Fritekst, fx "Houlbjergvej 23"
 * @param {object} [opts]
 * @returns {Promise<Array<{id: string, label: string, coord: [number, number]}>>}
 */
export async function searchAddress(query, opts = {}) {
  const cfg = opts.config || skraafotoConfig;
  const limit = opts.limit || 8;
  const resource = opts.resource || "husnummer";

  const trimmed = (query || "").trim();
  if (trimmed.length < 2) return [];

  const url =
    `${cfg.API_GSEARCH_BASEURL}/${resource}` +
    `?q=${encodeURIComponent(trimmed)}&limit=${limit}&srid=${cfg.SRID}`;

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { token: cfg.API_STAC_TOKEN },
      signal: opts.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new SkraafotoError("Kunne ikke nå adressetjenesten.", err);
  }

  if (!response.ok) {
    throw new SkraafotoError(
      response.status === 401 || response.status === 403
        ? "Adressesøgningen afviste vores token."
        : `Adressesøgningen svarede ${response.status}.`
    );
  }

  const data = await response.json();
  const rows = Array.isArray(data) ? data : data?.features || [];

  return rows
    .map((row, i) => {
      const coord = extractPoint(row.geometry);
      if (!coord) return null;
      return {
        id: row.id || `${resource}-${i}`,
        label: row.visningstekst || row.betegnelse || row.navn || trimmed,
        coord,
      };
    })
    .filter(Boolean);
}

/**
 * Trækker ét repræsentativt punkt ud af en GeoJSON-geometri.
 * Følger samme fremgangsmåde som viewerens `getGSearchCenterPoint`.
 */
function extractPoint(geometry) {
  if (!geometry?.coordinates) return null;
  const { type, coordinates } = geometry;

  if (type === "Point") return [coordinates[0], coordinates[1]];
  if (type === "MultiPoint") return [coordinates[0][0], coordinates[0][1]];
  if (type === "MultiLineString") {
    const line = coordinates[0];
    const mid = line[Math.floor(line.length / 2)];
    return [mid[0], mid[1]];
  }
  if (type === "Polygon" || type === "MultiPolygon") {
    // Gennemsnittet af yderringen rammer godt nok til at centrere et foto.
    const ring = type === "Polygon" ? coordinates[0] : coordinates[0][0];
    const sum = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  return null;
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
