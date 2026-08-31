import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const dir='src/v100/bundle';
const names=readdirSync(dir);
const br=names.filter(x=>x.startsWith('platform-source.br.part')).sort();
const plain=names.filter(x=>x.startsWith('platform-source.part')).sort();
let text;
if(br.length){
  const b64=br.map(x=>readFileSync(join(dir,x),'utf8')).join('');
  text=brotliDecompressSync(Buffer.from(b64,'base64')).toString('utf8');
}else{
  if(!plain.length) throw new Error('No v1 source bundle parts found');
  text=plain.map(x=>readFileSync(join(dir,x),'utf8')).join('');
}
const files=JSON.parse(text);
for(const [path,b64] of Object.entries(files)){
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,Buffer.from(b64,'base64'));
}
console.log(`unpacked ${Object.keys(files).length} v1 platform source files`);
