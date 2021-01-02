import React from "react";
import { css } from "emotion";
import { PbEditorResponsiveModePlugin, DisplayMode } from "../../../types";
// Icons
import { ReactComponent as DesktopIcon } from "./icons/laptop_mac.svg";
import { ReactComponent as TabletIcon } from "./icons/tablet_mac.svg";
import { ReactComponent as MobileIcon } from "./icons/phone_iphone.svg";
import { ReactComponent as StarIcon } from "./icons/star_rate.svg";

const rotateStyle = css({
    transform: "rotate(90deg)"
});

export default () => [
    {
        type: "pb-editor-responsive-mode",
        name: "pb-editor-responsive-mode-desktop",
        config: {
            displayMode: DisplayMode.DESKTOP,
            toolTip: {
                title: "Desktop",
                subTitle: "Base breakpoint",
                body: `Desktop styles apply at all breakpoints, unless they're
                       edited at a smaller breakpoint. Start your styling here.`,
                subTitleIcon: <StarIcon />
            },
            icon: <DesktopIcon />
        }
    } as PbEditorResponsiveModePlugin,
    {
        type: "pb-editor-responsive-mode",
        name: "pb-editor-responsive-mode-tablet",
        config: {
            displayMode: DisplayMode.TABLET,
            toolTip: {
                title: "Tablet",
                subTitle: "991px and down",
                body: `Styles added here will apply at 991px and down, unless they're
                       edited at a smaller breakpoint.`
            },
            icon: <TabletIcon />
        }
    } as PbEditorResponsiveModePlugin,
    {
        type: "pb-editor-responsive-mode",
        name: "pb-editor-responsive-mode-mobile-landscape",
        config: {
            displayMode: DisplayMode.MOBILE_LANDSCAPE,
            toolTip: {
                title: "Mobile landscape",
                subTitle: "767px and down",
                body: `Styles added here will apply at 767px and down, unless they're
                       edited at a smaller breakpoint.`
            },
            icon: <MobileIcon className={rotateStyle} />
        }
    } as PbEditorResponsiveModePlugin,
    {
        type: "pb-editor-responsive-mode",
        name: "pb-editor-responsive-mode-mobile-portrait",
        config: {
            displayMode: DisplayMode.MOBILE_PORTRAIT,
            toolTip: {
                title: "Mobile portrait",
                subTitle: "478px and down",
                body: `Styles added here will apply at 478px and down.`
            },
            icon: <MobileIcon />
        }
    } as PbEditorResponsiveModePlugin
];
