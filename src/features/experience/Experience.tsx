import { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, Gift, LoaderCircle, LockKeyhole, RotateCcw, Sparkles, X } from 'lucide-react';
import { Brand } from '../../components/Brand';
import { PrizeIcon } from '../../components/PrizeIcon';
import { campaign, demoPrizes, refrigerators } from '../../lib/config';
import { drawPrize, registerParticipant } from '../../lib/api';
import type { DrawResult, ExperienceState, ParticipantInput } from '../../types';

type Model={step:ExperienceState;participantId?:string;selected?:string;result?:DrawResult;error?:string;errorTitle?:string;retryStep?:ExperienceState};
type Action={type:'GO';step:ExperienceState}|{type:'REGISTERED';id:string}|{type:'SELECT';id:string}|{type:'RESULT';result:DrawResult}|{type:'FAIL';message:string;title?:string;retryStep?:ExperienceState}|{type:'RESET'};
const initial:Model={step:'LANDING'};
function reducer(s:Model,a:Action):Model{switch(a.type){case'GO':return{...s,step:a.step,error:undefined,errorTitle:undefined,retryStep:undefined};case'REGISTERED':return{...s,participantId:a.id,step:'PRIZES'};case'SELECT':return{...s,selected:a.id,step:'LOCKING_SELECTION'};case'RESULT':return{...s,result:a.result,step:'REVEAL_ANIMATION'};case'FAIL':return{...s,error:a.message,errorTitle:a.title,retryStep:a.retryStep,step:'ERROR'};case'RESET':return initial}}

const errorCode=(error:unknown)=>error instanceof Error?error.message:'UNKNOWN_ERROR';
function registrationError(error:unknown){
 switch(errorCode(error)){
  case'ALREADY_PARTICIPATED':return{title:'Ya registramos tu participación',message:'Este correo o número de identificación ya participó en la campaña. Solo se permite una participación por persona.'};
  case'INVALID_INPUT':return{title:'Revisa tus datos',message:'Uno o más datos no son válidos. Comprueba el formulario e inténtalo nuevamente.'};
  default:return{title:'No pudimos completar el registro',message:'Ocurrió un problema al registrar tu participación. Espera un momento e inténtalo nuevamente.'};
 }
}
function drawError(error:unknown){
 switch(errorCode(error)){
  case'NO_PRIZES_AVAILABLE':return{title:'Premios agotados',message:'En este momento no quedan premios disponibles. Comunícate con el equipo de la campaña.'};
  case'INVALID_REFRIGERATOR':return{title:'Selección no disponible',message:'La refrigeradora elegida ya no está disponible. Actualiza la página para consultar las opciones vigentes.'};
  case'PARTICIPATION_NOT_FOUND':return{title:'No encontramos tu participación',message:'No fue posible localizar tu registro. Vuelve al inicio y completa nuevamente el formulario.'};
  case'BOT_CHECK_FAILED':return{title:'No pudimos verificarte',message:'La validación de seguridad no se completó. Actualiza la página e inténtalo nuevamente.'};
  case'STOCK_CONFLICT':return{title:'Estamos confirmando el inventario',message:'Otro sorteo actualizó el último premio disponible. Vuelve a intentarlo para recuperar un resultado válido.'};
  default:return{title:'No pudimos revelar tu premio',message:'Tu participación quedó registrada. Vuelve a intentarlo para recuperar el resultado sin repetir el sorteo.'};
 }
}

export function Experience(){
 const [state,dispatch]=useReducer(reducer,initial); const reduced=useReducedMotion();
 useEffect(()=>{if(state.step==='REVEAL_ANIMATION'){const t=setTimeout(()=>dispatch({type:'GO',step:'RESULTS'}),reduced?500:3600);return()=>clearTimeout(t)}},[state.step,reduced]);
 async function submit(input:ParticipantInput){dispatch({type:'GO',step:'REGISTERING'});try{const r=await registerParticipant(input);dispatch({type:'REGISTERED',id:r.participantId})}catch(error){dispatch({type:'FAIL',...registrationError(error),retryStep:'FORM'})}}
 async function select(id:string){if(state.step!=='SELECTING'||!state.participantId)return;dispatch({type:'SELECT',id});try{const result=await drawPrize(state.participantId,id);dispatch({type:'RESULT',result})}catch(error){dispatch({type:'FAIL',...drawError(error),retryStep:'SELECTING'})}}
 return <main className="experience"><Brand/><div className="progress" aria-label="Progreso"><i className={state.step!=='LANDING'?'done':''}/><i className={['PRIZES','SELECTING','LOCKING_SELECTION','REVEAL_ANIMATION','RESULTS'].includes(state.step)?'done':''}/><i className={['SELECTING','LOCKING_SELECTION','REVEAL_ANIMATION','RESULTS'].includes(state.step)?'done':''}/><i className={state.step==='RESULTS'?'done':''}/></div><AnimatePresence mode="wait">
  {state.step==='LANDING'&&<Landing key="landing" start={()=>dispatch({type:'GO',step:'FORM'})}/>} 
  {['FORM','REGISTERING'].includes(state.step)&&<EntryForm key="form" busy={state.step==='REGISTERING'} onSubmit={submit}/>} 
  {state.step==='PRIZES'&&<PrizeShowcase key="prizes" next={()=>dispatch({type:'GO',step:'SELECTING'})}/>} 
  {['SELECTING','LOCKING_SELECTION','REVEAL_ANIMATION'].includes(state.step)&&<Selection key="selection" state={state} onSelect={select}/>} 
  {state.step==='RESULTS'&&state.result&&<Results key="results" result={state.result} reset={()=>dispatch({type:'RESET'})}/>} 
  {state.step==='ERROR'&&<ErrorView key="error" title={state.errorTitle} message={state.error??'Ocurrió un error.'} retry={()=>dispatch(state.retryStep?{type:'GO',step:state.retryStep}:{type:'RESET'})}/>} 
 </AnimatePresence></main>
}

const screen={initial:{opacity:0,y:18},animate:{opacity:1,y:0},exit:{opacity:0,y:-12},transition:{duration:.38}};
function Landing({start}:{start:()=>void}){return <motion.section {...screen} className="landing screen"><div className="hero-copy"><span className="eyebrow"><Sparkles size={14}/>{campaign.eyebrow}</span><h1>Elige.<br/><em>Abre.</em> Gana.</h1><p>{campaign.description}</p></div><div className="hero-art" role="img" aria-label="Cuatro refrigeradoras misteriosas"/><div className="bottom-action"><button className="primary" onClick={start}>{campaign.cta}<ArrowRight/></button></div></motion.section>}

function EntryForm({busy,onSubmit}:{busy:boolean;onSubmit:(v:ParticipantInput)=>void}){
 const [values,setValues]=useState<ParticipantInput>({fullName:'',identification:'',email:'',phone:'',terms:false,privacy:false}); const [errors,setErrors]=useState<Record<string,string>>({});
 const [showTerms,setShowTerms]=useState(false);
 function update<K extends keyof ParticipantInput>(k:K,v:ParticipantInput[K]){setValues(x=>({...x,[k]:v}));setErrors(x=>({...x,[k]:''}))}
 function submit(e:React.FormEvent){e.preventDefault();const next:Record<string,string>={};if(values.fullName.trim().length<3)next.fullName='Escribe tu nombre completo.';if(!/^\d{6,14}$/.test(values.identification))next.identification='Ingresa una identificación válida.';if(!/^\S+@\S+\.\S+$/.test(values.email))next.email='Ingresa un correo válido.';if(!/^\+?[\d\s-]{7,18}$/.test(values.phone))next.phone='Ingresa un teléfono válido.';if(!values.terms)next.terms='Debes aceptar para participar.';if(!values.privacy)next.privacy='Debes aceptar la política.';setErrors(next);if(!Object.keys(next).length)onSubmit(values)}
 return <motion.section {...screen} className="form-screen screen"><header><span className="step-label">PASO 1 DE 3</span><h1>Antes de abrir,<br/>queremos conocerte.</h1><p>Completa tus datos. Te tomará menos de un minuto.</p></header><form onSubmit={submit} noValidate>
  <Field label="Nombre completo" error={errors.fullName}><input value={values.fullName} onChange={e=>update('fullName',e.target.value)} autoComplete="name" placeholder="Ej. María González"/></Field>
  <div className="field-row"><Field label="Cédula / ID" error={errors.identification}><input value={values.identification} onChange={e=>update('identification',e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Tu identificación"/></Field><Field label="Teléfono" error={errors.phone}><input value={values.phone} onChange={e=>update('phone',e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="099 000 0000"/></Field></div>
  <Field label="Correo electrónico" error={errors.email}><input value={values.email} onChange={e=>update('email',e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com"/></Field>
  <CheckField checked={values.terms} onChange={v=>update('terms',v)} error={errors.terms}>Acepto los <button type="button" className="legal-link" onClick={()=>setShowTerms(true)}>términos y condiciones del concurso</button>.</CheckField>
  <CheckField checked={values.privacy} onChange={v=>update('privacy',v)} error={errors.privacy}>Acepto la <a className="legal-link" href="https://www.electrolux.com.ec/politica-de-privacidad" target="_blank" rel="noreferrer">política de privacidad y uso de datos</a>.</CheckField>
  <button className="primary" disabled={busy}>{busy?<><LoaderCircle className="spin"/>REGISTRANDO...</>:<>CONTINUAR<ArrowRight/></>}</button>
 </form>{showTerms&&<TermsDialog close={()=>setShowTerms(false)}/>}</motion.section>}
function Field({label,error,children}:{label:string;error?:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}{error&&<small role="alert">{error}</small>}</label>}
function CheckField({checked,onChange,children,error}:{checked:boolean;onChange:(v:boolean)=>void;children:React.ReactNode;error?:string}){return <div className="check"><label className="check-control"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><i>{checked&&<Check size={15}/>}</i></label><span>{children}{error&&<small role="alert">{error}</small>}</span></div>}

function TermsDialog({close}:{close:()=>void}){
 useEffect(()=>{function keydown(e:KeyboardEvent){if(e.key==='Escape')close()}document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown)},[close]);
 return createPortal(<div className="legal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="legal-dialog" role="dialog" aria-modal="true" aria-labelledby="terms-title"><button type="button" className="legal-close" onClick={close} aria-label="Cerrar términos y condiciones" autoFocus><X/></button><span className="step-label">DINÁMICA PROMOCIONAL</span><h2 id="terms-title">Términos y condiciones</h2><div className="legal-copy"><p>Al participar declaras que los datos ingresados son verdaderos y que aceptas estas reglas.</p><ol><li><b>Participación.</b> La dinámica está dirigida a personas mayores de 18 años en Ecuador. Se permite una participación por persona y documento de identidad durante la vigencia de la campaña.</li><li><b>Cómo funciona.</b> Completa el formulario, revisa los premios y escoge una de las cuatro refrigeradoras. La elección se confirma al tocarla por segunda vez y no puede modificarse.</li><li><b>Asignación del premio.</b> El sistema asigna aleatoriamente uno de los premios activos: minibar, orden de compra por $20, parlante o tomatodo. La refrigeradora elegida no determina ni mejora la probabilidad de obtener un premio específico.</li><li><b>Disponibilidad.</b> Los premios se entregan hasta agotar existencias. Si un premio deja de estar disponible antes de confirmar el resultado, quedará excluido de la asignación. Los premios no son canjeables por dinero ni transferibles, salvo indicación expresa del organizador.</li><li><b>Entrega.</b> La persona ganadora deberá presentar su resultado y un documento de identidad válido en el punto indicado. El organizador podrá verificar la información antes de entregar el premio.</li><li><b>Conducta.</b> Los registros duplicados, datos falsos, automatizaciones, manipulación o cualquier intento de fraude causarán la descalificación y la pérdida del premio.</li><li><b>Datos personales.</b> Los datos se usarán para gestionar la participación, validar a la persona ganadora y entregar el premio conforme a la política de privacidad de Electrolux.</li></ol><p>Electrolux podrá suspender o ajustar la dinámica por causas técnicas, de seguridad o fuerza mayor, procurando no afectar participaciones ya confirmadas. Las decisiones operativas relacionadas con validación y entrega serán definitivas, dentro de la legislación aplicable.</p></div><button type="button" className="primary" onClick={close}>ENTENDIDO<Check/></button></section></div>,document.body)
}

function PrizeShowcase({next}:{next:()=>void}){return <motion.section {...screen} className="prize-showcase screen"><header><span className="step-label"><Gift size={14}/>PASO 2 DE 3</span><h1>Gracias por formar parte<br/>de la familia Electrolux.</h1><p>Uno de los siguientes premios se encuentra escondido dentro de una de las 4 refrigeradoras, escoge una refrigeradora y descúbrelo.</p><p className="showcase-hint"><Sparkles size={15}/>Todas las refrigeradoras tienen un premio.</p></header><div className="prize-list" aria-label="Premios disponibles">{demoPrizes.map(prize=><article key={prize.id} style={{'--prize':prize.color} as React.CSSProperties}><div className="prize-illustration"><span/><PrizeIcon prizeId={prize.id}/></div><div><h2>{prize.name}</h2><p>{prize.description}</p></div></article>)}</div><div className="showcase-action"><button className="primary" onClick={next}>ELEGIR REFRIGERADORA<ArrowRight/></button></div></motion.section>}

function Selection({state,onSelect}:{state:Model;onSelect:(id:string)=>void}){
 const locked=state.step!=='SELECTING'; const opening=state.step==='REVEAL_ANIMATION';
 const [candidate,setCandidate]=useState<string>();
 const gridRef=useRef<HTMLDivElement>(null);
 const gesture=useRef({x:0,y:0,moved:false});
 useEffect(()=>{if(opening)document.querySelector('.fridge.selected')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})},[opening]);
 useEffect(()=>{
  const mobile=window.matchMedia('(max-width: 699px)');
  function adaptLayout(){
   const grid=gridRef.current;if(!grid)return;
   if(!mobile.matches){grid.scrollLeft=0;return}
   const active=grid.querySelector<HTMLElement>('.candidate, .selected');
   if(active)active.scrollIntoView({behavior:'auto',block:'nearest',inline:'center'});
   else grid.scrollLeft=0;
  }
  mobile.addEventListener('change',adaptLayout);window.addEventListener('orientationchange',adaptLayout);
  return()=>{mobile.removeEventListener('change',adaptLayout);window.removeEventListener('orientationchange',adaptLayout)};
 },[]);
 function startGesture(e:React.PointerEvent){gesture.current={x:e.clientX,y:e.clientY,moved:false}}
 function moveGesture(e:React.PointerEvent){if(Math.hypot(e.clientX-gesture.current.x,e.clientY-gesture.current.y)>9)gesture.current.moved=true}
 function choose(id:string,e:React.MouseEvent<HTMLButtonElement>){if(gesture.current.moved||locked)return;if(candidate===id){onSelect(id);return}setCandidate(id);e.currentTarget.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}
 let decorativeIndex=0;
 return <motion.section {...screen} className={`selection screen ${opening?'opening':''}`}>
  <header><span className="step-label">PASO 3 DE 3</span><h1>{opening?'Mira lo que había dentro':'Llegó el momento.'}</h1><p>{opening?'Una de estas sorpresas es tuya.':'Escoge una de las cuatro refrigeradoras para descubrir tu premio. Solo tienes una oportunidad.'}</p></header>
  {!opening&&<p className="swipe-hint">{candidate?'Toca otra vez la seleccionada para confirmar':'Desliza para explorar · toca una para seleccionarla'}</p>}
  <div ref={gridRef} className="fridge-grid" aria-label="Elige una refrigeradora">{refrigerators.map((id,i)=>{
   const isWinner=id===state.selected;
   const prize=opening&&state.result?(isWinner?state.result.prize:state.result.decorativePrizes[decorativeIndex++%state.result.decorativePrizes.length]):undefined;
   const isCandidate=!locked&&candidate===id;
   return <button key={id} className={`fridge fridge-${id} ${isWinner?'selected':''} ${isCandidate?'candidate':''}`} disabled={locked} onPointerDown={startGesture} onPointerMove={moveGesture} onClick={e=>choose(id,e)} aria-pressed={isCandidate} aria-label={`Refrigeradora ${i+1}${isCandidate?', seleccionada; toca otra vez para confirmar':''}${prize?`: ${prize.name}`:''}`}>
    <span className="fridge-number">0{i+1}</span><span className="appliance"><span className="cabinet-side"/><span className="inside"><i className="freezer-cavity"/><i className="shelf shelf-one"/><i className="shelf shelf-two"/>{prize&&<span className="inside-prize" style={{'--prize':prize.color} as React.CSSProperties}><b><PrizeIcon prizeId={prize.id}/></b><small>{prize.name}</small></span>}</span><i className="door freezer-door"><span className="model-badge">E</span></i><i className="door cooler-door"><span className="dispenser"><b/><i/></span></i><span className="control-band"><i/><small>INVERTER</small></span><i className="foot foot-left"/><i className="foot foot-right"/></span>
    {(isWinner||isCandidate)&&<span className="selected-label">{isWinner?<LockKeyhole/>:<Check/>}{opening?'TU PREMIO':isCandidate?'SELECCIONADA':'ELEGIDA'}</span>}
   </button>})}</div>
  {locked&&!opening&&<div className="locking"><LoaderCircle className="spin"/>BLOQUEANDO TU ELECCIÓN</div>}{opening&&<div className="locking"><Sparkles/>TU PREMIO ESTÁ ILUMINADO</div>}
 </motion.section>
}

function Results({result,reset}:{result:DrawResult;reset:()=>void}){return <motion.section {...screen} className="results screen"><span className="eyebrow"><Sparkles size={14}/>TU ELECCIÓN TENÍA PREMIO</span><h1>¡Felicidades!</h1><p className="won">GANASTE</p><div className="prize-orb" style={{'--prize':result.prize.color} as React.CSSProperties}><span><PrizeIcon prizeId={result.prize.id}/></span></div><h2>{result.prize.name}</h2><p>{result.prize.description}</p><aside className="instant-delivery"><Check/><div><b>Premio entregado</b><p>{result.prize.claimInstructions}</p></div></aside><button className="primary" onClick={reset}>FINALIZAR<Check/></button></motion.section>}
function ErrorView({title,message,retry}:{title?:string;message:string;retry:()=>void}){return <motion.section {...screen} className="error-view screen"><div className="error-icon">!</div><h1>{title??'Algo interrumpió la experiencia'}</h1><p>{message}</p><button className="primary" onClick={retry}><RotateCcw/>VOLVER A INTENTAR</button></motion.section>}
