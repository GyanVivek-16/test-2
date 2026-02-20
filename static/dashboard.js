//
// Fetch /api/data and render twin cards with gauges + sparkline
//
let twinCards = {};
const POLL_INTERVAL = 5000;

function arcGauge(canvas, pct){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const cx = w/2, cy = h/2+12;
  const r = Math.min(w,h)/2 - 10;
  ctx.lineWidth = 10;
  // background arc
  ctx.globalAlpha = .2;
  ctx.strokeStyle = '#8aa4b8';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // value arc
  ctx.strokeStyle = '#00c8ff';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI * (1 + pct));
  ctx.stroke();
}

function miniLine(canvas, series){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const pad = 10;
  const n = series.length;
  if(n<2) return;
  const min = Math.min(...series), max = Math.max(...series);
  const rng = (max-min)||1;
  ctx.globalAlpha = .25;
  ctx.strokeStyle = '#8aa4b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, h-pad);
  ctx.lineTo(w-pad, h-pad);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h-pad);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#00c8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const x = pad + (i*(w-2*pad)/(n-1));
    const y = h-pad - ((series[i]-min)*(h-2*pad)/rng);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

function createTwinCard(twin){
  const el = document.createElement('div');
  el.className = 'card twin-card';
  el.id = 'twin-'+twin.id;
  el.innerHTML = `
    <div class="title">
      <div><strong>${twin.name}</strong><div class="muted">ID: ${twin.id}</div></div>
      <div id="status-${twin.id}" class="status">${twin.active ? 'ACTIVE':'INACTIVE'}</div>
    </div>
    <div class="gauges">
      <div class="gauge"><canvas id="gauge-temp-${twin.id}" width="120" height="80"></canvas><div class="val" id="temp-val-${twin.id}">--</div></div>
      <div class="gauge"><canvas id="gauge-pres-${twin.id}" width="120" height="80"></canvas><div class="val" id="pres-val-${twin.id}">--</div></div>
      <div class="gauge"><canvas id="gauge-perf-${twin.id}" width="120" height="80"></canvas><div class="val" id="perf-val-${twin.id}">--</div></div>
    </div>
    <canvas id="mini-${twin.id}" class="mini-chart" width="360" height="56"></canvas>
  `;
  document.getElementById('twinsGrid').appendChild(el);
  twinCards[twin.id] = true;
  return el;
}

function updateTwinCard(twin){
  document.getElementById('status-'+twin.id).textContent = twin.active ? 'ACTIVE':'INACTIVE';
  document.getElementById('temp-val-'+twin.id).textContent = twin.temperature + ' °C';
  document.getElementById('pres-val-'+twin.id).textContent = twin.pressure + ' bar';
  document.getElementById('perf-val-'+twin.id).textContent = twin.performance + ' %';
  arcGauge(document.getElementById('gauge-temp-'+twin.id), Math.min(1, (twin.temperature-10)/30));
  arcGauge(document.getElementById('gauge-pres-'+twin.id), Math.min(1, (twin.pressure-0.9)/0.4));
  arcGauge(document.getElementById('gauge-perf-'+twin.id), twin.performance/100);
  miniLine(document.getElementById('mini-'+twin.id), twin.history.temperature);
}

async function fetchAndRender(){
  const resp = await fetch('/api/data');
  const data = await resp.json();
  data.forEach(t => {
    if(!twinCards[t.id]) createTwinCard(t);
    updateTwinCard(t);
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  fetchAndRender();
  setInterval(fetchAndRender, POLL_INTERVAL);
});