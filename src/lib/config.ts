import type { Campaign, Prize } from '../types';
export const campaign:Campaign={id:'demo-campaign',slug:'reveal-five',name:'REVEAL FIVE',eyebrow:'4 puertas · 1 premio para ti',headline:'Elige. Abre. Gana.',description:'Regístrate, confía en tu intuición y descubre qué hay detrás de una de nuestras cuatro puertas.',cta:'PARTICIPA AHORA'};
export const refrigerators=['violet','cyan','coral','gold'] as const;
export const demoPrizes:Prize[]=[
 {id:'p1',name:'Minibar',description:'Un minibar para disfrutar en casa.',claimInstructions:'Acércate al punto de entrega para recibirlo.',color:'#8b5cf6',icon:'❄',weight:25,initialStock:1,remainingStock:1,active:true},
 {id:'p2',name:'Orden de compra por $20',description:'Tienes $20 para usar en tu próxima compra.',claimInstructions:'Presenta este resultado en el punto de información.',color:'#06b6d4',icon:'$',weight:25,initialStock:1,remainingStock:1,active:true},
 {id:'p3',name:'Parlante',description:'Lleva tu música a todas partes.',claimInstructions:'Acércate al punto de entrega para recibirlo.',color:'#fb7185',icon:'♫',weight:25,initialStock:1,remainingStock:1,active:true},
 {id:'p4',name:'Tomatodo',description:'Un tomatodo para acompañarte todos los días.',claimInstructions:'Acércate al punto de entrega para recibirlo.',color:'#fbbf24',icon:'●',weight:25,initialStock:1,remainingStock:1,active:true}
];
