import gql from "graphql-tag";
import upperFirst from "lodash/upperFirst";

export const createListQuery = model => {
    const ucFirstPluralizedModelId = upperFirst(model.pluralizedModelId);
    const ucFirstModelId = upperFirst(model.modelId);

    return gql`
        query List${ucFirstPluralizedModelId}($where: ${ucFirstModelId}ListWhereInput) {
            content: list${ucFirstPluralizedModelId}(where: $where) {
                data {
                    id
                    meta {
                        published
                        model
                        title
                    }
                }
            }
        }
    `;
};

export const createGetQuery = model => {
    const ucFirstModelId = upperFirst(model.modelId);
    return gql`
        query Get${ucFirstModelId}($where: ${ucFirstModelId}GetWhereInput!) {
            content: get${ucFirstModelId}(where: $where) {
                data {
                    id
                    meta {
                        published
                        model
                        title
                    }
                }
            }
        }
    `;
};

export const GET_CONTENT_MODEL = gql`
    query CmsGetContentModel($id: ID!) {
        getContentModel(id: $id) {
            data {
                id
                modelId
                titleFieldId
            }
        }
    }
`;
