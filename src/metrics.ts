import type { RequestHandler } from 'express';
import {
    collectDefaultMetrics,
    Counter,
    Gauge,
    Histogram,
    Registry,
} from '@prometheus-io/client';
import { Branch } from './types';

const registry = new Registry();

collectDefaultMetrics({ register: registry });

const prefix = 'nav_enonicxp_dataquery_';

// Queries

const branches = [
    'published',
    'unpublished',
    'archived',
] as const satisfies readonly Branch[];

/**
 * Why a query failed:
 * busy: all query slots taken (503). invalid: bad parameters, from us or XP (400).
 * xp_auth: XP rejected the service secret. xp_error: XP failed to run the query (500), which may be a bad NoQL query.
 * xp_unavailable: XP or its gateway is unavailable (502-504). XP also returns 503 for 5 minutes after a query error.
 * xp_invalid_response: XP answered with something that isn't a batch of hits.
 * xp_network: the request to XP failed without a response. internal: anything else, such as writing or zipping files.
 */
const failureReasons = [
    'busy',
    'invalid',
    'xp_auth',
    'xp_error',
    'xp_unavailable',
    'xp_invalid_response',
    'xp_network',
    'internal',
] as const;
export type FailureReason = (typeof failureReasons)[number];

/** Thrown for failures with a known reason. Anything else counts as internal. */
export class QueryError extends Error {
    constructor(
        readonly reason: FailureReason,
        message: string
    ) {
        super(message);
        this.name = 'QueryError';
    }
}

export const failureReasonFor = (error: unknown): FailureReason =>
    error instanceof QueryError ? error.reason : 'internal';

/** Branch label for a requested branch; "none" when it isn't a valid one, which keeps the label values fixed */
export const branchLabel = (branch: unknown) =>
    (branches as readonly unknown[]).includes(branch)
        ? (branch as Branch)
        : 'none';

const queries = new Counter({
    name: `${prefix}queries_total`,
    help: 'Finished queries by branch and result. A query succeeds when its zip file is ready. reason says why a query failed, and is none on success',
    labelNames: ['branch', 'result', 'reason'] as const,
    registers: [registry],
});

// Every series exists from startup, so rates and alerts work before the first query
for (const branch of branches) {
    queries.inc({ branch, result: 'success', reason: 'none' }, 0);
    for (const reason of failureReasons) {
        queries.inc({ branch, result: 'failure', reason }, 0);
    }
}
queries.inc({ branch: 'none', result: 'failure', reason: 'invalid' }, 0);

export const countQuerySuccess = (branch: Branch) =>
    queries.inc({ branch, result: 'success', reason: 'none' });

export const countQueryFailure = (branch: unknown, reason: FailureReason) =>
    queries.inc({ branch: branchLabel(branch), result: 'failure', reason });

export const queryDuration = new Histogram({
    name: `${prefix}query_duration_seconds`,
    help: 'Time from accepting a query until its zip file is ready, successful queries only',
    labelNames: ['branch'] as const,
    buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600],
    registers: [registry],
});

export const activeQueries = new Gauge({
    name: `${prefix}active_queries`,
    help: 'Queries being processed right now',
    registers: [registry],
});

export const maxActiveQueries = new Gauge({
    name: `${prefix}max_active_queries`,
    help: 'How many queries can be processed at once. Further queries are rejected as busy',
    registers: [registry],
});

// Requests to XP

const xpRequests = new Counter({
    name: `${prefix}xp_requests_total`,
    help: 'Requests to the XP dataQuery service (one per batch), by response status class (2xx, 4xx, 5xx, …) or network_error',
    labelNames: ['status'] as const,
    registers: [registry],
});

const xpRequestDuration = new Histogram({
    name: `${prefix}xp_request_duration_seconds`,
    help: 'Time until XP responds with headers, per batch',
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
    registers: [registry],
});

const statusClass = (status: number) => `${Math.floor(status / 100)}xx`;

/** Runs a request to XP and records its status class and time to response */
export const observeXpRequest = async (request: () => Promise<Response>) => {
    const stopTimer = xpRequestDuration.startTimer();
    try {
        const response = await request();
        xpRequests.inc({ status: statusClass(response.status) });
        return response;
    } catch (e) {
        xpRequests.inc({ status: 'network_error' });
        throw new QueryError(
            'xp_network',
            `Request to XP failed - ${String(e)}`
        );
    } finally {
        stopTimer();
    }
};

export const metricsHandler: RequestHandler = async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
};
