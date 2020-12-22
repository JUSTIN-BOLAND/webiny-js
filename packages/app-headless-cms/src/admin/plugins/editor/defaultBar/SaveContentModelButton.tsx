import React, { useState } from "react";
import { ButtonPrimary } from "@webiny/ui/Button";
import { useSnackbar } from "@webiny/app-admin/hooks/useSnackbar";
import { useContentModelEditor } from "../../../views/components/ContentModelEditor/Context";

import { i18n } from "@webiny/app/i18n";
const t = i18n.namespace("app-headless-cms/admin/editor/top-bar/save-button");

const SaveContentModelButton = () => {
    const { saveContentModel } = useContentModelEditor();
    const [loading, setLoading] = useState(false);
    const { showSnackbar } = useSnackbar();

    return (
        <ButtonPrimary
            disabled={loading}
            onClick={async () => {
                setLoading(true);
                const response = await saveContentModel();
                setLoading(false);

                if (response.error) {
                    return showSnackbar(response.error.message);
                }

                showSnackbar(t`Your content model was saved successfully!`);
            }}
        >
            {t`Save`}
        </ButtonPrimary>
    );
};

export default SaveContentModelButton;
