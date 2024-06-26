import type { Machine, } from '@snapmaker/luban-platform';
import { MachineType } from '@snapmaker/luban-platform';

import {
    L20WLaserToolModule,
    L2WLaserToolModule,
    L40WLaserToolModule,
    dualExtrusionPrintToolHead,
    dualExtrusionPrintToolHeadForArtisan,
    highPower10WLaserToolHead,
    highPower200WCNCToolHead,
} from './snapmaker-2-toolheads';
import { JobOffsetMode } from '../constants/coordinate';


/*
    {
        value: 'A400',
        size: {
            x: 400,
            y: 400,
            z: 400
        },
        alias: ['SM2-XL', 'Snapmaker 2.0 400'],
    },
*/

export const machine: Machine = {
    identifier: 'A400',

    fullName: 'Snapmaker Artisan',
    machineType: MachineType.MultiFuncionPrinter,

    img: '/resources/images/machine/size-2.0-A400.jpeg',

    metadata: {
        size: { x: 400, y: 400, z: 400 },

        toolHeads: [
            {
                identifier: dualExtrusionPrintToolHead.identifier,
                configPath: 'printing/a400_dual',
                workRange: {
                    min: [0, 0, 0],
                    max: [400, 370, 400],
                },
            },
            {
                identifier: dualExtrusionPrintToolHeadForArtisan.identifier,
                configPath: 'printing/a400_dual',
            },
            {
                identifier: highPower10WLaserToolHead.identifier,
                configPath: 'laser/a400_10w',
                workRange: {
                    min: [0, 0, 0],
                    max: [410, 410, 420],
                },
                supportCameraCapture: true,
                runBoundaryModeOptions: [
                    {
                        label: 'Laser Spot',
                        value: JobOffsetMode.Crosshair,
                    }
                ]
            },
            {
                identifier: L20WLaserToolModule.identifier,
                configPath: 'laser/a400_20w',
                workRange: {
                    min: [0, 0, 0],
                    max: [410, 410, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
                runBoundaryModeOptions: [
                    {
                        label: 'Crosshair',
                        value: JobOffsetMode.Crosshair,
                    }
                ]
            },
            {
                identifier: L40WLaserToolModule.identifier,
                configPath: 'laser/a400_40w',
                workRange: {
                    min: [0, 0, 0],
                    max: [410, 410, 0], // Correct this later
                },
                disableRemoteStartPrint: true,
                runBoundaryModeOptions: [
                    {
                        label: 'Crosshair',
                        value: JobOffsetMode.Crosshair,
                    }
                ]
            },
            {
                identifier: L2WLaserToolModule.identifier,
                configPath: 'laser/a400_2w', // 'laser/a400_2w',
                // workRange: {
                //     min: [0, 0, 0],
                //     max: [410, 410, 0], // Correct this later
                // },
                // disableRemoteStartPrint: true,
                runBoundaryModeOptions: [
                    {
                        label: 'Crosshair',
                        value: JobOffsetMode.Crosshair,
                    }
                ]
            },
            {
                identifier: highPower200WCNCToolHead.identifier,
                configPath: 'cnc/200W',
            }
        ],

        slicerVersion: 0,
    },

    series: 'Snapmaker',
    seriesLabel: 'key-Luban/Machine/MachineSeries-Snapmaker Artisan',
    label: 'key-Luban/Machine/MachineSeries-Snapmaker Artisan',
};
