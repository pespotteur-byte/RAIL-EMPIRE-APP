/** Windowed execution of the SAME numerical mesh: geometry and constraints are
 * never decimated. Only a bounded pool of numerical cells is resident at once.
 * Source/output metadata necessarily still scales with the supplied route.
 */
import type {PhysicsSegment,SimulationParams,SimulationResult,TrainPhysicsParams} from './train-physics.js';
export interface ProfileStreamConfig {
 cellCount:number;capacity:number;dsStep:number;preBrakeMarginM:number;brakeBuildSec:number;
 brake:(p:TrainPhysicsParams,w:SimulationParams['weather'],grade:number)=>number;
 accel:(p:TrainPhysicsParams,v:number,grade:number)=>number;
 power:(s:PhysicsSegment,p:SimulationParams)=>number;
}
class RestrictionHeap {
 private readonly caps:Float64Array;
 private readonly ends:Float64Array;
 private size=0;
 constructor(capacity:number){this.caps=new Float64Array(capacity);this.ends=new Float64Array(capacity);}
 reset(){this.size=0;}
 add(cap:number,end:number){
  let i=this.size++;
  if(i>=this.caps.length)throw new RangeError('Physics restriction heap exceeded its source count');
  while(i>0){const parent=(i-1)>>>1;if(this.caps[parent]<=cap)break;this.caps[i]=this.caps[parent];this.ends[i]=this.ends[parent];i=parent;}
  this.caps[i]=cap;this.ends[i]=end;
 }
 min(position:number,reverse=false):number{
  while(this.size&&(reverse?position<this.ends[0]:position>=this.ends[0])){
   const last=--this.size;if(!this.size)break;
   const cap=this.caps[last],end=this.ends[last];let p=0;
   for(;;){let c=2*p+1;if(c>=this.size)break;if(c+1<this.size&&this.caps[c+1]<this.caps[c])c++;if(cap<=this.caps[c])break;this.caps[p]=this.caps[c];this.ends[p]=this.ends[c];p=c;}
   this.caps[p]=cap;this.ends[p]=end;
  }
  return this.size?this.caps[0]:Infinity;
 }
}
export function simulateProfileStream(segments:PhysicsSegment[],params:SimulationParams,cfg:ProfileStreamConfig):SimulationResult{
 const N=cfg.cellCount,C=cfg.capacity,count=segments.length,chunks=Math.ceil(N/C);
 const starts=new Float64Array(count+1);
 let totalDist=0,maxSourceIndex=0,drops=0,rises=0;
 // Preserve the buffered implementation's forward addition order exactly.
 for(let s=0;s<count;s++){
  const n=Math.max(1,Math.ceil(segments[s].distM/cfg.dsStep)),step=segments[s].distM/n;
  starts[s+1]=starts[s]+n;
  const source=Number.isInteger(segments[s].sourceIndex)?Number(segments[s].sourceIndex):s;
  maxSourceIndex=Math.max(maxSourceIndex,source);
  for(let k=0;k<n;k++)totalDist+=step;
  if(s&&segments[s].limitMs<segments[s-1].limitMs-1e-6)drops++;
  if(s&&segments[s].limitMs>segments[s-1].limitMs+1e-6)rises++;
 }
 // Each original reduction contributes one exact index interval. The margin
 // walk uses the original cell distances and addition order, not an approximate
 // distance-to-index conversion (important at floating-point boundaries).
 const from=new Float64Array(drops),to=new Float64Array(drops),restriction=new Float64Array(drops);
 let drop=0;
 for(let s=1;s<count;s++)if(segments[s].limitMs<segments[s-1].limitMs-1e-6){
  const shift=cfg.preBrakeMarginM+Math.max(segments[s-1].limitMs,segments[s].limitMs)*cfg.brakeBuildSec*.5;
  let j=starts[s]-1,prior=s-1,acc=0;
  while(j>=0&&acc<shift){acc+=segments[prior].distM/(starts[prior+1]-starts[prior]);j--;while(prior>0&&j<starts[prior])prior--;}
  from[drop]=j+1;to[drop]=starts[s]-1;restriction[drop]=segments[s].limitMs;drop++;
 }
 const distance=new Float64Array(C),segId=new Uint32Array(C),cap=new Float64Array(C);
 const rightCap=new Float64Array(chunks),rightDs=new Float64Array(chunks),rightDecel=new Float64Array(chunks),rightRemaining=new Float64Array(chunks);
 const findSegment=(index:number)=>{
  let lo=0,hi=count-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(starts[mid]<=index)lo=mid;else hi=mid-1;}return lo;
 };
 const fill=(lo:number,hi:number)=>{
  let s=findSegment(lo),step=segments[s].distM/(starts[s+1]-starts[s]);
  for(let i=lo;i<hi;i++){
   if(i>=starts[s+1]){s++;step=segments[s].distM/(starts[s+1]-starts[s]);}
   distance[i-lo]=step;segId[i-lo]=s;cap[i-lo]=segments[s].limitMs;
  }
 };
 const down=new RestrictionHeap(drops);
 let activeDrop=drops-1,next=0,nextDs=0,nextDecel=0,suffix=0,lastBrakeSegment=-1,brake=0;
 // Backward sweep keeps only each window's right-hand boundary conditions.
 // Terminal brake-build overlays are NOT fed into the recursive brake pass.
 for(let c=chunks-1;c>=0;c--){
  const lo=c*C,hi=Math.min(N,lo+C);fill(lo,hi);
  rightCap[c]=next;rightDs[c]=nextDs;rightDecel[c]=nextDecel;rightRemaining[c]=suffix;
  for(let i=hi-1;i>=lo;i--){
   while(activeDrop>=0&&to[activeDrop]>=i){down.add(restriction[activeDrop],from[activeDrop]);activeDrop--;}
   const k=i-lo,s=segId[k];
   const limit=Math.min(cap[k],down.min(i,true));
   const raw=i===N-1?Math.min(limit,params.endMs??0):Math.min(limit,Math.sqrt(next*next+2*nextDecel*nextDs));
   if(s!==lastBrakeSegment){lastBrakeSegment=s;brake=cfg.brake(params,params.weather,Number(segments[s].gradePermille||0));}
   next=raw;nextDs=distance[k];nextDecel=brake;suffix+=distance[k];
  }
 }
 // Replay each window forward. Index-sorted starts allow an exact min-envelope
 // without storing the complete limit/cap/rear-clearance arrays for N cells.
 const startOrder=Uint32Array.from({length:drops},(_,i)=>i);startOrder.sort((a,b)=>from[a]-from[b]||a-b);
 down.reset();let event=0;
 const rear=new RestrictionHeap(rises),lengthM=params.lengthM||200;
 const collect=params.collectSegmentTimes!==false;
 const times=collect?new Float64Array(maxSourceIndex+1):null;
 const local:TrainPhysicsParams={...params,powerW:0};
 let v=Math.max(0,params.startMs??0),timeSec=0,vMax=0,position=0,powerSegment=-1;
 const target=Math.max(0,Number(params.endMs??0));
 const result=():SimulationResult=>({timeSec,distM:totalDist,vMaxReachedMs:vMax,segmentTimeSec:times?Array.from(times):[]});
 for(let c=0;c<chunks;c++){
  const lo=c*C,hi=Math.min(N,lo+C);fill(lo,hi);
  for(let i=lo;i<hi;i++){
   while(event<drops&&from[startOrder[event]]<=i){const e=startOrder[event++];down.add(restriction[e],to[e]+1);}
   cap[i-lo]=Math.min(cap[i-lo],down.min(i));
  }
  next=rightCap[c];nextDs=rightDs[c];nextDecel=rightDecel[c];suffix=rightRemaining[c];lastBrakeSegment=-1;
  for(let i=hi-1;i>=lo;i--){
   const k=i-lo,s=segId[k];
   const raw=i===N-1?Math.min(cap[k],params.endMs??0):Math.min(cap[k],Math.sqrt(next*next+2*nextDecel*nextDs));
   if(s!==lastBrakeSegment){lastBrakeSegment=s;brake=cfg.brake(params,params.weather,Number(segments[s].gradePermille||0));}
   next=raw;nextDs=distance[k];nextDecel=brake;suffix+=distance[k];
   const ab=brake*cfg.brakeBuildSec,discriminant=ab*ab+4*(target*target+2*brake*suffix);
   cap[k]=Math.min(raw,Math.max(target,(-ab+Math.sqrt(Math.max(0,discriminant)))/2));
  }
  for(let i=lo;i<hi;i++){
   const k=i-lo,s=segId[k],segment=segments[s],ds=distance[k];
   if(lengthM>0&&s>0&&i===starts[s]&&segment.limitMs>segments[s-1].limitMs+1e-6)rear.add(segments[s-1].limitMs,position+lengthM);
   let allowed=cap[k];const rearCap=lengthM>0?rear.min(position):Infinity;if(rearCap>0)allowed=Math.min(allowed,rearCap);
   const vStart=v;
   if(powerSegment!==s){powerSegment=s;local.powerW=cfg.power(segment,params);}
   const grade=Number(segment.gradePermille||0),a=cfg.accel(local,v,grade);
   let nextSquared=v*v+2*a*ds;
   if(a<0&&nextSquared<=0&&v>0&&cfg.accel(local,0,grade)>0){
    let low=0,high=v;for(let q=0;q<24;q++){const mid=(low+high)/2;if(cfg.accel(local,mid,grade)>0)low=mid;else high=mid;}nextSquared=low*low;
   }
   v=Math.min(allowed,Math.sqrt(Math.max(0,nextSquared)));
   if(vStart+v<=1e-9){timeSec=Infinity;return result();}
   const dt=(2*ds)/(vStart+v);timeSec+=dt;
   if(times){const source=Number.isInteger(segment.sourceIndex)?Number(segment.sourceIndex):s;times[source>>>0]+=dt;}
   if(v>vMax)vMax=v;
   position+=ds;
  }
 }
 return result();
}
