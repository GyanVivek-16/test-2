(function(){
  const grid = document.getElementById('twinsGrid');
  const modal = document.getElementById('twinModal');
  const btnClose = document.getElementById('modalClose');
  const titleEl = document.getElementById('modalTitle');
  const statusEl = document.getElementById('modalStatus');
  const tempVal = document.getElementById('modalTempVal');
  const presVal = document.getElementById('modalPresVal');
  const perfVal = document.getElementById('modalPerfVal');
  const tempCanvas = document.getElementById('modalTempChart');
  const presCanvas = document.getElementById('modalPresChart');
  const perfCanvas = document.getElementById('modalPerfChart');
  const alertsWrap = document.getElementById('modalAlerts');

  let openTwinId = null;
  let pollTimer = null;
  let lastSeries = {temp:[], pres:[], perf:[]};

  function axes(ctx, w, h, pad){
    ctx.globalAlpha = .35;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#7b8aa0';
    ctx.beginPath();
    ctx.moveTo(pad, h-pad);
    ctx.lineTo(w-pad, h-pad);
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h-pad);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function animateLine(canvas, fromSeries, toSeries, durationMs, color){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const pad = 28;

    const n = Math.max(fromSeries.length, toSeries.length);
    const a = new Array(n).fill(0).map((_,i)=> fromSeries[i] ?? (fromSeries[fromSeries.length-1] ?? 0));
    const b = new Array(n).fill(0).map((_,i)=> toSeries[i] ?? (toSeries[toSeries.length-1] ?? 0));

    const min = Math.min(Math.min(...a), Math.min(...b));
    const max = Math.max(Math.max(...a), Math.max(...b));
    const rng = (max-min)||1;

    const start = performance.now();

    function frame(now){
      const t = Math.min(1, (now-start)/durationMs);
      const u = 0.5 - Math.cos(Math.PI * t)/2; // ease

      ctx.clearRect(0,0,w,h);
      axes(ctx, w, h, pad);

      ctx.strokeStyle = color || '#00c8ff';
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      for(let i=0;i<n;i++){
        const v = a[i] + (b[i]-a[i])*u;
        const x = pad + (i*(w-2*pad)/(n-1));
        const y = h-pad - ((v-min)*(h-2*pad)/rng);
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();

      if(t<1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function drawSeries(canvas, series, color, dashed){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const pad = 28;
    if(series.length < 2) return;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const rng = (max-min)||1;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.25;
    if(dashed) ctx.setLineDash([6,6]);
    ctx.beginPath();
    for(let i=0;i<series.length;i++){
      const x = pad + (i*(w-2*pad)/(series.length-1));
      const y = h-pad - ((series[i]-min)*(h-2*pad)/rng);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.restore();
  }

  async function fetchTwin(id){
    const resp = await fetch('/api/data');
    const all = await resp.json();
    return all.find(t => String(t.id) === String(id));
  }

  async function fetchPredict(id){
    const resp = await fetch(`/api/predict/${id}`);
    return await resp.json();
  }

  function renderAlerts(alerts){
    alertsWrap.innerHTML = '';
    if(!alerts || alerts.length===0){
      const ok = document.createElement('div');
      ok.className = 'alert-badge ok';
      ok.textContent = 'No predicted anomalies';
      alertsWrap.appendChild(ok);
      return;
    }
    alerts.forEach(a => {
      const el = document.createElement('div');
      el.className = 'alert-badge';
      el.textContent = `⚠ ${a.metric.toUpperCase()} ${a.type}: ${a.value} — ${a.message}`;
      alertsWrap.appendChild(el);
    });
  }

  async function updateModal(){
    if(!openTwinId) return;
    const twin = await fetchTwin(openTwinId);
    if(!twin) return;
    titleEl.textContent = `${twin.name} (ID: ${twin.id})`;
    statusEl.textContent = twin.active ? 'ACTIVE' : 'INACTIVE';
    tempVal.textContent = twin.temperature + ' °C';
    presVal.textContent = twin.pressure + ' bar';
    perfVal.textContent = twin.performance + ' %';

    const nextTemp = twin.history.temperature || [];
    const nextPres = twin.history.pressure || [];
    const nextPerf = twin.history.performance || [];

    // Animate history
    animateLine(tempCanvas, lastSeries.temp, nextTemp, 450, '#00c8ff');
    animateLine(presCanvas, lastSeries.pres, nextPres, 450, '#00c8ff');
    animateLine(perfCanvas, lastSeries.perf, nextPerf, 450, '#00c8ff');

    lastSeries = {temp: nextTemp.slice(), pres: nextPres.slice(), perf: nextPerf.slice()};

    // Delay a bit so forecast draws over the animated history
    setTimeout(async ()=>{
      const pred = await fetchPredict(openTwinId);
      drawSeries(tempCanvas, pred.predictions.temperature, '#ffe066', true);
      drawSeries(presCanvas, pred.predictions.pressure, '#ffe066', true);
      drawSeries(perfCanvas, pred.predictions.performance, '#ffe066', true);
      renderAlerts(pred.alerts);
    }, 520);
  }

  function openModalForTwin(id){
    openTwinId = String(id);
    lastSeries = {temp:[], pres:[], perf:[]};
    modal.classList.remove('hidden');
    updateModal();
    clearInterval(pollTimer);
    pollTimer = setInterval(updateModal, 5000);
  }

  function closeModal(){
    modal.classList.add('hidden');
    openTwinId = null;
    clearInterval(pollTimer);
  }

  grid.addEventListener('click', (e)=>{
    const card = e.target.closest('.twin-card');
    if(!card) return;
    const id = (card.id || '').split('twin-')[1];
    if(id) openModalForTwin(id);
  });
  btnClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModal(); });
})();