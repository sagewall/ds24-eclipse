import Color from "@arcgis/core/Color";
import Map from "@arcgis/core/Map";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import CSVLayer from "@arcgis/core/layers/CSVLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import LabelClass from "@arcgis/core/layers/support/LabelClass";
import FieldsContent from "@arcgis/core/popup/content/FieldsContent";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import OpacityVariable from "@arcgis/core/renderers/visualVariables/OpacityVariable";
import esriRequest from "@arcgis/core/request";
import Query from "@arcgis/core/rest/support/Query";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import WebStyleSymbol from "@arcgis/core/symbols/WebStyleSymbol.js";
import MapView from "@arcgis/core/views/MapView";
import LayerList from "@arcgis/core/widgets/LayerList";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
import type { GeoJSON } from "geojson";
import "./style.css";
import { cloudSymbol, sunSymbol } from "./symbols";
import type { CityTimes } from "./types";

// Load the Calcite custom elements
defineCustomElements(window, {
  resourcesUrl: "https://js.arcgis.com/calcite-components/2.4.0/assets",
});

// References to the user interface elements
const durationChip = document.querySelector("#duration-chip") as HTMLCalciteChipElement;
const durationLabel = document.querySelector("#duration-label") as HTMLCalciteLabelElement;
const endTimeChip = document.querySelector("#end-time-chip") as HTMLCalciteChipElement;
const endTimeLabel = document.querySelector("#end-time-label") as HTMLCalciteLabelElement;
const noResultsNotice = document.querySelector("#no-results-notice") as HTMLCalciteNoticeElement;
const obscurationChip = document.querySelector("#obscuration-chip") as HTMLCalciteChipElement;
const obscurationLabel = document.querySelector("#obscuration-label") as HTMLCalciteLabelElement;
const queryResultsPanel = document.querySelector("#query-results-panel") as HTMLCalcitePanelElement;
const startTimeChip = document.querySelector("#start-time-chip") as HTMLCalciteChipElement;
const startTimeLabel = document.querySelector("#start-time-label") as HTMLCalciteLabelElement;

// Set up the user interface
setUp();

// Set the user's timezone in the query results panel
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
queryResultsPanel.description = `${timeZone} timezone`;

// Create a map
const map = new Map({
  basemap: "topo-vector",
});

// Create a map view
const view = new MapView({
  container: "viewDiv",
  map,
  zoom: 4,
  center: [-85, 35],
});

// Create popup templates for each layer
view.when(async () => {
  // Create a GeoJSON layers for the eclipse
  const centerLayer = new GeoJSONLayer({
    outFields: ["*"],
    renderer: new SimpleRenderer({
      symbol: new SimpleLineSymbol({
        color: "red",
        width: 2,
      }),
    }),
    title: "Center",
    url: "./data/center.geojson",
  });

  const durationLayer = new GeoJSONLayer({
    outFields: ["*"],
    renderer: new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: new Color({
          r: 0,
          g: 0,
          b: 0,
          a: 0,
        }),
        outline: {
          color: new Color({
            r: 100,
            g: 100,
            b: 100,
            a: 1,
          }),
          width: 0.5,
        },
      }),
    }),
    title: "Duration",
    url: "./data/duration.geojson",
    visible: false,
  });

  const penumbraLayer = new GeoJSONLayer({
    outFields: ["*"],
    renderer: new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: new Color({
          r: 0,
          g: 0,
          b: 0,
        }),
        outline: {
          color: new Color({
            r: 0,
            g: 0,
            b: 0,
            a: 0.25,
          }),
          width: 0.5,
        },
      }),
      visualVariables: [
        new OpacityVariable({
          field: "Obscuration",
          stops: [
            { value: 100, opacity: 50 },
            { value: 0, opacity: 0 },
          ],
        }),
      ],
    }),
    title: "Penumbra",
    url: "./data/penumbra.geojson",
    visible: false,
  });

  const totalityLayer = new GeoJSONLayer({
    blendMode: "multiply",
    outFields: ["*"],
    renderer: new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: new Color({
          r: 200,
          g: 200,
          b: 200,
        }),
        outline: {
          color: new Color({
            r: 100,
            g: 100,
            b: 100,
          }),
          width: 1,
        },
      }),
    }),
    title: "Totality",
    url: "./data/totality.geojson",
  });

  // Create a GeoJSON layer for the cities and their eclipse times
  const cityTimesLayer = await createCityTimesLayer();

  // Create a lable class for the cloud cover layer
  const cloudCoverLabelClass = new LabelClass({
    symbol: new TextSymbol({
      color: "white",
      font: {
        size: 12,
        weight: "bold",
      },
      haloColor: "black",
      haloSize: 1,
      xoffset: 10,
      yoffset: 10,
    }),
    labelPlacement: "center-left",
    labelExpressionInfo: {
      expression: "Text(Round(($feature.APRIL_CLEAR_DAYS / 30)*100, 0)) + '%'",
    },
    minScale: 5000000,
  });

  // Create a CSVLayer for april cloud cover in various cities
  const cloudCoverLayer = new CSVLayer({
    labelingInfo: [cloudCoverLabelClass],
    opacity: 0.8,
    outFields: ["*"],
    renderer: new ClassBreaksRenderer({
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 14,
          symbol: cloudSymbol,
        },
        {
          minValue: 15,
          maxValue: 30,
          symbol: sunSymbol,
        },
      ],
      defaultSymbol: sunSymbol,
      field: "APRIL_CLEAR_DAYS",
    }),
    title: "Chance of Sunny Skies in April",
    url: "./data/cloud-cover.csv",
    visible: false,
  });

  // Create a CSVLayer for festivals
  const festivalsLayer = new CSVLayer({
    outFields: ["*"],
    renderer: new SimpleRenderer({
      symbol: new WebStyleSymbol({
        name: "amusement-park",
        styleName: "Esri2DPointSymbolsStyle",
      }),
    }),
    title: "Festivals",
    url: "./data/festivals.csv",
    visible: false,
  });

  map.addMany([
    penumbraLayer,
    durationLayer,
    totalityLayer,
    centerLayer,
    cloudCoverLayer,
    festivalsLayer,
    cityTimesLayer,
  ]);

  // Wait for all layers to load
  await Promise.all(map.allLayers.map((layer) => layer.load()));

  // Create popup templates for each layer
  map.layers.forEach((layer) => {
    if (layer instanceof GeoJSONLayer || layer instanceof CSVLayer) {
      layer.popupTemplate = layer.createPopupTemplate();
    }
  });

  cityTimesLayer.popupTemplate.content = [
    new FieldsContent({
      fieldInfos: [
        {
          fieldName: "t0",
          format: {
            dateFormat: "short-date-short-time",
          },
          label: "Start time",
        },
        {
          fieldName: "t1",
          format: {
            dateFormat: "short-date-short-time",
          },
          label: "50% to maximum obscuration",
        },
        {
          fieldName: "t2",
          format: {
            dateFormat: "short-date-short-time",
          },
          label: "Maximum obscuration",
        },
        {
          fieldName: "t3",
          format: {
            dateFormat: "short-date-short-time",
          },
          label: "50% to end",
        },
        {
          fieldName: "t4",
          format: {
            dateFormat: "short-date-short-time",
          },
          label: "End time",
        },
      ],
    }),
  ];

  // Create a LayerList widget
  new LayerList({
    container: "layer-list-panel",
    view,
    visibleElements: {
      collapseButton: true,
      heading: true,
    },
    visibilityAppearance: "checkbox",
  });

  // Watch for when the view is stationary and query information
  reactiveUtils.watch(
    () => view.stationary,
    (stationary) => {
      stationary && queryInformation(cityTimesLayer, penumbraLayer, durationLayer);
    },
  );
});

async function createCityTimesLayer(): Promise<GeoJSONLayer> {
  const response = await esriRequest("./data/city-times.json", {
    responseType: "json",
  });

  const geoJSON: GeoJSON = {
    type: "FeatureCollection",
    features: [],
  };

  response.data.forEach((city: CityTimes) => {
    const t0Hour = Number(city.ECLIPSE[0].split(":")[0]);
    const t0Minute = Number(city.ECLIPSE[0].split(":")[1]);
    const t0Second = Number(city.ECLIPSE[0].split(":")[2]);
    const t0 = new Date(Date.UTC(2024, 3, 8, t0Hour, t0Minute, t0Second)).getTime();

    const t1Hour = Number(city.ECLIPSE[1].split(":")[0]);
    const t1Minute = Number(city.ECLIPSE[1].split(":")[1]);
    const t1Second = Number(city.ECLIPSE[1].split(":")[2]);
    const t1 = new Date(Date.UTC(2024, 3, 8, t1Hour, t1Minute, t1Second)).getTime();

    const t2Hour = Number(city.ECLIPSE[2].split(":")[0]);
    const t2Minute = Number(city.ECLIPSE[2].split(":")[1]);
    const t2Second = Number(city.ECLIPSE[2].split(":")[2]);
    const t2 = new Date(Date.UTC(2024, 3, 8, t2Hour, t2Minute, t2Second)).getTime();

    const t3Hour = Number(city.ECLIPSE[3].split(":")[0]);
    const t3Minute = Number(city.ECLIPSE[3].split(":")[1]);
    const t3Second = Number(city.ECLIPSE[3].split(":")[2]);
    const t3 = new Date(Date.UTC(2024, 3, 8, t3Hour, t3Minute, t3Second)).getTime();

    const t4Hour = Number(city.ECLIPSE[4].split(":")[0]);
    const t4Minute = Number(city.ECLIPSE[4].split(":")[1]);
    const t4Second = Number(city.ECLIPSE[4].split(":")[2]);
    const t4 = new Date(Date.UTC(2024, 3, 8, t4Hour, t4Minute, t4Second)).getTime();

    geoJSON.features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [city.LON, city.LAT],
      },
      properties: {
        name: city.NAME,
        state: city.STATE,
        t0,
        t1,
        t2,
        t3,
        t4,
      },
    });
  });

  const blob = new Blob([JSON.stringify(geoJSON)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const cityTimes = new GeoJSONLayer({
    minScale: 1000000,
    outFields: ["*"],
    renderer: new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        color: new Color({
          r: 200,
          g: 200,
          b: 200,
        }),
        outline: {
          color: new Color({
            r: 100,
            g: 100,
            b: 100,
          }),
          width: 1,
        },
        size: 6,
      }),
    }),
    title: "City Eclipse Times",
    url,
  });

  return cityTimes;
}

// Query information about the map view
async function queryInformation(
  cityTimesLayer: GeoJSONLayer,
  penumbraLayer: GeoJSONLayer,
  durationlayer: GeoJSONLayer,
) {
  const { scale } = view;
  if (scale < 1000000) {
    noResultsNotice.hidden = true;

    const cityTimesQuery = new Query({
      geometry: view.extent,
      outFields: ["t0", "t4"],
    });

    const startTimes: number[] = [];
    const endTimes: number[] = [];

    const cityTimesQueryResult = await cityTimesLayer.queryFeatures(cityTimesQuery);
    if (cityTimesQueryResult.features.length) {
      cityTimesQueryResult.features.forEach((feature) => {
        const { t0, t4 } = feature.attributes;
        startTimes.push(t0);
        endTimes.push(t4);
      });

      const averageStartTime = new Date(startTimes.reduce((a, b) => a + b, 0) / startTimes.length);
      const averageEndTime = new Date(endTimes.reduce((a, b) => a + b, 0) / endTimes.length);

      const startTimeValue = averageStartTime.toLocaleTimeString();
      startTimeLabel.hidden = false;
      startTimeChip.hidden = false;
      startTimeChip.innerHTML = startTimeValue;
      startTimeChip.value = startTimeValue;

      const endTimeValue = averageEndTime.toLocaleTimeString();
      endTimeLabel.hidden = false;
      endTimeChip.innerHTML = endTimeValue;
      endTimeChip.hidden = false;
      endTimeChip.value = endTimeValue;
    } else {
      startTimeLabel.hidden = true;
      startTimeChip.hidden = true;
      startTimeChip.innerHTML = "";
      startTimeChip.value = "unknown";

      endTimeLabel.hidden = true;
      endTimeChip.hidden = true;
      endTimeChip.innerHTML = "";
      endTimeChip.value = "unknown";
    }

    const penumbraQuery = new Query({
      geometry: view.center,
      outFields: ["Obscuration"],
    });

    const penumbraQueryResult = await penumbraLayer.queryFeatures(penumbraQuery);

    if (penumbraQueryResult.features.length) {
      const obscurationValue = `${Math.round(penumbraQueryResult.features[0].attributes.Obscuration * 100)}%`;
      obscurationLabel.hidden = false;
      obscurationChip.hidden = false;
      obscurationChip.innerHTML = obscurationValue;
      obscurationChip.value = obscurationValue;
    } else {
      obscurationLabel.hidden = true;
      obscurationChip.hidden = true;
      obscurationChip.innerHTML = "";
      obscurationChip.value = "unknown";
    }

    const durationQuery = new Query({
      geometry: view.center,
      outFields: ["Duration"],
    });

    const durationQueryResult = await durationlayer.queryFeatures(durationQuery);

    if (durationQueryResult.features.length) {
      const durationValue = `${Math.round(durationQueryResult.features[0].attributes.Duration)} seconds`;
      durationLabel.hidden = false;
      durationChip.hidden = false;
      durationChip.innerHTML = durationValue;
      durationChip.value = durationValue;
    } else {
      durationLabel.hidden = true;
      durationChip.hidden = true;
      durationChip.innerHTML = "";
      durationChip.value = "unknown";
    }
  } else {
    noResultsNotice.hidden = false;
    startTimeLabel.hidden = true;
    startTimeChip.hidden = true;
    startTimeChip.innerHTML = "";
    startTimeChip.value = "unknown";

    endTimeLabel.hidden = true;
    endTimeChip.hidden = true;
    endTimeChip.innerHTML = "";
    endTimeChip.value = "unknown";

    obscurationLabel.hidden = true;
    obscurationChip.hidden = true;
    obscurationChip.innerHTML = "";
    obscurationChip.value = "unknown";

    durationLabel.hidden = true;
    durationChip.hidden = true;
    durationChip.innerHTML = "";
    durationChip.value = "unknown";
  }
}

// Set up the user interface
function setUp() {
  const toggleModalEl = document.getElementById("toggle-modal") as HTMLCalciteActionElement;
  const navigationEl = document.getElementById("nav") as HTMLCalciteNavigationElement;
  const panelEl = document.getElementById("sheet-panel") as HTMLCalcitePanelElement;
  const modalEl = document.getElementById("modal") as HTMLCalciteModalElement;
  const sheetEl = document.getElementById("sheet") as HTMLCalciteSheetElement;

  toggleModalEl?.addEventListener("click", () => handleModalChange());
  navigationEl?.addEventListener("calciteNavigationActionSelect", () => handleSheetOpen());

  panelEl?.addEventListener("calcitePanelClose", () => handlePanelClose());

  function handleModalChange() {
    if (modalEl) {
      modalEl.open = !modalEl.open;
    }
  }

  function handleSheetOpen() {
    sheetEl.open = true;
    panelEl.closed = false;
  }

  function handlePanelClose() {
    sheetEl.open = false;
  }
}
