import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import config from '../site.config.mjs';
const target=process.argv.includes('--hostgator')?'hostgator':'vercel';
const output=target==='hostgator'?'work/hostgator-dist':'dist';
const site=new URL(config.siteUrl);
if(site.protocol!=='https:')throw new Error('siteUrl must use https');
const origin=site.origin;
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await cp('public',output,{recursive:true});
const publicConfig={email:config.email,bookingUrl:config.bookingUrl,consultationMinutes:config.consultationMinutes,inquiryEnabled:config.inquiryEnabled,inquiryEndpoint:target==='hostgator'?'/inquiry.php':config.inquiryEndpoint};
await writeFile(path.join(output,'config.js'),`window.ADG_CONFIG = ${JSON.stringify(publicConfig).replaceAll('<','\\u003c')};\n`);
const pages=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name==='index.html')pages.push(full);}}
await walk(output);
const routes=[];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const decode=s=>s.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi,entity=>{const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};return named[entity.toLowerCase()]??String.fromCodePoint(entity[2].toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):parseInt(entity.slice(2,-1),10));});
const json=s=>JSON.stringify(s).replaceAll('<','\\u003c');
for(const file of pages){
 let html=await readFile(file,'utf8');
 html=html.replaceAll('<span aria-hidden="true">↗</span>','<svg class="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" stroke="currentColor" stroke-width="1.2"/></svg>').replaceAll('✳','✳︎');
 const route='/'+path.relative(output,path.dirname(file)).split(path.sep).filter(Boolean).join('/')+(path.dirname(file)===output?'':'/');
 const canonical=origin+route;routes.push(route);
 const title=decode(html.match(/<title>(.*?)<\/title>/s)?.[1]||config.name);
 const description=decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1]||'');
 const graph=[{'@type':'Organization','@id':origin+'/#organization',name:config.name,url:origin,email:config.email,areaServed:{'@type':'City',name:'Charleston, South Carolina'},logo:origin+'/assets/favicon.svg'}, {'@type':'WebSite','@id':origin+'/#website',url:origin,name:config.name,publisher:{'@id':origin+'/#organization'}}];
 if(route==='/'){
  graph.push({'@type':'Service',name:'Charleston elopement planning',provider:{'@id':origin+'/#organization'},areaServed:'Charleston, South Carolina',serviceType:'Elopement and intimate wedding planning',offers:[['Petite',3500],['Signature',5000],['Premier',7500]].map(([name,price])=>({'@type':'Offer',name,price,priceCurrency:'USD',url:origin+'/#packages',description:'Starting investment. Final services and price confirmed in your proposal.'}))});
  const questions=[...html.matchAll(/<details><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/gs)].map(([,q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a.replace(/<[^>]+>/g,'')}}));
  graph.push({'@type':'FAQPage',mainEntity:questions});
 }else{
  graph.push({'@type':'WebPage','@id':canonical,name:title,url:canonical,description,isPartOf:{'@id':origin+'/#website'}});
  graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin+'/'},{'@type':'ListItem',position:2,name:title.split('|')[0].trim(),item:canonical}]});
 }
 const meta=[`<link rel="canonical" href="${esc(canonical)}">`,`<meta name="robots" content="${config.launchReady?'index, follow':'noindex, nofollow'}">`,`<meta property="og:type" content="website">`,`<meta property="og:site_name" content="${esc(config.name)}">`,`<meta property="og:title" content="${esc(title)}">`,`<meta property="og:description" content="${esc(description)}">`,`<meta property="og:url" content="${esc(canonical)}">`,`<meta property="og:image" content="${origin}/assets/hero.webp">`,`<meta property="og:image:alt" content="An intimate Charleston-style garden wedding envisioned beneath live oaks">`,`<meta name="twitter:card" content="summary_large_image">`,`<script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script>`].join('\n  ');
 if(!html.includes('<!--SEO_META-->'))throw new Error(`Missing metadata placeholder in ${file}`);
 await writeFile(file,html.replace('<!--SEO_META-->',meta));
}
await writeFile(path.join(output,'robots.txt'),`User-agent: *\n${config.launchReady?'Allow: /':'Disallow: /'}\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.filter(r=>r!=='/privacy/').map(r=>`\n  <url><loc>${esc(origin+r)}</loc></url>`).join('')}\n</urlset>\n`);
if(target==='hostgator'){
 await cp('hostgator/inquiry.php',path.join(output,'inquiry.php'));
 await writeFile(path.join(output,'.htaccess'),`Options -Indexes\nDirectoryIndex index.html\n<IfModule mod_headers.c>\nHeader set X-Content-Type-Options "nosniff"\nHeader set Referrer-Policy "strict-origin-when-cross-origin"\nHeader set X-Frame-Options "SAMEORIGIN"\n</IfModule>\n`);
}
console.log(`Built ${pages.length} pages to ${output} (${target}; ${config.launchReady?'indexing enabled':'draft: indexing disabled'}).`);
