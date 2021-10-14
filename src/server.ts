import express from 'express';
import { v4 as uuid } from 'uuid';
import { batchedFetchAndSave } from './fetch.js';
import {
    cleanupAfterRequest,
    zipQueryResultAndGetFileName,
} from './writeFiles.js';
import { Params } from './types.js';
import fs from 'fs';

const app = express();
const appPort = 2999;

const localXpOrigin = 'http://localhost:8080';

const xpOrigin = process.env.XP_ORIGIN || localXpOrigin;
const xpServicePath = '/_/service/no.nav.navno/dataQuery';

const xpUrl = `${xpOrigin}${xpServicePath}`;

let waiting = false;

app.get('/query', async (req, res) => {
    if (waiting) {
        return res
            .status(503)
            .send('Service is currently busy - try again in a moment');
    }

    waiting = true;
    const requestId = uuid();

    try {
        const queryString = new URL(req.url, xpOrigin).search;
        const url = `${xpUrl}${queryString}`;

        await batchedFetchAndSave(url, requestId);

        const { branch } = req.query as Params;
        const zipFileName = await zipQueryResultAndGetFileName(
            requestId,
            branch
        );
        const zippedData = fs.readFileSync(zipFileName);

        res.set('Content-Type', 'application/zip');
        res.attachment(zipFileName);

        return res.status(200).send(zippedData);
    } catch (e) {
        return res.status(500).send(`Server error - ${e}`);
    } finally {
        cleanupAfterRequest(requestId);
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
