import mocks from "./mocks/preventTitleFieldDeletion";

// eslint-disable-next-line
describe.skip("Title field deletion test", () => {
    const { environment, database } = useContentHandler();

    const initial = {};

    beforeAll(async () => {
        // Let's create a basic environment and a content model group.
        initial.environment = await createEnvironment({ database });
        initial.contentModelGroup = await createContentModelGroup({ database });
    });

    it("should not allow deletion of title field", async () => {
        const { createContentModel, updateContentModel } = environment(initial.environment.id);

        const contentModel = await createContentModel(
            mocks.book({ contentModelGroupId: initial.contentModelGroup.id })
        );

        let error;
        try {
            await updateContentModel(
                mocks.removeTitleField({
                    contentModelId: contentModel.id,
                    contentModelGroupId: initial.contentModelGroup.id
                })
            );
        } catch (e) {
            error = e;
        }

        expect(error.message).toBe(
            `Cannot remove field "name" because it's currently set as the title field. Please chose another title field first and try again.`
        );
    });
});
