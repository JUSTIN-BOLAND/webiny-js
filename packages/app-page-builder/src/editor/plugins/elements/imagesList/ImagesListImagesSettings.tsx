import * as React from "react";
import { css } from "emotion";
import { sortable } from "react-sortable";
import { FileManager } from "@webiny/app-admin/components";
import { Grid, Cell } from "@webiny/ui/Grid";
import File from "./File";
import Accordion from "../../elementSettings/components/Accordion";
import {
    classes,
    SimpleButton,
    ButtonContainer
} from "../../elementSettings/components/StyledComponents";

const style = {
    addImagesButton: css({ clear: "both", padding: "20px 10px", textAlign: "center" }),
    liItem: {
        display: "inline-block"
    }
};

class Item extends React.Component {
    render() {
        return (
            <li style={style.liItem} {...this.props}>
                {this.props.children}
            </li>
        );
    }
}

const SortableItem = sortable(Item);

const ImagesListImagesSettings = props => {
    const { Bind, form } = props;
    return (
        <Accordion title={"Images"} defaultValue={true}>
            <Grid className={classes.simpleGrid}>
                <Cell span={12}>
                    <Bind name={"images"}>
                        {({ onChange, value }) => (
                            <FileManager
                                images
                                multiple
                                onChange={files => {
                                    Array.isArray(value)
                                        ? onChange([...value, ...files])
                                        : onChange([...files]);
                                }}
                            >
                                {({ showFileManager }) => (
                                    <>
                                        <ul className="sortable-list">
                                            {Array.isArray(value) &&
                                                value.map((item, i) => (
                                                    <SortableItem
                                                        key={i}
                                                        onSortItems={onChange}
                                                        items={value}
                                                        sortId={i}
                                                    >
                                                        <File
                                                            file={item}
                                                            onRemove={() =>
                                                                form.setState(state => {
                                                                    const next = {
                                                                        ...state
                                                                    };
                                                                    next.data.images.splice(i, 1);
                                                                    return next;
                                                                })
                                                            }
                                                        />
                                                    </SortableItem>
                                                ))}
                                        </ul>
                                        <ButtonContainer>
                                            <SimpleButton onClick={showFileManager}>
                                                Add images...
                                            </SimpleButton>
                                        </ButtonContainer>
                                    </>
                                )}
                            </FileManager>
                        )}
                    </Bind>
                </Cell>
            </Grid>
        </Accordion>
    );
};

export default ImagesListImagesSettings;
