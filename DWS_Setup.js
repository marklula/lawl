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

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

import xapi from 'xapi';
import DWS from './DWS_Config';

// SERIAL VARIABLES
const SERIALCOMMAND_TERMINATOR = '\x0D';
let SERIALPORT_CONFIGURATION_BAUDRATE = '9600';

// SET SERIAL PORT BAUD BY SWITCH TYPE
if (DWS.SWITCH_TYPE == 'C1K-8P' || DWS.SWITCH_TYPE == 'C1K-16P')
{ 
  SERIALPORT_CONFIGURATION_BAUDRATE = '115200';
}

const SERIALPORT_CONFIGURATION_PARITY = 'None';
const SERIALPORT_CONFIGURATION_DESCRIPTION = 'CatalystControl';

// SET USB SERIAL PORT SETTINGS
if (DWS.DEBUG == 'true') {console.debug ("DWS DEBUG: Setting USB Console Configuration.")}
xapi.Config.SerialPort.Outbound.Mode.set('On');
xapi.Config.SerialPort.Outbound.Port[1].BaudRate.set(SERIALPORT_CONFIGURATION_BAUDRATE);
xapi.Config.SerialPort.Outbound.Port[1].Parity.set(SERIALPORT_CONFIGURATION_PARITY);
xapi.Config.SerialPort.Outbound.Port[1].Description.set(SERIALPORT_CONFIGURATION_DESCRIPTION);

//==============================//
//  FIRST TIME SETUP FUNCTIONS  //
//==============================//
async function firstSetup()
{
  let command = '';

  console.log("DWS: Starting Automatic Setup Process.");

  // ENSURE ROOM TYPE IS STANDARD
  const roomType = await xapi.Status.Provisioning.RoomType.get();
  if (roomType != 'Standard')
  {
    console.error("DWS: Only Standard Room Type Supported. Setup Aborted.");
    return;
  }

  // CHECK FOR CONNECTED INPUTS IN CONFIGURED SPOTS
  console.log("DWS: Checking for Correct Inputs and Outputs."); 
  const input1 = await xapi.Status.Video.Input.Connector[1].Connected.get();
  const input2 = await xapi.Status.Video.Input.Connector[2].Connected.get();
  const input3 = await xapi.Status.Video.Input.Connector[5].Connected.get();

  if (input1 && input2 && input3)
  {
    console.log("DWS: Setting Inputs/Outputs Labels and Visibility."); 

    // SET NAMES AND VISIBILITY SETTINGS
    xapi.Config.Video.Input.Connector[1].Name.set('Audience Camera');
    xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set('On');
    xapi.Config.Video.Input.Connector[1].Visibility.set('Never');
    xapi.Config.Video.Input.Connector[2].Name.set('Secondary Audience Camera');
    xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off');
    xapi.Config.Video.Input.Connector[2].Visibility.set('Never');
    xapi.Config.Video.Input.Connector[5].Name.set('Primary Presenter PTZ');
    xapi.Config.Video.Input.Connector[5].CameraControl.Mode.set('On');
    xapi.Config.Video.Input.Connector[5].Visibility.set('Never');
  }
  else
  {
    console.error("DWS: Invalid Input Connection Status. Ensure Camera Inputs Match Documentation. Setup Aborted.");
    return;
  }

  // SET SECONDARY CODEC MONITOR ROLES TO MATCH CONFIGURATION
  if (DWS.SECONDARY_SCREENS == '1')
  {
    console.log("DWS: Setting Secondary Codec Monitor Roles and Input Settings.");

    command = '<Body><Configuration><Video>';
    command +=' <Output>';
    command += '<Connector item="1"><MonitorRole>First</MonitorRole></Connector>';
    command += '<Connector item="3"><MonitorRole>Third</MonitorRole></Connector>';
    command += '</Output>';
    command += '<Input>';
    command += '<Connector item="1"><Name>Audience Camera</Name><CameraControl><Mode>On</Mode></CameraControl><Visibility>Never</Visibility></Connector>';
    command += '<Connector item="3"><Name>First Feed from Primary Room</Name><CameraControl><Mode>Off</Mode></CameraControl><Visibility>Never</Visibility><PresentationSelection>Manual</PresentationSelection></Connector>';
    command += '<Connector item="5"><Name>Presenter PTZ</Name><CameraControl><Mode>On</Mode></CameraControl><Visibility>Never</Visibility></Connector>';
    command += '</Input>';
    command += '</Video></Configuration></Body>'; 

    sendCommand(DWS.SECONDARY_HOST, command);
    command = '';
  }
  else if (DWS.SECONDARY_SCREENS == '2')
  {
    console.log("DWS: Setting Secondary Codec Monitor Roles and Input Settings.");

    command = '<Body><Configuration><Video>';
    command +=' <Output>';
    command += '<Connector item="1"><MonitorRole>First</MonitorRole></Connector>';
    command += '<Connector item="3"><MonitorRole>Third</MonitorRole></Connector>';
    command += '</Output>';
    command += '<Input>';
    command += '<Connector item="1"><Name>Audience Camera</Name><CameraControl><Mode>On</Mode></CameraControl><Visibility>Never</Visibility></Connector>';
    command += '<Connector item="3"><Name>First Feed from Primary Room</Name><CameraControl><Mode>Off</Mode></CameraControl><Visibility>Never</Visibility><PresentationSelection>Manual</PresentationSelection></Connector>';    
    command += '<Connector item="4"><Name>Second Feed from Primary Room</Name><CameraControl><Mode>Off</Mode></CameraControl><Visibility>Never</Visibility><PresentationSelection>Manual</PresentationSelection></Connector>';
    command += '<Connector item="5"><Name>Presenter PTZ</Name><CameraControl><Mode>On</Mode></CameraControl><Visibility>Never</Visibility></Connector>';
    command += '</Input>';
    command += '</Video></Configuration></Body>';   

    sendCommand(DWS.SECONDARY_HOST, command);
    command = '';
  }
  else{
    console.error("DWS: Invalid Number of Secondary Displays in Configuration (Max of 2). Setup Aborted.");
    return;
  }

  // CONFIGURE THE ATTACHED SWITCH OVER SERIAL TO MATCH BEST PRACTICES
  if (DWS.SWITCH_TYPE == 'C1K-8P' || DWS.SWITCH_TYPE == 'C1K-16P')
  {
    await configureC1K();
  } 
  else if (DWS.SWITCH_TYPE == 'C9K-8P' || DWS.SWITCH_TYPE == 'C9K-12P')
  {
     await configureC9K();      
  }
  else
  {
    console.error("DWS: Switch Type Mismatch. Setup Failed.");
    return;
  }
  
  // SAVE STATE MACRO ON BOTH CODECS
  xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, 'split');
  sendCommand(DWS.SECONDARY_HOST, '<Command><Macros><Macro><Save><Name>DWS_State</Name><OverWrite>True</OverWrite><body>split</body></Save></Macro></Macros></Command>');

  // PUSH STATE MANAGEMENT MACRO TO SECONDARY
  // ????? NEEDED ?????

  // DELETE SETUP MACROS AND ENABLE CORE MACRO
  xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_wizard_start' });
  xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_wizard_confirm' });
  try { xapi.Command.Macros.Macro.Activate({ Name: 'DWS_Core' }); } catch(error) { console.error('DWS: Error Starting Core Macro: ' + error.message); }
  try { xapi.Command.Macros.Macro.Remove({ Name: "DWS_Wizard" }); } catch(error) { console.error('DWS: Error Deleting Wizard Macro: ' + error.message); }
  try { xapi.Command.Macros.Macro.Remove({ Name: "DWS_Setup" }); } catch(error) { console.log('DWS: Error Deleting Setup Macro: ' + error.message); }
  setTimeout(() => {
        xapi.Command.Macros.Runtime.Restart()
          .catch(error => console.log('DWS: Error restarting Macro Engine: ' + error.message));
      }, 300);
}

//====================================//
//  CONSOLE COMMAND SENDING FUNCTION  //
//====================================//
async function sendSerialCommand(command) {
  // SEND CONSOLE COMMANDS
  try {
    const r = await xapi.Command.SerialPort.PeripheralControl.Send({
      Text: command + SERIALCOMMAND_TERMINATOR
    });
  } catch (error) {
    console.error('DWS: Unable to send message to device: ' + error.message);
  }
}

//========================================//
//  CROSS CODEC COMMAND SENDING FUNCTION  //
//========================================//
function sendCommand(codec, command) 
{
  let Params = {};
  Params.Timeout = 5;
  Params.AllowInsecureHTTPS = 'True';
  Params.ResultBody = 'PlainText';
  Params.Url = `http://${codec}/putxml`;
  Params.Header = ['Authorization: Basic ' + btoa(`${DWS.USERNAME}:${DWS.PASSWORD}`), 'Content-Type: application/json']; // CONVERT TO BASE64 ENCODED

  // ENABLE THIS LINE TO SEE THE COMMANDS BEING SENT TO FAR END
  if (DWS.DEBUG == 'true') {console.debug('DWS DEBUG: Sending:', `${command}`)}

  xapi.Command.HttpClient.Post(Params, command)
  .then(() => {
    if (DWS.DEBUG == 'true') {console.debug(`DWS DEBUG: Command sent to ${codec} successfully`)}
  })
  .catch((error) => {
    console.error(`DWS: Error sending command:`, error);
  });
}

//==========================================//
//  C1K RECOMMENDED CONFIGURATION FUNCTION  //
//==========================================//
async function configureC1K() {
  console.log ("DWS: Beginning Catalyst 1K Configuration.");

  // SEND THREE EMPTY STRINGS TO VALIDATE READINESS THEN LOGIN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Completing Initial Switch Setup via Serial")};
  await sendSerialCommand('');
  await sendSerialCommand('');
  await sendSerialCommand('cisco'); // DEFAULT USERNAME 
  await sendSerialCommand('cisco'); // DEFAULT PASSWORD
  await sendSerialCommand('dwsadmin');  // STANDARD USER FOR ONBOARDING
  await sendSerialCommand('D!vi$ible1'); // PASSWORD FOR ONBOARDING
  await sendSerialCommand('D!vi$ible1'); // REPEAT PASSWORD FOR ONBOARDING

  // ENTER GLOBAL CONFIGURATION MODE
  await sendSerialCommand('configure terminal');

  // DISABLE LOGIN ON CONSOLE AND ENABLE
  if (DWS.DEBUG == 'true') {console.debug("DWS: Disabling Serial and Enable Authentication")};
  await sendSerialCommand('aaa authentication login default none');
  await sendSerialCommand('aaa authentication enable default none');

  // CREATE PRIMARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Creating Primary VLAN: " + DWS.PRIMARY_VLAN)};
  await sendSerialCommand('vlan ' + DWS.PRIMARY_VLAN);

  // CREATE SECONDARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Creating Secondary VLAN: " + DWS.SECONDARY_VLAN)};
  await sendSerialCommand('vlan ' + DWS.SECONDARY_VLAN);

  // ENABLE LLDP
  if (DWS.DEBUG == 'true') {console.debug("DWS: Enabling LLDP.")};
  await sendSerialCommand('lldp run');

  // TRUST DSCP MARKINGS ON ALL PORTS
  /*
  console.log ("DWS: Setting DSCP Markings.");
  await sendSerialCommand('interface range GigabitEthernet1 - ' + DWS.HIGHEST_PORT);
  await sendSerialCommand('mls qos trust dscp');
  await sendSerialCommand('exit');
  */

  // ADD BPDU FILTER ON PRIMARY LINK LOCAL EXTENSION PORT
  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting BPDU Filtering on Primary Uplink.")};
  await sendSerialCommand('interface GigabitEthernet' + DWS.UPLINK_PORT_PRIMARY);
  await sendSerialCommand('spanning-tree bpduguard enable');
  await sendSerialCommand('exit');

  // ADD BPDU FILTERING ON SECONDARY LINK LOCAL EXTENSION PORT
  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting BPDU Filtering on Secondary Uplink.")};
  await sendSerialCommand('interface GigabitEthernet' + DWS.UPLINK_PORT_SECONDARY);
  await sendSerialCommand('spanning-tree bpduguard enable');
  await sendSerialCommand('exit');

  // DISABLE ENERGY EFFICIENT ETHERNET GLOBALLY
  if (DWS.DEBUG == 'true') {console.debug("DWS: Disabling Energy Efficient Ethernet.")};
  await sendSerialCommand('no eee enable');

  // CONFIGURE ACCESS PORTS IN SECONDARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting Secondary VLAN on Accessory Ports: " + DWS.PORT_RANGE_SECONDARY)};
  await sendSerialCommand('interface range GigabitEthernet' + DWS.PORT_RANGE_SECONDARY);
  await sendSerialCommand('spanning-tree portfast');
  await sendSerialCommand('switchport mode access');
  await sendSerialCommand('switchport access vlan ' + DWS.SECONDARY_VLAN);
  await sendSerialCommand('exit');

  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting Secondary VLAN on Codec Port: " + DWS.UPLINK_PORT_SECONDARY)};
  await sendSerialCommand('interface GigabitEthernet' + DWS.UPLINK_PORT_SECONDARY);
  await sendSerialCommand('spanning-tree portfast');
  await sendSerialCommand('switchport mode access');
  await sendSerialCommand('switchport access vlan ' + DWS.SECONDARY_VLAN);
  await sendSerialCommand('exit');

  // CONFIGURE ACCESS PORTS IN PRIMARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting Primary VLAN on Ports: " + DWS.PORT_RANGE_PRIMARY)};
  await sendSerialCommand('interface range GigabitEthernet' + DWS.PORT_RANGE_PRIMARY);
  await sendSerialCommand('spanning-tree portfast');
  await sendSerialCommand('switchport mode access');
  await sendSerialCommand('switchport access vlan ' + DWS.PRIMARY_VLAN);
  await sendSerialCommand('exit');

  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting Primary VLAN on Codec Port: " + DWS.UPLINK_PORT_PRIMARY)};
  await sendSerialCommand('interface GigabitEthernet' + DWS.UPLINK_PORT_PRIMARY);
  await sendSerialCommand('spanning-tree portfast');
  await sendSerialCommand('switchport mode access');
  await sendSerialCommand('switchport access vlan ' + DWS.PRIMARY_VLAN);
  await sendSerialCommand('exit');

  // LEAVE CONFIGURATION MODE
  await sendSerialCommand('end');

  // SAVE CONFIGURATION TO STARTUP-CONFIG
  if (DWS.DEBUG == 'true') {console.debug("DWS: Saving Configuration to startup-config.")};
  await sendSerialCommand('write memory');
  await sendSerialCommand('Y');

  // EXIT THE CONSOLE SESSION
  setTimeout (() => { await sendSerialCommand('exit'), 300} );
  console.log ("DWS: Switch Configuration Completed.");
}

//==========================================//
//  C9K RECOMMENDED CONFIGURATION FUNCTION  //
//==========================================//
async function configureC9K() {
  console.log ("DWS: Beginning Catalyst 9K Configuration.");

  // SEND TWO EMPTY STRINGS TO VALIDATE READINESS
  await sendSerialCommand('');
  await sendSerialCommand('');

  if (DWS.DEBUG == 'true') {console.debug("DWS: Beginning Initial Switch Setup")}
  await sendSerialCommand('yes'); // ENTER INITIAL SETUP
  await sendSerialCommand('yes'); // ENTER BASIC SETUP
  await sendSerialCommand('');  // SET DEFAULT HOSTNAME AS "SWITCH"
  await sendSerialCommand(DWS.PASSWORD); // SET ENABLE SECRET
  await sendSerialCommand(DWS.PASSWORD); // CONFIRM ENABLE SECRET

  // ADD WAIT FOR 5 SECONDS????

  await sendSerialCommand(DWS.PASSWORD); // SET ENABLE PASSWORD
  await sendSerialCommand(DWS.PASSWORD); // SET VIRTUAL TERMINAL PASSWORD
  await sendSerialCommand('GigabitEthernet1/1/1'); // SET MANAGEMENT INTERFACE
  await sendSerialCommand(''); // SKIP CONFIGURATION CONFIRMATION
  await sendSerialCommand(''); // SKIP CONFIGURATION CONFIRMATION
  await sendSerialCommand('2'); // SAVE CONFIGURATION AND EXIT SETUP

  //WAIT 3 SECONDS

  // ENTER ENABLE MODE
  await sendSerialCommand('enable');
  await sendSerialCommand(DWS.PASSWORD);

  // ENTER GLOBAL CONFIGURATION MODE
  await sendSerialCommand('configure terminal');

  // CREATE PRIMARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Creating Primary VLAN: " + DWS.PRIMARY_VLAN)};
  await sendSerialCommand('vlan ' + DWS.PRIMARY_VLAN);
  await sendSerialCommand('exit');

  // CREATE SECONDARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Creating Secondary VLAN: " + DWS.SECONDARY_VLAN)};
  await sendSerialCommand('vlan ' + DWS.SECONDARY_VLAN);
  await sendSerialCommand('exit');

  // ENABLE LLDP
  await sendSerialCommand('lldp run');

  /* WAIT FOR CORY TO CONFIRM
  // TRUST DSCP MARKINGS ON ALL PORTS
  console.log ("DWS: Setting DSCP Markings.");
  await sendSerialCommand('interface range GigabitEthernet1/0/1 - ' + DWS.HIGHEST_PORT);
  await sendSerialCommand('mls qos trust dscp');
  await sendSerialCommand('exit');
  */

  // ADD BPDU FILTER ON PRIMARY LINK LOCAL EXTENSION PORT
  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting BPDU Filtering.")};
  await sendSerialCommand('interface GigabitEthernet' + DWS.UPLINK_PORT_PRIMARY);
  await sendSerialCommand('spanning-tree bpdufilter enable');
  await sendSerialCommand('exit');

  // ADD BPDU FILTERING ON SECONDARY LINK LOCAL EXTENSION PORT
  await sendSerialCommand('interface GigabitEthernet' + DWS.UPLINK_PORT_SECONDARY);
  await sendSerialCommand('spanning-tree bpdufilter enable');
  await sendSerialCommand('exit');

  /* CORY TO VALIDATE
  // DISABLE ENERGY EFFICIENT ETHERNET GLOBALLY
  console.log ("DWS: Disabling Energy Efficient Ethernet.");
  await sendSerialCommand('no eee enable');
  */

  // CONFIGURE ACCESS PORTS IN SECONDARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting Primary VLAN on Ports: " + DWS.PORT_RANGE_SECONDARY)};
  await sendSerialCommand('interface range GigabitEthernet' + DWS.PORT_RANGE_SECONDARY);
  await sendSerialCommand('spanning-tree portfast');
  await sendSerialCommand('switchport mode access');
  await sendSerialCommand('switchport access vlan ' + DWS.SECONDARY_VLAN);
  await sendSerialCommand('exit');

  // CONFIGURE ACCESS PORTS IN PRIMARY VLAN
  if (DWS.DEBUG == 'true') {console.debug("DWS: Setting Primary VLAN on Ports: " + DWS.PORT_RANGE_PRIMARY)};
  await sendSerialCommand('interface range GigabitEthernet' + DWS.PORT_RANGE_PRIMARY);
  await sendSerialCommand('spanning-tree portfast');
  await sendSerialCommand('switchport mode access');
  await sendSerialCommand('switchport access vlan ' + DWS.PRIMARY_VLAN);
  await sendSerialCommand('exit');

  // LEAVE CONFIGURATION MODE
  await sendSerialCommand('end');

  // SAVE CONFIGURATION TO STARTUP-CONFIG
  if (DWS.DEBUG == 'true') {console.debug("DWS: Saving Configuration to startup-config.")};
  await sendSerialCommand('write memory');

  // EXIT THE CONSOLE SESSION
  await sendSerialCommand('exit');
  console.log ("DWS: Switch Configuration Completed.");
}

// PERFORM SETUP FUNCTION
setTimeout(() => { firstSetup(), 500});
