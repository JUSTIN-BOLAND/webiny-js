import mdbid from "mdbid";
import { ContextPlugin } from "@webiny/handler/types";
import {
    CmsContentModelEntryContextType,
    CmsContentModelEntryPermissionType,
    CmsContentModelEntryType,
    CmsContentModelPermissionType,
    CmsContentModelType,
    CmsContext,
    DbItemTypes
} from "@webiny/api-headless-cms/types";
import { NotFoundError } from "@webiny/handler-graphql";
import Error from "@webiny/error";
import * as utils from "../../../utils";
import { entryModelValidationFactory } from "./contentModelEntry/entryModelValidationFactory";
import { createElasticSearchParams } from "./contentModelEntry/createElasticSearchParams";
import { createRevisionsDataLoader } from "./contentModelEntry/dataLoaders";
import { createCmsPK } from "../../../utils";
import checkOwnPermissions from "@webiny/api-page-builder/plugins/crud/utils/checkOwnPermissions";
import defaults from "@webiny/api-page-builder/plugins/crud/utils/defaults";

const TYPE_ENTRY = "cms.entry";
const TYPE_ENTRY_LATEST = TYPE_ENTRY + ".l";
const TYPE_ENTRY_PUBLISHED = TYPE_ENTRY + ".p";

const STATUS_CHANGES_REQUESTED = "changesRequested";
const STATUS_REVIEW_REQUESTED = "reviewRequested";
const STATUS_DRAFT = "draft";
const STATUS_PUBLISHED = "published";
const STATUS_UNPUBLISHED = "unpublished";

const createElasticSearchData = ({ values, ...entry }: CmsContentModelEntryType) => {
    return {
        ...entry,
        values: {
            // Keep "values" as a nested object to avoid collisions between
            // system and user-defined properties
            ...values
        }
    };
};

const getESLatestEntryData = (entry: CmsContentModelEntryType) => {
    return { ...createElasticSearchData(entry), latest: true, __type: TYPE_ENTRY_LATEST };
};

const getESPublishedEntryData = (entry: CmsContentModelEntryType) => {
    return { ...createElasticSearchData(entry), published: true, __type: TYPE_ENTRY_PUBLISHED };
};

export default (): ContextPlugin<CmsContext> => ({
    type: "context",
    name: "context-content-model-entry",
    async apply(context) {
        const { db, elasticSearch, security } = context;

        const loaders = {
            revisions: createRevisionsDataLoader(context)
        };

        const PK_ENTRY = () => `${createCmsPK(context)}#CME`;
        const PK_ENTRY_LATEST = () => PK_ENTRY() + "#L";
        const PK_ENTRY_PUBLISHED = () => PK_ENTRY + "#P";

        const checkPermissions = (check: {
            rwd?: string;
            rcpu?: string;
        }): Promise<CmsContentModelEntryPermissionType> => {
            return utils.checkPermissions(context, "cms.manage.contentModelEntry", check);
        };

        const entries: CmsContentModelEntryContextType = {
            get: async (model, args) => {
                // TODO: implement the same way as the "list" using where/sort parameters, but limit to 1

                // const [response] = await db.read<CmsContentModelEntryType>({
                //     ...utils.defaults.db,
                //     query: { PK: utils.createContentModelEntryPk(context), SK: id },
                //     limit: 1
                // });
                // if (!response || response.length === 0) {
                //     throw new Error(`CMS Content model "${id}" not found.`);
                // }
                // return response.find(() => true);
                return null;
            },
            list: async (model: CmsContentModelType, args = {}) => {
                const limit = args.limit ? (args.limit >= 10000 ? 9999 : args.limit) : 50;

                const body = createElasticSearchParams({
                    model,
                    args: {
                        ...args,
                        limit
                    },
                    context,
                    onlyOwned: false,
                    parentObject: "values"
                });

                const response = await elasticSearch.search({
                    ...utils.defaults.es(context),
                    body
                });

                const { hits, total } = response.body.hits;
                const items = hits.map(item => item._source);

                const hasMoreItems = items.length > limit;
                if (hasMoreItems) {
                    // Remove the last item from results, we don't want to include it.
                    items.pop();
                }

                // Cursor is the `sort` value of the last item in the array.
                // https://www.elastic.co/guide/en/elasticsearch/reference/current/paginate-search-results.html#search-after
                const meta = {
                    hasMoreItems,
                    totalCount: total.value,
                    cursor:
                        items.length > 0
                            ? utils.encodeElasticSearchCursor(hits[items.length - 1].sort)
                            : null
                };

                return [items, meta];
            },
            async create(model, data) {
                await checkPermissions({ rwd: "w" });

                const validation = await entryModelValidationFactory(context, model);
                await validation.validate(data);

                const identity = security.getIdentity();
                const locale = context.cms.getLocale();

                const uniqueId = mdbid();
                const version = 1;
                const id = `${uniqueId}#${utils.zeroPad(version)}`;

                const owner = {
                    id: identity.id,
                    displayName: identity.displayName,
                    type: identity.type
                };

                const entry: CmsContentModelEntryType = {
                    id,
                    modelId: model.modelId,
                    locale: locale.code,
                    createdOn: new Date().toISOString(),
                    savedOn: new Date().toISOString(),
                    createdBy: owner,
                    ownedBy: owner,
                    version,
                    locked: false,
                    status: STATUS_DRAFT,
                    values: data
                };

                await db
                    .batch()
                    // Create main entry item
                    .create({
                        ...utils.defaults.db,
                        data: {
                            PK: PK_ENTRY(),
                            SK: id,
                            TYPE: DbItemTypes.CMS_CONTENT_MODEL_ENTRY,
                            ...entry
                        }
                    })
                    // Create "latest" entry item
                    .create({
                        ...utils.defaults.db,
                        data: {
                            PK: utils.createContentModelEntryLatestPK(context),
                            SK: uniqueId,
                            TYPE: TYPE_ENTRY_LATEST,
                            id
                        }
                    })
                    .execute();

                await elasticSearch.create({
                    ...utils.defaults.es(context),
                    id: `CME#L#${uniqueId}`,
                    body: getESLatestEntryData(entry)
                });

                return entry;
            },
            async createRevisionFrom(model, sourceId) {
                await checkPermissions({ rwd: "w" });

                // Entries are identified by a common parent ID + Revision number
                const [uniqueId] = sourceId.split("#");

                const [[[entry]], [[latestEntry]]] = await db
                    .batch()
                    .read({
                        ...utils.defaults.db,
                        query: { PK: PK_ENTRY(), SK: sourceId }
                    })
                    .read({
                        ...utils.defaults.db,
                        query: { PK: utils.createContentModelEntryLatestPK(context), SK: uniqueId }
                    })
                    .execute();

                if (!entry) {
                    throw new NotFoundError(
                        `Entry "${sourceId}" of model "${model.modelId}" was not found.`
                    );
                }

                const identity = security.getIdentity();
                const version = parseInt(latestEntry.id.split("#")[1]) + 1;
                const id = `${uniqueId}#${utils.zeroPad(version)}`;

                const newEntry: CmsContentModelEntryType = {
                    id,
                    version,
                    modelId: entry.modelId,
                    locale: entry.locale,
                    savedOn: new Date().toISOString(),
                    createdOn: new Date().toISOString(),
                    createdBy: {
                        id: identity.id,
                        displayName: identity.displayName,
                        type: identity.type
                    },
                    ownedBy: entry.ownedBy,
                    locked: false,
                    publishedOn: null,
                    status: STATUS_DRAFT,
                    values: { ...entry.values }
                };

                await db
                    .batch()
                    // Create main entry item
                    .create({
                        ...utils.defaults.db,
                        data: {
                            PK: PK_ENTRY(),
                            SK: id,
                            TYPE: DbItemTypes.CMS_CONTENT_MODEL_ENTRY,
                            ...newEntry
                        }
                    })
                    // Update "latest" entry item
                    .update({
                        ...utils.defaults.db,
                        data: {
                            PK: utils.createContentModelEntryLatestPK(context),
                            SK: uniqueId,
                            TYPE: TYPE_ENTRY_LATEST,
                            id
                        }
                    })
                    .execute();

                await elasticSearch.index({
                    ...utils.defaults.es(context),
                    id: `CME#L#${uniqueId}`,
                    body: getESLatestEntryData(newEntry)
                });

                return newEntry;
            },
            async update(model, id, data) {
                // TODO: @pavel check the UI to see if this `data` is an object with user-defined fields
                const permission = await checkPermissions({ rwd: "w" });

                const [uniqueId] = id.split("#");

                const [[[entry]], [[latestEntry]]] = await db
                    .batch()
                    .read({
                        ...utils.defaults.db,
                        query: { PK: PK_ENTRY(), SK: id }
                    })
                    .read({
                        ...utils.defaults.db,
                        query: { PK: utils.createContentModelEntryLatestPK(context), SK: uniqueId }
                    })
                    .execute();

                if (!entry) {
                    throw new NotFoundError(
                        `Entry "${id}" of model "${model.modelId}" was not found.`
                    );
                }

                if (entry.locked) {
                    throw new Error(`Cannot update entry because it's locked.`);
                }

                utils.checkOwnership(context, permission, entry, "ownedBy");

                const validation = await entryModelValidationFactory(context, model);
                await validation.validate(data);

                const updatedEntry: Partial<CmsContentModelEntryType> = {
                    values: data,
                    savedOn: new Date().toISOString()
                };

                await db.update({
                    ...utils.defaults.db,
                    query: { PK: PK_ENTRY(), SK: id },
                    data: updatedEntry
                });

                if (latestEntry.id === id) {
                    // Index file in "Elastic Search"
                    await elasticSearch.update({
                        ...utils.defaults.es(context),
                        id: `CME#L#${uniqueId}`,
                        body: {
                            doc: updatedEntry
                        }
                    });
                }

                return {
                    ...entry,
                    ...updatedEntry
                };
            },
            async delete(model, id) {
                const permission = await checkPermissions({ rwd: "d" });

                const [uniqueId] = id.split("#");

                const [[[entry]], [[latestEntry]], [[publishedEntry]]] = await db
                    .batch()
                    .read({
                        ...utils.defaults.db,
                        query: {
                            PK: PK_ENTRY(),
                            SK: id
                        }
                    })
                    .read({
                        ...utils.defaults.db,
                        query: {
                            PK: utils.createContentModelEntryLatestPK(context),
                            SK: uniqueId
                        }
                    })
                    .read({
                        ...utils.defaults.db,
                        query: {
                            PK: utils.createContentModelEntryPublishedPK(context),
                            SK: uniqueId
                        }
                    })
                    .execute();

                if (!entry) {
                    throw new NotFoundError(`Entry "${id}" was not found!`);
                }

                utils.checkOwnership(context, permission, entry, "ownedBy");

                const batch = db.batch().delete({
                    ...utils.defaults.db,
                    query: {
                        PK: PK_ENTRY(),
                        SK: id
                    }
                });

                if (publishedEntry && publishedEntry.id === id) {
                    batch.delete({
                        ...utils.defaults.db,
                        query: {
                            PK: PK_ENTRY(),
                            SK: id
                        }
                    });
                }

                await elasticSearch.delete({
                    ...utils.defaults.es(context),
                    id: `CME#${id}`
                });
            },
            async listRevisions(id) {
                const [uniqueId] = id.split("#");

                return loaders.revisions.load(uniqueId);
            },
            async publish(model, id) {
                const permission = await checkPermissions({ rcpu: "p" });

                const [uniqueId] = id.split("#");

                const [[[entry]], [[latestEntry]], [[publishedEntry]]] = await db
                    .batch()
                    .read({
                        ...utils.defaults.db,
                        query: { PK: PK_ENTRY(), SK: id }
                    })
                    .read({
                        ...utils.defaults.db,
                        query: { PK: PK_ENTRY_LATEST(), SK: uniqueId }
                    })
                    .read({
                        ...utils.defaults.db,
                        query: { PK: PK_ENTRY_PUBLISHED(), SK: uniqueId }
                    })
                    .execute();

                if (!entry) {
                    throw new NotFoundError(
                        `Entry "${id}" of model "${model.modelId}" was not found.`
                    );
                }

                utils.checkOwnership(context, permission, entry, "ownedBy");
                
                // Change entry to "published"
                entry.status = STATUS_PUBLISHED;
                entry.locked = true;
                entry.publishedOn = new Date().toISOString();

                const batch = db.batch();

                batch.update({
                    ...defaults.db,
                    query: {
                        PK: PK_ENTRY(),
                        SK: id
                    },
                    data: entry
                });
                
                if(publishedEntry) {
                    // If there is a `published` entry already, we need to set it to `unpublished`. We need to
                    // execute two updates - update the previously published entry's status and the published
                    // page entry (PK_PAGE_PUBLISHED()).

                    // 🤦 DynamoDB does not support `batchUpdate` - so here we load the previously published
                    // page's data so that we can update its status within a batch operation. If, hopefully,
                    // they introduce a true update batch operation, remove this `read` call.
                }
                
                
                
            },
            requestChanges(
                model: CmsContentModelType,
                id: string
            ): Promise<CmsContentModelEntryType> {
                return Promise.resolve(undefined);
            },
            requestReview(
                model: CmsContentModelType,
                id: string
            ): Promise<CmsContentModelEntryType> {
                return Promise.resolve(undefined);
            },
            unpublish(model: CmsContentModelType, id: string): Promise<CmsContentModelEntryType> {
                return Promise.resolve(undefined);
            }
        };

        context.cms = {
            ...(context.cms || ({} as any)),
            entries
        };
    }
});