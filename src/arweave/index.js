import * as Hash from 'ipfs-only-hash';
import * as BN from "bn.js";
import * as crypto from "crypto";
import bs58 from "bs58";
import { cyrb53,waitFor } from "../utils/index.js";
import { turboNetwork } from "./constants.js";
import { blobToBase64, fixBN, BigNumber, transformToTurbo } from "./utils.js";
import Irys from '@irys/sdk';


export class TurboUploader {
	async verifyBalance(id){
		try{
			const submited = await this.irys.funder.submitTransaction(id);
			return submited;
		}catch(e){
		}
		return false;
	}
	async getBalance(){
		return this.irys.getLoadedBalance();
	}
	async checkFileExistence(id){
		try{
			const exists = await fetch(turboNetwork.main+"/tx/"+id+"/status");
			const json = await exists.json();
			return json;
		}catch(e){
			return null
		}
	}

	async bundle({file, isMetadata=false,skipPrice=true,noCid=false}){
		
		try{			
			const {type,name} = file;
			
			const tags = [{name: "Content-Type", value: type}];
			const irys_wallet = this.irys.address;
			file.arraybuffer = file.arraybuffer || (await file.arrayBuffer());
			const data = file.arraybuffer;
			const b = await blobToBase64(file);
			const proof = cyrb53(b);
			const buffer =  Buffer.from(data);
			const hash = !noCid ? (await Hash.of(buffer)) : null;
			console.log("hash",hash);
			file.nonce = hash ? bs58.decode(hash).slice(2,34) : crypto.randomBytes(32).toString("base64").slice(0, 32);
			const nonce = file.nonce
			let transaction = this.irys.createTransaction(data,{anchor:nonce, tags})
			const {size} = transaction;
			let price = null;
			let slippage_fee = null;
			if(!skipPrice){
				price = await this.irys.getPrice(transaction.size);
				slippage_fee = Math.round(price.div(new BN(6)).toNumber());
			}
			await transaction.sign();
			const extension = this.getFileExtension(file);
			const id = transaction?.id;
			if(!id) throw "No id";
			const url = "https://arweave.net/"+id+((extension && !file.isMetadata && !isMetadata) ? ("?ext="+extension) : "");
			file.payload = false;
			file.irys = {id, size, url, proof, extension, nonce, transaction, irys_wallet, price:price?.toNumber?.() || null, slippage_fee}
			return file;
		} catch(e){
			console.log("TurboUploader Error:",e)
			return false;
		}
	}

	async getFundingInstructions({files,payer}){
		if(!payer) payer = this.wallet.publicKey;
		let bytes = 0;
		let price = false;
		for(const file of files){
			const files_price = await this.irys.getPrice(file.irys.size);
			if(!price){
				price = files_price;
			} else {
				price = price.plus(files_price);
			}
			bytes += file.irys.size;
			file.irys.price = price.toNumber();
		}
		const irys_address = await this.getAddress();
		const slippage_fee = Math.round(price.div(new BN(6)).toNumber());
		price = price.plus(slippage_fee);
		const from_user_to_manager = SystemProgram.transfer({
			fromPubkey: toPublicKey(payer),
			toPubkey: this.wallet.publicKey,
			lamports: price,
		})
		const from_manager_to_irys = SystemProgram.transfer({
			fromPubkey: this.wallet.publicKey,
			toPubkey: toPublicKey(irys_address),
			lamports: price,
		})
		return {instructions:[from_user_to_manager,from_manager_to_irys], bytes, price:price.toNumber()}
	}

	getFileExtension(file){
		const parts = (file?.name||"").split(".");
		const extension = parts.length>1 ? parts.pop() : (file.type.split("/")[1] || null);
		return extension
	}

	async prepareJson(json,isMetadata){
		await this.ready();
		const bytes = new TextEncoder().encode(JSON.stringify(json));
		const arraybuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
		const file = {arraybuffer, type:"application/json"};
		const bundledFile = await this.bundle({file, skipPrice:true, isMetadata})
		return bundledFile
	}

	async uploadJson(json,isMetadata=true){
		console.log("UPLOAD",json);
		const bundledFile = await this.prepareJson(json,isMetadata)
		if(!bundledFile) return false
		return this.uploadFile(bundledFile)
	}

	async syncBalance(forced){
		this.balance = await this.getBalance(forced);	
		return this.balance
	}

	async uploadFile(bundled){
		try{
			console.log("Uploading: "+bundled.irys.url)
			const subida = await bundled.irys.transaction.upload();
			if(subida){
				return bundled.irys.id
			} else {
				throw "";
			}
		} catch(e){
			
			const error = e+"";
			if(error.includes("already received")){
				return bundled.irys.id
			}
			console.log("ERROR",e)
		}
		return false;
	}

	async getAddress(){
		const addr = await this.irys.utils.getBundlerAddress("solana")
		return addr;
	}

	async ready(){
		await waitFor(()=>this.isReady)
	}

	async init(opts){
		
		if(opts?.wallet){
			this.wallet = opts?.wallet;
		} else {
			throw "no wallet"
		}

		console
		
		this.irys = new Irys({url:turboNetwork.main, token:"solana", key:this.wallet?.secretKey, config:{ providerUrl: opts?.rpc }});
		transformToTurbo(this.irys);
		await this.irys.ready();
		const to = await this.getAddress();
		if(!opts?.ignore_balance){
			const bal = await this.getBalance();
			this.balance = bal;
		}
		this.isReady = true;
		return true;
	}

}