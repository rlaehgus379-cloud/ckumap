# Add a 3D Polygon to a Photorealistic 3D Map

A polygon represents an area enclosed by a closed path (or loop), defined by an
ordered sequence of `LatLng` coordinates. In 3D Maps in Maps JavaScript API, you
use the `Polygon3DElement` or `Polygon3DInteractiveElement` classes to draw
polygons with customizable strokes, fills, altitude modes, and complex
geometries (such as holes or multiple non-contiguous areas).

## Prerequisites

-   **Interactive 3D Map Setup**: Ensure you have a web page configured with the
    Maps JavaScript API dynamic library loader and a rendered `Map3DElement`
    (`<gmp-map-3d>`).

--------------------------------------------------------------------------------

## Core Concepts & Options

Polygons in 3D maps are drawn with a **stroke** (edge) and a **fill** (enclosed
area).

### Styling & Geometry Options

When constructing a `Polygon3DElement` or `Polygon3DInteractiveElement`, you can
pass an options object or set properties directly after instantiation:

-   **`strokeColor`**: Hexadecimal HTML color format (e.g., `"#0000ff"` or
    `"#0000ff80"` with alpha). **Note:** Color names (like `'red'`) are not
    supported for polygons.
-   **`strokeWidth`**: The width of the polygon's edge in pixels.
-   **`outerColor`**: A hexadecimal HTML color (`"#FFFFFF"`) for the outer edge
    of the stroke.
-   **`outerWidth`**: A numerical value between `0.0` and `1.0`, interpreted as
    a percentage of the `strokeWidth`.
-   **`fillColor`**: Hexadecimal HTML color format (e.g., `"#ff000080"`) for the
    enclosed area. Color names are not supported.
-   **`altitudeMode`**: Specifies how altitude components in the coordinates are
    interpreted (e.g., `'RELATIVE_TO_GROUND'`, `'ABSOLUTE'`,
    `'CLAMP_TO_GROUND'`).
-   **`drawsOccludedSegments`**: A boolean indicating whether parts of the
    polygon obscured by 3D objects (such as buildings) should remain visible
    (`true`) or be hidden behind them (`false`).
-   **`extruded`**: A boolean indicating if the polygon should be connected to
    the ground.
-   **`geodesic`**: A boolean indicating whether the edges of the polygon follow
    the curvature of the earth or are drawn as straight lines.

### Defining Paths

-   **Basic Polygons**: For a single enclosed area, assign a single array of
    `LatLng` coordinates to the `path` property. The API automatically converts
    this single array into an array of arrays upon construction.
-   **Complex Polygons (Holes & Multi-Polygons)**: Because a polygonal area can
    include several separate paths (such as non-contiguous areas or inner
    holes), `Polygon3DElement` supports an array of arrays of `LatLng`
    coordinates. To create a hole, define an outer path and an inner path wound
    in the opposite direction.

--------------------------------------------------------------------------------

## Implementation Workflows

### 1. Add a Basic 3D Polygon

To add a static 3D polygon, import `Map3DElement` and `Polygon3DElement` from
the `maps3d` library, configure the styling options, assign the coordinate array
to `path`, and append the polygon element to the `Map3DElement`.

```javascript
async function init() {
    const { Map3DElement, Polygon3DElement } =
        await google.maps.importLibrary('maps3d');

    const map3DElement = new Map3DElement({
        center: { lat: 40.6842, lng: -74.0019, altitude: 1000 },
        heading: 340,
        tilt: 70,
        mode: 'HYBRID',
    });
    map3DElement.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');

    const polygonOptions = {
        strokeColor: '#0000ff80',
        strokeWidth: 8,
        fillColor: '#ff000080',
        drawsOccludedSegments: false,
    };

    const examplePolygon = new Polygon3DElement(polygonOptions);

    // Define the ordered sequence of coordinates
    examplePolygon.path = [
        { lat: 40.7144, lng: -74.0208 },
        { lat: 40.6993, lng: -74.019 },
        { lat: 40.7035, lng: -74.0004 },
    ];

    map3DElement.append(examplePolygon);
    document.body.append(map3DElement);
}

void init();
```

### 2. Add an Interactive 3D Polygon

To respond to user clicks on a 3D polygon, import `Polygon3DInteractiveElement`
instead of `Polygon3DElement` and attach a `'gmp-click'` event listener.

```javascript
async function init() {
    const { Map3DElement, Polygon3DInteractiveElement } =
        await google.maps.importLibrary('maps3d');

    const map = new Map3DElement({
        center: { lat: 40.6842, lng: -74.0019, altitude: 1000 },
        heading: 340,
        tilt: 70,
        mode: 'HYBRID',
    });
    map.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');

    document.body.append(map);

    const polygonOptions = {
        strokeColor: '#0000ff80',
        strokeWidth: 8,
        fillColor: '#ff000080',
        drawsOccludedSegments: false,
    };

    const examplePolygon = new Polygon3DInteractiveElement(polygonOptions);

    examplePolygon.path = [
        { lat: 40.7144, lng: -74.0208 },
        { lat: 40.6993, lng: -74.019 },
        { lat: 40.7035, lng: -74.0004 },
        { lat: 40.7144, lng: -74.0208 },
    ];

    // Listen for the gmp-click event to dynamically update styles
    examplePolygon.addEventListener('gmp-click', function (event) {
        this.fillColor = randomizeHexColor(this.fillColor);
        this.strokeColor = randomizeHexColor(this.strokeColor);
        console.log('Polygon clicked:', event);
    });

    map.append(examplePolygon);
}

function randomizeHexColor(originalHexColor) {
    const alpha = originalHexColor.substring(7);

    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);

    const rHex = ('0' + r.toString(16)).slice(-2);
    const gHex = ('0' + g.toString(16)).slice(-2);
    const bHex = ('0' + b.toString(16)).slice(-2);

    return `#${rHex}${gHex}${bHex}${alpha}`;
}

void init();
```

--------------------------------------------------------------------------------

## Common Pitfalls & Best Practices

1.  **Hexadecimal Colors Required**: Unlike `Polyline3DElement` or 2D
    `google.maps.Polygon`, `Polygon3DElement` requires colors (`strokeColor`,
    `fillColor`, `outerColor`) to be specified in hexadecimal HTML format (e.g.,
    `'#ff0000'` or `'#ff000080'`). CSS color names like `'red'` or `'blue'` are
    not supported.
2.  **Interactive vs. Static Elements**: Standard `Polygon3DElement` instances
    do not fire click events. If your application requires click interaction,
    you must instantiate `Polygon3DInteractiveElement` and listen for the
    `'gmp-click'` event (not `'click'`).
3.  **DOM Appending**: 3D map shapes are Custom Elements (Web Components).
    Instead of calling `polygon.setMap(map)` (the 2D Maps pattern), you add the
    polygon to the 3D map using standard DOM methods like
    `map3DElement.append(examplePolygon)`.
4.  **Auto-closing Paths**: While closing the loop by repeating the first
    coordinate at the end of the `path` array is good practice, the API will
    automatically connect the last coordinate back to the first coordinate if
    omitted.

--------------------------------------------------------------------------------

## Reference Links

-   **3D Maps Polygon Reference**:
    [https://developers.google.com/maps/documentation/javascript/reference/3d-map#Polygon3DElement](https://developers.google.com/maps/documentation/javascript/reference/3d-map#Polygon3DElement)
-   **2D Polygon Samples (Path & Hole Concepts)**:
    -   [https://github.com/googlemaps/js-samples/blob/HEAD/samples/polygon-simple/index.ts?utm_campaign=gmp_git_agentskills_v1](https://github.com/googlemaps/js-samples/blob/HEAD/samples/polygon-simple/index.ts?utm_campaign=gmp_git_agentskills_v1)
    -   [https://github.com/googlemaps/js-samples/blob/HEAD/samples/polygon-hole/index.ts?utm_campaign=gmp_git_agentskills_v1](https://github.com/googlemaps/js-samples/blob/HEAD/samples/polygon-hole/index.ts?utm_campaign=gmp_git_agentskills_v1)
