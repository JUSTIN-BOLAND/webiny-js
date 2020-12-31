import React from "react";
import Quote, { className } from "./Quote";
import { PbEditorPageElementPlugin } from "@webiny/app-page-builder/types";
import { createInitialTextValue } from "../utils/textUtils";

export default (): PbEditorPageElementPlugin => {
    return {
        name: "pb-editor-page-element-quote",
        type: "pb-editor-page-element",
        elementType: "quote",
        toolbar: {
            title: "Quote",
            group: "pb-editor-element-group-basic",
            preview() {
                return (
                    <div className={className}>
                        <blockquote>
                            <q>We Live In A Twilight World. There Are No Friends At Dusk.</q>
                        </blockquote>
                    </div>
                );
            }
        },
        settings: [
            "pb-editor-page-element-style-settings-text",
            "pb-editor-page-element-style-settings-background",
            "pb-editor-page-element-style-settings-border",
            "pb-editor-page-element-style-settings-shadow",
            "pb-editor-page-element-style-settings-padding",
            "pb-editor-page-element-style-settings-margin",
            "pb-editor-page-element-settings-clone",
            "pb-editor-page-element-settings-delete"
        ],
        target: ["cell", "block"],
        create({ content = {}, ...options }) {
            const previewText =
                content.text ||
                `<blockquote>We Live In A Twilight World. There Are No Friends At Dusk.</blockquote>`;

            return {
                type: "quote",
                elements: [],
                data: {
                    text: createInitialTextValue({ text: previewText, type: this.elementType }),
                    settings: {
                        margin: {
                            mobile: { top: "0px", left: "0px", right: "0px", bottom: "15px" },
                            desktop: { top: "0px", left: "0px", right: "0px", bottom: "0px" },
                            advanced: true
                        },
                        padding: {
                            desktop: { all: "0px" },
                            mobile: { all: "0px" }
                        }
                    }
                },
                ...options
            };
        },
        render({ element }) {
            return <Quote elementId={element.id} />;
        }
    };
};
