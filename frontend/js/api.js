/* api.js v4 */
const API_BASE = "https://priceradar-production.up.railway.app/api";

// Keep Railway awake — ping on load + every 9 mins
(function keepAlive() {
  const ping = () => fetch(`${API_BASE}/ping`).catch(()=>{});
  ping();
  setInterval(ping, 9 * 60 * 1000);
})();

// Mock data — only when backend unreachable
const MOCK = {
  _p: ["amazon","flipkart","myntra","meesho","croma","nykaa","snapdeal"],
  _b: {amazon:"AmazonBasics",flipkart:"MarQ",myntra:"Roadster",meesho:"DressBerry",croma:"Croma",nykaa:"Nykaa",snapdeal:"SnapFit"},
  _v: ["Pro","Plus","Ultra","Lite","Max","Elite"],
  name(q,p){ return `${this._b[p]||"Generic"} ${q.split(" ").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ")} ${this._v[Math.floor(Math.random()*6)]}`; },
  price(b){ return Math.round(b*(0.8+Math.random()*0.45)/10)*10; },
  search(query){
    const base=900+Math.floor(query.length*180+Math.random()*6000);
    const all=[]; const by_platform={};
    this._p.forEach(plat=>{
      by_platform[plat]=[];
      for(let i=0;i<4;i++){
        const mrp=this.price(base*1.3),price=this.price(base);
        const item={name:this.name(query,plat),price,mrp,
          discount:Math.max(0,Math.round(((mrp-price)/mrp)*100)),
          platform:plat[0].toUpperCase()+plat.slice(1),
          rating:(3.5+Math.random()*1.4).toFixed(1),url:"#",img:null};
        all.push(item); by_platform[plat].push(item);
      }
    });
    all.sort((a,b)=>a.price-b.price);
    return {all,by_platform};
  },
  compare(query){
    const base=900+Math.floor(query.length*180+Math.random()*6000);
    return {results:this._p.map(p=>({
      platform:p[0].toUpperCase()+p.slice(1),
      name:this.name(query,p),price:this.price(base),
      rating:(3.5+Math.random()*1.4).toFixed(1),url:"#"
    })).sort((a,b)=>a.price-b.price)};
  },
};

const API = {
  _demo: null,

  async _get(url, ms=22000){
    const c=new AbortController();
    const t=setTimeout(()=>c.abort(),ms);
    try{
      const r=await fetch(url,{signal:c.signal});
      clearTimeout(t);
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    }catch(e){clearTimeout(t);throw e;}
  },

  async search(query, platforms){
    const plats=(platforms||[]).join(",");
    try{
      const r=await this._get(`${API_BASE}/search?q=${encodeURIComponent(query)}&platforms=${plats}`);
      const data=await r.json();
      this._demo=false;
      return data;
    }catch{
      this._demo=true;
      await new Promise(r=>setTimeout(r,500));
      return MOCK.search(query);
    }
  },

  async compare(query){
    try{
      const r=await this._get(`${API_BASE}/compare?q=${encodeURIComponent(query)}`);
      return r.json();
    }catch{ return MOCK.compare(query); }
  },

  async health(){
    try{
      await this._get(`${API_BASE}/health`,5000);
      this._demo=false; return true;
    }catch{ this._demo=true; return false; }
  },

  isDemo(){ return this._demo===true; },
};
