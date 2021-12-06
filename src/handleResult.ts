import { Request, Response } from 'express';
import NodeCache from 'node-cache';
import { cleanupAfterRequest, getResultFilename } from './writeFiles';
import { Branch } from './types';

type CacheItem = {
    timestamp: number;
    progress: number;
    filename: string;
};

const cache = new NodeCache({ stdTTL: 1800 });

cache.on('expired', (requestId: string, cacheItem: CacheItem) => {
    cleanupAfterRequest(requestId);
});

const getReqState = (requestId: string) => cache.get<CacheItem>(requestId);

const setReqState = (requestId: string, reqState: CacheItem) =>
    cache.set<CacheItem>(requestId, reqState);

const addRequest = (requestId: string, branch: Branch, progress: number) =>
    setReqState(requestId, {
        progress,
        timestamp: Date.now(),
        filename: getResultFilename(requestId, branch),
    });

const updateProgress = (requestId: string, progress: number) => {
    const currentState = getReqState(requestId);

    if (!currentState) {
        throw new Error('Request not found');
    }

    setReqState(requestId, { ...currentState, progress });
};

export const handleResult = async (req: Request, res: Response) => {
    const { requestId } = req.params;

    if (!requestId) {
        return res.status(400).send('Missing requestId in url');
    }

    const reqState = cache.get<CacheItem>(requestId);

    if (!reqState) {
        return res.status(404).send('Not found');
    }

    const { filename, progress } = reqState;

    if (progress !== 100) {
        return res
            .status(204)
            .send({ message: `Result is not ready`, progress: progress });
    }

    if (!filename) {
        return res.status(500).send('Server error: filename was not defined');
    }

    return res.status(200).attachment(filename).sendFile(filename);
};
