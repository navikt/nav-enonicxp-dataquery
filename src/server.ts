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

app.get('/data', async (req, res) => {
    try {
        const reqUrl = new URL(req.url, xpOrigin);
        const url = `${xpUrl}${reqUrl.search}`;
        console.log(`Trying url ${url}`);

        const response = await fetch(url, { headers: { secret: serviceSecret } });
        const json = await response.json();

        return res.status(response.status).send(json);
    } catch (e) {
        return res.status(500).send(`Server error - ${e}`);
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
