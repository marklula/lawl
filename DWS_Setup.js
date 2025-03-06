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

//==============================//
//  FIRST TIME SETUP FUNCTIONS  //
//==============================//
async function firstSetup()
{
  let command = '';

  console.log("DWS: Starting Automatic Setup Process.");

  // DOUBLE CHECK INITIAL SWITCH CONFIGURATION
  console.log ("DWS: Checking Switch Readiness.");
  const checkswitch = await checkSwitch(); 

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
    xapi.Config.Video.Input.Connector[2].Name.set('Secondary Audience');
    xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off');
    xapi.Config.Video.Input.Connector[2].Visibility.set('Never');
    xapi.Config.Video.Input.Connector[5].Name.set('Primary PTZ Camera');
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
  Params.Header = ['Authorization: Basic ' + btoa(`${DWS.MACRO_USERNAME}:${DWS.MACRO_PASSWORD}`), 'Content-Type: application/json']; // CONVERT TO BASE64 ENCODED

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
//  C9K RECOMMENDED CONFIGURATION FUNCTION  //
//==========================================//
async function checkSwitch() {
  const url = `https://169.254.1.254/restconf/data/Cisco-IOS-XE-native:native/hostname`;

  xapi.command('HttpClient Get', { 
    Url: url, 
    Header: [
      'Accept: application/yang-data+json',
      `Authorization: Basic ${btoa(`${DWS.SWITCH_USERNAME}:${DWS.SWITCH_PASSWORD}`)}`
    ],
    AllowInsecureHTTPS: true
  })
  .then(response => {
    const jsonResponse = JSON.parse(response.Body);
    const hostname = jsonResponse['Cisco-IOS-XE-native:hostname'];
    if (DWS.DEBUG == 'true') {console.debug('Switch Detected! Hostname:', hostname)};

    // SAVE SWITCH CONFIGURATION
    xapi.command('HttpClient Get', { 
      Url: 'https://169.25.1.254/restconf/operations/cisco-ia:save-config/', 
      Header: [
        'Accept: application/yang-data+json',
        `Authorization: Basic ${btoa(`${DWS.SWITCH_USERNAME}:${DWS.SWITCH_PASSWORD}`)}`
      ],
      AllowInsecureHTTPS: true
    })
    .then(response => {
      console.log ('DWS: Switch Configuration Saved.');
    })
    .catch(error => {
      console.warn('DWS: Unable to Save Switch Config:', error.message);
    });
  })
  .catch(error => {
    console.warn('DWS: Switch Check Failed. Retrying:', error.message);
    setTimeout(() => {checkSwitch()}, 1000);
  });
}

// PERFORM SETUP FUNCTION
setTimeout(() => { firstSetup(), 500});
