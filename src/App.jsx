import { useState, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxui6RPQG77rbF8nUfo_hZQMqzZTAtEj4tQTZNgpiUYcnxei3g1OXWE1KOg2VTaRwdF/exec";
const CURRENT_YEAR = 2026;
const YEARS = 20;

const fmt  = n => "$" + Math.round(n).toLocaleString();
const fmtK = n => (n >= 0 ? "" : "−") + "$" + Math.round(Math.abs(n)/1000) + "k";
const fmtM = n => "$" + (Math.abs(n)/1e6).toFixed(2) + "m";

function calcTax(income) {
  let t;
  if (income <= 18200)       t = 0;
  else if (income <= 45000)  t = (income-18200)*0.19;
  else if (income <= 120000) t = 5092  + (income-45000) *0.325;
  else if (income <= 180000) t = 29467 + (income-120000)*0.37;
  else                       t = 51667 + (income-180000)*0.45;
  return t + income*0.02;
}
function grossFromNet(annualNet) {
  if (annualNet<=0) return 0;
  let lo=annualNet, hi=annualNet*3;
  for (let i=0;i<60;i++) { const m=(lo+hi)/2; m-calcTax(m)<annualNet?lo=m:hi=m; }
  return Math.round((lo+hi)/2);
}
function nswStampDuty(p) {
  if (p<=14000)   return p*0.0125;
  if (p<=30000)   return 175  +(p-14000) *0.015;
  if (p<=80000)   return 415  +(p-30000) *0.0175;
  if (p<=300000)  return 1290 +(p-80000) *0.035;
  if (p<=1000000) return 8990 +(p-300000)*0.045;
  if (p<=3000000) return 40490+(p-1000000)*0.055;
  return 150490+(p-3000000)*0.07;
}
function nswLandTax(lv) { return lv<=1075000?0:100+(lv-1075000)*0.016; }
function monthlyRepayment(p,r,m=300) {
  if (p<=0) return 0;
  const rr=r/100/12;
  return rr===0?p/m:p*rr/(1-Math.pow(1+rr,-m));
}
function remainingBalance(p,r,mo,m=300) {
  if (p<=0||mo<=0) return Math.max(0,p);
  const rr=r/100/12, pmt=monthlyRepayment(p,r,m);
  return rr===0?Math.max(0,p-pmt*mo):Math.max(0,p*Math.pow(1+rr,mo)-pmt*(Math.pow(1+rr,mo)-1)/rr);
}
function remainingBalanceWithOffset(p,r,offset,m,mo) {
  if (p<=0||mo<=0) return Math.max(0,p);
  const rr=r/100/12, pmt=monthlyRepayment(p,r,m);
  let bal=p;
  for (let i=0;i<mo&&bal>0;i++) bal=Math.max(0,bal-(pmt-Math.max(0,bal-offset)*rr));
  return bal;
}

const SCEN = {
  A:{color:"#2563eb",label:"A: Keep flat + Invest"},
  B:{color:"#059669",label:"B: Sell + Buy house"},
  C:{color:"#7c3aed",label:"C: Reno + Sell"},
  D:{color:"#d97706",label:"D: Keep flat + Offset"},
};

const DEFAULT_EVENTS = [
  {id:1,year:2027,             label:"Childcare ends → school",         monthlyDelta:-2000},
  {id:2,year:2030,endYear:2038,label:"Child 1: private school fees",    monthlyDelta:Math.round(35000/12)},
  {id:3,year:2032,endYear:2040,label:"Child 2: private school fees",    monthlyDelta:Math.round(35000/12)},
  {id:4,year:2027,endYear:2028,label:"New car (amortised over 1yr)",    monthlyDelta:Math.round(30000/12)},
];

const C={
  bg:"#f5f7fa",surface:"#ffffff",border:"#e2e8f0",border2:"#cbd5e1",
  text:"#1e293b",sub:"#64748b",muted:"#94a3b8",
  blue:"#2563eb",blueL:"#eff6ff",green:"#059669",greenL:"#ecfdf5",
  amber:"#d97706",amberL:"#fffbeb",red:"#dc2626",redL:"#fef2f2",
  purple:"#7c3aed",purpleL:"#f5f3ff",
};
const INP={background:"#fff",border:`1px solid ${C.border2}`,borderRadius:6,color:C.text,padding:"7px 10px",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
const LBL={color:C.sub,fontSize:11,fontWeight:600,display:"block",marginBottom:4};

function Field({label,value,onChange,noPrefix,suffix}) {
  const [draft,setDraft]=useState(null);
  return (
    <div>
      <span style={LBL}>{label}</span>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        {!noPrefix&&<span style={{color:C.muted,fontSize:13,flexShrink:0}}>$</span>}
        <input type="text" inputMode="numeric"
          value={draft!==null?draft:String(value)}
          onFocus={e=>{setDraft(String(value));e.target.select();}}
          onChange={e=>setDraft(e.target.value)}
          onBlur={()=>{const n=parseFloat((draft||"").replace(/[^0-9.-]/g,""));if(!isNaN(n))onChange(n);setDraft(null);}}
          style={INP}/>
        {suffix&&<span style={{color:C.muted,fontSize:12,flexShrink:0}}>{suffix}</span>}
      </div>
    </div>
  );
}
function Card({children,accent,style={}}) {
  return <div style={{background:C.surface,borderRadius:12,border:`1px solid ${accent?accent+"33":C.border}`,borderTop:accent?`3px solid ${accent}`:`1px solid ${C.border}`,padding:20,...style}}>{children}</div>;
}
function Tag({label,value,color}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:color+"15",borderRadius:6,padding:"5px 10px",fontSize:12}}><span style={{color:C.sub}}>{label}</span><span style={{color,fontWeight:700}}>{value}</span></div>;
}
function ST({children}) { return <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{children}</div>; }
function SS({children}) { return <div style={{fontSize:11,color:C.sub,marginBottom:14}}>{children}</div>; }

export default function PropertyModel() {
  const [loadStatus,  setLoadStatus]  = useState("none");
  const [loadMsg,     setLoadMsg]     = useState("");
  const [showRefresh, setShowRefresh] = useState(false);
  const [refreshInput,setRefreshInput]= useState("");

  const [flatValue,     setFlatValue]     = useState(0);
  const [mortgageOwing, setMortgageOwing] = useState(0);
  const [currentRate,   setCurrentRate]   = useState(6.0);
  const [cashSavings,   setCashSavings]   = useState(0);
  const [emergencyFund, setEmergencyFund] = useState(0);
  const [flatStrataMonthly,setFlatStrataMonthly]=useState(0);
  const [p1Monthly,  setP1Monthly]  = useState(0);
  const [p2Monthly,  setP2Monthly]  = useState(0);
  const [p1Bonus,    setP1Bonus]    = useState(0);
  const [p2Bonus,    setP2Bonus]    = useState(0);
  const [baseMonthlyLiving,    setBaseMonthlyLiving]    = useState(0);
  const [baseMonthlyChildcare, setBaseMonthlyChildcare] = useState(0);
  const [inflationRate,     setInflationRate]     = useState(3);
  const [incomeGrowth,      setIncomeGrowth]      = useState(3.5);
  const [propertyGrowth,    setPropertyGrowth]    = useState(5.5);
  const [rentGrowth,        setRentGrowth]        = useState(4);
  const [contingencyMonthly,setContingencyMonthly]= useState(0);
  const [invPrice,   setInvPrice]   = useState(1000000);
  const [invRate,    setInvRate]    = useState(6.0);
  const [weeklyRent, setWeeklyRent] = useState(700);
  const [mtr,        setMtr]        = useState(45);
  const [invDepr,    setInvDepr]    = useState(12000);
  const [invIns,     setInvIns]     = useState(1800);
  const [invRates,   setInvRates]   = useState(2200);
  const [invStrata,  setInvStrata]  = useState(0);
  const [invLandVal, setInvLandVal] = useState(400000);
  const [invIsIO,    setInvIsIO]    = useState(false);
  const [housePrice, setHousePrice] = useState(2000000);
  const [houseRate,  setHouseRate]  = useState(6.0);
  const [dSaleYear,    setDSaleYear]    = useState(2027);
  const [renoCost,     setRenoCost]     = useState(50000);
  const [renoValueAdd, setRenoValueAdd] = useState(80000);
  const [events,setEvents] = useState(DEFAULT_EVENTS);
  const nextId = useRef(DEFAULT_EVENTS.length+1);
  const addEvent = isIncome => { const id=++nextId.current; setEvents(ev=>[...ev,{id,year:CURRENT_YEAR,endYear:CURRENT_YEAR+1,label:isIncome?"New income event":"New expense event",monthlyDelta:0,isIncome}]); };
  const removeEvent = id => setEvents(ev=>ev.filter(x=>x.id!==id));
  const updateEvent = (id,patch) => setEvents(ev=>ev.map(x=>x.id===id?{...x,...patch}:x));

  const [stressRateAdd, setStressRateAdd] = useState(2);
  const [incomeShock,   setIncomeShock]   = useState("none");

  const deployCash       = Math.max(0,cashSavings-emergencyFund);
  const monthlyNetIncome = p1Monthly+p2Monthly;
  const sellCosts        = flatValue*0.0165+8700;
  const dataLoaded       = loadStatus==="done";

  const applyRefresh = () => {
    try {
      const d = JSON.parse(refreshInput);
      const loaded = [];
      if (d.andrewMonthly        > 0) { setP1Monthly(d.andrewMonthly);             loaded.push(`P1: ${fmt(d.andrewMonthly)}/mo`); }
      if (d.staceyMonthly        > 0) { setP2Monthly(d.staceyMonthly);             loaded.push(`P2: ${fmt(d.staceyMonthly)}/mo`); }
      if (d.baseMonthlyLiving    > 0) { setBaseMonthlyLiving(d.baseMonthlyLiving); loaded.push(`Living: ${fmt(d.baseMonthlyLiving)}/mo`); }
      if (d.baseMonthlyChildcare > 0) { setBaseMonthlyChildcare(d.baseMonthlyChildcare); loaded.push(`Childcare: ${fmt(d.baseMonthlyChildcare)}/mo`); }
      const sc = d.scenarioConfig;
      if (sc) {
        if (sc.flatValue           != null) setFlatValue(sc.flatValue);
        if (sc.mortgageOwing       != null) setMortgageOwing(sc.mortgageOwing);
        if (sc.currentRate         != null) setCurrentRate(sc.currentRate);
        if (sc.cashSavings         != null) setCashSavings(sc.cashSavings);
        if (sc.emergencyFund       != null) setEmergencyFund(sc.emergencyFund);
        if (sc.flatStrataMonthly   != null) setFlatStrataMonthly(sc.flatStrataMonthly);
        if (sc.andrewBonus         != null) setP1Bonus(sc.andrewBonus);
        if (sc.staceyBonus         != null) setP2Bonus(sc.staceyBonus);
        if (sc.inflationRate       != null) setInflationRate(sc.inflationRate);
        if (sc.incomeGrowth        != null) setIncomeGrowth(sc.incomeGrowth);
        if (sc.propertyGrowth      != null) setPropertyGrowth(sc.propertyGrowth);
        if (sc.rentGrowth          != null) setRentGrowth(sc.rentGrowth);
        if (sc.contingencyMonthly  != null) setContingencyMonthly(sc.contingencyMonthly);
        if (sc.invPrice            != null) setInvPrice(sc.invPrice);
        if (sc.invRate             != null) setInvRate(sc.invRate);
        if (sc.weeklyRent          != null) setWeeklyRent(sc.weeklyRent);
        if (sc.mtr                 != null) setMtr(sc.mtr);
        if (sc.invDepr             != null) setInvDepr(sc.invDepr);
        if (sc.invIns              != null) setInvIns(sc.invIns);
        if (sc.invRates            != null) setInvRates(sc.invRates);
        if (sc.invStrata           != null) setInvStrata(sc.invStrata);
        if (sc.invLandVal          != null) setInvLandVal(sc.invLandVal);
        if (sc.invIsIO             != null) setInvIsIO(sc.invIsIO);
        if (sc.housePrice          != null) setHousePrice(sc.housePrice);
        if (sc.houseRate           != null) setHouseRate(sc.houseRate);
        if (sc.dSaleYear           != null) setDSaleYear(sc.dSaleYear);
        if (sc.renoCost            != null) setRenoCost(sc.renoCost);
        if (sc.renoValueAdd        != null) setRenoValueAdd(sc.renoValueAdd);
        if (sc.events              != null) setEvents(sc.events);
        loaded.push("scenario config");
      }
      if (loaded.length===0) throw new Error("No valid fields found");
      const updated = d.lastUpdated ? new Date(d.lastUpdated).toLocaleDateString("en-AU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "now";
      setLoadStatus("done");
      setLoadMsg(`${loaded.join(" · ")} · ${updated}`);
      setShowRefresh(false);
      setRefreshInput("");
    } catch(e) { alert("Error: "+e.message); }
  };

  // ── Stress test ───────────────────────────────────────────────────────────
  const stressData = useMemo(() => {
    const sCurrentRate = currentRate + stressRateAdd;
    const sHouseRate   = houseRate   + stressRateAdd;
    const sInvRate     = invRate     + stressRateAdd;
    const p1Net = incomeShock==="p1" ? 0 : p1Monthly;
    const p2Net = incomeShock==="p2" ? 0 : p2Monthly;
    const stressedNet = p1Net + p2Net;
    const aGross = grossFromNet((p1Monthly+p1Bonus/12)*12);
    const sGross = grossFromNet((p2Monthly+p2Bonus/12)*12);
    const totalGross = aGross + sGross;
    const flatMthlyNormal  = monthlyRepayment(mortgageOwing, currentRate);
    const baseNonMort      = Math.max(0, baseMonthlyLiving - flatMthlyNormal) + baseMonthlyChildcare;
    const baseNonMortHouse = Math.max(0, baseNonMort - flatStrataMonthly);
    // Stressed mortgage repayments
    const flatMthlyS       = monthlyRepayment(mortgageOwing, sCurrentRate);
    const flatMthlySOffset = monthlyRepayment(Math.max(0, mortgageOwing - cashSavings), sCurrentRate);
    // Totals — mortgage included once inside each
    const totalA = baseNonMort      + contingencyMonthly + flatMthlyS;
    const totalB = baseNonMortHouse + contingencyMonthly; // house mortgage added separately
    const totalC = baseNonMort      + contingencyMonthly + flatMthlyS;
    const totalD = baseNonMort      + contingencyMonthly + flatMthlySOffset;
    // A: flat mortgage in totalA, investment mortgage separate
    const stampA    = nswStampDuty(invPrice);
    const invDep    = Math.max(0, deployCash - stampA);
    const invMort   = Math.max(0, invPrice - invDep);
    const invMthlyS = invIsIO ? invMort*(sInvRate/100)/12 : monthlyRepayment(invMort, sInvRate);
    const netRentA  = weeklyRent*52/12*0.9;
    const A_cf = stressedNet - totalA - invMthlyS + netRentA;
    const A_mr = totalGross>0 ? (flatMthlyS+invMthlyS)/(totalGross/12) : 0;
    // B: house mortgage separate (no strata)
    const houseDep    = Math.max(0,(flatValue-mortgageOwing)+deployCash-nswStampDuty(housePrice)-sellCosts);
    const houseMort   = Math.max(0, housePrice - houseDep);
    const houseMthlyS = monthlyRepayment(houseMort, sHouseRate);
    const B_cf = stressedNet - totalB - houseMthlyS;
    const B_mr = totalGross>0 ? houseMthlyS/(totalGross/12) : 0;
    // C: mortgage already in totalC
    const C_cf = stressedNet - totalC;
    const C_mr = totalGross>0 ? flatMthlyS/(totalGross/12) : 0;
    // D: offset mortgage already in totalD
    const D_cf = stressedNet - totalD;
    const D_mr = totalGross>0 ? flatMthlySOffset/(totalGross/12) : 0;

    const runway = (cf,sav) => cf>=0 ? Infinity : Math.floor(sav/Math.abs(cf));
    const score  = (cf,mr,mo) => {
      let s=100;
      if (cf<0) s-=40; else if (cf<500) s-=15; else if (cf<1500) s-=5;
      if (mr>0.40) s-=30; else if (mr>0.35) s-=20; else if (mr>0.30) s-=10;
      if (mo<3) s-=30; else if (mo<6) s-=15; else if (mo<12) s-=5;
      return Math.max(0,s);
    };
    const rag      = s => s>=70?"green":s>=45?"amber":"red";
    const ragLabel = s => s>=70?"Comfortable":s>=45?"Manageable":"At Risk";
    const mk = (cf,mr,sav) => { const mo=runway(cf,sav); const sc=score(cf,mr,mo); return {cf,mortRatio:mr,months:mo,score:sc,rag:rag(sc),label:ragLabel(sc)}; };
    return {
      stressedNet,
      scenarios:{
        A:mk(A_cf,A_mr,emergencyFund),
        B:mk(B_cf,B_mr,emergencyFund),
        C:mk(C_cf,C_mr,emergencyFund),
        D:mk(D_cf,D_mr,cashSavings),
      }
    };
  },[currentRate,houseRate,invRate,stressRateAdd,incomeShock,p1Monthly,p2Monthly,p1Bonus,p2Bonus,
     mortgageOwing,flatValue,cashSavings,emergencyFund,deployCash,baseMonthlyLiving,
     baseMonthlyChildcare,contingencyMonthly,flatStrataMonthly,invPrice,invIsIO,
     weeklyRent,housePrice,sellCosts]);

  // ── Projection engine ─────────────────────────────────────────────────────
  const projData = useMemo(() => {
    const inf=inflationRate/100,incG=incomeGrowth/100,propG=propertyGrowth/100,rentG=rentGrowth/100;
    const flatMthly  = monthlyRepayment(mortgageOwing,currentRate);
    const baseNonMort      = Math.max(0,baseMonthlyLiving-flatMthly)+baseMonthlyChildcare;
    const baseNonMortHouse = Math.max(0,baseNonMort-flatStrataMonthly);
    const stampA  = nswStampDuty(invPrice);
    const invDep  = Math.max(0,deployCash-stampA);
    const invMort = Math.max(0,invPrice-invDep);
    const invMthly= invIsIO?invMort*(invRate/100)/12:monthlyRepayment(invMort,invRate);
    const landTaxA= nswLandTax(invLandVal);
    const houseDep  = Math.max(0,(flatValue-mortgageOwing)+deployCash-nswStampDuty(housePrice)-sellCosts);
    const houseMort = Math.max(0,housePrice-houseDep);
    const houseMthly= monthlyRepayment(houseMort,houseRate);
    const dIdx    = Math.max(1,dSaleYear-CURRENT_YEAR);
    const dReno   = flatValue+renoValueAdd;
    const dFlatSl = dReno*Math.pow(1+propG,dIdx);
    const dFlatBl = remainingBalance(mortgageOwing,currentRate,dIdx*12);
    const dHPAt   = housePrice*Math.pow(1+propG,dIdx);
    const dSellC  = dFlatSl*0.0165+8700;
    const dStampC = nswStampDuty(dHPAt);
    const dCash   = deployCash-renoCost;
    const dHDep   = Math.max(0,(dFlatSl-dFlatBl)+dCash-dStampC-dSellC);
    const dHMort  = Math.max(0,dHPAt-dHDep);
    const dHMthly = monthlyRepayment(dHMort,houseRate);
    const p1Gross = grossFromNet((p1Monthly+p1Bonus/12)*12);
    const p2Gross = grossFromNet((p2Monthly+p2Bonus/12)*12);
    return Array.from({length:YEARS+1},(_,i)=>{
      const year=CURRENT_YEAR+i;
      const active=ev=>year>=ev.year&&(ev.endYear==null||year<ev.endYear);
      const expDelta=events.reduce((s,ev)=>!ev.isIncome&&active(ev)?s+ev.monthlyDelta:s,0);
      const incDelta=events.reduce((s,ev)=> ev.isIncome&&active(ev)?s+ev.monthlyDelta:s,0);
      const gf=Math.pow(1+incG,i);
      const aG=p1Gross*gf, sG=p2Gross*gf;
      const netMthly=((aG-calcTax(aG))+(sG-calcTax(sG)))/12+incDelta;
      const expFlat  =Math.max(0,baseNonMort     +expDelta+contingencyMonthly)*Math.pow(1+inf,i);
      const expHouse =Math.max(0,baseNonMortHouse+expDelta+contingencyMonthly)*Math.pow(1+inf,i);
      const flatV  =flatValue*Math.pow(1+propG,i);
      const flatBal=remainingBalance(mortgageOwing,currentRate,i*12);
      const invV   =invPrice*Math.pow(1+propG,i);
      const invBal =invIsIO?invMort:remainingBalance(invMort,invRate,i*12);
      const grossRent=weeklyRent*52/12*Math.pow(1+rentG,i);
      const mgmt=grossRent*0.10, invInt=invBal*(invRate/100)/12, invMaint=invV*0.01/12;
      const mtrD=mtr/100;
      const taxable=grossRent-invInt-invMaint-mgmt-invDepr/12-invIns/12-invRates/12-invStrata/12-landTaxA/12;
      const rentalTax=taxable<0?Math.abs(taxable)*mtrD:-taxable*mtrD;
      const invCash=invMaint+(landTaxA+invIns+invRates+invStrata)/12;
      const A_cf=netMthly-expFlat-flatMthly+(grossRent-mgmt)-invCash+rentalTax-invMthly;
      const A_nw=(flatV-flatBal)+(invV-invBal);
      const A_cgt=Math.max(0,(invV-invPrice)*0.5*mtrD);
      const houseV=housePrice*Math.pow(1+propG,i);
      const houseBl=remainingBalance(houseMort,houseRate,i*12);
      const B_cf=netMthly-expHouse-houseMthly;
      const B_nw=houseV-houseBl;
      let C_cf,C_nw;
      if (i<dIdx) {
        const cFV=dReno*Math.pow(1+propG,i),cFB=remainingBalance(mortgageOwing,currentRate,i*12);
        C_cf=netMthly-expFlat-flatMthly; C_nw=(cFV-cFB)+(deployCash-renoCost);
      } else {
        const yrs=i-dIdx,cHV=dHPAt*Math.pow(1+propG,yrs),cHB=remainingBalance(dHMort,houseRate,yrs*12);
        C_cf=netMthly-expHouse-dHMthly; C_nw=cHV-cHB;
      }
      const offBal=remainingBalanceWithOffset(mortgageOwing,currentRate,cashSavings,300,i*12);
      const D_cf=netMthly-expFlat-flatMthly;
      const D_nw=flatV-offBal+cashSavings;
      return {
        year,income:Math.round(netMthly),expenses:Math.round(expFlat+flatMthly),
        A:{cashFlow:Math.round(A_cf),netWorth:Math.round(A_nw),netWorthAfterCGT:Math.round(A_nw-A_cgt)},
        B:{cashFlow:Math.round(B_cf),netWorth:Math.round(B_nw)},
        C:{cashFlow:Math.round(C_cf),netWorth:Math.round(C_nw)},
        D:{cashFlow:Math.round(D_cf),netWorth:Math.round(D_nw)},
      };
    });
  },[mortgageOwing,currentRate,flatValue,cashSavings,emergencyFund,deployCash,
     p1Monthly,p2Monthly,p1Bonus,p2Bonus,contingencyMonthly,flatStrataMonthly,
     baseMonthlyLiving,baseMonthlyChildcare,inflationRate,incomeGrowth,propertyGrowth,rentGrowth,
     invPrice,invRate,weeklyRent,mtr,invDepr,invIns,invRates,invStrata,invLandVal,invIsIO,
     housePrice,houseRate,dSaleYear,renoCost,renoValueAdd,events,sellCosts]);

  const cfChart=projData.map(d=>({year:d.year,[SCEN.A.label]:d.A.cashFlow,[SCEN.B.label]:d.B.cashFlow,[SCEN.C.label]:d.C.cashFlow,[SCEN.D.label]:d.D.cashFlow}));
  const nwChart=projData.map(d=>({year:d.year,[SCEN.A.label]:d.A.netWorth,[SCEN.B.label]:d.B.netWorth,[SCEN.C.label]:d.C.netWorth,[SCEN.D.label]:d.D.netWorth}));
  const evtYears=[...new Set(events.map(e=>e.year))];

  const flatEq    = flatValue-mortgageOwing;
  const stampAd   = nswStampDuty(invPrice);
  const invDepD   = Math.max(0,deployCash-stampAd);
  const invMortD  = Math.max(0,invPrice-invDepD);
  const stampBd   = nswStampDuty(housePrice);
  const houseDepD = Math.max(0,flatEq+deployCash-stampBd-sellCosts);
  const houseMortD= Math.max(0,housePrice-houseDepD);
  const dIdxD     = Math.max(1,dSaleYear-CURRENT_YEAR);
  const pG        = propertyGrowth/100;
  const dRenoD    = flatValue+renoValueAdd;
  const dFlatSD   = dRenoD*Math.pow(1+pG,dIdxD);
  const dFlatBD   = remainingBalance(mortgageOwing,currentRate,dIdxD*12);
  const dHPD      = housePrice*Math.pow(1+pG,dIdxD);
  const dSellCD   = dFlatSD*0.0165+8700;
  const dStampD   = nswStampDuty(dHPD);
  const dCashD    = deployCash-renoCost;
  const dDepD     = Math.max(0,(dFlatSD-dFlatBD)+dCashD-dStampD-dSellCD);
  const dMortD    = Math.max(0,dHPD-dDepD);

  const ChartCard=({title,sub,data,yFmt})=>(
    <Card style={{padding:20}}>
      <ST>{title}</ST><SS>{sub}</SS>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
          <XAxis dataKey="year" stroke={C.muted} tick={{fontSize:11}}/>
          <YAxis tickFormatter={yFmt} stroke={C.muted} tick={{fontSize:11}} width={60}/>
          <Tooltip formatter={v=>fmt(v)} labelFormatter={l=>`Year: ${l}`} contentStyle={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}}/>
          <Legend wrapperStyle={{fontSize:11}}/>
          {evtYears.map(y=><ReferenceLine key={y} x={y} stroke={C.muted} strokeDasharray="4 2" label={{value:y,position:"top",fontSize:9,fill:C.muted}}/>)}
          <ReferenceLine y={0} stroke={C.red} strokeDasharray="2 2"/>
          {Object.entries(SCEN).map(([k,s])=><Line key={k} type="monotone" dataKey={s.label} stroke={s.color} dot={false} strokeWidth={2.5}/>)}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );

  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:C.bg,minHeight:"100vh",color:C.text,padding:"24px 20px",fontSize:13}}>
      <div style={{maxWidth:1380,margin:"0 auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
          <div>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-0.02em"}}>Property Scenario Planner</h1>
            <p style={{margin:"4px 0 0",fontSize:12,color:C.sub}}>20-year projection · NSW · ~5.5% p.a. long-run property growth</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:500,background:dataLoaded?C.greenL:C.amberL,border:`1px solid ${dataLoaded?C.green+"44":C.amber+"44"}`,color:dataLoaded?C.green:C.amber}}>
              <span>{dataLoaded?"✓ "+loadMsg:"⚠ No data loaded — figures are placeholders"}</span>
              <button onClick={()=>setShowRefresh(v=>!v)} style={{background:C.blue,color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showRefresh?"Cancel":"↻ Refresh from sheet"}</button>
            </div>
            {showRefresh&&(
              <div style={{background:"#fff",border:`1px solid ${C.border2}`,borderRadius:10,padding:14,width:440,boxShadow:"0 4px 16px #0001"}}>
                <p style={{margin:"0 0 6px",fontSize:12,fontWeight:600,color:C.text}}>Paste live data from your sheet</p>
                <p style={{margin:"0 0 10px",fontSize:11,color:C.sub}}>1. Open <a href={APPS_SCRIPT_URL} target="_blank" rel="noreferrer" style={{color:C.blue}}>this link</a> (requires your Google login)<br/>2. Copy all the JSON text<br/>3. Paste below and click Apply</p>
                <textarea value={refreshInput} onChange={e=>setRefreshInput(e.target.value)} placeholder='{"andrewMonthly":...}' style={{width:"100%",height:70,borderRadius:6,border:`1px solid ${C.border2}`,padding:"6px 8px",fontSize:11,fontFamily:"monospace",boxSizing:"border-box",resize:"none"}}/>
                <button onClick={applyRefresh} style={{marginTop:8,background:C.green,color:"#fff",border:"none",borderRadius:6,padding:"7px 18px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>Apply</button>
              </div>
            )}
          </div>
        </div>

        {!dataLoaded&&(
          <div style={{background:C.blueL,border:`1px solid ${C.blue}33`,borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:20}}>📊</span>
            <div><div style={{fontSize:13,fontWeight:700,color:C.blue}}>No data loaded</div><div style={{fontSize:11,color:C.sub,marginTop:2}}>Click <b>↻ Refresh from sheet</b> to load your figures, or enter manually below.</div></div>
          </div>
        )}

        {/* Input grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:16}}>

          {/* Current situation */}
          <Card>
            <ST>Current Situation</ST><SS>Your starting position</SS>
            <div style={{display:"grid",gap:10}}>
              <Field label="Flat / Unit Value" value={flatValue} onChange={setFlatValue}/>
              <Field label="Mortgage Owing" value={mortgageOwing} onChange={setMortgageOwing}/>
              <Field label="Interest Rate" value={currentRate} onChange={setCurrentRate} noPrefix suffix="%"/>
              <Field label="Flat Strata (monthly)" value={flatStrataMonthly} onChange={setFlatStrataMonthly}/>
              <div>
                <Field label="Cash Savings (total)" value={cashSavings} onChange={v=>{setCashSavings(v);if(emergencyFund>v)setEmergencyFund(v);}}/>
                <div style={{marginTop:10,background:C.amberL,borderRadius:8,padding:"10px 12px",border:`1px solid ${C.amber}33`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:600,color:C.amber}}>Emergency Fund (locked)</span>
                    <span style={{fontSize:13,fontWeight:700,color:C.amber}}>{fmt(emergencyFund)}</span>
                  </div>
                  <input type="range" min={0} max={cashSavings} step={5000} value={emergencyFund} onChange={e=>setEmergencyFund(Number(e.target.value))} style={{width:"100%",accentColor:C.amber}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:5,color:C.sub}}>
                    <span>Deployable: <b style={{color:C.green}}>{fmt(deployCash)}</b></span>
                    <span>Emergency: <b style={{color:C.amber}}>{fmt(emergencyFund)}</b></span>
                  </div>
                </div>
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:600,color:C.sub}}>Monthly Net Income (take-home)</p>
                <Field label="Partner 1" value={p1Monthly} onChange={setP1Monthly}/>
                <div style={{marginTop:8}}><Field label="Partner 2" value={p2Monthly} onChange={setP2Monthly}/></div>
                <div style={{marginTop:8,display:"flex",justifyContent:"space-between",fontSize:11,color:C.sub,background:C.bg,borderRadius:6,padding:"6px 10px"}}>
                  <span>Combined</span><b style={{color:C.text}}>{fmt(monthlyNetIncome)}/mo</b>
                </div>
              </div>
              <Field label="Partner 1 Bonus (gross annual)" value={p1Bonus} onChange={setP1Bonus}/>
              <Field label="Partner 2 Bonus (gross annual)" value={p2Bonus} onChange={setP2Bonus}/>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:600,color:C.sub}}>Monthly Expenses</p>
                <Field label="Living (incl. mortgage)" value={baseMonthlyLiving} onChange={setBaseMonthlyLiving}/>
                <div style={{marginTop:8}}><Field label="Childcare" value={baseMonthlyChildcare} onChange={setBaseMonthlyChildcare}/></div>
              </div>
            </div>
          </Card>

          {/* Scenario A */}
          <Card accent={C.blue}>
            <ST><span style={{color:C.blue}}>Scenario A</span></ST><SS>Keep flat + buy investment property</SS>
            <div style={{display:"grid",gap:10}}>
              <Field label="Investment Property Price" value={invPrice} onChange={setInvPrice}/>
              <Field label="Investment Rate" value={invRate} onChange={setInvRate} noPrefix suffix="%"/>
              <Field label="Weekly Rent" value={weeklyRent} onChange={setWeeklyRent}/>
              <Field label="Marginal Tax Rate" value={mtr} onChange={setMtr} noPrefix suffix="%"/>
              <Field label="Depreciation Annual" value={invDepr} onChange={setInvDepr}/>
              <Field label="Landlord Insurance Annual" value={invIns} onChange={setInvIns}/>
              <Field label="Council Rates Annual" value={invRates} onChange={setInvRates}/>
              <Field label="Strata Annual (0 if house)" value={invStrata} onChange={setInvStrata}/>
              <Field label="Land Value (for land tax)" value={invLandVal} onChange={setInvLandVal}/>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:C.sub}}>
                <input type="checkbox" checked={invIsIO} onChange={e=>setInvIsIO(e.target.checked)} style={{accentColor:C.blue,width:14,height:14}}/>Interest-only (IO)
              </label>
              <div style={{background:C.blueL,borderRadius:8,padding:"10px 12px",fontSize:11,color:C.sub,border:`1px solid ${C.blue}22`,display:"grid",gap:4}}>
                <Tag label="Deployable cash" value={fmt(deployCash)} color={C.sub}/>
                <Tag label="− Stamp duty" value={fmt(stampAd)} color={C.red}/>
                <Tag label="Deposit" value={fmt(invDepD)} color={C.blue}/>
                <Tag label="Mortgage" value={fmt(invMortD)} color={C.sub}/>
                <Tag label={`Repayment (${invIsIO?"IO":"P&I"})`} value={`${fmt(invIsIO?invMortD*(invRate/100)/12:monthlyRepayment(invMortD,invRate))}/mo`} color={C.blue}/>
                <Tag label="Land tax" value={nswLandTax(invLandVal)>0?fmt(nswLandTax(invLandVal))+"/yr":"$0"} color={nswLandTax(invLandVal)>0?C.red:C.green}/>
              </div>
            </div>
          </Card>

          {/* Scenario B */}
          <Card accent={C.green}>
            <ST><span style={{color:C.green}}>Scenario B</span></ST><SS>Sell flat + buy house</SS>
            <div style={{display:"grid",gap:10}}>
              <Field label="House Price" value={housePrice} onChange={setHousePrice}/>
              <Field label="Home Loan Rate" value={houseRate} onChange={setHouseRate} noPrefix suffix="%"/>
              <div style={{background:C.greenL,borderRadius:8,padding:"10px 12px",fontSize:11,color:C.sub,border:`1px solid ${C.green}22`,display:"grid",gap:4}}>
                <Tag label="Flat equity" value={fmt(flatEq)} color={C.green}/>
                <Tag label="+ Deployable cash" value={fmt(deployCash)} color={C.sub}/>
                <Tag label="− Stamp duty" value={fmt(stampBd)} color={C.red}/>
                <Tag label="− Selling costs (1.65%+$8.7k)" value={fmt(sellCosts)} color={C.red}/>
                <Tag label="Deposit" value={fmt(houseDepD)} color={C.green}/>
                <Tag label="Mortgage" value={fmt(houseMortD)} color={C.sub}/>
                <Tag label="Repayment" value={`${fmt(monthlyRepayment(houseMortD,houseRate))}/mo`} color={C.green}/>
                <Tag label="− Strata saving" value={`${fmt(flatStrataMonthly)}/mo`} color={C.green}/>
              </div>
            </div>
          </Card>

          {/* Scenario C + Assumptions */}
          <div style={{display:"grid",gap:14}}>
            <Card accent={C.purple}>
              <ST><span style={{color:C.purple}}>Scenario C</span></ST><SS>Reno flat, sell + buy house in {dSaleYear}</SS>
              <div style={{display:"grid",gap:10}}>
                <Field label="Reno Cost" value={renoCost} onChange={setRenoCost}/>
                <Field label="Reno Value Add" value={renoValueAdd} onChange={setRenoValueAdd}/>
                <div><span style={LBL}>Sale Year</span><input type="text" inputMode="numeric" value={dSaleYear} style={INP} onChange={e=>{const n=parseInt(e.target.value);if(!isNaN(n)&&n>=CURRENT_YEAR+1)setDSaleYear(n);}}/></div>
                <div style={{background:C.purpleL,borderRadius:8,padding:"10px 12px",fontSize:11,color:C.sub,border:`1px solid ${C.purple}22`,display:"grid",gap:4}}>
                  <Tag label={`Flat (reno+${dIdxD}yr)`} value={fmt(dFlatSD)} color={C.purple}/>
                  <Tag label="− Mortgage balance" value={fmt(dFlatBD)} color={C.red}/>
                  <Tag label="− Selling costs" value={fmt(dSellCD)} color={C.red}/>
                  <Tag label="Cash (deployable−reno)" value={fmt(dCashD)} color={C.sub}/>
                  <Tag label={`House in ${dSaleYear}`} value={fmt(dHPD)} color={C.sub}/>
                  <Tag label="− Stamp duty" value={fmt(dStampD)} color={C.red}/>
                  <Tag label="Deposit" value={fmt(dDepD)} color={C.purple}/>
                  <Tag label="Repayment" value={`${fmt(monthlyRepayment(dMortD,houseRate))}/mo`} color={C.purple}/>
                </div>
              </div>
            </Card>
            <Card>
              <ST>Assumptions</ST>
              <div style={{display:"grid",gap:10}}>
                <Field label="Inflation" value={inflationRate} onChange={setInflationRate} noPrefix suffix="%"/>
                <Field label="Income Growth" value={incomeGrowth} onChange={setIncomeGrowth} noPrefix suffix="%"/>
                <Field label="Property Growth" value={propertyGrowth} onChange={setPropertyGrowth} noPrefix suffix="%"/>
                <Field label="Rent Growth" value={rentGrowth} onChange={setRentGrowth} noPrefix suffix="%"/>
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                  <Field label="Life contingency buffer / mo" value={contingencyMonthly} onChange={setContingencyMonthly}/>
                  <p style={{margin:"5px 0 0",fontSize:10,color:C.muted}}>Inflation-adjusted · 5% of income ≈ {fmt(Math.round(monthlyNetIncome*0.05))}/mo</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Scenario D */}
          <Card accent={C.amber}>
            <ST><span style={{color:C.amber}}>Scenario D</span></ST><SS>Keep flat — all cash in offset</SS>
            <div style={{display:"grid",gap:8,marginTop:4}}>
              <Tag label="Total offset balance" value={fmt(cashSavings)} color={C.amber}/>
              <Tag label="Effective interest on" value={fmt(Math.max(0,mortgageOwing-cashSavings))} color={C.sub}/>
              <Tag label="Monthly interest saving" value={`${fmt(cashSavings*(currentRate/100)/12)}/mo`} color={C.green}/>
              <div style={{background:C.amberL,borderRadius:8,padding:"10px 12px",fontSize:11,color:C.sub,border:`1px solid ${C.amber}22`,marginTop:4}}>
                <b style={{color:C.amber}}>Equivalent return: {currentRate}% guaranteed, tax-free</b><br/>
                vs 7% invested @ 45% MTR ≈ {(7*(1-0.45)).toFixed(1)}% net<br/><br/>
                Emergency fund accessible at any time. Same repayment — benefit shows as faster equity growth.
              </div>
            </div>
          </Card>
        </div>

        {/* Lifecycle events */}
        <Card style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div><ST>Lifecycle Events</ST><p style={{margin:0,fontSize:11,color:C.sub}}>Expense events are inflation-adjusted · Income events are fixed post-tax</p></div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>addEvent(true)} style={{background:C.greenL,border:`1px solid ${C.green}44`,borderRadius:7,color:C.green,fontSize:12,fontWeight:600,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit"}}>+ Income</button>
              <button onClick={()=>addEvent(false)} style={{background:C.amberL,border:`1px solid ${C.amber}44`,borderRadius:7,color:C.amber,fontSize:12,fontWeight:600,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit"}}>+ Expense</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {events.map(ev=>{
              const accent=ev.isIncome?C.green:C.amber;
              return (
                <div key={ev.id} style={{background:C.bg,borderRadius:8,padding:12,border:`1px solid ${C.border}`,borderLeft:`3px solid ${accent}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <input type="text" value={ev.label} onChange={e=>updateEvent(ev.id,{label:e.target.value})} style={{...INP,fontSize:11,color:accent,background:"transparent",border:"none",padding:0,fontWeight:600}}/>
                    <button onClick={()=>removeEvent(ev.id)} style={{background:"none",border:"none",color:C.muted,fontSize:15,cursor:"pointer",padding:"0 4px"}}>×</button>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <div style={{flex:1}}><span style={LBL}>Start yr</span><input type="text" inputMode="numeric" value={ev.year} style={{...INP,fontSize:12}} onChange={e=>{const n=parseInt(e.target.value);if(!isNaN(n))updateEvent(ev.id,{year:n});}}/></div>
                    <div style={{flex:1}}><span style={LBL}>End yr</span><input type="text" inputMode="numeric" value={ev.endYear??""} placeholder="open" style={{...INP,fontSize:12}} onChange={e=>{const n=parseInt(e.target.value);updateEvent(ev.id,{endYear:isNaN(n)?undefined:n});}}/></div>
                    <div style={{flex:1}}><span style={LBL}>$/mo</span><input type="text" inputMode="numeric" value={ev.monthlyDelta} style={{...INP,fontSize:12}} onChange={e=>{const n=parseInt(e.target.value);if(!isNaN(n))updateEvent(ev.id,{monthlyDelta:n});}}/></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Stress Test */}
        <Card style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}}>
            <div><ST>Comfort Score — Stress Testing</ST><p style={{margin:0,fontSize:11,color:C.sub}}>Rate shock + income shock applied simultaneously. APRA standard buffer = +3%.</p></div>
            <div style={{display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div>
                <span style={LBL}>Rate stress (current {currentRate}% → {(currentRate+stressRateAdd).toFixed(1)}%)</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <input type="range" min={0} max={5} step={0.5} value={stressRateAdd} onChange={e=>setStressRateAdd(Number(e.target.value))} style={{width:140,accentColor:C.red}}/>
                  <span style={{fontSize:13,fontWeight:700,color:stressRateAdd>=3?C.red:stressRateAdd>=1.5?C.amber:C.green}}>+{stressRateAdd}%</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  {[0,1,2,3,5].map(v=>(
                    <button key={v} onClick={()=>setStressRateAdd(v)} style={{padding:"3px 8px",fontSize:11,borderRadius:5,cursor:"pointer",fontFamily:"inherit",background:stressRateAdd===v?C.red:C.bg,color:stressRateAdd===v?"#fff":C.sub,border:`1px solid ${stressRateAdd===v?C.red:C.border}`,fontWeight:stressRateAdd===v?700:400}}>+{v}%</button>
                  ))}
                </div>
              </div>
              <div>
                <span style={LBL}>Income shock</span>
                <div style={{display:"flex",gap:6}}>
                  {[["none","Both incomes"],["p1","Partner 1 loses job"],["p2","Partner 2 loses job"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setIncomeShock(v)} style={{padding:"6px 12px",fontSize:11,borderRadius:6,cursor:"pointer",fontFamily:"inherit",background:incomeShock===v?C.red:C.bg,color:incomeShock===v?"#fff":C.sub,border:`1px solid ${incomeShock===v?C.red:C.border}`,fontWeight:incomeShock===v?700:400}}>{l}</button>
                  ))}
                </div>
                {incomeShock!=="none"&&<p style={{margin:"6px 0 0",fontSize:11,color:C.red}}>Income: {fmt(monthlyNetIncome)}/mo → {fmt(stressData.stressedNet)}/mo</p>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {Object.entries(SCEN).map(([k,s])=>{
              const d=stressData.scenarios[k];
              const rc=d.rag==="green"?C.green:d.rag==="amber"?C.amber:C.red;
              const rb=d.rag==="green"?C.greenL:d.rag==="amber"?C.amberL:C.redL;
              const mp=Math.round(d.mortRatio*100);
              const mo=d.months===Infinity?"∞":`${d.months}mo`;
              return (
                <div key={k} style={{background:rb,borderRadius:12,padding:16,border:`1px solid ${rc}33`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:s.color}}>{s.label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{fontSize:22,fontWeight:900,color:rc}}>{d.score}</div>
                      <div style={{fontSize:11,fontWeight:700,color:rc,background:rc+"22",borderRadius:20,padding:"3px 10px"}}>{d.label}</div>
                    </div>
                  </div>
                  <div style={{height:6,background:C.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${d.score}%`,background:rc,borderRadius:3,transition:"width 0.4s ease"}}/>
                  </div>
                  <div style={{display:"grid",gap:6}}>
                    <div style={{background:"#fff8",borderRadius:7,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:C.sub,fontWeight:600,marginBottom:2}}>STRESSED CASH FLOW</div>
                      <div style={{fontSize:16,fontWeight:800,color:d.cf>=0?C.green:C.red}}>{d.cf>=0?"+":""}{fmt(d.cf)}<span style={{fontSize:10,fontWeight:400}}>/mo</span></div>
                      <div style={{fontSize:10,color:C.muted,marginTop:1}}>at {(currentRate+stressRateAdd).toFixed(1)}%{incomeShock!=="none"?" + income shock":""}</div>
                    </div>
                    <div style={{background:"#fff8",borderRadius:7,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:C.sub,fontWeight:600,marginBottom:2}}>MORTGAGE / GROSS INCOME</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:16,fontWeight:800,color:mp>40?C.red:mp>30?C.amber:C.green}}>{mp}%</div>
                        <div style={{fontSize:10,color:C.muted}}>{mp<=30?"✓ Below 30%":mp<=40?"⚠ 30–40% stress":"> 40% high stress"}</div>
                      </div>
                    </div>
                    <div style={{background:"#fff8",borderRadius:7,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:C.sub,fontWeight:600,marginBottom:2}}>SAVINGS RUNWAY</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:16,fontWeight:800,color:d.months<3?C.red:d.months<6?C.amber:C.green}}>{mo}</div>
                        <div style={{fontSize:10,color:C.muted}}>{k==="D"?`${fmt(cashSavings)} in offset`:`${fmt(emergencyFund)} emergency fund`}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{margin:"12px 0 0",fontSize:11,color:C.muted}}>Score out of 100: stressed cash flow (40pts) · mortgage serviceability (30pts) · savings runway (30pts). A/B/C runway uses emergency fund; D uses full offset balance.</p>
        </Card>

        {/* Summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
          {Object.entries(SCEN).map(([k,s])=>(
            <Card key={k} accent={s.color} style={{padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:s.color,marginBottom:12}}>{s.label}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,textAlign:"center"}}>
                {[0,10,20].map(yr=>{
                  const d=projData[yr]; const cf=d[k].cashFlow;
                  return (
                    <div key={yr} style={{background:C.bg,borderRadius:8,padding:"8px 4px"}}>
                      <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",fontWeight:600,marginBottom:4}}>{yr===0?"Now":`${yr}yr`}</div>
                      <div style={{fontSize:15,fontWeight:800,color:cf>=0?s.color:C.red}}>{fmtK(cf)}<span style={{fontSize:9,fontWeight:400}}>/mo</span></div>
                      <div style={{fontSize:10,color:C.sub,marginTop:3}}>{fmtM(d[k].netWorth)}</div>
                      {k==="A"&&yr>0&&<div style={{fontSize:9,color:C.red,marginTop:2}}>{fmtM(d[k].netWorthAfterCGT)} −CGT</div>}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          <ChartCard title="Monthly Cash Flow" sub="Net income after tax, all expenses, contingency and mortgage repayments" data={cfChart} yFmt={fmtK}/>
          <ChartCard title="Net Worth" sub="Property equity + accessible cash across all four scenarios" data={nwChart} yFmt={fmtM}/>
        </div>

        {/* Detail table */}
        <Card>
          <ST>Year-by-Year Detail</ST><SS>Every 2 years + event years · ★ marks a lifecycle event</SS>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border2}`}}>
                  {["Year","Income/mo","Expenses/mo","CF: A","CF: B","CF: C","CF: D","Worth: A","Worth: A −CGT","Worth: B","Worth: C","Worth: D"].map(h=>(
                    <th key={h} style={{textAlign:"right",padding:"8px 10px",color:C.sub,fontWeight:600,whiteSpace:"nowrap",fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projData.filter((_,i)=>i%2===0||evtYears.includes(CURRENT_YEAR+i)).map((d,ri)=>{
                  const isEvt=evtYears.includes(d.year);
                  return (
                    <tr key={d.year} style={{borderBottom:`1px solid ${C.border}`,background:isEvt?C.blueL:ri%2===0?"#fff":C.bg}}>
                      <td style={{padding:"7px 10px",color:isEvt?C.blue:C.text,fontWeight:isEvt?700:500}}>{d.year}{isEvt?" ★":""}</td>
                      <td style={{textAlign:"right",padding:"7px 10px",color:C.sub}}>{fmt(d.income)}</td>
                      <td style={{textAlign:"right",padding:"7px 10px",color:C.sub}}>{fmt(d.expenses)}</td>
                      {["A","B","C","D"].map(k=>(
                        <td key={k} style={{textAlign:"right",padding:"7px 10px",fontWeight:600,color:d[k].cashFlow>=0?C.green:C.red}}>{fmt(d[k].cashFlow)}</td>
                      ))}
                      <td style={{textAlign:"right",padding:"7px 10px",color:C.sub}}>{fmtM(d.A.netWorth)}</td>
                      <td style={{textAlign:"right",padding:"7px 10px",color:C.sub}}>{fmtM(d.A.netWorthAfterCGT)}</td>
                      {["B","C","D"].map(k=>(
                        <td key={k} style={{textAlign:"right",padding:"7px 10px",color:C.sub}}>{fmtM(d[k].netWorth)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:16}}>For discussion purposes only · Not financial advice</p>
      </div>
    </div>
  );
}