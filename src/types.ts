export type Branch = 'published' | 'unpublished' | 'all';

export type Params = {
    branch: Branch;
    query?: string;
    types?: string[];
    fields?: string[];
};

export type XpContent = {
    _id: string;
    _path: string;
};

export type XpServiceResponse = Params & {
    hasMore: boolean;
    hits: XpContent[];
    total: number;
    message?: string;
};

export type QuerySummary = Params & { numHits: number };
