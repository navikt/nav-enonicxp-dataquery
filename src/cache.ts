import NodeCache from 'node-cache';

const halfHour = 1800;

const cache = new NodeCache({ stdTTL: halfHour });

type CacheItem = {
    requestId: string;
    timestamp: number;
    progress: number;
};
