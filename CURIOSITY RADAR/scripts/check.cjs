const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');let count=0;
for(const file of fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.gs'))){new vm.Script(fs.readFileSync(path.join(root,'src',file),'utf8'),{filename:file});count++;}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/appsscript.json'),'utf8'));
if(manifest.runtimeVersion!=='V8'||manifest.timeZone!=='Asia/Tokyo')throw new Error('Manifest mismatch');
const clasp=JSON.parse(fs.readFileSync(path.join(root,'.clasp.json.example'),'utf8'));if(clasp.rootDir!=='src')throw new Error('Unsafe clasp root');
console.log(`${count} GAS modules: syntax OK; manifest/clasp root OK`);
