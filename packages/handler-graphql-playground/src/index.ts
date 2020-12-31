import { createPlaygroundOptions, PlaygroundConfig } from "apollo-server-core";
import { HttpContext } from "@webiny/handler-http/types";
import { HandlerPlugin } from "@webiny/handler/types";
import {
    renderPlaygroundPage,
    RenderPageOptions as PlaygroundRenderPageOptions
} from "@apollographql/graphql-playground-html";

export default (options: PlaygroundConfig = {}): HandlerPlugin<HttpContext> => ({
    type: "handler",
    handle(context) {
        const { http } = context;
        const path = http.request.path.base || "/";

        const playgroundOptions = createPlaygroundOptions(options);

        const playgroundRenderPageOptions: PlaygroundRenderPageOptions = {
            endpoint: path,
            ...playgroundOptions
        };

        return http.response({
            body: renderPlaygroundPage(playgroundRenderPageOptions),
            statusCode: 200,
            headers: {
                "Content-Type": "text/html",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
});
