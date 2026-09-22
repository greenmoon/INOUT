(function(){
 'use strict';
 const $=id=>document.getElementById(id),M=window.InoutModel,store=new M.Store();
 const storageKey='inout-mqtt-dashboard-v01';
 let client=null,generation=0,cycle=0,online=false,subscribed=false,wanted=false,active=null,subTimer=null;
 let autoPending=true;
 let selected=M.DEFAULTS.id,timeout=M.DEFAULTS.stale,logs=[];
 let pingSent=0,pingReceived=0,connectedAt=0,connections=0,closes=0;
 const initialClock=Date.now(),initialMono=performance.now();
 const now=()=>Math.max(Date.now(),initialClock+performance.now()-initialMono);
 function log(message){logs.unshift(new Date().toLocaleTimeString()+'  '+message);logs=logs.slice(0,12);$('events').textContent=logs.join('\n');}
 function state(text,kind='idle'){$('brokerState').textContent=text;$('brokerState').dataset.state=kind;}
 function notice(text){$('notice').textContent=text;}
 function controls(){
  $('connect').disabled=wanted;$('disconnect').disabled=!wanted;
  $('applyConnect').textContent=wanted?'重新套用並連接':'套用並連接';
 }
 function remember(){
  try{
   if(!$('remember').checked){localStorage.removeItem(storageKey);return;}
   localStorage.setItem(storageKey,JSON.stringify({...M.settings({url:$('url').value,topic:$('topic').value,stale:$('stale').value}),id:selected}));
  }catch(_){/* Storage may be disabled in private/file mode. Connection remains available. */}
 }
 function sizeNumber(node){
  const text=String(node.textContent),w=node.clientWidth||250,h=node.clientHeight||150;
  node.style.fontSize=Math.max(12,Math.min(h*.85,w/(Math.max(2,text.length)*.64)))+'px';
 }
 function render(){
  const view=store.view(selected,now(),timeout,online&&subscribed&&!document.hidden),r=view.record;
  $('inValue').textContent=r?String(r.p.i):'—';$('outValue').textContent=r?String(r.p.o):'—';
  $('io').classList.toggle('stale',!view.fresh);
  $('rxLight').classList.toggle('on',view.fresh);$('activityLight').classList.toggle('on',view.activity);
  $('activityText').textContent=!view.fresh?'未知':r.p.e===1?'有活動':r.p.e===0?'無事件':'未知事件';
  $('freshness').textContent=!r?'等待資料':view.fresh?'收到有效資料':!online||!subscribed?'離線／未訂閱 · 舊值':'未更新／舊值';
  $('lastSeen').textContent=r?'最後有效收件 '+new Date(r.at).toLocaleString()+' · '+Math.floor(view.age/1000)+' 秒前':'最後收件 —';
  $('payload').textContent=r?JSON.stringify(r.p,null,2):'尚未收到有效資料';
  $('frame').textContent=r?'F '+r.p.f+' · S '+r.p.s+' · E '+r.p.e:'F — · S — · E —';
  $('total').textContent=String(store.total);$('valid').textContent=String(store.valid);$('rejected').textContent=String(store.rejected);
  $('ignored').textContent=store.retained+' / '+store.duplicates;
  $('transport').textContent='連線次數 '+connections+' / 中斷 '+closes+' · 本次連線 '+(online?Math.floor((now()-connectedAt)/1000):0)+' 秒 · PINGREQ '+pingSent+' / PINGRESP '+pingReceived;
  sizeNumber($('inValue'));sizeNumber($('outValue'));
 }
 function devices(){
  const ids=[...new Set([selected,M.DEFAULTS.id,...store.devices.keys()])];
  $('device').replaceChildren(...ids.map(id=>{const option=document.createElement('option');option.value=id;option.textContent=id;return option;}));
  $('device').value=selected;
 }
 function closeTransport(){
  generation++;cycle++;clearTimeout(subTimer);subTimer=null;
  online=false;subscribed=false;store.invalidate();
  const old=client;client=null;if(old)old.end(true);
 }
 function stop(text='已斷開',kind='idle'){
  autoPending=false;
  wanted=false;active=null;closeTransport();$('password').value='';state(text,kind);controls();render();
 }
 function start(config,reset){
  closeTransport();
  if(reset){store.reset();devices();}
  wanted=true;active=config;timeout=config.stale;controls();
  const session=generation;
  const random=new Uint8Array(6);crypto.getRandomValues(random);
  const clientId='inout-web-'+Array.from(random,x=>x.toString(16).padStart(2,'0')).join('');
  $('clientId').textContent='Client ID：'+clientId;
  $('route').textContent=new URL(config.url).host+' · '+config.topic;
  state('正在連線…');notice('只訂閱，不發布。正在等待 Broker CONNACK。');log('開始 WSS 連線');render();
  try{
   const c=window.mqtt.connect(config.url,{clientId,protocolVersion:4,clean:true,keepalive:30,
    // CSP disallows blob Workers; hidden pages explicitly disconnect.
    timerVariant:'native',
    connectTimeout:10000,reconnectPeriod:3000,resubscribe:false,manualConnect:true,
    ...(config.username?{username:config.username,password:config.password}:{})});
   client=c;
   const current=()=>client===c&&generation===session&&wanted;
   c.on('packetsend',packet=>{if(current()&&packet.cmd==='pingreq'){pingSent++;render();}});
   c.on('packetreceive',packet=>{if(current()&&packet.cmd==='pingresp'){pingReceived++;render();}});
   c.on('connect',()=>{
    if(current()){connections++;connectedAt=now();}
    if(!current())return;online=true;subscribed=false;store.invalidate();const attempt=++cycle;
    state('Broker 已連線 · 訂閱中');log('CONNACK 成功');render();
    clearTimeout(subTimer);subTimer=setTimeout(()=>{if(current()&&cycle===attempt){log('SUBACK 等待超時');stop('訂閱超時','error');notice('請檢查 topic／權限後重新連接。');}},10000);
    c.subscribe(config.topic,{qos:1},(error,granted)=>{
     if(!current()||cycle!==attempt||!online)return;
     clearTimeout(subTimer);subTimer=null;
     if(error||!Array.isArray(granted)||!granted.some(g=>g.topic===config.topic&&(g.qos===0||g.qos===1))){
      log('Broker 拒絕訂閱');stop('訂閱失敗','error');notice('請確認 MQTT 帳號的訂閱權限與 topic。');return;
     }
     subscribed=true;state('已訂閱 · '+config.topic,'ready');log('SUBACK 成功');notice('等待有效 f/s/i/o/e/id；若收件為 0，請核對 S3 /config 的 Router、MQTT 與 PUBACK。');render();
    });
   });
   c.on('message',(topic,payload,packet={})=>{
    if(!current()||!online||!subscribed)return;
    const result=payload.length>1024?store.receive(topic,'x'.repeat(1025),packet,config.topic,now()):store.receive(topic,payload.toString(),packet,config.topic,now());
    if(result.kind==='valid'){devices();notice('只顯示累積值；目前選定 '+selected+'。');}
    if(result.kind==='retained'){log('忽略 retained 舊訊息');notice('收到 retained 舊訊息，等待即時發布；不當作有效現場資料。');}
    if(result.kind==='rejected'){log('拒收：'+result.reason);notice('收到不符 INOUT 契約的訊息；詳見 RD。');}
    render();
   });
   c.on('close',()=>{if(!current())return;closes++;cycle++;clearTimeout(subTimer);online=false;subscribed=false;store.invalidate();state('連線中斷 · 等待重連','error');notice('檢查網路／Broker；舊值不代表目前資料。');log('WSS 已關閉');render();});
   c.on('reconnect',()=>{if(current()){state('正在重新連線…');log('重試 WSS');}});
   c.on('error',error=>{
    if(!current())return;
    // Do not echo exception text: libraries/proxies may include URL credentials.
    log('MQTT 連線錯誤');notice('可能為網路、憑證、帳密或 WebSocket 拒絕；瀏覽器不一定提供細節。');
    if(error.code===4||error.code===5){stop('Broker 拒絕登入','error');notice('請修正 MQTT 帳密後再連接。');}
   });
   c.connect();
  }catch(_){stop('無法建立 WSS 連線','error');notice('請確認瀏覽器支援 WebSocket，以及完整網頁資料夾已載入。');}
 }
 function connect(){
  autoPending=false;
  if(!window.mqtt){state('MQTT 程式庫未載入','error');notice('請保留 vendor 資料夾，不要只複製 HTML。');return;}
  try{
   const config=M.settings({url:$('url').value,topic:$('topic').value,stale:$('stale').value});
   config.username=$('username').value;config.password=$('password').value;
   if(config.password&&!config.username)throw Error('有密碼時請填 MQTT 使用者名稱');
   remember();start(config,true);
  }catch(e){notice(e.message);$('settings').open=true;}
 }
 $('connect').onclick=connect;
 $('configForm').onsubmit=event=>{event.preventDefault();connect();};
 $('disconnect').onclick=()=>{stop();notice('已手動斷開；不會自動重新連線。');log('使用者斷開');};
 $('device').onchange=()=>{selected=$('device').value;remember();render();};
 $('remember').onchange=remember;
 function mode(rd){$('app').dataset.mode=rd?'rd':'io';$('rd').hidden=!rd;$('io').hidden=rd;$('rdButton').setAttribute('aria-pressed',String(rd));$('ioButton').setAttribute('aria-pressed',String(!rd));render();}
 // Public, client-side convenience gate only. Not authentication or authorization.
 // Public counts are not secrets. Never use this gate to protect an API or MQTT permission.
 const rdDialog=$('rdDialog'),rdInput=$('rdEntryInput');
 let rdExpected=null;
 function clearRdEntry(){
  rdExpected=null;$('rdSnapshot').textContent='';$('rdEntrySubmit').disabled=false;
  rdInput.value='';rdInput.type='password';rdInput.removeAttribute('aria-invalid');
  $('rdEntryError').textContent='';$('rdEntryShow').textContent='顯示';$('rdEntryShow').setAttribute('aria-pressed','false');
 }
 function closeRdEntry(){if(rdDialog.open)rdDialog.close();clearRdEntry();}
 $('rdButton').onclick=()=>{
  if($('app').dataset.mode==='rd'||rdDialog.open)return;
  clearRdEntry();
  const view=store.view(selected,now(),timeout,online&&subscribed&&!document.hidden),record=view.record;
  if(record){
   const inText=String(record.p.i),outText=String(record.p.o);
   rdExpected=inText+outText.split('').reverse().join('');
   $('rdSnapshot').textContent=selected+' · 本次 IN '+inText+' / OUT '+outText+'（已固定'+(view.fresh?'':'，舊值')+'）';
  }else{
   $('rdSnapshot').textContent='尚無此裝置的有效數值（— 不是 0）。收到資料後，請取消再按 RD。';
   $('rdEntrySubmit').disabled=true;
  }
  rdDialog.showModal();rdInput.focus();
 };
 $('ioButton').onclick=()=>{closeRdEntry();mode(false);};
 $('rdEntryCancel').onclick=closeRdEntry;
 rdDialog.oncancel=event=>{event.preventDefault();closeRdEntry();};
 rdDialog.onclose=()=>{if(!rdDialog.open)clearRdEntry();};
 $('rdEntryShow').onclick=()=>{
  const visible=rdInput.type==='password';rdInput.type=visible?'text':'password';
  $('rdEntryShow').textContent=visible?'隱藏':'顯示';$('rdEntryShow').setAttribute('aria-pressed',String(visible));
 };
 $('rdEntryForm').onsubmit=event=>{
  event.preventDefault();
  if(!rdDialog.open)return;
  if(rdExpected===null){$('rdEntryError').textContent='尚無有效數值，不能使用 00 代替。';return;}
  if(rdInput.value!==rdExpected){
   $('rdEntryError').textContent='通行碼不正確，請重新輸入。';rdInput.setAttribute('aria-invalid','true');rdInput.focus();rdInput.select();return;
  }
  closeRdEntry();mode(true);$('rdButton').focus();
 };
 document.addEventListener('securitypolicyviolation',event=>{
  if(event.effectiveDirective==='worker-src'||String(event.blockedURI).startsWith('blob')){log('CSP 阻擋背景 Worker；檢查 MQTT timer');notice('安全政策阻擋 Worker，可能影響 MQTT 保活。');}
 });
 function resume(){
  if(document.hidden)return;
  if(autoPending)connect();
  else if(wanted&&active&&!client)start(active,false);
 }
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&wanted){closeTransport();state('背景暫停');notice('回到前景後重新訂閱，等待新資料。');render();}
  else if(!document.hidden){resume();}
 });
 window.addEventListener('pagehide',()=>{closeRdEntry();mode(false);closeTransport();state('頁面暫停');render();});
 window.addEventListener('pageshow',()=>{resume();render();});window.addEventListener('resize',render);
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(saved){const config=M.settings(saved);$('url').value=config.url;$('topic').value=config.topic;$('stale').value=String(config.stale);timeout=config.stale;if(/^INOUT-[0-9A-F]{6}$/.test(saved.id))selected=saved.id;$('remember').checked=true;}
 }catch(_){/* Invalid or blocked storage falls back to safe defaults. */}
 // An explicit link wins over remembered identity. Invalid links never show another board.
 const linkIds=new URLSearchParams(window.location.search).getAll('id');
 let invalidLink=false;
 if(linkIds.length){
  if(linkIds.length===1&&/^INOUT-[0-9A-F]{6}$/.test(linkIds[0])){
   selected=linkIds[0];
   if(selected==='INOUT-5CA708')$('webManifest').setAttribute('href','manifest-5ca708.webmanifest');
  }else{selected='';invalidLink=true;autoPending=false;}
 }
 devices();controls();mode(false);setInterval(render,1000);
 if(!window.mqtt){state('MQTT 程式庫未載入','error');notice('請使用完整資料夾；vendor/mqtt-5.10.4.min.js 必須存在。');}
 if(invalidLink){
  state('裝置連結無效','error');
  notice('請重新掃描正確 QR；id 必須為 INOUT- 加六位大寫十六進位碼。');
  $('linkError').hidden=false;
  $('connect').disabled=true;
 }else resume();
})();
