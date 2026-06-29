import { saveHitsToJsonFiles, saveSummary, zipQueryResult } from './writeFiles';
import { Params, XpServiceResponse } from './types';
import { Request, Response } from 'express';
import { addRequest, markRequestDone, updateRequestProgress } from './state';
import { getResultUrl } from './handleResultRequest';
import { logger } from './logger';

const serviceSecret = process.env.SERVICE_SECRET || 'dummyToken';

const localXpOrigin = 'http://localhost:8080';

const xpOrigin = process.env.XP_ORIGIN || localXpOrigin;
const xpServicePath = '/_/service/no.nav.navno/dataQuery';

const xpUrl = `${xpOrigin}${xpServicePath}`;

// The XP service has a max hit-count per request, in order to prevent timeouts.
// We have to do batched queries if the total number of hits exceeds the max
export const fetchQueryAndSaveResponse = async (
    req: Request,
    res: Response,
    requestId: string
) => {
    const runQuery = async (
        batch = 0,
        idSet: { [id: string]: boolean } = {},
        stickyCookie?: string | null
    ) => {
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
            logger.error(
                {
                    requestId,
                    status: batchResponse.status,
                    contentType: batchResponse.headers.get('content-type'),
                },
                'Invalid response from XP - expected JSON'
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
            const id = `${hit._id}-${hit.layerLocale}`;

            if (!id) {
                logger.warn(
                    { requestId, path: hit._path },
                    'Missing id found in response'
                );
                return false;
            } else if (idSet[id]) {
                logger.warn(
                    { requestId, id, path: hit._path },
                    'Duplicate id found in response'
                );
                return false;
            } else {
                idSet[id] = true;
                return true;
            }
        });

        saveHitsToJsonFiles(uniqueHits, requestId);

        const hitCount = Object.keys(idSet).length;

        if (batch === 0) {
            res.status(200).send({
                message: `Processing query - total hit count ${total} `,
                hits: total,
                requestId,
                resultUrl: getResultUrl(requestId),
            });
        }

        if (hasMore) {
            logger.info(
                { requestId, hitCount, total, batch },
                'Fetched batch of hits'
            );
            updateRequestProgress(
                requestId,
                Math.floor((hitCount / total) * 100)
            );

            await runQuery(
                batch + 1,
                idSet,
                stickyCookie || batchResponse.headers.get('set-cookie')
            );
        } else {
            logger.info(
                { requestId, hitCount, total },
                'Finished running query'
            );
            updateRequestProgress(requestId, 100);
            const { branch, query, fields, types } = json;
            saveSummary(
                { query, branch, fields, types, numHits: hitCount },
                requestId
            );
        }
    };

    const { branch, query } = req.query as Params;
    const queryString = new URL(req.url, xpOrigin).search;
    const url = `${xpUrl}${queryString}&requestId=${requestId}`;

    addRequest(requestId, branch, query);

    await runQuery()
        .then(() => zipQueryResult(requestId))
        .then(() => markRequestDone(requestId));
};
