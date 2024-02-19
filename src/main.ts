import Color from "@arcgis/core/Color";
import Map from "@arcgis/core/Map";
import CSVLayer from "@arcgis/core/layers/CSVLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import LabelClass from "@arcgis/core/layers/support/LabelClass";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import OpacityVariable from "@arcgis/core/renderers/visualVariables/OpacityVariable";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import MapView from "@arcgis/core/views/MapView";
import Expand from "@arcgis/core/widgets/Expand";
import LayerList from "@arcgis/core/widgets/LayerList";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
import "./style.css";
import { cloudSymbol, sunSymbol } from "./symbols";

defineCustomElements(window, {
  resourcesUrl: "https://js.arcgis.com/calcite-components/2.4.0/assets",
});
setUp();

// Create a GeoJSON layers for the eclipse
const centerLayer = new GeoJSONLayer({
  renderer: new SimpleRenderer({
    symbol: new SimpleLineSymbol({
      color: "red",
      width: 2,
    }),
  }),
  title: "Center",
  url: "./data/center.geojson",
});

const penumbraLayer = new GeoJSONLayer({
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
        field: "Obscuratio",
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

const durationLayer = new GeoJSONLayer({
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

const totalityLayer = new GeoJSONLayer({
  blendMode: "multiply",
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
});

// Create a CSVLayer for festivals
const festivalsLayer = new CSVLayer({
  renderer: new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({}),
  }),
  title: "Festivals",
  url: "./data/festivals.csv",
});

const map = new Map({
  layers: [penumbraLayer, totalityLayer, durationLayer, festivalsLayer, centerLayer, cloudCoverLayer],
  basemap: "streets-vector",
});

const view = new MapView({
  container: "viewDiv",
  map,
  zoom: 4,
  center: [-85, 35],
});

// Create a LayerList widget and add it to the view's UI
const layerList = new LayerList({
  view,
});
const layerListExpand = new Expand({
  view,
  content: layerList,
});

view.ui.add(layerListExpand, "top-left");

// Create popup templates for each layer
view.when(async () => {
  await centerLayer.load();
  await cloudCoverLayer.load();
  await durationLayer.load();
  await festivalsLayer.load();
  await penumbraLayer.load();
  await totalityLayer.load();

  centerLayer.popupTemplate = centerLayer.createPopupTemplate();
  cloudCoverLayer.popupTemplate = cloudCoverLayer.createPopupTemplate();
  durationLayer.popupTemplate = durationLayer.createPopupTemplate();
  festivalsLayer.popupTemplate = festivalsLayer.createPopupTemplate();
  penumbraLayer.popupTemplate = penumbraLayer.createPopupTemplate();
  totalityLayer.popupTemplate = totalityLayer.createPopupTemplate();
});

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
