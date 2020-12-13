export const DATA_FIELD = /* GraphQL */ `
    {
        name
        domain
        social {
            instagram
            facebook
            twitter
            image {
                src
                id
            }
        }
    }
`;

export const ERROR_FIELD = /* GraphQL */ `
    {
        code
        data
        message
    }
`;

export const UPDATE_SETTINGS = /* GraphQL */ `
    mutation UpdateSettings($data: PbSettingsInput!) {
        pageBuilder {
            updateSettings(data: $data) {
                id
                data ${DATA_FIELD}
                error ${ERROR_FIELD}
            }
        }
    }
`;

export const GET_SETTINGS = /* GraphQL */ `
    query GetSettings {
        pageBuilder {
            getSettings {
                id
                data ${DATA_FIELD}
                error ${ERROR_FIELD}
            }
        }
    }
`;
