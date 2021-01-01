import mocks from "./mocks/pluralizeContentModel";

const LIST_P = /* GraphQL */ `
    query {
        listPs {
            data {
                id
            }
        }
    }
`;

// eslint-disable-next-line
describe.skip("Pluralize Content Model Test", () => {
    const { database, environment } = useContentHandler();
    const initial = {};

    beforeAll(async () => {
        // Let's create a basic environment and a content model group.
        initial.environment = await createEnvironment({ database });
        initial.contentModelGroup = await createContentModelGroup({ database });
    });

    it("should be able to create a content model with a single capitalized letter and not have the pluralized version be capitalized", async () => {
        const { content, createContentModel, invoke } = environment(initial.environment.id);

        await createContentModel(
            mocks.contentModel({ contentModelGroupId: initial.contentModelGroup.id })
        );

        const ps = await content("p");

        await ps.create(mocks.createP);

        const [{ data }] = await invoke({
            body: {
                query: LIST_P
            }
        });

        expect(data.listPs.data.id).toEqual(mocks.createdP.id);
    });
});
