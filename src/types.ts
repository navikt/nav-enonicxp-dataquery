export type Branch = 'published' | 'unpublished' | 'all';

export type Params = {
    branch: Branch;
    query?: string;
    types?: string[];
    fields?: string[];
};

export type XpContent = {
    _path: string;
};

export type XpServiceResponse = Params & {
    total: number;
    hits: XpContent[];
};

export type QuerySummary = Pick<
    XpServiceResponse,
    'branch' | 'query' | 'types' | 'fields'
> & { numHits: number };
