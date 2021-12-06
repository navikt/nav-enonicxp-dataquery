import { Request, Response } from 'express';
import { getAllRequestStates, getRequestState } from './state';

const appOrigin = process.env.APP_ORIGIN || 'http://localhost:2999';

export const resultApiPath = '/result';

export const getResultUrl = (requestId: string) =>
    `${appOrigin}${resultApiPath}/${requestId}`;

const resultsHtml = () => {
    const results = getAllRequestStates();

    const resultsHtml = results
        .map((result) => {
            if (!result) {
                return false;
            }

            const { branch, query, expires, progress, isDone, requestId } =
                result;

            return `
                <div>
                    <h2>${requestId}</h2>
                    <p>Branch: ${branch} - Query: ${query || 'none'}</p>
                    <p>${
                        isDone
                            ? `Query is finished - <a href="${resultApiPath}/${requestId}">Download result</a> - Expires in ${Math.floor(
                                  (expires - Date.now()) / 1000
                              )} seconds`
                            : `Query is processing - current progress ${progress}%`
                    }</p>
                </div>
            `;
        })
        .filter(Boolean)
        .join('<hr/>');

    return `
        <!DOCTYPE html>
        <html lang='en'>
            <head>
                <meta charset="utf-8">
                <title>NAV EnonicXP data query results</title>
            </head>
            <body>
            <h1>Results</h1>
            <div>
                ${resultsHtml}
            </div>
            </body>
        </html>
    `;
};

export const handleResultRequest = async (req: Request, res: Response) => {
    const { requestId } = req.params;

    if (!requestId) {
        return res.status(200).send(resultsHtml());
    }

    const reqState = getRequestState(requestId);

    if (!reqState) {
        return res.status(404).send('Not found');
    }

    const { filename, progress, isDone } = reqState;

    if (!isDone) {
        return res.status(202).send({
            message: `Result is not ready - Query progress: ${progress}%`,
            progress,
        });
    }

    if (!filename) {
        return res.status(500).send('Server error: filename was not defined');
    }

    return res.status(200).attachment(filename).sendFile(filename);
};
