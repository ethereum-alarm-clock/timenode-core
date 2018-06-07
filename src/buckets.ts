type Bucket = number;

interface IBucketPair {
  blockBucket: Bucket;
  timestampBucket: Bucket;
}

interface IBuckets {
  currentBuckets: IBucketPair;
  nextBuckets: IBucketPair;
}

const BucketSize = {
  block: 240,
  timestamp: 3600,
};

export { Bucket, IBucketPair, IBuckets, BucketSize };
