import fetch from 'node-fetch';
import { saveHitsToJsonFiles, saveSummary } from './writeFiles.js';
import { XpServiceResponse } from './types.js';

const serviceSecret = process.env.XP_SERVICE_SECRET || 'dummyToken';

// The XP service has a max hit-count to prevent timeouts. We have to do queries in batches
// if the total number of hits exceeds the max count
export const batchedFetchAndSave = async (url: string, requestId: string) => {
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

        saveHitsToJsonFiles(hits, requestId);

        const currentCount = hits.length + prevCount;

        if (total > currentCount && hits.length > 0) {
            console.log(
                `Accumulated ${currentCount} hits of ${total} total - fetching another batch`
            );
            await runBatch(currentCount);
        } else {
            console.log(`Finished running query with ${currentCount} hits`);
            saveSummary({ ...json, numHits: currentCount }, requestId);
        }
    };

    await runBatch();
};
