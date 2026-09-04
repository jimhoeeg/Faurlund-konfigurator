/**
 * SkraafotoHaveKort
 * ----------------------------------------------------------------------------
 * Lader kunden finde sin egen adresse, se sit hus fra luften og enten sætte
 * nåle eller måle rigtige arealer op direkte på skråfotoet.
 *
 * To ting er værd at forstå ved implementeringen:
 *
 * 1) Nåle gemmes som punkter i VERDEN (EPSG:25832), ikke som pixels på ét
 *    bestemt foto. Derfor bliver de liggende korrekt, når kunden skifter
 *    mellem nord/syd/øst/vest — vi projicerer dem bare ind i det nye billede.
 *
 * 2) Opmåling er ægte fotogrammetri, ikke et skøn. Et klik omregnes til et
 *    punkt på jordoverfladen ved at skære synslinjen mod højdemodellen.
 *    Det kræver DHM-adgang; uden den vises kun nåle.
 *
 * OpenLayers-opsætningen (pixel-projektion, COG-kilde, WebGL-lag) følger
 * bevidst Klimadatastyrelsens egen viewer, så vi arver deres afprøvede valg.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Map from "ol/Map.js";
import View from "ol/View.js";
import WebGLTile from "ol/layer/WebGLTile.js";
import GeoTIFF from "ol/source/GeoTIFF.js";
import Projection from "ol/proj/Projection.js";
import {
  AlertTriangle,
  Check,
  Crosshair,
  Loader2,
  MapPin,
  Ruler,
  Search,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";

import {
  DIRECTIONS,
  findPhoto,
  imageToWorld,
  lineLengthM,
  loadTerrain,
  photoHref,
  photoYear,
  polygonAreaM2,
  searchAddress,
  worldToImage,
} from "../skraafoto/skraafotoClient.js";
import {
  hasMeasurementAccess,
  skraafotoConfig,
} from "../skraafoto/skraafotoConfig.js";

/* Samme pixel-projektion som viewer'en. Uden `metersPerUnit` rammer man en
   kendt OpenLayers-fejl ved opslag af enheder for 'pixels'. */
const IMAGE_PROJECTION = new Projection({
  code: "faurlund-image",
  units: "pixels",
  metersPerUnit: 1,
});

const cx = (...p) => p.filter(Boolean).join(" ");
const uid = () => Math.random().toString(36).slice(2, 9);
const nf0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

export default function SkraafotoHaveKort({
  pins,
  onPinsChange,
  activeCat,
  categories,
  brand,
  config = skraafotoConfig,
  onUseUpload,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState(null); // { label, coord }

  const [direction, setDirection] = useState("north");
  const [item, setItem] = useState(null);
  const [terrain, setTerrain] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("pin"); // pin | measure
  const [draft, setDraft] = useState([]); // verdenskoordinater under opmåling
  const [tick, setTick] = useState(0); // tvinger gentegning ved kortbevægelse

  const canMeasure = hasMeasurementAccess(config) && Boolean(terrain);

  /* ---------------------------------------------------------------- Søgning */

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchAddress(query, { config, signal: ctrl.signal }));
        setError(null);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setError(err.message || "Adressesøgningen fejlede.");
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query, config]);

  /* ------------------------------------------------- Hent foto og terrændata */

  useEffect(() => {
    if (!place) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setTerrain(null);
      try {
        const found = await findPhoto(place.coord, direction, { config });
        if (cancelled) return;

        if (!found) {
          setItem(null);
          setError(
            `Der findes ikke et skråfoto mod ${labelFor(direction)} for den adresse. Prøv en anden retning.`
          );
          return;
        }
        setItem(found);

        // Terrænet hentes bagefter — nåle skal ikke vente på højdemodellen.
        if (hasMeasurementAccess(config)) {
          try {
            const t = await loadTerrain(found, { config });
            if (!cancelled) setTerrain(t);
          } catch {
            if (!cancelled) setTerrain(null); // opmåling slås fra, nåle virker
          }
        }
      } catch (err) {
        if (!cancelled) {
          setItem(null);
          setError(err.message || "Kunne ikke hente skråfotoet.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [place, direction, config]);

  /* ------------------------------------------------------ OpenLayers-kortet */

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = new Map({ target: mapEl.current, layers: [], controls: [] });
    mapRef.current = map;

    let frame = null;
    const onRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setTick((t) => t + 1);
      });
    };
    map.on("postrender", onRender);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      map.un("postrender", onRender);
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const href = photoHref(item);
    if (!map || !href) return;

    let cancelled = false;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const source = new GeoTIFF({
      convertToRGB: true,
      transition: 0,
      sources: [{ url: href, bands: [1, 2, 3] }], // bånd 4 er alfa og ignoreres
    });
    const layer = new WebGLTile({ source, preload: 0 });
    layerRef.current = layer;
    map.addLayer(layer);

    source
      .getView()
      .then((viewConfig) => {
        if (cancelled) return;
        const center = worldToImage(item, [
          place.coord[0],
          place.coord[1],
          0,
        ]);
        map.setView(
          new View({
            ...viewConfig,
            projection: IMAGE_PROJECTION,
            center,
            zoom: 5,
          })
        );
      })
      .catch(() => {
        if (!cancelled) setError("Billedet kunne ikke indlæses.");
      });

    return () => {
      cancelled = true;
    };
  }, [item, place]);

  /* ------------------------------------------------------------ Klik i kort */

  const handleMapClick = useCallback(
    async (evt) => {
      if (!item) return;
      const imageXY = evt.coordinate;

      // Uden terrændata kan vi ikke omregne præcist. Nåle placeres da på
      // terrænkote 0 — godt nok til en markering, ikke til opmåling.
      let world;
      try {
        world = terrain
          ? await imageToWorld(item, terrain, imageXY, { config })
          : null;
      } catch {
        world = null;
      }
      if (!world) {
        setError(
          "Kunne ikke omregne punktet til en placering i haven. Prøv igen, eller upload et billede i stedet."
        );
        return;
      }

      if (mode === "measure") {
        setDraft((d) => [...d, world]);
      } else {
        const cat = categories[activeCat];
        if (!cat) return;
        onPinsChange([
          ...pins,
          { id: uid(), cat: activeCat, world, qty: cat.defaultQty, measured: false },
        ]);
      }
    },
    [item, terrain, mode, activeCat, categories, pins, onPinsChange, config]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("click", handleMapClick);
    return () => map.un("click", handleMapClick);
  }, [handleMapClick]);

  /* ----------------------------------------------------------- Afslut måling */

  const activeCategory = categories[activeCat];
  const measuresLength = activeCategory?.unit === "lbm";
  const draftValue = measuresLength
    ? lineLengthM(draft)
    : polygonAreaM2(draft);

  const finishMeasurement = () => {
    if (draft.length < (measuresLength ? 2 : 3)) return;
    onPinsChange([
      ...pins,
      {
        id: uid(),
        cat: activeCat,
        world: draft[0],
        qty: Math.round(draftValue),
        measured: true,
        ring: draft,
      },
    ]);
    setDraft([]);
    setMode("pin");
  };

  /* ---------------------------------------------------------------- Tegning */

  const map = mapRef.current;
  const toPixel = (world) => {
    if (!map || !item) return null;
    try {
      const px = map.getPixelFromCoordinate(worldToImage(item, world));
      return px && Number.isFinite(px[0]) ? px : null;
    } catch {
      return null;
    }
  };
  void tick; // gentegn når kortet flytter sig

  const pinPixels = item
    ? pins.map((p) => ({ pin: p, px: p.world ? toPixel(p.world) : null }))
    : [];
  const draftPixels = draft.map(toPixel).filter(Boolean);

  /* ------------------------------------------------------------------- UI */

  if (!place) {
    return (
      <AddressStep
        query={query}
        setQuery={setQuery}
        results={results}
        searching={searching}
        error={error}
        brand={brand}
        onPick={(r) => {
          setPlace(r);
          setResults([]);
          setQuery(r.label);
        }}
        onUseUpload={onUseUpload}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Adresse + skift */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-[16px] text-stone-700">
          <MapPin className="h-4 w-4 shrink-0" style={{ color: brand.green }} />
          <span className="truncate font-semibold">{place.label}</span>
          {item && (
            <span className="shrink-0 text-[15px] text-stone-400">
              foto fra {photoYear(item)}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setPlace(null);
            setItem(null);
            setTerrain(null);
            setDraft([]);
            setError(null);
          }}
          className="text-[15px] underline underline-offset-4 text-stone-500 hover:text-stone-800"
        >
          Skift adresse
        </button>
      </div>

      {/* Retning */}
      <div className="flex flex-wrap gap-2">
        {DIRECTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDirection(d.id)}
            aria-pressed={direction === d.id}
            className={cx(
              "rounded-full border px-4 py-1.5 text-[15px] font-medium uppercase tracking-wider transition",
              direction === d.id
                ? "border-transparent text-white"
                : "border-stone-300 bg-white text-stone-600 hover:border-stone-400"
            )}
            style={direction === d.id ? { background: brand.green } : undefined}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Værktøj */}
      <div className="flex flex-wrap items-center gap-2">
        <ToolButton
          active={mode === "pin"}
          onClick={() => {
            setMode("pin");
            setDraft([]);
          }}
          icon={MapPin}
          brand={brand}
        >
          Sæt nål
        </ToolButton>
        <ToolButton
          active={mode === "measure"}
          disabled={!canMeasure}
          onClick={() => setMode("measure")}
          icon={Ruler}
          brand={brand}
        >
          Mål {measuresLength ? "længde" : "areal"}
        </ToolButton>
        {!canMeasure && (
          <span className="text-[15px] text-stone-400">
            Opmåling kræver adgang til højdemodellen
          </span>
        )}
      </div>

      {/* Kortet */}
      <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
        <div
          ref={mapEl}
          className={cx(
            "h-[320px] w-full sm:h-[440px]",
            mode === "measure" ? "cursor-crosshair" : "cursor-pointer"
          )}
        />

        {/* Nåle og målepolygon */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {draftPixels.length > 1 && (
            <polygon
              points={draftPixels.map((p) => p.join(",")).join(" ")}
              fill={measuresLength ? "none" : "rgba(140,190,63,.28)"}
              stroke={brand.lime}
              strokeWidth="2.5"
            />
          )}
          {draftPixels.map((p, i) => (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r="5"
              fill="#fff"
              stroke={brand.green}
              strokeWidth="2.5"
            />
          ))}
        </svg>

        {pinPixels.map(({ pin, px }, i) => {
          if (!px) return null;
          const cat = categories[pin.cat];
          const Icon = cat.icon;
          return (
            <span
              key={pin.id}
              className="pointer-events-none absolute flex flex-col items-center"
              style={{ left: px[0], top: px[1], transform: "translate(-50%,-100%)" }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-lg"
                style={{ background: cat.color }}
                title={`${i + 1}. ${cat.label}`}
              >
                <Icon className="h-4 w-4 text-white" />
              </span>
              <span className="h-3 w-0.5" style={{ background: cat.color }} />
            </span>
          );
        })}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="flex items-center gap-2 text-[16px] font-medium text-stone-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              Henter luftfoto af din have…
            </span>
          </div>
        )}

        {mode === "measure" && !loading && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 text-center">
            <p className="text-[16px] font-medium text-white">
              {draft.length === 0
                ? measuresLength
                  ? "Klik langs hækken for at måle den op"
                  : "Klik rundt om arealet — mindst tre punkter"
                : `${nf0.format(Math.round(draftValue))} ${
                    measuresLength ? "lbm" : "m²"
                  } · ${draft.length} punkter`}
            </p>
          </div>
        )}
      </div>

      {/* Handlinger under målingen */}
      {mode === "measure" && draft.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft((d) => d.slice(0, -1))}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-[16px] text-stone-600 hover:border-stone-400"
          >
            <Undo2 className="h-4 w-4" /> Fortryd punkt
          </button>
          <button
            type="button"
            onClick={() => setDraft([])}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-[16px] text-stone-600 hover:border-stone-400"
          >
            <Trash2 className="h-4 w-4" /> Ryd
          </button>
          <button
            type="button"
            disabled={draft.length < (measuresLength ? 2 : 3)}
            onClick={finishMeasurement}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-[16px] font-semibold uppercase tracking-wider text-white disabled:opacity-40"
            style={{ background: brand.green }}
          >
            <Check className="h-4 w-4" />
            Brug {nf0.format(Math.round(draftValue))}{" "}
            {measuresLength ? "lbm" : "m²"}
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[16px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onUseUpload}
        className="text-[15px] text-stone-500 underline underline-offset-4 hover:text-stone-800"
      >
        Passer luftfotoet ikke? Upload dit eget billede i stedet
      </button>
    </div>
  );
}

/* ========================================================================== */

function ToolButton({ active, disabled, onClick, icon: Icon, brand, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[16px] font-semibold uppercase tracking-wider transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-transparent text-white"
          : "border-stone-300 bg-white text-stone-600 hover:border-stone-400"
      )}
      style={active ? { background: brand.green } : undefined}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function AddressStep({
  query,
  setQuery,
  results,
  searching,
  error,
  brand,
  onPick,
  onUseUpload,
}) {
  return (
    <div
      className="rounded-xl border-2 border-dashed p-6 sm:p-10"
      style={{ borderColor: brand.sageDeep, background: "#fbfcf8" }}
    >
      <div className="mx-auto max-w-lg text-center">
        <Crosshair className="mx-auto h-12 w-12" style={{ color: brand.lime }} />
        <p className="fhp-display mt-4 text-lg font-semibold text-stone-800">
          Find din have
        </p>
        <p className="mt-1 text-stone-500">
          Skriv din adresse, så henter vi et luftfoto af grunden. Så slipper du
          for at finde et billede frem.
        </p>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fx Houlbjergvej 23, 8870 Langå"
            autoComplete="street-address"
            aria-label="Søg adresse"
            className="w-full rounded-md border border-stone-300 bg-white py-3 pl-11 pr-10 text-[17px] focus:border-lime-600 focus:outline-none focus:ring-2 focus:ring-lime-200"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-stone-400" />
          )}
        </div>

        {results.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-md border border-stone-200 bg-white text-left">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[16px] text-stone-700 hover:bg-stone-50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-stone-400" />
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-left text-[16px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onUseUpload}
          className="mt-5 inline-flex items-center gap-2 text-[16px] text-stone-500 underline underline-offset-4 hover:text-stone-800"
        >
          <Upload className="h-4 w-4" />
          Eller upload dit eget billede
        </button>
      </div>
    </div>
  );
}

function labelFor(id) {
  return DIRECTIONS.find((d) => d.id === id)?.label.toLowerCase() || id;
}
