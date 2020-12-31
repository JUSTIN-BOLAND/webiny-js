import React, { useEffect, useState } from "react";
import { css } from "emotion";
import { IconButton } from "@webiny/ui/Button";
import { Typography } from "@webiny/ui/Typography";
import { Grid, Cell } from "@webiny/ui/Grid";
import { FormElementMessage } from "@webiny/ui/FormElementMessage";
// Icons
import { ReactComponent as AddIcon } from "../../../assets/icons/add.svg";
import { ReactComponent as RemoveIcon } from "../../../assets/icons/remove.svg";
import { COLORS } from "../components/StyledComponents";

const classes = {
    grid: css({
        position: "relative",
        "&.mdc-layout-grid": {
            padding: 0,
            marginBottom: 8
        }
    }),
    icon: css({
        "& .mdc-list-item__graphic > svg": {
            transform: "rotate(90deg)"
        }
    }),
    button: css({
        "&.mdc-icon-button": {
            backgroundColor: "var(--mdc-theme-background)",
            borderRadius: "50%",
            border: `1px solid ${COLORS.gray}`
        },
        "&.mdc-icon-button:disabled": {
            cursor: "not-allowed",
            pointerEvents: "all",
            opacity: 0.5
        }
    }),
    errorMessageContainer: css({
        position: "absolute",
        bottom: -20,
        right: 0
    })
};

type CellSizePropsType = {
    value: number;
    maxAllowed: number;
    label: string;
    onChange: (value: number) => void;
};
const CellSize: React.FunctionComponent<CellSizePropsType> = ({
    value,
    label,
    onChange,
    maxAllowed
}) => {
    const [errorMessage, setErrorMessage] = useState("");
    // Hide error message after 2s.
    useEffect(() => {
        if (errorMessage.length) {
            setTimeout(() => setErrorMessage(""), 2000);
        }
    }, [errorMessage]);

    const onReduceHandler = () => {
        const newValue = value - 1;
        if (newValue <= 0) {
            setErrorMessage("Cell can't get smaller than this.");
            return false;
        }
        onChange(newValue);
    };

    const onAddHandler = () => {
        if (maxAllowed <= 0) {
            setErrorMessage("Cell can't get bigger than this.");
            return false;
        }
        onChange(value + 1);
    };

    return (
        <Grid className={classes.grid}>
            <Cell align={"middle"} span={5}>
                <Typography use={"subtitle2"}>{label}</Typography>
            </Cell>
            <Cell align={"middle"} span={3}>
                <IconButton
                    className={classes.button}
                    icon={<RemoveIcon />}
                    onClick={onReduceHandler}
                />
            </Cell>
            <Cell align={"middle"} span={1}>
                <Typography use={"subtitle2"}>{value}</Typography>
            </Cell>
            <Cell align={"middle"} span={3}>
                <IconButton className={classes.button} icon={<AddIcon />} onClick={onAddHandler} />
            </Cell>
            <FormElementMessage error={true} className={classes.errorMessageContainer}>
                {errorMessage}
            </FormElementMessage>
        </Grid>
    );
};

export default React.memo(CellSize);
