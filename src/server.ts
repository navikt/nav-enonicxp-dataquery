import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fetch from 'node-fetch';

const app = express();
const appPort = 2999;

const localXpOrigin = 'http://localhost:8080';

const xpOrigin = process.env.XP_ORIGIN || localXpOrigin;
const xpServicePath = '/_/service/no.nav.navno/dataQuery';

const serviceSecret = process.env.XP_SERVICE_SECRET || 'dummyToken';

console.log(xpOrigin, serviceSecret.substr(0, 4));

app.use('/data', createProxyMiddleware({
    target: xpOrigin,
    changeOrigin: true,
    pathRewrite: {
        '^/data': xpServicePath,
    },
    headers: {
        secret: serviceSecret,
    },
    logLevel: 'debug',
}));

app.get('/test', async (req, res) => {
    const url = `${xpOrigin}${xpServicePath}`;
    console.log(`Trying url ${url}`);
    const response = await fetch(url, { headers: { secret: serviceSecret } });

    const isJson = response.headers
        ?.get('content-type')
        ?.includes?.('application/json');

    console.log(isJson);

    if (isJson) {
        const json = await response.json();
        return res.status(response.status).send(json);
    }

    return res.status(500).send("Invalid response from XP");
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
