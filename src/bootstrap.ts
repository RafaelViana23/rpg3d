import { initializeDatabaseSaves } from './saves/CloudSaves';
// Hydrate the database save before importing any gameplay module or running map migrations.
await initializeDatabaseSaves();
try{
 await import('./main');
 document.querySelector('#startup-loading')?.remove();
}catch(error){
 console.error('[bootstrap] Não foi possível iniciar o mundo.',error);
 const loading=document.querySelector<HTMLElement>('#startup-loading');
 if(loading)loading.innerHTML='<span><b>Não foi possível iniciar o mundo 3D.</b><small>O navegador não conseguiu criar o contexto WebGL. Feche outras abas 3D ou reinicie o Chrome e recarregue esta página.</small></span>';
}
