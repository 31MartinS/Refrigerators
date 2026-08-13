export type ExperienceState='LANDING'|'FORM'|'REGISTERING'|'PRIZES'|'SELECTING'|'LOCKING_SELECTION'|'REVEAL_ANIMATION'|'RESULTS'|'ERROR';
export interface ParticipantInput { fullName:string; identification:string; email:string; phone:string; terms:boolean; privacy:boolean }
export interface Prize { id:string; name:string; description:string; claimInstructions:string; color:string; icon:string; weight:number; initialStock:number|null; remainingStock:number|null; active:boolean }
export interface DrawResult { participationId:string; refrigeratorId:string; prize:Prize; decorativePrizes:Prize[]; awardedAt:string }
export interface Campaign { id:string; slug:string; name:string; eyebrow:string; headline:string; description:string; cta:string }
