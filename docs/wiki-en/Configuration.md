# Configuration reference

The core blocks are:

```yaml
type: custom:glt-flow-card
appearance: {}
canvas: {}
views: []
sites: []
equipment: []
paths: []
datapoints: []
kpis: []
alarms: []
assets: []
groups: []
permissions: {}
replay: {}
trend: {}
reports: {}
routing: {}
```

The designer writes the same structure. Unknown keys are not deliberately removed by the YAML round-trip.

## Theme-following status colours

```yaml
appearance:
  mode: neo2030
  # "auto" (default): the status palette (OK/warning/error/info) follows the
  #        Home Assistant theme's light/dark mode. It used to answer only the
  #        operating system's setting, which disagreed with a dark dashboard
  #        theme on a light machine. Without a hass object (standalone
  #        designer) the operating system still decides.
  # "system": previous behaviour, the operating system decides alone.
  status_colours: auto
```

The card also renders on demand: when Home Assistant publishes a state object that touches none of the configured entities, the language, the user, or the theme mode, the card skips the full shadow-DOM rebuild. On busy buses this cuts render load noticeably without the screen becoming any less current.
