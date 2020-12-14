import {
    CmsContentModelType,
    CmsFieldTypePlugins,
    CmsContext
} from "@webiny/api-headless-cms/types";
import { hasScope } from "@webiny/api-security";
import { GraphQLFieldResolver } from "@webiny/handler-graphql/types";
import { createReadTypeName, createTypeName } from "../utils/createTypeName";
import { commonFieldResolvers } from "../utils/commonFieldResolvers";
import { resolveGet } from "../utils/resolvers/resolveGet";
import { resolveList } from "../utils/resolvers/resolveList";
import { pluralizedTypeName } from "../utils/pluralizedTypeName";

export interface CreateReadResolvers {
    (params: {
        models: CmsContentModelType[];
        model: CmsContentModelType;
        context: CmsContext;
        fieldTypePlugins: CmsFieldTypePlugins;
    }): any;
}

export const createReadResolvers: CreateReadResolvers = ({
    models,
    model,
    fieldTypePlugins,
    context
}) => {
    const typeName = createTypeName(model.modelId);
    const rTypeName = createReadTypeName(typeName);

    const resolvers: { [key: string]: GraphQLFieldResolver } = commonFieldResolvers();

    const apiType = context.cms.READ ? "read" : "preview";
    const environment = context.cms.getEnvironment().slug;
    const scope = `cms:${apiType}:${environment}:${model.modelId}`;

    return {
        Query: {
            [`get${typeName}`]: hasScope(scope)(resolveGet({ model })),
            [`list${pluralizedTypeName(typeName)}`]: hasScope(scope)(resolveList({ model }))
        },
        [rTypeName]: model.fields.reduce((resolvers, field) => {
            const { read } = fieldTypePlugins[field.type];
            const resolver = read.createResolver({ models, model, field });

            resolvers[field.fieldId] = async (entry, args, ctx, info) => {
                // If field-level locale is not specified, use context locale.
                const locale = args.locale || ctx.cms.locale.code;
                const value = await resolver(entry, { ...args, locale }, ctx, info);
                const cacheKey = `${model.modelId}:${entry.id}:${field.fieldId}`;
                ctx.resolvedValues.set(cacheKey, value);
                return value;
            };

            return resolvers;
        }, resolvers)
    };
};
