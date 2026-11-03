/** Development static server. Only application assets are served; records never reach it. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const host='127.0.0.1',port=Number(process.env.PORT||4173);
const assets=new Set(['index.html','styles.css','sw.js','manifest.webmanifest','js/bootstrap.js','js/app.js','js/db.js','js/schema.js','js/utils.js','js/i18n.js','assets/icon-192.png','assets/icon-512.png']);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://localhost');let filename=decodeURIComponent(url.pathname);
  if(filename==='/SmartStock_POS'){res.writeHead(301,{Location:'/SmartStock_POS/'});res.end();return;}
  filename=filename.replace(/^\/SmartStock_POS\//,'/').replace(/^\//,'')||'index.html';
  if(!assets.has(filename)){res.writeHead(404);res.end('Not Found');return;}
  const file=await readFile(path.join(root,filename));
  res.writeHead(200,{'Content-Type':MIME[path.extname(filename)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});
  res.end(req.method==='HEAD'?undefined:file);
 }catch{res.writeHead(404);res.end('Not Found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Open the running server or choose a different PORT (a different port has separate browser data).`:error.message);process.exitCode=1;});
server.listen(port,host,()=>console.log(`SmartStock running at http://${host}:${port}/`));
