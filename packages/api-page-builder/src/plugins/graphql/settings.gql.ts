import { ErrorResponse, Response } from "@webiny/handler-graphql/responses";
import { GraphQLSchemaPlugin } from "@webiny/handler-graphql/types";
import { PbContext } from "@webiny/api-page-builder/types";

const plugin: GraphQLSchemaPlugin<PbContext> = {
    type: "graphql-schema",
    schema: {
        typeDefs: /* GraphQL */ `
            type PbSettingsError {
                code: String
                message: String
                data: JSON
            }

            type PbSocialMedia {
                facebook: String
                twitter: String
                instagram: String
                image: PbFile
            }

            type PbSettings {
                name: String
                favicon: PbFile
                logo: PbFile
                domain: String
                social: PbSocialMedia
                pages: PbSettingsPages
            }

            type PbSettingsResponse {
                # This field's value is hardcoded and it's here to help frontend clients cache data more easily.
                id: ID
                error: PbSettingsError
                data: PbSettings
            }

            type PbSettingsPages {
                home: ID
                notFound: ID
                error: ID
            }

            type PbDefaultPage {
                id: String
                parent: String
                title: String
            }

            input PbSocialMediaInput {
                facebook: String
                twitter: String
                instagram: String
                image: PbFileInput
            }

            input PbDefaultPageInput {
                id: String
                title: String
            }

            input PbSettingsInput {
                name: String
                domain: String
                favicon: PbFileInput
                logo: PbFileInput
                social: PbSocialMediaInput
                pages: PbSettingsPagesInput
            }

            input PbSettingsPagesInput {
                home: ID
                notFound: ID
                error: ID
            }

            extend type PbQuery {
                getSettings: PbSettingsResponse
            }

            extend type PbMutation {
                updateSettings(data: PbSettingsInput!): PbSettingsResponse
            }
        `,
        resolvers: {
            PbSettingsResponse: {
                id: (_, args, context) => {
                    return context.pageBuilder.settings.getSettingsCacheKey();
                }
            },
            PbQuery: {
                getSettings: async (_, args, context) => {
                    try {
                        const { pageBuilder } = context;
                        return new Response(await pageBuilder.settings.get());
                    } catch (err) {
                        return new ErrorResponse(err);
                    }
                }
            },
            PbMutation: {
                updateSettings: async (_, args, context) => {
                    try {
                        const { pageBuilder } = context;
                        return new Response(await pageBuilder.settings.update(args.data));
                    } catch (err) {
                        return new ErrorResponse(err);
                    }
                }
            }
        }
    }
};

export default plugin;
