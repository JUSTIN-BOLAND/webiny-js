import React from "react";
import { Grid, Cell } from "@webiny/ui/Grid";
import { Select } from "@webiny/ui/Select";
import { i18n } from "@webiny/app/i18n";
import { Elevation } from "@webiny/ui/Elevation";
import { Typography } from "@webiny/ui/Typography";

const t = i18n.ns("app-page-builder/admin/plugins/permission-renderer");

const CustomSection = ({ Bind, data, entity, title, children = null }) => {
    const rwdSelectEnabled = ["full", "own"].includes(data[`${entity}AccessScope`]);

    return (
        <Elevation z={1} style={{ marginTop: 10 }}>
            <Grid>
                <Cell span={12}>
                    <Typography use={"overline"}>{title}</Typography>
                </Cell>
                <Cell span={12}>
                    <Grid style={{ padding: 0, paddingBottom: 24 }}>
                        <Cell span={12}>
                            <Bind name={`${entity}AccessScope`}>
                                <Select
                                    label={t`Access Scope`}
                                    description={t`The scope of the content that can be accessed.`}
                                >
                                    <option value={"no"}>{t`None`}</option>
                                    <option value={"full"}>{t`All content`}</option>
                                    <option
                                        value={"own"}
                                    >{t`Only content created by the user`}</option>
                                </Select>
                            </Bind>
                        </Cell>
                        <Cell span={12}>
                            <Bind name={`${entity}Rwd`}>
                                <Select
                                    disabled={!rwdSelectEnabled}
                                    label={t`Primary actions`}
                                    description={t`Primary actions that can be performed on the content.`}
                                >
                                    <option value={"r"}>{t`Read`}</option>
                                    <option value={"rw"}>{t`Read, write`}</option>
                                    <option value={"rwd"}>{t`Read, write, delete`}</option>
                                </Select>
                            </Bind>
                        </Cell>
                        {children}
                    </Grid>
                </Cell>
            </Grid>
        </Elevation>
    );
};

export default CustomSection;
