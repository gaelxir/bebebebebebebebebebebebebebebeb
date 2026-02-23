import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ── localStorage helpers ── */
const KEYS = { sales: "sp-sales", products: "sp-products", settings: "sp-settings" };

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const fmtUSD = (n) => "$" + Number(n || 0).toLocaleString("en-US");
const fmtRBX = (n) => Number(n || 0).toLocaleString("en-US") + " R$";

const DEFAULT_PRODUCTS = [{ name: "Atomic", price: 25, robux: 3000, cost: 0 }];
const DEFAULT_SETTINGS = { accent: "#bdffff", robuxColor: "#6ee06e" };

const ACCENT_PRESETS = [
  { name: "Ice", color: "#bdffff" },
  { name: "Lilac", color: "#d4b8ff" },
  { name: "Rose", color: "#ffb8c6" },
  { name: "Mint", color: "#b8ffd4" },
  { name: "Sky", color: "#b8d4ff" },
  { name: "Peach", color: "#ffd4b8" },
  { name: "Lemon", color: "#fffab8" },
  { name: "Silver", color: "#d0d0d8" },
];

const demoSales = [
  { id: 1, client: "xDark_Mex", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-17T14:30:00", status: "completed", notes: "Discord" },
  { id: 2, client: "ShadowFx", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-17T09:15:00", status: "completed", notes: "PayPal" },
  { id: 3, client: "NightOwl99", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-18T18:45:00", status: "completed", notes: "" },
  { id: 4, client: "CyberVato", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-19T11:00:00", status: "completed", notes: "Discord" },
  { id: 5, client: "Glitch404", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-19T16:20:00", status: "completed", notes: "CashApp" },
  { id: 6, client: "PhantomZz", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-20T13:00:00", status: "completed", notes: "Discord" },
  { id: 7, client: "ViperX", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-20T20:10:00", status: "pending", notes: "waiting payment" },
  { id: 8, client: "NoScope_Kid", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-21T08:30:00", status: "completed", notes: "" },
  { id: 9, client: "DrkMatter", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-21T22:00:00", status: "completed", notes: "Venmo" },
  { id: 10, client: "ZeroDay", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-22T15:45:00", status: "completed", notes: "Discord" },
  { id: 11, client: "Specter_7", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-22T19:30:00", status: "pending", notes: "owes next week" },
  { id: 12, client: "BlkWolf", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-23T10:15:00", status: "completed", notes: "PayPal" },
  { id: 13, client: "R4venCl4w", product: "Atomic", amount: 25, robux: 3000, date: "2026-02-23T14:00:00", status: "completed", notes: "" },
];

/* ── Color palette (cold) ── */
const P = {
  bg: "#0c0e12", card: "#11141a", border: "#1a1e26", borderHover: "#242a34",
  hover: "#151a22", altRow: "#0e1118", input: "#0a0d12",
  text: "#b4bcc8", textLight: "#dce0e8", textMid: "#788294", textDim: "#58626e",
  textDark: "#3e4854", textGhost: "#2e3640",
  red: "#aa5555", redLight: "#cc6655", redBorder: "#3a2028", costColor: "#7788aa",
};

/* ── Animated number ── */
function AnimNum({ value, prefix = "", suffix = "", color = P.textLight, size = "22px" }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const frameRef = useRef(null);
  useEffect(() => {
    const from = prev.current; const to = value; prev.current = value;
    if (from === to) return;
    const duration = 500; const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);
  return <div style={{ fontSize: size, fontWeight: 700, color, lineHeight: 1, transition: "color 0.3s" }}>{prefix}{display.toLocaleString("en-US")}{suffix}</div>;
}

function calcStreak(sales) {
  const dates = new Set(); sales.filter(s => s.status === "completed").forEach(s => dates.add(new Date(s.date).toDateString()));
  if (!dates.size) return 0; let streak = 0; let d = new Date();
  if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (dates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function exportCSV(sales) {
  const h = "Date,Client,Product,USD,Robux,Status,Notes\n";
  const r = sales.map(s => `${new Date(s.date).toLocaleDateString("en-US")},${s.client},${s.product},${s.amount},${s.robux||0},${s.status},"${(s.notes||"").replace(/"/g,'""')}"`).join("\n");
  const b = new Blob([h + r], { type: "text/csv" }); const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = `sales-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(u);
}

function getDailyData(sales) {
  const m = {}; sales.filter(s => s.status === "completed").forEach(s => {
    const d = new Date(s.date).toLocaleDateString("en-US",{day:"2-digit",month:"short"});
    if (!m[d]) m[d]={day:d,revenue:0,robux:0,count:0}; m[d].revenue+=s.amount; m[d].robux+=(s.robux||0); m[d].count+=1;
  }); return Object.values(m).slice(-14);
}
function getWeeklyData(sales) {
  const m = {}; sales.filter(s => s.status === "completed").forEach(s => {
    const d = new Date(s.date); const sw = new Date(d); sw.setDate(d.getDate()-d.getDay());
    const k = sw.toLocaleDateString("en-US",{month:"short",day:"2-digit"});
    if (!m[k]) m[k]={day:"W "+k,revenue:0,robux:0,count:0}; m[k].revenue+=s.amount; m[k].robux+=(s.robux||0); m[k].count+=1;
  }); return Object.values(m).slice(-8);
}
function getMonthlyData(sales) {
  const m = {}; sales.filter(s => s.status === "completed").forEach(s => {
    const k = new Date(s.date).toLocaleDateString("en-US",{month:"short",year:"2-digit"});
    if (!m[k]) m[k]={day:k,revenue:0,robux:0,count:0}; m[k].revenue+=s.amount; m[k].robux+=(s.robux||0); m[k].count+=1;
  }); return Object.values(m).slice(-12);
}
function getProductData(sales) {
  const m = {}; sales.filter(s => s.status === "completed").forEach(s => {
    if (!m[s.product]) m[s.product]={product:s.product,total:0,robux:0,count:0};
    m[s.product].total+=s.amount; m[s.product].robux+=(s.robux||0); m[s.product].count+=1;
  }); return Object.values(m).sort((a,b) => b.total-a.total);
}

export default function App() {
  const [sales, setSales] = useState(() => load(KEYS.sales, demoSales));
  const [products, setProducts] = useState(() => load(KEYS.products, DEFAULT_PRODUCTS));
  const [settings, setSettings] = useState(() => load(KEYS.settings, DEFAULT_SETTINGS));
  const [showForm, setShowForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newProduct, setNewProduct] = useState({name:"",price:"",robux:"",cost:""});
  const [form, setForm] = useState({client:"",product:"Atomic",amount:25,robux:3000,status:"completed",notes:""});
  const [tab, setTab] = useState("all");
  const [chartView, setChartView] = useState("revenue");
  const [timeRange, setTimeRange] = useState("daily");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedSale, setExpandedSale] = useState(null);

  const AC = settings.accent;
  const RBX = settings.robuxColor;

  const save = useCallback((next) => { setSales(next); persist(KEYS.sales, next); }, []);
  const saveProducts = useCallback((next) => { setProducts(next); persist(KEYS.products, next); }, []);
  const saveSettings = useCallback((next) => { setSettings(next); persist(KEYS.settings, next); }, []);

  const addSale = () => {
    if (!form.client.trim()||!form.amount) return;
    save([{id:Date.now(),client:form.client.trim(),product:form.product,amount:parseFloat(form.amount),robux:parseInt(form.robux)||0,date:new Date().toISOString(),status:form.status,notes:form.notes},...sales]);
    setForm({...form,client:"",notes:""}); setShowForm(false);
  };
  const addProduct = () => {
    if (!newProduct.name.trim()||!newProduct.price) return;
    saveProducts([...products,{name:newProduct.name.trim(),price:parseFloat(newProduct.price),robux:parseInt(newProduct.robux)||0,cost:parseFloat(newProduct.cost)||0}]);
    setNewProduct({name:"",price:"",robux:"",cost:""}); setShowProductForm(false);
  };
  const removeProduct = (name) => {
    if (products.length<=1) return; const u = products.filter(p=>p.name!==name); saveProducts(u);
    if (form.product===name) setForm({...form,product:u[0].name,amount:u[0].price,robux:u[0].robux});
  };
  const handleProductChange = (pn) => {
    const p = products.find(pr=>pr.name===pn);
    setForm({...form,product:pn,amount:p?.price||form.amount,robux:p?.robux||form.robux});
  };

  const paid = sales.filter(s=>s.status==="completed");
  const revenue = paid.reduce((a,s)=>a+s.amount,0);
  const totalRobux = paid.reduce((a,s)=>a+(s.robux||0),0);
  const totalCost = paid.reduce((a,s)=>{const p=products.find(pr=>pr.name===s.product);return a+(p?.cost||0);},0);
  const profit = revenue-totalCost;
  const streak = calcStreak(sales);
  const todayPaid = paid.filter(s=>new Date(s.date).toDateString()===new Date().toDateString());
  const todayRevenue = todayPaid.reduce((a,s)=>a+s.amount,0);
  const todayRobux = todayPaid.reduce((a,s)=>a+(s.robux||0),0);
  const chartData = {daily:getDailyData,weekly:getWeeklyData,monthly:getMonthlyData}[timeRange](sales);
  const productData = getProductData(sales);

  let filtered = tab==="all"?sales:sales.filter(s=>s.status===tab);
  if (searchQuery.trim()) { const q=searchQuery.toLowerCase(); filtered=filtered.filter(s=>s.client.toLowerCase().includes(q)||s.product.toLowerCase().includes(q)||(s.notes||"").toLowerCase().includes(q)); }

  const inputStyle = {
    padding:"10px 14px",borderRadius:"6px",border:`1px solid ${P.border}`,
    background:P.input,color:P.textLight,fontSize:"13px",
    fontFamily:"'IBM Plex Mono', monospace",outline:"none",width:"100%",transition:"border-color 0.2s",
  };
  const pillBtn = (active,activeColor=AC) => ({
    padding:"5px 14px",borderRadius:"4px",border:"none",
    background:active?P.borderHover:"transparent",color:active?activeColor:P.textDim,
    fontSize:"10px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",
    letterSpacing:"0.5px",textTransform:"uppercase",transition:"all 0.2s",
  });

  const ChartTooltip = ({active,payload,label}) => {
    if (!active||!payload?.length) return null;
    return (<div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"6px",padding:"10px 14px",fontFamily:"inherit"}}>
      <div style={{fontSize:"11px",color:P.textMid,marginBottom:"4px"}}>{label}</div>
      {payload.map((p,i)=>(<div key={i} style={{fontSize:"13px",color:p.name==="robux"?RBX:AC,fontWeight:600}}>
        {p.name==="revenue"?fmtUSD(p.value):p.name==="robux"?fmtRBX(p.value):p.value+" sales"}
      </div>))}
    </div>);
  };

  return (
    <div style={{minHeight:"100vh",background:P.bg,color:P.text,fontFamily:"'IBM Plex Mono','Menlo',monospace"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder,textarea::placeholder{color:${P.textDark}}
        select option{background:${P.bg};color:${P.text}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${P.border};border-radius:2px}
        @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:640px){
          .stat-grid{grid-template-columns:1fr 1fr!important}
          .chart-grid{grid-template-columns:1fr!important}
          .sale-row{grid-template-columns:1fr auto auto!important}
          .sale-header{grid-template-columns:1fr auto auto!important}
          .hide-mobile{display:none!important}
        }
      `}</style>

      <div style={{maxWidth:"900px",margin:"0 auto",padding:"28px 16px 60px"}}>

        {/* HEADER */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderBottom:`1px solid ${P.border}`,paddingBottom:"18px",marginBottom:"28px",flexWrap:"wrap",gap:"14px"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"clamp(30px,6vw,46px)",fontWeight:900,color:P.textLight,lineHeight:1,letterSpacing:"-2px"}}>Sales</div>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginTop:"6px"}}>
              <span style={{fontSize:"11px",color:P.textDim,letterSpacing:"1px"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</span>
              {streak>0&&<span style={{fontSize:"10px",fontWeight:700,letterSpacing:"1px",color:P.bg,background:AC,padding:"2px 8px",borderRadius:"3px"}}>{streak} DAY STREAK 🔥</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            <button onClick={()=>exportCSV(sales)} style={{padding:"9px 16px",borderRadius:"6px",border:`1px solid ${P.border}`,background:"transparent",color:P.textDim,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>↓ CSV</button>
            <button onClick={()=>{setShowSettings(!showSettings);setShowForm(false);setShowProductForm(false)}} style={{padding:"9px 16px",borderRadius:"6px",border:showSettings?`1px solid ${P.redBorder}`:`1px solid ${P.border}`,background:"transparent",color:showSettings?P.red:P.textDim,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showSettings?"Close":"⚙"}</button>
            <button onClick={()=>{setShowProductForm(!showProductForm);setShowForm(false);setShowSettings(false)}} style={{padding:"9px 16px",borderRadius:"6px",border:showProductForm?`1px solid ${P.redBorder}`:`1px solid ${P.border}`,background:"transparent",color:showProductForm?P.red:P.textDim,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showProductForm?"Cancel":"+ Product"}</button>
            <button onClick={()=>{setShowForm(!showForm);setShowProductForm(false);setShowSettings(false)}} style={{padding:"9px 22px",borderRadius:"6px",border:showForm?`1px solid ${P.redBorder}`:`1px solid ${AC}`,background:showForm?"transparent":AC,color:showForm?P.red:P.bg,fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{showForm?"Cancel":"+ New Sale"}</button>
          </div>
        </div>

        {/* SETTINGS */}
        {showSettings&&(<div style={{border:`1px solid ${P.border}`,borderRadius:"8px",padding:"20px",marginBottom:"24px",background:P.card,animation:"slideIn 0.25s ease"}}>
          <div style={{fontSize:"10px",color:P.textDim,letterSpacing:"2px",textTransform:"uppercase",fontWeight:600,marginBottom:"14px"}}>Accent Color</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"16px"}}>
            {ACCENT_PRESETS.map(p=>(<div key={p.color} onClick={()=>saveSettings({...settings,accent:p.color})} style={{width:"36px",height:"36px",borderRadius:"8px",background:p.color,cursor:"pointer",border:settings.accent===p.color?"2px solid #fff":"2px solid transparent",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center"}} title={p.name}>{settings.accent===p.color&&<span style={{fontSize:"14px"}}>✓</span>}</div>))}
          </div>
          <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
            <label style={{fontSize:"11px",color:P.textDim}}>Custom:</label>
            <input type="color" value={settings.accent} onChange={e=>saveSettings({...settings,accent:e.target.value})} style={{width:"40px",height:"30px",border:"none",background:"transparent",cursor:"pointer"}} />
            <span style={{fontSize:"12px",color:AC,fontWeight:600}}>{settings.accent}</span>
          </div>
        </div>)}

        {/* ADD PRODUCT */}
        {showProductForm&&(<div style={{border:`1px solid ${P.border}`,borderRadius:"8px",padding:"20px",marginBottom:"24px",background:P.card,animation:"slideIn 0.25s ease"}}>
          <div style={{fontSize:"10px",color:P.textDim,letterSpacing:"2px",textTransform:"uppercase",fontWeight:600,marginBottom:"14px"}}>Add Product</div>
          <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
            <input style={{...inputStyle,flex:"1 1 140px"}} placeholder="Name" value={newProduct.name} onChange={e=>setNewProduct({...newProduct,name:e.target.value})} />
            <input style={{...inputStyle,flex:"0 1 90px"}} type="number" placeholder="$ Price" value={newProduct.price} onChange={e=>setNewProduct({...newProduct,price:e.target.value})} />
            <input style={{...inputStyle,flex:"0 1 100px"}} type="number" placeholder="Robux" value={newProduct.robux} onChange={e=>setNewProduct({...newProduct,robux:e.target.value})} />
            <input style={{...inputStyle,flex:"0 1 90px"}} type="number" placeholder="$ Cost" value={newProduct.cost} onChange={e=>setNewProduct({...newProduct,cost:e.target.value})} />
            <button onClick={addProduct} style={{padding:"10px 20px",borderRadius:"6px",border:"none",background:AC,color:P.bg,fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Add</button>
          </div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {products.map(p=>(<div key={p.name} style={{display:"flex",alignItems:"center",gap:"6px",padding:"5px 10px",borderRadius:"4px",background:P.border,fontSize:"10px",color:P.textMid}}>
              <span style={{color:AC,fontWeight:600}}>{p.name}</span><span>{fmtUSD(p.price)}</span>
              {p.robux>0&&<span style={{color:RBX}}>{fmtRBX(p.robux)}</span>}
              {p.cost>0&&<span style={{color:P.costColor}}>cost {fmtUSD(p.cost)}</span>}
              {products.length>1&&<span onClick={()=>removeProduct(p.name)} style={{cursor:"pointer",color:P.textDark,transition:"color 0.15s"}} onMouseEnter={e=>e.target.style.color=P.red} onMouseLeave={e=>e.target.style.color=P.textDark}>×</span>}
            </div>))}
          </div>
        </div>)}

        {/* SALE FORM */}
        {showForm&&(<div style={{border:`1px solid ${P.border}`,borderRadius:"8px",padding:"20px",marginBottom:"24px",background:P.card,animation:"slideIn 0.25s ease"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"10px",marginBottom:"10px"}}>
            <input style={inputStyle} placeholder="Client / Tag" value={form.client} onChange={e=>setForm({...form,client:e.target.value})} />
            <select style={{...inputStyle,cursor:"pointer"}} value={form.product} onChange={e=>handleProductChange(e.target.value)}>{products.map(p=><option key={p.name} value={p.name}>{p.name} — {fmtUSD(p.price)}</option>)}</select>
            <input style={inputStyle} type="number" placeholder="$ USD" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
            <input style={inputStyle} type="number" placeholder="Robux" value={form.robux} onChange={e=>setForm({...form,robux:e.target.value})} />
            <select style={{...inputStyle,cursor:"pointer"}} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="completed">Paid</option><option value="pending">Pending</option></select>
            <input style={inputStyle} placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
          </div>
          <button onClick={addSale} style={{width:"100%",padding:"12px",borderRadius:"6px",border:"none",background:AC,color:P.bg,fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Register Sale</button>
        </div>)}

        {/* STAT CARDS */}
        <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"10px",marginBottom:"10px"}}>
          {[
            {label:"Revenue",prefix:"$",val:revenue,sub:paid.length+" sales",color:P.textLight},
            {label:"Today",prefix:"$",val:todayRevenue,sub:todayPaid.length+" sales",color:P.textLight},
            {label:"Profit",prefix:"$",val:profit,sub:totalCost>0?`${fmtUSD(totalCost)} costs`:"no costs set",color:profit>0?AC:P.red},
            {label:"Avg / Sale",prefix:"$",val:paid.length?Math.round(revenue/paid.length):0,sub:"per sale",color:P.textLight},
          ].map((s,i)=>(<div key={i} style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"8px",padding:"16px"}}>
            <div style={{fontSize:"10px",color:P.textDim,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"8px",fontWeight:600}}>{s.label}</div>
            <AnimNum value={s.val} prefix={s.prefix} color={s.color} /><div style={{fontSize:"11px",color:P.textDark,marginTop:"4px"}}>{s.sub}</div>
          </div>))}
        </div>
        <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"10px",marginBottom:"28px"}}>
          {[
            {label:"Total Robux",val:totalRobux,suffix:" R$",color:RBX,sub:"earned",lc:"#3a5a6a"},
            {label:"Today R$",val:todayRobux,suffix:" R$",color:RBX,sub:todayPaid.length+" sales",lc:"#3a5a6a"},
            {label:"Pending",val:sales.filter(s=>s.status==="pending").length,suffix:"",color:"#99a4b0",sub:fmtUSD(sales.filter(s=>s.status==="pending").reduce((a,s)=>a+s.amount,0)),lc:P.textDim},
            {label:"Streak",val:streak,suffix:"d",color:streak>=7?AC:streak>=3?P.textLight:P.textMid,sub:streak>=7?"on fire":streak>=3?"keep going":"start selling",lc:P.textDim},
          ].map((s,i)=>(<div key={i} style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"8px",padding:"16px"}}>
            <div style={{fontSize:"10px",color:s.lc,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"8px",fontWeight:600}}>{s.label}</div>
            <AnimNum value={s.val} suffix={s.suffix} color={s.color} /><div style={{fontSize:"11px",color:P.textDark,marginTop:"4px"}}>{s.sub}</div>
          </div>))}
        </div>

        {/* CHARTS */}
        <div className="chart-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"28px"}}>
          <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"8px",padding:"16px",gridColumn:"1/-1"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
              <div style={{display:"flex",gap:"4px"}}>{["daily","weekly","monthly"].map(r=>(<button key={r} onClick={()=>setTimeRange(r)} style={pillBtn(timeRange===r)}>{r.charAt(0).toUpperCase()+r.slice(1)}</button>))}</div>
              <div style={{display:"flex",gap:"4px"}}>{[{key:"revenue",label:"USD"},{key:"robux",label:"R$"},{key:"count",label:"##"}].map(v=>(<button key={v.key} onClick={()=>setChartView(v.key)} style={pillBtn(chartView===v.key,v.key==="robux"?RBX:AC)}>{v.label}</button>))}</div>
            </div>
            <div style={{height:"180px"}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{top:5,right:5,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AC} stopOpacity={0.18}/><stop offset="100%" stopColor={AC} stopOpacity={0}/></linearGradient>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={RBX} stopOpacity={0.18}/><stop offset="100%" stopColor={RBX} stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={P.border}/>
                  <XAxis dataKey="day" tick={{fill:P.textDark,fontSize:10,fontFamily:"IBM Plex Mono"}} axisLine={{stroke:P.border}} tickLine={false}/>
                  <YAxis tick={{fill:P.textDark,fontSize:10,fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false} width={50}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Area type="monotone" dataKey={chartView} stroke={chartView==="robux"?RBX:AC} strokeWidth={2} fill={chartView==="robux"?"url(#gR)":"url(#gU)"} dot={{r:3,fill:chartView==="robux"?RBX:AC,stroke:P.bg,strokeWidth:2}} activeDot={{r:5,fill:chartView==="robux"?RBX:AC}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"8px",padding:"16px"}}>
            <div style={{fontSize:"10px",color:P.textDim,letterSpacing:"2px",textTransform:"uppercase",fontWeight:600,marginBottom:"14px"}}>By Product</div>
            <div style={{height:"160px"}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productData} layout="vertical" margin={{top:0,right:5,bottom:0,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={P.border} horizontal={false}/>
                  <XAxis type="number" tick={{fill:P.textDark,fontSize:10,fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="product" tick={{fill:P.textDim,fontSize:11,fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false} width={60}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Bar dataKey="total" name="revenue" fill={AC} radius={[0,3,3,0]} barSize={16}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:"8px",padding:"16px"}}>
            <div style={{fontSize:"10px",color:P.textDim,letterSpacing:"2px",textTransform:"uppercase",fontWeight:600,marginBottom:"12px"}}>Top Clients</div>
            <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
              {(()=>{const m={};paid.forEach(s=>{if(!m[s.client])m[s.client]={usd:0,rbx:0};m[s.client].usd+=s.amount;m[s.client].rbx+=(s.robux||0)});
                const arr=Object.entries(m).sort((a,b)=>b[1].usd-a[1].usd).slice(0,5);const mx=arr[0]?.[1].usd||1;
                return arr.map(([name,data],i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <div style={{fontSize:"11px",color:P.textDim,width:"70px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{flex:1,height:"5px",background:P.border,borderRadius:"3px",overflow:"hidden"}}><div style={{width:`${(data.usd/mx)*100}%`,height:"100%",background:`linear-gradient(90deg,${AC},${AC}66)`,borderRadius:"3px",transition:"width 0.5s ease"}}/></div>
                  <div style={{fontSize:"10px",color:P.textMid,fontWeight:600,minWidth:"36px",textAlign:"right"}}>{fmtUSD(data.usd)}</div>
                  <div style={{fontSize:"10px",color:RBX,fontWeight:600,minWidth:"50px",textAlign:"right",opacity:0.6}}>{fmtRBX(data.rbx)}</div>
                </div>));
              })()}
            </div>
          </div>
        </div>

        {/* HISTORY */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{fontSize:"10px",color:P.textDim,letterSpacing:"2px",textTransform:"uppercase",fontWeight:600}}>History ({filtered.length})</div>
              <input style={{...inputStyle,width:"160px",padding:"6px 12px",fontSize:"11px"}} placeholder="Search..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:"4px"}}>{[{key:"all",label:"All"},{key:"completed",label:"Paid"},{key:"pending",label:"Pending"}].map(f=>(<button key={f.key} onClick={()=>setTab(f.key)} style={pillBtn(tab===f.key)}>{f.label}</button>))}</div>
          </div>

          <div className="sale-header" style={{display:"grid",gridTemplateColumns:"1fr 80px 65px 65px 70px 32px",gap:"6px",padding:"0 12px 6px",fontSize:"9px",color:P.textGhost,letterSpacing:"1.5px",textTransform:"uppercase",fontWeight:600}}>
            <div>Client</div><div className="hide-mobile">Product</div><div style={{textAlign:"right"}}>USD</div><div style={{textAlign:"right"}}>R$</div><div style={{textAlign:"right"}} className="hide-mobile">Date</div><div></div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:"3px"}}>
            {filtered.length===0&&<div style={{textAlign:"center",padding:"36px",color:P.textGhost,fontSize:"13px"}}>No sales found</div>}
            {filtered.map((sale,i)=>(<div key={sale.id}>
              <div className="sale-row" style={{display:"grid",gridTemplateColumns:"1fr 80px 65px 65px 70px 32px",gap:"6px",alignItems:"center",padding:"10px 12px",background:i%2===0?"transparent":P.altRow,borderRadius:"6px",transition:"background 0.15s",cursor:"pointer",animation:`slideIn 0.3s ease ${i*0.02}s both`}}
                onClick={()=>setExpandedSale(expandedSale===sale.id?null:sale.id)}
                onMouseEnter={e=>e.currentTarget.style.background=P.hover} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":P.altRow}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",minWidth:0}}>
                  <div onClick={e=>{e.stopPropagation();save(sales.map(s=>s.id===sale.id?{...s,status:s.status==="completed"?"pending":"completed"}:s))}}
                    style={{width:"7px",height:"7px",borderRadius:"50%",background:sale.status==="completed"?AC:"#a0a0a0",flexShrink:0,cursor:"pointer",opacity:sale.status==="completed"?1:0.5}} title="Toggle"/>
                  <div style={{fontSize:"13px",fontWeight:600,color:P.textLight,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sale.client}</div>
                  {sale.notes&&<span style={{fontSize:"9px",color:P.textGhost,flexShrink:0}}>📝</span>}
                </div>
                <div className="hide-mobile" style={{fontSize:"11px",color:P.textDim}}>{sale.product}</div>
                <div style={{fontSize:"13px",fontWeight:700,textAlign:"right",color:sale.status==="completed"?AC:P.textDim}}>{fmtUSD(sale.amount)}</div>
                <div style={{fontSize:"11px",fontWeight:600,textAlign:"right",color:sale.status==="completed"?RBX:"#4a5a5a",opacity:sale.robux?0.8:0.3}}>{sale.robux?fmtRBX(sale.robux):"—"}</div>
                <div className="hide-mobile" style={{fontSize:"10px",color:P.textGhost,textAlign:"right"}}>{new Date(sale.date).toLocaleDateString("en-US",{day:"2-digit",month:"short"})}</div>
                <div style={{textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                  {deleteConfirm===sale.id?(<button onClick={()=>{save(sales.filter(s=>s.id!==sale.id));setDeleteConfirm(null)}} style={{background:"none",border:"none",color:P.redLight,fontSize:"10px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,padding:"2px"}}>OK?</button>)
                  :(<button onClick={()=>setDeleteConfirm(sale.id)} onMouseLeave={()=>setDeleteConfirm(null)} style={{background:"none",border:"none",color:P.textGhost,fontSize:"13px",cursor:"pointer",padding:"2px",transition:"color 0.15s"}} onMouseEnter={e=>e.target.style.color=P.red}>×</button>)}
                </div>
              </div>
              {expandedSale===sale.id&&(<div style={{padding:"10px 12px 10px 30px",fontSize:"11px",color:P.textDim,background:P.altRow,borderRadius:"0 0 6px 6px",marginTop:"-2px",animation:"slideIn 0.2s ease",display:"flex",gap:"20px",flexWrap:"wrap"}}>
                <span><b style={{color:P.textMid}}>Product:</b> {sale.product}</span>
                <span><b style={{color:P.textMid}}>Date:</b> {new Date(sale.date).toLocaleString("en-US",{month:"short",day:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                <span><b style={{color:P.textMid}}>Status:</b> {sale.status==="completed"?"Paid ✓":"Pending ⏳"}</span>
                {sale.notes&&<span><b style={{color:P.textMid}}>Notes:</b> {sale.notes}</span>}
              </div>)}
            </div>))}
          </div>
        </div>

        <div style={{marginTop:"36px",textAlign:"center",fontSize:"9px",letterSpacing:"3px",color:P.textGhost,textTransform:"uppercase"}}>Private — {new Date().getFullYear()}</div>
      </div>
    </div>
  );
}
