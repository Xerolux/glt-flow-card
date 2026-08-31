import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, german) {
  let text = readFileSync(path, 'utf8');
  const start = '<!-- GLT-SHOWCASE:START -->';
  const end = '<!-- GLT-SHOWCASE:END -->';
  const block = german ? `${start}

## So sieht die GLT wirklich aus

Die Screenshots werden automatisch aus der **aktuellen GitHub-Pages-Oberfläche und dem aktuellen Online-Designer** erzeugt. Damit zeigt die README nicht mehr nur Konzeptgrafiken, sondern den tatsächlich gebauten Stand.

### Neo 2030 · detailliertes Anlagenbild

![GLT Flow Card Neo 2030 Live](docs/images/neo2030-live.png)

Das Schema geht bewusst bis auf Komponentenebene: Pumpen, Mischer, Ventile, hydraulische Weiche, Heizstab, Speicher, Wärmetauscher, Sensorik und weitere Betriebsmittel können als eigene GLT-Objekte dargestellt werden. Bedienbare Objekte öffnen in Home Assistant eine Objektbedienung bzw. können definierte HA-Services ausführen.

<table>
<tr><th width="50%">Operations Light</th><th width="50%">P&amp;ID Dark</th></tr>
<tr><td><img src="docs/images/operations-light-live.png" alt="Operations Light"></td><td><img src="docs/images/pid-dark-live.png" alt="P&ID Dark"></td></tr>
</table>

### Detail-Symbolbibliothek

![GLT Flow Card Symbolbibliothek](docs/images/symbol-library-live.png)

### Drag-&-Drop-Designer

![GLT Flow Card Designer](docs/images/designer-live.png)

${end}
` : `${start}

## What the GLT actually looks like

These screenshots are generated automatically from the **current GitHub Pages UI and current online designer**. The README therefore shows the implemented state rather than conceptual promo graphics.

### Neo 2030 · detailed plant view

![GLT Flow Card Neo 2030 Live](docs/images/neo2030-live.png)

The plant view is intentionally detailed down to equipment level: pumps, mixing valves, valves, hydraulic separators, immersion heaters, tanks, heat exchangers, sensors and further plant components can be individual GLT objects. Controllable objects can open an equipment control panel in Home Assistant or execute configured HA services.

<table>
<tr><th width="50%">Operations Light</th><th width="50%">P&amp;ID Dark</th></tr>
<tr><td><img src="docs/images/operations-light-live.png" alt="Operations Light"></td><td><img src="docs/images/pid-dark-live.png" alt="P&ID Dark"></td></tr>
</table>

### Detailed symbol library

![GLT Flow Card symbol library](docs/images/symbol-library-live.png)

### Drag-and-drop designer

![GLT Flow Card Designer](docs/images/designer-live.png)

${end}
`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'm');
  if (re.test(text)) text = text.replace(re, block);
  else {
    const anchor = german ? '## Funktionen' : '## Features';
    text = text.replace(anchor, `${block}\n${anchor}`);
  }
  text = text
    .replaceAll('docs/images/feature-overview.svg', 'docs/images/symbol-library-live.png')
    .replaceAll('docs/images/neo2030-dashboard.svg', 'docs/images/neo2030-live.png')
    .replaceAll('docs/images/ha-designer.svg', 'docs/images/designer-live.png')
    .replaceAll('docs/images/clean-designer.svg', 'docs/images/operations-light-live.png');
  writeFileSync(path, text);
}

patch('README.de.md', true);
patch('README.md', false);
