interface Block {
	number: number;
	timestamp: number;
}

type Bucket = number;

interface BucketPair {
	blockBucket: Bucket;
	timestampBucket: Bucket;
}

interface Buckets {
	currentBuckets: BucketPair;
	nextBuckets: BucketPair;
}

type IntervalID = number;

// TODO this is only temporary
interface TxRequest {
	refreshData: Function;
}
  
export {
	Block,
	Bucket,
	BucketPair,
	Buckets,
	IntervalID,
	TxRequest,
}
  