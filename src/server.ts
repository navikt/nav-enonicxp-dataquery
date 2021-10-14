import express from 'express';
import fetch from 'node-fetch';

const app = express();
const appPort = 2999;

const localXpOrigin = 'http://localhost:8080';

const xpOrigin = process.env.XP_ORIGIN || localXpOrigin;
const xpServicePath = '/_/service/no.nav.navno/dataQuery';

const serviceSecret = process.env.XP_SERVICE_SECRET || 'dummyToken';

const xpUrl = `${xpOrigin}${xpServicePath}`;

console.log(xpOrigin, serviceSecret.substr(0, 4));

let waiting = false;

app.get('/query', async (req, res) => {
    if (waiting) {
        return res.status(503).send('Service is currently busy - try again in a moment');
    }

    waiting = true;

    try {
        const { branch } = req.query;
        const queryString = new URL(req.url, xpOrigin).search;
        const url = `${xpUrl}${queryString}`;
        console.log(`Trying url ${url}`);

        const response = await fetch(url, { headers: { secret: serviceSecret } });

        const isJson = response.headers
            ?.get('content-type')
            ?.includes?.('application/json');

        if (!isJson) {
            return res.send(response);
        }

        const json = await response.json();

        const dateTime = new Date().toISOString();
        const fileName = `xp-data-query_${branch}_${dateTime}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        return res.status(response.status).send(json);
    } catch (e) {
        return res.status(500).send(`Server error - ${e}`);
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
