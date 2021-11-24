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
    const url = `${xpUrl}${queryString}`;

    const idSet: { [id: string]: boolean } = {};

    const runBatch = async (prevCount = 0) => {
        const batchResponse = await fetch(`${url}&start=${prevCount}`, {
            headers: { secret: serviceSecret },
        });

        const isJson = batchResponse.headers
            ?.get('content-type')
            ?.includes?.('application/json');

        if (!isJson) {
            throw new Error(
                'Invalid response from XP - expected a JSON response'
            );
        }

        const json = (await batchResponse.json()) as XpServiceResponse;

        const { total, hits } = json;

        if (!hits) {
            throw new Error(
                'Invalid response from XP - no hits array received'
            );
        }

        hits.forEach((hit) => {
            const id = hit._id;

            if (!id) {
                console.error(
                    `Warning, missing ids found in response for request id ${requestId} - path: ${hit._path}`
                );
            } else if (idSet[id]) {
                console.error(
                    `Warning, duplicate ids found in response for request id ${requestId}`
                );
            } else {
                idSet[id] = true;
            }
        });

        saveHitsToJsonFiles(hits, requestId);

        const currentCount = hits.length + prevCount;

        if (total > currentCount && hits.length > 0) {
            console.log(
                `Fetched ${currentCount} hits of ${total} total - fetching another batch`
            );
            await runBatch(currentCount);
        } else {
            const numUniqueIds = Object.keys(idSet).length;

            console.log(
                `Finished running query with request id ${requestId}. ${currentCount} hits and ${numUniqueIds} unique ids were returned`
            );
            const { branch, query, fields, types } = json;
            saveSummary(
                { query, branch, fields, types, numHits: currentCount },
                requestId
            );
        }
    };

    await runBatch();
};
