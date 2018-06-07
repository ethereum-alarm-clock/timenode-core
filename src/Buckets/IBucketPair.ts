type Bucket = number;

interface IBucketPair {
	blockBucket: Bucket;
	timestampBucket: Bucket;
};

export {
	Bucket,
	IBucketPair
};