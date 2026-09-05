# Faurlunds Have-Partner

Interaktivt 6-trins lead-modul for **Faurlund Anlægsgartner ApS** — bygget i
React med Tailwind CSS og `lucide-react`.

Modulet er ikke kun en prisberegner. Det er en pædagogisk rejse, hvor kunden
undervejs bliver klogere på, hvad kvalitetshåndværk kræver: bærelag,
materialers levetid, hvor mange tons jord et projekt reelt flytter, og hvorfor
en ny belægning skal algebehandles. Prisen vises **før** der spørges om
kontaktoplysninger.

## De seks trin

| Trin | Indhold | Det pædagogiske greb |
| --- | --- | --- |
| 1 | Kortlæg projektet — upload billede og sæt "nåle" med kategori | Infoboks pr. kategori, fx bærelagets betydning for terrassen |
| 2 | Materialevalg og stil | Info-ikon på hvert materialekort med levetid og vedligehold |
| 3 | Arbejdsfordeling (gør-det-selv ↔ totalentreprise) | Advarsel med tons jord, der skal håndteres og bortskaffes |
| 4 | Service & vedligehold | Flisepest og hvorfor algebehandling forlænger levetiden |
| 5 | Prisestimatet afsløres | Stort prisspænd + disclaimer om jordbund og adgangsforhold |
| 6 | Lead capture | Navn, e-mail, telefon → PDF-rapport |

## Kom i gang

```bash
npm install
npm run dev
```

## Brug modulet i et eksisterende site

Hele modulet ligger i **én fil**: `src/components/FaurlundHavePartner.jsx`.
Kopiér den ind i dit projekt og brug den direkte:

```jsx
import FaurlundHavePartner from "./components/FaurlundHavePartner.jsx";

<FaurlundHavePartner
  onLead={(rapport) => {
    // rapport er et struktureret JS-objekt med kunde, markeringer,
    // materialer, arbejdsfordeling, serviceaftaler og prisestimat.
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rapport),
    });
  }}
/>;
```

### Afhængigheder

- `react`, `react-dom`
- `lucide-react` (ikoner)
- `tailwindcss`
- `jspdf` — **valgfri**. Er den ikke installeret, falder modulet pænt tilbage
  til `console.log` af rapporten og viser stadig kvitteringsskærmen.

Tailwind skal scanne filen — sørg for at `content` i `tailwind.config.js`
dækker stien.

## Design

Farver og typografi følger faurlund.dk:

| Rolle | Værdi |
| --- | --- |
| Primær grøn (knapper) | `#4d7c0f` |
| Overskriftsgrøn | `#5a9e24` |
| Accent / lime | `#8cbe3f` |
| Lys salviebaggrund | `#dfe6cf` |
| Mørk footer | `#454542` |

Skrifttyperne (`Barlow Condensed` til UI og brødtekst, `Poppins` til de store
overskrifter) hentes fra Google Fonts i en `<style>`-blok inde i komponenten,
så modulet virker uden ændringer i `index.html`.

Layoutet er mobile-first, navigationen er sticky i bunden, og alle trin kan
tilgås med tastatur.

## Prislogik

Priserne er en **mock**, samlet ét sted i toppen af komponenten, så de er lette
at skifte ud med rigtige tal:

- `CATEGORIES[x].rate` — enhedspris pr. m², lbm eller stk.
- `MATERIALS[x].factor` — materialets prispåvirkning
- `WORK_LEVELS[x].factor` — rabat ved kundens egen indsats
- `OPSTART_GEBYR`, `SPREAD_LOW`, `SPREAD_HIGH` — fast opstart og usikkerhedsspænd
- `JORD_TONS_PR_M2` — omregning fra udgravet areal til tons jord

Alle beløb er inkl. moms.

## Skråfoto: kundens egen have som udgangspunkt

Modulet kan hente et luftfoto af kundens grund fra Klimadatastyrelsen i stedet
for at bede om en billed-upload. Kunden søger sin adresse, ser sit eget hus fra
luften, sætter nåle — og kan **måle rigtige arealer op** direkte på fotoet.

Det er ikke et skøn. Et klik omregnes til et punkt på jordoverfladen ved at
skære synslinjen fra kameraet mod højdemodellen, med kameraets indre og ydre
orientering fra STAC-metadataene. Det fjerner den største usikkerhed i
estimatet: kundens eget gæt på kvadratmeter.

### Opsætning

```bash
cp .env.example .env    # udfyld VITE_STAC_TOKEN
```

| Funktion | Kræver |
| --- | --- |
| Adressesøgning | Ingenting — DAWA er en åben tjeneste uden token |
| Luftfoto | `VITE_STAC_TOKEN` fra dataforsyningen.dk |
| Opmåling af arealer | Derudover DHM-adgang fra datafordeler.dk |
| Billed-upload | Ingenting — virker altid |

Adresser slås op i **DAWA** frem for gsearch. Dataforsyningens dokumentation
undtager udtrykkeligt DAWA fra token-kravet, og i praksis afviste gsearch vores
token med 401, mens skråfoto-tjenesten svarede fint på det samme token. DAWA
fjerner både den afhængighed og den fejlkilde.

**Uden token virker modulet præcis som før** og starter på billed-upload. Der er
ingen halv tilstand: mangler adgangen, er luftfoto-vejen der bare ikke.

### Sikkerhed omkring tokens

STAC-token'et er designet til at ligge i frontend-koden — Dataforsyningens egen
eksempelkonfiguration siger det direkte. Det er altså i orden, at kundens browser
kan se det, men det er knyttet til jeres konto og kan rate-limites.

DHM-legitimationen er en anden sag. Det er en rigtig service-bruger med
brugernavn og adgangskode, og den bør **ikke** ligge i en offentlig JS-fil. Sæt
`VITE_DHM_PROXY_URL` til et endpoint på jeres egen server, der påhæfter
legitimationen serverside.

### Sådan er nåle gemt

Nåle gemmes som punkter i verden (EPSG:25832), ikke som pixels på ét bestemt
foto. Derfor bliver de liggende det rigtige sted, når kunden skifter mellem
nord, syd, øst og vest.

### Filer

| Fil | Ansvar |
| --- | --- |
| `src/skraafoto/skraafotoConfig.js` | Tokens og endpoints — det eneste sted, der skal udfyldes |
| `src/skraafoto/skraafotoClient.js` | API-kald, fotogrammetri og arealberegning. Ingen UI |
| `src/components/SkraafotoHaveKort.jsx` | Kortet, nålene og opmålingen |

Kortet lazy-loades, fordi OpenLayers og GeoTIFF-læsningen fylder ~770 kB. Hoved-
bundlen er ~209 kB og påvirkes ikke af, at integrationen findes.

### Tjek adgangen, før I bruger tid på UI'et

```bash
npm run verify:skraafoto -- "Houlbjergvej 23, 8870 Langå"
```

Scriptet kører hele kæden igennem mod det levende API — adressesøgning, årgange,
skråfoto-søgning, fotogrammetri-metadata og selve billedet — og siger præcis,
hvad der virker. Det læser token'et fra `.env` eller fra `VITE_STAC_TOKEN`.

Det skelner mellem en afvisning fra Dataforsyningen og en afvisning fra et
netværksled undervejs, så en 403 fra en firmaproxy ikke bliver forvekslet med et
ugyldigt token. Går noget galt i adressesøgningens svarformat, peger den direkte
på `extractPoint()` i `skraafotoClient.js`.

### Hvad der er bekræftet mod det levende API

| Del | Status |
| --- | --- |
| Skråfoto-token | Virker. Årgange 2017, 2019, 2021, 2023 og 2025 er tilgængelige |
| Adressesøgning (DAWA) | Virker uden token. Svarformat verificeret og enhedstestet |
| Koordinatsystem | EPSG:25832 bekræftet i både DAWA- og STAC-svar |
| gsearch | Afviser vores token med 401 — derfor ikke brugt |
| Opmåling (DHM) | Ikke afprøvet. Kræver separat konto på datafordeler.dk |

**Licens og priser:** STAC-svaret henviser til
`klimadatastyrelsen.dk/om-klimadatastyrelsen/vilkaar-og-priser`. Kommerciel brug
i et salgsværktøj bør afklares mod de vilkår, før modulet går i luften.

### Status på afprøvning

API-kontrakten er udledt af Klimadatastyrelsens egen MIT-licenserede viewer og
af `@dataforsyningen/saul` — endpoints, CQL-filter, at token'et sendes som
HTTP-header, og hvordan billedet hentes som COG.

Arealberegningen er unit-testet. Modulet er kørt igennem i browser: både
upload-vejen, adresse-UI'et, og at et fejlende API-kald giver kunden en pæn
besked frem for et nedbrud.

**Det, der udestår:** selve kaldet mod det levende API er aldrig afprøvet, fordi
udviklingsmiljøet ikke har netværksadgang til `api.dataforsyningen.dk`. Første
kørsel med et rigtigt token bør derfor ske med konsollen åben.
