import type { CitizenRole } from './CityPopulation';
/** Game clock is a fraction of a day; normalize editor time jumps and midnight. */
export function residentRoutine(worldTime:number){
  const day=worldTime-Math.floor(worldTime);
  const hour=day*24+1e-9;
  return hour<6?'sleep':hour<8?'home':hour<22?'roam':'return';
}

export const MERCHANT_ROLES:Partial<Record<CitizenRole,'weapons'|'potions'|'tavern'|'inn'|'shop'|'stable'|'lodging'>>={cavalarico:'stable',armeiro:'weapons',alquimista:'potions',taverneira:'tavern',estalajadeira:'lodging','atendente-pousada':'inn',lojista:'shop'};
export function citizenRoutine(worldTime:number,role:CitizenRole){
  if(role==='guarda-portao')return 'work';
  const base=residentRoutine(worldTime);
  if(base==='sleep')return base;
  if(role==='cavalarico')return base==='roam'?'work':base;
  if(MERCHANT_ROLES[role])return base==='return'?'home':'work';
  if(role==='rei'||role==='rainha'||role==='princesa')return base==='return'?'home':'work';
  if(base==='roam'&&role!=='morador'&&role!=='nobre'&&role!=='guarda-patrulha')return 'work';
  return base;
}
export const CITIZEN_ROLE_LABELS:Partial<Record<CitizenRole,string>>={feirante:'Feirante',morador:'Plebeu',nobre:'Nobre','cozinheiro-real':'Cozinheiro real','empregada-real':'Empregada real','empregada-pousada':'Empregada da pousada',cavalarico:'Cavalariço',rei:'Rei',rainha:'Rainha',princesa:'Princesa',padre:'Padre',freira:'Freira',armeiro:'Armeiro',alquimista:'Alquimista',taverneira:'Taverneira',estalajadeira:'Dona da pousada','atendente-pousada':'Atendente da pousada',guilda:'Chefe da guilda · Nobre',lojista:'Lojista','guarda-palacio':'Guarda real','guarda-arqueiro':'Arqueiro da muralha','guarda-torre':'Vigia da torre','guarda-patrulha':'Guarda de patrulha','guarda-portao':'Guarda do portão'};
