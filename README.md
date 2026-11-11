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
js/hand-demo.js   the "Try it" demo on hand.html
assets/           web-ready images and video
```

## Run it locally

```bash
python3 -m http.server 4321
```

Then open http://localhost:4321.

## To do

- [ ] LinkedIn link (placeholder in the contact list in `index.html`)
- [ ] Resume PDF
- [ ] Public link to the 1678 scouting whitepaper and app repositories
- [ ] Replace the drawn hand in the demo with the 3D model
