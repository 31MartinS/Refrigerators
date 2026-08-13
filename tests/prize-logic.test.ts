import { describe,expect,it } from 'vitest';
import { demoPrizes } from '../src/lib/config';
describe('configuración de premios',()=>{it('suma 100 por ciento',()=>expect(demoPrizes.reduce((n,p)=>n+p.weight,0)).toBe(100));it('no permite stock negativo',()=>expect(demoPrizes.every(p=>p.remainingStock===null||p.remainingStock>=0)).toBe(true));it('tiene exactamente cuatro premios activos',()=>expect(demoPrizes.filter(p=>p.active)).toHaveLength(4))});
