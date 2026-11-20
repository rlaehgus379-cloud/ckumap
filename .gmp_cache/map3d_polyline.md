# Add a 3D Polyline to a Photorealistic 3D Map

Draw connected line segments in 3D space on a Photorealistic 3D Map using the
`Polyline3DElement` or `Polyline3DInteractiveElement` classes from the `maps3d`
library.

## Prerequisites

-   **Add an interactive, photorealistic 3D map to a web page**: You must have a
    `Map3DElement` initialized and appended to the DOM, with the Maps JavaScript
    API loaded.

## Workflow

1.  **Import the `maps3d` library**: Load `Map3DElement` and `Polyline3DElement`
    (or `Polyline3DInteractiveElement` if click events are required) using
    `google.maps.importLibrary('maps3d')`.
2.  **Configure polyline options**: Define the coordinates array (`path` or
    `coordinates`) and visual styling properties (`strokeColor`, `strokeWidth`,
    `outerColor`, `outerWidth`, `altitudeMode`, `drawsOccludedSegments`,
    `extruded`, `geodesic`).
3.  **Instantiate the polyline**: Pass the options object to `new
    Polyline3DElement(options)` or `new Polyline3DInteractiveElement(options)`.
4.  **Attach event listeners (Optional)**: For `Polyline3DInteractiveElement`,
    attach a `gmp-click` listener using `addEventListener`.
5.  **Append to the 3D Map**: Call `map.append(polyline)` to render the polyline
    on the `Map3DElement`.

## Key Options & Styling Properties

Property                | Type                                            | Description
:---------------------- | :---------------------------------------------- | :----------
`path` / `coordinates`  | `Array<LatLngLiteral \| LatLngAltitudeLiteral>` | Ordered sequence of coordinates defining the line segments.
`strokeColor`           | `string`                                        | Color of the inner stroke (e.g., `"#0000FF"` or `"blue"`).
`strokeWidth`           | `number`                                        | Width of the line in pixels.
`outerColor`            | `string`                                        | Color of the outer border stroke (e.g., `"#FFFFFF"` or `"white"`).
`outerWidth`            | `number`                                        | Value between `0.0` and `1.0`, interpreted as a percentage of `strokeWidth`.
`altitudeMode`          | `string`                                        | How altitude components in coordinates are interpreted (e.g., `'RELATIVE_TO_GROUND'`, `'ABSOLUTE'`, `'CLAMP_TO_GROUND'`).
`drawsOccludedSegments` | `boolean`                                       | Whether parts of the polyline obscured by 3D objects (such as buildings) should be drawn through them.
`extruded`              | `boolean`                                       | Whether the elevated polyline should be connected vertically to the ground.
`geodesic`              | `boolean`                                       | Whether line segments follow the curvature of the Earth or are drawn as straight lines.

## Code Examples

### Basic 3D Polyline

Use `Polyline3DElement` to render a static 3D line overlay on a `Map3DElement`.

```javascript
let map;

async function init() {
  const { Map3DElement, Polyline3DElement } =
    await google.maps.importLibrary('maps3d');

  map = new Map3DElement({
    center: { lat: 37.7927, lng: -122.402, altitude: 65.93 },
    range: 3362.87,
    tilt: 64.01,
    heading: 25.0,
    mode: 'SATELLITE',
  });
  map.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');

  document.body.append(map);

  const polyline = new Polyline3DElement({
    path: [
      { lat: 37.80515638571346, lng: -122.4032569467164 },
      { lat: 37.80337073509504, lng: -122.4012878349353 },
      { lat: 37.79925208843463, lng: -122.3976697250461 },
      { lat: 37.7989102378512, lng: -122.3983408725656 },
      { lat: 37.79887832784348, lng: -122.3987094864192 },
      { lat: 37.79786443410338, lng: -122.4066878788802 },
      { lat: 37.79549248916587, lng: -122.4032992702785 },
      { lat: 37.78861484290265, lng: -122.4019489189814 },
      { lat: 37.78618687561075, lng: -122.398969592545 },
      { lat: 37.7892310309145, lng: -122.3951458683092 },
      { lat: 37.7916358762409, lng: -122.3981969390652 },
    ],
    strokeColor: 'blue',
    outerColor: 'white',
    strokeWidth: 10,
    outerWidth: 0.4,
    altitudeMode: 'RELATIVE_TO_GROUND', // Place on the ground if no altitude is specified
    drawsOccludedSegments: true, // Show the line through buildings
  });

  map.append(polyline);
}

void init();
```

### Interactive 3D Polyline

Use `Polyline3DInteractiveElement` to listen for `gmp-click` events and
dynamically update properties on the polyline instance.

```javascript
let map;

async function init() {
  const { Map3DElement, Polyline3DInteractiveElement } =
    await google.maps.importLibrary('maps3d');

  map = new Map3DElement({
    center: { lat: 37.7927, lng: -122.402, altitude: 65.93 },
    range: 3362.87,
    tilt: 64.01,
    heading: 25.0,
    mode: 'SATELLITE',
  });
  map.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');

  document.body.append(map);

  const polyline = new Polyline3DInteractiveElement({
    coordinates: [
      { lat: 37.80515638571346, lng: -122.4032569467164 },
      { lat: 37.80337073509504, lng: -122.4012878349353 },
      { lat: 37.79925208843463, lng: -122.3976697250461 },
      { lat: 37.7989102378512, lng: -122.3983408725656 },
      { lat: 37.79887832784348, lng: -122.3987094864192 },
      { lat: 37.79786443410338, lng: -122.4066878788802 },
      { lat: 37.79549248916587, lng: -122.4032992702785 },
      { lat: 37.78861484290265, lng: -122.4019489189814 },
      { lat: 37.78618687561075, lng: -122.398969592545 },
      { lat: 37.7892310309145, lng: -122.3951458683092 },
      { lat: 37.7916358762409, lng: -122.3981969390652 },
    ],
    strokeColor: 'blue',
    outerColor: 'white',
    strokeWidth: 10,
    outerWidth: 0.4,
    altitudeMode: 'RELATIVE_TO_GROUND',
    drawsOccludedSegments: true,
  });

  polyline.addEventListener('gmp-click', function () {
    // Toggle whether the line draws occluded segments behind buildings
    this.drawsOccludedSegments = !this.drawsOccludedSegments;
  });

  map.append(polyline);
}

void init();
```

## Lifecycle & Resource Cleanup

Because `Polyline3DElement` and `Polyline3DInteractiveElement` are standard DOM
custom elements appended to `<gmp-map-3d>`, remove them from the map using
standard DOM removal methods:

```javascript
// Remove the polyline from the 3D map
polyline.remove();
```
