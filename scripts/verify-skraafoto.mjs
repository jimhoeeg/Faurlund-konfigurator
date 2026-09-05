#!/usr/bin/env node
/**
 * Verificér skråfoto-adgangen
 * ----------------------------------------------------------------------------
 * Kører hele kæden igennem mod det levende API og siger præcis, hvad der
 * virker, og hvad der ikke gør:
 *
 *   1. Adressesøgning (DAWA, uden token) -> koordinat i EPSG:25832
 *   2. Årgange (STAC collections)    -> hvilke år findes der fotos fra
 *   3. Skråfoto-søgning (STAC)       -> et item, der dækker adressen
 *   4. Metadata til fotogrammetri    -> kan vi overhovedet måle op
 *   5. Selve billedet (COG)          -> kan det hentes
 *
 * Brug:
 *   VITE_STAC_TOKEN=... node scripts/verify-skraafoto.mjs ["adresse"]
 *   npm run verify:skraafoto -- "Houlbjergvej 23, 8870 Langå"
 *
 * Scriptet har ingen afhængigheder og rører ikke resten af projektet.
 */

import { readFileSync } from "node:fs";

const DAWA = "https://api.dataforsyningen.dk";
const STAC = "https://api.dataforsyningen.dk/rest/skraafoto_api/v2";
const CRS = "http://www.opengis.net/def/crs/EPSG/0/25832";

const farve = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  fejl: (s) => `\x1b[31m${s}\x1b[0m`,
  svag: (s) => `\x1b[90m${s}\x1b[0m`,
  fed: (s) => `\x1b[1m${s}\x1b[0m`,
};

let problemer = 0;
const ok = (t, detalje) =>
  console.log(`${farve.ok("OK")}    ${t}${detalje ? farve.svag("  " + detalje) : ""}`);
const fejl = (t, detalje) => {
  problemer++;
  console.log(`${farve.fejl("FEJL")}  ${t}${detalje ? "\n      " + detalje : ""}`);
};

/** Læser token fra miljøet, ellers fra .env — så man slipper for at eksportere det. */
function hentToken() {
  if (process.env.VITE_STAC_TOKEN) return process.env.VITE_STAC_TOKEN.trim();
  try {
    const linje = readFileSync(new URL("../.env", import.meta.url), "utf8")
      .split("\n")
      .find((l) => l.startsWith("VITE_STAC_TOKEN="));
    if (linje) return linje.slice("VITE_STAC_TOKEN=".length).trim();
  } catch {
    /* ingen .env — det er fint */
  }
  return null;
}

async function hent(url, token) {
  const svar = await fetch(url, { headers: { token } });
  const tekst = await svar.text();
  let data = null;
  try {
    data = JSON.parse(tekst);
  } catch {
    /* ikke JSON */
  }
  return { status: svar.status, ok: svar.ok, data, tekst };
}

async function main() {
  const token = hentToken();
  const adresse = process.argv[2] || "Houlbjergvej 23, 8870 Langå";

  console.log(farve.fed("\nVerificerer skråfoto-adgang\n"));

  if (!token) {
    fejl(
      "Intet token fundet.",
      "Sæt VITE_STAC_TOKEN i .env, eller kør:\n      VITE_STAC_TOKEN=... node scripts/verify-skraafoto.mjs"
    );
    process.exit(1);
  }
  ok("Token fundet", `${token.slice(0, 4)}… (${token.length} tegn)`);

  /* --- 1. Adressesøgning (DAWA — kræver ikke token) --------------------- */
  let coord = null;
  try {
    const url = `${DAWA}/adresser/autocomplete?q=${encodeURIComponent(adresse)}&srid=25832`;
    const svar = await fetch(url); // bevidst uden token
    const raekker = svar.ok ? await svar.json() : null;

    if (!svar.ok) {
      fejl(
        `Adressesøgning svarede ${svar.status}`,
        "DAWA er en åben tjeneste, så et token er ikke problemet her.\n      " +
          "Tjek nettet, eller om api.dataforsyningen.dk kan nås."
      );
    } else if (!Array.isArray(raekker) || !raekker.length) {
      fejl("Adressesøgning gav nul resultater", `Prøv en anden adresse end "${adresse}".`);
    } else {
      const a = raekker[0].adresse;
      if (!a || !Number.isFinite(a.x) || !Number.isFinite(a.y)) {
        fejl(
          "Adressesøgning: uventet svarform",
          `Manglede adresse.x / adresse.y. Fik: ${Object.keys(raekker[0]).join(", ")}\n      ` +
            "Justér searchAddress() i src/skraafoto/skraafotoClient.js."
        );
      } else {
        coord = [a.x, a.y];
        ok("Adressesøgning (DAWA)", `${raekker[0].tekst} -> ${a.x}, ${a.y}`);
      }
    }
  } catch (e) {
    fejl("Adressesøgning kunne ikke nås", e.message);
  }

  /* --- 2. Årgange -------------------------------------------------------- */
  try {
    const r = await hent(`${STAC}/collections`, token);
    if (!r.ok) {
      fejl(`STAC /collections svarede ${r.status}`, r.tekst.slice(0, 200));
    } else {
      const aargange = (r.data?.collections || [])
        .map((c) => c.id)
        .filter((id) => !/test/i.test(id));
      if (!aargange.length) fejl("Ingen brugbare årgange fundet");
      else ok("Årgange tilgængelige", aargange.slice(0, 6).join(", "));
    }
  } catch (e) {
    fejl("STAC /collections kunne ikke nås", e.message);
  }

  /* --- 3-5. Foto, metadata og billede ----------------------------------- */
  if (!coord) {
    console.log(
      farve.svag("\n      Springer foto-testen over — ingen koordinat fra adressesøgningen.\n")
    );
  } else {
    const filter = {
      and: [
        { contains: [{ property: "geometry" }, { type: "Point", coordinates: coord }] },
        { eq: [{ property: "direction" }, "north"] },
      ],
    };
    const url =
      `${STAC}/search?limit=1&filter=${encodeURI(JSON.stringify(filter))}` +
      `&filter-lang=cql-json&filter-crs=${CRS}&crs=${CRS}`;

    try {
      const r = await hent(url, token);
      if (!r.ok) {
        fejl(`Skråfoto-søgning svarede ${r.status}`, r.tekst.slice(0, 300));
      } else {
        const item = r.data?.features?.[0];
        if (!item) {
          fejl(
            "Ingen fotos dækker adressen mod nord",
            "Prøv en anden retning eller adresse. Filteret virker, men gav nul træf."
          );
        } else {
          ok("Skråfoto fundet", `${item.id}`);

          const io = item.properties?.["pers:interior_orientation"];
          if (!io?.focal_length || !io?.sensor_array_dimensions) {
            fejl(
              "Kameraets orientering mangler i metadataene",
              "Uden pers:interior_orientation kan der ikke måles op."
            );
          } else {
            ok(
              "Fotogrammetri-metadata til stede",
              `brændvidde ${io.focal_length}, sensor ${io.sensor_array_dimensions.join("x")}`
            );
          }

          const href = item.assets?.data?.href;
          if (!href) {
            fejl("Billedet mangler", "assets.data.href fandtes ikke på item'et.");
          } else {
            // Range-forespørgsel: henter kun de første bytes, ikke hele billedet.
            try {
              const b = await fetch(href, { headers: { token, Range: "bytes=0-1023" } });
              if (b.ok || b.status === 206) {
                ok("Billedet kan hentes", `${b.status} ${farve.svag(href.slice(0, 60) + "…")}`);
              } else {
                fejl(`Billedet svarede ${b.status}`, href);
              }
            } catch (e) {
              fejl("Billedet kunne ikke hentes", e.message);
            }
          }
        }
      }
    } catch (e) {
      fejl("Skråfoto-søgning kunne ikke nås", e.message);
    }
  }

  /* --- Opsummering ------------------------------------------------------- */
  console.log("");
  if (problemer === 0) {
    console.log(farve.ok(farve.fed("Alt virker. Modulet kan bruge skråfotos.")));
    console.log(
      farve.svag(
        "Bemærk: opmåling kræver derudover DHM-adgang (VITE_DHM_PROXY_URL eller bruger/kode)."
      )
    );
  } else {
    console.log(farve.fejl(farve.fed(`${problemer} problem(er). Se ovenfor.`)));
  }
  console.log("");
  process.exit(problemer ? 1 : 0);
}

main();
