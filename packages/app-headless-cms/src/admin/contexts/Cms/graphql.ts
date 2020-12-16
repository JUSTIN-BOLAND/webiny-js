import gql from "graphql-tag";

// Fetches data needed for constructing environments list in the main menu.
export const LIST_ENVIRONMENTS_SELECTOR_ENVIRONMENTS = gql`
    query HeadlessCmsEnvironmentSelectorEnvironmentsList {
        cms {
            listEnvironments {
                error {
                    data
                    code
                    message
                }
                data {
                    id
                    name
                    slug
                    isProduction
                    environmentAliases {
                        id
                        name
                        isProduction
                        url {
                            manage
                            read
                            preview
                        }
                    }
                }
            }
        }
    }
`;
