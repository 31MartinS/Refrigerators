import { CupSoda, Refrigerator, ShoppingBag, Volume2 } from 'lucide-react';

const icons={p1:Refrigerator,p2:ShoppingBag,p3:Volume2,p4:CupSoda};

export function PrizeIcon({prizeId,className}:{prizeId:string;className?:string}){
 const Icon=icons[prizeId as keyof typeof icons]??ShoppingBag;
 return <Icon className={className} aria-hidden="true"/>;
}
