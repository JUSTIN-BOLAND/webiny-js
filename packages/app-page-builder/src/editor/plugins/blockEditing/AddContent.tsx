import React from "react";
import styled from "@emotion/styled";
import { useEventActionHandler } from "@webiny/app-page-builder/editor/provider";
import { TogglePluginActionEvent } from "@webiny/app-page-builder/editor/recoil/actions";
import { elementsInContentTotalSelector } from "@webiny/app-page-builder/editor/recoil/modules/page/selectors/elementsInContentTotalSelector";
import { keyframes } from "emotion";
import { Elevation } from "@webiny/ui/Elevation";
import { ButtonFloating } from "@webiny/ui/Button";
import { ReactComponent as AddIcon } from "@webiny/app-page-builder/editor/assets/icons/add.svg";
import { useRecoilValue } from "recoil";

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(0,204,176, 0.4);
  }
  70% {
      box-shadow: 0 0 0 30px rgba(0,204,176, 0);
  }
  100% {
      box-shadow: 0 0 0 0 rgba(0,204,176, 0);
  }
`;

const AddBlockContainer = styled("div")({
    position: "absolute",
    zIndex: 11,
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "150px",
    height: "100px",
    borderRadius: 2,
    color: "var(--mdc-theme-on-surface)",
    marginLeft: 54
});

const AddBlockContent = styled("div")({
    width: 300,
    margin: 5,
    textAlign: "center",
    display: "flex",
    alignItems: "center"
});

const AddContent = () => {
    const totalElements = useRecoilValue(elementsInContentTotalSelector);
    const eventActionHandler = useEventActionHandler();
    if (totalElements) {
        return null;
    }

    const onClickHandler = () => {
        eventActionHandler.trigger(
            new TogglePluginActionEvent({
                name: "pb-editor-search-blocks-bar"
            })
        );
    };
    return (
        <AddBlockContainer data-type={"container"}>
            <Elevation
                z={4}
                style={{
                    backgroundColor: "var(--mdc-theme-surface)",
                    padding: "30px 20px",
                    transform: "translateY(-50%)",
                    borderRadius: 2
                }}
            >
                <AddBlockContent>
                    Click the
                    <ButtonFloating
                        data-testid={"pb-content-add-block-button"}
                        style={{ animation: pulse + " 3s ease infinite", margin: "0 10px" }}
                        small
                        icon={<AddIcon />}
                        onClick={onClickHandler}
                    />
                    to start adding content
                </AddBlockContent>
            </Elevation>
        </AddBlockContainer>
    );
};

export default AddContent;
