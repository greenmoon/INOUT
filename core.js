/* Pure data model shared by the real browser and offline tests. No networking. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.InoutModel=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const DEFAULTS=Object.freeze({url:'wss://jbnas03.synology.me:8084/mqtt',topic:'inout',id:'INOUT-50A138',stale:5});
  function settings(input){
    const url=new URL(input.url.trim()),topic=input.topic.trim(),stale=Number(input.stale);
    if(url.protocol!=='wss:'||!url.hostname||url.username||url.password||url.search||url.hash)throw Error('Broker 必須使用 wss://，不可含帳密、query 或 #');
    if(!topic||topic.length>127||/[+#\u0000-\u001f\u007f]/.test(topic)||topic.startsWith('$'))throw Error('請填單一確切 topic（不接受 +、# 或 $）');
    if(!Number.isFinite(stale)||stale<2||stale>180)throw Error('逾時秒數須介於 2–180');
    return {url:url.href,topic,stale};
  }
  function decode(text){
    if(typeof text!=='string'||text.length>1024)throw Error('payload 超過 1024 字元');
    const p=JSON.parse(text),keys=['f','s','i','o','e','id'];
    if(!p||Array.isArray(p)||Object.keys(p).length!==6||keys.some(k=>!Object.hasOwn(p,k)))throw Error('需要單一 f/s/i/o/e/id JSON');
    // The accepted schema is flat; counting property tokens also rejects duplicate keys.
    if((text.match(/"(?:\\.|[^"\\])*"\s*:/g)||[]).length!==6)throw Error('重複或巢狀欄位');
    if(!/^INOUT-[0-9A-F]{6}$/.test(p.id)||typeof p.id!=='string')throw Error('id 格式不符 INOUT-xxxxxx');
    if(['f','s','i','o','e'].some(k=>typeof p[k]!=='number'||!Number.isFinite(p[k])))throw Error('f/s/i/o/e 必須為有限數值');
    if(['f','i','o'].some(k=>!Number.isSafeInteger(p[k])||p[k]<0))throw Error('f/i/o 需非負安全整數');
    return Object.fromEntries(keys.map(k=>[k,p[k]]));
  }
  class Store{
    constructor(){this.reset();}
    reset(){this.devices=new Map();this.total=0;this.valid=0;this.rejected=0;this.retained=0;this.duplicates=0;this.epoch=0;this.latest=null;}
    invalidate(){this.epoch++;}
    receive(topic,text,packet,expected,now){
      this.total++;
      try{
        if(topic!==expected)throw Error('非訂閱 topic');
        const p=decode(text);
        if(packet.retain){this.retained++;return {kind:'retained',id:p.id};}
        if(!this.devices.has(p.id)&&this.devices.size>=64)throw Error('裝置上限 64');
        const previous=this.devices.get(p.id),normalized=JSON.stringify(p);
        if(previous&&previous.epoch===this.epoch&&previous.normalized===normalized){this.duplicates++;return {kind:'duplicate',id:p.id};}
        const record={p,normalized,at:now,epoch:this.epoch,topic};
        this.devices.set(p.id,record);this.latest=record;this.valid++;
        return {kind:'valid',id:p.id};
      }catch(e){this.rejected++;return {kind:'rejected',reason:e instanceof SyntaxError?'無效 JSON':e.message};}
    }
    view(id,now,timeout,online){
      const r=this.devices.get(id),age=r?Math.max(0,now-r.at):null;
      const fresh=!!r&&online&&r.epoch===this.epoch&&age<timeout*1000;
      return {record:r,age,fresh,activity:fresh&&r.p.e===1};
    }
  }
  return {DEFAULTS,settings,decode,Store};
});
