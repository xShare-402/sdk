  import { VersionedTransaction, Transaction } from "@solana/web3.js"
  
  export async function searchAssets({page,size,connection,owner,creator,verifiedAddress,collection}){

    const params = {
        burnt:false,
        page:page||1,
        limit:size||100,
        displayOptions: { showRawData: true },
        sortBy: { sortBy: "created",sortDirection: "desc" },
        collectionNft:false
    }

    if(owner) params.ownerAddress = owner;
    if(creator){
        params.creatorAddress = creator;
        if(verifiedAddress){
            params.creatorVerified = true;
        } else {
            params.creatorVerified = false;
        }
    }
    if (collection) params.grouping = ["collection", collection];
    
    const data = await connection._rpcRequest("searchAssets", params);
    return data?.result?.items;

  }

  export const buildTransaction = (serialized)=>{
    const readShortVecU16 = (bytes, start = 0) => {
		// Solana shortvec (7 bits per byte, MSB=continue)
		let len = 0, size = 0, shift = 0;
		for (; ;) {
			const b = bytes[start + size];
			len |= (b & 0x7f) << shift;
			size += 1;
			if ((b & 0x80) === 0) break;
			shift += 7;
		}
		return { len, size };
	};

	return [{serialized}].map(({ serialized }) => {
		const { len: sigCount, size: sigLenSize } = readShortVecU16(serialized, 0);
		const sigsStart = sigLenSize;
		const msgStart = sigsStart + sigCount * 64;
		const isVersioned = (serialized[msgStart] & 0x80) !== 0;

		let transaction_ = false;
		if (isVersioned) {
			transaction_ = VersionedTransaction.deserialize(serialized);
		} else {
			transaction_ = Transaction.from(serialized);
		}
        if (!transaction_.serializeMessage) transaction_.serializeMessage = () => (transaction_.message.serialize())
		return transaction_
	})[0]
  }