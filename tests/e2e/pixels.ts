import {inflateSync} from 'node:zlib';
// Decode the small browser screenshot to verify that the CRT actually shows a trace.
export function crtPixels(png:Buffer,roi?:{x:number;y:number;width:number;height:number}){let offset=8,width=0,height=0,channels=0;const chunks:Buffer[]=[];
 while(offset<png.length){const size=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+size);if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);channels=data[9]===6?4:3;}if(type==='IDAT')chunks.push(data);offset+=size+12;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,decoded=Buffer.alloc(stride*height);let src=0,count=0;
 const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[src++];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?decoded[i-channels]:0,b=y?decoded[i-stride]:0,c=y&&x>=channels?decoded[i-stride-channels]:0;decoded[i]=(raw[src++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
 for(let i=0;i<decoded.length;i+=channels){const px=i/channels,x=px%width,y=Math.floor(px/width);if(roi&&(x<roi.x||x>=roi.x+roi.width||y<roi.y||y>=roi.y+roi.height))continue;const r=decoded[i],g=decoded[i+1],b=decoded[i+2];if(r>175&&g>220&&b<190&&g>r)count++;}return count;
}
