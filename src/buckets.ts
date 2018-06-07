type Bucket = number;

interface BucketPair {
  blockBucket: Bucket;
  timestampBucket: Bucket;
}

interface Buckets {
  currentBuckets: BucketPair;
  nextBuckets: BucketPair;
}

const BucketSize = {
  block: 240,
  timestamp: 3600,
};

export { Bucket, BucketPair, Buckets, BucketSize };
