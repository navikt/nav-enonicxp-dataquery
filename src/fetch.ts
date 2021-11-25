import fetch from 'node-fetch';
import { saveHitsToJsonFiles, saveSummary } from './writeFiles.js';
import { XpServiceResponse } from './types.js';
import { Request } from 'express';

const serviceSecret = process.env.XP_SERVICE_SECRET || 'dummyToken';

const localXpOrigin = 'http://localhost:8080';

const xpOrigin = process.env.XP_ORIGIN || localXpOrigin;
const xpServicePath = '/_/service/no.nav.navno/dataQuery';

const xpUrl = `${xpOrigin}${xpServicePath}`;

// The XP service has a max hit-count to prevent timeouts. We have to do queries in batches
// if the total number of hits exceeds the max count
export const fetchQueryAndSaveResponse = async (
    req: Request,
    requestId: string
) => {
    const queryString = new URL(req.url, xpOrigin).search;
    const url = `${xpUrl}${queryString}&requestId=${requestId}`;

    const idSet: { [id: string]: boolean } = {};

    const runBatch = async (batch = 0, stickyCookie?: string | null) => {
        const batchResponse = await fetch(`${url}&batch=${batch}`, {
            headers: {
                secret: serviceSecret,
                ...(stickyCookie && { cookie: stickyCookie }),
            },
        });

        const isJson = batchResponse.headers
            ?.get('content-type')
            ?.includes?.('application/json');

        if (!isJson) {
            console.error(
                `Invalid response from XP: ${JSON.stringify(batchResponse)}`
            );
            throw new Error(
                'Invalid response from XP - expected a JSON response'
            );
        }

        const json = (await batchResponse.json()) as XpServiceResponse;

        const { hasMore, hits, message, total } = json;

        if (!hits) {
            throw new Error(
                `${
                    message
                        ? `Error from XP: ${message}`
                        : 'Invalid response from XP - no hits array received'
                }`
            );
        }

        // consistency check for batched requests
        const uniqueHits = hits.filter((hit) => {
            const id = hit._id;

            if (!id) {
                console.error(
                    `Warning, missing id found in response for request id ${requestId} - path: ${hit._path}`
                );
                return false;
            } else if (idSet[id]) {
                console.error(
                    `Warning, duplicate id ${id} found in response for request id ${requestId} - path: ${hit._path}`
                );
                return false;
            } else {
                idSet[id] = true;
                return true;
            }
        });

        saveHitsToJsonFiles(uniqueHits, requestId);

        const hitCount = Object.keys(idSet).length;

        if (hasMore) {
            console.log(
                `Fetched ${hitCount} hits of ${total} total - fetching another batch`
            );

            await runBatch(
                batch + 1,
                stickyCookie || batchResponse.headers.get('set-cookie')
            );
        } else {
            console.log(
                `Finished running query with request id ${requestId}. ${hitCount} hits were returned, server promised ${total} total`
            );
            const { branch, query, fields, types } = json;
            saveSummary(
                { query, branch, fields, types, numHits: hitCount },
                requestId
            );
        }
    };

    await runBatch();
};
