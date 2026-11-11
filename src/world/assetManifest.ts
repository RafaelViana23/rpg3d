export type WorldAsset = {
  id: string;
  label: string;
  role: 'aldeao' | 'guarda';
  url: string;
  position: [number, number, number];
  rotationY?: number;
};

export const WORLD_CHARACTERS: WorldAsset[] = [
  { id: 'damsel', label: 'Aldeã', role: 'aldeao', url: '/models/NPCS/aldeoes/damsel/model.glb', position: [-2.4, 0, 0], rotationY: 0.12 },
  { id: 'baba-yaga', label: 'Baba Yaga', role: 'aldeao', url: '/models/NPCS/aldeoes/baba-yaga/model.glb', position: [0, 0, 0], rotationY: 0.05 },
  { id: 'peasant', label: 'Camponês', role: 'aldeao', url: '/models/NPCS/aldeoes/peasant/model.glb', position: [2.4, 0, 0], rotationY: -0.08 },
  { id: 'guarda-1', label: 'Guarda 1', role: 'guarda', url: '/models/NPCS/guardas/guarda-1/model.glb', position: [-5, 0, 0.25], rotationY: 0.18 },
  { id: 'guarda-2', label: 'Guarda 2', role: 'guarda', url: '/models/NPCS/guardas/guarda-2/model.glb', position: [5, 0, 0.25], rotationY: -0.18 },
];
