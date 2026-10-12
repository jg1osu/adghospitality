import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import './build.mjs';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/api/inquiry'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({success:false,message:'Email delivery is not configured in this static preview. Please email alisa@adghospitality.com.'}));return;}
  let file=path.resolve(root,`.${pathname}`);
  if(!file.startsWith(root+path.sep)&&file!==root)throw new Error('Invalid path');
  const info=await stat(file);if(info.isDirectory())file=path.join(file,'index.html');
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404,{'Content-Type':'text/html'});res.end('<h1>Page not found</h1><a href="/">ADG Hospitality home</a>');}
});
server.listen(4173,'0.0.0.0',()=>console.log('ADG Hospitality preview: http://localhost:4173'));
