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

// app.use('/data', createProxyMiddleware({
//     target: xpOrigin,
//     changeOrigin: true,
//     pathRewrite: {
//         '^/data': xpServicePath
//     },
//     headers: {
//         secret: serviceSecret
//     },
//     logLevel: 'debug'
// }));

app.get('/data', async (req, res) => {
    const response = await fetch(`${xpOrigin}${xpServicePath}`, { headers: { secret: serviceSecret } });

    if (response.ok) {
        const json = await response.json();
        return res.status(200).send(json);
    }

    return res.status(response.status).send(response.statusText);
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
