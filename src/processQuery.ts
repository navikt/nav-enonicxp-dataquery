import fetch from 'node-fetch';
import {
    cleanupAfterRequest,
    saveHitsToJsonFiles,
    saveSummary,
    zipQueryResultAndGetFileName,
} from './writeFiles.js';
import { Params, XpServiceResponse } from './types.js';
import { Request, Response } from 'express';
import NodeCache from 'node-cache';

const serviceSecret = process.env.XP_SERVICE_SECRET || 'dummyToken';

const localXpOrigin = 'http://localhost:8080';

const xpOrigin = process.env.XP_ORIGIN || localXpOrigin;
const xpServicePath = '/_/service/no.nav.navno/dataQuery';

const xpUrl = `${xpOrigin}${xpServicePath}`;

const getReqState = (requestId: string) => cache.get<CacheItem>(requestId);

// The XP service has a max hit-count per request, in order to prevent timeouts.
// We have to do batched queries if the total number of hits exceeds the max
export const fetchQueryAndSaveResponse = async (
    req: Request,
    res: Response,
    requestId: string
) => {
    const { branch } = req.query as Params;
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
            setReqState(requestId, Math.floor(hitCount / total));

            await runBatch(
                batch + 1,
                stickyCookie || batchResponse.headers.get('set-cookie')
            );
        } else {
            console.log(
                `Finished running query with request id ${requestId}. ${hitCount} hits were returned, server promised ${total} total`
            );
            setReqState(requestId, 100);
            const { branch, query, fields, types } = json;
            saveSummary(
                { query, branch, fields, types, numHits: hitCount },
                requestId
            );
        }
    };

    await runBatch();

    const zipFileName = await zipQueryResultAndGetFileName(requestId, branch);

    return res.status(200).attachment(zipFileName).sendFile(zipFileName);
};
