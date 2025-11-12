import {
  Connection,
  PublicKey
} from "@solana/web3.js";
import { adsCollection,bloomAccuracy, billboardsCollection,programId,store, x402Url } from "./constants.js";
import { searchAssets,buildTransaction } from "./utils/solana.js";
import { optimalBloomParameters, buildMetadata } from "./utils/index.js";
import { TurboUploader } from "./arweave/index.js";
import bs58 from "bs58";
const simulate = 1;
export class XShare402 {

    programId = new PublicKey(programId)
    store = new PublicKey(store);
    constructor({solanaRpc, network, magicBlockRpc,wallet}){
        this.wallet = wallet;
        this.network = network;
        this.uploader = new TurboUploader();
        this.uploader.init({wallet, rpc:solanaRpc});
        this.connections = {
            solana: new Connection(solanaRpc, "confirmed"),
            magicBlock: new Connection(magicBlockRpc, "confirmed"),
        }
    }

    async processX402Transaction(transaction){
        console.log("PROCESS",transaction?.status)
        const payer = this.wallet.publicKey.toBase58();
        const body = JSON.stringify({payer, simulate, network:this.network});

        if(transaction?.status != 402) throw "Expected 402 code";
        const responseJson = await transaction.json();
        console.log("responseJson",responseJson)

        const builtTransaction = buildTransaction(bs58.decode(responseJson.transaction));
        builtTransaction.sign([this.wallet]);

        const transactionBytes = builtTransaction.serialize();
        const sentTransaction = await fetch(x402Url+"/ad/create", {method:"POST", headers:{'X-Payment':bs58.encode(transactionBytes),'Content-Type':'application/json'}, body}).catch(e=>{})
        if(sentTransaction?.status != 201 && sentTransaction?.status != 200) throw "Couldn't complete transaction"
        const successfulTransaction = await sentTransaction.json();
        if(successfulTransaction?.success) return responseJson.payload;

        return null;
    }

    async myAds({loadMetadatas=false}={}){
        const myAds = await searchAssets({connection:this.connections.solana, creator:this.wallet.publicKey.toBase58(), collection:adsCollection});
        return await Promise.all(myAds.map(async (x)=>{
            let fullMetadata;
            try{
                if(loadMetadatas) fullMetadata = await (await fetch(x.content.json_uri)).json();
            }catch(e){}
            return {
                fullMetadata:{
                    name:fullMetadata.name,
                    description:fullMetadata.description,
                },
                fullMetadataUri:x.content.json_uri,
                metadata:{
                    cover:x.content.links.image,
                    files:x.content.files.map((file)=>({uri:file.uri, type:file.mime}))
                },
                ad:x.creators[2].address,
            }
        }));
    }

    async calculateAdStakingCost(maxViews){
        const [bits] = optimalBloomParameters(maxViews,1/bloomAccuracy);
        const neededBytes = (bits/8)*2; //times 2, cause we need a bloom filter for views and another one for clicks
        const lamports = await this.connections.solana.getMinimumBalanceForRentExemption(neededBytes);
        return {lamports, sol:lamports / 10**9}
    }

    async bidOnBillboard({ad,billboard,budget,maxViewsPerDay}={}){

        const payer = this.wallet.publicKey.toBase58();
        const body = JSON.stringify({
            config:{
                bloomAccuracy:15000,
                maxViewers:maxViewsPerDay,
                budgetPerView:budget.perView,
                budgetPerClick:budget.perClick,
                budget:budget.totalBudget
            },
            ad,
            billboard,
            payer,
            network:this.network,
            priortyFee:10_000,
            computeBudget:300_000
        });
        const transaction = await fetch(x402Url+"/bid/create", {method:"POST", headers:{'Content-Type':'application/json'}, body}).catch(e=>{})
        return this.processX402Transaction(transaction);

    }

    async deleteAd({ad}={}){

        const payer = this.wallet.publicKey.toBase58();
        const body = JSON.stringify({
            ad,
            payer,
            network:this.network
        });
        const transaction = await fetch(x402Url+"/ad/delete", {method:"POST", headers:{'Content-Type':'application/json'}, body}).catch(e=>{})
        return this.processX402Transaction(transaction);
        
    }

    async createAd({metadata,metadataUri}={}){

        //Metadata upload to Arweave
        let name = metadata?.name;
        if(!metadataUri && metadata){
            const builtMetadata = await buildMetadata(metadata);
            const uploadedJson = await this.uploader.uploadJson(builtMetadata);
            if(!uploadedJson) throw "Couldn't upload metadata";
            metadataUri = "https://arweave.net/"+uploadedJson;
        } else if(!metadataUri){
            throw "Missing metadata or metadataUri"
        } else {
            const json = await (await fetch(metadataUri)).json();
            name = json.name;
        }
        //Finish metadata upload

        const payer = this.wallet.publicKey.toBase58();
        const body = JSON.stringify({
            metadataUri:metadataUri,
            name,
            payer,
            network:this.network
        })
        const transaction = await fetch(x402Url+"/ad/create", {method:"POST", headers:{'Content-Type':'application/json'}, body}).catch(e=>{})
        return this.processX402Transaction(transaction);
    }

    async billboards({currency}={}){
        const billboards = await searchAssets({connection:this.connections.solana, creator:currency, collection:billboardsCollection});
        return billboards.map((x)=>{
            return {
                metadata:{
                    xAccount:x.content.metadata.attributes.find(x=>x.trait_type=="x")?.value,
                    categories:x.content.metadata.attributes.find(x=>x.trait_type=="categories")?.value,
                    maxDuration:x.content.metadata.attributes.find(x=>x.trait_type=="maxDuration")?.value,
                    permissionType:x.content.metadata.attributes.find(x=>x.trait_type=="permission")?.value,
                },
                creator:x.creators[0].address,
                billboard:x.creators[2].address,
                currency:x.creators[4]?.address || null
            }
        })
    }

}