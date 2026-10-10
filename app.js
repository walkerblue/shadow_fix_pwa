const $=id=>document.getElementById(id);
let original=null;
let latestBlob=null;
const strength=$('strength'),radius=$('radius');
strength.oninput=()=>{$('strengthValue').textContent=strength.value};
radius.oninput=()=>{$('radiusValue').textContent=['','小','中','大'][+radius.value]};
$('photo').onchange=async e=>{
 const f=e.target.files?.[0];if(!f)return;
 $('status').textContent='画像を読み込んでいます…';
 try{
  const bmp=await createImageBitmap(f);
  const scale=Math.min(1,1400/Math.max(bmp.width,bmp.height));
  const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
  const c=$('before');c.width=w;c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0,w,h);
  original=ctx.getImageData(0,0,w,h);bmp.close();
  $('run').disabled=false;$('results').classList.remove('hidden');
  $('status').textContent=`${w} × ${h} px の画像を読み込みました。`;
 }catch(err){$('status').textContent='読み込みに失敗しました: '+err.message}
};
function blurGray(src,w,h,r){
 // 2-pass box blur with sliding window, clamped edges
 let tmp=new Float32Array(w*h),out=new Float32Array(w*h);
 for(let y=0;y<h;y++){
  let sum=0;for(let k=-r;k<=r;k++)sum+=src[y*w+Math.max(0,Math.min(w-1,k))];
  for(let x=0;x<w;x++){
   tmp[y*w+x]=sum/(2*r+1);
   sum+=src[y*w+Math.min(w-1,x+r+1)]-src[y*w+Math.max(0,x-r)];
  }
 }
 for(let x=0;x<w;x++){
  let sum=0;for(let k=-r;k<=r;k++)sum+=tmp[Math.max(0,Math.min(h-1,k))*w+x];
  for(let y=0;y<h;y++){
   out[y*w+x]=sum/(2*r+1);
   sum+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];
  }
 }
 return out;
}
$('run').onclick=async()=>{
 if(!original)return;
 $('run').disabled=true;$('status').textContent='処理中…';
 await new Promise(r=>setTimeout(r,30));
 try{
 const {width:w,height:h,data:src}=original;
 const sw=Math.min(240,w),sh=Math.max(1,Math.round(h*sw/w));
 const small=document.createElement('canvas');small.width=sw;small.height=sh;
 small.getContext('2d').drawImage($('before'),0,0,sw,sh);
 const sd=small.getContext('2d').getImageData(0,0,sw,sh).data;
 const luma=new Float32Array(sw*sh);
 for(let i=0;i<luma.length;i++){
  const j=i*4;
  luma[i]=.2126*sd[j]+.7152*sd[j+1]+.0722*sd[j+2];
 }
 const r=[0,9,20,35][+radius.value];
 let base=blurGray(luma,sw,sh,r);
 base=blurGray(base,sw,sh,r);
 const sorted=Array.from(base).sort((a,b)=>a-b);
 const target=sorted[Math.floor(sorted.length*.80)];
 const out=new ImageData(w,h);
 const amount=+strength.value/100;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,j=i*4;
  const sx=Math.min(sw-1,Math.floor(x*sw/w)),sy=Math.min(sh-1,Math.floor(y*sh/h));
  const illumination=base[sy*sw+sx];
  // Limit boost to avoid washing out genuinely dark objects
  const gain=1+amount*Math.min(.85,Math.max(0,(target-illumination)/Math.max(65,illumination)));
  for(let c=0;c<3;c++)out.data[j+c]=Math.min(255,Math.round(src[j+c]*gain));
  out.data[j+3]=src[j+3];
 }
 const canvas=$('after');canvas.width=w;canvas.height=h;
 canvas.getContext('2d').putImageData(out,0,0);
 canvas.toBlob(blob=>{
  if(!blob){$('status').textContent='保存画像の生成に失敗しました。';return}
  if($('save').dataset.url)URL.revokeObjectURL($('save').dataset.url);
  latestBlob=blob; $('share').disabled=false;
  const url=URL.createObjectURL(blob);$('save').href=url;$('save').dataset.url=url;
  $('status').textContent='補正が完了しました。';
 },'image/png');
 }catch(err){$('status').textContent='処理エラー: '+err.message}
 finally{$('run').disabled=false}
};
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});

$('share').onclick=async()=>{
 if(!latestBlob)return;
 const file=new File([latestBlob],'shadow-fixed.png',{type:'image/png'});
 try{
  if(navigator.canShare?.({files:[file]})){
   await navigator.share({files:[file]});
   $('status').textContent='共有画面で「画像を保存」を選択してください。';
  }else{
   $('status').textContent='このブラウザでは画像共有に対応していません。「ファイルにダウンロード」を利用してください。';
  }
 }catch(err){if(err.name!=='AbortError')$('status').textContent='共有できませんでした: '+err.message;}
};
