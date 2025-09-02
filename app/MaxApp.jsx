"use client";
import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList, LineChart, Line } from "recharts";

// ===== UI consts =====
const UX={card:'p-4 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden',input:'rounded-xl border border-neutral-300 px-3 py-2',inputSm:'rounded-lg border border-neutral-300 px-2 py-1',btn:'px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-100',btnPri:'rounded-xl bg-neutral-900 text-white px-4 py-2',btnChipSel:'px-3 py-1.5 text-sm bg-neutral-900 text-white',btnChip:'px-3 py-1.5 text-sm bg-white text-neutral-700 hover:bg-neutral-100',danger:'px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50'};
const tabBtn=(route,tab,id)=>`px-3 py-1.5 rounded-full border ${route==='app'&&tab===id?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'}`;

// ===== Utils =====
const LS_KEY="max-toilet-logs-v1", WLS_KEY="max-weight-logs-v1", FOOD_KEY="max-food-logs-v1", DAY_MS=864e5;
const DEFAULT_WEIGHT_BASE=[{date:"2025-07-10",kg:1.2,note:"baseline"},{date:"2025-07-17",kg:1.5,note:"baseline"},{date:"2025-07-24",kg:1.65,note:"baseline"},{date:"2025-08-07",kg:1.85,note:"baseline"}];
const BRANDS=[{id:'orijen',label:'Orijen Puppy small breed'},{id:'purina',label:'Purina Puppy Medium Healthy start'}];
const brandLabel=(id)=>BRANDS.find(b=>b.id===id)?.label||id;
const LQ_LABEL=["💩 (normal)","💩💧 (slightly loose)","💩💦 (mostly liquid)","💦💦 (diarrhea)"]; const LQ_ICON=["💩","💩💧","💩💦","💦💦"];
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const toISOLocal=(dt)=>{const d=new Date(dt); d.setSeconds(0,0); return d.toISOString()};
const dateKey=(iso)=>{const d=new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const hourKey=(iso)=>new Date(iso).getHours();
const fmtTime=(iso)=>new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false});
const fmtDate=(iso)=>new Date(iso).toLocaleDateString([], {year:'numeric',month:'short',day:'2-digit'});
const parseLocalDateTimeInput=(v)=>{if(!v) return null; const d=new Date(v); return isNaN(d.getTime())?null:d;};
const toLocalInputValue=(date)=>{const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
const toLocalDateInputValue=(date)=>{const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const todayLocalKey=()=>toLocalDateInputValue(new Date());
const median=(a)=>{if(!a.length) return null; const s=[...a].sort((x,y)=>x-y), m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2};
const msToHHMM=(ms)=>{if(ms==null) return '-'; const t=Math.round(ms/6e4),h=Math.floor(t/60),m=t%60; return `${h}h${String(m).padStart(2,'0')}`};
const dl=(name,blob)=>{const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url)};

// centered emoji in stacked bars (if tall enough)
const emojiLabel=(emoji)=>(props)=>{ const {x,y,width,height,value}=props; if(!value||height<14||width<18) return null; return (<text x={x+width/2} y={y+height/2} textAnchor="middle" dominantBaseline="central" fontSize={12}>{emoji}</text>); };

// per-day LQ aggregation
function computePerDayLq(rangeStart, rangeEnd, entries){
  const map=new Map();
  const d0=new Date(rangeStart); d0.setHours(0,0,0,0);
  const d1=new Date(rangeEnd);   d1.setHours(0,0,0,0);
  for(let d=new Date(d0); d<=d1; d.setDate(d.getDate()+1)){
    const k=dateKey(d.toISOString()); map.set(k,{date:k,l0:0,l1:0,l2:0,l3:0});
  }
  for(const e of entries){ if(e.type==='poo'){ const k=dateKey(e.time); const idx=Math.max(0,Math.min(3,Number(e.pooLq)||0)); const row=map.get(k)||{date:k,l0:0,l1:0,l2:0,l3:0}; row['l'+idx]++; map.set(k,row);} }
  return [...map.values()];
}

// ===== Daily routine =====
const H=(h,m=0)=>h*60+m; const pad2=(n)=>String(n).padStart(2,'0'); const fmtHM=(mins)=>`${pad2(Math.floor(mins/60))}:${pad2(mins%60)}`; const minOfDay=(d)=>d.getHours()*60+d.getMinutes();
const deltaStr=(from,to)=>{let d=to-from; if(d<=0) return 'now'; const h=Math.floor(d/60),m=d%60; const hs=h?`${h}h`:''; const ms=m?`${h?pad2(m):m}m`:(!h?'0m':''); return `in ${hs}${ms}`};
function buildDailyPattern(now=new Date()){
  const items=[]; const mk=(id,label,start,end,icon,optional=false,note='')=>({id,label,start,end,icon,optional,note});
  items.push(mk('kong','Kong (frozen)',H(6),H(7),'🧊🍖',false,'Give frozen; squeeze when stuck'));
  items.push(mk('meal-07','Meal',H(7),null,'🍽️'));
  items.push(mk('meal-10','Meal',H(10),null,'🍽️'));
  items.push(mk('meal-14','Meal',H(14),null,'🍽️'));
  items.push(mk('meal-18','Meal',H(18),null,'🍽️'));
  [H(6),H(9),H(12),H(15),H(18),H(21)].forEach((t,i)=>items.push(mk(`toilet-${i}`,'Toilet',t,null,'🚽')));
  [H(8,30),H(12),H(15)].forEach((t,i)=>items.push(mk(`run-${i}`,'Run-around',t,null,'🏃‍♂️')));
  items.push(mk('run-2030','Run-around',H(20,30),null,'🏃‍♂️',true));
  if(now.getDay()===4) items.push(mk('rabbit-ear','Rabbit ear (Thursday)',H(16),null,'🐰👂'));
  return items.sort((a,b)=>a.start-b.start);
}
function annotatePattern(items, now=new Date()){
  const nm=minOfDay(now); const WINDOW_MIN=30; const clamp=(v)=>Math.max(0,Math.min(24*60,v));
  const win=(it)=>{ const endBase=it.end??it.start; return {ws:clamp(it.start-WINDOW_MIN), we:clamp(endBase+WINDOW_MIN)} };
  const within=(it)=>{ const {ws,we}=win(it); return nm>=ws&&nm<=we };
  const currentIdx=items.findIndex(within);
  const nextIdx=items.findIndex((it,idx)=>(currentIdx>=0?idx>currentIdx:true)&&it.start>nm);
  return items.map((it,idx)=>{ const {we}=win(it); if(currentIdx>=0){ if(idx<currentIdx) return {...it,status:'past'}; if(idx===currentIdx) return {...it,status:'now'}; if(idx===nextIdx) return {...it,status:'next'}; return {...it,status:'upcoming'}; } else { if(nm>we) return {...it,status:'past'}; if(idx===nextIdx) return {...it,status:'next'}; return {...it,status:'upcoming'}; } });
}
function buildHourDetail(items, dayEntries){
  const rows=Array.from({length:24},(_,h)=>({hour:`${String(h).padStart(2,'0')}:00`,schedule:[],events:[]}));
  for(const it of items){ const h=Math.floor(it.start/60); const lbl=`${it.icon} ${it.label} ${it.end?`${fmtHM(it.start)}–${fmtHM(it.end)}`:fmtHM(it.start)}`; rows[h].schedule.push(lbl); }
  for(const e of dayEntries){ const h=new Date(e.time).getHours(); const lbl=`${e.type==='wee'?'💧':'💩'} ${fmtTime(e.time)}${e.type==='poo'?` ${LQ_ICON[e.pooLq??0]}`:''}`; rows[h].events.push(lbl); }
  return rows;
}

// ===== self-tests =====
function runSelfTests(){
  const T=(n,c)=>console[c?'log':'warn'](`TEST ${c?'OK':'FAIL'} - ${n}`);
  try{
    T('LQ lengths',LQ_LABEL.length===4&&LQ_ICON.length===4);
    T('icons map',LQ_ICON[2]==='💩💦');
    T('dateKey',dateKey('2025-01-02T12:00:00')==='2025-01-02');
    T('median even',Math.abs(median([1,3,2,6])-2.5)<1e-9);
    T('msToHHMM 90m',msToHHMM(90*6e4)==='1h30');
    T('fmtTime 24h',/^\d{2}:\d{2}$/.test((()=>{const d=new Date('2025-01-01T13:05:00'); return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false});})()));
    const s=new Date('2025-01-02T00:00:00Z'), e=new Date('2025-01-02T23:59:00Z'); const out=computePerDayLq(s,e,[{type:'poo',time:'2025-01-02T05:00:00Z',pooLq:2}]);
    T('perDayLq shape', out.length===1 && out[0].l2===1);
    const nowT=new Date(); nowT.setHours(12,20,0,0); const pat=annotatePattern([{id:'x',label:'Test',start:H(12),end:null,icon:'x'}], nowT); T('now window ±30', pat[0].status==='now');
    T('projection interp', Math.abs(projectedKgAt('2025-08-28')-2.075)<0.01);
  }catch(e){console.warn('Self-tests crash',e);} }

// ===== storage =====
const loadEntries=()=>{try{const raw=localStorage.getItem(LS_KEY); const p=raw?JSON.parse(raw):[]; return Array.isArray(p)?p:[]}catch{return[]}};
const saveEntries=(entries)=>localStorage.setItem(LS_KEY,JSON.stringify(entries));
const loadWeights=()=>{try{const raw=localStorage.getItem(WLS_KEY); if(!raw){const seeded=DEFAULT_WEIGHT_BASE.map(w=>({id:uid(),...w})); return seeded.sort((a,b)=>new Date(a.date)-new Date(b.date))} const p=JSON.parse(raw); if(!Array.isArray(p)) return []; const cleaned=p.filter(w=>w&&w.date&&isFinite(Number(w.kg))).map(w=>({id:w.id||uid(),date:w.date,kg:Number(w.kg),note:w.note||''})); return cleaned.sort((a,b)=>new Date(a.date)-new Date(b.date))}catch{return[]}};
const saveWeights=(weights)=>localStorage.setItem(WLS_KEY,JSON.stringify(weights));
const loadFoods=()=>{try{const raw=localStorage.getItem(FOOD_KEY); const p=raw?JSON.parse(raw):[]; if(!Array.isArray(p)) return []; return p.filter(f=>f&&f.date&&f.brand&&isFinite(Number(f.grams))).map(f=>({id:f.id||uid(),date:f.date,brand:f.brand,grams:Number(f.grams),note:f.note||''})).sort((a,b)=>new Date(a.date)-new Date(b.date))}catch{return[]}};
const saveFoods=(foods)=>localStorage.setItem(FOOD_KEY,JSON.stringify(foods));

// ===== weight projection (for merge table) =====
const PROJECTION_ROWS=[
  {weeks:12,date:"2025-08-07",kg:1.85,notes:"Actual"},
  {weeks:14,date:"2025-08-21",kg:2.00,notes:"Steady gain"},
  {weeks:16,date:"2025-09-04",kg:2.15,notes:"Growth still moderate"},
  {weeks:20,date:"2025-10-02",kg:2.35,notes:"End of fastest growth phase"},
  {weeks:24,date:"2025-10-30",kg:2.55,notes:"Halfway to maturity"},
  {weeks:28,date:"2025-11-27",kg:2.70,notes:"Gains slowing"},
  {weeks:32,date:"2025-12-25",kg:2.85,notes:"Start of plateau"},
  {weeks:36,date:"2026-01-22",kg:2.95,notes:"Nearly adult weight"},
  {weeks:40,date:"2026-02-19",kg:3.00,notes:"Fully grown for most toy poodles"},
  {weeks:44,date:"2026-04-15",kg:3.00,notes:"Final adult range start (approx)"},
  {weeks:48,date:"2026-05-15",kg:3.00,notes:"Final adult range end (approx)"},
]; 
const PROJ_SORTED = PROJECTION_ROWS.map(r=>({...r, d:new Date(r.date)})).sort((a,b)=> new Date(a.date)-new Date(b.date));
function projectedKgAt(date){
  const d=new Date(date);
  if(!PROJ_SORTED.length) return null;
  if(d<=PROJ_SORTED[0].d) return PROJ_SORTED[0].kg;
  if(d>=PROJ_SORTED[PROJ_SORTED.length-1].d) return PROJ_SORTED[PROJ_SORTED.length-1].kg;
  let i=1; while(i<PROJ_SORTED.length && PROJ_SORTED[i].d < d) i++;
  const a=PROJ_SORTED[i-1], b=PROJ_SORTED[i];
  const t=(d-a.d)/(b.d-a.d);
  return a.kg + t*(b.kg - a.kg);
}

// ===== routing =====
const routeFromHash=(h)=>h==='#quicklog'?'quicklog':'app';
const getRouteFromHash=()=>{try{return routeFromHash(window?.location?.hash||'')}catch{return'app'}};

// ===== App =====
export default function App(){
  const [route,setRoute]=useState(()=>getRouteFromHash());
  const [entries,setEntries]=useState(()=>loadEntries());
  const [weights,setWeights]=useState(()=>loadWeights());
  const [foods,setFoods]=useState(()=>loadFoods());
  const [type,setType]=useState('wee');
  const [pooLq,setPooLq]=useState(0);
  const [when,setWhen]=useState(()=>toLocalInputValue(new Date()));
  const [quickWhen,setQuickWhen]=useState(()=>toLocalInputValue(new Date()));
  const [quickPooLq,setQuickPooLq]=useState(0);
  const [autoQuickTime,setAutoQuickTime]=useState(true);
  // auto re-enable after 60s if disabled
  useEffect(()=>{ if(autoQuickTime) return; const t=setTimeout(()=>setAutoQuickTime(true),60000); return()=>clearTimeout(t) },[autoQuickTime]);
  const [note,setNote]=useState('');
  const [tab,setTab]=useState('dashboard');
  const [tick,setTick]=useState(0);

  // ranges
  const now=new Date(); const twoWeeksAgo=new Date(now); twoWeeksAgo.setDate(now.getDate()-13);
  const [from,setFrom]=useState(()=>toLocalInputValue(twoWeeksAgo));
  const [to,setTo]=useState(()=>toLocalInputValue(now));

  useEffect(()=>saveEntries(entries),[entries]);
  useEffect(()=>saveWeights(weights),[weights]);
  useEffect(()=>saveFoods(foods),[foods]);
  useEffect(()=>{const onHash=()=>setRoute(getRouteFromHash()); window.addEventListener('hashchange',onHash); return()=>window.removeEventListener('hashchange',onHash)},[]);
  useEffect(()=>{ if(!autoQuickTime) return; const id=setInterval(()=>setQuickWhen(toLocalInputValue(new Date())),10000); return()=>clearInterval(id) },[autoQuickTime]);
  useEffect(()=>{ runSelfTests(); },[]);
  useEffect(()=>{ const syncNow=()=>setTo(prev=>{ const prevDate=parseLocalDateTimeInput(prev)||new Date(0); const n=new Date(); return n>prevDate?toLocalInputValue(n):prev }); const onFocus=()=>syncNow(); const onVis=()=>{ if(!document.hidden) syncNow() }; window.addEventListener('focus',onFocus); document.addEventListener('visibilitychange',onVis); return()=>{ window.removeEventListener('focus',onFocus); document.removeEventListener('visibilitychange',onVis) } },[]);
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),30000); return()=>clearInterval(id) },[]);

  // entry ops
  const addEntry=(kind,date=new Date(),memo='',extra={})=>{const e={id:uid(),type:kind,time:toISOLocal(date),note:memo?.trim()||'',...extra}; setEntries(prev=>[...prev,e].sort((a,b)=>new Date(a.time)-new Date(b.time)))};
  const onSubmit=(ev)=>{ev.preventDefault(); const d=parseLocalDateTimeInput(when); if(!d) return; addEntry(type,d,note,type==='poo'?{pooLq:Number(pooLq)}:{}); setNote('')};
  const onDelete=(id)=>setEntries(es=>es.filter(x=>x.id!==id));
  const onEditSave=(id,newType,newWhenLocal,newNote,newPooLq)=>{const d=parseLocalDateTimeInput(newWhenLocal); if(!d) return; setEntries(prev=>{const up=prev.map(e=>e.id===id?{...e,type:newType,time:toISOLocal(d),note:newNote,pooLq:newType==='poo'?Number(newPooLq??0):undefined}:e); return up.sort((a,b)=>new Date(a.time)-new Date(b.time))})};
  const onClearAll=()=>{ if(confirm('Delete ALL entries?')) setEntries([]) };

  // weights
  const [wDate,setWDate]=useState(()=>toLocalDateInputValue(new Date()));
  const [wKg,setWKg]=useState('');
  const [wNote,setWNote]=useState('');
  const addWeight=()=>{const kg=Number(wKg); if(!wDate||!isFinite(kg)) return; const item={id:uid(),date:wDate,kg,note:wNote||''}; setWeights(prev=>[...prev,item].sort((a,b)=>new Date(a.date)-new Date(b.date))); setWNote(''); setWKg('')};
  const onDeleteWeight=(id)=>setWeights(ws=>ws.filter(x=>x.id!==id));
  const onEditWeightSave=(id,newDate,newKg,newNote)=>{const kg=Number(newKg); if(!newDate||!isFinite(kg)) return; setWeights(prev=>prev.map(w=>w.id===id?{...w,date:newDate,kg,note:newNote}:w).sort((a,b)=>new Date(a.date)-new Date(b.date)))};

  // foods
  const [fDate,setFDate]=useState(()=>todayLocalKey());
  const [fBrand,setFBrand]=useState('orijen');
  const [fGrams,setFGrams]=useState('');
  const [fNote,setFNote]=useState('');
  const addFood=()=>{const g=Number(fGrams); if(!fDate||!fBrand||!isFinite(g)) return; const it={id:uid(),date:fDate,brand:fBrand,grams:g,note:fNote||''}; setFoods(prev=>[...prev,it].sort((a,b)=>new Date(a.date)-new Date(b.date))); setFGrams(''); setFNote('')};
  const onDeleteFood=(id)=>setFoods(fs=>fs.filter(x=>x.id!==id));
  const onEditFoodSave=(id,newDate,newBrand,newGrams,newNote)=>{const g=Number(newGrams); if(!newDate||!newBrand||!isFinite(g)) return; setFoods(prev=>prev.map(f=>f.id===id?{...f,date:newDate,brand:newBrand,grams:g,note:newNote}:f).sort((a,b)=>new Date(a.date)-new Date(b.date)))};
  const lastGramsByBrand=useMemo(()=>{ const map={}; for(let i=foods.length-1;i>=0;i--){ const f=foods[i]; if(map[f.brand]==null) map[f.brand]=Number(f.grams) } return map },[foods]);
  useEffect(()=>{ const g=lastGramsByBrand[fBrand]; if(g!=null) setFGrams(String(g)) },[fBrand]);

  // aggregations
  const rangeStart=useMemo(()=>parseLocalDateTimeInput(from)||new Date(0),[from]);
  const rangeEnd=useMemo(()=>parseLocalDateTimeInput(to)||new Date(),[to]);
  const rangeEntries=useMemo(()=>entries.filter(e=>{const t=new Date(e.time); return t>=rangeStart&&t<=rangeEnd}),[entries,from,to]);
  const perDay=useMemo(()=>{const map=new Map(); for(const e of rangeEntries){const k=dateKey(e.time); if(!map.has(k)) map.set(k,{date:k,wee:0,poo:0,total:0}); const r=map.get(k); r[e.type]++; r.total++} const out=[],d0=new Date(rangeStart),d1=new Date(rangeEnd); d0.setHours(0,0,0,0); d1.setHours(0,0,0,0); for(let d=new Date(d0); d<=d1; d.setDate(d.getDate()+1)){const k=dateKey(d.toISOString()); out.push(map.get(k)||{date:k,wee:0,poo:0,total:0})} return out},[rangeEntries,rangeStart,rangeEnd]);
  const hourly=useMemo(()=>{const base=Array.from({length:24},(_,h)=>({hour:`${String(h).padStart(2,'0')}:00`,wee:0,poo:0})); for(const e of rangeEntries){base[hourKey(e.time)][e.type]++} return base},[rangeEntries]);
  const totals=useMemo(()=>{const days=perDay.length||1,sumWee=perDay.reduce((a,r)=>a+r.wee,0),sumPoo=perDay.reduce((a,r)=>a+r.poo,0); const avgWee=sumWee/days,avgPoo=sumPoo/days; const toMs=x=>new Date(x).getTime(),sorted=[...rangeEntries].sort((a,b)=>toMs(a.time)-toMs(b.time)); const gapsWee=[],gapsPoo=[]; let lastWee=null,lastPoo=null; for(const e of sorted){ if(e.type==='wee'){ if(lastWee) gapsWee.push(toMs(e.time)-toMs(lastWee.time)); lastWee=e}else{ if(lastPoo) gapsPoo.push(toMs(e.time)-toMs(lastPoo.time)); lastPoo=e } } const peaksWee=[...hourly].map((r,h)=>({h,c:r.wee})).sort((a,b)=>b.c-a.c).slice(0,3).map(x=>x.h); const peaksPoo=[...hourly].map((r,h)=>({h,c:r.poo})).sort((a,b)=>b.c-a.c).slice(0,3).map(x=>x.h); return {days,sumWee,sumPoo,avgWee,avgPoo,medGapWee:median(gapsWee)??null,medGapPoo:median(gapsPoo)??null,peaksWee,peaksPoo}},[perDay,hourly,rangeEntries]);

  // today food summary
  const todayKey=todayLocalKey();
  const foodToday=useMemo(()=>{const sums=new Map(); for(const f of foods){ if(f.date===todayKey){ sums.set(f.brand,(sums.get(f.brand)||0)+Number(f.grams)) } } return BRANDS.map(b=>({brand:b.id,label:b.label,grams:sums.get(b.id)||0})) },[foods,todayKey]);

  // per-day LQ stacked
  const perDayLq=useMemo(()=>computePerDayLq(rangeStart,rangeEnd,rangeEntries),[rangeEntries,rangeStart,rangeEnd]);

  // Daily routine
  const todayItems=useMemo(()=>buildDailyPattern(new Date()),[tick]);
  const pattern=useMemo(()=>annotatePattern(todayItems,new Date()),[todayItems,tick]);
  const [showDayDetail,setShowDayDetail]=useState(false);
  const [view,setView]=useState('chips'); // 'chips' | 'timeline'
  const StatusBadge=({status})=>{
    const t = status==='now'?'NOW': status==='next'?'NEXT': status==='past'?'PAST':'UPCOMING';
    const cls = status==='now' ? 'bg-neutral-900 text-white' : status==='next' ? 'bg-white text-neutral-800 border border-neutral-300' : 'text-neutral-400 border border-neutral-200';
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{t}</span>;
  };
  const hourRows=useMemo(()=>buildHourDetail(todayItems,entries.filter(e=>dateKey(e.time)===todayKey)),[todayItems,entries,todayKey]);

  // Notifications (default ON)
  const [notifyEnabled,setNotifyEnabled]=useState(true);
  const [notifyLeadMin,setNotifyLeadMin]=useState(5);
  const [notifyMuted,setNotifyMuted]=useState(false);
  const notifyTimer=React.useRef(null);
  const [toast,setToast]=useState(null);
  const dismissedAlertsRef = React.useRef(new Set());
  const [dismissedBump,setDismissedBump] = useState(0);
  const notifSupport = typeof Notification !== 'undefined';
  const notifPerm = notifSupport ? Notification.permission : 'unsupported';
  const fireNotify=(title, body, opts={})=>{
    try{
      if(notifSupport && Notification.permission==='granted'){
        new Notification(title,{body});
      }else{
        // Fallback: in-app toast + soft beep + title badge
        setToast({title, body, ts: Date.now(), alertKey: opts?.key || null});
        try{ if(!notifyMuted){ const C=window.AudioContext||window.webkitAudioContext; if(C){ const ctx=new C(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=880; g.gain.value=0.001; g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime+0.02); o.start(); o.stop(ctx.currentTime+0.18); setTimeout(()=>ctx.close(),300); } } }catch{}
        const prev=document.title; document.title=`🔔 ${title}`; setTimeout(()=>{ document.title=prev }, 5000);
      }
    }catch(e){
      // If system notification throws (iframe/sandbox), show fallback
      setToast({title:`${title}`, body:body+" — using in‑app alert (system blocked)", ts: Date.now(), alertKey: opts?.key || null});
    }
  };
  useEffect(()=>{
    if(notifyTimer.current){ clearTimeout(notifyTimer.current); notifyTimer.current=null }
    if(!notifyEnabled) return;
    const now = new Date();
    const todayKeyStr = toLocalDateInputValue(now);
    const nm=minOfDay(now);
    const next=(pattern||[]).find(p=>p.status==='next')||(pattern||[]).find(p=>p.status==='upcoming');
    if(!next) return;
    const eventKey = `${todayKeyStr}:${next.id}:${next.start}`;
    if(dismissedAlertsRef.current.has(eventKey)) return;
    const delay=Math.max(0,((next.start-nm-(notifyLeadMin||0))*60*1000));
    notifyTimer.current=setTimeout(()=>{
      fireNotify(`Next: ${next.icon} ${next.label}`, `${fmtHM(next.start)} in ${notifyLeadMin||0}m`, {key:eventKey});
    },delay);
    return ()=>{ if(notifyTimer.current) clearTimeout(notifyTimer.current) };
  },[notifyEnabled,notifyLeadMin,pattern,tick,dismissedBump]);
  useEffect(()=>{ if(notifyEnabled && notifSupport && Notification.permission==='default'){ try{ Notification.requestPermission() }catch{} } },[notifyEnabled, notifSupport]);

  // Reset dismissed alerts when the day changes
  useEffect(()=>{ dismissedAlertsRef.current.clear(); setDismissedBump(x=>x+1) }, [todayKey]);

  // weight due badge & next date
  const lastWeightDate=useMemo(()=>weights.length?new Date(weights[weights.length-1].date):null,[weights]);
  const daysSinceLastWeight=useMemo(()=> lastWeightDate?Math.floor((new Date()-lastWeightDate)/DAY_MS):Infinity,[lastWeightDate,tick]);
  const nextWeightDate=useMemo(()=>{ const base=lastWeightDate?new Date(lastWeightDate):new Date(); const d=new Date(base); d.setDate(d.getDate()+14); return d },[lastWeightDate]);
  const daysUntilNextWeight=useMemo(()=>Math.ceil((nextWeightDate-new Date())/DAY_MS),[nextWeightDate,tick]);
  const weightStatus = daysUntilNextWeight < 0 ? 'overdue' : (daysUntilNextWeight === 0 ? 'dueToday' : 'ok');
  const weightDue = daysUntilNextWeight <= 0; // due today or overdue
  const nextWeightLabel=daysUntilNextWeight>=0?`in ${daysUntilNextWeight} day${daysUntilNextWeight===1?'':'s'}`:`${Math.abs(daysUntilNextWeight)} day${Math.abs(daysUntilNextWeight)===1?'':'s'} overdue`;
  const lastWeightKg = useMemo(()=> weights.length ? Number(weights[weights.length-1].kg) : null, [weights]);
  const expectedAtLast = useMemo(()=> lastWeightDate ? projectedKgAt(lastWeightDate) : null, [lastWeightDate]);
  const weightDeviation = useMemo(()=> (lastWeightKg!=null && expectedAtLast!=null) ? Math.abs(lastWeightKg-expectedAtLast)/expectedAtLast : null, [lastWeightKg, expectedAtLast]);
  const weightDevClass = weightDeviation==null ? 'text-neutral-700' : (weightDeviation>=0.2 ? 'text-red-700' : (weightDeviation>=0.1 ? 'text-orange-700' : 'text-neutral-700'));

  // === Weight chart & projection data ===
  const weightChartData = useMemo(()=>{
    const actualMap = new Map(weights.map(w=>[w.date, Number(w.kg)]));
    const allDates = new Set([...weights.map(w=>w.date), ...PROJ_SORTED.map(r=>r.date)]);
    const sorted = [...allDates].sort((a,b)=> new Date(a)-new Date(b));
    return sorted.map(d=>({
      date: d,
      actual: actualMap.has(d) ? Number(actualMap.get(d)) : null,
      projected: projectedKgAt(d)
    }));
  },[weights]);

  const projTableRows = useMemo(()=>{
    const actualMap = new Map(weights.map(w=>[w.date, Number(w.kg)]));
    return PROJ_SORTED.map(r=>{
      const actual = actualMap.get(r.date) ?? null;
      const delta = (actual!=null) ? (Number(actual) - Number(r.kg)) : null;
      return { weeks:r.weeks, date:r.date, kg:r.kg, actual, delta, notes:r.notes };
    });
  },[weights]);

  // Day-of weight alert (09:00 local; immediate if past or overdue). Fires once per day.
  const weightAlertTimer=React.useRef(null);
  const [weightAlertFiredDate,setWeightAlertFiredDate]=useState(null);
  useEffect(()=>{
    if(weightAlertTimer.current){ clearTimeout(weightAlertTimer.current); weightAlertTimer.current=null }
    if(!notifyEnabled) return; // reuse global alerts toggle
    if(!nextWeightDate) return;
    const todayKeyStr = toLocalDateInputValue(new Date());
    const dueKey = toLocalDateInputValue(nextWeightDate);
    if(weightStatus==='ok') return; // not due yet
    if(weightAlertFiredDate===todayKeyStr) return; // already alerted today
    const now=new Date();
    const target=new Date();
    if(dueKey===todayKeyStr){ target.setHours(9,0,0,0) } else { target.setTime(now.getTime()+1000) }
    const delay=Math.max(0, target-now);
    weightAlertTimer.current=setTimeout(()=>{ fireNotify('⚖️ Weight check due', 'Log a new weight measurement today.'); setWeightAlertFiredDate(todayKeyStr) }, delay);
    return ()=>{ if(weightAlertTimer.current) clearTimeout(weightAlertTimer.current) };
  },[weightStatus,nextWeightDate,notifyEnabled,tick]);

  if(route==='quicklog') return (
    <QuickLogView onAdd={(kind,extra)=>{const d=parseLocalDateTimeInput(quickWhen)||new Date(); addEntry(kind,d,'',extra||{}); setAutoQuickTime(true)} } recent={[...entries].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,5)} onBack={()=>{window.location.hash=''; setRoute('app')}} />
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <h1 className="text-xl font-semibold">Max — Tracker</h1>
          <nav className="ml-auto flex gap-1 text-sm">
            {[{id:'dashboard',label:'Dashboard'},{id:'log',label:'Log'},{id:'food',label:'Food'},{id:'weight',label:'Weight'},{id:'data',label:'Data'}].map(t=> (
              <button key={t.id} onClick={()=>{window.location.hash=''; setRoute('app'); setTab(t.id)}} className={ t.id==='weight' ? (weightStatus==='overdue' ? 'px-3 py-1.5 rounded-full border bg-red-600 text-white border-red-600' : (weightStatus==='dueToday' ? 'px-3 py-1.5 rounded-full border bg-orange-500 text-white border-orange-500' : tabBtn(route,tab,t.id))) : tabBtn(route,tab,t.id) }>{t.label}</button>
            ))}
            <button onClick={()=>{window.location.hash='#quicklog'; setRoute('quicklog')}} className="px-3 py-1.5 rounded-full border border-neutral-200 hover:bg-neutral-100">Quick Log</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <div className={UX.card}><label className="text-xs font-medium text-neutral-500">From</label><input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)} className={`mt-1 w-full ${UX.input} focus:outline-none focus:ring-2 focus:ring-neutral-800`} /></div>
          <div className={UX.card}><label className="text-xs font-medium text-neutral-500">To</label><input type="datetime-local" value={to} onChange={e=>setTo(e.target.value)} className={`mt-1 w-full ${UX.input} focus:outline-none focus:ring-2 focus:ring-neutral-800`} /></div>
          <div className={`${UX.card} flex items-end gap-2`}>
            {[[6,'Last 7 days'],[13,'Last 14 days']].map(([n,label])=> (<button key={n} onClick={()=>{const n2=new Date(); const s=new Date(); s.setDate(n2.getDate()-n); setFrom(toLocalInputValue(s)); setTo(toLocalInputValue(n2))}} className={UX.btn}>{label}</button>))}
            <button onClick={()=>{const n2=new Date(); const s=new Date(); s.setMonth(n2.getMonth()-1); setFrom(toLocalInputValue(s)); setTo(toLocalInputValue(n2))}} className={UX.btn}>Last 30 days</button>
          </div>
        </section>

        {tab==='dashboard' && (
          <section className="grid gap-6">
            {(weightStatus!=='ok') && (<div className="flex justify-end"><button onClick={()=>setTab('weight')} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${weightStatus==='overdue'?'bg-red-100 text-red-800 border-red-300':'bg-orange-100 text-orange-800 border-orange-300'}`}>{weightStatus==='overdue'?'⚖️ Overdue weight':'⚖️ Weight due today'}</button></div>)}
            <div className="flex justify-end"><button onClick={()=>setTab('weight')} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${weightStatus==='overdue'?'bg-red-100 text-red-800 border-red-300':weightStatus==='dueToday'?'bg-orange-100 text-orange-800 border-orange-300':'bg-neutral-100 text-neutral-700 border-neutral-300'}`}>⚖️ <span className={weightDevClass} title={expectedAtLast!=null?('Expected: '+expectedAtLast.toFixed(2)+' kg'):undefined}>{lastWeightKg!=null?`${lastWeightKg.toFixed(2)} kg`:'—'}</span> — Next: <span className="font-medium">{fmtDate(nextWeightDate)}</span> <span className="text-neutral-500">({nextWeightLabel})</span></button></div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className={UX.card}>
                <h3 className="font-semibold mb-2">Quick Add</h3>
                <div className="grid gap-3">
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] items-end">
                    <div className="min-w-0">
                      <label className="text-xs font-medium text-neutral-500">Time</label>
                      <input type="datetime-local" value={quickWhen} onChange={e=>{setQuickWhen(e.target.value); setAutoQuickTime(false)} } onFocus={()=>setAutoQuickTime(false)} className={`mt-1 w-full min-w-0 h-11 ${UX.input} focus:outline-none focus:ring-2 focus:ring-neutral-800`} />
                    </div>
                    <button type="button" onClick={()=>setQuickWhen(toLocalInputValue(new Date()))} className={`h-11 w-full sm:w-auto whitespace-nowrap text-sm ${UX.btn}`}>Now</button>
                    <button type="button" onClick={()=>setAutoQuickTime(v=>!v)} aria-pressed={autoQuickTime} className={`h-11 w-full sm:w-auto whitespace-nowrap text-sm rounded-xl border ${autoQuickTime?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'}`}>Auto</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500">Poo Lq</span>
                    <div className="inline-flex rounded-xl border border-neutral-300 overflow-hidden">
                      {[0,1,2,3].map(v=> (<button key={v} type="button" onClick={()=>setQuickPooLq(v)} className={quickPooLq===v?UX.btnChipSel:UX.btnChip}>{LQ_ICON[v]}</button>))}
                    </div>
                    <span className="text-xs text-neutral-500 hidden sm:block">{LQ_LABEL[quickPooLq]}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>{const d=parseLocalDateTimeInput(quickWhen); if(!d) return; addEntry('wee',d,''); setAutoQuickTime(true)}} className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:opacity-90">Add Wee 💧</button>
                    <button type="button" onClick={()=>{const d=parseLocalDateTimeInput(quickWhen); if(!d) return; addEntry('poo',d,'',{pooLq:Number(quickPooLq)}); setAutoQuickTime(true)}} className="px-3 py-2 rounded-xl bg-amber-600 text-white hover:opacity-90">Add Poo 💩</button>
                  </div>
                </div>
              </div>

              <div className={UX.card}>
                <h3 className="font-semibold mb-2">Today's Food</h3>
                <ul className="text-sm">{foodToday.map(r=> (<li key={r.brand} className="flex justify-between py-1"><span className="text-neutral-600">{r.label}</span><span className="font-semibold">{r.grams} g</span></li>))}</ul>
                <div className="mt-2 text-right"><button onClick={()=>setTab('food')} className={UX.btn}>Add food</button></div>
              </div>

              <div className={UX.card}>
                <h3 className="font-semibold mb-2">Peak Hours</h3>
                <div className="text-sm"><div>💧 Wee: {totals.peaksWee.map(h=>`${String(h).padStart(2,'0')}:00`).join(', ')||'-'}</div><div>💩 Poo: {totals.peaksPoo.map(h=>`${String(h).padStart(2,'0')}:00`).join(', ')||'-'}</div></div>
              </div>
            </div>

            <div className={UX.card}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Daily Pattern</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-neutral-500">Alert</span>
                    <button onClick={()=>{ if(!notifyEnabled && notifSupport && Notification.permission==='default'){ try{ Notification.requestPermission().then(()=>setNotifyEnabled(true)) }catch{ setNotifyEnabled(v=>!v) } } else { setNotifyEnabled(v=>!v) } }} className={UX.btn}>{notifyEnabled?'🔔 On':'🔕 Off'}</button>
                    <select value={notifyLeadMin} onChange={e=>setNotifyLeadMin(Number(e.target.value))} className={UX.inputSm}>{[0,5,10,15].map(m=> <option key={m} value={m}>{m}m</option>)}</select>
                    <button onClick={()=>setNotifyMuted(v=>!v)} className={UX.btn} title={notifyMuted ? 'Unmute' : 'Mute'}>{notifyMuted ? '🔇' : '🔈'}</button>
                    <button onClick={()=>fireNotify('Test notification','This is a test')} className={UX.btn}>Test</button>
                    <span className="text-neutral-400">{notifSupport?`perm:${notifPerm}`:'no Notification API'}</span>
                  </div>
                  <div className="inline-flex rounded-full border border-neutral-300 overflow-hidden">
                    <button className={`px-3 py-1.5 text-sm ${view==='timeline'?'bg-neutral-900 text-white':'bg-white text-neutral-700'}`} onClick={()=>setView('timeline')}>Timeline</button>
                    <button className={`px-3 py-1.5 text-sm ${view==='chips'?'bg-neutral-900 text-white':'bg-white text-neutral-700'}`} onClick={()=>setView('chips')}>Chips</button>
                  </div>
                  <button onClick={()=>setShowDayDetail(true)} className="text-sm underline decoration-dotted underline-offset-4">Full day (hourly)</button>
                </div>
              </div>

              {view==='chips' ? (
                (() => { const now=new Date(); const nowM=minOfDay(now); const lastPast=[...pattern].reverse().find(p=>p.status==='past')||null; const current=pattern.find(p=>p.status==='now')||null; const upcoming=pattern.find(p=>p.status==='next')||pattern.find(p=>p.status==='upcoming')||null; return (<>
                  <div className="text-sm mb-3 text-center">{upcoming ? (<span>Next: <span className="font-medium">{upcoming.icon} {upcoming.label}</span> at {fmtHM(upcoming.start)} <span className="text-neutral-500">({deltaStr(nowM,upcoming.start)})</span></span>) : (<span>All done for today ✅</span>)}</div>
                  <div className="grid grid-cols-3 gap-2 text-sm text-center">{[{title:'Previous',item:lastPast,badge:'prev'},{title:'Now',item:current,badge:'now'},{title:'Next',item:upcoming,badge:'next'}].map(({title,item,badge})=> (
                    <div key={badge} className={`rounded-xl border p-3 ${badge==='now'?'bg-green-50 border-green-200':badge==='next'?'bg-blue-50 border-blue-200':'bg-neutral-50 border-neutral-200'}`}>
                      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
                      {item ? (<><div className="mt-1 font-medium tabular-nums">{item.end?`${fmtHM(item.start)}–${fmtHM(item.end)}`:fmtHM(item.start)}</div><div className="mt-1 flex items-center justify-center gap-2">{item.icon} {item.label} {item.optional && <span className="text-xs text-neutral-500">optional</span>}</div></>) : (<div className="mt-2 text-neutral-400">—</div>)}
                    </div>
                  ))}</div>
                </>); })()
              ) : (
                <div>
                  <div className="-mx-2">
                    <ul className="divide-y divide-neutral-200">
                      {pattern.map(it=>{
                        const rowCls = it.status==='past' ? 'opacity-60' : '';
                        return (
                          <li key={it.id} className={`py-3 px-2 flex items-center gap-3 ${rowCls}`}>
                            <span className="text-lg w-6 text-center">{it.icon}</span>
                            <div className="w-20 tabular-nums text-sm text-neutral-700">{it.end?`${fmtHM(it.start)}–${fmtHM(it.end)}`:fmtHM(it.start)}</div>
                            <div className="flex-1">
                              <div className={`font-medium ${it.status==='now'?'text-neutral-900':'text-neutral-800'}`}>{it.label}{it.optional && <span className="text-xs text-neutral-500"> (optional)</span>}</div>
                              {it.note? (<div className="text-xs text-neutral-500">{it.note}</div>) : null}
                            </div>
                            <StatusBadge status={it.status} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}

              {showDayDetail && (<div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-black/40" onClick={()=>setShowDayDetail(false)} /><div className="absolute inset-x-0 top-10 mx-auto max-w-2xl bg-white rounded-2xl border border-neutral-200 shadow-xl p-4"><div className="flex items-center justify-between mb-2"><h4 className="font-semibold">Today — hourly detail</h4><button onClick={()=>setShowDayDetail(false)} className={UX.btn}>Close</button></div><div className="max-h-[60vh] overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-500 border-b"><th className="py-2 pr-2">Hour</th><th className="py-2 pr-2">Schedule</th><th className="py-2 pr-2">Events</th></tr></thead><tbody>{hourRows.map((r,idx)=>(<tr key={idx} className="border-b last:border-0 align-top"><td className="py-2 pr-2 tabular-nums">{r.hour}</td><td className="py-2 pr-2">{r.schedule.length?r.schedule.map((s,i)=>(<div key={i}>{s}</div>)):<span className="text-neutral-400">—</span>}</td><td className="py-2 pr-2">{r.events.length?r.events.map((s,i)=>(<div key={i}>{s}</div>)):<span className="text-neutral-400">—</span>}</td></tr>))}</tbody></table></div></div></div>)}
            </div>

            <div className={UX.card}>
              <h3 className="font-semibold mb-3">Daily Counts</h3>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={perDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:12}} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="wee" stackId="a" name="Wee 💧" fill="#2563eb" /><Bar dataKey="poo" stackId="a" name="Poo 💩" fill="#d97706" /></BarChart></ResponsiveContainer></div>
            </div>

            <div className={UX.card}>
              <h3 className="font-semibold mb-3">Poo Liquidity per day</h3>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={perDayLq}><defs>
                <linearGradient id="gradL0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E6B8A2" /><stop offset="100%" stopColor="#F2E1D4" /></linearGradient>
                <linearGradient id="gradL1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EBD3C4" /><stop offset="60%" stopColor="#EBD3C4" /><stop offset="100%" stopColor="#CDE7FF" /></linearGradient>
                <linearGradient id="gradL2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F2E1D4" /><stop offset="40%" stopColor="#DDEBFF" /><stop offset="100%" stopColor="#A7D3FF" /></linearGradient>
                <linearGradient id="gradL3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E8F3FF" /><stop offset="100%" stopColor="#A7D3FF" /></linearGradient>
              </defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{fontSize:12}} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
              <Bar dataKey="l0" stackId="lq" name="💩 normal" fill="url(#gradL0)"><LabelList content={emojiLabel("💩")} /></Bar>
              <Bar dataKey="l1" stackId="lq" name="💩💧 slightly loose" fill="url(#gradL1)"><LabelList content={emojiLabel("💩💧")} /></Bar>
              <Bar dataKey="l2" stackId="lq" name="💩💦 mostly liquid" fill="url(#gradL2)"><LabelList content={emojiLabel("💩💦")} /></Bar>
              <Bar dataKey="l3" stackId="lq" name="💦💦 diarrhea" fill="url(#gradL3)"><LabelList content={emojiLabel("💦💦")} /></Bar>
              </BarChart></ResponsiveContainer></div>
            </div>

            <div className={UX.card}><h3 className="font-semibold mb-2">Recent Entries</h3><EntriesTable entries={[...rangeEntries].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,10)} onDelete={onDelete} onEditSave={onEditSave} /></div>
          </section>
        )}

        {tab==='log' && (<section className="grid gap-6"><div className={UX.card}><h3 className="font-semibold mb-3">Add Entry</h3><form onSubmit={onSubmit} className="grid md:grid-cols-5 gap-3 items-end"><div><label className="text-xs font-medium text-neutral-500">Type</label><select value={type} onChange={e=>setType(e.target.value)} className={`mt-1 w-full ${UX.input}`}><option value="wee">Wee 💧</option><option value="poo">Poo 💩</option></select></div>{type==='poo' && (<div><label className="text-xs font-medium text-neutral-500">Poo Lq</label><select value={pooLq} onChange={e=>setPooLq(Number(e.target.value))} className={`mt-1 w-full ${UX.input}`}>{[0,1,2,3].map(v=> <option key={v} value={v}>{LQ_LABEL[v]}</option>)}</select></div>)}<div><label className="text-xs font-medium text-neutral-500">When</label><input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} className={`mt-1 w-full ${UX.input}`} /></div><div className="md:col-span-2"><label className="text-xs font-medium text-neutral-500">Note</label><input value={note} onChange={e=>setNote(e.target.value)} className={`mt-1 w-full ${UX.input}`} /></div><div className="md:col-span-5 flex gap-2"><button className={UX.btnPri} type="submit">Add</button><button type="button" className={UX.btn} onClick={onClearAll}>Clear all</button></div></form></div><div className={UX.card}><h3 className="font-semibold mb-2">All Entries</h3><EntriesTable entries={[...entries].sort((a,b)=>new Date(b.time)-new Date(a.time))} onDelete={onDelete} onEditSave={onEditSave} /></div></section>)}

        {tab==='food' && (<section className="grid gap-6"><div className={UX.card}><h3 className="font-semibold mb-3">Add Food</h3><div className="grid md:grid-cols-5 gap-3 items-end"><div><label className="text-xs font-medium text-neutral-500">Date</label><input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} className={`mt-1 w-full ${UX.input}`} /></div><div><label className="text-xs font-medium text-neutral-500">Brand</label><select value={fBrand} onChange={e=>setFBrand(e.target.value)} className={`mt-1 w-full ${UX.input}`}>{BRANDS.map(b=> <option key={b.id} value={b.id}>{b.label}</option>)}</select></div><div><label className="text-xs font-medium text-neutral-500">Grams</label><input type="number" value={fGrams} onChange={e=>setFGrams(e.target.value)} className={`mt-1 w-full ${UX.input}`} /></div><div className="md:col-span-2"><label className="text-xs font-medium text-neutral-500">Note</label><input value={fNote} onChange={e=>setFNote(e.target.value)} className={`mt-1 w-full ${UX.input}`} /></div><div className="md:col-span-5"><button onClick={addFood} className={UX.btnPri}>Add</button></div></div></div><div className={UX.card}><h3 className="font-semibold mb-2">All Food</h3><FoodsTable foods={foods} onDelete={onDeleteFood} onEditSave={onEditFoodSave} /></div></section>)}

        {tab==='weight' && (<section className="grid gap-6">
          <div className={UX.card}>
            <h3 className="font-semibold mb-3">Add Weight</h3>
            <div className="grid md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-neutral-500">Date</label>
                <input type="date" value={wDate} onChange={e=>setWDate(e.target.value)} className={`mt-1 w-full ${UX.input}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Kg</label>
                <input type="number" step="0.01" value={wKg} onChange={e=>setWKg(e.target.value)} className={`mt-1 w-full ${UX.input}`} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Note</label>
                <input value={wNote} onChange={e=>setWNote(e.target.value)} className={`mt-1 w-full ${UX.input}`} />
              </div>
              <div className="md:col-span-5">
                <button onClick={addWeight} className={UX.btnPri}>Add</button>
              </div>
            </div>
          </div>

          <div className={UX.card}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Weight Trend</h3>
              <div className="text-xs text-neutral-500">Next check: {fmtDate(nextWeightDate)} ({nextWeightLabel})</div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData} margin={{top:10,right:20,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{fontSize:12}} />
                  <YAxis domain={[0, 'auto']} tick={{fontSize:12}} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="projected" name="Projected" stroke="#111827" dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#0ea5e9" activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={UX.card}>
            <h3 className="font-semibold mb-2">Projection vs Actual (Toy 3kg plan)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500 border-b">
                    <th className="py-2 pr-2">Weeks</th>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Projected (kg)</th>
                    <th className="py-2 pr-2">Actual (kg)</th>
                    <th className="py-2 pr-2">Δ</th>
                    <th className="py-2 pr-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {projTableRows.map((r,idx)=> (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 pr-2 tabular-nums">{r.weeks ?? '—'}</td>
                      <td className="py-2 pr-2 tabular-nums">{r.date}</td>
                      <td className="py-2 pr-2 tabular-nums">{Number(r.kg).toFixed(2)}</td>
                      <td className="py-2 pr-2 tabular-nums">{r.actual!=null?Number(r.actual).toFixed(2):'—'}</td>
                      <td className={`py-2 pr-2 tabular-nums ${r.delta!=null?(Math.abs(r.delta)/Number(r.kg) >= 0.2 ? 'text-red-700' : (Math.abs(r.delta)/Number(r.kg) >= 0.1 ? 'text-orange-700' : '') ):''}`}>{r.delta!=null? (r.delta>0?'+':'')+Number(r.delta).toFixed(2) : '—'}</td>
                      <td className="py-2 pr-2">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={UX.card}>
            <h3 className="font-semibold mb-2">All Weights</h3>
            <WeightsTable weights={weights} onDelete={onDeleteWeight} onEditSave={onEditWeightSave} />
          </div>
        </section>)}

        {tab==='data' && (<section className="grid gap-6">
          <div className={UX.card}>
            <h3 className="font-semibold mb-2">Export</h3>
            <div className="flex gap-2">
              <button className={UX.btn} onClick={()=>dl('entries.json', new Blob([JSON.stringify(entries,null,2)], {type:'application/json'}))}>Entries</button>
              <button className={UX.btn} onClick={()=>dl('weights.json', new Blob([JSON.stringify(weights,null,2)], {type:'application/json'}))}>Weights</button>
              <button className={UX.btn} onClick={()=>dl('foods.json', new Blob([JSON.stringify(foods,null,2)], {type:'application/json'}))}>Foods</button>
            </div>
          </div>

          <div className={UX.card}>
            <h3 className="font-semibold mb-3">Hourly breakdown</h3>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={hourly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" tick={{fontSize:12}} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="wee" name="Wee 💧" fill="#2563eb"><LabelList content={emojiLabel("💧")} /></Bar><Bar dataKey="poo" name="Poo 💩" fill="#d97706"><LabelList content={emojiLabel("💩")} /></Bar></BarChart></ResponsiveContainer></div>
          </div>

          <div className={UX.card}>
            <h3 className="font-semibold mb-3">Raw entries</h3>
            <EntriesTable entries={[...entries].sort((a,b)=>new Date(b.time)-new Date(a.time))} onDelete={onDelete} onEditSave={onEditSave} />
          </div>
        </section>)}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed top-3 right-3 z-50">
          <div className="min-w-[260px] max-w-sm bg-white border border-neutral-200 rounded-2xl shadow-lg p-3">
            <div className="text-sm font-medium">{toast.title}</div>
            <div className="text-xs text-neutral-600 mt-0.5">{toast.body}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function EntriesTable({entries,onDelete,onEditSave}){
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500 border-b">
            <th className="py-2 pr-2">Type</th>
            <th className="py-2 pr-2">When</th>
            <th className="py-2 pr-2">Note</th>
            <th className="py-2 pr-2">Lq</th>
            <th className="py-2 pr-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e=> (<RowEntry key={e.id} e={e} onDelete={onDelete} onEditSave={onEditSave} />))}
        </tbody>
      </table>
    </div>
  )
}
function RowEntry({e,onDelete,onEditSave}){
  const [editing,setEditing]=useState(false);
  const [type,setType]=useState(e.type);
  const [when,setWhen]=useState(()=>toLocalInputValue(new Date(e.time)));
  const [note,setNote]=useState(e.note||'');
  const [pooLq,setPooLq]=useState(e.pooLq??0);
  return (
    <tr className="border-b last:border-0">
      {!editing ? (
        <>
          <td className="py-2 pr-2">{e.type==='wee'?'💧 Wee':'💩 Poo'}</td>
          <td className="py-2 pr-2 tabular-nums">{fmtDate(e.time)} {fmtTime(e.time)}</td>
          <td className="py-2 pr-2">{e.note||'—'}</td>
          <td className="py-2 pr-2">{e.type==='poo'?LQ_LABEL[e.pooLq??0]:'—'}</td>
          <td className="py-2 pr-2"><div className="flex gap-2"><button className={UX.btn} onClick={()=>setEditing(true)}>Edit</button><button className={UX.danger} onClick={()=>onDelete(e.id)}>Delete</button></div></td>
        </>
      ) : (
        <>
          <td className="py-2 pr-2"><select value={type} onChange={ev=>setType(ev.target.value)} className={UX.input}><option value="wee">Wee 💧</option><option value="poo">Poo 💩</option></select></td>
          <td className="py-2 pr-2"><input type="datetime-local" value={when} onChange={ev=>setWhen(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2"><input value={note} onChange={ev=>setNote(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2">{type==='poo'? (<select value={pooLq} onChange={ev=>setPooLq(Number(ev.target.value))} className={UX.input}>{[0,1,2,3].map(v=> <option key={v} value={v}>{LQ_LABEL[v]}</option>)}</select>) : '—'}</td>
          <td className="py-2 pr-2"><div className="flex gap-2"><button className={UX.btnPri} onClick={()=>{onEditSave(e.id,type,when,note,pooLq); setEditing(false)}}>Save</button><button className={UX.btn} onClick={()=>setEditing(false)}>Cancel</button></div></td>
        </>
      )}
    </tr>
  )
}

function FoodsTable({foods,onDelete,onEditSave}){
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500 border-b">
            <th className="py-2 pr-2">Date</th>
            <th className="py-2 pr-2">Brand</th>
            <th className="py-2 pr-2">Grams</th>
            <th className="py-2 pr-2">Note</th>
            <th className="py-2 pr-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {foods.map(f=> (<RowFood key={f.id} f={f} onDelete={onDelete} onEditSave={onEditSave} />))}
        </tbody>
      </table>
    </div>
  )
}
function RowFood({f,onDelete,onEditSave}){
  const [editing,setEditing]=useState(false);
  const [date,setDate]=useState(f.date);
  const [brand,setBrand]=useState(f.brand);
  const [grams,setGrams]=useState(f.grams);
  const [note,setNote]=useState(f.note||'');
  return (
    <tr className="border-b last:border-0">
      {!editing ? (
        <>
          <td className="py-2 pr-2 tabular-nums">{f.date}</td>
          <td className="py-2 pr-2">{brandLabel(f.brand)}</td>
          <td className="py-2 pr-2 tabular-nums">{f.grams} g</td>
          <td className="py-2 pr-2">{f.note||'—'}</td>
          <td className="py-2 pr-2"><div className="flex gap-2"><button className={UX.btn} onClick={()=>setEditing(true)}>Edit</button><button className={UX.danger} onClick={()=>onDelete(f.id)}>Delete</button></div></td>
        </>
      ) : (
        <>
          <td className="py-2 pr-2"><input type="date" value={date} onChange={ev=>setDate(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2"><select value={brand} onChange={ev=>setBrand(ev.target.value)} className={UX.input}>{BRANDS.map(b=> <option key={b.id} value={b.id}>{b.label}</option>)}</select></td>
          <td className="py-2 pr-2"><input type="number" value={grams} onChange={ev=>setGrams(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2"><input value={note} onChange={ev=>setNote(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2"><div className="flex gap-2"><button className={UX.btnPri} onClick={()=>{onEditSave(f.id,date,grams,note); setEditing(false)}}>Save</button><button className={UX.btn} onClick={()=>setEditing(false)}>Cancel</button></div></td>
        </>
      )}
    </tr>
  )
}

function WeightsTable({weights,onDelete,onEditSave}){
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500 border-b">
            <th className="py-2 pr-2">Date</th>
            <th className="py-2 pr-2">Kg</th>
            <th className="py-2 pr-2">Note</th>
            <th className="py-2 pr-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {weights.map(w=> (<RowWeight key={w.id} w={w} onDelete={onDelete} onEditSave={onEditSave} />))}
        </tbody>
      </table>
    </div>
  )
}
function RowWeight({w,onDelete,onEditSave}){
  const [editing,setEditing]=useState(false);
  const [date,setDate]=useState(w.date);
  const [kg,setKg]=useState(w.kg);
  const [note,setNote]=useState(w.note||'');
  return (
    <tr className="border-b last:border-0">
      {!editing ? (
        <>
          <td className="py-2 pr-2 tabular-nums">{w.date}</td>
          <td className="py-2 pr-2 tabular-nums">{Number(w.kg).toFixed(2)} kg</td>
          <td className="py-2 pr-2">{w.note||'—'}</td>
          <td className="py-2 pr-2"><div className="flex gap-2"><button className={UX.btn} onClick={()=>setEditing(true)}>Edit</button><button className={UX.danger} onClick={()=>onDelete(w.id)}>Delete</button></div></td>
        </>
      ) : (
        <>
          <td className="py-2 pr-2"><input type="date" value={date} onChange={ev=>setDate(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2"><input type="number" step="0.01" value={kg} onChange={ev=>setKg(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2"><input value={note} onChange={ev=>setNote(ev.target.value)} className={UX.input} /></td>
          <td className="py-2 pr-2"><div className="flex gap-2"><button className={UX.btnPri} onClick={()=>{onEditSave(w.id,date,kg,note); setEditing(false)}}>Save</button><button className={UX.btn} onClick={()=>setEditing(false)}>Cancel</button></div></td>
        </>
      )}
    </tr>
  )
}

// === Quick Log mini-view ===
function QuickLogView({onAdd,recent,onBack}){
  const [pooLq,setPooLq]=useState(0);
  const [when,setWhen]=useState(()=>toLocalInputValue(new Date()));
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Quick Log</h2>
          <button onClick={onBack} className={UX.btn}>Back</button>
        </div>
        <div className={UX.card}>
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-500">When</label>
              <input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} className={`mt-1 w-full ${UX.input}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500">Poo Lq</span>
              <div className="inline-flex rounded-xl border border-neutral-300 overflow-hidden">
                {[0,1,2,3].map(v=> (<button key={v} type="button" onClick={()=>setPooLq(v)} className={pooLq===v?UX.btnChipSel:UX.btnChip}>{LQ_ICON[v]}</button>))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 rounded-xl bg-blue-600 text-white" onClick={()=>onAdd('wee')}>Add Wee 💧</button>
              <button className="px-3 py-2 rounded-xl bg-amber-600 text-white" onClick={()=>onAdd('poo',{pooLq:Number(pooLq)})}>Add Poo 💩</button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2">Recent</h3>
          <ul className="text-sm">
            {recent.map(e=> (<li key={e.id} className="py-1 flex justify-between"><span>{e.type==='wee'?'💧':'💩'} {fmtTime(e.time)}</span><span className="text-neutral-500">{fmtDate(e.time)}</span></li>))}
          </ul>
        </div>
      </div>
    </div>
  )
}
