import express from 'express';
import { v4 as uuid } from 'uuid';
import { fetchQueryAndSaveResponse } from './processQuery.js';
import {
    cleanupAfterRequest,
    zipQueryResultAndGetFileName,
} from './writeFiles.js';
import { Params } from './types.js';

const app = express();
const appPort = 2999;

const fiveMinutesInMs = 5 * 60 * 1000;

const maxReqs = 10;
let currentReqs = 0;

app.get('/query', async (req, res) => {
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
});

app.get('/internal/isAlive', (req, res) => {
    return res.status(200).send('I am alive!');
});

app.get('/internal/isReady', (req, res) => {
    return res.status(200).send('I am ready!');
});

const server = app.listen(appPort, () => {
    console.log(`Server starting on port ${appPort}`);
});

const shutdown = () => {
    console.log('Server shutting down');

    server.close(() => {
        console.log('Shutdown complete!');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
