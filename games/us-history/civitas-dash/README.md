# Civitas Dash

GitHub Pages path recommendation:

```text
games/us-history/civitas-dash/
  index.html
  css/dash.css
  js/engine.js
  js/progress.js
  data/unit1.js
  data/unit2.js
```

Main link from your Civitas hub:

```html
<a href="games/us-history/civitas-dash/index.html">Civitas Dash</a>
```

This split keeps the current prototype behavior while making future edits easier:

- `index.html` keeps the page shell/screens.
- `css/dash.css` holds all styling.
- `data/unit1.js` holds the current Unit 1 world/round/question data.
- `data/unit2.js` is a safe placeholder scaffold.
- `js/progress.js` handles identity, Supabase/localStorage, and progress rollups.
- `js/engine.js` handles UI rendering and gameplay.
