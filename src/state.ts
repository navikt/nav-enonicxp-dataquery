import NodeCache from 'node-cache';
import { cleanupAfterRequest, getResultFilename } from './writeFiles';
import { Branch } from './types';

type CacheItem = {
    expires: number;
    filename: string;
    progress: number;
    isDone: boolean;
    requestId: string;
    branch: Branch;
    query?: string;
};

const ttlSec = 120;

const cache = new NodeCache({ stdTTL: ttlSec, checkperiod: 60 });

cache.on('expired', (requestId: string) => {
    cleanupAfterRequest(requestId);
});

const setRequestState = (requestId: string, reqState: CacheItem) =>
    cache.set<CacheItem>(requestId, reqState);

export const getRequestState = (requestId: string) =>
    cache.get<CacheItem>(requestId);

export const getAllRequestStates = () =>
    cache.keys().map((key) => getRequestState(key));

export const addRequest = (
    requestId: string,
    branch: Branch,
    progress: number
) =>
    setRequestState(requestId, {
        progress,
        filename: getResultFilename(requestId, branch),
        isDone: false,
        requestId,
        branch,
        expires: 0,
    });

export const updateRequestProgress = (requestId: string, progress: number) => {
    const currentState = getRequestState(requestId);

    if (!currentState) {
        throw new Error('Request not found');
    }

    setRequestState(requestId, { ...currentState, progress });
};

export const markRequestDone = (requestId: string) => {
    const currentState = getRequestState(requestId);

    if (!currentState) {
        throw new Error('Request not found');
    }

    setRequestState(requestId, {
        ...currentState,
        isDone: true,
        expires: Date.now() + ttlSec * 1000,
    });
};
