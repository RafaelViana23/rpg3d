export type ItemCategory='weapon'|'magic'|'armor'|'accessory'|'consumable'|'material';
export type ItemRarity='Comum'|'Incomum'|'Raro'|'Épico'|'Lendário';
export type EquipmentSlot='rightHand'|'leftHand'|'head'|'torso'|'armor'|'legs'|'gloves'|'boots'|'accessory';
export type ItemStats={attack?:number;defense?:number;hp?:number;stamina?:number;hunger?:number;thirst?:number};
export type InventoryItem={id:string;name:string;category:ItemCategory;rarity:ItemRarity;description:string;slot?:EquipmentSlot;quantity:number;stackable?:boolean;stats:ItemStats;visual:string};
export type GuildQuestProgress={status:'active'|'claimed';progress:number};
export type PersistedInventory={version:1;swordMaterialsRevision?:1;companion?:{id:string;mode:'follow'|'wait';position:[number,number,number]};citizenQuests?:Record<string,{status:'active'|'claimed';found:boolean;target?:[number,number,number]}>;ownedHorses?:string[];guildQuests?:Record<string,GuildQuestProgress>;level:number;xp:number;gold:number;hp:number;stamina:number;hunger:number;thirst:number;worldTime:number;worldDay:number;weather:'clear'|'rain'|'snow';weatherIntensity:number;quantities:Record<string,number>;equipped:Partial<Record<EquipmentSlot,string>>;quickSlots:Array<string|null>};
