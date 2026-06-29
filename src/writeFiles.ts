import fs from 'fs';
import path from 'path';
import { Branch, QuerySummary, XpContent } from './types';
import { getRequestState } from './state';
import { logger, stringifyError } from './logger';

const localTmp = path.join(path.resolve(), 'tmp');
const tmpDir = process.env.TMP_DIR || localTmp;

const getRequestBasePath = (requestId: string) => path.join(tmpDir, requestId);

const getRequestJsonPath = (requestId: string) =>
    path.join(getRequestBasePath(requestId), 'json');

const objectToJson = (obj: object) => JSON.stringify(obj, null, 4);

logger.info({ tmpDir }, 'Using temp dir');

export const getResultFilename = (requestId: string, branch: Branch) => {
    const dateTime = new Date().toISOString().replaceAll(':', '');
    return path.join(
        getRequestBasePath(requestId),
        `xp-data-query_${branch}_${dateTime}.zip`
    );
};

const getHitPath = (hit: XpContent) => {
    if (hit.layerLocale === 'no') {
        return hit._path;
    }

    return `${hit._path}_layer-${hit.layerLocale}`
}

export const saveHitsToJsonFiles = (hits: XpContent[], requestId: string) => {
    const requestJsonPath = getRequestJsonPath(requestId);

    hits.forEach((hit) => {
        const data = objectToJson(hit);

        const hitPath = getHitPath(hit)

        const hitPathFull = path.join(requestJsonPath, hitPath);
        const parentPath = path.dirname(hitPathFull);

        fs.mkdirSync(parentPath, { recursive: true });
        fs.writeFileSync(`${hitPathFull}.json`, data);
    });
};

export const saveSummary = (summary: QuerySummary, requestId: string) => {
    const requestPath = getRequestJsonPath(requestId);
    fs.mkdirSync(requestPath, { recursive: true });
    fs.writeFileSync(
        path.join(requestPath, 'summary.json'),
        objectToJson(summary)
    );
};

export const zipQueryResult = async (requestId: string): Promise<string> => {
    const fileName = getRequestState(requestId)?.filename;
    if (!fileName) {
        throw new Error(
            `Could not zip query result for requestId ${requestId} - filename was not defined`
        );
    }

    const { default: archiver } = await import('archiver');

    fs.mkdirSync(path.dirname(fileName), { recursive: true });

    const output = fs.createWriteStream(fileName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((res, rej) => {
        archive
            .directory(getRequestJsonPath(requestId), false)
            .on('error', (error) => rej(error))
            .on('warning', (error) =>
                logger.warn(
                    { requestId, error: stringifyError(error) },
                    'Archiver warning'
                )
            )
            .pipe(output);

        output.on('error', (error) => rej(error));
        output.on('close', () => {
            logger.info(
                { requestId, fileName, bytes: archive.pointer() },
                'Zipped query result'
            );
            res(fileName);
        });

        archive.finalize();
    });
};

export const cleanupAfterRequest = (requestId: string) => {
    logger.info({ requestId }, 'Cleaning up after request');
    const requestTmpPath = path.join(tmpDir, requestId);
    if (fs.existsSync(requestTmpPath)) {
        fs.rmSync(requestTmpPath, { recursive: true });
    }
};
