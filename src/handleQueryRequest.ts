import { Request, Response } from 'express';
import { Branch, Params } from './types';
import { v4 as uuid } from 'uuid';
import { fetchQueryAndSaveResponse } from './processQuery';
import { cleanupAfterRequest } from './writeFiles';

const maxReqs = 3;

let currentReqs = 0;

const validBranches: {[key in Branch]: true} = {
    'archived': true,
    'published': true,
    'unpublished': true
}

export const handleQueryRequest = async (req: Request, res: Response) => {
    if (currentReqs >= maxReqs) {
        return res
            .status(503)
            .send('Service is currently busy - try again in a moment');
    }

    const { branch, query } = req.query as Params;

    if (!validBranches[branch]) {
        return res
            .status(400)
            .send(
                `Parameter "branch" must be one of ${Object.keys(validBranches).join(', ')}`
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
        console.error(`Error on request ${requestId} - ${e}`);
        cleanupAfterRequest(requestId);
        if (!res.headersSent) {
            return res
                .status(500)
                .send(`Server error on request ${requestId} - ${e}`);
        }
    } finally {
        currentReqs--;
        const timeSpentSec = (Date.now() - startTime) / 1000;
        console.log(
            `Finished processing request ${requestId} - time spent: ${timeSpentSec}`
        );
    }
};
