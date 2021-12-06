import { Request, Response } from 'express';
import { Params } from './types';
import { v4 as uuid } from 'uuid';
import { fetchQueryAndSaveResponse } from './processQuery';
import { cleanupAfterRequest } from './writeFiles';

const maxReqs = 10;

let currentReqs = 0;

export const handleQueryRequest = async (req: Request, res: Response) => {
    if (currentReqs >= maxReqs) {
        return res
            .status(503)
            .send('Service is currently busy - try again in a moment');
    }

    const { branch, query } = req.query as Params;

    if (branch !== 'published' && branch !== 'unpublished') {
        return res
            .status(400)
            .send(
                'Parameter "branch" must be either "published" or "unpublished"'
            );
    }

    currentReqs++;
    const requestId = uuid();
    const startTime = Date.now();

    console.log(
        `Start processing request ${requestId} - branch: ${branch} - query: ${query} - number of concurrent requests: ${currentReqs}`
    );

    try {
        await fetchQueryAndSaveResponse(req, res, requestId);
    } catch (e) {
        cleanupAfterRequest(requestId);
        return res
            .status(500)
            .send(`Server error on request ${requestId} - ${e}`);
    } finally {
        currentReqs--;
        const timeSpentSec = (Date.now() - startTime) / 1000;
        console.log(
            `Finished processing request ${requestId} - time spent: ${timeSpentSec}`
        );
    }
};
