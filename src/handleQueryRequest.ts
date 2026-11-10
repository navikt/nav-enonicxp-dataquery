import { Request, Response } from 'express';
import { Branch, Params } from './types';
import { v4 as uuid } from 'uuid';
import { fetchQueryAndSaveResponse } from './processQuery';
import { cleanupAfterRequest } from './writeFiles';
import { logger, stringifyError } from './logger';
import {
    activeQueries,
    countQueryFailure,
    countQuerySuccess,
    failureReasonFor,
    maxActiveQueries,
    queryDuration,
} from './metrics';

const maxReqs = 3;

let currentReqs = 0;

maxActiveQueries.set(maxReqs);

const validBranches: {[key in Branch]: true} = {
    'archived': true,
    'published': true,
    'unpublished': true
}

export const handleQueryRequest = async (req: Request, res: Response) => {
    const { branch, query } = req.query as Params;

    if (!validBranches[branch]) {
        countQueryFailure(branch, 'invalid');
        return res
            .status(400)
            .send(
                `Parameter "branch" must be one of ${Object.keys(validBranches).join(', ')}`
            );
    }

    if (currentReqs >= maxReqs) {
        countQueryFailure(branch, 'busy');
        return res
            .status(503)
            .send('Service is currently busy - try again in a moment');
    }

    currentReqs++;
    activeQueries.inc();
    const requestId = uuid();
    const startTime = Date.now();

    logger.info(
        { requestId, branch, query, currentReqs },
        'Start processing request'
    );

    try {
        await fetchQueryAndSaveResponse(req, res, requestId);
        countQuerySuccess(branch);
        queryDuration.observe({ branch }, (Date.now() - startTime) / 1000);
    } catch (e) {
        const reason = failureReasonFor(e);
        countQueryFailure(branch, reason);
        logger.error(
            { requestId, reason, error: stringifyError(e) },
            'Error on request'
        );
        cleanupAfterRequest(requestId);
        if (!res.headersSent) {
            return res
                .status(500)
                .send(`Server error on request ${requestId} - ${String(e)}`);
        }
    } finally {
        currentReqs--;
        activeQueries.dec();
        const timeSpentSec = (Date.now() - startTime) / 1000;
        logger.info(
            { requestId, timeSpentSec },
            'Finished processing request'
        );
    }
};
