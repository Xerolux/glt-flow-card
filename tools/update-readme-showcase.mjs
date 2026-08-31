import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, german) {
  let text = readFileSync(path, 'utf8');
  const start = '<!-- GLT-SHOWCASE:START -->';
  const end = '<!-- GLT-SHOWCASE:END -->';
  const block = german ? `${start}

## GLT / SCADA Showcase

Die folgenden Bilder werden automatisch aus der **aktuellen GitHub-Pages-Oberfläche und dem aktuellen Online-Designer** erzeugt. Sie zeigen dieselbe detaillierte Anlage in unterschiedlichen Darstellungen — ohne eigene Anlagenbilder: Pumpen, 2-/3-Wege-Ventile, Mischer, hydraulische Weiche, Heizstab, Speicher, Wärmetauscher, Sensorik, Medienleitungen, Alarme, Replay und Trends.

<table>
<tr><th width="50%">Neo 2030 · Dark</th><th width="50%">Neo / Operations · Light</th></tr>
<tr><td><img src="docs/images/neo2030-dark-live.png" alt="Neo 2030 Dark GLT"></td><td><img src="docs/images/neo2030-light-live.png" alt="Neo 2030 Light GLT"></td></tr>
</table>

<table>
<tr><th width="50%">Classic SCADA</th><th width="50%">P&amp;ID Dark</th></tr>
<tr><td><img src="docs/images/classic-scada-live.png" alt="Classic SCADA GLT"></td><td><img src="docs/images/pid-dark-live.png" alt="P&ID Dark GLT"></td></tr>
</table>

### Designer · Dark und Light

<table>
<tr><th width="50%">Designer Dark</th><th width="50%">Designer Light</th></tr>
<tr><td><img src="docs/images/designer-dark-live.png" alt="GLT Flow Card Designer Dark"></td><td><img src="docs/images/designer-light-live.png" alt="GLT Flow Card Designer Light"></td></tr>
</table>

### Detail-Symbolbibliothek

![GLT Flow Card Symbolbibliothek](docs/images/symbol-library-live.png)

> Bedienbare Anlagenobjekte können in Home Assistant eine Objektbedienung öffnen oder konfigurierte HA-Services ausführen. Die GitHub-Pages-Demo simuliert diese Bedienebene ohne eine echte Anlage zu schalten.

${end}
` : `${start}

## GLT / SCADA showcase

The following images are generated automatically from the **current GitHub Pages UI and current online designer**. They show the same detailed plant in different visual systems — without custom plant images: pumps, 2/3-way valves, mixers, hydraulic separators, immersion heaters, tanks, heat exchangers, sensors, media paths, alarms, replay and trends.

<table>
<tr><th width="50%">Neo 2030 · Dark</th><th width="50%">Neo / Operations · Light</th></tr>
<tr><td><img src="docs/images/neo2030-dark-live.png" alt="Neo 2030 Dark GLT"></td><td><img src="docs/images/neo2030-light-live.png" alt="Neo 2030 Light GLT"></td></tr>
</table>

<table>
<tr><th width="50%">Classic SCADA</th><th width="50%">P&amp;ID Dark</th></tr>
<tr><td><img src="docs/images/classic-scada-live.png" alt="Classic SCADA GLT"></td><td><img src="docs/images/pid-dark-live.png" alt="P&ID Dark GLT"></td></tr>
</table>

### Designer · dark and light

<table>
<tr><th width="50%">Designer Dark</th><th width="50%">Designer Light</th></tr>
<tr><td><img src="docs/images/designer-dark-live.png" alt="GLT Flow Card Designer Dark"></td><td><img src="docs/images/designer-light-live.png" alt="GLT Flow Card Designer Light"></td></tr>
</table>

### Detailed symbol library

![GLT Flow Card symbol library](docs/images/symbol-library-live.png)

> Controllable plant objects can open an equipment control panel in Home Assistant or execute configured HA services. The GitHub Pages demo simulates this control layer without switching a real plant.

${end}
`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'm');
  if (re.test(text)) text = text.replace(re, block);
  else {
    const anchor = german ? '## Funktionen' : '## Highlights';
    text = text.replace(anchor, `${block}\n${anchor}`);
  }
  text = text
    .replaceAll('docs/images/feature-overview.svg', 'docs/images/symbol-library-live.png')
    .replaceAll('docs/images/neo2030-dashboard.svg', 'docs/images/neo2030-dark-live.png')
    .replaceAll('docs/images/neo2030-live.png', 'docs/images/neo2030-dark-live.png')
    .replaceAll('docs/images/operations-light-live.png', 'docs/images/neo2030-light-live.png')
    .replaceAll('docs/images/ha-designer.svg', 'docs/images/designer-dark-live.png')
    .replaceAll('docs/images/designer-live.png', 'docs/images/designer-dark-live.png')
    .replaceAll('docs/images/clean-designer.svg', 'docs/images/designer-light-live.png');
  writeFileSync(path, text);
}

patch('README.de.md', true);
patch('README.md', false);
