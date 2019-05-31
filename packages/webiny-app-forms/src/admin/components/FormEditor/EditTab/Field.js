import React from "react";
import { useFormEditor } from "webiny-app-forms/admin/components/FormEditor";
import styled from "react-emotion";
import { IconButton } from "webiny-ui/Button";
import { ReactComponent as EditIcon } from "../icons/edit.svg";
import { ReactComponent as DeleteIcon } from "../icons/delete.svg";

const FieldContainer = styled("div")({
    display: "flex",
    flexDirection: "row"
});

const Info = styled("div")({
    display: "flex",
    flexDirection: "column",
    "> *": {
        flex: "1 100%"
    }
});

const Actions = styled("div")({
    display: "flex",
    flexDirection: "row",
    alignItems: "right",
    "> *": {
        flex: "1 100%"
    }
});

const Field = ({ field }) => {
    const { editField, deleteField } = useFormEditor();

    return (
        <FieldContainer>
            <Info>
                <strong>{field.label}</strong>
                <span>
                    {field.id} ({field.type})
                </span>
            </Info>
            <Actions>
                <IconButton icon={<EditIcon />} onClick={() => editField(field)} />
                <IconButton icon={<DeleteIcon />} onClick={() => deleteField(field)} />
            </Actions>
        </FieldContainer>
    );
};

export default Field;
