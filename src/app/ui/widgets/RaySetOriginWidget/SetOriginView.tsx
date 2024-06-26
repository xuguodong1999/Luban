import { WorkflowStatus } from '@snapmaker/luban-platform';
import { Alert, Radio, RadioChangeEvent, Space } from 'antd';
import { includes } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import controller from '../../../communication/socket-communication';
import SocketEvent from '../../../communication/socket-events';
import { JobOffsetMode } from '../../../constants/coordinate';
import { RootState } from '../../../flux/index.def';
import { actions as workspaceActions } from '../../../flux/workspace';
import gcodeActions from '../../../flux/workspace/actions-gcode';
import { AxisWorkRange, GCodeFileMetadata } from '../../../flux/workspace/types';
import { Button } from '../../components/Buttons';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';
import ControlPanel from '../ConnectionControl/Control';
import RunBoundaryModal from './modals/RunBoundaryModal';
import HomeTipModal from './modals/HomeTipModal';
import { MotorPowerMode, SetupCoordinateMethod } from '../../../constants';

export const getRunBoundaryCode = (
    axisWorkRange: AxisWorkRange,
    jobOffsetMode: JobOffsetMode,
    isRotate: boolean = false,
    setupCoordinateMethod: SetupCoordinateMethod
) => {
    const useBInsteadOfX = isRotate;
    const gCommand = jobOffsetMode === JobOffsetMode.Crosshair ? 'G1 S0' : 'G1 S10';

    const goto = (x: number, y: number): string => {
        let code = gCommand;

        if (useBInsteadOfX) {
            code += ` B${x || 0}`;
        } else {
            code += ` X${x || 0}`;
        }

        code += ` Y${y}`;
        code += ' F6000';

        return code;
    };

    const gcodeList = [];

    if (setupCoordinateMethod === SetupCoordinateMethod.ByControlPanel) {
        gcodeList.push(
            ';motor_mode: 3',
        );
    }

    if (jobOffsetMode === JobOffsetMode.Crosshair) {
        // Use crosshair to run boundary
        gcodeList.push('M2000 L13 P1'); // turn on crosshair
    } else if (jobOffsetMode === JobOffsetMode.LaserSpot) {
        // Use laser spot to run boundary
        gcodeList.push('M3 S0');
        gcodeList.push(`${gCommand} F6000`); // turn on laser spot
    }

    gcodeList.push(
        'G90', // absolute position
    );

    // set current position as origin
    if (setupCoordinateMethod !== SetupCoordinateMethod.ByControlPanel) {
        gcodeList.push(
            'G92 X0 Y0 B0',
        );
    }

    if (useBInsteadOfX) {
        gcodeList.push(
            // run bounding box
            goto(axisWorkRange.min.b, axisWorkRange.min.y),
            goto(axisWorkRange.max.b, axisWorkRange.min.y),
            goto(axisWorkRange.max.b, axisWorkRange.max.y),
            goto(axisWorkRange.min.b, axisWorkRange.max.y),
            goto(axisWorkRange.min.b, axisWorkRange.min.y),
        );
    } else {
        gcodeList.push(
            // run bounding box
            goto(axisWorkRange.min.x, axisWorkRange.min.y),
            goto(axisWorkRange.max.x, axisWorkRange.min.y),
            goto(axisWorkRange.max.x, axisWorkRange.max.y),
            goto(axisWorkRange.min.x, axisWorkRange.max.y),
            goto(axisWorkRange.min.x, axisWorkRange.min.y),
        );
    }


    if (setupCoordinateMethod === SetupCoordinateMethod.ByControlPanel) {
        // go back to origin
        if (useBInsteadOfX) {
            gcodeList.push(
                goto(
                    axisWorkRange.min.b + (axisWorkRange.max.b - axisWorkRange.min.b) / 2,
                    axisWorkRange.min.y + (axisWorkRange.max.y - axisWorkRange.min.y) / 2
                )
            );
        } else {
            gcodeList.push(
                goto(
                    axisWorkRange.min.x + (axisWorkRange.max.x - axisWorkRange.min.x) / 2,
                    axisWorkRange.min.y + (axisWorkRange.max.y - axisWorkRange.min.y) / 2
                )
            );
        }
    } else {
        gcodeList.push(
            goto(0, 0)
        );
    }

    if (jobOffsetMode === JobOffsetMode.LaserSpot) {
        gcodeList.push('M5 S0'); // turn off laser spot
    }

    gcodeList.push(
        ';End', // empty line
    );

    const gcode = gcodeList.join('\n');

    return gcode;
};


/**
 * Set Origin View for Ray.
 *
 * With this view, you can calibrate the coordinate system for the job to be done.
 *
 * 1) Set origin
 * 2) Run boundary of the job, to check if the target work area is wanted
 *
 * Note that the work process is designed for the Ray machine (GRBL), it's not a
 * general purpose work process.
 */
interface SetOriginViewProps {
    setDisplay: (display: boolean) => void;
}

const SetOriginView: React.FC<SetOriginViewProps> = (props) => {
    const dispatch = useDispatch();
    const { setDisplay } = props;

    const { isConnected, isRotate, isHomed, setupCoordinateMethod, isRayNewVersion } = useSelector((state: RootState) => state.workspace);

    // G-code
    const gcodeFile: GCodeFileMetadata = useSelector((state: RootState) => state.workspace.gcodeFile);
    const workflowStatus = useSelector((state: RootState) => state.workspace.workflowStatus, shallowEqual);

    // display of widget
    // Only when machine is IDLE
    useEffect(() => {
        if (isConnected && includes([WorkflowStatus.Unknown, WorkflowStatus.Idle], workflowStatus)) {
            setDisplay(true);
        } else {
            // TODO: job is done, but workflow is IDLE => not display
            setDisplay(false);
        }
    }, [setDisplay, isConnected, workflowStatus]);


    // Home Tip Modal state
    const [showHomeTip, setShowHomeTip] = useState(false);

    // setup coordinate method
    const setSetupCoordinateMethod = (value: SetupCoordinateMethod) => {
        dispatch(workspaceActions.updateState({ setupCoordinateMethod: value }));
    };

    // Motor hold Mode
    const turnOnHoldMotorPower = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.STAYPOWER })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    resolve(result);
                });
        });
    };
    const turnOffHoldMotorPower = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.SHUTAll })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    resolve(result);
                });
        });
    };
    const getMotorPowerHoldMode = async () => {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.SetMotorPowerMode, { setMotorPowerHoldMod: MotorPowerMode.GETCURRENTMODE })
                .once(SocketEvent.SetMotorPowerMode, (result) => {
                    resolve(result.result);
                });
        });
    };
    const onChangeCoordinateMode = (e: any | RadioChangeEvent) => {
        if (!isConnected) {
            return;
        }
        if (e.target.value === SetupCoordinateMethod.ByControlPanel) {
            if (!isHomed) {
                setShowHomeTip(true);
                return;
            }
            setShowHomeTip(false);
            setSetupCoordinateMethod(SetupCoordinateMethod.ByControlPanel);
        } else {
            turnOffHoldMotorPower();
            setSetupCoordinateMethod(e.target.value);
        }
    };

    useEffect(() => {
        if (isConnected && !isRotate) {
            getMotorPowerHoldMode().then((result) => {
                const mode = result !== MotorPowerMode.STAYPOWER ? SetupCoordinateMethod.Manually : SetupCoordinateMethod.ByControlPanel;
                onChangeCoordinateMode({ target: { value: mode } });
            });
        }
    }, [isHomed, isConnected, isRotate]);
    useEffect(() => {
        if (isRotate) {
            turnOffHoldMotorPower();
        }
    }, [isRotate]);

    // run boundary state
    const [runBoundaryUploading, setRunBoundaryUploading] = useState(false);
    const [runBoundaryReady, setRunBoundaryReady] = useState(false);
    const jobOffsetMode: JobOffsetMode = useSelector((state: RootState) => state.laser.jobOffsetMode);

    /**
     * Run boundary
     *
     * - useCurrentPosition: Use current position as origin
     */
    const runBoundary = useCallback(async () => {
        setRunBoundaryReady(false);
        if (!gcodeFile) {
            log.warn('No bounding box provided, please upload G-code first. ');
            return;
        }
        const gcodeIsRotate = gcodeFile?.is_rotate;
        const workRange = gcodeFile.gcodeAxisWorkRange;

        log.info('Run Boundary... axis work range =', workRange);

        const gcode = getRunBoundaryCode(workRange, jobOffsetMode, gcodeIsRotate, setupCoordinateMethod);

        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], 'boundary.nc');

        const gcodeFileObject: GCodeFileMetadata = await dispatch(gcodeActions.uploadGcodeFile(file));

        setRunBoundaryUploading(true);
        controller
            .emitEvent(SocketEvent.CompressUploadFile, {
                filePath: gcodeFileObject.uploadName,
                targetFilename: 'boundary.nc',
            })
            .once(SocketEvent.CompressUploadFile, ({ err, text }) => {
                setRunBoundaryUploading(false);

                if (err) {
                    log.error('Unable to upload G-code to execute.');
                    log.error(err);
                    log.error(`Reason: ${text}`);
                    return;
                }

                log.info('Uploaded boundary G-code.');
                setRunBoundaryReady(true);
            });
    }, [dispatch, isRotate, gcodeFile, jobOffsetMode, setupCoordinateMethod]);

    const onClickGoHome = useCallback(async () => {
        return dispatch(workspaceActions.executeGcode('$H')) as unknown as Promise<void>;
    }, [dispatch]);

    const setControlPanelCoordinateMethod = () => {
        turnOnHoldMotorPower();
        onClickGoHome();
        setSetupCoordinateMethod(SetupCoordinateMethod.ByControlPanel);
    };

    return (
        <div>
            <div className="display-block margin-top-8">
                <Radio.Group onChange={onChangeCoordinateMode} value={setupCoordinateMethod}>
                    <Space direction="vertical">
                        <Radio value={SetupCoordinateMethod.Manually}>
                            <span className="display-block font-weight-bold">{i18n._('Manual Mode')}</span>
                            <span className="display-block color-black-3">{i18n._('You need to manually move the toolhead to the desired XY work origin.')}</span>
                        </Radio>
                        {/* Hide by control panel method */
                            isRayNewVersion && !isRotate && (
                                <Radio value={SetupCoordinateMethod.ByControlPanel}>
                                    <span className="display-block font-weight-bold">{i18n._('Control Mode')}</span>
                                    <span className="display-block color-black-3">{i18n._('You need to use the Control panel to move the toolhead to the desired XY work origin.')}</span>
                                </Radio>
                            )
                        }

                        {/* tip for those who have not update firmware yet */}
                        {
                            !isRayNewVersion && (
                                <Alert type="warning" showIcon message={i18n._('To access the control mode feature, please consider updating your firmware to version V1.6.8 or higher.')} />
                            )
                        }
                    </Space>
                </Radio.Group>
            </div>
            {
                setupCoordinateMethod === SetupCoordinateMethod.Manually && (
                    <div className="margin-top-8">
                        <div className="width-percent-100">
                            <Button
                                type="default"
                                style={{ width: '100%', borderRadius: '4px' }}
                                onClick={onClickGoHome}
                            >
                                {i18n._('key-Workspace/Connection-Go Home')}
                            </Button>
                            <Button
                                type="primary"
                                style={{ width: '100%', borderRadius: '4px' }}
                                className="margin-top-8"
                                disabled={!gcodeFile?.gcodeAxisWorkRange}
                                loading={runBoundaryUploading}
                                onClick={async () => runBoundary()}
                            >
                                {!runBoundaryUploading && i18n._('Run Boundary')}
                            </Button>
                        </div>
                        {
                            isRayNewVersion && (
                                <Space direction="vertical" className="margin-top-8">
                                    <Alert type="info" showIcon message={i18n._('Steppers are disabled. You can push XY axes to move the tool head.')} />
                                </Space>
                            )
                        }
                    </div>
                )
            }

            {
                !isRotate && setupCoordinateMethod === SetupCoordinateMethod.ByControlPanel && isRayNewVersion && (
                    <div className="margin-top-16">
                        <ControlPanel widgetId="control" isNotInWorkspace={false} runBoundary={runBoundary} canABPosition={isRayNewVersion} />
                    </div>
                )
            }

            {/* Run Boundary modal */
                runBoundaryReady && (
                    <RunBoundaryModal onClose={() => setRunBoundaryReady(false)} />
                )
            }

            {/* Go Home tip */
                showHomeTip && (
                    <HomeTipModal
                        onClose={() => {
                            onChangeCoordinateMode({ target: { value: SetupCoordinateMethod.Manually } });
                            setShowHomeTip(false);
                        }}
                        onOk={() => {
                            setControlPanelCoordinateMethod();
                            setShowHomeTip(false);
                        }}
                    />
                )
            }
        </div>
    );
};

export default SetOriginView;
