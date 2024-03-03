import Color from "@arcgis/core/Color";
import Map from "@arcgis/core/Map";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import type Geometry from "@arcgis/core/geometry/Geometry";
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
const durationListItem = document.querySelector("#duration-list-item") as HTMLCalciteListItemElement;
const endTimeChip = document.querySelector("#end-time-chip") as HTMLCalciteChipElement;
const endTimeListItem = document.querySelector("#end-time-list-item") as HTMLCalciteListItemElement;
const noResultsNotice = document.querySelector("#no-results-notice") as HTMLCalciteNoticeElement;
const obscurationChip = document.querySelector("#obscuration-chip") as HTMLCalciteChipElement;
const obscurationListItem = document.querySelector("#obscuration-list-item") as HTMLCalciteListItemElement;
const queryResultsBlock = document.querySelector("#query-results-block") as HTMLCalciteBlockElement;
const startTimeChip = document.querySelector("#start-time-chip") as HTMLCalciteChipElement;
const startTimeListItem = document.querySelector("#start-time-list-item") as HTMLCalciteListItemElement;

// Set up the user interface
setUp();

// Set the user's timezone in the query results panel
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
queryResultsBlock.description = `${timeZone} timezone`;

// Step 1: Create a map and view
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

// When the view is ready
view.when(async () => {
  // Create a GeoJSON layers for the eclipse
  // Step 2: Create center layer
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
  map.add(centerLayer);

  // Step 3: Create additional GeoJSON layers for the duration, penumbra, and totality
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
    portalItem: {
      id: "ce751a1140f741ae91fd5947ff2f28d9",
    },
  });

  map.addMany([penumbraLayer, durationLayer, totalityLayer]);
  map.layers.reorder(centerLayer, map.layers.length - 1);

  // Step 4 - Create a GeoJSON layer for the cities and their eclipse times
  const cityTimesLayer = await createCityTimesLayer();
  map.add(cityTimesLayer);

  // Step 5 - Create the cloud cover layer
  // Create a label class for the cloud cover layer
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
    portalItem: {
      id: "c7bb3ecf141c420f8e6bf409f9d3390d",
    },
    visible: false,
  });
  map.add(cloudCoverLayer);

  // Step 6 - Create a CSVLayer for festivals
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
  map.add(festivalsLayer);

  // Step 7 - Create popups
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

  // Step 8 - Create a LayerList widget
  // Create a LayerList widget
  new LayerList({
    container: "layer-list-panel",
    view,
    visibilityAppearance: "checkbox",
  });

  // Step 9 - Watch for when the view is stationary and query information
  // Watch for when the view is stationary and query information
  reactiveUtils.watch(
    () => view.stationary,
    (stationary) => {
      stationary && queryInformation(cityTimesLayer, penumbraLayer, durationLayer);
    },
  );
});

/**
 * Create a GeoJSON layer for the cities and their eclipse times
 *
 * @returns Promise<GeoJSONLayer>
 */
async function createCityTimesLayer(): Promise<GeoJSONLayer> {
  const response = await esriRequest("./data/city-times.json", {
    responseType: "json",
  });

  const geoJSON: GeoJSON = {
    type: "FeatureCollection",
    features: [],
  };

  response.data.forEach((city: CityTimes) => {
    const t0 = parseTimeAndCreateDate(city.ECLIPSE[0]);
    const t1 = parseTimeAndCreateDate(city.ECLIPSE[1]);
    const t2 = parseTimeAndCreateDate(city.ECLIPSE[2]);
    const t3 = parseTimeAndCreateDate(city.ECLIPSE[3]);
    const t4 = parseTimeAndCreateDate(city.ECLIPSE[4]);

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

  // create a new blob from the GeoJSON feature collection
  const blob = new Blob([JSON.stringify(geoJSON)], {
    type: "application/json",
  });

  // create a URL for the blob
  const url = URL.createObjectURL(blob);

  // create a new GeoJSONLayer using the blob URL
  const cityTimesGeoJSONLayer = new GeoJSONLayer({
    minScale: 2311162, // zoom 8
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

  return cityTimesGeoJSONLayer;
}

/**
 * Parse a time string and create a date object
 *
 * @param timeString
 */
function parseTimeAndCreateDate(timeString: string): number {
  const [hour, minute, second] = timeString.split(":").map(Number);
  return new Date(Date.UTC(2024, 3, 8, hour, minute, second)).getTime();
}

/**
 * Query information about the layers at the center of the map view
 *
 * @param cityTimesLayer
 * @param penumbraLayer
 * @param durationlayer
 */
async function queryInformation(
  cityTimesLayer: GeoJSONLayer,
  penumbraLayer: GeoJSONLayer,
  durationlayer: GeoJSONLayer,
) {
  const { zoom } = view;
  if (zoom > 8) {
    noResultsNotice.hidden = true;

    const query = (layer: GeoJSONLayer, geometry: Geometry, outFields: string[]) =>
      layer.queryFeatures(new Query({ geometry, outFields }));

    const averageTime = (times: number[]) =>
      new Date(times.reduce((a, b) => a + b, 0) / times.length).toLocaleTimeString();

    const cityTimesQueryResult = await query(cityTimesLayer, view.extent, ["t0", "t4"]);
    if (cityTimesQueryResult.features.length) {
      const startTimes = cityTimesQueryResult.features.map((feature) => feature.attributes.t0);
      const endTimes = cityTimesQueryResult.features.map((feature) => feature.attributes.t4);
      updateQueryPanel(startTimeListItem, startTimeChip, averageTime(startTimes));
      updateQueryPanel(endTimeListItem, endTimeChip, averageTime(endTimes));
    } else {
      updateQueryPanel(startTimeListItem, startTimeChip, "unknown");
      updateQueryPanel(endTimeListItem, endTimeChip, "unknown");
    }

    const penumbraQueryResult = await query(penumbraLayer, view.center, ["Obscuration"]);
    updateQueryPanel(
      obscurationListItem,
      obscurationChip,
      penumbraQueryResult.features.length
        ? `${Math.round(penumbraQueryResult.features[0].attributes.Obscuration * 100)}%`
        : "unknown",
    );

    const durationQueryResult = await query(durationlayer, view.center, ["Duration"]);
    updateQueryPanel(
      durationListItem,
      durationChip,
      durationQueryResult.features.length
        ? `${Math.round(durationQueryResult.features[0].attributes.Duration)} seconds`
        : "unknown",
    );
  } else {
    noResultsNotice.hidden = false;
    updateQueryPanel(startTimeListItem, startTimeChip, "unknown");
    updateQueryPanel(endTimeListItem, endTimeChip, "unknown");
    updateQueryPanel(obscurationListItem, obscurationChip, "unknown");
    updateQueryPanel(durationListItem, durationChip, "unknown");
  }
}

/**
 * Set up the user interface
 */
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

/**
 * Update list item with the given value
 *
 * @param listItem
 * @param chip
 * @param value
 */
function updateQueryPanel(listItem: HTMLCalciteListItemElement, chip: HTMLCalciteChipElement, value: string) {
  if (value === "unknown") {
    listItem.closed = true;
    chip.hidden = true;
    chip.innerHTML = "";
    chip.value = value;
    return;
  }
  listItem.closed = false;
  chip.hidden = false;
  chip.innerHTML = value;
  chip.value = value;
}
