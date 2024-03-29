export type Branch = 'published' | 'unpublished' | 'archived';

export type Params = {
    branch: Branch;
    query?: string;
    types?: string[];
    fields?: string[];
};

export type XpContent = {
    _id: string;
    _path: string;
    layerLocale: string;
};

export type XpServiceResponse = Params & {
    hasMore: boolean;
    hits: XpContent[];
    total: number;
    message?: string;
};

export type QuerySummary = Params & { numHits: number };
