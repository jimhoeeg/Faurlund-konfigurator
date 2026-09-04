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
