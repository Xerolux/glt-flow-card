import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dir='src/v100/bundle';
const parts=readdirSync(dir).filter(x=>x.startsWith('platform-source.part')).sort();
if(!parts.length) throw new Error('No v1 source bundle parts found');
const text=parts.map(x=>readFileSync(join(dir,x),'utf8')).join('');
const files=JSON.parse(text);
for(const [path,b64] of Object.entries(files)){
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,Buffer.from(b64,'base64'));
}
console.log(`unpacked ${Object.keys(files).length} v1 platform source files`);
