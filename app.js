(() => {
  "use strict";
  const KEY = "step-by-step:v1";
  const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const ICONS = ["book","heart","leaf","brain","drop","pen","moon"];
  const THEMES = [
    {id:"amethyst",name:"Amethyst",description:"Soft & dreamy",bg:"#130722",one:"#5624a3",two:"#c07fff",color:"#b58cff"},
    {id:"lagoon",name:"Lagoon",description:"Fresh & clear",bg:"#041b24",one:"#087d8a",two:"#76f2df",color:"#70e4db"},
    {id:"dusk",name:"Dusk",description:"Warm & calm",bg:"#221022",one:"#ad367c",two:"#ffb19a",color:"#ffc0a9"},
    {id:"orbit",name:"Orbit",description:"Deep & focused",bg:"#07112b",one:"#283e97",two:"#a1b6ff",color:"#98b6ff"}
  ];
  const DEFAULT_HABITS = [
    {id:"starter-read",name:"Read a few pages",icon:"book",duration:5,days:[0,1,2,3,4,5,6],reminder:"",createdAt:today()},
    {id:"starter-stretch",name:"Move & stretch",icon:"heart",duration:5,days:[0,1,2,3,4,5,6],reminder:"",createdAt:today()},
    {id:"starter-breathe",name:"Take a mindful pause",icon:"leaf",duration:5,days:[0,1,2,3,4,5,6],reminder:"",createdAt:today()}
  ];
  const $ = (selector, parent=document) => parent.querySelector(selector);
  const $$ = (selector, parent=document) => [...parent.querySelectorAll(selector)];
  const ico = (name) => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fresh = () => ({version:1,habits:structuredClone(DEFAULT_HABITS),completions:[],theme:"amethyst",motion:true,nudged:{}});
  let state = load();
  let currentFilter="all", editingId=null, chosenIcon="book", chosenDuration=5, chosenDays=[0,1,2,3,4,5,6];
  let toastTimeout, growHabitId=null, timer=null, timerInterval=null, drawFrame=null;
  const STORAGE_AVAILABLE = (()=>{try{localStorage.setItem("__sbs_test","1");localStorage.removeItem("__sbs_test");return true}catch{return false}})();
  function today(d=new Date()){return dateKey(d)}
  function dateKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
  function fromKey(k){const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d,12)}
  function addDays(date,n){const d=new Date(date.getTime());d.setDate(d.getDate()+n);return d}
  function formatLong(d){return d.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}
  function isScheduled(h,d){return h.createdAt<=dateKey(d) && h.days.includes(d.getDay())}
  function hasDone(hId,k=today()){return state.completions.some(c=>c.habitId===hId&&c.date===k)}
  function schedule(d){return state.habits.filter(h=>isScheduled(h,d))}
  function completionsFor(k){return state.completions.filter(c=>c.date===k)}
  function countFor(hId){return state.completions.filter(c=>c.habitId===hId).length}
  function dateRange(n){const t=new Date();return Array.from({length:n},(_,i)=>addDays(t,i-(n-1)))}
  function load(){
    try {
      const raw=localStorage.getItem(KEY);
      if(!raw)return fresh();
      const parsed=JSON.parse(raw);
      if(!parsed || !Array.isArray(parsed.habits)||!Array.isArray(parsed.completions))return fresh();
      return sanitize(parsed);
    } catch{return fresh()}
  }
  function sanitize(data){
    const habits=data.habits.slice(0,200).filter(h=>h&&typeof h.name==="string").map(h=>({
      id:String(h.id||id()).slice(0,80),name:h.name.trim().slice(0,60)||"My step",
      icon:ICONS.includes(h.icon)?h.icon:"leaf",
      duration:Math.max(1,Math.min(180,Number(h.duration)||5)),
      days:[...new Set((Array.isArray(h.days)?h.days:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))],
      reminder: /^\d{2}:\d{2}$/.test(h.reminder||"")?h.reminder:"",
      createdAt:/^\d{4}-\d{2}-\d{2}$/.test(h.createdAt||"")?h.createdAt:today()
    }));
    const validIds=new Set(habits.map(h=>h.id));
    const completions=data.completions.slice(0,30000).filter(c=>c&&validIds.has(String(c.habitId))&&/^\d{4}-\d{2}-\d{2}$/.test(c.date||"")).map(c=>({
      habitId:String(c.habitId),date:c.date,minutes:Math.max(1,Math.min(180,Number(c.minutes)||5)),at:String(c.at||"")
    }));
    // Exactly one completion per habit per day.
    const unique=new Map(completions.map(c=>[c.habitId+":"+c.date,c]));
    return {version:1,habits,completions:[...unique.values()],
      theme:THEMES.some(t=>t.id===data.theme)?data.theme:"amethyst",
      motion:data.motion!==false,nudged:(data.nudged&&typeof data.nudged==="object"&&!Array.isArray(data.nudged))?data.nudged:{}};
  }
  function save(){
    if(STORAGE_AVAILABLE){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{toast("Storage full. Export a backup before making more changes.")}}
    render();
  }
  function id(){return "step-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)}
  function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove("show"),3700)}
  function applyTheme(){
    document.documentElement.dataset.theme=state.theme;
    document.documentElement.style.setProperty("--growth-energy",Math.min(1,completionsFor(today()).length/Math.max(1,schedule(new Date()).length)));
    document.body.classList.toggle("no-motion",!state.motion || matchMedia("(prefers-reduced-motion: reduce)").matches);
    const meta=$('meta[name="theme-color"]');const t=THEMES.find(t=>t.id===state.theme)||THEMES[0];meta.content=t.bg;
    const ratio=Math.min(1,completionsFor(today()).length/Math.max(schedule(new Date()).length,1));
    $$(".world-haze").forEach((el,i)=>el.style.opacity=String((i===2?.11:.16)+ratio*.15));
    if(crystalRenderer)crystalRenderer.theme=state.theme;
  }
  function setTheme(theme){state.theme=theme;save();toast(THEMES.find(t=>t.id===theme)?.name+" theme selected")}
  function render(){
    applyTheme();
    const now=new Date(), day=today(), eligible=schedule(now), done=eligible.filter(h=>hasDone(h.id));
    const progress=eligible.length?Math.round(100*done.length/eligible.length):0;
    $("#hero-done").textContent=done.length;$("#hero-total").textContent=eligible.length;
    $("#hero-pct").textContent=progress+"% complete";$("#side-percent").textContent=progress+"%";
    $("#hero-fill").style.width=progress+"%";$("#side-progress").style.width=progress+"%";
    $("#hero-weekday").textContent=now.toLocaleDateString(undefined,{weekday:"long"});
    $("#header-date").textContent=now.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
    $("#greeting").textContent=now.getHours()<12?"GOOD MORNING, FUTURE YOU":now.getHours()<17?"A MOMENT TO GROW":"YOU SHOWED UP TODAY";
    $("#progress-message").textContent=eligible.length===0?"Make a little step to begin your journey.":progress===100?"You did it. Every little step counts.":progress>0?"Keep going. You're building something beautiful.":"Every journey starts with one little step.";
    $("#stat-streak").textContent=currentStreak();$("#stat-completions").textContent=state.completions.length;
    $("#stat-minutes").textContent=totalMinutes();$("#habit-count").textContent="("+eligible.length+")";
    $("#crystal-stage-label").textContent=crystalLabel();
    renderHabits();renderJourney();renderInsights();renderThemes();
    $("#motion-toggle").checked=state.motion;
    if(crystalRenderer)crystalRenderer.updateState();
  }
  function renderHabits(){
    const eligible=schedule(new Date());
    const visible=eligible.filter(h=>currentFilter==="all"||(currentFilter==="done"?hasDone(h.id):!hasDone(h.id)));
    $("#habit-list").innerHTML=visible.length?visible.map(h=>{
      const completed=hasDone(h.id);
      return '<article class="habit-card '+(completed?"completed":"")+'"><div class="habit-icon">'+ico(h.icon)+'</div>'+
        '<div class="habit-content"><div class="habit-title">'+escapeHtml(h.name)+'</div>'+
        '<div class="habit-meta"><span>'+ico("clock")+h.duration+' min</span><span>'+ico("flame")+habitStreak(h.id)+' day streak</span></div></div>'+
        '<div class="habit-actions"><button class="habit-button" data-edit="'+escapeHtml(h.id)+'" aria-label="Edit '+escapeHtml(h.name)+'" title="Edit habit">'+ico("edit")+'</button>'+
        (!completed?'<button class="habit-button play" data-timer="'+escapeHtml(h.id)+'" aria-label="Start '+escapeHtml(h.name)+' timer">'+ico("play")+' Focus</button>':'')+
        '<button class="habit-button complete '+(completed?"is-done":"")+'" data-complete="'+escapeHtml(h.id)+'" aria-label="'+(completed?"Undo ":"Complete ")+escapeHtml(h.name)+'" aria-pressed="'+completed+'">'+ico("check")+'</button></div></article>';
    }).join(""):'<div class="empty-state">'+(eligible.length===0?"No habits scheduled for today. Add a small step to get started.":currentFilter==="done"?"No completed steps yet. The next one is yours.":"All done for now. Take a moment to celebrate.")+'</div>';
  }
  function streakCount(predicate){
    let d=new Date(),days=0;
    if(!predicate(dateKey(d)))d=addDays(d,-1);
    for(let n=0;n<3660;n++,d=addDays(d,-1)){if(!predicate(dateKey(d)))break;days++}
    return days;
  }
  function currentStreak(){return streakCount(k=>state.completions.some(c=>c.date===k))}
  function habitStreak(hId){return streakCount(k=>hasDone(hId,k))}
  function bestStreak(){
    const dates=[...new Set(state.completions.map(c=>c.date))].sort();
    let best=0,run=0,prev=null;
    dates.forEach(k=>{run=prev&&dateKey(addDays(fromKey(prev),1))===k?run+1:1;best=Math.max(best,run);prev=k});
    return best;
  }
  function totalMinutes(){return state.completions.reduce((sum,c)=>sum+c.minutes,0)}
  function crystalLabel(){const n=state.completions.length;return (n<5?"SEED":n<15?"BLOOM":n<30?"RADIANT":"LUMINOUS")+" · LEVEL "+(Math.floor(n/5)+1)}
  function toggleComplete(id){
    const h=state.habits.find(h=>h.id===id);if(!h)return;
    const d=today(),idx=state.completions.findIndex(c=>c.habitId===id&&c.date===d);
    if(idx!==-1){state.completions.splice(idx,1);toast("Step unchecked. Your progress is still yours.")}
    else{state.completions.push({habitId:id,date:d,minutes:h.duration,at:new Date().toISOString()});toast("One more little victory. Keep going.");crystalRenderer?.pulse();setTimeout(()=>maybeNudge(id),450)}
    save();
  }
  function maybeNudge(id){
    const h=state.habits.find(h=>h.id===id);if(!h)return;
    const n=countFor(id),threshold=Math.floor(n/5);
    if(n>0&&n%5===0&&threshold>Number(state.nudged[id]||0)){
      growHabitId=id;$("#grow-message").textContent="You've completed “"+h.name+"” "+n+" times. Want to grow from "+h.duration+" to "+(h.duration+5)+" minutes?";$("#grow-dialog").showModal();
    }
  }
  function finishNudge(increase){
    if(growHabitId){const h=state.habits.find(h=>h.id===growHabitId);if(h){state.nudged[h.id]=Math.floor(countFor(h.id)/5);if(increase){h.duration=Math.min(180,h.duration+5);toast("A new little challenge: "+h.duration+" minutes.")}else toast("A gentle pace is still progress.");save()}}
    growHabitId=null;$("#grow-dialog").close();
  }
  function renderJourney(){
    const streak=currentStreak();$("#journey-streak").textContent=streak;
    $("#journey-headline").textContent=streak>7?"You're building a beautiful rhythm.":streak>0?"You're showing up for yourself.":"One day at a time.";
    $("#journey-subtitle").textContent=streak>0?"You've taken a step "+streak+" day"+(streak===1?"":"s")+" in a row.":"One small action is all it takes to begin.";
    $("#week-strip").innerHTML=dateRange(7).map(d=>{
      const key=dateKey(d),eligible=schedule(d).length,done=completionsFor(key).length;
      return '<div class="day-cell '+(key===today()?"today":"")+'"><div class="day-name">'+WEEKDAYS[d.getDay()]+'</div><div class="day-score">'+(done&&eligible&&done>=eligible?ico("check"):done)+'</div><div class="day-date">'+d.getDate()+'</div></div>';
    }).join("");
    $("#journey-habits").innerHTML=state.habits.length?state.habits.map(h=>
      '<div class="journey-row"><div class="habit-icon">'+ico(h.icon)+'</div><div class="journey-name">'+escapeHtml(h.name)+'</div><div class="journey-dots" aria-label="Past week completions">'+dateRange(7).map(d=>'<span class="'+(hasDone(h.id,dateKey(d))?"filled":"")+'" title="'+formatLong(d)+'"></span>').join("")+'</div></div>'
    ).join(""):'<div class="empty-state">Add a habit to begin your journey.</div>';
  }
  function renderInsights(){
    $("#insight-completions").textContent=state.completions.length;const mins=totalMinutes();
    $("#insight-time").textContent=mins<60?mins+"m":(Math.round(mins/6)/10)+"h";$("#insight-streak").textContent=bestStreak();
    const week=dateRange(7);const max=Math.max(1,...week.map(d=>completionsFor(dateKey(d)).length));
    $("#weekly-chart").innerHTML=week.map(d=>{
      const n=completionsFor(dateKey(d)).length;
      return '<div class="chart-column '+(dateKey(d)===today()?"today":"")+'"><span class="chart-value">'+n+'</span><div class="chart-bar" style="height:'+Math.max(4,Math.round(165*n/max))+'px"></div><span class="chart-label">'+WEEKDAYS[d.getDay()]+'</span></div>';
    }).join("");
    const ordered=[...state.habits].sort((a,b)=>countFor(b.id)-countFor(a.id));
    $("#insight-habits").innerHTML=ordered.length?ordered.map(h=>'<div class="insight-row"><div class="habit-icon">'+ico(h.icon)+'</div><span class="insight-label">'+escapeHtml(h.name)+'</span><span class="insight-result">'+countFor(h.id)+' completions</span></div>').join(""):'<div class="empty-state">Your habits will appear here.</div>';
  }
  function renderThemes(){
    $("#theme-options").innerHTML=THEMES.map(t=>'<button class="theme-choice '+(state.theme===t.id?"selected":"")+'" type="button" data-theme-id="'+t.id+'" aria-pressed="'+(state.theme===t.id)+'"><span class="theme-preview" style="--preview-bg:'+t.bg+';--preview-one:'+t.one+';--preview-two:'+t.two+'"></span><strong>'+t.name+'</strong><small>'+t.description+'</small><span class="selected-check">'+ico("check")+'</span></button>').join("");
  }
  function route(name){
    if(!["today","journey","insights","settings"].includes(name))name="today";
    $$(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+name));
    $$("[data-route]").forEach(b=>{b.classList.toggle("active",b.dataset.route===name);if(b.dataset.route===name)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
    $("#breadcrumb").textContent=({today:"Your today",journey:"Your journey",insights:"Your insights",settings:"Your space"})[name];
    window.scrollTo({top:0,behavior:state.motion?"smooth":"instant"});
  }
  function openHabit(id=null){
    editingId=id;
    const h=state.habits.find(h=>h.id===id);
    chosenIcon=h?.icon||"book";chosenDuration=h?.duration||5;chosenDays=h?[...h.days]:[0,1,2,3,4,5,6];
    $("#habit-name").value=h?.name||"";$("#habit-reminder").value=h?.reminder||"";
    $("#habit-dialog-caption").textContent=h?"THE ART OF ADJUSTING":"A NEW BEGINNING";
    $("#habit-dialog-title").textContent=h?"Edit your step":"Add a little step";$("#delete-habit").hidden=!h;
    renderEditChoices();$("#habit-dialog").showModal();$("#habit-name").focus();
  }
  function renderEditChoices(){
    $("#icon-choices").innerHTML=ICONS.map(name=>'<button class="icon-choice '+(chosenIcon===name?"selected":"")+'" type="button" data-icon="'+name+'" aria-label="'+name+'" aria-pressed="'+(chosenIcon===name)+'">'+ico(name)+'</button>').join("");
    $$("[data-duration]").forEach(btn=>btn.classList.toggle("active",Number(btn.dataset.duration)===chosenDuration));
    $("#day-choices").innerHTML=WEEKDAYS.map((day,n)=>'<button class="day-choice '+(chosenDays.includes(n)?"selected":"")+'" data-day="'+n+'" type="button" aria-pressed="'+chosenDays.includes(n)+'">'+day.slice(0,2)+'</button>').join("");
  }
  function submitHabit(){
    const name=$("#habit-name").value.trim().replace(/\s+/g," ").slice(0,60);
    if(!name){toast("Give your habit a short name.");$("#habit-name").focus();return}
    if(chosenDays.length===0){toast("Choose at least one day.");return}
    const reminder=$("#habit-reminder").value;
    if(editingId){
      const h=state.habits.find(h=>h.id===editingId);if(!h)return;
      Object.assign(h,{name,icon:chosenIcon,duration:chosenDuration,days:[...chosenDays],reminder});toast("Your step has been updated.");
    } else {
      state.habits.push({id:id(),name,icon:chosenIcon,duration:chosenDuration,days:[...chosenDays],reminder,createdAt:today()});toast("A new little step has begun.");
    }
    $("#habit-dialog").close();save();
  }
  function deleteHabit(){
    const h=state.habits.find(h=>h.id===editingId);if(!h)return;
    if(!confirm('Delete “'+h.name+'” and its saved history? This cannot be undone.'))return;
    state.habits=state.habits.filter(x=>x.id!==editingId);state.completions=state.completions.filter(c=>c.habitId!==editingId);delete state.nudged[editingId];
    $("#habit-dialog").close();save();toast("Habit deleted.");
  }
  function startTimer(id){
    const h=state.habits.find(h=>h.id===id);if(!h)return;
    clearInterval(timerInterval);timer={id,duration:h.duration*60,remaining:h.duration*60,running:false,until:0};
    $("#timer-habit").textContent=h.name;$("#timer-dialog").showModal();renderTimer();
  }
  function renderTimer(){
    if(!timer)return;
    const seconds=Math.max(0,Math.ceil(timer.remaining)),m=String(Math.floor(seconds/60)).padStart(2,"0"),s=String(seconds%60).padStart(2,"0");
    $("#timer-clock").textContent=m+":"+s;
    $("#timer-arc").style.strokeDashoffset=String(553*(1-timer.remaining/timer.duration));
    $("#timer-play").innerHTML=ico(timer.running?"pause":"play")+(timer.running?" Pause":timer.remaining<timer.duration?" Resume":" Start");
  }
  function toggleTimer(){
    if(!timer)return;
    if(timer.running){timer.remaining=Math.max(0,(timer.until-Date.now())/1000);timer.running=false;clearInterval(timerInterval)}
    else{timer.running=true;timer.until=Date.now()+timer.remaining*1000;timerInterval=setInterval(()=>{
      if(!timer||!timer.running)return;
      timer.remaining=Math.max(0,(timer.until-Date.now())/1000);renderTimer();
      if(timer.remaining<=0){const id=timer.id;closeTimer();if(!hasDone(id))toggleComplete(id);else toast("Focus session complete. Nicely done.")}
    },200)}
    renderTimer();
  }
  function closeTimer(){clearInterval(timerInterval);timer=null;$("#timer-dialog").close()}
  function finishTimer(){if(!timer)return;const id=timer.id;closeTimer();if(!hasDone(id))toggleComplete(id);else toast("You've already completed today's step.")}
  function exportBackup(){
    const backup=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(backup),a=document.createElement("a");a.href=url;a.download="step-by-step-backup-"+today()+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    toast("Backup downloaded. Keep it somewhere safe.");
  }
  async function importBackup(file){
    if(!file)return;
    try {
      if(file.size>5_000_000)throw Error("Backup file is too large.");
      const data=JSON.parse(await file.text());
      if(!data||!Array.isArray(data.habits)||!Array.isArray(data.completions))throw Error("This isn't a Step by Step backup.");
      if(!confirm("Replace all current habits and progress with this backup?"))return;
      state=sanitize(data);save();toast("Your backup was restored.");
    }catch(error){toast(error.message||"Could not import this backup.")}finally{$("#import-file").value=""}
  }
  function resetAll(){
    if(!confirm("Erase all habits and progress stored in this browser? This cannot be undone."))return;
    state={...fresh(),habits:[],theme:state.theme,motion:state.motion};save();toast("Your space has been reset.");
  }
  const notified=new Set();
  function checkReminders(){
    if(!("Notification" in window)||Notification.permission!=="granted")return;
    const now=new Date(),hhmm=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    schedule(now).forEach(h=>{
      const key=h.id+":"+today();
      if(h.reminder===hhmm&&!hasDone(h.id)&&!notified.has(key)){
        notified.add(key);new Notification("Your little step awaits",{body:h.name+" · "+h.duration+" minutes",icon:"./assets/logo.svg"});
      }
    });
  }
  // Procedural 3D crystal: mesh vertices, perspective camera, shaded facets, true pointer-driven rotation.
  const crystalRenderer=(()=>{
    const canvas=$("#crystal");if(!canvas)return null;
    const ctx=canvas.getContext("2d");if(!ctx)return null;
    const V=[],F=[],SIDES=8,TAU=Math.PI*2;
    V.push([0,1.18,0]); // top point
    for(let i=0;i<SIDES;i++){const a=TAU*i/SIDES;V.push([.82*Math.cos(a),.48,.82*Math.sin(a)])}
    for(let i=0;i<SIDES;i++){const a=TAU*i/SIDES;V.push([.66*Math.cos(a),-.49,.66*Math.sin(a)])}
    V.push([0,-1.25,0]); // bottom point
    for(let i=0;i<SIDES;i++){let j=(i+1)%SIDES;F.push([0,i+1,j+1]);F.push([i+1,SIDES+i+1,SIDES+j+1,j+1]);F.push([SIDES+i+1,V.length-1,SIDES+j+1])}
    let yaw=-.38,pitch=-.1,drag=false,moved=false,pointerX=0,pointerY=0,downX=0,downY=0,lastTime=0,pulseAt=0,level=0,theme=state.theme;
    const normalize=v=>{let m=Math.hypot(...v)||1;return v.map(n=>n/m)};
    function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
    function transform(p,spin){
      const sy=Math.sin(yaw+spin),cy=Math.cos(yaw+spin),sx=Math.sin(pitch),cx=Math.cos(pitch);
      const x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy;
      return [x,p[1]*cx-z*sx,p[1]*sx+z*cx]
    }
    function project(p,w,h){const scale=Math.min(w*.265,h*.29),pers=4.5/(4.5-p[2]*.34);return [w*.5+p[0]*scale*pers,h*.50-p[1]*scale*pers,p[2]]}
    function mix(a,b,t){return a.map((n,i)=>Math.round(n*(1-t)+b[i]*t))}
    function rgb(v,a=1){return 'rgba('+v.join(',')+','+a+')'}
    const palette={amethyst:[[175,116,255],[242,172,255],[108,53,215]],lagoon:[[52,204,217],[159,255,229],[21,119,154]],dusk:[[255,147,165],[255,213,162],[170,83,151]],orbit:[[112,152,255],[202,217,255],[60,94,185]]};
    function paint(now){
      if(!canvas.isConnected)return;
      const r=canvas.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h){drawFrame=requestAnimationFrame(paint);return}
      const dpr=Math.min(2,devicePixelRatio||1),dw=Math.round(w*dpr),dh=Math.round(h*dpr);
      if(canvas.width!==dw||canvas.height!==dh){canvas.width=dw;canvas.height=dh}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      const colors=palette[theme]||palette.amethyst;
      const reduced= !state.motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
      const spin=reduced?0:Math.sin(now*.00032)*.16;
      const completed=state.completions.length;level=Math.min(15,Math.floor(completed/5));
      const glow=Math.max(0,1-(now-pulseAt)/820);
      const radial=ctx.createRadialGradient(w/2,h*.51,8,w/2,h*.51,w*.4);
      radial.addColorStop(0,rgb(colors[0],.19+glow*.16));radial.addColorStop(1,rgb(colors[0],0));
      ctx.fillStyle=radial;ctx.fillRect(0,0,w,h);
      const points=V.map(v=>transform(v,spin)),screen=points.map(p=>project(p,w,h));
      const faces=F.map((ids,index)=>{
        const a=points[ids[0]],b=points[ids[1]],c=points[ids[2]];
        const norm=normalize(cross(b.map((n,i)=>n-a[i]),c.map((n,i)=>n-a[i])));
        const light=norm[0]*-.34+norm[1]*.54+norm[2]*.79;
        return {ids,index,depth:ids.reduce((sum,i)=>sum+points[i][2],0)/ids.length,light};
      }).sort((a,b)=>a.depth-b.depth);
      ctx.save();ctx.shadowColor=rgb(colors[0],.7);ctx.shadowBlur=18+glow*32;
      faces.forEach(f=>{
        const pts=f.ids.map(i=>screen[i]),brightness=Math.max(0,Math.min(1,(f.light+1)/2));
        const tint=mix(colors[2],colors[0],.15+brightness*.65);
        ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
        const gradient=ctx.createLinearGradient(pts[0][0],pts[0][1],pts[2][0],pts[2][1]);
        gradient.addColorStop(0,rgb(mix(tint,colors[1],.3),.79));
        gradient.addColorStop(1,rgb(tint,.86));
        ctx.fillStyle=gradient;ctx.fill();
        ctx.strokeStyle=rgb(colors[1],.17+brightness*.23+glow*.22);ctx.lineWidth=.85;ctx.stroke();
      });
      ctx.restore();
      // Facet seams are real projected edges, and shards orbit the mesh as it grows.
      ctx.save();ctx.globalCompositeOperation="screen";
      ctx.strokeStyle=rgb(colors[1],.23+glow*.2);ctx.lineWidth=.7;
      [[0,1],[0,3],[0,6],[9,17],[11,17],[14,17]].forEach(pair=>{const a=screen[pair[0]],b=screen[pair[1]];ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()});
      const shards=Math.min(12,Math.floor(completed/3));
      for(let i=0;i<shards;i++){
        const a=i*2.399+(reduced?0:now*.00013),rad=1.22+(i%3)*.15;
        const point=project(transform([rad*Math.cos(a),-.27+Math.sin(i*3.5)*.65,rad*Math.sin(a)],spin),w,h);
        const s=2.2+(i%3)*1.5;
        ctx.fillStyle=rgb(colors[1],.26+(i%3)*.1);ctx.beginPath();ctx.moveTo(point[0],point[1]-s*2);ctx.lineTo(point[0]+s,point[1]);ctx.lineTo(point[0],point[1]+s*2);ctx.lineTo(point[0]-s,point[1]);ctx.closePath();ctx.fill();
      }
      ctx.restore();
      lastTime=now;drawFrame=requestAnimationFrame(paint);
    }
    canvas.addEventListener("pointerdown",e=>{drag=true;moved=false;pointerX=downX=e.clientX;pointerY=downY=e.clientY;canvas.setPointerCapture(e.pointerId)});
    canvas.addEventListener("pointermove",e=>{if(!drag)return;let dx=e.clientX-pointerX,dy=e.clientY-pointerY;if(Math.hypot(e.clientX-downX,e.clientY-downY)>5)moved=true;yaw+=dx*.013;pitch=Math.max(-1.2,Math.min(1.2,pitch+dy*.008));pointerX=e.clientX;pointerY=e.clientY});
    canvas.addEventListener("pointerup",e=>{if(!moved)pulseAt=performance.now();drag=false;try{canvas.releasePointerCapture(e.pointerId)}catch{}});
    canvas.addEventListener("pointercancel",()=>drag=false);
    canvas.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pulseAt=performance.now()}else if(e.key==="ArrowLeft"){yaw-=.15;e.preventDefault()}else if(e.key==="ArrowRight"){yaw+=.15;e.preventDefault()}});
    drawFrame=requestAnimationFrame(paint);
    return {get theme(){return theme},set theme(v){theme=v},pulse(){pulseAt=performance.now()},reset(){yaw=-.38;pitch=-.1;pulseAt=performance.now()},updateState(){level=Math.min(15,Math.floor(state.completions.length/5))}};
  })();
  // Delegated interactions keep re-rendered controls responsive.
  document.addEventListener("click",(e)=>{
    const target=e.target.closest("button");if(!target)return;
    if(target.hasAttribute("data-route")){const name=target.dataset.route;location.hash=name;route(name)}
    if(target.hasAttribute("data-add-habit"))openHabit();
    if(target.hasAttribute("data-edit"))openHabit(target.dataset.edit);
    if(target.hasAttribute("data-complete"))toggleComplete(target.dataset.complete);
    if(target.hasAttribute("data-timer"))startTimer(target.dataset.timer);
    if(target.hasAttribute("data-filter")){currentFilter=target.dataset.filter;$$("[data-filter]").forEach(b=>b.classList.toggle("active",b===target));renderHabits()}
    if(target.hasAttribute("data-close-dialog"))$("#habit-dialog").close();
    if(target.hasAttribute("data-icon")){chosenIcon=target.dataset.icon;renderEditChoices()}
    if(target.hasAttribute("data-duration")){chosenDuration=Number(target.dataset.duration);renderEditChoices()}
    if(target.hasAttribute("data-day")){const day=Number(target.dataset.day);chosenDays=chosenDays.includes(day)?chosenDays.filter(n=>n!==day):[...chosenDays,day].sort();renderEditChoices()}
    if(target.hasAttribute("data-theme-id"))setTheme(target.dataset.themeId);
  });
  $("#habit-form").addEventListener("submit",e=>{e.preventDefault();submitHabit()});
  $("#delete-habit").addEventListener("click",deleteHabit);
  $("#reset-crystal").addEventListener("click",()=>crystalRenderer?.reset());
  $("#top-theme").addEventListener("click",()=>{const i=THEMES.findIndex(t=>t.id===state.theme);setTheme(THEMES[(i+1)%THEMES.length].id)});
  $("#motion-toggle").addEventListener("change",e=>{state.motion=e.target.checked;save()});
  $("#export-data").addEventListener("click",exportBackup);
  $("#import-data").addEventListener("click",()=>$("#import-file").click());
  $("#import-file").addEventListener("change",e=>importBackup(e.target.files[0]));
  $("#reset-data").addEventListener("click",resetAll);
  $("#enable-notifications").addEventListener("click",async()=>{
    if(!("Notification" in window)){toast("Notifications aren't supported in this browser.");return}
    try{const p=await Notification.requestPermission();toast(p==="granted"?"Notifications enabled while the app is open.":"Notifications weren't enabled.");updateNotificationStatus()}catch{toast("Could not request notification permission.")}
  });
  function updateNotificationStatus(){$("#notification-status").textContent=("Notification" in window)?"Permission: "+Notification.permission:"Notifications unavailable in this browser."}
  $("#timer-play").addEventListener("click",toggleTimer);$("#timer-finish").addEventListener("click",finishTimer);$("#close-timer").addEventListener("click",closeTimer);
  $("#timer-dialog").addEventListener("close",()=>{clearInterval(timerInterval);timer=null});
  $("#grow-keep").addEventListener("click",()=>finishNudge(false));$("#grow-increase").addEventListener("click",()=>finishNudge(true));$("#close-grow").addEventListener("click",()=>finishNudge(false));
  $("#grow-dialog").addEventListener("cancel",e=>{e.preventDefault();finishNudge(false)});
  for(const dialog of [$("#habit-dialog"),$("#timer-dialog"),$("#grow-dialog")])dialog.addEventListener("click",e=>{if(e.target===dialog){if(dialog===$("#timer-dialog"))closeTimer();else if(dialog===$("#grow-dialog"))finishNudge(false);else dialog.close()}});
  window.addEventListener("hashchange",()=>route(location.hash.slice(1)));
  window.addEventListener("storage",e=>{if(e.key===KEY){state=load();render()}});
  setInterval(()=>{checkReminders();if($("#header-date").textContent!==new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}))render()},30000);
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
  updateNotificationStatus();render();route(location.hash.slice(1)||"today");
})();