import { Response, ErrorResponse } from "@webiny/handler-graphql/responses";
import { CmsContentEntryResolverFactoryType as ResolverFactory } from "@webiny/api-headless-cms/types";

type ResolveCreateFrom = ResolverFactory<any, { revision: string; data: Record<string, any> }>;

export const resolveCreateFrom: ResolveCreateFrom = ({ model }) => async (root, args, { cms }) => {
    try {
        const newRevision = await cms.entries.createRevisionFrom(model, args.revision, args.data || {});
        return new Response(newRevision);
    } catch (e) {
        return new ErrorResponse(e);
    }
};
