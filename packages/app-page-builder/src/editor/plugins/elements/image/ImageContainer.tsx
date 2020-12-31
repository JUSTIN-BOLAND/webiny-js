import React, { useCallback } from "react";
import styled from "@emotion/styled";
import SingleImageUpload from "@webiny/app-admin/components/SingleImageUpload";
import { PbElement } from "@webiny/app-page-builder/types";
import { useEventActionHandler } from "@webiny/app-page-builder/editor";
import { UpdateElementActionEvent } from "@webiny/app-page-builder/editor/recoil/actions";

const position = { left: "flex-start", center: "center", right: "flex-end" };

const AlignImage = styled("div")((props: any) => ({
    img: {
        alignSelf: position[props.align] || "center"
    }
}));

type ImageContainerType = {
    element: PbElement;
};
const ImageContainer: React.FunctionComponent<ImageContainerType> = ({ element }) => {
    const handler = useEventActionHandler();
    const {
        id,
        data: { image = {}, settings = {} }
    } = element || {};
    const { horizontalAlign = "center" } = settings;

    const imgStyle = { width: null, height: null };
    if (image.width) {
        const { width } = image;
        imgStyle.width = width;
    }
    if (image.height) {
        const { height } = image;
        imgStyle.height = height;
    }

    const onChange = useCallback(
        async (data: { [key: string]: string }) => {
            handler.trigger(
                new UpdateElementActionEvent({
                    element: {
                        ...element,
                        data: {
                            ...element.data,
                            image: {
                                ...(element.data.image || {}),
                                file: data
                            }
                        }
                    },
                    merge: true,
                    history: true
                })
            );
        },
        [id]
    );
    // required due to re-rendering when set content atom and still nothing in elements atom
    if (!element) {
        return null;
    }

    return (
        <AlignImage align={horizontalAlign}>
            <SingleImageUpload
                imagePreviewProps={{ style: imgStyle, srcSet: "auto" }}
                onChange={onChange}
                value={image.file}
            />
        </AlignImage>
    );
};

export default React.memo(ImageContainer);
