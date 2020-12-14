import { ListResponse, ListErrorResponse } from "@webiny/handler-graphql/responses";
import { GraphQLFieldResolver } from "@webiny/handler-graphql/types";
import { CmsContentModelType, CmsContext } from "@webiny/api-headless-cms/types";
import { setContextLocale } from "../setContextLocale";
import findEntries from "../findEntries";

export const resolveList = ({
    model
}: {
    model: CmsContentModelType;
}): GraphQLFieldResolver<any, any, CmsContext> => async (entry, args, context, info) => {
    setContextLocale(context, args.locale);
    try {
        const { entries, meta } = await findEntries({ model, args, context, info });
        return new ListResponse(entries, meta);
    } catch (err) {
        return new ListErrorResponse({ code: err.code || "RESOLVE_LIST", message: err.message });
    }
};
