// Tester adressesøgningen mod det ægte DAWA-svar, kunden fik i browseren.
import { searchAddress } from "../src/skraafoto/skraafotoClient.js";

const ÆGTE_SVAR = [
  { tekst: "Houlbjergvej 23, Houlbjerg, 8870 Langå",
    adresse: { id: "0a3f50c0-3e80-32b8-e044-0003ba298018", vejnavn: "Houlbjergvej",
      husnr: "23", postnr: "8870", postnrnavn: "Langå", x: 553556, y: 6246843 } },
  { tekst: "Houlbjergvej 23A, Houlbjerg, 8870 Langå",
    adresse: { id: "b9828e51-3b63-419f-b153-ed8417472f73", vejnavn: "Houlbjergvej",
      husnr: "23A", postnr: "8870", postnrnavn: "Langå", x: 553575, y: 6246891 } },
];

let fejl = 0;
const t = (navn, ok, detalje="") => { if(!ok) fejl++; console.log(`${ok?"OK  ":"FEJL"}  ${navn}${detalje?"  "+detalje:""}`); };

let sidsteUrl = null;
let sidsteInit = null;
globalThis.fetch = async (url, init) => {
  sidsteUrl = url; sidsteInit = init;
  return { ok: true, status: 200, json: async () => ÆGTE_SVAR };
};

const r = await searchAddress("Houlbjergvej 23");

t("to resultater", r.length === 2, `fik ${r.length}`);
t("label bruger DAWAs tekst", r[0].label === "Houlbjergvej 23, Houlbjerg, 8870 Langå", r[0].label);
t("koordinat læst korrekt", r[0].coord[0] === 553556 && r[0].coord[1] === 6246843, JSON.stringify(r[0].coord));
t("id med", r[0].id === "0a3f50c0-3e80-32b8-e044-0003ba298018");
t("andet resultat korrekt", r[1].coord[0] === 553575 && r[1].coord[1] === 6246891);

t("kalder DAWA-endpointet", sidsteUrl.includes("/adresser/autocomplete"), sidsteUrl);
t("beder om EPSG:25832", sidsteUrl.includes("srid=25832"));
t("sender INGEN token", !sidsteUrl.includes("token") && !sidsteInit?.headers?.token);
t("url-encoder søgeteksten", sidsteUrl.includes("Houlbjergvej%2023"));

// Robusthed
t("for kort søgning giver tom liste", (await searchAddress("H")).length === 0);
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [{ tekst: "Uden koordinat", adresse: { id: "x" } }] });
t("rækker uden koordinat frasorteres", (await searchAddress("test")).length === 0);
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ fejl: "ikke en liste" }) });
t("uventet svarform giver tom liste", (await searchAddress("test")).length === 0);
globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
try { await searchAddress("test"); t("500 kaster fejl", false); }
catch (e) { t("500 kaster fejl", e.message.includes("500"), e.message); }

// Grænsen på antal resultater
globalThis.fetch = async () => ({ ok: true, status: 200,
  json: async () => Array.from({length: 30}, (_,i) => ({ tekst: `Vej ${i}`, adresse: { id: `${i}`, x: 1+i, y: 2 } })) });
t("skærer til 8 resultater", (await searchAddress("vej")).length === 8);

console.log(fejl === 0 ? "\nAlle tests bestået" : `\n${fejl} fejlede`);
process.exit(fejl ? 1 : 0);
