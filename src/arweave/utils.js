import { turboNetwork } from "./constants.js";
import BN from "bn.js";
export const BigNumber = (t)=>{
	const number = new BN(isNaN(t) ? 0 : t)
	fixBN(number)
	return number
}
export const fixBN = (number)=>{
	number.plus = (a)=>{
		const x = number.add(new BN(a));
		fixBN(x)
		return x;
	}
}

export async function blobToBase64(blob) {
  const buffer = Buffer.from(blob.arraybuffer || (await blob.arrayBuffer()));
  return `data:${blob.type};base64,${buffer.toString("base64")}`;
}

export const transformToTurbo = (instance)=>{ //this is just to adapt the irys sdk to turbo
	instance.getLoadedBalance = async function(){	
		const d = await fetch(turboNetwork.payment+"/v1/balance?address="+this.address);
		const t = await d.text();
		return BigNumber(t)
	};
	instance.funder.submitTransaction = async function(tx_id){

		const requestOptions = {
			method: 'POST',
			headers: {"Content-Type":"application/json"},
			body: JSON.stringify({tx_id})
		};

		const response = await fetch(turboNetwork.payment+"/v1/account/balance/solana", requestOptions)
		const text = await response.text();
		try {
			const json = JSON.parse(text);
			return json
		}catch(e){
		}
		return null
	}
	instance.getPrice = async function(x){	
		const wincPrice = await fetch(turboNetwork.payment+"/price/bytes/"+x);
		const tWincPrice = await wincPrice.text();
		const oneWinPriceSolana = await fetch(turboNetwork.payment+"/v1/price/solana/1");
		const tOneWinPriceSolana = await oneWinPriceSolana.json();
		const lamportsNeeded = Number(tWincPrice) / Number(tOneWinPriceSolana.winc);
		return BigNumber(lamportsNeeded)
	};
}