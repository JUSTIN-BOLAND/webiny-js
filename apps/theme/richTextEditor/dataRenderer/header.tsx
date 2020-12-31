import React from "react";
import { RTEDataBlockRendererPlugin } from "../../types";
import { BlockType } from "./index";

export default () =>
    ({
        type: "rte-data-block-renderer",
        name: "rte-data-block-renderer-header",
        blockType: BlockType.header,
        render(block) {
            const props = { style: {}, className: null };

            if (block.data.textAlign) {
                props.style["textAlign"] = block.data.textAlign;
            }
            if (block.data.className) {
                props.className = block.data.className;
            }

            switch (block.data.level) {
                case 1:
                    return <h1 {...props} dangerouslySetInnerHTML={{ __html: block.data.text }} />;

                case 2:
                    return <h2 {...props} dangerouslySetInnerHTML={{ __html: block.data.text }} />;

                case 3:
                    return <h3 {...props} dangerouslySetInnerHTML={{ __html: block.data.text }} />;

                case 4:
                    return <h4 {...props} dangerouslySetInnerHTML={{ __html: block.data.text }} />;

                case 5:
                    return <h5 {...props} dangerouslySetInnerHTML={{ __html: block.data.text }} />;

                case 6:
                    return <h6 {...props} dangerouslySetInnerHTML={{ __html: block.data.text }} />;
            }
        }
    } as RTEDataBlockRendererPlugin);
