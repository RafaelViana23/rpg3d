import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {defineConfig} from 'vite';

const calibrationFile=resolve(process.cwd(),'public/hand-calibration.json');
const sharedHandCalibration=()=>({name:'shared-hand-calibration',configureServer(server){server.middlewares.use('/api/hand-calibration',async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');try{if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const value=JSON.parse(body);await writeFile(calibrationFile,JSON.stringify(value,null,2)+'\n','utf8');res.end(JSON.stringify({ok:true}));return;}res.end(await readFile(calibrationFile,'utf8'));}catch(error){res.statusCode=500;res.end(JSON.stringify({ok:false,error:String(error)}));}});}});
const controllerRelay=()=>({name:'mobile-controller-relay',configureServer(server){server.ws.on('rpg:controller-input',(data)=>server.ws.send('rpg:controller-input',data));}});

export default defineConfig({plugins:[sharedHandCalibration(),controllerRelay()],build:{rollupOptions:{input:{main:resolve(process.cwd(),'index.html'),controller:resolve(process.cwd(),'controller.html'),handLab:resolve(process.cwd(),'hand-lab.html'),bodyLab:resolve(process.cwd(),'body-lab.html'),faceLab:resolve(process.cwd(),'face-lab.html'),characterArtLab:resolve(process.cwd(),'character-art-lab.html'),referenceMatchLab:resolve(process.cwd(),'reference-match-lab.html'),sculptLab:resolve(process.cwd(),'sculpt-lab.html')}}}});
