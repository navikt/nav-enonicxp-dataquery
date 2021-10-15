import express from 'express';
import { v4 as uuid } from 'uuid';
import { fetchQueryAndSaveResponse } from './fetch.js';
import {
    cleanupAfterRequest,
    zipQueryResultAndGetFileName,
} from './writeFiles.js';
import { Params } from './types.js';

const app = express();
const appPort = 2999;

let waiting = false;

app.get('/query', async (req, res) => {
    if (waiting) {
        return res
            .status(503)
            .send('Service is currently busy - try again in a moment');
    }

    waiting = true;

    const requestId = uuid();
    const { branch, query } = req.query as Params;

    console.log(
        `Start processing request ${requestId} - branch: ${branch} - query: ${query}`
    );

    res.on('finish', () => cleanupAfterRequest(requestId));

    try {
        await fetchQueryAndSaveResponse(req, requestId);

        const zipFileName = await zipQueryResultAndGetFileName(
            requestId,
            branch
        );

        return res.status(200).attachment(zipFileName).sendFile(zipFileName);
    } catch (e) {
        return res
            .status(500)
            .send(`Server error on request ${requestId} - ${e}`);
    } finally {
        waiting = false;
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
