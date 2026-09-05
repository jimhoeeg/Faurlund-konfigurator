import { polygonAreaM2, lineLengthM } from "../src/skraafoto/skraafotoClient.js";

let fejl = 0;
const t = (navn, faktisk, forventet, tol = 1e-6) => {
  const ok = Math.abs(faktisk - forventet) <= tol;
  if (!ok) fejl++;
  console.log(`${ok ? "OK  " : "FEJL"}  ${navn}: ${faktisk} (forventet ${forventet})`);
};

// Et kvadrat på 10 x 10 m i UTM-koordinater
const kvadrat = [[721000,6174000,0],[721010,6174000,0],[721010,6174010,0],[721000,6174010,0]];
t("kvadrat 10x10", polygonAreaM2(kvadrat), 100);

// Samme kvadrat med omvendt omløbsretning skal give samme areal
t("kvadrat, omvendt retning", polygonAreaM2([...kvadrat].reverse()), 100);

// Retvinklet trekant, kateter 6 og 8
t("trekant 6x8", polygonAreaM2([[0,0,0],[6,0,0],[0,8,0]]), 24);

// En typisk terrasse: 8 x 5 m
t("terrasse 8x5", polygonAreaM2([[0,0,0],[8,0,0],[8,5,0],[0,5,0]]), 40);

// Degenererede tilfælde må ikke kaste
t("to punkter giver 0", polygonAreaM2([[0,0,0],[1,1,0]]), 0);
t("tom liste giver 0", polygonAreaM2([]), 0);
t("undefined giver 0", polygonAreaM2(undefined), 0);

// Løbende meter til hæk
t("lige linje 30 m", lineLengthM([[0,0,0],[30,0,0]]), 30);
t("knækket linje 3-4-5", lineLengthM([[0,0,0],[3,0,0],[3,4,0]]), 7);
t("ét punkt giver 0", lineLengthM([[0,0,0]]), 0);

// Z-variation må ikke påvirke plan-arealet
t("hældning ændrer ikke plan-areal", polygonAreaM2([[0,0,0],[8,0,3],[8,5,3],[0,5,0]]), 40);

console.log(fejl === 0 ? "\nAlle tests bestået" : `\n${fejl} test(s) fejlede`);
process.exit(fejl ? 1 : 0);
