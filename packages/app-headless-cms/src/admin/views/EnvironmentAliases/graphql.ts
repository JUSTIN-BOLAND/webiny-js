import gql from "graphql-tag";

const fields = `
    id
    name
    slug
    description
    environment {
        id
        name
    }
`;

export const LIST_ENVIRONMENT_ALIASES = gql`
    query ListEnvironmentAliases {
        cms {
            environmentAliases: listEnvironmentAliases {
                data {
                    id
                    name
                    slug
                    createdOn
                    url {
                        manage
                        read
                        preview
                    }
                    environment {
                        id
                        name
                    }
                }
                error {
                    data
                    code
                    message
                }
            }
        }
    }
`;

export const GET_ENVIRONMENT_ALIAS_BY_SLUG = gql`
    query getEnvironmentAliasBySlug($slug: String) {
        cms {
            getEnvironmentAlias(where: { slug: $slug }) {
                data {
                    name
                    id
                }
            }
        }
    }
`;

export const READ_ENVIRONMENT_ALIAS = gql`
    query getEnvironmentAlias($id: ID!) {
        cms {
            environmentAlias: getEnvironmentAlias(id: $id){
                data {
                    ${fields}
                }
                error {
                    code
                    message
                }
            }
        }
    }
`;

export const CREATE_ENVIRONMENT_ALIAS = gql`
    mutation createEnvironmentAlias($data: CmsEnvironmentAliasInput!){
        cms {
            environmentAlias: createEnvironmentAlias(data: $data) {
                data {
                    ${fields}
                }
                error {
                    code
                    message
                    data
                }
            }
        }
    }
`;

export const UPDATE_ENVIRONMENT_ALIAS = gql`
    mutation updateEnvironmentAlias($id: ID!, $data: CmsEnvironmentAliasInput!){
        cms {
            environmentAlias: updateEnvironmentAlias(id: $id, data: $data) {
                data {
                    ${fields}
                }
                error {
                    code
                    message
                    data
                }
            }
        }
    }
`;

export const DELETE_ENVIRONMENT_ALIAS = gql`
    mutation deleteEnvironmentAlias($id: ID!) {
        cms {
            deleteEnvironmentAlias(id: $id) {
                data
                error {
                    code
                    message
                }
            }
        }
    }
`;
