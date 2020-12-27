import { CmsContext, CmsModelFieldToGraphQLPlugin } from "@webiny/api-headless-cms/types";
import { createReadTypeName } from "../utils/createTypeName";

const plugin: CmsModelFieldToGraphQLPlugin = {
    name: "cms-model-field-to-graphql-ref",
    type: "cms-model-field-to-graphql",
    fieldType: "ref",
    isSortable: false,
    isSearchable: false,
    read: {
        createTypeField({ field }) {
            const { models } = field.settings;
            // For now we only use the first model in the list. Support for multiple models will come in the future.
            const gqlType = createReadTypeName(models[0].modelId);

            return field.fieldId + `: ${field.multipleValues ? `[${gqlType}]` : gqlType}`;
        },
        createResolver({ field }) {
            return async (instance, args, context: CmsContext) => {
                const { modelId } = field.settings.models[0];

                // Get model manager, to get access to CRUD methods
                const model = await context.cms.getModel(modelId);

                // Get field value for this entry
                const value = instance.values[field.fieldId];

                if (field.multipleValues) {
                    const ids = value.map(ref => ref.entryId);

                    // eslint-disable-next-line @typescript-eslint/camelcase
                    const entries = await model.getPublishedByIds(ids);
                    return entries.filter(Boolean);
                }

                return (await model.getPublishedByIds([value.entryId]))[0];
            };
        }
    },
    manage: {
        createSchema() {
            return {
                typeDefs: `
                    type RefField {
                        modelId: String!
                        entryId: ID!
                    }
                    
                    input RefFieldInput {
                        modelId: String!
                        entryId: ID!
                    }
                `,
                resolvers: {}
            };
        },
        createResolver({ field }) {
            return instance => {
                return instance.values[field.fieldId];
            };
        },
        createTypeField({ field }) {
            if (field.multipleValues) {
                return `${field.fieldId}: [RefField]`;
            }

            return `${field.fieldId}: RefField`;
        },
        createInputField({ field }) {
            if (field.multipleValues) {
                return field.fieldId + ": [RefFieldInput]";
            }

            return field.fieldId + ": RefFieldInput";
        }
    }
};

export default plugin;
