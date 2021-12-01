import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Branch, QuerySummary, XpContent } from './types.js';

const localTmp = path.join(path.resolve(), 'tmp');
const tmpDir = process.env.TMP_DIR || localTmp;

const getRequestBasePath = (requestId: string) => path.join(tmpDir, requestId);

const getRequestJsonPath = (requestId: string) =>
    path.join(getRequestBasePath(requestId), 'json');

const objectToJson = (obj: object) => JSON.stringify(obj, null, 4);

console.log(`Using temp dir: ${tmpDir}`);

export const saveHitsToJsonFiles = (hits: XpContent[], requestId: string) => {
    hits.forEach((hit) => {
        const data = objectToJson(hit);

        const hitPath = path.join(getRequestJsonPath(requestId), hit._path);
        const parentPath = path.dirname(hitPath);

        fs.mkdirSync(parentPath, { recursive: true });
        fs.writeFileSync(`${hitPath}.json`, data);
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

export const zipQueryResultAndGetFileName = async (
    requestId: string,
    branch: Branch
): Promise<string> => {
    const dateTime = new Date().toISOString().replaceAll(':', '');
    const fileName = path.join(
        getRequestBasePath(requestId),
        `xp-data-query_${branch}_${dateTime}.zip`
    );

    const output = fs.createWriteStream(fileName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((res, rej) => {
        archive
            .directory(getRequestJsonPath(requestId), false)
            .on('error', (error) => rej(error))
            .on('warning', (error) => console.error(error))
            .pipe(output);

        output.on('close', () => {
            console.log(
                `Zipped ${archive.pointer()} bytes to file ${fileName}`
            );
            res(fileName);
        });

        archive.finalize();
    });
};

export const cleanupAfterRequest = (requestId: string) => {
    console.log(`Cleaning up after ${requestId}`);
    const requestTmpPath = path.join(tmpDir, requestId);
    if (fs.existsSync(requestTmpPath)) {
        fs.rmSync(requestTmpPath, { recursive: true });
    }
};
