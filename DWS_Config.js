/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way 
Divisible Rooms leveraging Cisco IP Microphones.

Macro Author:  
Mark Lula
Technical Solutions Architect
Cisco Systems

Contributing Engineers:
Svein Terje Steffensen
William Mills
Robert(Bobby) McGonigle Jr

Version: 0.1
Released: 1/15/2024

Complete details for this macro are available on Github:
https://marklula.github.com/Divisible-Workspaces

//=========================================================================*/

// ENABLE OR DISABLE ADDITIONAL "DEBUG" LEVEL CONSOLE OUTPUT
// ACCEPTED VALUES: 'true', 'false'

const DEBUG = 'true'; 

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================//

// SET THE USERNAME AND PASSWORD OF THE ACCOUNT TO BE USED FOR CODEC COMMUNICATION & SWITCH CONFIGURATION
const USERNAME = 'dwsadmin';
const PASSWORD = 'dwsadmin';

// SET THE SWITCH TYPE (OPTIONS ARE C1K-8P, C1K-16P, C9K-8P, C9K-12P)
const SWITCH_TYPE = 'C1K-16P';

// SET THE IP ADDRESS OR FQDN OF THE SECONDARY CODEC
const SECONDARY_HOST = '192.168.70.7'; // THIS CAN BE IP ADDRESS OR FQDN

// SET THE MAC ADDRESS OF THE SECONDARY CODEC CONTROLLER NAVIGATOR 
const SECONDARY_NAV_CONTROL = 'f4:ee:31:82:e4:5d';

// SET THE MAC ADDRESS OF THE SECONDARY CODEC SCHEDULER NAVIGATOR. LEAVE BLANK IF NO SCHEDULER PANEL IS USED.
const SECONDARY_NAV_SCHEDULER = 'e8:0a:b9:e3:88:4c';

// SET THE NUMBER OF DISPLAYS IN THE SECONDARY ROOM ( OPTIONS: 1 OR 2 )
const SECONDARY_SCREENS = '2';

// SET THE SERIAL OF THE MICROPHONES POSITIONED IN THE PRIMARY AND SECONDARY ROOMS ( FORMAT: ['FOCXXXXXXX','FOCXXXXXXX','FOCXXXXXXX'] )
const PRIMARY_MICS = ['FOC2833JEVZ']; // FOC2848H6XU 78:85:17:57:67:06
const SECONDARY_MICS = ['FOC2833JESU']; // FOC2843J90T c8:60:8f:99:93:be

// CONFIGURE YOUR DEFAULT FOR AUTOMATIC SWITCHING BASED ON MICROPHONE ACTIVITY
const AUTOMODE_DEFAULT = 'on';

//SWITCH VARIABLES
const PRIMARY_VLAN = '100';
const SECONDARY_VLAN = '200';
//const UPLINK_PORT_PRIMARY = '1/1/1';
//const UPLINK_PORT_SECONDARY = '1/1/2';
//const PORT_RANGE_PRIMARY = '1/0/1 - 6';
//const PORT_RANGE_SECONDARY = '1/0/7 - 12';

const UPLINK_PORT_PRIMARY = '8';
const UPLINK_PORT_SECONDARY = '16';
const PORT_RANGE_PRIMARY = '1 - 7';
const PORT_RANGE_SECONDARY = '9 - 15';

export default { 
  DEBUG,
  USERNAME, 
  PASSWORD, 
  SWITCH_TYPE,
  SECONDARY_HOST, 
  SECONDARY_NAV_CONTROL, 
  SECONDARY_NAV_SCHEDULER, 
  SECONDARY_SCREENS, 
  PRIMARY_MICS, 
  SECONDARY_MICS, 
  AUTOMODE_DEFAULT,
  PRIMARY_VLAN, 
  SECONDARY_VLAN, 
  UPLINK_PORT_PRIMARY, 
  UPLINK_PORT_SECONDARY,
  PORT_RANGE_PRIMARY,
  PORT_RANGE_SECONDARY,
  };