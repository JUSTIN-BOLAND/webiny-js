import {
    contentSelector,
    isPluginActiveSelector,
    layoutSelector
} from "@webiny/app-page-builder/editor/recoil/modules";
import React from "react";
import styled from "@emotion/styled";
import { css } from "emotion";
import { plugins } from "@webiny/plugins";
import { usePageBuilder } from "@webiny/app-page-builder/hooks/usePageBuilder";
import Element from "@webiny/app-page-builder/editor/components/Element";
import { Elevation } from "@webiny/ui/Elevation";
import { PbElement, PbPageLayout, PbPageLayoutPlugin } from "@webiny/app-page-builder/types";
import { PbEditorContentPlugin } from "@webiny/app-page-builder/types";
import { useRecoilValue } from "recoil";

const BREADCRUMB_HEIGHT = 33;
const ContentContainer = styled("div")(({ theme }) => ({
    backgroundColor: (theme as any)?.colors?.background,
    position: "relative",
    ".webiny-pb-page-document": {
        overflowY: "visible", // cuts off the block selector tooltip
        overflowX: "visible",
        // We need this extra spacing so that editor content won't get cutoff
        marginBottom: BREADCRUMB_HEIGHT
    }
}));
const contentContainerWrapper = css({
    margin: "95px 65px 50px 85px",
    padding: 0,
    position: "absolute",
    width: "calc(100vw - 115px - 300px)",
    //overflow: "hidden", // cuts off the block selector tooltip
    top: 0,
    boxSizing: "border-box",
    zIndex: 1
});
const BaseContainer = styled("div")({
    width: "100%",
    left: 52,
    margin: "0 auto"
});
const renderContent = (layout: PbPageLayout, rootElement: PbElement, render: boolean) => {
    const content = <Element id={rootElement.id} />;
    if (!render) {
        return content;
    }
    return React.createElement(layout.component, null, content);
};

const Content = () => {
    const rootElement = useRecoilValue(contentSelector);
    const renderLayout = useRecoilValue(isPluginActiveSelector("pb-editor-toolbar-preview"));
    const layout = useRecoilValue(layoutSelector);

    const { theme } = usePageBuilder();
    const pluginsByType = plugins.byType<PbEditorContentPlugin>("pb-editor-content");
    const layouts = React.useMemo(() => {
        const layoutPlugins = plugins.byType<PbPageLayoutPlugin>("pb-page-layout");
        return layoutPlugins.map(pl => pl.layout);
    }, []);
    const themeLayout = layouts.find(l => l.name === layout);
    if (renderLayout && !themeLayout) {
        return <div>Layout &quot;{layout}&quot; was not found in your theme!</div>;
    }
    return (
        <Elevation className={contentContainerWrapper} z={2}>
            <ContentContainer theme={theme}>
                {pluginsByType.map(plugin =>
                    React.cloneElement(plugin.render(), { key: plugin.name })
                )}
                <BaseContainer className={"webiny-pb-editor-content-preview"}>
                    {renderContent(themeLayout, rootElement, renderLayout)}
                </BaseContainer>
            </ContentContainer>
        </Elevation>
    );
};

export default Content;
