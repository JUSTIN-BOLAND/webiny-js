import React, { useCallback, useMemo } from "react";
import { css } from "emotion";
import { useRecoilValue } from "recoil";
import { plugins } from "@webiny/plugins";
import { PbEditorPageElementSettingsRenderComponentProps, PbThemePlugin } from "../../../../types";
import { activeElementWithChildrenSelector } from "../../../recoil/modules";
// Components
import Accordion from "../../elementSettings/components/Accordion";
import Wrapper from "../../elementSettings/components/Wrapper";
import SelectField from "../../elementSettings/components/SelectField";
import { BaseColorPicker } from "../../elementSettings/components/ColorPicker";
import useUpdateHandlers from "../../elementSettings/useUpdateHandlers";
import TextAlignment from "./TextAlignment";

const classes = {
    grid: css({
        "&.mdc-layout-grid": {
            padding: 0,
            marginBottom: 24
        }
    }),
    widthInputStyle: css({
        maxWidth: 60
    }),
    rightCellStyle: css({
        justifySelf: "end"
    }),
    leftCellStyle: css({
        alignSelf: "center"
    })
};

const TextSettings: React.FunctionComponent<PbEditorPageElementSettingsRenderComponentProps & {
    options: any;
}> = ({ defaultAccordionValue, options }) => {
    const element = useRecoilValue(activeElementWithChildrenSelector);
    const [{ theme }] = plugins.byType<PbThemePlugin>("pb-theme");

    const {
        data: {
            text = {
                color: "",
                typography: "paragraph",
                type: "paragraph",
                alignment: "left",
                tag: "h1"
            }
        } = {}
    } = element;

    const themeTypographyOptions = useMemo(() => {
        const { types } = theme.elements[element.type];
        return types.map(el => (
            <option value={el.className} key={el.label}>
                {el.label}
            </option>
        ));
    }, [theme]);

    const { getUpdateValue, getUpdatePreview } = useUpdateHandlers({
        element,
        dataNamespace: "data.text"
    });

    const updateColor = useCallback((value: string) => getUpdateValue("color")(value), [
        getUpdateValue
    ]);
    const updateColorPreview = useCallback((value: string) => getUpdatePreview("color")(value), [
        getUpdatePreview
    ]);

    const updateTypography = useCallback((value: string) => getUpdateValue("typography")(value), [
        getUpdateValue
    ]);

    const updateAlignment = useCallback((value: string) => getUpdateValue("alignment")(value), [
        getUpdateValue
    ]);

    const updateTag = useCallback((value: string) => getUpdateValue("tag")(value), [
        getUpdateValue
    ]);

    return (
        <Accordion title={"Text"} defaultValue={defaultAccordionValue}>
            <>
                <Wrapper containerClassName={classes.grid} label={"Color"}>
                    <BaseColorPicker
                        value={text.color}
                        updateValue={updateColor}
                        updatePreview={updateColorPreview}
                    />
                </Wrapper>
                {options.useCustomTag && (
                    <Wrapper
                        containerClassName={classes.grid}
                        label={"Heading Type"}
                        leftCellSpan={5}
                        rightCellSpan={7}
                    >
                        <SelectField value={text.tag} onChange={updateTag}>
                            {options.tags.map(tag => (
                                <option value={tag} key={tag}>
                                    {tag.toUpperCase()}
                                </option>
                            ))}
                        </SelectField>
                    </Wrapper>
                )}
                <Wrapper
                    containerClassName={classes.grid}
                    label={"Typography"}
                    leftCellSpan={5}
                    rightCellSpan={7}
                >
                    <SelectField value={text.typography} onChange={updateTypography}>
                        {themeTypographyOptions}
                    </SelectField>
                </Wrapper>
                <Wrapper
                    containerClassName={classes.grid}
                    label={"Alignment"}
                    leftCellSpan={3}
                    rightCellSpan={9}
                    leftCellClassName={classes.leftCellStyle}
                    rightCellClassName={classes.rightCellStyle}
                >
                    <TextAlignment value={text.alignment} onChange={updateAlignment} />
                </Wrapper>
            </>
        </Accordion>
    );
};

export default React.memo(TextSettings);
