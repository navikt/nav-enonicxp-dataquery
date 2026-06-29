import pino from 'pino';

const serviceName = 'nav-enonicxp-dataquery';

export const logger = pino({
    name: serviceName,
    level: process.env.LOG_LEVEL || 'info',
    base: {
        service: serviceName,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

const normalizeError = (error: unknown) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    if (typeof error === 'string') {
        return { message: error };
    }

    try {
        return { message: JSON.stringify(error) };
    } catch {
        return { message: String(error) };
    }
};

export const stringifyError = (error: unknown) =>
    JSON.stringify(normalizeError(error));
