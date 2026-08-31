import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';

const bundlePath=process.argv[2];
if(!bundlePath) throw new Error('usage: node tools/apply-v100.mjs <v1-bundle.js>');
const bundle=readFileSync(bundlePath,'utf8');
const marker='/*! GLT Flow Card v1 generated extension */';
const file='dist/glt-flow-card.js';
let src=readFileSync(file,'utf8');
const pos=src.indexOf(marker);
if(pos>=0) src=src.slice(0,pos).trimEnd()+'\n';
src=src.replace('const VERSION = "0.4.0";','const VERSION = "1.0.0";');
src=src.replace('const VERSION = "0.9.0";','const VERSION = "1.0.0";');
src=`${src.trimEnd()}\n\n${marker}\n${bundle.trim()}\n`;
writeFileSync(file,src);

mkdirSync('custom_components/glt_flow_card/www',{recursive:true});
cpSync(file,'custom_components/glt_flow_card/www/glt-flow-card.js');

const onlineMarker='/*! GLT Online Designer v1 Engineering extensions */';
let online=readFileSync('docs/editor/app.js','utf8');
const op=online.indexOf(onlineMarker);
if(op>=0) online=online.slice(0,op).trimEnd()+'\n';
const onlineExt=readFileSync('src/v100/online-extension.js','utf8').trim();
writeFileSync('docs/editor/app.js',`${online.trimEnd()}\n\n${onlineExt}\n`);

const pkg=JSON.parse(readFileSync('package.json','utf8'));
pkg.version='1.0.0';
pkg.description='Professional GLT/BMS/SCADA engineering platform for Home Assistant: operational states, secure controls, alarm lifecycle, schedules, semantic model, auto mapping, CAD designer, simulation, diagnostics, energy, assets, reports, multi-site and project bundles.';
pkg.scripts={...(pkg.scripts||{}), 'test:v1':'node --test test/v100-*.test.mjs'};
writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');

const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
lock.version='1.0.0';
if(lock.packages?.['']) lock.packages[''].version='1.0.0';
writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
let smoke=readFileSync('test/smoke.test.mjs','utf8');
smoke=smoke.replace('VERSION = \\"0.4.0\\"','VERSION = \\"1.0.0\\"');
writeFileSync('test/smoke.test.mjs',smoke);
let changelog=readFileSync('CHANGELOG.md','utf8');
if(!changelog.includes('## 1.0.0 - 2026-08-31')){
 const entry=`# Changelog\n\n## 1.0.0 - 2026-08-31\n\n- Professional operational-state engine for Auto/Manual/Local/Remote/Fault/Warning/Lock/Interlock/Maintenance/communication/quality/command states.\n- Rich equipment control panels with Companion-enforced roles and audited service execution.\n- Alarm lifecycle 2.0 with conditions, hysteresis, delay, acknowledgement/comment, shelving, history and notifications.\n- Server-side weekly schedules and report snapshots.\n- Semantic site/building/floor/system model, automatic HA entity mapping and parametric component profiles.\n- 250+ professional symbol variants, intelligent ports and obstacle-aware orthogonal routing.\n- CAD layer tools, lasso, align/distribute, Z-order, Copy/Paste and minimap.\n- Drill-down, historian aggregation/deadband, simulation and commissioning diagnostics.\n- Energy, work orders, reports, remote Home Assistant sites and plugin SDK.\n- Schema v1 migrations, .gltproject bundles, project diff, optimistic revisions and project locks.\n- Companion Config Flow, i18n foundation, accessibility/kiosk/widescreen support and 2,000-object engineering tests.\n\n`;
 changelog=changelog.replace('# Changelog\n',entry);
 writeFileSync('CHANGELOG.md',changelog);
}
