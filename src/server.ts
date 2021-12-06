import express from 'express';
import { handleQueryRequest } from './handleQueryRequest';
import { handleResultRequest, resultApiPath } from './handleResultRequest';

const app = express();
const appPort = 2999;

app.get('/query', handleQueryRequest);

app.get(`${resultApiPath}/:requestId?`, handleResultRequest);

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
