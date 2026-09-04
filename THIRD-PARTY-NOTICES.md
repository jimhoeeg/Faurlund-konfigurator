# Tredjepartslicenser

Skråfoto-integrationen i dette projekt bygger på software og API'er fra
Klimadatastyrelsen (tidligere SDFI). MIT-licensen kræver, at ophavsretten og
licensteksten følger med — den står derfor gengivet nedenfor.

## @dataforsyningen/saul

Fotogrammetri og STAC-kald. MIT-licenseret.
Kilde: https://github.com/SDFIdk/saul

## skraafoto_frontend

API-kontrakten i `src/skraafoto/skraafotoClient.js` og OpenLayers-opsætningen i
`src/components/SkraafotoHaveKort.jsx` er udledt af Klimadatastyrelsens egen
viewer. MIT-licenseret.
Kilde: https://github.com/Klimadatastyrelsen/skraafoto_frontend

```
MIT License

Copyright (c) 2022 SDFI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Øvrige afhængigheder

| Pakke | Licens |
| --- | --- |
| openlayers (`ol`) | BSD-2-Clause |
| proj4 | MIT |
| jspdf | MIT |
| lucide-react | ISC |
| react, react-dom | MIT |

## Data

Skråfotos og adressedata leveres af Klimadatastyrelsen via Dataforsyningen.
Brug er underlagt deres vilkår, herunder krav om kildeangivelse. Modulet viser
derfor årgangen på det anvendte foto sammen med billedet.
