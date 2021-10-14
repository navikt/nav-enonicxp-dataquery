import express from 'express';
import fetch from 'node-fetch';

const app = express();
const appPort = 2999;

const localXpOrigin = 'http://localhost:8080';

const xpOrigin = process.env.XP_ORIGIN || localXpOrigin;
const xpServicePath = '/_/service/no.nav.navno/dataQuery';

const serviceSecret = process.env.XP_SERVICE_SECRET || 'dummyToken';

const xpUrl = `${xpOrigin}${xpServicePath}`;

let waiting = false;

type Branch = 'published' | 'unpublished' | 'all';

type Params = {
    branch: Branch;
    query?: string,
    types?: string[],
    fields?: string[]
}

type XpServiceResponse = Params & {
    total: number;
    hits: object[];
}

type ThisServiceResponse = Pick<XpServiceResponse, 'branch' | 'query' | 'types' | 'fields' | 'hits'>;

// The XP service has a max count to prevent timeouts, therefore we have to do large fetches in batches
const fetchAll = async (url: string, prevHits: XpServiceResponse['hits'] = []): Promise<ThisServiceResponse> => {
    const batchResponse = (await fetch(url, { headers: { secret: serviceSecret } }));

    const isJson = batchResponse.headers
        ?.get('content-type')
        ?.includes?.('application/json');

    if (!isJson) {
        throw new Error('Invalid response from XP - expected a JSON response');
    }

    const json = await batchResponse.json() as XpServiceResponse;

    const { total, hits } = json;
    if (!hits) {
        throw new Error('Invalid response from XP - no hits array received');
    }

    const currentHits = [...prevHits, ...hits];
    const currentCount = currentHits.length;

    if (total > currentCount) {
        return fetchAll(`${url}&start=${currentCount}`, currentHits);
    }

    const { branch, query, fields, types } = json;
    return { branch, query, types, fields, hits: currentHits };
};

app.get('/query', async (req, res) => {
    if (waiting) {
        return res.status(503).send('Service is currently busy - try again in a moment');
    }

    waiting = true;

    try {
        const { branch } = req.query as Params;
        const queryString = new URL(req.url, xpOrigin).search;
        const url = `${xpUrl}${queryString}`;
        console.log(`Trying url ${url}`);

        const response = await fetchAll(url);

        const dateTime = new Date().toISOString();
        const fileName = `xp-data-query_${branch}_${dateTime}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        return res.status(200).send(response);
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
