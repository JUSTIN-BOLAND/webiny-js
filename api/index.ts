import Cognito from "./stack/cognito";
import DynamoDB from "./stack/dynamoDb";
import Graphql from "./stack/graphql";
import HeadlessCMS from "./stack/headlessCMS";
import ApiGateway from "./stack/apiGateway";
import Cloudfront from "./stack/cloudfront";
import ElasticSearch from "./stack/elasticSearch";
import FileManager from "./stack/fileManager";

const dynamoDb = new DynamoDB();
const cognito = new Cognito();
const elasticSearch = new ElasticSearch();
const fileManager = new FileManager();

const api = new Graphql({
    dynamoDbTable: dynamoDb.table,
    env: {
        ELASTIC_SEARCH_ENDPOINT: elasticSearch.domain.endpoint,
        COGNITO_REGION: String(process.env.AWS_REGION),
        COGNITO_USER_POOL_ID: cognito.userPool.id,
        DEBUG: String(process.env.DEBUG),
        S3_BUCKET: fileManager.bucket.id
    }
});

const headlessCms = new HeadlessCMS({
    dynamoDbTable: dynamoDb.table,
    env: {
        ELASTIC_SEARCH_ENDPOINT: elasticSearch.domain.endpoint,
        COGNITO_REGION: String(process.env.AWS_REGION),
        COGNITO_USER_POOL_ID: cognito.userPool.id,
        DEBUG: String(process.env.DEBUG),
        S3_BUCKET: fileManager.bucket.id
    }
});

const apiGateway = new ApiGateway({
    routes: [
        {
            name: "graphql-post",
            path: "/graphql",
            method: "POST",
            function: api.functions.api
        },
        {
            name: "graphql-options",
            path: "/graphql",
            method: "OPTIONS",
            function: api.functions.api
        },
        {
            name: "graphql-get",
            path: "/graphql",
            method: "GET",
            function: api.functions.graphqlPlayground
        },
        {
            name: "files-any",
            path: "/files/{path}",
            method: "ANY",
            function: fileManager.functions.download
        },
        {
            name: "cms-get",
            path: "/cms/{key+}",
            method: "GET",
            function: api.functions.graphqlPlayground
        },
        {
            name: "cms-post",
            path: "/cms/{key+}",
            method: "POST",
            function: headlessCms.functions.graphql
        },
        {
            name: "cms-options",
            path: "/cms/{key+}",
            method: "OPTIONS",
            function: headlessCms.functions.graphql
        }
    ]
});

const cloudfront = new Cloudfront({ apiGateway });

export const region = process.env.AWS_REGION;
export const cdnDomain = cloudfront.cloudfront.domainName.apply(value => `https://${value}`);
export const cognitoUserPoolId = cognito.userPool.id;
export const cognitoAppClientId = cognito.userPoolClient.id;
