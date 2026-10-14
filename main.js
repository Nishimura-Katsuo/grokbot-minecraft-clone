import * as THREE from 'three';
import {EffectComposer} from './addons/postprocessing/EffectComposer.js';
import {RenderPass} from './addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './addons/postprocessing/OutputPass.js';
import {ShaderPass} from './addons/postprocessing/ShaderPass.js';
import {GTAOPass} from './addons/postprocessing/GTAOPass.js';
import {SMAAPass} from './addons/postprocessing/SMAAPass.js';
import {Sky} from './addons/objects/Sky.js';

const QS=new URLSearchParams(location.search);const SHOT=QS.has('shot');let HIGH=QS.get('q')!=='low';

// ---------- seeded simplex noise ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd=mulberry32(1337);const perm=new Uint8Array(512);{const p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));[p[i],p[j]]=[p[j],p[i]]}for(let i=0;i<512;i++)perm[i]=p[i&255]}
const grad=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
function noise2(xin,yin){const s=(xin+yin)*F2;const i=Math.floor(xin+s),j=Math.floor(yin+s);const t=(i+j)*G2;
 const x0=xin-(i-t),y0=yin-(j-t);const i1=x0>y0?1:0,j1=1-i1;const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
 const ii=i&255,jj=j&255;let n=0,tt;
 tt=.5-x0*x0-y0*y0;if(tt>0){const g=grad[perm[ii+perm[jj]]&7];tt*=tt;n+=tt*tt*(g[0]*x0+g[1]*y0)}
 tt=.5-x1*x1-y1*y1;if(tt>0){const g=grad[perm[ii+i1+perm[jj+j1]]&7];tt*=tt;n+=tt*tt*(g[0]*x1+g[1]*y1)}
 tt=.5-x2*x2-y2*y2;if(tt>0){const g=grad[perm[ii+1+perm[jj+1]]&7];tt*=tt;n+=tt*tt*(g[0]*x2+g[1]*y2)}
 return 70*n}
function fbm(x,y,o=4){let a=1,f=1,s=0,n=0;for(let i=0;i<o;i++){s+=a*noise2(x*f,y*f);n+=a;a*=.5;f*=2}return s/n}
function hash(x,z){let h=Math.imul(x,374761393)+Math.imul(z,668265263);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296}

// ---------- blocks ----------
const AIR=0,GRASS=1,DIRT=2,STONE=3,SAND=4,WATER=5,LOG=6,LEAVES=7,PLANKS=8,COBBLE=9,GLASS=10,TALL=11,ROSE=12,DAND=13;
const isPlant=b=>b>=TALL&&b<=DAND;
const isOpaque=b=>b!==AIR&&b!==WATER&&b!==LEAVES&&b!==GLASS&&!isPlant(b);
const isSolid=b=>b!==AIR&&b!==WATER&&!isPlant(b);
function tileFor(b,f){switch(b){case GRASS:return f==2?0:f==3?2:1;case DIRT:return 2;case STONE:return 3;case SAND:return 4;case WATER:return 5;case LOG:return f==2||f==3?7:6;case LEAVES:return 8;case PLANKS:return 9;case COBBLE:return 10;case GLASS:return 11;case TALL:return 12;case ROSE:return 13;case DAND:return 14}return 3}

// ---------- procedural 16px textures (+ normal map from height) ----------
const NT=16,TS=16,AW=NT*TS;
const atlasCanvas=document.createElement('canvas');atlasCanvas.width=AW;atlasCanvas.height=TS;const actx=atlasCanvas.getContext('2d');
const img=actx.createImageData(AW,TS);const D=img.data;const trnd=mulberry32(42);
const cl=v=>Math.max(0,Math.min(255,v|0));
function put(t,x,y,c,a=255){const i=(y*AW+t*TS+x)*4;D[i]=cl(c[0]);D[i+1]=cl(c[1]);D[i+2]=cl(c[2]);D[i+3]=a}
const mul=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const tn=(x,y,s,o)=>noise2(x*s+o*17.3,y*s+o*5.1);
const GR=[84,134,50],DI=[118,84,58];
function grassPx(x,y){const n=trnd(),c=tn(x,y,.3,1)*.12;let col=mul(GR,.9+c+(n-.5)*.22);if(n>.94)col=mix(col,[170,190,70],.5);if(n<.06)col=mul(col,.72);return col}
function dirtPx(x,y){const n=trnd();let col=mul(DI,.9+tn(x,y,.35,2)*.14+(n-.5)*.2);if(n>.95)col=[150,122,98];if(n<.05)col=mul(DI,.65);return col}
for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){
 put(0,x,y,grassPx(x,y));
 put(2,x,y,dirtPx(x,y));
 {const cr=Math.abs(tn(x,y,.22,3))<.07;const k=.86+tn(x,y,.4,4)*.12+(trnd()-.5)*.12;put(3,x,y,mul([128,128,132],cr?k*.72:k))}
 {const n=trnd();put(4,x,y,mul([222,206,158],.94+(n-.5)*.12+tn(x,y,.5,5)*.05+(n>.97?.1:0)))}
 {const w=Math.sin((x+y*.5)*.8)*.5+.5;put(5,x,y,[30+w*30,90+w*40,170+w*30])}
 {const g=((x+(tn(x,y,.3,6)*2|0))%4==0)||((x*7+y)%11==0);put(6,x,y,mul([104,80,48],(g?.68:1)*(.92+(trnd()-.5)*.18)))}
 {const r=Math.hypot(x-7.5,y-7.5);if(r>6.6)put(7,x,y,mul([104,80,48],.9+(trnd()-.5)*.2));else put(7,x,y,mul([184,148,92],((r+tn(x,y,.4,7))|0)%2==0?.86:1))}
 {const n=trnd();if(n<.14)put(8,x,y,[0,0,0],0);else{const c=tn(x,y,.45,8);put(8,x,y,mul([50,112,38],.84+c*.22+(n-.5)*.18+(n>.93?.18:0)))}}
 {const seam=y%4==3;const end=x==((y>>2)*5+3)%16;const k=(seam||end?.62:1)*(.95+tn(x*.3,y*3,.5,9)*.08+(trnd()-.5)*.06);put(9,x,y,mul([176,136,82],k))}
 {const b=x==0||y==0||x==15||y==15;const s=(x-y==3||x-y==4)&&x>3&&x<12;if(b)put(11,x,y,[215,232,245],255);else if(s)put(11,x,y,[255,255,255],170);else put(11,x,y,[0,0,0],0)}
 put(12,x,y,[0,0,0],0);put(13,x,y,[0,0,0],0);put(14,x,y,[0,0,0],0);put(15,x,y,[0,0,0],0);
}
for(let x=0;x<TS;x++){const d=3+(trnd()*2.5|0)+(x%5==2?1:0);for(let y=0;y<TS;y++)put(1,x,y,y<d?grassPx(x,y):dirtPx(x,y))}
{const cells=[];for(let i=0;i<10;i++)cells.push([trnd()*16,trnd()*16,.8+trnd()*.4]);for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){let d1=99,d2=99,c=0,bx=0,by=0;for(const p of cells){let dx=x-p[0],dy=y-p[1];if(dx>8)dx-=16;if(dx<-8)dx+=16;if(dy>8)dy-=16;if(dy<-8)dy+=16;const d=Math.hypot(dx,dy);if(d<d1){d2=d1;d1=d;c=p[2];bx=dx;by=dy}else if(d<d2)d2=d}
 const edge=d2-d1<1.1;const hl=(bx+by)<-1.5?1.12:(bx+by)>2?.85:1;put(10,x,y,mul([122,122,124],edge?.5:c*hl*(.95+(trnd()-.5)*.1)))}}
for(let b=0;b<9;b++){let x=1+(trnd()*14|0);const h=6+(trnd()*9|0);const lean=(trnd()-.5)*.5;for(let i=0;i<h;i++){const y=15-i;const xx=Math.round(x+lean*i);if(xx<0||xx>15)break;put(12,xx,y,mix([46,100,30],[120,180,70],i/h))}}
for(let y=8;y<16;y++)put(13,7,y,[50,110,30]);put(13,6,11,[60,130,40]);put(13,5,10,[60,130,40]);
for(let y=2;y<8;y++)for(let x=4;x<11;x++){const r=Math.hypot(x-7,y-4.6);if(r<3.1)put(13,x,y,r<1?[40,20,10]:mul([215,30,30],1-r*.08))}
for(let y=8;y<16;y++)put(14,8,y,[50,110,30]);put(14,9,12,[60,130,40]);
for(let y=3;y<9;y++)for(let x=5;x<12;x++){const r=Math.hypot(x-8,y-5.6);if(r<2.8)put(14,x,y,mul([250,215,40],1.05-r*.12))}
actx.putImageData(img,0,0);
// normal map from luminance
const nCanvas=document.createElement('canvas');nCanvas.width=AW;nCanvas.height=TS;const nctx=nCanvas.getContext('2d');const nimg=nctx.createImageData(AW,TS);
{const lum=(t,x,y)=>{x=(x+TS)%TS;y=(y+TS)%TS;const i=(y*AW+t*TS+x)*4;return(D[i]*.3+D[i+1]*.59+D[i+2]*.11)/255};
 for(let t=0;t<NT;t++)for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){const s=2.2;const du=(lum(t,x+1,y)-lum(t,x-1,y))*s,dv=(lum(t,x,y-1)-lum(t,x,y+1))*s;const l=Math.hypot(du,dv,1);const i=(y*AW+t*TS+x)*4;
  nimg.data[i]=(-du/l*.5+.5)*255;nimg.data[i+1]=(-dv/l*.5+.5)*255;nimg.data[i+2]=(1/l*.5+.5)*255;nimg.data[i+3]=255}}
nctx.putImageData(nimg,0,0);
function mkTex(c,srgb){const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t}
const atlas=mkTex(atlasCanvas,true),normalAtlas=mkTex(nCanvas,false);

// ---------- world ----------
const CS=16,H=112,SEA=29,WL=SEA+0.88;let R=HIGH?8:6;
const chunks=new Map();const key=(x,z)=>x+','+z;
function terrainHeight(x,z){const e=fbm(x*.006,z*.006,5);const m=Math.max(0,fbm(x*.0025+100,z*.0025-50,2));const r=1-Math.abs(noise2(x*.004+40,z*.004));return Math.floor(31+e*13+m*m*70+r*r*r*m*25)}
function genChunk(cx,cz){const d=new Uint8Array(CS*CS*H);const I=(x,y,z)=>y*CS*CS+z*CS+x;const hs=[];
 for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const wx=cx*CS+x,wz=cz*CS+z;const h=Math.min(H-12,terrainHeight(wx,wz));hs.push(h);const beach=h<=SEA+1;const rocky=h>66||(h>52&&hash(wx,wz)<(h-52)/20);
  for(let y=0;y<=h;y++)d[I(x,y,z)]=y==h?(beach?SAND:rocky?STONE:GRASS):y>h-4?(beach?SAND:rocky?STONE:DIRT):STONE;
  for(let y=h+1;y<=SEA;y++)d[I(x,y,z)]=WATER}
 for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const h=hs[z*CS+x];const wx=cx*CS+x,wz=cz*CS+z;if(d[I(x,h,z)]!==GRASS)continue;
  const fl=noise2(wx*.03,wz*.03);const r=hash(wx*3+1,wz*7+2);
  if(r<.22+fl*.15)d[I(x,h+1,z)]=TALL;else if(r<.26&&fl>.2)d[I(x,h+1,z)]=fl>.5?DAND:ROSE;
  if(x<2||z<2||x>CS-3||z>CS-3||h>60)continue;
  if(hash(wx,wz)<.01+Math.max(0,noise2(wx*.01,wz*.01))*.035){const th=4+(hash(wz,wx)*3|0);
   for(let y=1;y<=th;y++)d[I(x,h+y,z)]=LOG;const top=h+th;
   for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const rr=dx*dx+dz*dz+dy*dy*1.4;const y=top+dy+1;const cur=d[I(x+dx,y,z+dz)];if(rr<=5.5&&y<H&&(cur==AIR||isPlant(cur))&&hash(wx+dx*7+dy,wz+dz*3)>.08)d[I(x+dx,y,z+dz)]=LEAVES}}}
 return d}
function getChunk(cx,cz){const k=key(cx,cz);let c=chunks.get(k);if(!c){c={cx,cz,data:genChunk(cx,cz),mesh:null,plants:null,water:null};chunks.set(k,c)}return c}
function getBlock(x,y,z){if(y<0)return STONE;if(y>=H)return AIR;const cx=Math.floor(x/CS),cz=Math.floor(z/CS);const c=getChunk(cx,cz);return c.data[y*CS*CS+(z-cz*CS)*CS+(x-cx*CS)]}
function setBlock(x,y,z,b){if(y<0||y>=H)return;const cx=Math.floor(x/CS),cz=Math.floor(z/CS);const c=getChunk(cx,cz);const lx=x-cx*CS,lz=z-cz*CS;c.data[y*CS*CS+lz*CS+lx]=b;
 if(b===AIR&&y+1<H&&isPlant(c.data[(y+1)*CS*CS+lz*CS+lx]))c.data[(y+1)*CS*CS+lz*CS+lx]=AIR;
 buildChunk(c);if(lx==0)rebuild(cx-1,cz);if(lx==CS-1)rebuild(cx+1,cz);if(lz==0)rebuild(cx,cz-1);if(lz==CS-1)rebuild(cx,cz+1)}
function rebuild(cx,cz){const c=chunks.get(key(cx,cz));if(c&&c.mesh)buildChunk(c)}

const FACES=[];
for(let d=0;d<6;d++){const axis=d>>1,sign=d%2==0?1:-1;const n=[0,0,0];n[axis]=sign;const u=(axis+1)%3,w=(axis+2)%3;
 let cs=[[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>{const c=[0,0,0];c[axis]=sign>0?1:0;c[u]=a;c[w]=b;return c});
 const e1=cs[1].map((v,i)=>v-cs[0][i]),e2=cs[2].map((v,i)=>v-cs[0][i]);const cr=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
 if(cr[0]*n[0]+cr[1]*n[1]+cr[2]*n[2]<0)cs.reverse();
 FACES.push({n,axis,u,w,corners:cs})}
const AOV=[.38,.58,.78,1];
function colDepth(x,y,z){let n=0;while(n<14&&getBlock(x,y-n,z)===WATER)n++;return n}
function geo(attrs,idx){const g=new THREE.BufferGeometry();for(const k in attrs)g.setAttribute(k,new THREE.Float32BufferAttribute(attrs[k][0],attrs[k][1]));g.setIndex(idx);g.computeBoundingSphere();return g}
function buildChunk(c){
 const P=[],N=[],U=[],C=[],Wv=[],I=[],WP=[],WD=[],WI=[],PP=[],PN=[],PU=[],PC=[],PW=[],PI=[];const bx=c.cx*CS,bz=c.cz*CS;const data=c.data;
 const occ=(x,y,z)=>isOpaque(getBlock(x,y,z))||getBlock(x,y,z)===LEAVES?1:0;
 for(let y=0;y<H;y++)for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const b=data[y*CS*CS+z*CS+x];if(!b)continue;const wx=bx+x,wz=bz+z;
  if(isPlant(b)){const t=tileFor(b,0);const s=.15;const qs=[[s,s,1-s,1-s],[s,1-s,1-s,s]];const jx=(hash(wx,wz)-.5)*.3,jz=(hash(wz,wx)-.5)*.3;
   for(const q of qs){const base=PP.length/3;PP.push(wx+q[0]+jx,y,wz+q[1]+jz, wx+q[2]+jx,y,wz+q[3]+jz, wx+q[2]+jx,y+1,wz+q[3]+jz, wx+q[0]+jx,y+1,wz+q[1]+jz);
    for(let k=0;k<4;k++)PN.push(0,1,0);PU.push(t/NT,0,(t+1)/NT,0,(t+1)/NT,1,t/NT,1);PC.push(.7,.7,.7,.7,.7,.7,1,1,1,1,1,1);PW.push(0,0,1,1);PI.push(base,base+1,base+2,base,base+2,base+3)}continue}
  for(let d=0;d<6;d++){const F=FACES[d];const nx=wx+F.n[0],ny=y+F.n[1],nz=wz+F.n[2];const lx=x+F.n[0],lz=z+F.n[2];
   const nb=(lx>=0&&lx<CS&&lz>=0&&lz<CS)?(ny<0?STONE:ny>=H?AIR:data[ny*CS*CS+lz*CS+lx]):getBlock(nx,ny,nz);
   if(b===WATER){if(nb===WATER||isOpaque(nb))continue;const top=getBlock(wx,y+1,wz)!==WATER;const base=WP.length/3;
    for(const cc of F.corners){const vx=wx+cc[0],vz=wz+cc[2];WP.push(vx,y+(cc[1]&&top?.88:cc[1]),vz);
     if(d===2&&top){let mn=99,sm=0;for(const[ox,oz]of[[-1,-1],[0,-1],[-1,0],[0,0]]){const dd=colDepth(vx+ox,y,vz+oz);mn=Math.min(mn,dd);sm+=dd}WD.push(mn*.45+sm/4*.55)}else WD.push(3)}
    WI.push(base,base+1,base+2,base,base+2,base+3);continue}
   if(isOpaque(nb)||(nb===b&&b===GLASS))continue;
   const t=tileFor(b,d);const base=P.length/3;const ao=[];const wv=b===LEAVES?.6:0;
   for(const cc of F.corners){const du=cc[F.u]?1:-1,dw=cc[F.w]?1:-1;const o1=[nx,ny,nz],o2=[nx,ny,nz],o3=[nx,ny,nz];o1[F.u]+=du;o2[F.w]+=dw;o3[F.u]+=du;o3[F.w]+=dw;
    const s1=occ(...o1),s2=occ(...o2),s3=occ(...o3);const a=s1&&s2?0:3-(s1+s2+s3);ao.push(a);
    P.push(wx+cc[0],y+cc[1],wz+cc[2]);N.push(...F.n);
    const uu=F.axis==0?cc[2]:cc[0],vv=F.axis==1?cc[2]:cc[1];U.push((t+.002+uu*.996)/NT,vv);
    const l=AOV[a];C.push(l,l,l);Wv.push(wv)}
   if(ao[0]+ao[2]<ao[1]+ao[3])I.push(base+1,base+2,base+3,base+1,base+3,base);else I.push(base,base+1,base+2,base,base+2,base+3)}}
 for(const k of['mesh','plants','water'])if(c[k]){scene.remove(c[k]);c[k].geometry.dispose();c[k]=null}
 c.mesh=new THREE.Mesh(geo({position:[P,3],normal:[N,3],uv:[U,2],color:[C,3],wave:[Wv,1]},I),blockMat);c.mesh.castShadow=c.mesh.receiveShadow=true;scene.add(c.mesh);
 if(PP.length){c.plants=new THREE.Mesh(geo({position:[PP,3],normal:[PN,3],uv:[PU,2],color:[PC,3],wave:[PW,1]},PI),plantMat);c.plants.castShadow=c.plants.receiveShadow=true;scene.add(c.plants)}
 if(WP.length){c.water=new THREE.Mesh(geo({position:[WP,3],wdepth:[WD,1]},WI),waterMat);c.water.renderOrder=2;scene.add(c.water)}}

// ---------- height fog patch (applies to all built-in materials) ----------
const SC=THREE.ShaderChunk;
SC.fog_pars_vertex='#ifdef USE_FOG\nvarying float vFogDepth;varying vec3 vFogWorld;\n#endif';
SC.fog_vertex='#ifdef USE_FOG\nvFogDepth=-mvPosition.z;vFogWorld=(modelMatrix*vec4(transformed,1.0)).xyz;\n#endif';
SC.fog_pars_fragment='#ifdef USE_FOG\nuniform vec3 fogColor;varying float vFogDepth;varying vec3 vFogWorld;uniform float fogNear;uniform float fogFar;\n#endif';
SC.fog_fragment=`#ifdef USE_FOG
 float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
 float hfog=(1.0-exp(-vFogDepth*0.007))*exp(-max(vFogWorld.y-${SEA}.0,0.0)*0.07)*0.4;
 fogFactor=clamp(max(fogFactor,hfog),0.0,1.0);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);
#endif`;

// ---------- renderer / scene ----------
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:SHOT});
let PR=HIGH?Math.min(devicePixelRatio,1.5):1;renderer.setPixelRatio(PR);renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.62;renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xa9d4ff,60,R*CS-4);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,3000);camera.rotation.order='YXZ';
const timeU={value:0};
function waveMat(side){const m=new THREE.MeshStandardMaterial({map:atlas,normalMap:normalAtlas,normalScale:new THREE.Vector2(.7,.7),vertexColors:true,alphaTest:.5,roughness:.86,metalness:0,side});
 m.onBeforeCompile=s=>{s.uniforms.uTime=timeU;s.vertexShader='attribute float wave;uniform float uTime;\n'+s.vertexShader.replace('#include <begin_vertex>',
 `vec3 transformed=vec3(position);if(wave>0.0){float ph=position.x*.73+position.z*.51+position.y*.3;transformed.x+=(sin(uTime*1.7+ph)*.6+sin(uTime*3.1+ph*2.3)*.25)*.09*wave;transformed.z+=(cos(uTime*1.3+ph*1.2)*.6+sin(uTime*2.7+ph*1.7)*.2)*.07*wave;}`)};return m}
const blockMat=waveMat(THREE.FrontSide),plantMat=waveMat(THREE.DoubleSide);
// lights
const hemi=new THREE.HemisphereLight(0xbfdcff,0x5a4a3a,1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,5);sun.castShadow=true;
function setShadowRes(n){sun.shadow.mapSize.set(n,n);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}setShadowRes(HIGH?4096:2048);
Object.assign(sun.shadow.camera,{left:-96,right:96,top:96,bottom:-96,near:1,far:520});sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;scene.add(sun,sun.target);
// physically based sky (Preetham Rayleigh/Mie), extended with horizon fog blend + night tint
const sky=new Sky();sky.scale.setScalar(5000);sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
const sU=sky.material.uniforms;sU.turbidity.value=3.2;sU.rayleigh.value=2.1;sU.mieCoefficient.value=.006;sU.mieDirectionalG.value=.83;
sU.uSkyScale={value:1};sU.uFog={value:new THREE.Color()};sU.uNightK={value:0};
sky.material.fragmentShader='uniform float uSkyScale;uniform vec3 uFog;uniform float uNightK;\n'+sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );',
 `retColor*=uSkyScale*(1.0-uNightK*.8);retColor+=vec3(.010,.018,.045)*uNightK*(1.0-direction.y*.5);
 float hz=exp(-max(direction.y,0.0)*14.0);retColor=mix(retColor,uFog,hz*.5);
 if(direction.y<0.0)retColor=mix(retColor,uFog,smoothstep(0.0,-.04,direction.y));
 gl_FragColor=vec4(retColor,1.0);`);
// stars, moon, sun halo
const starG=new THREE.BufferGeometry();{const a=[],c=[];for(let i=0;i<3000;i++){const v=new THREE.Vector3(rnd()*2-1,rnd()*1.1-.1,rnd()*2-1).normalize().multiplyScalar(1500);a.push(v.x,v.y,v.z);const b=.4+rnd()*rnd()*3,w=rnd();c.push(b*(.8+w*.2),b*.9,b*(1.1-w*.2))}starG.setAttribute('position',new THREE.Float32BufferAttribute(a,3));starG.setAttribute('color',new THREE.Float32BufferAttribute(c,3))}
const starMat=new THREE.PointsMaterial({vertexColors:true,size:1.7,sizeAttenuation:false,transparent:true,fog:false,depthWrite:false,blending:THREE.AdditiveBlending});const stars=new THREE.Points(starG,starMat);stars.frustumCulled=false;stars.renderOrder=-8;scene.add(stars);
function glowTex(disc){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,0,64,64,64);
 if(disc){gr.addColorStop(0,'#fff');gr.addColorStop(.16,'#f4f4ff');gr.addColorStop(.19,'rgba(170,190,255,.35)');gr.addColorStop(.45,'rgba(120,150,255,.08)');gr.addColorStop(1,'rgba(0,0,0,0)')}
 else{gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.08,'rgba(255,240,210,.6)');gr.addColorStop(.3,'rgba(255,200,140,.12)');gr.addColorStop(1,'rgba(0,0,0,0)')}
 g.fillStyle=gr;g.fillRect(0,0,128,128);if(disc){g.fillStyle='rgba(150,150,170,.35)';for(const[x,y,r]of[[58,58,4],[69,66,3],[62,71,2.5],[70,56,2]]){g.beginPath();g.arc(x,y,r,0,7);g.fill()}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const moon=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(true),color:new THREE.Color(2.2,2.2,2.4),fog:false,depthWrite:false,blending:THREE.AdditiveBlending,transparent:true}));moon.scale.setScalar(260);moon.renderOrder=-7;scene.add(moon);
const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(false),color:new THREE.Color(1,1,1),fog:false,depthWrite:false,blending:THREE.AdditiveBlending,transparent:true}));halo.scale.setScalar(520);halo.renderOrder=-7;scene.add(halo);
// raymarched volumetric clouds
const cloudMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,fog:false,
 uniforms:{sunDir:{value:new THREE.Vector3()},sunCol:{value:new THREE.Color()},ambCol:{value:new THREE.Color()},fogCol:{value:new THREE.Color()},uTime:timeU,uSteps:{value:HIGH?36:14},uCover:{value:.5}},
 vertexShader:`varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.0);gl_Position.z=gl_Position.w;}`,
 fragmentShader:`uniform vec3 sunDir,sunCol,ambCol,fogCol;uniform float uTime,uSteps,uCover;varying vec3 vW;
 float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm3(vec3 p){float s=0.0,a=.5;for(int i=0;i<5;i++){s+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
 const float CB=180.0,CT=260.0;
 float dens(vec3 p){float hh=(p.y-CB)/(CT-CB);vec3 q=p*vec3(.0042,.006,.0042)+vec3(uTime*.008,0.0,uTime*.003);float d=fbm3(q)-uCover;
  d*=smoothstep(0.0,.25,hh)*smoothstep(1.0,.4,hh);return clamp((d-.015)*4.0,0.0,1.0);}
 void main(){vec3 ro=cameraPosition;vec3 rd=normalize(vW-ro);if(rd.y<.012)discard;
  float t0=max((CB-ro.y)/rd.y,0.0),t1=(CT-ro.y)/rd.y;if(t0>7000.0)discard;
  float len=min(t1-t0,520.0);float st=len/uSteps;float t=t0+st*h3(vec3(gl_FragCoord.xy,fract(uTime)));
  float T=1.0;vec3 col=vec3(0.0);float mu=dot(rd,sunDir);float ph=.5+1.6*pow(max(mu,0.0),10.0)+.4*pow(max(mu,0.0),2.0);
  for(int i=0;i<48;i++){if(float(i)>=uSteps||T<.03)break;vec3 p=ro+rd*t;float d=dens(p);
   if(d>.003){float ld=dens(p+sunDir*16.0)+dens(p+sunDir*44.0)*.6;float L=exp(-ld*2.4);float pw=1.0-exp(-d*5.0);float hh=(p.y-CB)/(CT-CB);
    vec3 c=sunCol*L*ph*mix(.5,1.0,pw)+ambCol*(.35+.65*hh);float a=1.0-exp(-d*st*.05);col+=T*a*c;T*=1.0-a;}
   t+=st;}
  float fade=smoothstep(7000.0,1800.0,t0)*smoothstep(.012,.07,rd.y);float al=(1.0-T)*fade;vec3 c=col/max(1.0-T,1e-3);
  c=mix(c,fogCol,smoothstep(900.0,7000.0,t0)*.75);gl_FragColor=vec4(c,al);}`});
const clouds=new THREE.Mesh(new THREE.BoxGeometry(4000,4000,4000),cloudMat);clouds.frustumCulled=false;clouds.renderOrder=-5;scene.add(clouds);
// highlight
const hl=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004,1.004,1.004)),new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.55}));scene.add(hl);

// ---------- water: planar reflection + fresnel + normal-mapped waves + depth color + shore foam + sun glint ----------
const reflRT=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
const waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
 uniforms:{uTime:timeU,uRefl:{value:HIGH?1:0},tRefl:{value:null},uTexMat:{value:new THREE.Matrix4()},sunDir:{value:new THREE.Vector3()},sunCol:{value:new THREE.Color()},
  skyCol:{value:new THREE.Color()},horizCol:{value:new THREE.Color()},fogCol:{value:new THREE.Color()},fogNear:{value:60},fogFar:{value:120},uSunVis:{value:1}},
 vertexShader:`attribute float wdepth;uniform float uTime;varying vec3 vWP;varying float vD;
 void main(){vec3 p=position;p.y+=(sin(p.x*.8+uTime*1.6)*.045+cos(p.z*.7+uTime*1.3)*.045-.03)*min(wdepth,1.0);vWP=p;vD=wdepth;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`,
 fragmentShader:`uniform float uTime,uRefl,fogNear,fogFar,uSunVis;uniform sampler2D tRefl;uniform mat4 uTexMat;uniform vec3 sunDir,sunCol,skyCol,horizCol,fogCol;varying vec3 vWP;varying float vD;
 float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
 float hgt(vec2 p){float t=uTime;float h=sin(dot(p,vec2(.8,.6))*.9+t*1.2)*.5+sin(dot(p,vec2(-.6,.8))*1.4+t*1.5)*.3+sin(dot(p,vec2(.3,-.95))*2.3+t*2.1)*.18+sin(dot(p,vec2(-.9,-.4))*3.7+t*2.7)*.1;
  return h+vn(p*1.6+vec2(t*.6,t*.4))*.35+vn(p*3.7-vec2(t*.9,-t*.5))*.16+vn(p*8.0-t*1.3)*.07;}
 void main(){vec3 V=cameraPosition-vWP;float dist=length(V);V/=dist;
  vec2 p=vWP.xz;float e=.04;float h0=hgt(p);vec2 g=vec2(hgt(p+vec2(e,0.0))-h0,hgt(p+vec2(0.0,e))-h0)/e;
  float str=.2*mix(1.0,.3,smoothstep(12.0,90.0,dist));vec3 n=normalize(vec3(-g.x*str,1.0,-g.y*str));
  float ndv=max(dot(n,V),0.0);float fres=min(.02+.98*pow(1.0-ndv,5.0),.92);
  vec3 R=reflect(-V,n);vec3 refl=mix(horizCol,skyCol,pow(clamp(R.y,0.0,1.0),.45));
  if(uRefl>.5){vec4 rc=uTexMat*vec4(vWP,1.0);vec2 ruv=rc.xy/rc.w+n.xz*.045;refl=texture2D(tRefl,clamp(ruv,.001,.999)).rgb;}
  float dd=vD;float deepT=1.0-exp(-dd*.3);float sl=max(sunDir.y,0.0);
  vec3 body=mix(vec3(.03,.34,.33),vec3(.012,.085,.14),deepT)*(sunCol*sl*.5+skyCol*.7+.02);
  fres*=mix(.55,1.0,deepT);vec3 col=mix(body,refl,fres);
  vec3 Hh=normalize(sunDir+V);float nh=max(dot(n,Hh),0.0);col+=sunCol*(pow(nh,900.0)*60.0+pow(nh,90.0)*.8)*uSunVis;
  float fn=vn(p*2.5+uTime*.3)*.6+vn(p*6.0-uTime*.5)*.4;
  float foam=smoothstep(.6,0.0,dd)*smoothstep(.45,.75,fn+.35*sin(dd*10.0-uTime*1.8));foam+=smoothstep(.18,0.0,dd)*.35;
  col=mix(col,(sunCol*sl+skyCol)*.9,clamp(foam,0.0,1.0)*.85);
  float a=clamp(mix(.18,.96,deepT)+fres*.6+foam,0.0,1.0);
  float ff=(1.0-exp(-dist*.0042))*.92;col=mix(col,fogCol,ff);a=mix(a,1.0,ff);
  gl_FragColor=vec4(col,a);}`});
waterMat.uniforms.tRefl.value=reflRT.texture;
const mirrorCam=new THREE.PerspectiveCamera();const _v=new THREE.Vector3(),_t=new THREE.Vector3(),_up=new THREE.Vector3(),_plane=new THREE.Plane(),_clip=new THREE.Vector4(),_q=new THREE.Vector4();
function renderReflection(){
 mirrorCam.copy(camera);const p=camera.position;mirrorCam.position.set(p.x,2*WL-p.y,p.z);
 camera.getWorldDirection(_v);_t.copy(p).add(_v);_t.y=2*WL-_t.y;_up.set(0,1,0).applyQuaternion(camera.quaternion);_up.y=-_up.y;mirrorCam.up.copy(_up);mirrorCam.lookAt(_t);
 mirrorCam.updateMatrixWorld();mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
 waterMat.uniforms.uTexMat.value.set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
 _plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),new THREE.Vector3(0,WL,0)).applyMatrix4(mirrorCam.matrixWorldInverse);
 _clip.set(_plane.normal.x,_plane.normal.y,_plane.normal.z,_plane.constant);const pm=mirrorCam.projectionMatrix.elements;
 _q.x=(Math.sign(_clip.x)+pm[8])/pm[0];_q.y=(Math.sign(_clip.y)+pm[9])/pm[5];_q.z=-1;_q.w=(1+pm[10])/pm[14];_clip.multiplyScalar(2/_clip.dot(_q));
 pm[2]=_clip.x;pm[6]=_clip.y;pm[10]=_clip.z+1-.003;pm[14]=_clip.w;mirrorCam.projectionMatrixInverse.copy(mirrorCam.projectionMatrix).invert();
 const vis=[ocean,stars];ocean.visible=stars.visible=false;for(const c of chunks.values())if(c.water){vis.push(c.water);c.water.visible=false}hl.visible=false;
 renderer.setRenderTarget(reflRT);renderer.clear();renderer.render(scene,mirrorCam);renderer.setRenderTarget(null);for(const w of vis)w.visible=true}

const oceanG=new THREE.PlaneGeometry(6000,6000,1,1).rotateX(-Math.PI/2);oceanG.translate(0,WL,0);oceanG.setAttribute('wdepth',new THREE.Float32BufferAttribute([9,9,9,9],1));
const oceanMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:waterMat.uniforms,vertexShader:waterMat.vertexShader});oceanMat.uniforms.uInner={value:100};
oceanMat.fragmentShader=waterMat.fragmentShader.replace('void main(){','uniform float uInner;\nvoid main(){if(length(vWP.xz-cameraPosition.xz)<uInner)discard;');
waterMat.uniforms.uInner=oceanMat.uniforms.uInner;
const ocean=new THREE.Mesh(oceanG,oceanMat);ocean.renderOrder=1;ocean.frustumCulled=false;scene.add(ocean);
// ---------- god-ray occlusion buffer ----------
const occRT=new THREE.WebGLRenderTarget(1,1);const occMat=new THREE.MeshBasicMaterial({color:0});const glowScene=new THREE.Scene();
const sunOcc=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(false),color:new THREE.Color(1,.95,.85),fog:false,depthWrite:false}));sunOcc.scale.setScalar(260);glowScene.add(sunOcc);
function renderOcclusion(){const hide=[sky,clouds,stars,moon,halo,hl];const st=hide.map(o=>o.visible);hide.forEach(o=>o.visible=false);
 scene.overrideMaterial=occMat;renderer.setRenderTarget(occRT);renderer.setClearColor(0,1);renderer.clear();renderer.render(scene,camera);
 renderer.autoClear=false;renderer.render(glowScene,camera);renderer.autoClear=true;scene.overrideMaterial=null;renderer.setRenderTarget(null);hide.forEach((o,i)=>o.visible=st[i])}

// ---------- post-processing ----------
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const gtao=new GTAOPass(scene,camera,innerWidth,innerHeight);gtao.updateGtaoMaterial({radius:1.6,distanceExponent:1.5,thickness:2,scale:1.1,samples:12});gtao.blendIntensity=.85;gtao.enabled=HIGH;{const gr=gtao.render.bind(gtao);gtao.render=(...a)=>{const h=[sky,clouds,stars,moon,halo,ocean,hl];for(const c of chunks.values())if(c.water)h.push(c.water);const v=h.map(o=>o.visible);h.forEach(o=>o.visible=false);gr(...a);h.forEach((o,i)=>o.visible=v[i])}}composer.addPass(gtao);
const godrays=new ShaderPass({uniforms:{tDiffuse:{value:null},tOcc:{value:null},sunPos:{value:new THREE.Vector2()},uInt:{value:0},uCol:{value:new THREE.Color()}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform sampler2D tDiffuse,tOcc;uniform vec2 sunPos;uniform float uInt;uniform vec3 uCol;varying vec2 vUv;
 void main(){vec4 base=texture2D(tDiffuse,vUv);if(uInt<=0.0){gl_FragColor=base;return;}vec2 d=(vUv-sunPos)*(.92/72.0);vec2 c=vUv;float ill=0.0,dec=1.0;
  for(int i=0;i<72;i++){c-=d;ill+=texture2D(tOcc,c).r*dec;dec*=.972;}ill/=72.0;gl_FragColor=base+vec4(uCol*ill*uInt,0.0);}`});
godrays.uniforms.tOcc.value=occRT.texture;composer.addPass(godrays);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.32,.55,.95);composer.addPass(bloom);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uSat:{value:1.08},uCon:{value:1.08},uTint:{value:new THREE.Color(1.02,1,.97)},uVig:{value:.42}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform float uSat,uCon,uVig;uniform vec3 uTint;varying vec2 vUv;
 void main(){vec3 c=max(texture2D(tDiffuse,vUv).rgb,0.0)*uTint;float l=dot(c,vec3(.2126,.7152,.0722));c=max(mix(vec3(l),c,uSat),0.0);
  c=pow(c/.18,vec3(uCon))*.18;float v=smoothstep(.95,.25,length((vUv-.5)*vec2(1.3,1.0)));c*=mix(1.0-uVig,1.0,v);gl_FragColor=vec4(c,1.0);}`});
composer.addPass(grade);composer.addPass(new OutputPass());
const smaa=new SMAAPass(innerWidth*PR,innerHeight*PR);composer.addPass(smaa);
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(PR);renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(PR);composer.setSize(innerWidth,innerHeight);
 reflRT.setSize(innerWidth*PR*.5|0,innerHeight*PR*.5|0);occRT.setSize(innerWidth*PR*.25|0,innerHeight*PR*.25|0)}
addEventListener('resize',resize);resize();

// ---------- player & input ----------
const player={pos:new THREE.Vector3(),vel:new THREE.Vector3(),yaw:-.7,pitch:-.12,onGround:false};
{let sx=8,sz=8;outer:for(let r=0;r<400;r+=4)for(let a=0;a<8;a++){const x=Math.round(Math.cos(a)*r),z=Math.round(Math.sin(a)*r);const h=terrainHeight(x,z);if(h>SEA+2&&h<50){sx=x;sz=z;break outer}}
 player.pos.set(sx+.5,terrainHeight(sx,sz)+3,sz+.5)}
const camQ=QS.get('cam');if(camQ){const v=camQ.split(',').map(Number);player.pos.set(v[0],v[1]-1.62,v[2]);player.yaw=v[3];player.pitch=v[4]}
const keys={};let locked=false,timeScale=SHOT?0:1;
const overlay=document.getElementById('overlay');if(SHOT){overlay.style.display='none';for(const id of['hotbar','info','cross'])document.getElementById(id).style.display='none'}
function setQuality(h){HIGH=h;PR=h?Math.min(devicePixelRatio,1.5):1;gtao.enabled=h;waterMat.uniforms.uRefl.value=h?1:0;cloudMat.uniforms.uSteps.value=h?36:14;setShadowRes(h?4096:2048);R=h?8:6;scene.fog.far=R*CS-4;resize()}
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(n>=1&&n<=9)select(n-1)}
 if(e.code=='KeyT')timeScale=timeScale==1?40:1;if(e.code=='KeyQ')setQuality(!HIGH);if(e.code=='Space')e.preventDefault()});
addEventListener('keyup',e=>keys[e.code]=false);
overlay.onclick=()=>renderer.domElement.requestPointerLock();
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;overlay.style.display=locked?'none':'flex'});
addEventListener('mousemove',e=>{if(!locked)return;player.yaw-=e.movementX*.0022;player.pitch=Math.max(-1.55,Math.min(1.55,player.pitch-e.movementY*.0022))});
addEventListener('contextmenu',e=>e.preventDefault());
const HOT=[GRASS,DIRT,STONE,SAND,LOG,PLANKS,COBBLE,LEAVES,GLASS];let sel=0;
const hotbar=document.getElementById('hotbar');
HOT.forEach((b,i)=>{const s=document.createElement('div');s.className='slot';const cv=document.createElement('canvas');cv.width=cv.height=TS;cv.getContext('2d').drawImage(atlasCanvas,tileFor(b,4)*TS,0,TS,TS,0,0,TS,TS);
 const im=new Image();im.src=cv.toDataURL();s.append(im);const sp=document.createElement('span');sp.textContent=i+1;s.append(sp);hotbar.append(s)});
function select(i){sel=(i+9)%9;[...hotbar.children].forEach((c,j)=>c.classList.toggle('sel',j==sel))}select(0);
addEventListener('wheel',e=>select(sel+(e.deltaY>0?1:-1)));
function collides(p){for(let x=Math.floor(p.x-.3);x<=Math.floor(p.x+.3);x++)for(let y=Math.floor(p.y);y<=Math.floor(p.y+1.79);y++)for(let z=Math.floor(p.z-.3);z<=Math.floor(p.z+.3);z++)if(isSolid(getBlock(x,y,z)))return true;return false}
function raycast(o,d,max){let x=Math.floor(o.x),y=Math.floor(o.y),z=Math.floor(o.z);const sx=Math.sign(d.x),sy=Math.sign(d.y),sz=Math.sign(d.z);
 const tdx=Math.abs(1/d.x),tdy=Math.abs(1/d.y),tdz=Math.abs(1/d.z);let tx=(sx>0?x+1-o.x:o.x-x)*tdx,ty=(sy>0?y+1-o.y:o.y-y)*tdy,tz=(sz>0?z+1-o.z:o.z-z)*tdz;let prev=null,t=0;
 while(t<=max){const b=getBlock(x,y,z);if(b!==AIR&&b!==WATER)return{x,y,z,prev,b};prev=[x,y,z];
  if(tx<ty&&tx<tz){x+=sx;t=tx;tx+=tdx}else if(ty<tz){y+=sy;t=ty;ty+=tdy}else{z+=sz;t=tz;tz+=tdz}}return null}
let hit=null;
addEventListener('mousedown',e=>{if(!locked||!hit)return;
 if(e.button===0)setBlock(hit.x,hit.y,hit.z,AIR);
 else if(e.button===2){let c=hit.prev;if(isPlant(hit.b))c=[hit.x,hit.y,hit.z];if(!c)return;const[x,y,z]=c;const p=player.pos;if(x+1>p.x-.3&&x<p.x+.3&&z+1>p.z-.3&&z<p.z+.3&&y+1>p.y&&y<p.y+1.8)return;setBlock(x,y,z,HOT[sel])}});
addEventListener('error',e=>console.error('ERR '+e.message));

// ---------- loop ----------
let dayTime=+(QS.get('t')??.3);const clock=new THREE.Clock();const info=document.getElementById('info');let frames=0,fpsT=0,fps=0;window.__ready=false;window.__f=0;
const C=(r,g,b)=>new THREE.Color(r,g,b);
const FOG_DAY=C(.30,.44,.74),FOG_GOLD=C(.62,.36,.22),FOG_NIGHT=C(.008,.014,.034),AMB_DAY=C(.42,.56,.85),AMB_NIGHT=C(.07,.10,.21),SUN_GOLD=C(1,.52,.24),SUN_DAY=C(1,.95,.87),MOONC=C(.45,.58,1);
const sm=THREE.MathUtils.smoothstep;
function updateChunks(all){const pcx=Math.floor(player.pos.x/CS),pcz=Math.floor(player.pos.z/CS);const todo=[];
 for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){if(dx*dx+dz*dz>R*R)continue;const c=getChunk(pcx+dx,pcz+dz);if(!c.mesh)todo.push([dx*dx+dz*dz,c])}
 todo.sort((a,b)=>a[0]-b[0]);const n=all?todo.length:Math.min(2,todo.length);for(let i=0;i<n;i++)buildChunk(todo[i][1]);
 if(!todo.length)window.__ready=true;
 for(const c of chunks.values()){const dx=c.cx-pcx,dz=c.cz-pcz;if(c.mesh&&dx*dx+dz*dz>(R+2)*(R+2))for(const k of['mesh','plants','water'])if(c[k]){scene.remove(c[k]);c[k].geometry.dispose();c[k]=null}}}
if(SHOT)updateChunks(true);
const dir=new THREE.Vector3(),sd=new THREE.Vector3(),ld=new THREE.Vector3(),lp=new THREE.Vector3(),tmp=new THREE.Vector3(),fogC=new THREE.Color(),skyC=new THREE.Color(),sunC=new THREE.Color();
function tick(){const dt=Math.min(clock.getDelta(),.05);const el=clock.elapsedTime+(SHOT?8:0);timeU.value=el;updateChunks(false);
 const p=player.pos;
 if(!SHOT){const inWater=getBlock(Math.floor(p.x),Math.floor(p.y+.5),Math.floor(p.z))===WATER;
  const sp=(keys.ShiftLeft?8:4.6)*(inWater?.55:1);const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);const mx=-sy*f+cy*s,mz=-cy*f-sy*s;const l=Math.hypot(mx,mz)||1;
  const acc=player.onGround?20:6;player.vel.x+=(mx/l*sp-player.vel.x)*Math.min(1,acc*dt);player.vel.z+=(mz/l*sp-player.vel.z)*Math.min(1,acc*dt);
  if(inWater){player.vel.y-=8*dt;player.vel.y*=.92;if(keys.Space)player.vel.y=Math.min(player.vel.y+25*dt,4)}else{player.vel.y-=28*dt;if(keys.Space&&player.onGround)player.vel.y=9}
  if(!getChunk(Math.floor(p.x/CS),Math.floor(p.z/CS)).mesh)player.vel.y=Math.max(player.vel.y,0);
  player.onGround=false;
  for(const a of['x','y','z']){p[a]+=player.vel[a]*dt;if(collides(p)){p[a]-=player.vel[a]*dt;if(a=='y'&&player.vel.y<0)player.onGround=true;player.vel[a]=0}}}
 camera.position.set(p.x,p.y+1.62,p.z);camera.rotation.set(player.pitch,player.yaw,0);camera.updateMatrixWorld();
 camera.getWorldDirection(dir);hit=SHOT?null:raycast(camera.position,dir,6);hl.visible=!!hit;if(hit)hl.position.set(hit.x+.5,hit.y+.5,hit.z+.5);
 // ---- day/night (10 min cycle) ----
 dayTime=(dayTime+dt*timeScale/600)%1;const ang=dayTime*Math.PI*2;sd.set(Math.cos(ang),Math.sin(ang),.32).normalize();const e=sd.y;
 const day=sm(e,-.1,.22),gold=Math.exp(-(e-.05)*(e-.05)*55)*sm(e,-.12,0),night=1-sm(e,-.2,.02);
 fogC.copy(FOG_GOLD).lerp(FOG_DAY,sm(e,.06,.42)).lerp(FOG_NIGHT,night);
 sunC.copy(SUN_GOLD).lerp(SUN_DAY,sm(e,.04,.45));
 const sunI=(6.5-1.6*sm(e,.3,.8))*sm(e,-.03,.14);
 if(e>-.03){ld.copy(sd);sun.color.copy(sunC);sun.intensity=sunI}else{ld.copy(sd).negate();sun.color.copy(MOONC);sun.intensity=.9*night}
 skyC.copy(AMB_NIGHT).lerp(AMB_DAY,day).lerp(C(.9,.6,.45),gold*.35);
 hemi.color.copy(skyC);hemi.groundColor.setRGB(.28,.24,.2).multiplyScalar(day*.9+.08);hemi.intensity=1.1;
 scene.fog.color.copy(fogC);scene.fog.near=scene.fog.far*.55;cloudMat.uniforms.uCover.value=.5+.07*sm(e,.2,.6);
 sU.sunPosition.value.copy(sd);sU.uFog.value.copy(fogC);sU.uNightK.value=night;sU.uSkyScale.value=.62-.24*sm(e,.15,.5);
 // shadows follow the player (texel-snapped)
 const snap=192/sun.shadow.mapSize.x;lp.set(Math.round(p.x/snap)*snap,Math.round(p.y),Math.round(p.z/snap)*snap);sun.target.position.copy(lp);sun.position.copy(lp).addScaledVector(ld,240);
 for(const o of[sky,clouds])o.position.copy(camera.position);ocean.position.set(Math.floor(p.x),0,Math.floor(p.z));oceanMat.uniforms.uInner.value=(R-1)*CS;stars.position.copy(camera.position);starMat.opacity=night;stars.rotation.x=ang*.5;
 moon.position.copy(camera.position).addScaledVector(sd,-1400);moon.material.opacity=sm(-e,-.15,.1);
 halo.position.copy(camera.position).addScaledVector(sd,1400);halo.material.color.copy(sunC).multiplyScalar(.7*sm(e,-.06,.05));
 // clouds
 const cu=cloudMat.uniforms;cu.sunDir.value.copy(e>-.05?sd:tmp.copy(sd).negate());cu.sunCol.value.copy(e>-.05?sunC:MOONC).multiplyScalar(e>-.05?sunI*.55+.02:.25);cu.ambCol.value.copy(skyC).multiplyScalar(.9).lerp(fogC,.3);cu.fogCol.value.copy(fogC);
 // water
 const wu=waterMat.uniforms;wu.sunDir.value.copy(ld);wu.sunCol.value.copy(sun.color).multiplyScalar(sun.intensity*.35);wu.skyCol.value.copy(skyC);wu.horizCol.value.copy(fogC);wu.fogCol.value.copy(fogC);wu.fogNear.value=scene.fog.near;wu.fogFar.value=scene.fog.far;wu.uSunVis.value=e>-.03?1:.6;
 // render: reflection -> god-ray occlusion -> composer
 renderer.shadowMap.needsUpdate=true;
 if(HIGH)renderReflection();
 tmp.copy(camera.position).addScaledVector(ld,1400);const sp2=tmp.clone().project(camera);const facing=dir.dot(ld);
 sunOcc.position.copy(tmp);sunOcc.material.color.copy(e>-.03?sunC:MOONC);
 const gInt=(e>-.03?.55*sm(e,-.03,.08)*(1+gold*.8):.25*night)*sm(facing,.1,.6);godrays.uniforms.uInt.value=gInt;godrays.uniforms.uCol.value.copy(e>-.03?sunC:MOONC);godrays.uniforms.sunPos.value.set(sp2.x*.5+.5,sp2.y*.5+.5);
 if(gInt>0)renderOcclusion();
 composer.render(dt);
 frames++;fpsT+=dt;window.__f++;if(fpsT>.5){fps=Math.round(frames/fpsT);frames=0;fpsT=0}
 info.textContent=`FPS ${fps}  ${HIGH?'HIGH':'LOW'} quality (Q)  XYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ${String(((dayTime*24+6)%24)|0).padStart(2,'0')}:00`;
 requestAnimationFrame(tick)}
tick();console.log('VOXEL_OK');
