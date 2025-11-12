import * as nacl from 'tweetnacl';
import { Keypair } from "@solana/web3.js";
import { XShare402 } from "./src/index.js"
import { readFileSync } from "fs";
import * as Crypto from "crypto";
import bs58 from "bs58";

const keypairData = JSON.parse(readFileSync("../../keypair.json", "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));

const heliusRpc = readFileSync("../../rpc.json", "utf-8");
const magicBlockRpc = "https://devnet-us.magicblock.app";

const xShare402 = new XShare402({solanaRpc:heliusRpc, network:"devnet", magicBlockRpc,wallet})

const runAdDeletionTest = async ({ad}={})=>{
    if(!ad){
        const myAds = await xShare402.myAds({loadMetadatas:true});
        if(myAds?.length){
            const randomAd = myAds[Math.floor(Math.random()*myAds.length)];
            ad = randomAd?.ad;
        }
    }
    if(!ad) return;
    console.log("AD",ad);
    const deleted = await xShare402.deleteAd({ad});
    console.log("Deleted",deleted);
}
const runAdTest = async ({placeBid})=>{
    const billboards = await xShare402.billboards({currency:null});
    const randomBillboard = billboards[Math.floor(Math.random()*billboards.length)];
    const myAds = await xShare402.myAds({loadMetadatas:true});

    let selectedAd = false;
    if(myAds?.length){
        const randomAd = myAds[Math.floor(Math.random()*myAds.length)];
        selectedAd = randomAd?.ad;
    } else { //have no ads, lets create one
        const metadata = {
            cover:"https://gateway.irys.xyz/v9w5mcCY1aLFvJWI-h3ZmEjeXhaXy6cT5vm87cJH2e4?ext=png",
            mainFile:"https://gateway.irys.xyz/YWpLAhmrhnZ2ca9jDa6n89kWrLCojIiq4DZBPFq-CdI?ext=mp4", //can be a .glb, .html, .mp3, .mp4
            link:"https://xsha.re",
            name:"Goblin Coin",
            description:"Access the whitelist to mint the new memecoin of the market." //we add a random string just to identify it from other ones in our tests
        }
        const newAd = await xShare402.createAd({metadata});
        selectedAd = newAd?.ad;
    }

    if(!selectedAd) return;

    if(placeBid){

        const budget = {
            totalBudget:0.1*10**9, //in lamports
            perClick:0.0001*10**9,
            perView:0.00001*10**9,
        }
        const maxViewsPerDay = 1000;
        const stakingCost = await xShare402.calculateAdStakingCost(maxViewsPerDay);
        console.log("Staking cost: "+stakingCost.sol+" SOL (this is returned when bid is closed)");
        const bidPlaced = await xShare402.bidOnBillboard({
            billboard:randomBillboard.billboard, //pubkey
            ad:selectedAd,
            budget,
            maxViewsPerDay
        })
    }
    console.log("myAds",myAds);

}

runAdTest({placeBid:true});
//runAdDeletionTest();