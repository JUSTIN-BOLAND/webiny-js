import React, { useState, useEffect, useCallback } from "react";
import { i18n } from "@webiny/app/i18n";
import { CmsEditorField } from "@webiny/app-headless-cms/types";
import { BindComponentRenderProp } from "@webiny/form";
import FileUpload from "./FileUpload";
import { createRenderImagePreview, imageExtensions } from "./utils";
import fileIcon from "../../fields/icons/round_insert_drive_file-24px.svg";

const t = i18n.ns("app-headless-cms/admin/fields/file");

const imagePreviewProps = {
    transform: { width: 300 },
    style: { width: "100%", height: 300, objectFit: "contain" }
};

type SingleFileProps = {
    bind: BindComponentRenderProp;
    field: CmsEditorField;
    description?: string;
};

const SingleFile = (props: SingleFileProps) => {
    const [previewURL, setPreviewURL] = useState(null);
    const [isImage, setIsImage] = useState(true);
    // Update `previewURL`
    useEffect(() => {
        if (props.bind.value && props.bind.value.includes("http")) {
            setPreviewURL(null);
        }
    }, [props.bind.value]);
    // Update `isImage`
    useEffect(() => {
        if (props.bind.value) {
            setIsImage(imageExtensions.some(extension => props.bind.value.includes(extension)));
        }
    }, [props.bind.value]);

    const getImageSrc = useCallback(() => {
        if (imageExtensions.some(extension => props.bind.value.includes(extension))) {
            return props.bind.value;
        }
        return fileIcon;
    }, [props.bind.value]);

    const getValue = useCallback(() => {
        if (!props.bind.value) {
            return props.bind.value;
        }

        return { src: previewURL || getImageSrc() };
    }, [previewURL, props.bind.value]);

    return (
        <FileUpload
            {...props.bind}
            onChange={value => {
                if (value !== null) {
                    props.bind.onChange(value.key);
                    setPreviewURL(value.src);
                } else {
                    props.bind.onChange(value);
                    setPreviewURL(value);
                }
            }}
            value={getValue()}
            imagePreviewProps={imagePreviewProps}
            placeholder={t`Select a file"`}
            description={props.description}
            renderImagePreview={
                !isImage && createRenderImagePreview({ value: props.bind.value, imagePreviewProps })
            }
        />
    );
};

export default SingleFile;
