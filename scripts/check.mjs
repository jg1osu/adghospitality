import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root='dist';let count=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(entry.name.endsWith('.html')){
const html=await readFile(file,'utf8');assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${file}: one H1 required`);assert.ok(html.includes('rel="canonical"'),`${file}: canonical`);assert.ok(html.includes('name="description"'),`${file}: description`);assert.ok(!html.includes('<!--SEO_META-->'),`${file}: metadata built`);
for(const script of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(script[1]);
for(const [,href] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)){if(href.startsWith('//'))continue;let dest=path.join(root,href);const info=await stat(dest).catch(()=>null);assert.ok(info,`${file}: broken local link ${href}`);if(info.isDirectory())await stat(path.join(dest,'index.html'));}
count++;
}}}
await walk(root);
assert.equal(count,5,'Expected homepage, three guides and privacy notice');
const homepage=await readFile(path.join(root,'index.html'),'utf8');
for(const price of ['$3,500','$5,000','$7,500'])assert.ok(homepage.includes(price),`Missing ${price}`);
assert.ok(homepage.includes('up to 30'),'Guest capacity visible');
assert.ok(homepage.includes('Illustrative imagery'),'Images identified as illustrative');
const assets=(await readdir(path.join(root,'assets')));for(const asset of ['hero.webp','story.webp','coast.webp'])assert.ok(assets.includes(asset));
console.log(`Checked ${count} pages: local links, schema, titles, assets and confirmed package prices pass.`);
