# joetouchman.com

Source for my personal website: [joetouchman.com](https://joetouchman.com).

Plain HTML, CSS and JavaScript. No framework and no build step.

```
index.html        home: contact, project cards, about
hand.html         JoebotHand project page (with the live hand-tracking demo)
citrus.html       FRC 1678 Citrus Circuits page
vex.html          VEX V5 robots page
css/style.css     all styling
js/main.js        shared behaviour: nav, scroll reveals, looping clips, YouTube
js/hand-demo.js   the "Try it" demo on hand.html (hand tracking + curl math)
js/hand-3d.js     the 3D hand the demo drives (three.js)
assets/           web-ready images, video, audio and the 3D model
tools/            script that makes the web-sized 3D model
```

## Run it locally

```bash
python3 -m http.server 4321
```

Then open http://localhost:4321.

## Updating the 3D hand

`assets/models/hand.glb` is a slimmed copy of my Blender model (about 350k triangles
down to about 83k). After changing `Media/Hand3D/Hand3D.blend`, rebuild it with:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b Media/Hand3D/Hand3D.blend --python tools/optimize_hand.py -- assets/models/hand.glb
```

The model needs every finger segment as its own object (`Index1` ... `Thumb2`) with its
origin on the hinge, and two keyframes: fully open first, fully closed last.

## To do

- [ ] LinkedIn link (placeholder in the contact list in `index.html`)
- [ ] Resume PDF
- [ ] Public link to the 1678 scouting whitepaper and app repositories
