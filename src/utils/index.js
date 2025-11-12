import { fileTypeFromBuffer } from 'file-type';

export function optimalBloomParameters(n, p) { //capacity, 1/accuracy
    const ln2 = Math.log(2);
    const ln2_squared = ln2 * ln2;

    const m = Math.ceil(-(n * Math.log(p)) / ln2_squared);
    const k = Math.round((m / n) * ln2);

    const ma = Math.floor(m / 8); // bytes
    return [ma * 8, k]; // return bits and hash count
}

async function getFileType(url) {
  // Download file into memory
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Try to detect file type from the buffer
  const type = await fileTypeFromBuffer(buffer);

  // Fallback to Content-Type header if necessary
  const mime = type?.mime || response.headers.get('content-type') || 'unknown';
  const ext = type?.ext || 'unknown';

  return { mime, ext, size: buffer.length };
}

export const buildMetadata = async (metadata)=>{
    
    const imageType = (await getFileType(metadata.cover))?.mime;
    if(!imageType) throw "Wrong cover file type"

    const imageFile = {
        uri:metadata.cover,
        type:imageType
    };

    const files = [];
    files.push(imageFile);
    let category = "image";
    let animation_url;
    if(metadata.mainFile){
        const mainFileType = (await getFileType(metadata.mainFile))?.mime;
        if(!mainFileType) throw "Missing mainfile type"
        if(mainFileType.includes("video")){
            animation_url = metadata.mainFile;
            category = "video"
        } else if(mainFileType.includes("audio")){
            animation_url = metadata.mainFile;
            category = "audio"
        } else if(mainFileType.includes("model")){
            animation_url = metadata.mainFile;
            category = "vr"
        } else if(mainFileType.includes("html")){
            animation_url = metadata.mainFile;
            category = "html"
        }
        files.push({
            uri:metadata.mainFile,
            type:mainFileType
        });
    }

    const nftMetadata = {
        name:metadata.name,
        description:metadata.description,
        external_url:metadata.link,
        image:metadata.cover,
        properties:{
            files
        },
        animation_url,
        category
    };
    return nftMetadata
}

export const waitFor = async (c,timeout=60000)=>{
  return new Promise((re,rej)=>{
      let times = 0;
      let timer = setInterval(()=>{
          const cr = c();
          if(cr){
              clearInterval(timer);
              re(cr);
              return;
          }
          if(timeout && times>(timeout/50)){
              clearInterval(timer);
              re(false);
          } else {
              times++;
          }
      },50)
  })
}

export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
	
	let arr = null;
	if(typeof str != "string"){
		if(Array.isArray(str)){
			arr = str;
		} else {
			str = str+"";
		}
	}
	if(arr){
		for (const ch of arr) {
			h1 = Math.imul(h1 ^ ch, 2654435761);
			h2 = Math.imul(h2 ^ ch, 1597334677);
		}
	} else {
		for (let i = 0, ch; i < str.length; i++) {
			ch = str.charCodeAt(i);
			h1 = Math.imul(h1 ^ ch, 2654435761);
			h2 = Math.imul(h2 ^ ch, 1597334677);
		}
	}
	h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
	h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
	return 4294967296 * (2097151 & h2) + (h1>>>0);
}

export function bytesTo16(a) {
  const dv = new DataView(Uint8Array.from(a).buffer);
  return dv.getUint16(0, true);
}
export function bytesTo32(a) {
  const dv = new DataView(Uint8Array.from(a).buffer);
  return dv.getUint32(0, true);
}
export function bytesTo64(a) {
  const dv = new DataView(Uint8Array.from(a).buffer);
  const lo = dv.getUint32(0, true);
  const hi = dv.getUint32(4, true);
  return Number((BigInt(hi) << 32n) | BigInt(lo));
}