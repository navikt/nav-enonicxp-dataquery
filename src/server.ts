import express, { ErrorRequestHandler } from 'express';
import { handleQueryRequest } from './handleQueryRequest';
import { handleResultRequest, resultApiPath } from './handleResultRequest';
import { logger, stringifyError } from './logger';

const app = express();
const appPort = 2999;

app.get('/query', handleQueryRequest);

app.get(`${resultApiPath}/{:requestId}`, handleResultRequest);

app.get('/internal/isAlive', (req, res) => {
    return res.status(200).send('I am alive!');
});

app.get('/internal/isReady', (req, res) => {
    return res.status(200).send('I am ready!');
});

const errorHandler: ErrorRequestHandler = (err, req, res) => {
    const { path } = req;
    const { status, stack } = err;
    const msg = stack?.split('\n')[0];

    logger.error(
        {
            path,
            status,
            error: stringifyError(err),
        },
        'Express error'
    );

    return res.status(status).send(msg);
};

app.use(errorHandler);

const server = app.listen(appPort, () => {
    logger.info({ port: appPort }, 'Server starting');
});

const shutdown = () => {
    logger.info('Server shutting down');

    server.close(() => {
        logger.info('Shutdown complete');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
