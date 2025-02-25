/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way 
Divisible Rooms leveraging Cisco IP Microphones.

Macro Authors:  
Mark Lula (malula@cisco.com)
Svein Terje Steffensen (sveistef@cisco.com)
William Mills (wimills@cisco.com)
Robert(Bobby) McGonigle Jr - AZM Library

Version: 0.1
Released: 1/15/2024

Complete details for this macro are available on Github:
https://marklula.github.com/Divisible-Workspaces

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

import xapi from 'xapi';
import { AZM } from './AZM_Lib';
import DWS from './DWS_Config';

//======================//
//  REQUIRED VARIABLES  //
//======================//
// PANEL VARIABLES
const DWS_PANEL_ID = 'dws_controls';
let DWS_PANEL;
let DWS_TIMER = 0;
let DWS_INTERVAL = '';
let DWS_AUTOMODE_STATE = DWS.AUTOMODE_DEFAULT;
let DWS_SAVED_STATE = '';
let DWS_TEMP_MICS = [];
let DWS_ALL_SEC = [];
let DWS_SEC_PER_COUNT = DWS.SECONDARY_MICS.length;

if (DWS.SECONDARY_NAV_SCHEDULER != '')
{
  DWS_SEC_PER_COUNT += 2;
} 
else 
{
  DWS_SEC_PER_COUNT += 1;
}

// SERIAL VARIABLES
const SERIALCOMMAND_TERMINATOR = '\\r';
const SERIALRESPONSE_TERMINATOR = '\\r\\n';
const SERIALRESPONSE_TIMEOUT = 1000; // You can adjust the timeout value as needed
const SERIALPORT_CONFIGURATION_BAUDRATE = '115200';
const SERIALPORT_CONFIGURATION_PARITY = 'None';
const SERIALPORT_CONFIGURATION_DESCRIPTION = 'CatalystControl';

// AZM GLOBAL SETTINGS
const Settings = {                        
  Sample: {
    Size: 4,                              
    Rate_In_Ms: 500,                      
    Mode: 'Snapshot'                      
  },
  GlobalThreshold: {
    Mode: 'On',                           
    High: 30,                             
    Low: 20                               
  },
  VoiceActivityDetection: 'On'            
}

async function getState(){
  DWS_SAVED_STATE = await xapi.Config.SystemUnit.CustomDeviceId.get();
}

//===========================//
//  INITIALIZATION FUNCTION  //
//===========================//
function init() {

  // INITIALIZE AZM BASED ON SAVED STATE
  startAZM(DWS_SAVED_STATE);

  console.log ("DWS: Starting up!");

  // DELETE THE SETUP MACROS IF THEY STILL EXIST
  xapi.Command.Macros.Macro.Remove({ Name: "DWS_Wizard" });
  xapi.Command.Macros.Macro.Remove({ Name: "DWS_Setup" });

  if (DWS.DEBUG == 'true') {console.debug ("DWS DEBUG: Setting Required HTTPClient Configurations.")}
  xapi.Config.HttpClient.Mode.set('On');
  xapi.Config.HttpClient.AllowInsecureHTTPS.set('True');

  // SET USB SERIAL PORT SETTINGS
  if (DWS.DEBUG == 'true') {console.debug ("DWS DEBUG: Setting USB Console Configuration.")}
  xapi.Config.SerialPort.Outbound.Mode.set('On');
  xapi.Config.SerialPort.Outbound.Port[1].BaudRate.set(SERIALPORT_CONFIGURATION_BAUDRATE);
  xapi.Config.SerialPort.Outbound.Port[1].Parity.set(SERIALPORT_CONFIGURATION_PARITY);
  xapi.Config.SerialPort.Outbound.Port[1].Description.set(SERIALPORT_CONFIGURATION_DESCRIPTION);

  // PERFORM CHECK ON CURRENTLY SAVED STATE IN CASE OF CODEC / MACRO REBOOT DURING COMBINED STATE
  if (DWS_SAVED_STATE === 'DWS Combined') {
    console.log ('DWS: Combined State detected. Re-applying configuration.');
    
    // SET THE ROOM STATE TO COMBINED
    createPanels('Combined');
    xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Combined' });
    xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value: DWS_AUTOMODE_STATE });

  } 
  else {
    // SET THE DEFAULT ROOM STATE TO SPLIT
    xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Split' });
    createPanels('Split');
  }

  console.log ("DWS: Initialization Complete.")

}

//====================================//
//  CONSOLE COMMAND SENDING FUNCTION  //
//====================================//
async function sendSerialCommand(command) {
  // SEND CONSOLE COMMANDS
  try {
    const r = await xapi.Command.SerialPort.PeripheralControl.Send({
      Text: command + SERIALCOMMAND_TERMINATOR,
      'ResponseTerminator': SERIALRESPONSE_TERMINATOR,
      'ResponseTimeout': SERIALRESPONSE_TIMEOUT
    });
  } catch (error) {
    console.error('DWS: Unable to send message to device: ' + error.message);
  }
}

//==================================//
//  UI EXTENSION MODIFIER FUNCTION  //
//==================================//
function createPanels(curState) {
  if(curState == 'Combined') 
  {
    DWS_PANEL = `<Extensions>
      <Version>1.11</Version>
      <Panel>
        <Order>1</Order>
        <PanelId>dws_controls</PanelId>
        <Origin>local</Origin>
        <Location>HomeScreen</Location>
        <Icon>Input</Icon>
        <Color>#875AE0</Color>
        <Name>Room Controls</Name>
        <ActivityType>Custom</ActivityType>
        <Page>
          <Name>Room Controls</Name>
          <Row>
            <Name>Current Room Status:</Name>
            <Widget>
              <WidgetId>dws_state</WidgetId>
              <Name>Text</Name>
              <Type>Text</Type>
              <Options>size=4;fontSize=normal;align=center</Options>
            </Widget>
          </Row>
          <Row>
            <Name>Manual Control</Name>
            <Widget>
              <WidgetId>dws_test</WidgetId>
              <Name>Test Rooms</Name>
              <Type>Button</Type>
              <Options>size=4</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_split</WidgetId>
              <Name>Split Rooms</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_combine</WidgetId>
              <Name>Combine Rooms</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
          </Row>
          <PageId>dws_room_control</PageId>
          <Options/>
        </Page>
        <Page>
          <Name>Camera Controls</Name>
          <Row>
            <Name>Automatic Camera Switching</Name>
            <Widget>
              <WidgetId>widget_30</WidgetId>
              <Name>Disabled</Name>
              <Type>Text</Type>
              <Options>size=1;fontSize=normal;align=center</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_cam_state</WidgetId>
              <Type>ToggleButton</Type>
              <Options>size=1</Options>
            </Widget>
            <Widget>
              <WidgetId>widget_33</WidgetId>
              <Name>Enabled</Name>
              <Type>Text</Type>
              <Options>size=2;fontSize=normal;align=left</Options>
            </Widget>
            <Widget>
              <WidgetId>widget_31</WidgetId>
              <Name>Automate camera switching based on the presence of a presenter or active audience microphones.</Name>
              <Type>Text</Type>
              <Options>size=4;fontSize=small;align=center</Options>
            </Widget>
          </Row>
          <Row>
            <Name>Fixed Compositions</Name>
            <Widget>
              <WidgetId>dws_cam_sxs</WidgetId>
              <Name>Side by Side</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_cam_panda</WidgetId>
              <Name>Presenter + Audience</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
          </Row>
          <Row>
            <Name/>
            <Widget>
              <WidgetId>widget_7</WidgetId>
              <Name>Side by Side sends only Audience Cameras. Presenter and Audience will send the Presenter and both Audience Cameras.</Name>
              <Type>Text</Type>
              <Options>size=4;fontSize=small;align=center</Options>
            </Widget>
          </Row>
          <Row>
            <Name>Single Camera Modes</Name>
            <Widget>
              <WidgetId>dws_cam_presenter</WidgetId>
              <Name>Presenter</Name>
              <Type>Button</Type>
              <Options>size=4</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_cam_primary</WidgetId>
              <Name>Primary Audience</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_cam_secondary</WidgetId>
              <Name>Secondary Audience</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
          </Row>
          <PageId>dws_cam_control</PageId>
          <Options/>
        </Page>
        <Page>
          <Name>Audio Controls</Name>
          <Row>
            <Name>Microphone Settings:</Name>
            <Widget>
              <WidgetId>widget_13</WidgetId>
              <Name>Ceiling Mics Active?</Name>
              <Type>Text</Type>
              <Options>size=3;fontSize=normal;align=center</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_mic_ceiling</WidgetId>
              <Type>ToggleButton</Type>
              <Options>size=1</Options>
            </Widget>
            <Widget>
              <WidgetId>widget_14</WidgetId>
              <Name>Wireless Microphones Active?</Name>
              <Type>Text</Type>
              <Options>size=3;fontSize=normal;align=center</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_mic_wireless</WidgetId>
              <Type>ToggleButton</Type>
              <Options>size=1</Options>
            </Widget>
          </Row>
          <PageId>dws_audio_control</PageId>
          <Options>hideRowNames=0</Options>
        </Page>
      </Panel>
    </Extensions>`;
  } 
  else {
    DWS_PANEL = `<Extensions>
      <Version>1.11</Version>
      <Panel>
        <Order>1</Order>
        <PanelId>dws_controls</PanelId>
        <Origin>local</Origin>
        <Location>HomeScreen</Location>
        <Icon>Input</Icon>
        <Color>#875AE0</Color>
        <Name>Room Controls</Name>
        <ActivityType>Custom</ActivityType>
        <Page>
          <Name>Room Controls</Name>
          <Row>
            <Name>Current Room Status:</Name>
            <Widget>
              <WidgetId>dws_state</WidgetId>
              <Name>Text</Name>
              <Type>Text</Type>
              <Options>size=4;fontSize=normal;align=center</Options>
            </Widget>
          </Row>
          <Row>
            <Name>Manual Control</Name>
            <Widget>
              <WidgetId>dws_test</WidgetId>
              <Name>Test Rooms</Name>
              <Type>Button</Type>
              <Options>size=4</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_split</WidgetId>
              <Name>Split Rooms</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
            <Widget>
              <WidgetId>dws_combine</WidgetId>
              <Name>Combine Rooms</Name>
              <Type>Button</Type>
              <Options>size=2</Options>
            </Widget>
          </Row>
          <PageId>dws_room_control</PageId>
          <Options/>
        </Page>
      </Panel>
    </Extensions>`;      
  }

  // DRAW PANEL BASED ON CURRENT STATE
  xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: DWS_PANEL_ID }, DWS_PANEL)
    .catch(e => console.log('Error saving panel: ' + e.message))
}

//===================================//
//  EVENT LISTENER FOR UI EXTENSION  //
//===================================//
xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
  if (event.Type == 'released' || event.Type == 'changed')
  {   
    switch(event.WidgetId)
    {
      case 'dws_cam_state': // LISTEN FOR ENABLE / DISABLE OF AUTOMATIC MODE  
        // SET VIDEO COMPOSITON
        DWS_AUTOMODE_STATE = event.Value;

        if (DWS_AUTOMODE_STATE == 'on')        
        {
            console.log("DWS: Automatic Mode Activated.");

            // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
            xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

            // SET LOCAL SPEAKERTRACK MODE
            xapi.Command.Cameras.SpeakerTrack.Activate();
            xapi.Command.Cameras.SpeakerTrack.Closeup.Activate();

            // SET REMOTE SPEAKERTRACK MODE
            sendCommand (DWS.SECONDARY_HOST, '<Body><Command><Cameras><SpeakerTrack>Activate</SpeakerTrack></Cameras></Command><Command><Cameras><SpeakerTrack><Closeup>Activate</Closeup></SpeakerTrack></Cameras></Command></Body>');
        } 
        else        
        {
          console.log("DWS: Automatic Mode Deactived.");
        }
        break;
      case 'dws_cam_sxs': // LISTEN FOR SIDE BY SIDE COMPOSITION BUTTON PRESS  
        console.log("DWS: Side by Side Composition Selected.");
        // SET VIDEO COMPOSITON
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [1,2], Layout: 'Equal'});

        // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
        break;
      case 'dws_cam_panda': // LISTEN FOR PANDA COMPOSITION BUTTON PRESS  
        console.log("DWS: Presenter and Audience Composition Selected.");
        // SET VIDEO COMPOSITON
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [1,2,5], Layout: 'Equal'});

        // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
        break;
      case 'dws_cam_presenter': // LISTEN FOR PRESENTER CAM BUTTON PRESS  
        console.log("DWS: Presenter Track PTZ Camera Selected.");
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 5});
        xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Follow' });

        // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
        break;
      case 'dws_cam_primary': // LISTEN FOR PRIMARY CAM BUTTON PRESS  
        console.log("DWS: Primary Room Camera Selected.");
        // SET VIDEO INPUT
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

        // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
        break;
      case 'dws_cam_secondary': // LISTEN FOR SECONDARY CAM BUTTON PRESS  
        console.log("DWS: Secondary Room Camera Selected.");
        // SET VIDEO INPUT
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 2});

        // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
        break
      case 'dws_test': // LISTEN FOR SIDE BY SIDE COMPOSITION BUTTON PRESS  
        console.log("DWS: TEST BUTTON");

        // DISPLAY TEST ALERT
        sendCommand (DWS.SECONDARY_HOST, "<Command><UserInterface><Message><Alert><Display><Duration>10</Duration><Text>WORKING</Text></Display></Alert></Message></UserInterface></Command>");
        break;
      case 'dws_combine': // LISTEN FOR COMBINE BUTTON PRESS      
        console.log ("DWS: Started Combining Rooms.");

        // UPDATE STATE ON UI PANEL
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Combining'});

        // SET SECONDARY STATE FOR SPLIT OPERATION
        secondaryState('Combine');
        
        // UPDATE VLANS FOR ACCESSORIES
        setVLAN(5,8, DWS.PRIMARY_VLAN);

        // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
        xapi.Config.SystemUnit.CustomDeviceId.set('DWS Combined');

        // UPDATE STATUS ALERT
        updateStatus('Combine');
        DWS_INTERVAL = setInterval(() => {updateStatus('Combine')}, 5000);

        //RESET SECONDARY PERIPHERAL COUNT
        let allCounter = 0;

        // MONITOR FOR MIGRATED DEVICES AND CONFIGURE ACCORDING TO USER SETTINGS
        xapi.Status.Peripherals.ConnectedDevice
        .on(device => {
          if (device.Status === 'Connected') 
          {
            // MONITOR FOR TOUCH PANELS
            if (device.Type === 'TouchPanel') 
            {
              if (device.ID === DWS.SECONDARY_NAV_CONTROL) 
              {
                if (DWS.DEBUG == 'true') {console.debug("DWS DEBUG: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
                // PAIR FOUND NAV AFTER 500 MS  DELAY
                setTimeout(() => {pairSecondaryNav(device.ID, 'InsideRoom', 'Controller'), 500});
                allCounter = DWS_ALL_SEC.push(device.SerialNumber);
              }
              if (device.ID === DWS.SECONDARY_NAV_SCHEDULER) 
              {
                if (DWS.DEBUG == 'true') {console.debug("DWS DEBUG: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
                // PAIR FOUND NAV AFTER 500 MS DELAY
                setTimeout(() => {pairSecondaryNav(device.ID, 'OutsideRoom', 'RoomScheduler'), 500});
                allCounter = DWS_ALL_SEC.push(device.SerialNumber);
              }
            }

            // MONITOR FOR ALL SECONDARY MICS TO BE CONNECTED
            if (device.Type === 'AudioMicrophone') 
            {      
              if (DWS.SECONDARY_MICS.includes(device.SerialNumber))
              {
                if (DWS.DEBUG == 'true') {console.debug("DWS DEBUG: Discovered Microphone: " + device.SerialNumber)};

                // STORE FOUND MIC TEMP ARRAY IN NOT ALREADY THERE
                if (!(DWS_TEMP_MICS.includes(device.SerialNumber)))
                {                
                  let count = DWS_TEMP_MICS.push(device.SerialNumber);
                  allCounter = DWS_ALL_SEC.push(device.SerialNumber);
                  
                  if (count == DWS.SECONDARY_MICS.length)
                  {
                    // START AZM WITH A 5 SECOND DELAY IF AUTOMATIC MODE IS DEFAULT
                    if (DWS.AUTOMODE_DEFAULT == 'On')
                    {
                      setTimeout(() => {startAZM('Combined')}, 5000);
                    }                    
                    if (DWS.DEBUG == 'true') {console.debug("DWS DEBUG: All Secondary Microphones Detected. Starting AZM.")};
                  }
                }
              }
            }

            // CHECK IF THIS IS ALL OF THE CONFIGURED PERIPHERALS            
            if (allCounter == DWS_SEC_PER_COUNT)
            {
              setTimeout(() => {if (DWS.DEBUG == 'true') {console.debug("DWS DEBUG: All Secondary Peripherals Migrated.")};}, 2000);

              // CREATE COMBINED PANELS AND SET DEFAULTS BASED ON CONFIGURATION WITH 2 SECOND DELAY
              setTimeout(() => {createPanels('Combined')}, 2000);
              setTimeout(() => {xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value: DWS_AUTOMODE_STATE })}, 2300);

              // UPDATE TIMER TO SET 100% COMPLETION ON STATUS BAR
              DWS_TIMER = 160000;
            }
          }
        });

        break;
      case 'dws_split': // LISTEN FOR SPLIT BUTTON PRESS  
        console.log ("DWS: Started Splitting Rooms.");

        // RESET ANY COMPOSITIONS FOR MAIN VIDEO SOURCE
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

        // STOP AZM
        stopAZM();

        // UPDATE UI EXTENSION PANEL
        createPanels('Split');

        // UPDATE STATE ON UI PANEL
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Splitting'});   

        // SET SECONDARY STATE FOR SPLIT OPERATION
        secondaryState('Split');

        // UPDATE STATUS ALERT
        updateStatus('Split');
        DWS_INTERVAL = setInterval(() => {updateStatus('Split')}, 5000);  
        
        // UPDATE VLANS FOR ACCESSORIES
        setVLAN(5,8, DWS.SECONDARY_VLAN);

        // WAIT 165 SECONDS THEN PAIR REMOTE NAVIGATOR(S) FOR CONTROL & SCHEDULER IN SECONDARY ROOM
        setTimeout(() => {remotePairNav(DWS.SECONDARY_NAV_CONTROL, 'InsideRoom', 'Controller')}, 165000)
        if (DWS.SECONDARY_NAV_SCHEDULER != '')
        {
          setTimeout(() => {remotePairNav(DWS.SECONDARY_NAV_SCHEDULER, 'OutsideRoom', 'RoomScheduler')}, 165000);
        }

        // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
        xapi.Config.SystemUnit.CustomDeviceId.set('');
        break;
    }
  }
});

//===============================//
//  COMBINATION STATUS FUNCTION  //
//===============================//
function updateStatus(type) {
  var percent = Math.round(DWS_TIMER / 160000 * 100);

  // CHECK IF TIMER IS LESS THAN 165 SECONDS
  if (DWS_TIMER < 165000)
  {
    // UPDATE PROMPT WITH PERCENTAGE COMPLETE
    xapi.Command.UserInterface.Message.Prompt.Display({
      Duration: '0', 
      FeedbackId: '65', 
      Title: type + ' Rooms', 
      Text:'Please wait while this process completes.', 
      "Option.1": percent+'% Complete'
    });    
  } 
  else {
    // SEND FINAL PROMPT @ 100% COMPLETION
    xapi.Command.UserInterface.Message.Prompt.Clear({FeedbackId: '65'});
    xapi.Command.UserInterface.Message.Prompt.Display({Duration: '0', FeedbackId: '65',Title: type+' Rooms', "Option.1": '100% Complete', Text:'Operation completed successfully.'});
    
    // UPDATE PANEL TO SHOW FINISHED STATE
    if (type == 'Combine')
    {
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Combined'});
    }
    else{
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Split'});
    }

    console.log("DWS: Operation completed successfully!");

    // CLEAR TIMER AND RESET INTERVAL
    clearInterval(DWS_INTERVAL);
    DWS_TIMER = 0;
  }

  // INCREMENT THE TIMER 5 SECONDS
  DWS_TIMER = DWS_TIMER + 5000;
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

//=========================================//
//  SECONDARY CODEC STATE CHANGE FUNCTION  //
//=========================================//
async function secondaryState (state)
{
  if (state == 'Combine')
  {
    let command = '<Body>';

    // SET SECONDARY ROOM TO FULL SCREEN SELFVIEW
    command += '<Command><Video><Selfview><Set><FullscreenMode>On</FullscreenMode><Mode>On</Mode><OnMonitorRole>Third</OnMonitorRole></Set></Selfview></Video></Command>';
    
    // SET INBOUND VIDEO MATRIX BASED ON NUMBER OF DISPLAYS
    if (DWS.DEBUG == 'true') {console.debug ("DWS DEBUG: Setting Primary to Secondary Video Matrix");}
    if (DWS.SECONDARY_SCREENS == '1')
    {
      // SET MATRIX FOR HDMI INPUT 3 to HDMI OUT 1
      command += '<Command><Video><Matrix><Assign><Layout>Equal</Layout><Mode>Replace</Mode><Output>1</Output><SourceId>3</SourceId></Assign></Matrix></Video></Command>';
    
    } 
    else if (DWS.SECONDARY_SCREENS == '2') {
      // SET MATRIX FOR HDMI INPUT 3 to HDMI OUT 1
      command += '<Command><Video><Matrix><Assign><Mode>Replace</Mode><Output>1</Output><SourceId>3</SourceId></Assign></Matrix></Video></Command>';
      
      // SET MATRIX FOR HDMI INPUT 4 to HDMI OUT 2
      command += '<Command><Video><Matrix><Assign><Mode>Replace</Mode><Output>2</Output><SourceId>4</SourceId></Assign></Matrix></Video></Command>';
    }

    // ACTIVATE DND
    command += '<Command><Conference><DoNotDisturb>Activate</DoNotDisturb></Conference></Command>';
    command += '</Body>';
    
    // SEND SINGLE COMBINED COMMAND AND RESET
    sendCommand(DWS.SECONDARY_HOST,command);
    command = '<Body>';

    // CONFIGURATION SECTION OF COMMAND
    command += '<Configuration>';

    // SET NUMBER OF EXPECTED PANELS TO ZERO
    command += '<Peripherals><Profile><TouchPanels>0</TouchPanels></Profile></Peripherals>';

    // DISABLE STANDBY
    command += '<Standby>';
    command += '<Control>Off</Control>';
    command += '<Halfwake><Mode>Manual</Mode></Halfwake>';
    command += '</Standby>';

    // ENABLE AUTO OUTPUT FROM THE HDMI IN FROM PRIMARY && DISABLE ULTRASOUND PAIRING 
    command += '<Audio>'
    command += '<Output><HDMI item="3"><Mode>On</Mode></HDMI></Output>';  
    command += '<Ultrasound><MaxVolume>0</MaxVolume></Ultrasound>';
    command += '</Audio>';

    command += '</Configuration>';
    command += '</Body>';

    // SEND SINGLE COMBINED COMMAND AND RESET
    sendCommand(DWS.SECONDARY_HOST,command);    
    command = '';

    // UPDATE STATE MACRO ON SECONDARY
    sendCommand(DWS.SECONDARY_HOST, '<Command><Macros><Macro><Save><Name>DWS_State</Name><OverWrite>True</OverWrite><body>combine</body></Save></Macro></Macros></Command>');
  }
  else {

    let command = '<Body>';

    // RESET VIDEO MATRIX TO DEFAULT MODES
    if (DWS.DEBUG == 'true') {console.debug ("DWS DEBUG: Resetting Secondary Room Video Matrix");}
    if (DWS.SECONDARY_SCREENS == '1')
    {
      // RESET MATRIX FOR HDMI 3
      command += '<Command><Video><Matrix><Reset><Output>1</Output></Reset></Matrix></Video></Command>'; 
    } 
    else if (DWS.SECONDARY_SCREENS == '2') {
      // RESET MATRIX FOR HDMI 3
      command += '<Command><Video><Matrix><Reset><Output>1</Output></Reset></Matrix></Video></Command>';

      // RESET MATRIX FOR HDMI 4
      command += '<Command><Video><Matrix><Reset><Output>2</Output></Reset></Matrix></Video></Command>';
    }

    // DEACTIVATE DND ON SECONDARY CODEC
    command += '<Command><Conference><DoNotDisturb>Deactivate</DoNotDisturb></Conference></Command>';
    command += '</Body>';

    // SEND SINGLE COMBINED COMMAND AND RESET
    sendCommand(DWS.SECONDARY_HOST,command);
    command = '<Body>';

    // CONFIGURATION SECTION OF COMMAND
    command += '<Configuration>';

    // SET NUMBER OF EXPECTED PANELS TO MINIMUM 1
    command += '<Peripherals><Profile><TouchPanels>Minimum1</TouchPanels></Profile></Peripherals>';

    // ENABLE STANDBY
    command += '<Standby>';
    command += '<Control>On</Control>';
    command += '<Halfwake><Mode>Auto</Mode></Halfwake>';
    command += '</Standby>';

    // DISABLE AUTO OUTPUT FROM THE HDMI IN FROM PRIMARY && ENABLE ULTRASOUND PAIRING
    command += '<Audio>'
    command += '<Output><HDMI item="3"><Mode>Off</Mode></HDMI></Output>'; 
    command += '<Ultrasound><MaxVolume>70</MaxVolume></Ultrasound>';
    command += '</Audio>';

    command += '</Configuration>';
    command += '</Body>';

    // SEND SINGLE COMBINED COMMAND AND RESET
    sendCommand(DWS.SECONDARY_HOST,command);
    command = '';

    // UPDATE STATE MACRO ON SECONDARY
    sendCommand(DWS.SECONDARY_HOST, '<Command><Macros><Macro><Save><Name>DWS_State</Name><OverWrite>True</OverWrite><body>split</body></Save></Macro></Macros></Command>');
  }
}

//======================================//
//  VLAN CHANGING OVER SERIAL FUNCTION  //
//======================================//
async function setVLAN(startport, endport, vlan)
{  
  if(DWS.SWITCH_TYPE == 'C1K-8P' || DWS.SWITCH_TYPE == 'C1K-16P')
  {    
    // SEND THREE EMPTY STRINGS TO VERIFY READINESS THEN LOGIN
    await sendSerialCommand('');
    await sendSerialCommand('');
    await sendSerialCommand('');
    await sendSerialCommand(DWS.USERNAME);
    await sendSerialCommand(DWS.PASSWORD);
    // ENTER GLOBAL CONFIGURATION MODE
    await sendSerialCommand('configure terminal');    
    // SELECT THE RANGE OF INTERFACES
    await sendSerialCommand('interface range GigabitEthernet' + startport + '-' + endport);
    // DISABLE POE
    //await sendSerialCommand('power inline never');
    // SET THE VLAN
    await sendSerialCommand('switchport access vlan ' + vlan);
    // ENABLE POE
    //await sendSerialCommand('power inline auto');
    // SAVE CONFIGURATION TO START-UP
    await sendSerialCommand('write memory');
    // LEAVE CONFIGURATION MODE
    await sendSerialCommand('end');
    // EXIT THE CONSOLE SESSION
    await sendSerialCommand('exit');

    if (DWS.DEBUG == 'true') {console.debug ("DWS DEBUG: VLANS Modified. Accessories Migrating (~160s)")}
  }
  else if (DWS.SWITCH_TYPE == 'C9K-8P' || DWS.SWITCH_TYPE == 'C9K-12P')
  {
    // SEND THREE EMPTY STRINGS TO VERIFY READINESS THEN LOGIN
    await sendSerialCommand('');
    await sendSerialCommand('');
    await sendSerialCommand('');
    await sendSerialCommand('enable');
    await sendSerialCommand(DWS.PASSWORD);
    // ENTER GLOBAL CONFIGURATION MODE
    await sendSerialCommand('configure terminal');    
    // SELECT THE RANGE OF INTERFACES
    await sendSerialCommand('interface range GigabitEthernet' + startport + '-' + endport);
    // SET THE VLAN
    await sendSerialCommand('switchport access vlan ' + vlan);
    // LEAVE CONFIGURATION MODE
    await sendSerialCommand('end');
    // SAVE CONFIGURATION TO START-UP
    await sendSerialCommand('write memory');    
    // EXIT THE CONSOLE SESSION
    await sendSerialCommand('exit');

    if (DWS.DEBUG == 'true') {console.debug ("DWS DEBUG: VLANS Modified. Accessories Migrating (~160s)")}
  }
}

//===============================//
//  NAVIGATOR PAIRING FUNCTIONS  //
//===============================//
function pairSecondaryNav(panelId, location, mode) 
{
  if (DWS.DEBUG == 'true') {console.debug (`DWS DEBUG: Attempting to configure Secondary Touch Panel: ${panelId}`)}

  // Command to set the panel to control mode
  xapi.Command.Peripherals.TouchPanel.Configure({ ID: panelId, Location: location, Mode: mode})
  .then(() => {
    if (DWS.DEBUG == 'true') {console.debug (`DWS DEBUG: Secondary Room Touch Panel ${panelId} configured successfully`)}
  })
  .catch((error) => {
    console.error(`DWS: Failed to pair Touch Panel ${panelId} to Primary`, error);
  });
}

function remotePairNav(panelId, location, mode) 
{
  if (DWS.DEBUG == 'true') {console.debug (`DWS DEBUG: Attempting to re-configure Touch Panel ${panelId} in Secondary Room`)}

  // SEND PAIR COMMAND TO SECONDARY ROOM
  sendCommand (DWS.SECONDARY_HOST, '<Command><Peripherals><TouchPanel><Configure><ID>'+panelId+'</ID><Location>'+location+'</Location><Mode>'+mode+'</Mode></Configure></TouchPanel></Peripherals></Command>')

  if (DWS.DEBUG == 'true') {console.debug (`DWS DEBUG: Secondary Room Touch Panel ${panelId} configured successfully`)}
}

//===========================//
//  AZM SUPPORTED FUNCTIONS  //
//===========================//
function buildEmptyAZM()
{
  let DWS_EMPTY_AZM = {
    Settings: { ...Settings },
    Zones: []
  }
  return DWS_EMPTY_AZM;
}

function buildAZMProfile()
{
  let PRIMARY_ZONE = [];
  let SECONDARY_ZONE = [];

  DWS.PRIMARY_MICS.forEach(element => { 
    PRIMARY_ZONE.push({Serial: element, SubId: [1]})
  });

  DWS.SECONDARY_MICS.forEach(element => { 
    SECONDARY_ZONE.push({Serial: element, SubId: [1]})
  });

  let DWS_AZM_PROFILE = {
    Settings: { ...Settings },
    Zones: [
      {
        Label: 'PRIMARY ROOM',
        MicrophoneAssignment: {
          Type: 'Ethernet',
          Connectors: [...PRIMARY_ZONE]
        },
        Assets: {                             
          Camera: {
            InputConnector: 1,
            Layout: 'Equal'
          }
        }
      },
      {
        Label: 'SECONDARY ROOM',
        MicrophoneAssignment: {
          Type: 'Ethernet',                   
          Connectors: [ ...SECONDARY_ZONE]
        },
        Assets: {                             
          Camera: {
            InputConnector: 2,
            Layout: 'Equal'
          }
        }
      }
    ]
  }
  return DWS_AZM_PROFILE;
}

function startAZMZoneListener() {
  AZM.Event.TrackZones.on(handleAZMZoneEvents);

  startAZMZoneListener = () => void 0;
}

function startCallListener() {
  //Subscribe to Call Status (For Demo Purposes)
  xapi.Status.SystemUnit.State.NumberOfActiveCalls.on(handleCallStatus)

  startCallListener = () => void 0;
}

async function handleAZMZoneEvents(event) {

  // CHECK DWS CAMERA MODE & ONLY SET THE CAMERA BASED ON AZM PROFILE IF IN "AUTOMATIC"
  if (DWS_AUTOMODE_STATE == 'on') 
  {
    const ACTIVE_PRESENTER = await xapi.Status.Cameras.PresenterTrack.PresenterDetected.get()
    
    if (ACTIVE_PRESENTER == 'True')
    {
      if (DWS.DEBUG == 'true') {console.debug ('DWS DEBUG: Presenter Detected. Adjusting Composition.')};

      // SET COMPOSITION TO INCLUDE PRESENTER TRACK PTZ AS LARGE PIP
      if (event.Zone.Label == 'PRIMARY ROOM' || event.Zone.Label == 'SECONDARY ROOM')
      {
        if (event.Zone.State == 'High') 
        {
          if (DWS.DEBUG == 'true') {console.debug ('DWS DEBUG: Setting PIP with PTZ & ' + event.Zone.Label)};

          await xapi.Command.Video.Input.SetMainVideoSource({
            ConnectorId: event.Assets.Camera.InputConnector,
            ConnectorId: 5,
            Layout: PIP,
            PIPPosition: Lowerright,
            PIPSize: Large
          });
        }
        else{
          await xapi.Command.Video.Input.SetMainVideoSource({
            ConnectorId: 5,
            Layout: Equal
          });
        }
      }
    } 
    else
    {
      if (event.Zone.Label == 'PRIMARY ROOM' || event.Zone.Label == 'SECONDARY ROOM')
      {
        if (event.Zone.State == 'High') 
        {
          if (DWS.DEBUG == 'true') {console.debug ('DWS DEBUG: No Presenter Detected. Switching to ' + event.Zone.Label)};

          await xapi.Command.Video.Input.SetMainVideoSource({
            ConnectorId: event.Assets.Camera.InputConnector,
            Layout: event.Assets.Camera.Layout
          });
        }
      }
    }
  }
}

async function handleCallStatus(event) {
  if (event > 0) {
    //Start the Zone VU Meters when a Call Starts
    AZM.Command.Zone.Monitor.Start()
  } else {
    //Stop the Zone VU Meters when a Call Ends
    AZM.Command.Zone.Monitor.Stop()
  }
}

async function startAZM(state)
{
  let configurationProfile = '';

  if (state == 'DWS Combined') 
  {
    configurationProfile = buildAZMProfile();
    await AZM.Command.Zone.Setup(configurationProfile);
    startAZMZoneListener();
    startCallListener();
    await AZM.Command.Zone.Monitor.Stop();
  } 
  else 
  {
    configurationProfile = buildEmptyAZM();
    await AZM.Command.Zone.Setup(configurationProfile);
  }
}

async function stopAZM()
{
  let configurationProfile = buildEmptyAZM();
  await AZM.Command.Zone.Setup(configurationProfile);
}

getState();
setTimeout(() => {init()}, 100);
