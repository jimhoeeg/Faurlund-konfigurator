/**
 * Konfiguration af Skråfoto-integrationen
 * ----------------------------------------------------------------------------
 * ALT, hvad der skal udfyldes for at få skråfotos til at virke, står i denne
 * fil. Resten af modulet rører ikke ved tokens.
 *
 * VIGTIGT om hemmeligheder:
 * STAC-token'et er designet til at ligge i frontend-koden — Dataforsyningens
 * egen eksempel-konfiguration slår fast, at værdierne bliver offentlige. Det er
 * altså i orden, at kundens browser kan se det. Men det er knyttet til
 * Faurlunds konto og kan rate-limites, så det skal ikke deles bredt.
 *
 * DHM-brugernavn og -adgangskode er en anden sag. Det er en rigtig service-
 * bruger hos Datafordeleren, og den bør IKKE ligge i en offentlig JS-fil.
 * Sæt `DHM_PROXY_URL` til et endpoint på jeres egen server, der videresender
 * kaldet med legitimationen påhæftet serverside. Kun hvis I bevidst accepterer
 * risikoen, kan TOKENA/TOKENB udfyldes direkte her.
 */

export const skraafotoConfig = {
  /** Token fra https://dataforsyningen.dk/ — dækker både skråfoto og adressesøgning. */
  API_STAC_TOKEN: import.meta.env?.VITE_STAC_TOKEN || "",

  /** Verificeret mod Klimadatastyrelsens egen viewer (skraafoto_frontend, MIT). */
  API_STAC_BASEURL: "https://api.dataforsyningen.dk/rest/skraafoto_api/v2",
  API_GSEARCH_BASEURL: "https://api.dataforsyningen.dk/rest/gsearch/v2.0",

  /**
   * Højdemodellen (DHM). Kræves KUN til opmåling — nåle virker uden.
   * Foretræk proxy frem for at lægge legitimationen i klienten.
   */
  DHM_PROXY_URL: import.meta.env?.VITE_DHM_PROXY_URL || "",
  API_DHM_WCS_BASEURL:
    "https://services.datafordeler.dk/DHMNedboer/dhm_wcs/1.0.0/WCS",
  API_DHM_BASEURL:
    "https://services.datafordeler.dk/DHMTerraen/DHMKoter/1.0.0/GEOREST/HentKoter",
  API_DHM_TOKENA: import.meta.env?.VITE_DHM_USER || "",
  API_DHM_TOKENB: import.meta.env?.VITE_DHM_PASS || "",

  /** Danmark ligger i EPSG:25832 (UTM zone 32N, ETRS89). */
  SRID: 25832,
  CRS_URI: "http://www.opengis.net/def/crs/EPSG/0/25832",

  /** Præcision for terrænopslag ved punktberegning. Lavere = mere nøjagtigt, men tungere. */
  TERRAIN_PRECISION: 0.03,
  WORLD_XYZ_PRECISION: 0.3,
};

/** Er skråfoto overhovedet slået til? Uden token falder modulet tilbage til upload. */
export function hasSkraafotoAccess(cfg = skraafotoConfig) {
  return Boolean(cfg.API_STAC_TOKEN);
}

/** Kan vi måle arealer? Kræver adgang til højdemodellen oveni. */
export function hasMeasurementAccess(cfg = skraafotoConfig) {
  return (
    hasSkraafotoAccess(cfg) &&
    Boolean(cfg.DHM_PROXY_URL || (cfg.API_DHM_TOKENA && cfg.API_DHM_TOKENB))
  );
}
