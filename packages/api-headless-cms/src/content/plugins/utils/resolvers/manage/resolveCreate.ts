import { Response, ErrorResponse } from "@webiny/handler-graphql/responses";
import { GraphQLFieldResolver } from "@webiny/handler-graphql/types";
import { setContextLocale } from "./../../setContextLocale";

export const resolveCreate = ({ model }): GraphQLFieldResolver => async (root, args, context) => {
    setContextLocale(context, args.locale);

    try {
        const Model = context.models[model.code];
        const instance = new Model();
        instance.populate(args.data);
        await instance.save();
        return new Response(instance);
    } catch (e) {
        return new ErrorResponse({
            code: e.code,
            message: e.message,
            data: e.data || null
        });
    }
};
