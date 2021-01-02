// @ts-nocheck
import React from "react";
import { css } from "emotion";
import styled from "@emotion/styled";
import classNames from "classnames";
import kebabCase from "lodash/kebabCase";
import { plugins } from "@webiny/plugins";
import { Typography } from "@webiny/ui/Typography";
import { Select } from "@webiny/ui/Select";
import { PbPageDetailsContextValue, PbRenderResponsiveModePlugin } from "../../../../types";
import RenderElement from "../../../../render/components/Element";
import { PageBuilderContext, PageBuilderContextValue } from "../../../../contexts/PageBuilder";
import Zoom from "./Zoom";

const pageInnerWrapper = css({
    overflowY: "scroll",
    overflowX: "hidden",
    height: "calc(100vh - 230px)",
    position: "relative",
    ".webiny-pb-page-document": {
        transform: "scale(var(--webiny-pb-page-preview-scale))",
        transition: "transform 0.5s ease-in-out",
        transformOrigin: "top center"
    }
});

const PagePreviewToolbar = styled("div")({
    position: "sticky",
    bottom: 0,
    height: 30,
    paddingLeft: 15,
    color: "var(--mdc-theme-text-secondary-on-background)",
    borderTop: "1px solid var(--mdc-theme-on-background)",
    backgroundColor: "var(--mdc-theme-background)",
    width: "100%",
    transform: "translateZ(0)",
    display: "flex",
    overflow: "hidden",
    ".webiny-ui-select": {
        color: "var(--mdc-theme-text-secondary-on-background)",
        backgroundColor: "transparent !important",
        width: "120px !important",
        ".mdc-select__dropdown-icon": {
            display: "none"
        },
        select: {
            fontSize: 14,
            border: "none",
            height: 30,
            padding: 0,
            backgroundColor: "transparent !important"
        }
    }
});

type PagePreviewProps = {
    page: PbPageDetailsContextValue;
};

const PagePreview = ({ page }: PagePreviewProps) => {
    const {
        responsiveDisplayMode: { displayMode, setDisplayMode }
    } = React.useContext<PageBuilderContextValue>(PageBuilderContext);
    const pagePreviewRef = React.useRef();
    const responsiveModeConfigs = React.useMemo(() => {
        return plugins
            .byType<PbRenderResponsiveModePlugin>("pb-render-responsive-mode")
            .map(pl => pl.config);
    }, []);

    const resizeObserver = React.useMemo(() => {
        return new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                handlerResize({ width, height });
            }
        });
    }, []);
    // Set resize observer
    React.useEffect(() => {
        if (pagePreviewRef.current) {
            // Add resize observer
            resizeObserver.observe(pagePreviewRef.current);
        }
        // Cleanup
        return () => {
            resizeObserver.disconnect();
        };
    }, []);
    // Handle document resize
    const handlerResize = React.useCallback(
        ({ width }) => {
            let mode = "desktop";
            responsiveModeConfigs.forEach(config => {
                if (width <= config.minWidth) {
                    mode = config.displayMode;
                }
            });

            setDisplayMode(mode);
        },
        [responsiveModeConfigs]
    );

    return (
        <Zoom>
            {({ zoom, setZoom }) => (
                <div
                    ref={pagePreviewRef}
                    className={classNames(
                        pageInnerWrapper,
                        ` webiny-pb-media-query--${kebabCase(displayMode)}`
                    )}
                    // @ts-ignore
                    style={{ "--webiny-pb-page-preview-scale": zoom }}
                >
                    <RenderElement key={page.id} element={page.content} />
                    <PagePreviewToolbar>
                        <span>
                            <Typography use={"overline"}>Zoom:&nbsp;</Typography>
                        </span>
                        <Select value={zoom.toString()} onChange={setZoom}>
                            <option value={"1"}>100%</option>
                            <option value={"0.75"}>75%</option>
                            <option value={"0.5"}>50%</option>
                        </Select>
                    </PagePreviewToolbar>
                </div>
            )}
        </Zoom>
    );
};

export default PagePreview;
