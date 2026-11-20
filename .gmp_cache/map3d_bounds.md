# Control Camera Restrictions on a Photorealistic 3D Map

## Overview

Control the camera's movement, pan, altitude, tilt, heading, and user scroll
interactions on a Photorealistic 3D Map (`<gmp-map-3d>`) using camera
restrictions and gesture handling options.

## Prerequisites

-   **Add an interactive, photorealistic 3D map to a web page**: You must have a
    `<gmp-map-3d>` element initialized on your page and the `maps3d` library
    loaded via `google.maps.importLibrary('maps3d')`.

--------------------------------------------------------------------------------

## Implementation Workflow

### 1. Restrict Geographical Map Bounds

To limit the latitude and longitude area where a user can pan the camera, set
the `bounds` property on the `gmp-map-3d` element using a `LatLngBoundsLiteral`
object (`north`, `south`, `east`, `west`).

#### JavaScript

```javascript
async function init() {
    await google.maps.importLibrary('maps3d');

    const map3DElement = document.querySelector('gmp-map-3d');

    // Restrict the position of the camera to the specified geographical bounds.
    map3DElement.bounds = {
        south: -48.3,
        west: 163.56,
        north: -32.86,
        east: -180,
    };
}

void init();
```

#### TypeScript

```typescript
async function init(): Promise<void> {
    await google.maps.importLibrary('maps3d');

    const map3DElement = document.querySelector('gmp-map-3d')!;

    // Restrict the position of the camera to the specified geographical bounds.
    map3DElement.bounds = {
        south: -48.3,
        west: 163.56,
        north: -32.86,
        east: -180,
    };
}

void init();
```

--------------------------------------------------------------------------------

### 2. Restrict Camera Altitude, Heading, and Tilt

You can constrain the 3D camera's orientation and elevation by configuring the
following properties on the `gmp-map-3d` element:

-   `maxAltitude` / `minAltitude`: Maximum and minimum camera elevation (in
    meters).
-   `maxHeading` / `minHeading`: Maximum and minimum compass heading (in
    degrees).
-   `maxTilt` / `minTilt`: Maximum and minimum camera tilt angle (in degrees).

```javascript
// Restrict the movement and angle of the camera.
map3DElement.maxAltitude = 1000;
map3DElement.minAltitude = 500;
map3DElement.maxTilt = 55;
map3DElement.minTilt = 35;
```

--------------------------------------------------------------------------------

### 3. Combine Map and Camera Bounds

You can apply geographical `bounds` and camera orientation/altitude restrictions
simultaneously:

```javascript
async function init() {
    await google.maps.importLibrary('maps3d');

    const map3DElement = document.querySelector('gmp-map-3d');

    // Restrict the movement of the camera.
    map3DElement.maxAltitude = 1000;
    map3DElement.minAltitude = 500;
    map3DElement.maxTilt = 55;
    map3DElement.minTilt = 35;

    // Restrict the position of the camera to the specified bounds.
    map3DElement.bounds = {
        north: 20.93,
        west: -156.38,
        south: 20.90,
        east: -156.31,
    };
}

void init();
```

--------------------------------------------------------------------------------

### 4. Control Gesture Handling

When a user scrolls a page containing a 3D map, the scrolling action can
inadvertently cause the map to zoom or pan. Control this behavior using the
`gesture-handling` HTML attribute (or `gestureHandling` property in JavaScript):

Option            | Behavior
:---------------- | :-------
**`cooperative`** | Allows the user to scroll the page without impacting the map's zoom or pan. Users can zoom using map controls, two-finger touch gestures, or by holding `CMD`/`CTRL` while scrolling.
**`greedy`**      | The map reacts to all scroll events and touch gestures immediately.
**`auto`**        | Adjusts automatically based on context: uses `cooperative` if the map is inside an `<iframe>`, and `greedy` if it is not inside an `<iframe>`.

```html
<gmp-map-3d
    id="gmp-map-3d"
    center="20.92,-156.36,500"
    tilt="67.5"
    mode="hybrid"
    gesture-handling="cooperative"
    internal-usage-attribution-ids="gmp_git_agentskills_v1">
</gmp-map-3d>
```

--------------------------------------------------------------------------------

## Complete Example

The following complete HTML, CSS, and JavaScript example demonstrates
initializing a 3D map with `cooperative` gesture handling and restricting its
geographical bounds.

### HTML (`index.html`)

```html
<!DOCTYPE html>
<html>
    <head>
        <title>3D Map Camera Restrictions</title>
        <link rel="stylesheet" type="text/css" href="./style.css" />
        <script type="module" src="./index.js"></script>
        <script>
            // prettier-ignore
            (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
                key: "GOOGLE_MAPS_API_KEY"
            });
        </script>
    </head>
    <body>
        <gmp-map-3d
            id="gmp-map-3d"
            center="-47.1375,169.5235,150000"
            tilt="67.5"
            mode="hybrid"
            gesture-handling="cooperative"
            internal-usage-attribution-ids="gmp_git_agentskills_v1">
        </gmp-map-3d>
    </body>
</html>
```

### CSS (`style.css`)

```css
html,
body {
    height: 100%;
    margin: 0;
    padding: 0;
}
```

### JavaScript (`index.js`)

```javascript
async function init() {
    await google.maps.importLibrary('maps3d');

    const map3DElement = document.querySelector('gmp-map-3d');

    // Restrict the position of the camera to the specified bounds.
    map3DElement.bounds = {
        south: -48.3,
        west: 163.56,
        north: -32.86,
        east: -180,
    };
}

void init();
```

--------------------------------------------------------------------------------

## Reference Resources

-   [Using TypeScript and Google Maps](https://developers.google.com/maps/documentation/javascript/using-typescript)
-   [2D Map Bounds Restriction Sample](https://github.com/googlemaps/js-samples/blob/HEAD/samples/control-bounds-restriction/index.ts?utm_campaign=gmp_git_agentskills_v1)
-   [Cooperative Gesture Handling Sample](https://github.com/googlemaps/js-samples/blob/HEAD/samples/conserve-map-on-scroll/index.ts?utm_campaign=gmp_git_agentskills_v1)
