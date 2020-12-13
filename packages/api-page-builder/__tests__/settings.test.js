import useGqlHandler from "./useGqlHandler";

jest.setTimeout(15000);

describe("Settings Test", () => {
    const {
        createCategory,
        createPage,
        getSettings,
        updateSettings,
        logsDb,
        until,
        listPublishedPages,
        publishPage,
        deleteElasticSearchIndex
    } = useGqlHandler();

    beforeEach(async () => {
        await deleteElasticSearchIndex();
    });

    test("get and update settings", async () => {
        // 1. Should return default settings.
        let [response] = await getSettings();
        expect(response).toEqual({
            data: {
                pageBuilder: {
                    getSettings: {
                        data: {
                            domain: null,
                            name: null,
                            social: {
                                facebook: null,
                                instagram: null,
                                twitter: null,
                                image: null
                            }
                        },
                        error: null,
                        id: "T#root#L#en-US#PB#SETTINGS"
                    }
                }
            }
        });

        // 2. Updating existing settings should immediately return the updated ones.
        [response] = await updateSettings({
            data: {
                name: "test 1",
                domain: "https://www.test.com",
                social: {
                    facebook: "https://www.facebook.com",
                    instagram: "https://www.instagram.com",
                    twitter: "https://www.twitter.com",
                    image: {
                        id: "1kucKwtX3vI2w6tYuPwJsvRFn9g",
                        src:
                            "https://d1peg08dnrinui.cloudfront.net/files/9ki1goobp-webiny_security__1_.png"
                    }
                }
            }
        });

        expect(response).toMatchObject({
            data: {
                pageBuilder: {
                    updateSettings: {
                        data: {
                            name: "test 1",
                            domain: "https://www.test.com",
                            social: {
                                instagram: "https://www.instagram.com",
                                facebook: "https://www.facebook.com",
                                twitter: "https://www.twitter.com",
                                image: {
                                    id: "1kucKwtX3vI2w6tYuPwJsvRFn9g",
                                    src:
                                        "https://d1peg08dnrinui.cloudfront.net/files/9ki1goobp-webiny_security__1_.png"
                                }
                            }
                        },
                        error: null,
                        id: "T#root#L#en-US#PB#SETTINGS"
                    }
                }
            }
        });

        // 3. Finally, getting the settings again should return the updated ones.
        [response] = await getSettings();
        expect(response).toMatchObject({
            data: {
                pageBuilder: {
                    getSettings: {
                        data: {
                            name: "test 1",
                            domain: "https://www.test.com",
                            social: {
                                instagram: "https://www.instagram.com",
                                facebook: "https://www.facebook.com",
                                twitter: "https://www.twitter.com",
                                image: {
                                    id: "1kucKwtX3vI2w6tYuPwJsvRFn9g",
                                    src:
                                        "https://d1peg08dnrinui.cloudfront.net/files/9ki1goobp-webiny_security__1_.png"
                                }
                            }
                        },
                        error: null,
                        id: "T#root#L#en-US#PB#SETTINGS"
                    }
                }
            }
        });
    });

    test("ensure we don't overload settings when listing pages", async () => {
        await createCategory({
            data: {
                slug: `category`,
                name: `name`,
                url: `/some-url/`,
                layout: `layout`
            }
        });

        // Let's create five pages and publish them.
        for (let i = 0; i < 5; i++) {
            createPage({ category: "category" }).then(([res]) =>
                publishPage({ id: res.data.pageBuilder.createPage.data.id })
            );
        }

        // Wait until all are created.
        await until(
            listPublishedPages,
            ([res]) => res.data.pageBuilder.listPublishedPages.data.length === 5
        );

        // Let's use the `id` of the last log as the cursor.
        const [logs] = await logsDb.readLogs();
        const { id: cursor } = logs.pop();

        await listPublishedPages();

        // TODO fix this
        /* eslint-disable jest/valid-expect-in-promise */
        // When listing published pages, settings must have been loaded from the DB only once.
        const result = await logsDb
            .readLogs()
            .then(([logs]) => logs.filter(item => item.id > cursor))
            .then(logs => logs.filter(item => item.query.PK === "T#root#L#en-US#PB#SETTINGS"));

        expect(result).toHaveLength(1);
    });
});
