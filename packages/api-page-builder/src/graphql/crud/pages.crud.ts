import { ContextPlugin } from "@webiny/handler/types";
import mdbid from "mdbid";
import defaults from "./utils/defaults";
import uniqid from "uniqid";
import { NotAuthorizedError } from "@webiny/api-security";
import Error from "@webiny/error";
import { NotFoundError } from "@webiny/handler-graphql";
import getNormalizedListPagesArgs from "./utils/getNormalizedListPagesArgs";
import trimStart from "lodash/trimStart";
import omit from "lodash/omit";
import merge from "lodash/merge";
import getPKPrefix from "./utils/getPKPrefix";
import DataLoader from "dataloader";

import {
    PageHookPlugin,
    PbContext,
    Page,
    HandlerConfiguration
} from "@webiny/api-page-builder/types";
import createListMeta from "./utils/createListMeta";
import checkBasePermissions from "./utils/checkBasePermissions";
import checkOwnPermissions from "./utils/checkOwnPermissions";
import executeHookCallbacks from "./utils/executeHookCallbacks";
import path from "path";
import normalizePath from "./pages/normalizePath";
import { compressContent, extractContent } from "./pages/contentCompression";
import { CreateDataModel, UpdateSettingsModel, UpdateDataModel } from "./pages/models";
import {
    getESLatestPageData,
    getESPublishedPageData,
    getESUpdateLatestPageData
} from "./pages/esPageData";
import {
    HandlerArgs as RenderHandlerArgs,
    Args as RenderArgs
} from "@webiny/api-prerendering-service/render/types";

import {
    HandlerArgs as FlushHandlerArgs,
    Args as FlushArgs
} from "@webiny/api-prerendering-service/flush/types";

import { HandlerArgs as QueueAddHandlerArgs } from "@webiny/api-prerendering-service/queue/add/types";

import {
    TYPE,
    DbPageLatest,
    DbPagePublished,
    DbPagePublishedPath
} from "@webiny/api-page-builder/types";

const STATUS_CHANGES_REQUESTED = "changesRequested";
const STATUS_REVIEW_REQUESTED = "reviewRequested";
const STATUS_DRAFT = "draft";
const STATUS_PUBLISHED = "published";
const STATUS_UNPUBLISHED = "unpublished";

const getZeroPaddedVersionNumber = number => String(number).padStart(4, "0");

const DEFAULT_EDITOR = "page-builder";
const PERMISSION_NAME = "pb.page";

const createPlugin = (configuration: HandlerConfiguration): ContextPlugin<PbContext> => {
    const plugin: ContextPlugin<PbContext> = {
        type: "context",
        apply(context) {
            const { db, i18nContent, elasticSearch } = context;

            const PK_PAGE = () => `${getPKPrefix(context)}P`;
            const PK_PAGE_LATEST = () => PK_PAGE() + "#L";
            const PK_PAGE_PUBLISHED = () => PK_PAGE() + "#P";
            const PK_PAGE_PUBLISHED_PATH = () => PK_PAGE_PUBLISHED() + "#PATH";
            const ES_DEFAULTS = () => defaults.es(context);

            // Used in a couple of key events - (un)publishing and pages deletion.
            const hookPlugins = context.plugins.byType<PageHookPlugin>("pb-page-hook");

            context.pageBuilder = {
                ...context.pageBuilder,
                pages: {
                    dataLoaders: {
                        getPublishedById: new DataLoader(
                            async argsArray => {
                                const batch = db.batch();
                                const notFoundError = new NotFoundError("Page not found.");
                                const idNotProvidedError = new Error(
                                    'Cannot get published page - "id" not provided.'
                                );

                                const errorsAndResults = [];

                                let batchResultIndex = 0;
                                for (let i = 0; i < argsArray.length; i++) {
                                    const args = argsArray[i];

                                    if (!args.id) {
                                        errorsAndResults.push(idNotProvidedError);
                                        continue;
                                    }

                                    // If we have a full ID, then try to load it directly.
                                    const [pid, version] = args.id.split("#");

                                    if (version) {
                                        errorsAndResults.push(batchResultIndex++);
                                        batch.read({
                                            ...defaults.db,
                                            query: { PK: PK_PAGE(), SK: args.id }
                                        });
                                        continue;
                                    }

                                    // If we only have unique page ID (previously know as `parent`),
                                    // then let's find out which version is published.
                                    const [[pagePublished]] = await db.read<DbPagePublished>({
                                        ...defaults.db,
                                        query: { PK: PK_PAGE_PUBLISHED(), SK: pid }
                                    });

                                    if (!pagePublished) {
                                        errorsAndResults.push(notFoundError);
                                        continue;
                                    }

                                    errorsAndResults.push(batchResultIndex++);
                                    batch.read({
                                        ...defaults.db,
                                        query: { PK: PK_PAGE(), SK: pagePublished.id }
                                    });
                                }

                                // Replace batch result indexes with actual results.
                                const batchResults = await batch.execute();
                                for (let i = 0; i < errorsAndResults.length; i++) {
                                    const errorResult = errorsAndResults[i];
                                    if (typeof errorResult !== "number") {
                                        continue;
                                    }

                                    const [[page]] = batchResults[errorResult];
                                    if (!page) {
                                        errorsAndResults[i] = notFoundError;
                                        continue;
                                    }

                                    // If preview enabled, return the page, without checking if the page
                                    // is published. The preview flag is not utilized anywhere else.
                                    if (argsArray[i].preview || page.status === "published") {
                                        errorsAndResults[i] = page;

                                        // Extract compressed page content.
                                        errorsAndResults[i].content = await extractContent(
                                            errorsAndResults[i].content
                                        );

                                        continue;
                                    }

                                    errorsAndResults[i] = notFoundError;
                                }

                                return errorsAndResults;
                            },
                            {
                                cacheKeyFn: key => key.id + key.preview
                            }
                        )
                    },
                    async get(id) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rwd: "r"
                        });
                        const [[page]] = await db.read<Page>({
                            ...defaults.db,
                            query: { PK: PK_PAGE(), SK: id },
                            limit: 1
                        });

                        const identity = context.security.getIdentity();
                        checkOwnPermissions(identity, permission, page, "ownedBy");

                        // Extract compressed page content.
                        page.content = await extractContent(page.content);
                        return page;
                    },

                    async getPublishedById(args) {
                        return this.dataLoaders.getPublishedById.load(args);
                    },

                    async getPublishedByPath(args) {
                        if (!args.path) {
                            throw new Error('Cannot get published page - "path" not provided.');
                        }

                        const notFoundError = new NotFoundError("Page not found.");

                        const normalizedPath = normalizePath(args.path);
                        if (normalizedPath === "/") {
                            const settings = await context.pageBuilder.settings.default.get();
                            if (!settings?.pages?.home) {
                                throw notFoundError;
                            }

                            return context.pageBuilder.pages.getPublishedById({
                                id: settings.pages.home
                            });
                        }

                        const [[pagePublishedPath]] = await db.read<DbPagePublishedPath>({
                            ...defaults.db,
                            query: { PK: PK_PAGE_PUBLISHED_PATH(), SK: normalizedPath },
                            limit: 1
                        });

                        if (!pagePublishedPath) {
                            throw notFoundError;
                        }

                        const [[page]] = await db.read<Page>({
                            ...defaults.db,
                            query: { PK: PK_PAGE(), SK: pagePublishedPath.id },
                            limit: 1
                        });

                        if (page) {
                            // Extract compressed page content.
                            page.content = await extractContent(page.content);

                            return page;
                        }

                        throw notFoundError;
                    },

                    async listLatest(args) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rwd: "r"
                        });
                        const { sort, from, size, query, page } = getNormalizedListPagesArgs(args);

                        query.bool.filter.push(
                            {
                                term: { "locale.keyword": i18nContent.getLocale().code }
                            },
                            { term: { latest: true } }
                        );

                        // If users can only manage own records, let's add the special filter.
                        if (permission.own === true) {
                            const identity = context.security.getIdentity();
                            query.bool.filter.push({
                                term: { "createdBy.id.keyword": identity.id }
                            });
                        }

                        const response = await elasticSearch.search({
                            ...ES_DEFAULTS(),
                            body: {
                                query,
                                from,
                                size,
                                sort
                            }
                        });

                        const results = response.body.hits;
                        const total = results.total.value;
                        const data = total > 0 ? results.hits.map(item => item._source) : [];

                        const meta = createListMeta({ page, limit: size, totalCount: total });
                        return [data, meta];
                    },

                    async listPublished(args) {
                        const { sort, from, size, query, page } = getNormalizedListPagesArgs(args);

                        query.bool.filter.push(
                            {
                                term: { "locale.keyword": i18nContent.getLocale().code }
                            },
                            { term: { published: true } }
                        );

                        const response = await elasticSearch.search({
                            ...ES_DEFAULTS(),
                            body: {
                                query,
                                from,
                                size,
                                sort
                            }
                        });

                        const results = response.body.hits;
                        const total = results.total.value;
                        const data = total > 0 ? results.hits.map(item => item._source) : [];

                        const meta = createListMeta({ page, limit: size, totalCount: total });
                        return [data, meta];
                    },

                    async listTags(args) {
                        if (args.search.query.length < 2) {
                            throw new Error("Please provide at least two characters.");
                        }

                        const response = await elasticSearch.search({
                            ...ES_DEFAULTS(),
                            body: {
                                size: 0,
                                aggs: {
                                    tags: {
                                        terms: {
                                            field: "tags.keyword",
                                            include: `.*${args.search.query}.*`,
                                            size: 10
                                        }
                                    }
                                }
                            }
                        });

                        try {
                            return response.body.aggregations.tags.buckets.map(item => item.key);
                        } catch {
                            return [];
                        }
                    },

                    async listPageRevisions(pageId) {
                        const [pageIdWithoutVersion] = pageId.split("#");
                        const [pages] = await db.read<Page>({
                            ...defaults.db,
                            query: {
                                PK: PK_PAGE(),
                                SK: { $beginsWith: pageIdWithoutVersion },
                                sort: { SK: -1 }
                            }
                        });

                        return pages;
                    },

                    async create(categorySlug) {
                        await checkBasePermissions(context, PERMISSION_NAME, { rwd: "w" });

                        const category = await context.pageBuilder.categories.get(categorySlug);
                        if (!category) {
                            throw new NotFoundError(
                                `Category with slug "${categorySlug}" not found.`
                            );
                        }

                        const title = "Untitled";

                        let pagePath = "";
                        if (category.slug === "static") {
                            pagePath = normalizePath("untitled-" + uniqid.time());
                        } else {
                            pagePath = normalizePath(
                                path.join(category.url, "untitled-" + uniqid.time())
                            );
                        }

                        const identity = context.security.getIdentity();
                        new CreateDataModel().populate({ category: category.slug }).validate();

                        const [pid, version] = [mdbid(), 1];
                        const id = `${pid}#${getZeroPaddedVersionNumber(version)}`;

                        const updateSettingsModel = new UpdateSettingsModel().populate({
                            general: {
                                layout: category.layout
                            }
                        });

                        const owner = {
                            id: identity.id,
                            displayName: identity.displayName,
                            type: identity.type
                        };

                        const data = {
                            PK: PK_PAGE(),
                            SK: id,
                            TYPE: TYPE.PAGE,
                            id,
                            pid,
                            locale: context.i18nContent.getLocale().code,
                            tenant: context.security.getTenant().id,
                            editor: DEFAULT_EDITOR,
                            category: category.slug,
                            title,
                            path: pagePath,
                            version: 1,
                            status: STATUS_DRAFT,
                            locked: false,
                            publishedOn: null,
                            createdFrom: null,
                            settings: await updateSettingsModel.toJSON(),
                            savedOn: new Date().toISOString(),
                            createdOn: new Date().toISOString(),
                            ownedBy: owner,
                            createdBy: owner,
                            content: compressContent() // Just create the initial { compression, content } object.
                        };

                        await executeHookCallbacks(hookPlugins, "beforeCreate", context, data);

                        await db
                            .batch()
                            .create({ ...defaults.db, data })
                            .create({
                                ...defaults.db,
                                data: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pid,
                                    TYPE: TYPE.PAGE_LATEST,
                                    tenant: context.security.getTenant().id,
                                    locale: context.i18nContent.getLocale().code,
                                    id
                                }
                            })
                            .execute();

                        // Index page in "Elastic Search"
                        await elasticSearch.index({
                            ...ES_DEFAULTS(),
                            id: "L#" + pid,
                            body: getESLatestPageData(context, data)
                        });

                        await executeHookCallbacks(hookPlugins, "afterCreate", context, data);

                        return omit(data, ["PK", "SK", "content"]);
                    },

                    async createFrom(from) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rwd: "w"
                        });

                        const [fromUniqueId] = from.split("#");

                        const [[[page]], [[latestPageData]]] = await db
                            .batch<[[Page]], [[DbPageLatest]]>()
                            .read({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE(),
                                    SK: from
                                }
                            })
                            .read({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: fromUniqueId
                                }
                            })
                            .execute();

                        if (!page) {
                            throw new NotFoundError(`Page "${from}" not found.`);
                        }

                        // Must not be able to create a new page (revision) from a page of another author.
                        if (permission?.own === true) {
                            const identity = context.security.getIdentity();
                            if (page.ownedBy.id !== identity.id) {
                                throw new NotAuthorizedError();
                            }
                        }

                        const [, latestPageVersion] = latestPageData.id.split("#");
                        const nextVersion = parseInt(latestPageVersion) + 1;
                        const nextId = `${fromUniqueId}#${getZeroPaddedVersionNumber(nextVersion)}`;
                        const identity = context.security.getIdentity();

                        const data: Record<string, any> = {
                            ...page,
                            SK: nextId,
                            id: nextId,
                            status: STATUS_DRAFT,
                            locked: false,
                            publishedOn: null,
                            version: nextVersion,
                            savedOn: new Date().toISOString(),
                            createdFrom: from,
                            createdOn: new Date().toISOString(),
                            createdBy: {
                                id: identity.id,
                                displayName: identity.displayName,
                                type: identity.type
                            }
                        };

                        await executeHookCallbacks(hookPlugins, "beforeCreate", context, data);

                        await db
                            .batch()
                            .create({ ...defaults.db, data })
                            .update({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: fromUniqueId
                                },
                                data: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: fromUniqueId,
                                    TYPE: TYPE.PAGE_LATEST,
                                    tenant: context.security.getTenant().id,
                                    locale: context.i18nContent.getLocale().code,
                                    id: nextId
                                }
                            })
                            .execute();

                        // Replace existing `"L#" + fromParent` entry with the new one.
                        await elasticSearch.index({
                            ...ES_DEFAULTS(),
                            id: "L#" + fromUniqueId,
                            body: getESLatestPageData(context, data)
                        });

                        await executeHookCallbacks(hookPlugins, "afterCreate", context, data);

                        // Extract compressed page content.
                        page.content = await extractContent(page.content);
                        return data as Page;
                    },

                    async update(id, data) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rwd: "w"
                        });

                        const [uniqueId] = id.split("#");

                        const [[[page]], [[latestPageData]]] = await db
                            .batch()
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE(), SK: id },
                                limit: 1
                            })
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE_LATEST(), SK: uniqueId },
                                limit: 1
                            })
                            .execute();

                        if (!page) {
                            throw new NotFoundError(`Page "${id}" not found.`);
                        }

                        if (page.locked) {
                            throw new Error(`Cannot update page because it's locked.`);
                        }

                        const identity = context.security.getIdentity();
                        checkOwnPermissions(identity, permission, page, "ownedBy");

                        const updateDataModel = new UpdateDataModel().populate(data);
                        await updateDataModel.validate();

                        const updateData = await updateDataModel.toJSON({ onlyDirty: true });

                        const updateSettingsModel = new UpdateSettingsModel()
                            .populate(page.settings)
                            .populate(data.settings);

                        await updateSettingsModel.validate();

                        updateData.settings = await updateSettingsModel.toJSON();
                        updateData.savedOn = new Date().toISOString();

                        await executeHookCallbacks(hookPlugins, "beforeUpdate", context, page);

                        if (updateData.content) {
                            updateData.content = compressContent(updateData.content);
                        }

                        await db.update({
                            ...defaults.db,
                            query: { PK: PK_PAGE(), SK: id },
                            data: updateData
                        });

                        // If we updated the latest version, then make sure the changes are propagated to ES too.
                        if (latestPageData.id === id) {
                            // Index file in "Elastic Search"
                            await elasticSearch.update({
                                ...ES_DEFAULTS(),
                                id: `L#${uniqueId}`,
                                body: {
                                    doc: getESUpdateLatestPageData(updateData)
                                }
                            });
                        }

                        await executeHookCallbacks(hookPlugins, "afterUpdate", context, page);

                        return { ...page, ...data };
                    },

                    async delete(pageId) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rwd: "d"
                        });

                        const [pageUniqueId, pageVersion] = pageId.split("#");

                        // 1. Load the page and latest / published page (revision) data.
                        const [[[page]], [[latestPageData]], [[publishedPageData]]] = await db
                            .batch<[[Page]], [[DbPageLatest]], [[DbPagePublished]]>()
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE(), SK: pageId }
                            })
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE_LATEST(), SK: pageUniqueId }
                            })
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE_PUBLISHED(), SK: pageUniqueId }
                            })
                            .execute();

                        // 2. Do a couple of checks.
                        if (!page) {
                            throw new NotFoundError(`Page "${pageId}" not found.`);
                        }

                        const identity = context.security.getIdentity();
                        checkOwnPermissions(identity, permission, page, "ownedBy");

                        const settings = await context.pageBuilder.settings.default.get();
                        const pages = settings?.pages || {};
                        for (const key in pages) {
                            if (pages[key] === page.pid) {
                                throw new Error(`Cannot delete page because it's set as ${key}.`);
                            }
                        }

                        // 3. Let's start updating. But first, let's trigger before-delete hook callbacks.
                        await executeHookCallbacks(hookPlugins, "beforeDelete", context, {
                            page,
                            latestPageData,
                            publishedPageData
                        });

                        // Before we continue, note that if `publishedPageData` exists, then `publishedPagePathData`
                        // also exists. And to delete it, we can read `publishedPageData.path` to get its SK.
                        // There can't be a situation where just one record exists, there's always gonna be both.

                        // If we are deleting the initial version, we need to remove all versions and all of the meta data.
                        if (pageVersion === getZeroPaddedVersionNumber(1)) {
                            // 4.1. We delete pages in batches of 10.
                            while (true) {
                                const [pagesBatch] = await db.read({
                                    ...defaults.db,
                                    query: { PK: PK_PAGE(), SK: { $beginsWith: pageUniqueId } }
                                });

                                if (pagesBatch.length === 0) {
                                    break;
                                }

                                const batch = db.batch();
                                for (let i = 0; i < pagesBatch.length; i++) {
                                    const page = pagesBatch[i];
                                    batch.delete({
                                        ...defaults.db,
                                        query: { PK: PK_PAGE(), SK: page.id }
                                    });
                                }

                                await batch.execute();
                            }

                            // 4.2. Delete latest / published data.
                            const deleteBatch = db.batch();
                            await deleteBatch.delete({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pageUniqueId
                                }
                            });

                            if (publishedPageData) {
                                deleteBatch
                                    .delete({
                                        ...defaults.db,
                                        query: {
                                            PK: PK_PAGE_PUBLISHED(),
                                            SK: publishedPageData.SK
                                        }
                                    })
                                    .delete({
                                        ...defaults.db,
                                        query: {
                                            PK: PK_PAGE_PUBLISHED_PATH(),
                                            SK: publishedPageData.path
                                        }
                                    });
                            }

                            await deleteBatch.execute();

                            // 4.3. Finally, delete data from ES.
                            await elasticSearch.bulk({
                                body: [
                                    {
                                        delete: {
                                            _id: `L#${pageUniqueId}`,
                                            _index: ES_DEFAULTS().index
                                        }
                                    },
                                    {
                                        delete: {
                                            _id: `P#${pageUniqueId}`,
                                            _index: ES_DEFAULTS().index
                                        }
                                    }
                                ]
                            });

                            await executeHookCallbacks(hookPlugins, "afterDelete", context, {
                                page,
                                latestPageData,
                                publishedPageData
                            });

                            return [page, null];
                        }

                        // 5. If we are deleting a specific version (version > 1)...

                        // 6.1. Delete the actual page entry.
                        const batch = db.batch().delete({
                            ...defaults.db,
                            query: { PK: PK_PAGE(), SK: pageId }
                        });

                        // We need to update / delete data in ES too.
                        const esOperations = [];

                        const isLatest = latestPageData?.id === pageId;
                        const isPublished = publishedPageData?.id === pageId;
                        let latestPage = null;

                        // 6.2. If the page is published, remove published data, both from DB and ES.
                        if (isPublished) {
                            batch
                                .delete({
                                    ...defaults.db,
                                    query: {
                                        PK: PK_PAGE_PUBLISHED(),
                                        SK: pageUniqueId
                                    }
                                })
                                .delete({
                                    ...defaults.db,
                                    query: {
                                        PK: PK_PAGE_PUBLISHED_PATH(),
                                        SK: publishedPageData.path
                                    }
                                });

                            esOperations.push({
                                delete: { _id: `P#${pageUniqueId}`, _index: ES_DEFAULTS().index }
                            });
                        }

                        // 6.3. If the page is latest, assign the previously latest page as the new latest.
                        // Updates must be made again both on DB and ES side.
                        if (isLatest) {
                            [[latestPage]] = await db.read({
                                ...defaults.db,
                                query: { PK: PK_PAGE(), SK: { $lt: pageId } },
                                sort: { SK: -1 },
                                limit: 1
                            });

                            // Update latest page data.
                            batch.update({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pageUniqueId
                                },
                                data: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pageUniqueId,
                                    TYPE: TYPE.PAGE_LATEST,
                                    tenant: context.security.getTenant().id,
                                    locale: context.i18nContent.getLocale().code,
                                    id: latestPage.id
                                }
                            });

                            // And of course, update the latest revision entry in ES.
                            esOperations.push(
                                {
                                    index: { _id: `L#${pageUniqueId}`, _index: ES_DEFAULTS().index }
                                },
                                getESLatestPageData(context, latestPage)
                            );
                        }

                        await batch.execute();

                        // When deleting a non-published and non-latest revision, we mustn't execute the bulk operation.
                        if (esOperations.length) {
                            await elasticSearch.bulk({ body: esOperations });
                        }

                        await executeHookCallbacks(hookPlugins, "afterDelete", context, {
                            page,
                            latestPageData,
                            publishedPageData
                        });

                        // 7. Done. We return both the deleted page, and the new latest one (if there is one).
                        return [page, latestPage];
                    },

                    async publish(pageId: string) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rcpu: "p"
                        });

                        const [pid] = pageId.split("#");

                        // `publishedPageData` will give us a record that contains `id` and `path, which tell us
                        // the current revision and over which path it has been published, respectively.
                        const [[[page]], [[publishedPageData]], [[latestPageData]]] = await db
                            .batch<[[Page]], [[DbPagePublished]], [[DbPageLatest]]>()
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE(), SK: pageId }
                            })
                            .read({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_PUBLISHED(),
                                    SK: pid
                                }
                            })
                            .read({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pid
                                }
                            })
                            .execute();

                        if (!page) {
                            throw new NotFoundError(`Page "${pageId}" not found.`);
                        }

                        const identity = context.security.getIdentity();
                        checkOwnPermissions(identity, permission, page, "ownedBy");

                        if (page.status === "published") {
                            throw new NotFoundError(`Page "${pageId}" is already published.`);
                        }

                        const [[pagePublishedPathData]] = await db.read<DbPagePublishedPath>({
                            ...defaults.db,
                            query: {
                                PK: PK_PAGE_PUBLISHED_PATH(),
                                SK: page.path
                            }
                        });

                        await executeHookCallbacks(hookPlugins, "beforePublish", context, {
                            page,
                            latestPageData,
                            publishedPageData
                        });

                        const pathTakenByAnotherPage =
                            pagePublishedPathData && !pagePublishedPathData.id.startsWith(page.pid);

                        // If this is true, let's unpublish the page first. Note that we're not talking about this
                        // same page, but a previous revision. We're talking about a completely different page
                        // (with different PID). Remember that page ID equals `PID#version`.
                        if (pathTakenByAnotherPage) {
                            // Note two things here...
                            // 1) It is possible that this call is about to try to unpublish a page that is set as
                            // a special page (home/404/error). In that case, this whole process will fail, and that
                            // is to be expected. Maybe we could think of a better solution in the future, but for
                            // now, it works like this. If there was only more ⏱.
                            // 2) If a user doesn't have the unpublish permission, again, the whole action will fail.
                            await this.unpublish(pagePublishedPathData.id);
                        }

                        // Now that the other page has been unpublished, we can continue with publish the current one.

                        // Change loaded page's status to published.
                        page.status = STATUS_PUBLISHED;
                        page.locked = true;
                        page.publishedOn = new Date().toISOString();

                        // We need to issue a couple of updates.
                        const batch = db.batch();

                        // 1. Update the page in the database first.
                        batch.update({
                            ...defaults.db,
                            query: {
                                PK: PK_PAGE(),
                                SK: pageId
                            },
                            data: page
                        });

                        if (publishedPageData) {
                            // If there is a `published` page already, we need to set it as `unpublished`. We need to
                            // execute three updates
                            // - update the previously published page's status
                            // - update the published page entry (PK_PAGE_PUBLISHED())
                            // - update the published page path entry (PK_PAGE_PUBLISHED_PATH())

                            // 🤦 DynamoDB does not support `batchUpdate` - so here we load the previously published
                            // page's data so that we can update its status within a batch operation. If, hopefully,
                            // they introduce a true update batch operation, remove this `read` call.

                            const previouslyPublishedPageDataBatch = db
                                .batch<[[Page]], [[DbPagePublishedPath]]>()
                                .read({
                                    ...defaults.db,
                                    query: { PK: PK_PAGE(), SK: publishedPageData.id }
                                })
                                .read({
                                    ...defaults.db,
                                    query: {
                                        PK: PK_PAGE_PUBLISHED_PATH(),
                                        SK: publishedPageData.path
                                    }
                                });

                            const [
                                [[previouslyPublishedPage]],
                                [[publishedPagePathData]]
                            ] = await previouslyPublishedPageDataBatch.execute();

                            previouslyPublishedPage.status = STATUS_UNPUBLISHED;

                            // If the paths are different, delete previous `DbPagePublishedPath` entry.
                            if (
                                previouslyPublishedPage.id === publishedPagePathData.id &&
                                page.path !== publishedPagePathData.path
                            ) {
                                batch.delete({
                                    ...defaults.db,
                                    query: {
                                        PK: PK_PAGE_PUBLISHED_PATH(),
                                        SK: previouslyPublishedPage.path
                                    }
                                });

                                // TODO: We could be overwriting a completely different page here. Need to handler that too.
                                // TODO: If we just unpublished a different page, let's update its data as well.
                            }

                            batch
                                .update({
                                    ...defaults.db,
                                    query: {
                                        PK: PK_PAGE(),
                                        SK: publishedPageData.id
                                    },
                                    data: previouslyPublishedPage
                                })
                                .update({
                                    ...defaults.db,
                                    query: {
                                        PK: PK_PAGE_PUBLISHED(),
                                        SK: pid
                                    },
                                    data: {
                                        PK: PK_PAGE_PUBLISHED(),
                                        SK: pid,
                                        TYPE: TYPE.PAGE_PUBLISHED,
                                        tenant: context.security.getTenant().id,
                                        locale: context.i18nContent.getLocale().code,
                                        id: pageId,
                                        path: page.path
                                    }
                                })
                                .create({
                                    ...defaults.db,
                                    data: {
                                        PK: PK_PAGE_PUBLISHED_PATH(),
                                        SK: page.path,
                                        TYPE: TYPE.PAGE_PUBLISHED_PATH,
                                        tenant: context.security.getTenant().id,
                                        locale: context.i18nContent.getLocale().code,
                                        id: page.id,
                                        path: page.path
                                    }
                                });
                        } else {
                            batch
                                .create({
                                    ...defaults.db,
                                    data: {
                                        PK: PK_PAGE_PUBLISHED(),
                                        SK: pid,
                                        TYPE: TYPE.PAGE_PUBLISHED,
                                        tenant: context.security.getTenant().id,
                                        locale: context.i18nContent.getLocale().code,
                                        id: pageId,
                                        path: page.path
                                    }
                                })
                                .create({
                                    ...defaults.db,
                                    data: {
                                        PK: PK_PAGE_PUBLISHED_PATH(),
                                        SK: page.path,
                                        TYPE: TYPE.PAGE_PUBLISHED_PATH,
                                        tenant: context.security.getTenant().id,
                                        locale: context.i18nContent.getLocale().code,
                                        id: page.id,
                                        path: page.path
                                    }
                                });
                        }

                        await batch.execute();

                        // Update data in ES.
                        const esOperations = [];

                        // If we are publishing the latest revision, let's also update the latest revision entry's status in ES.
                        if (latestPageData?.id === pageId) {
                            esOperations.push(
                                {
                                    update: {
                                        _id: `L#${pid}`,
                                        _index: ES_DEFAULTS().index
                                    }
                                },
                                {
                                    doc: {
                                        status: STATUS_PUBLISHED,
                                        locked: true,
                                        publishedOn: page.publishedOn
                                    }
                                }
                            );
                        }

                        // And of course, update the published revision entry in ES.
                        esOperations.push(
                            { index: { _id: `P#${pid}`, _index: ES_DEFAULTS().index } },
                            getESPublishedPageData(context, {
                                ...page,
                                id: pageId,
                                status: STATUS_PUBLISHED,
                                locked: true
                            })
                        );

                        await elasticSearch.bulk({ body: esOperations });

                        await executeHookCallbacks(hookPlugins, "afterPublish", context, {
                            page,
                            latestPageData,
                            publishedPageData
                        });

                        return page;
                    },

                    async unpublish(pageId: string) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rcpu: "u"
                        });

                        const [pageUniqueId] = pageId.split("#");

                        const [[[page]], [[publishedPageData]], [[latestPageData]]] = await db
                            .batch()
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE(), SK: pageId },
                                limit: 1
                            })
                            .read({
                                ...defaults.db,
                                limit: 1,
                                query: {
                                    PK: PK_PAGE_PUBLISHED(),
                                    SK: pageUniqueId
                                }
                            })
                            .read({
                                ...defaults.db,
                                limit: 1,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pageUniqueId
                                }
                            })
                            .execute();

                        if (!page) {
                            throw new NotFoundError(`Page "${pageId}" not found.`);
                        }

                        const identity = context.security.getIdentity();
                        checkOwnPermissions(identity, permission, page, "ownedBy");

                        if (!publishedPageData || publishedPageData.id !== pageId) {
                            throw new Error(`Page "${pageId}" is not published.`);
                        }

                        const settings = await context.pageBuilder.settings.default.get();
                        const pages = settings?.pages || {};
                        for (const key in pages) {
                            if (pages[key] === page.pid) {
                                throw new Error(
                                    `Cannot unpublish page because it's set as ${key}.`
                                );
                            }
                        }

                        await executeHookCallbacks(hookPlugins, "beforeUnpublish", context, page);

                        page.status = STATUS_UNPUBLISHED;

                        await db
                            .batch()
                            .delete({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_PUBLISHED(),
                                    SK: pageUniqueId
                                }
                            })
                            .delete({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE_PUBLISHED_PATH(),
                                    SK: publishedPageData.path
                                }
                            })
                            .update({
                                ...defaults.db,
                                query: {
                                    PK: PK_PAGE(),
                                    SK: page.id
                                },
                                data: page
                            })
                            .execute();

                        // Update data in ES.
                        const esOperations = [];

                        // If we are unpublishing the latest revision, let's also update the latest revision entry's status in ES.
                        if (latestPageData.id === pageId) {
                            esOperations.push(
                                {
                                    update: {
                                        _id: `L#${pageUniqueId}`,
                                        _index: ES_DEFAULTS().index
                                    }
                                },
                                { doc: { status: STATUS_UNPUBLISHED } }
                            );
                        }

                        // And of course, delete the published revision entry in ES.
                        esOperations.push({
                            delete: { _id: `P#${pageUniqueId}`, _index: ES_DEFAULTS().index }
                        });

                        await elasticSearch.bulk({ body: esOperations });

                        await executeHookCallbacks(hookPlugins, "afterUnpublish", context, page);

                        return page;
                    },

                    async requestReview(pageId: string) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rcpu: "r"
                        });

                        const [pageUniqueId] = pageId.split("#");

                        const [[[page]], [[latestPageData]]] = await db
                            .batch()
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE(), SK: pageId },
                                limit: 1
                            })
                            .read({
                                ...defaults.db,
                                limit: 1,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pageUniqueId
                                }
                            })
                            .execute();

                        if (!page) {
                            throw new NotFoundError(`Page "${pageId}" not found.`);
                        }

                        const allowedStatuses = [STATUS_DRAFT, STATUS_CHANGES_REQUESTED];
                        if (!allowedStatuses.includes(page.status)) {
                            throw new Error(
                                `Cannot request review - page is not a draft nor a change request has been issued.`
                            );
                        }

                        const identity = context.security.getIdentity();
                        checkOwnPermissions(identity, permission, page, "ownedBy");

                        // Change loaded page's status to `reviewRequested`.
                        page.status = STATUS_REVIEW_REQUESTED;
                        page.locked = true;

                        await db.update({
                            ...defaults.db,
                            query: {
                                PK: PK_PAGE(),
                                SK: pageId
                            },
                            data: omit(page, ["PK", "SK"])
                        });

                        // If we updated the latest version, then make sure the changes are propagated to ES too.
                        if (latestPageData.id === pageId) {
                            const [uniqueId] = pageId.split("#");
                            // Index file in "Elastic Search"
                            await elasticSearch.update({
                                ...ES_DEFAULTS(),
                                id: `L#${uniqueId}`,
                                body: {
                                    doc: {
                                        status: STATUS_REVIEW_REQUESTED,
                                        locked: true
                                    }
                                }
                            });
                        }

                        return page;
                    },

                    async requestChanges(pageId: string) {
                        const permission = await checkBasePermissions(context, PERMISSION_NAME, {
                            rcpu: "c"
                        });

                        const [pageUniqueId] = pageId.split("#");

                        const [[[page]], [[latestPageData]]] = await db
                            .batch()
                            .read({
                                ...defaults.db,
                                query: { PK: PK_PAGE(), SK: pageId },
                                limit: 1
                            })
                            .read({
                                ...defaults.db,
                                limit: 1,
                                query: {
                                    PK: PK_PAGE_LATEST(),
                                    SK: pageUniqueId
                                }
                            })
                            .execute();

                        if (!page) {
                            throw new NotFoundError(`Page "${pageId}" not found.`);
                        }

                        if (page.status !== STATUS_REVIEW_REQUESTED) {
                            throw new Error(
                                `Cannot request changes on a page that's not in review.`,
                                "REQUESTED_CHANGES_ON_NOT_IN_REVIEW_PAGE"
                            );
                        }

                        const identity = context.security.getIdentity();
                        if (page.ownedBy.id === identity.id) {
                            throw new Error(
                                "Cannot request changes on own page.",
                                "REQUEST_CHANGES_ON_OWN_PAGE"
                            );
                        }

                        checkOwnPermissions(identity, permission, page, "ownedBy");

                        // Change loaded page's status to published.
                        page.status = STATUS_CHANGES_REQUESTED;
                        page.locked = false;

                        await db.update({
                            ...defaults.db,
                            query: {
                                PK: PK_PAGE(),
                                SK: pageId
                            },
                            data: omit(page, ["PK", "SK"])
                        });

                        // If we updated the latest version, then make sure the changes are propagated to ES too.
                        if (latestPageData.id === pageId) {
                            const [uniqueId] = pageId.split("#");
                            // Index file in "Elastic Search"
                            await elasticSearch.update({
                                ...ES_DEFAULTS(),
                                id: `L#${uniqueId}`,
                                body: {
                                    doc: {
                                        status: STATUS_CHANGES_REQUESTED,
                                        locked: false
                                    }
                                }
                            });
                        }

                        return page;
                    },

                    prerendering: {
                        async render(args) {
                            const handlers = configuration?.prerendering?.handlers;
                            if (!handlers) {
                                return;
                            }

                            const current = await context.pageBuilder.settings.default.get();
                            const defaults = await context.pageBuilder.settings.default.getDefault();

                            const appUrl =
                                current?.prerendering?.app?.url || defaults?.prerendering?.app?.url;

                            const storageName =
                                current?.prerendering?.storage?.name ||
                                defaults?.prerendering?.storage?.name;

                            if (!appUrl || !storageName) {
                                return;
                            }

                            const meta = merge(
                                defaults?.prerendering?.meta,
                                current?.prerendering?.meta
                            );

                            const { paths, tags } = args;

                            if (Array.isArray(paths)) {
                                if (!handlers.render) {
                                    return;
                                }

                                return await context.handlerClient.invoke<RenderHandlerArgs>({
                                    name: configuration.prerendering.handlers.render,
                                    await: false,
                                    payload: paths.map<RenderArgs>(p => ({
                                        url: appUrl + p.path,
                                        configuration: merge(
                                            {
                                                meta,
                                                storage: {
                                                    folder: trimStart(p.path, "/"),
                                                    name: storageName
                                                },
                                                db: {
                                                    namespace:
                                                        "T#" + context.security.getTenant().id
                                                }
                                            },
                                            p.configuration
                                        )
                                    }))
                                });
                            }

                            if (!Array.isArray(tags)) {
                                return;
                            }

                            if (!handlers.queue || !handlers.queue.add) {
                                return;
                            }

                            return await context.handlerClient.invoke<QueueAddHandlerArgs>({
                                name: handlers.queue.add,
                                await: false,
                                payload: {
                                    render: tags.map(current => ({
                                        tag: current.tag,
                                        configuration: merge(
                                            {
                                                db: {
                                                    namespace:
                                                        "T#" + context.security.getTenant().id
                                                }
                                            },
                                            current.configuration
                                        )
                                    }))
                                }
                            });
                        },
                        async flush(args) {
                            const handlers = configuration?.prerendering?.handlers;
                            if (!handlers) {
                                return;
                            }

                            const current = await context.pageBuilder.settings.default.get();
                            const defaults = await context.pageBuilder.settings.default.getDefault();

                            const appUrl =
                                current?.prerendering?.app?.url || defaults?.prerendering?.app?.url;

                            const storageName =
                                current?.prerendering?.storage?.name ||
                                defaults?.prerendering?.storage?.name;

                            if (!storageName) {
                                return;
                            }

                            const { paths, tags } = args;

                            if (Array.isArray(paths)) {
                                if (!handlers.flush) {
                                    return;
                                }

                                return await context.handlerClient.invoke<FlushHandlerArgs>({
                                    name: configuration.prerendering.handlers.flush,
                                    await: false,
                                    payload: paths.map<FlushArgs>(p => ({
                                        url: appUrl + p.path,
                                        // Configuration is mainly static (defined here), but some configuration
                                        // overrides can arrive via the call args, so let's do a merge here.
                                        configuration: merge(
                                            {
                                                db: {
                                                    namespace:
                                                        "T#" + context.security.getTenant().id
                                                }
                                            },
                                            p.configuration
                                        )
                                    }))
                                });
                            }

                            if (!Array.isArray(tags)) {
                                return;
                            }

                            if (!handlers.queue || !handlers.queue.add) {
                                return;
                            }

                            return await context.handlerClient.invoke<QueueAddHandlerArgs>({
                                name: handlers.queue.add,
                                await: false,
                                payload: {
                                    flush: tags.map(current => ({
                                        tag: current.tag,
                                        configuration: merge(
                                            {
                                                db: {
                                                    namespace:
                                                        "T#" + context.security.getTenant().id
                                                }
                                            },
                                            current.configuration
                                        )
                                    }))
                                }
                            });
                        }
                    }
                }
            };
        }
    };

    return plugin;
};

export default createPlugin;
