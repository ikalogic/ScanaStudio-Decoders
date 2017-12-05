/*
*************************************************************************************

							SCANASTUDIO 2 - 1-WIRE DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	1-Wire Protocol Decoder.
	This is a standard 1-Wire bus decoder. It will detect and display the device family
	as well as commands and different bus states. This decoder will differentiate between
	regular and overdrive modes and warn you in case of irregularities.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.31: Add light packet capabilities.
	V1.30: Reworked PacketView.
	V1.28: Improved error handling.
	V1.27: Added ScanaStudio 2.3xx compatibility.
	V1.26: New Packet View layout.
	V1.25: Correct a bug that caused decoding to be aborted.
	V1.24: Added CRC support in demo signal, and added signal generator capability
	V1.23: More realistic demo signals generation
	V1.22: Added protocol based trigger capability
	V1.21: Added demo signal generation.
	V1.20: Fixed false error messages.
	V1.18: Solved minor bug.
	V1.17: Extended protocol delays support.
	V1.15: Added Packet/Hex View support.
	V1.11: Added new device family codes.
	V1.1:  Fixed timing values.
	V1.0:  Initial release.g

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>

*************************************************************************************
*/

/*
*************************************************************************************
								      INFO
*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "1-Wire";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.31";
}

/* Author
*/
function get_dec_auth()
{
	return "IKALOGIC";
}

/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/

var STATE = 
{
	INIT        : 0x00,
	RESET       : 0x01,
	PRESENCE    : 0x02,
	ROM_COMMAND : 0x04,
	SHOW_ROM    : 0x08,
	SEARCH_ROM  : 0x16,
	DATA        : 0x32,
	END         : 0x64
};

var ROM_CMD = 
{
	READ_ROM      : {code: 0x33, str: "READ ROM "},
	MATCH_ROM     : {code: 0x55, str: "MATCH ROM "},
	OVD_MATCH_ROM : {code: 0x69, str: "OVERDRIVE MATCH ROM "},
	SKIP_ROM      : {code: 0xCC, str: "SKIP ROM "},
	OVD_SKIP_ROM  : {code: 0x3C, str: "OVERDRIVE SKIP ROM "},
	SEARCH_ROM    : {code: 0xF0, str: "SEARCH ROM "},
	ALARM_SEARCH  : {code: 0xEC, str: "ALARM SEARCH "}
};

var ROM_CMD_READ_ROM = 0x33;
var ROM_CMD_MATCH_ROM = 0x55;
var ROM_CMD_OVD_MATCH_ROM = 0x69;
var ROM_CMD_SKIP_ROM = 0xCC;
var ROM_CMD_OVD_SKIP_ROM = 0x3C;
var ROM_CMD_SEARCH_ROM = 0xF0;
var ROM_CMD_ALARM_SEARCH = 0xEC;

var OWOBJECT_TYPE = 
{
	RESET    : 0x01,
	PRESENCE : 0x02,
	BIT      : 0x04,
	BYTE     : 0x08,
	UNKNOWN  : 0x16
};

var DEVICE_FAMILY =
{
	DS1990   : {code: 0x01, str: "DS1990(A)/DS2401"},    // Serial number iButton                                    
	DS1991   : {code: 0x02, str: "DS1991"},              // Multikey iButton                                         
	DS1994   : {code: 0x04, str: "DS1994/DS2404"},       // 4k-bit NV RAM memory + clock + timer + alarms iButton    
	DS2405   : {code: 0x05, str: "DS2405"},              // Single addressable switch                                
	DS1993   : {code: 0x06, str: "DS1993"},              // 4k-bit NV RAM memory iButton                             
	DS1992   : {code: 0x08, str: "DS1992"},              // 1k-bit NV RAM memory iButton                             
	DS1982   : {code: 0x09, str: "DS1982/DS2502"},       // 1k-bit EPROM uniqueWare iButton                          
	DS1995   : {code: 0x0A, str: "DS1995"},              // 16k-bit NV RAM memory iButton                            
	DS1985   : {code: 0x0B, str: "DS1985/DS2505"},       // 16k-bit EPROM memory                                     
	DS1996   : {code: 0x0C, str: "DS1996"},              // 64k-bit NV RAM memory iButton                            
	DS1986   : {code: 0x0F, str: "DS1986/DS2506"},       // 64k-bit EPROM memory                                     
	DS2502   : {code: 0x09, str: "DS2502"},              // 1k-bit EPROM memory                                      
	DS1820   : {code: 0x10, str: "DS1820/DS18S20/DS1920"},	// Digital thermometer                                      
	DS2406   : {code: 0x12, str: "DS2406/DS2407"}, 	     // Dual addressable switch + 1k-bit EPROM memory            
	DS1971   : {code: 0x14, str: "DS1971/DS2430"},       // 256-bit EEPROM iButton                                   
	DS1963   : {code: 0x1A, str: "DS1963(L)"},           // 4k-bit monetary iButton                                  
	DS2436   : {code: 0x1B, str: "DS2436"},              // Battery ID/monitor chip                                  
	DS2422   : {code: 0x1C, str: "DS2422"},              // 1k-bit NV RAM with ext-counters                          
	DS2423   : {code: 0x1D, str: "DS242"},               // 4k-bit NV RAM with ext-counters                          
	DS2437   : {code: 0x1E, str: "DS2437"},              // Smart battery monitor                                    
	DS2409   : {code: 0x1F, str: "DS2409"},              // Microlan coupler                                         
	DS1962   : {code: 0x18, str: "DS1962"},              // 1k-bit monetary iButton                                  
	DS2450   : {code: 0x20, str: "DS2450"},              // Quad A/D converter                                       
	DS1921   : {code: 0x21, str: "DS1921"},              // Temperature recorder iButton                             
	DS1822   : {code: 0x22, str: "DS1822"},              // Econo digital thermometer
	DS1973   : {code: 0x23, str: "DS1973/DS2433"},       // 4k-bit EEPROM iButton                                    
	DS1904   : {code: 0x24, str: "DS1904/DS2415"},       // Real-time clock                                          
	DS2438   : {code: 0x26, str: "DS2438"},              // Digital thermometer + A/D converter                      
	DS2417   : {code: 0x27, str: "DS2417"},       		 // RTC with interrupt                                       
	DS18B20  : {code: 0x28, str: "DS18B20/MAX31820"},    // Digital thermometer                                      
	DS2408   : {code: 0x29, str: "DS2408"},              // 8-ch addressable switch                                  
	DS2760   : {code: 0x30, str: "DS2760"},              // Digital thermometer + A/D converter + current sensor     
	DS2890   : {code: 0x2C, str: "DS2890"},              // Single digital potentiometer                             
	DS2431   : {code: 0x2D, str: "DS1972/DS2431"},       // 1024-bit, 1-Wire EEPROM  								 
	DS1977   : {code: 0x37, str: "DS1977"},     		 // Password-protected 32KB (bytes) EEPROM                                                  
	DS2413   : {code: 0x3A, str: "DS2413"},   			 // 2-channel addressable switch                             
	DS1825   : {code: 0x3B, str: "DS1825/MAX31826/MAX318(50/51)"}, 	// Digital Thermometer
	DS2422   : {code: 0x41, str: "DS2422"},              // High-capacity Thermochron (temperature/humidity) loggers 
	DS28EA00 : {code: 0x42, str: "DS28EA00"},            // Digital thermometer                                      
	DS28EC20 : {code: 0x43, str: "DS28EC20"},            // 20Kb 1-Wire EEPROM                                       
	DS1420   : {code: 0x81, str: "DS1420"},              // Serial ID Button                                         
	DS1425   : {code: 0x82, str: "DS1425"},     		 // Multi iButton                                            
	DS1427   : {code: 0x84, str: "DS1427"}               // Time iButton                                             
}; 

var REGULAR_DELAYS =
{
	// RESET AND PRESENCE PULSE
	RSTL_STD : 480,
	RSTL_MIN : 380,
	PDH_MIN  : 15,
	PDH_MAX  : 60,
	PDL_MIN  : 60,
	PDL_MAX  : 240,

	// TIME SLOTS
	SLOT_MIN : 60,
	SLOT_MAX : 120,
	REC_MIN  : 1,	

	// WRITE 1 TIME SLOT
	LOW1_MIN : 1,
	LOW1_MAX : 15,

	// WRITE 0 TIME SLOT
	LOW0_MIN : 60,
	LOW0_MAX : 120,

	// READ TIME SLOTS
	LOWR_MIN : 1,
	LOWR_MAX : 15,
	REL_MIN  : 0,
	REL_MAX  : 45,
	RDV      : 15
};

var OVERDRIVE_DELAYS =
{
	// RESET AND PRESENCE PULSE
	RSTL_MIN : 48,
	RSTL_MAX : 80,
	PDH_MIN  : 2,
	PDH_MAX  : 6,
	PDL_MIN  : 8,
	PDL_MAX  : 24,

	// TIME SLOTS
	SLOT_MIN : 6,
	SLOT_MAX : 16,
	REC_MIN  : 1,

	// WRITE 1 TIME SLOT
	LOW1_MIN : 1,
	LOW1_MAX : 2,

	// WRITE 0 TIME SLOT
	LOW0_MIN : 6,
	LOW0_MAX : 16,

	// READ TIME SLOTS
	LOWR_MIN : 1,
	LOWR_MAX : 2,
	REL_MIN  : 0,
	REL_MAX  : 4,
	RDV      : 2
};

var SPEED =
{
	REGULAR   : 0,
	OVERDRIVE : 1,
	UNKNOWN   : 2
};

var HEXVIEW_OPT = 
{
	DATA : 0x00,
	ROM  : 0x01,
	ADR  : 0x02,
	ALL  : 0x03
};

/* Object definitions
*/
function OWObject (type, value, start, end, duration, isLast)
{
	this.type = type;
	this.value = value;
	this.start = start;
	this.end = end;
	this.duration = duration;
	this.isLast = isLast;
};

function PktObject (title, titleColor, data, dataLen, dataObjArr, dataColor, start, end)
{
	this.title = title;
	this.titleColor = titleColor;
	this.data = data;
	this.dataLen = dataLen;
	this.dataObjArr = dataObjArr;
	this.dataColor = dataColor;
	this.start = start;
	this.end = end;
};

var oWDelays;
var owObjects;
var pktObjects;
var samples_per_us;
var ow_trig_steps = [];

var PKT_COLOR_DATA;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_RESET_TITLE;
var PKT_COLOR_PRES_TITLE;
var PKT_COLOR_ROMCMD_TITLE;
var PKT_COLOR_ROMCODE_TITLE;
var PKT_COLOR_UNKNW_TITLE;
var PKT_COLOR_OTHER_TITLE;
var PKT_COLOR_INVALID;

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();  // clean up the User interface before drawing a new one.

	ui_add_ch_selector( "uiCh", "Channel to decode", "1-Wire" );

	ui_add_txt_combo( "uiSpeed", "Speed" );
	ui_add_item_to_txt_combo( "Regular speed", true );
	ui_add_item_to_txt_combo( "Overdrive speed" );

	ui_add_separator();
	ui_add_info_label( "Hex view options", true );

	ui_add_txt_combo( "uiHexView", "Include in HEX view:" );
	ui_add_item_to_txt_combo( "DATA fields only", true );
	ui_add_item_to_txt_combo( "ROM COMMAND fields only" );
	ui_add_item_to_txt_combo( "ROM ADDRESS fields only" );
	ui_add_item_to_txt_combo( "Everything" );
}

/* This is the function that will be called from ScanaStudio 
   to update the decoded items
*/
function decode()
{
	var owObject;
	var stop = false;
	var state = STATE.INIT;
	var pktOk = true;
	var firstRun = true;

	PKT_COLOR_DATA          = get_ch_light_color(uiCh);
	PKT_COLOR_DATA_TITLE    = dark_colors.gray;
	PKT_COLOR_RESET_TITLE   = dark_colors.green;
	PKT_COLOR_PRES_TITLE    = dark_colors.violet;
	PKT_COLOR_ROMCMD_TITLE  = dark_colors.orange;
	PKT_COLOR_ROMCODE_TITLE = dark_colors.blue;
	PKT_COLOR_UNKNW_TITLE   = dark_colors.black;
	PKT_COLOR_OTHER_TITLE   = dark_colors.yellow;
	PKT_COLOR_INVALID       = dark_colors.red;

	pktObjects = [];

	get_ui_vals();				 	// Update the content of all user interface related variables
	var tr = trs_get_first(uiCh);	// Position the navigator for 'ch' channel at the first transition
	clear_dec_items();			 	// Clears all the the decoder items and its content

	var measuredSpeed = speed_test(uiCh);

	if (measuredSpeed != uiSpeed)
	{
		if (measuredSpeed == SPEED.REGULAR)
		{
			uiSpeed = SPEED.REGULAR;
		}
		else if (measuredSpeed == SPEED.OVERDRIVE)
		{
			uiSpeed = SPEED.OVERDRIVE;
		}
	}

	if (uiSpeed == SPEED.REGULAR)
	{
		oWDelays = REGULAR_DELAYS;
	}
	else
	{	
		oWDelays = OVERDRIVE_DELAYS;
	}

	decode_signal(uiCh);

	/* Do for all transitions
	*/
	while ((stop != true) && (owObjects.length > 1))
	{
		if (abort_requested() == true)
		{
			return false;
		}

		switch (state)
		{
			case STATE.INIT:

				/* Display all unknown (transitions and pulses with wrong timing) fields
				*/
				for (var i = 0; i < owObjects.length; i++)
				{
					if (owObjects[i].type == OWOBJECT_TYPE.UNKNOWN)
					{
						dec_item_new(uiCh, owObjects[i].start, owObjects[i].end);
						dec_item_add_pre_text("UNKNOWN PULSE");
						dec_item_add_pre_text("UNKNOWN");
						dec_item_add_pre_text("UN");
						dec_item_add_post_text(" (" + owObjects[i].duration + " us)");
					}
				}

				state = STATE.RESET;

			break;

			case STATE.RESET:

				owObject = owObjects.shift();

				if (owObject.type == OWOBJECT_TYPE.RESET)
				{
					var resetStatus = "";

					if (uiSpeed == SPEED.REGULAR)
					{
						if (+owObject.duration < oWDelays.RSTL_STD)
						{
							resetStatus += "WARN. TOO SHORT: ";
						}
					}

					dec_item_new(uiCh, owObject.start, owObject.end);
					dec_item_add_pre_text("MASTER RESET PULSE");
					dec_item_add_pre_text("RESET PULSE");
					dec_item_add_pre_text("RESET");
					dec_item_add_pre_text("R");
					dec_item_add_post_text(" (" + resetStatus + (Math.round(owObject.duration * 100) / 100) + " us)");

					if (!firstRun)
					{
						pkt_add_packet(pktOk);
					}

					pktOk = true;
					firstRun = false;

					pktObjects.push(new PktObject("RESET", PKT_COLOR_RESET_TITLE, (resetStatus + (Math.round(owObject.duration * 100) / 100) + " us"), 0, 0, PKT_COLOR_DATA, owObject.start, owObject.end));

					state = STATE.PRESENCE;
				}

			break;

			case STATE.PRESENCE:

				owObject = owObjects.shift();

				if (owObject.type == OWOBJECT_TYPE.PRESENCE)
				{
					if (owObject.value == true)
					{
						dec_item_new(uiCh, owObject.start, owObject.end);
						dec_item_add_pre_text("SLAVE PRESENCE");
						dec_item_add_pre_text("PRESENCE");
						dec_item_add_pre_text("PRES");
						dec_item_add_pre_text("P");
						dec_item_add_post_text(" (" + (Math.round(owObject.duration * 100) / 100) + " us)");

						pktObjects.push(new PktObject("PRESENCE", PKT_COLOR_PRES_TITLE, ((Math.round(owObject.duration * 100) / 100) + " us"), 0, 0, PKT_COLOR_DATA, owObject.start, owObject.end));
					}
					else
					{
						dec_item_new(uiCh, owObject.start, owObject.end);
						dec_item_add_pre_text("SLAVE PRESENCE MISSING");
						dec_item_add_pre_text("PRESENCE MISSING");
						dec_item_add_pre_text("MISSING");
						dec_item_add_pre_text("M");

						pktObjects.push(new PktObject("PRESENCE", PKT_COLOR_INVALID, "PRESENCE MISSING", 0, 0, PKT_COLOR_DATA, owObject.start, owObject.end));
						pktOk = false;
					}

					owObject = owObjects.shift();
					owObjects.unshift(owObject);

					if (owObject.type == OWOBJECT_TYPE.RESET)
					{
						state = STATE.RESET;
					}
					else
					{
						state = STATE.ROM_COMMAND;
					}
				}
				else
				{
					state = STATE.RESET;
				}

			break;

			case STATE.ROM_COMMAND:

				var romCmd = false;
				var romCmdStr;
				var owByte = get_ow_byte(uiCh);

				if (owByte.isLast == true)
				{
					state = STATE.END;
					break;
				}

				dec_item_new(uiCh, owByte.start, owByte.end);

				if ((uiHexView != HEXVIEW_OPT.DATA) && (uiHexView != HEXVIEW_OPT.ADR))
				{
					hex_add_byte(uiCh, -1, -1, owByte.value);
				}

				for (var k in ROM_CMD)
				{
					var cmd = ROM_CMD[k];

					if (owByte.value == cmd.code)
					{
						dec_item_add_pre_text(cmd.str);
						dec_item_add_data(owByte.value);

						pktObjects.push(new PktObject("ROM CMD", PKT_COLOR_ROMCMD_TITLE, cmd.str, 0, 0, PKT_COLOR_DATA, owByte.start, owByte.end));
						
						switch (cmd)
						{
							case ROM_CMD.READ_ROM:
							case ROM_CMD.MATCH_ROM: state = STATE.SHOW_ROM;
							break;

							case ROM_CMD.SEARCH_ROM: state = STATE.SEARCH_ROM;
							break;

							default: state = STATE.DATA;
							break;
						}
					}
				}

			break;

			case STATE.SHOW_ROM:

				/* 64-bit ROM code:
				   [LSB] 8-bit Family Code | 48-bit Serial Number | 8-bit CRC | [MSB]
				*/
				var owByte;
				var romCode = [];
				var pktFamilyCode = "", pktSerialStr = "", pktCrcStr = "";

				do
				{
					owByte = get_ow_byte(uiCh);
					romCode.push(owByte);
				}
				while ((owByte.isLast != true) && (romCode.length < 8))

				if (romCode.length == 8)
				{
					// Calc CRC
					var calcCrc = get_crc8(romCode);

					// Show Family Code
					var familyCode = romCode.shift();
					dec_item_new(uiCh, familyCode.start, familyCode.end);

					if ((uiHexView != HEXVIEW_OPT.DATA) && (uiHexView != HEXVIEW_OPT.ROM))
					{
						hex_add_byte(uiCh, -1, -1, familyCode.value);
					}

					for (var k in DEVICE_FAMILY)
					{
						var device = DEVICE_FAMILY[k];

						if (familyCode.value == device.code)
						{
							pktFamilyCode = device.str;
							dec_item_add_pre_text(device.str + " (");
							dec_item_add_post_text(")");
						}
					}

					dec_item_add_data(familyCode.value);

					var pktFamilyCodeStr;

					if (pktFamilyCode != "")
					{
						pktFamilyCodeStr = pktFamilyCode + " (" + int_to_str_hex(familyCode.value) + ")";
					}
					else
					{
						pktFamilyCodeStr = int_to_str_hex(familyCode.value);
					}

					// Show Serial Number
					for (var i = 0; i < romCode.length - 1; i++)
					{
						var data = romCode[i];
						dec_item_new(uiCh, data.start, data.end);
						dec_item_add_data(data.value);

						pktSerialStr += int_to_str_hex(data.value) + " ";

						if ((uiHexView != HEXVIEW_OPT.DATA) && (uiHexView != HEXVIEW_OPT.ROM))
						{
							hex_add_byte(uiCh, -1, -1, data.value);
						}
					}

					// Verify and show CRC
					var crcOk = true;
					
					deviceCrc = romCode[romCode.length - 1];

					dec_item_new(uiCh, deviceCrc.start, deviceCrc.end);
					dec_item_add_pre_text("CRC: ");
					dec_item_add_data(deviceCrc.value);

					pktCrcStr = int_to_str_hex(deviceCrc.value); 

					if ((uiHexView != HEXVIEW_OPT.DATA) && (uiHexView != HEXVIEW_OPT.ROM))
					{
						hex_add_byte(uiCh, -1, -1, deviceCrc.value);
					}

					if (deviceCrc.value == calcCrc)
					{
						pktCrcStr += " (OK)";
						dec_item_add_post_text(" OK");
					}
					else
					{
						pktCrcStr += " (WRONG)";
						dec_item_add_post_text(" WRONG");
						crcOk = false;
						pktOk = false;
					}

					pktObjects.push(new PktObject("FAMILY", PKT_COLOR_ROMCODE_TITLE, pktFamilyCodeStr, 0, 0, PKT_COLOR_DATA, familyCode.start, familyCode.end));
					pktObjects.push(new PktObject("SERIAL", PKT_COLOR_ROMCODE_TITLE, pktSerialStr, 0, 0, PKT_COLOR_DATA, romCode[0].start, romCode[romCode.length - 2].end));

					if (crcOk)
					{
						pktObjects.push(new PktObject("CRC", PKT_COLOR_ROMCODE_TITLE, pktCrcStr, 0, 0, PKT_COLOR_DATA, deviceCrc.start, deviceCrc.end));
					}
					else
					{
						pktObjects.push(new PktObject("CRC", PKT_COLOR_ROMCODE_TITLE, pktCrcStr, 0, 0, PKT_COLOR_INVALID, deviceCrc.start, deviceCrc.end));
					}
				}
				else if (romCode.length < 8)
				{
					var errStr = "INCOMPLETE";

					dec_item_new(uiCh, romCode[0].start, romCode[romCode.length - 1].end);
					dec_item_add_pre_text(errStr);

					pktObjects.push(new PktObject("ROM CODE", PKT_COLOR_ROMCODE_TITLE, errStr, 0, 0, PKT_COLOR_DATA, romCode[0].start, romCode[romCode.length - 1].end));
				}

				state = STATE.DATA;

			break;

			case STATE.SEARCH_ROM:

				var owByte;
				var owByteCnt = 0;
				var firstByte = get_ow_byte(uiCh);
				var lastByte;

				do
				{
					owByte = get_ow_byte(uiCh);
					owByteCnt++;
					
					if (owByte.isLast != true)
					{
						lastByte = owByte;
					}
	
				} while (owByte.isLast != true);

				dec_item_new(uiCh, firstByte.start, lastByte.end);
				dec_item_add_pre_text("SEARCH ROM SEQUENCE");

				pktObjects.push(new PktObject("SRCH SEQ", PKT_COLOR_OTHER_TITLE, ((owByteCnt * 8) + " bits"), 0, 0, PKT_COLOR_DATA, firstByte.start, lastByte.end));

				state = STATE.RESET;

			break;

			case STATE.DATA:

				/* Get and show all data */

				owObject = owObjects.shift();
				owObjects.unshift(owObject);

				if (owObject.type == OWOBJECT_TYPE.RESET)
				{
					state = STATE.RESET;
					break;
				}

				var owByte;
				var pktObj = new PktObject();

				pktObj.title = "DATA";
				pktObj.data = "";
				pktObj.titleColor = PKT_COLOR_DATA_TITLE;
				pktObj.dataColor = PKT_COLOR_DATA;
				pktObj.dataObjArr = [];
				pktObj.start = false;
				pktObj.dataLen = 0;

				do
				{
					owByte = get_ow_byte(uiCh);

					if (owByte.isLast != true)
					{
						dec_item_new(uiCh, owByte.start, owByte.end);
						dec_item_add_data(owByte.value);

						if ((uiHexView != HEXVIEW_OPT.ROM) && (uiHexView != HEXVIEW_OPT.ADR))
						{
							hex_add_byte(uiCh, -1, -1, owByte.value);
						}

						var dataStr = int_to_str_hex(owByte.value);
						pktObj.data +=  dataStr + " ";
						owByte.value = dataStr;
						pktObj.dataObjArr.push(owByte);
						pktObj.dataLen++;

						if (!pktObj.start)
						{
							pktObj.start = owByte.start;
						}

						pktObj.end = owByte.end;
					}

					if (owByte.duration == true)
					{
						dec_item_new(uiCh, owByte.start, owByte.end);
						dec_item_add_pre_text("INVALID BYTE");

						pktObj.data += "XXXX ";
						owByte.value = "XXXX";
						pktObj.dataObjArr.push(owByte);
						pktObj.dataLen++;

						pktObj.dataColor = PKT_COLOR_INVALID;
						pktOk = false;
					}

				} while (owByte.isLast != true);

				if (pktObj.dataLen > 0)
				{
					pktObjects.push(pktObj);
				}

				state = STATE.RESET;

			break;

			case STATE.END:

				state = STATE.RESET;

			break;
		}
	}

	pkt_add_packet(pktOk);
	return true;
}

/* Get a byte from 1-Wire bus
*/
function get_ow_byte (ch)
{
	var byteStart = false, byteEnd = false;
	var byteValue = false;
	var byteErr = false;
	var isLast = false;
	var i = 0;

	if (owObjects.length > 0)
	{
		do
		{
			if (owObjects.length == 0) break;
			
			owObject = owObjects.shift();

			if (owObject.type != OWOBJECT_TYPE.BIT)
			{
				owObjects.unshift(owObject);
				isLast = true;
				break;
			}

			byteValue >>= 1;

			if (owObject.value == 1)
			{
				byteValue |= 0x80;
			}
			
			/* Show each bit value */
			var midSample = ((owObject.start + owObject.end) / 2);

			if (owObject.value == 1)
			{
				dec_item_add_sample_point(ch, midSample, DRAW_1);
			}
			else if (owObject.value == 0)
			{
				dec_item_add_sample_point(ch, midSample, DRAW_0);
			}

			if(owObject.duration == true)
			{
				byteErr = true;
				dec_item_add_sample_point(ch, midSample, DRAW_CROSS);
			}

			if (byteStart == false)
			{
				byteStart = owObject.start;
			}

			byteEnd = owObject.end;
			i++;
		}
		while ((i < 8) && (owObject.type == OWOBJECT_TYPE.BIT));
	}
	else
	{
		isLast = true;
	}

	if (i < 7)
	{
		if (byteStart != false && byteEnd != false)
		{
			byteErr = true;
		}
	}

	return new OWObject(OWOBJECT_TYPE.BYTE, byteValue, byteStart, byteEnd, byteErr, isLast);
}

/* Find all 1-Wire bus data then put all in one storage place (global array) 
   for future bus analysing in main function - decode()
*/
function decode_signal (ch)
{
	owObjects = [];

	var tr = trs_get_first(ch);

	while (trs_is_not_last(ch) == true)
	{
		if(abort_requested() == true)
		{
			return false;
		}

		set_progress(100 * tr.sample / n_samples);   // Give feedback to ScanaStudio about decoding progress

		tr = get_next_falling_edge(ch, tr);
 
		var trLowSt = tr;
		tr = get_next_rising_edge(ch, tr);
		var tLow = get_timediff_us(trLowSt, tr);

		/****************************
				    RESET
		 ****************************/
   		if (tLow >= oWDelays.RSTL_MIN)
		{
			owObjects.push(new OWObject(OWOBJECT_TYPE.RESET, true, trLowSt.sample, tr.sample, tLow, false));

			var trPDH = get_next_falling_edge(ch, tr);
			var tPDH = get_timediff_us(tr, trPDH);

			if (tPDH < oWDelays.LOW1_MIN)
			{
				do 
				{
					tr = trs_get_next(ch);
					trPDH = get_next_falling_edge(ch, tr);
					tPDH = get_timediff_us(tr, trPDH);

				} while (tPDH < oWDelays.LOW1_MIN);
			}

			if ((tPDH <= oWDelays.PDH_MAX) && (tPDH >= oWDelays.PDH_MIN))
			{
				var trPDL = get_next_rising_edge(ch, trPDH);
				var tPDL = get_timediff_us(trPDH, trPDL);
				
				owObjects.push(new OWObject(OWOBJECT_TYPE.PRESENCE, true, trPDH.sample, trPDL.sample, tPDL, false));
				tr = trPDL;
			}
			else
			{
				owObjects.push(new OWObject(OWOBJECT_TYPE.PRESENCE, false, tr.sample, tr.sample + get_num_samples_for_us(oWDelays.PDH_MAX), false));
				tr = trPDH;
			}
		}
		/****************************
		             BIT
		 ****************************/
		else if (tLow >= oWDelays.LOW1_MIN)
		{			
			var trHighSt = tr;
			var trHighEnd = get_next_falling_edge(ch, trHighSt);
			var tHigh = get_timediff_us(trHighSt, trHighEnd);
			var bitErr = false;

			if(trHighEnd == false)
			{
				trHighEnd = trHighSt;
			}

			var bitValue;
	
			// Master Write 1 Slot
			if ((tLow <= oWDelays.LOW1_MAX) && (tLow >= oWDelays.LOW1_MIN))
			{
				bitValue = 1;
			}
			// Master Write 0 Slot
			else if ((tLow <= oWDelays.LOW0_MAX) && (tLow >= oWDelays.LOW0_MIN))
			{
				bitValue = 0;
			}
			//  Master Read 0 Slot
			else if ((tLow <= (oWDelays.LOWR_MAX + oWDelays.REL_MAX)) && (tLow >= oWDelays.LOWR_MIN))
			{
				bitValue = 0;
			}
			// Error. Unknown bit value
			else
			{
				bitValue = false;
				bitErr = true;
			}

			if (tHigh > (oWDelays.SLOT_MAX + oWDelays.RDV + oWDelays.REL_MAX))
			{
				owObjects.push(new OWObject(OWOBJECT_TYPE.BIT, bitValue, trLowSt.sample, trHighSt.sample, bitErr, false));
			}
			else
			{
				owObjects.push(new OWObject(OWOBJECT_TYPE.BIT, bitValue, trLowSt.sample, trHighEnd.sample, bitErr, false));
			}

			tr = trHighEnd;
		}
		/****************************
		          ERROR
		 ****************************/
		else if (tLow < oWDelays.LOW1_MIN)
		{
			/*
			if (owObjects.length > 0)
			{
				var lastObj = owObjects.pop();		// Skip invalid (too short) pulse

				if (lastObj.type == OWOBJECT_TYPE.BIT)
				{
					lastObj.start = trLowSt.sample;
					tr = trs_get_next(ch);
					lastObj.end = tr.sample;
				}

				owObjects.push(lastObj);
			}
			*/
		}
		else
		{
			/* owObjects.push(new OWObject(OWOBJECT_TYPE.UNKNOWN, true, trLowSt.sample, tr.sample, tLow, false));
			*/
		}
	}

	return true;
}

/* Test of 1-Wire bus speed
*/
function speed_test (ch)
{
	var tr = trs_get_first(ch);

	while (trs_is_not_last(ch) == true)
	{
		tr = get_next_falling_edge(ch, tr);

		var trRstSt = tr;
		var tr = get_next_rising_edge(ch, tr);
		var tRSTL = get_timediff_us(trRstSt, tr);

		if (tr == false)
		{
			return SPEED.UNKNOWN;
		}

   		if (tRSTL >= REGULAR_DELAYS.RSTL_MIN)
		{
			var trPDH = get_next_falling_edge(ch, tr);
			var tPDH = get_timediff_us(tr, trPDH);
			tr = trPDH;

			if ((tPDH <= REGULAR_DELAYS.PDH_MAX) && (tPDH >= REGULAR_DELAYS.PDH_MIN))
			{
				return SPEED.REGULAR;
			}
		}
		else if ((tRSTL <= OVERDRIVE_DELAYS.RSTL_MAX) && (tRSTL >= OVERDRIVE_DELAYS.RSTL_MIN))
		{
			var trPDH = get_next_falling_edge(ch, tr);
			var tPDH = get_timediff_us(tr, trPDH);
			tr = trPDH;

			if ((tPDH <= OVERDRIVE_DELAYS.PDH_MAX) && (tPDH >= OVERDRIVE_DELAYS.PDH_MIN))
			{
				return SPEED.OVERDRIVE;
			}
		}
	}

	return SPEED.UNKNOWN;
}

/*
*************************************************************************************
							     SIGNAL GENERATOR
*************************************************************************************
*/

function generator_template()
{
	/*
		Quick Help
		~~~~~~~~~~
		Start by configuring the decoder with the variables
		in the "configuration" part.

		Then, use the following functions to generate 1-Wire packets:

		gen_add_delay(delay)
		=============================
			Description
			-----------
			Adds a delay
			
			Parameters
			----------
			delay: the delay expressed in number of samples
			
		gen_byte(data)
		===============
			Description
			-----------
			generates one byte of data on the 1-Wire bus
			
		gen_reset()
		===============
			Description
			-----------
			generates a master reset timeslot
			
		gen_presence(p)
		===============
			Description
			-----------
			generates a presence timeslot
			
			Parameters:
			-----------
			p: set to "true" if you wish to force the presence timeslot to low (as if a slave have responded).
				set to false otherwize.
			
		get_crc8_from_array(a)
		=====================
			Description
			-----------
			generates an 8-bit CRC from an array of bytes
			
			Parameters
			----------
			a: array of bytes
	*/
	
	/*
		Configuration part : !! Configure this part !!
		(Do not change variables names)
	*/

	uiCh = 0; 				  // Generate on CH 1
	uiSpeed = SPEED.REGULAR;  // Regular speed (you can also use SPEED.OVERDRIVE)

	gen_init();

	/*
		Signal generation part !! Change this part according to your application !!
	*/

	var rom_code = [];
	var test = 0;

	gen_add_delay(samples_per_us * 100);
	gen_reset();
	gen_presence(true);

	gen_byte(ROM_CMD_READ_ROM);

	rom_code.length = 0; 	  // Clear array
	rom_code.push(test);
	gen_byte(test);

	for (var i = 1; i < 7; i++)
	{
		rom_code.push(i);
		gen_byte(i);
	}

	gen_byte(get_crc8_from_array(rom_code));
}

/*
*/
function gen_init()
{
	samples_per_us = get_srate() / 1000000;
	
	if (samples_per_us < 2)
	{
		add_to_err_log("SPI generator Bit rate too high compared to device sampling rate");
	}

	if (uiSpeed == SPEED.REGULAR)
	{
		oWDelays = REGULAR_DELAYS;
	}
	else
	{
		oWDelays = OVERDRIVE_DELAYS;
	}
}

/*
*/
function gen_reset()
{
	add_samples(uiCh, 0, samples_per_us * (oWDelays.RSTL_STD + 10));
	add_samples(uiCh, 1, samples_per_us * (oWDelays.PDH_MAX / 2));
}

/*
*/
function gen_presence (force_present)
{
	if (force_present)
	{
		add_samples(uiCh, 0, samples_per_us * (oWDelays.PDL_MAX / 2));	
	}
	else
	{
		add_samples(uiCh, 1, samples_per_us * (oWDelays.PDL_MAX / 2));	
	}

	add_samples(uiCh, 1, samples_per_us * 10);	
}

/*
*/
function gen_byte (code)
{
    var b, lvl, par;

	for (var i = 0; i < 8; i++)
	{
		b = ((code >> i) & 0x1)

		if (b == 1)
		{
			add_samples(uiCh, 0, samples_per_us * (oWDelays.LOW1_MAX / 2));
			add_samples(uiCh, 1, samples_per_us * oWDelays.SLOT_MIN);
		}
		else
		{
			add_samples(uiCh, 0, samples_per_us * oWDelays.LOW0_MIN);
			add_samples(uiCh, 1, samples_per_us * oWDelays.SLOT_MIN);
		}
	}

    add_samples(uiCh, 1, samples_per_us * 100); 	// add delay between bytes
}

/*
*/
function gen_add_delay (n)
{
	add_samples(uiCh, 1, n);
}

/*
*************************************************************************************
							     DEMO BUILDER
*************************************************************************************
*/

/*
*/
function build_demo_signals()
{
	var demo_cnt = 0;
	var samples_per_frame = 0;
	var frames_to_disp = 0;
	var demo_rom_code = [];

	gen_init();

	samples_per_frame = (oWDelays.RSTL_STD + 10);
	samples_per_frame += (oWDelays.PDH_MAX / 2);
	samples_per_frame += (oWDelays.PDL_MAX / 2);
	samples_per_frame += (samples_per_us * 10);

	for (var i = 0; i < 10; i++)
	{
		for (var k = 0; k < 8; k++)
		{
			samples_per_frame += oWDelays.LOW0_MIN + oWDelays.SLOT_MIN;
			samples_per_frame += 100;
		}
	}

	samples_per_frame += 100;
	samples_per_frame *= samples_per_us;
	frames_to_disp = n_samples / samples_per_frame;

	if (frames_to_disp > 0)
	{
		gen_add_delay(samples_per_us*100);

		for (var j = 0; j < frames_to_disp; j++)
		{
			gen_reset();
			gen_presence(true);

			gen_byte(0x33);
			
			demo_rom_code.length = 0; //clear array
			
			demo_rom_code.push(demo_cnt);
			gen_byte(demo_cnt);
			
			for (var i = 1; i < 7; i++)
			{
				demo_rom_code.push(i);
				gen_byte(i);
			}
			
			gen_byte(get_crc8_from_array(demo_rom_code));

			demo_cnt++;
			add_samples(uiCh, 1, n_samples / 20);	// delay between transactions
		}
	}
}

/*
*************************************************************************************
							       TRIGGER
*************************************************************************************
*/

/* Graphical user interface for the trigger configuration
*/
function trig_gui()
{
	trig_ui_clear();

	trig_ui_add_alternative("ALT_ANY_FRAME", "Trigger on a any valid 1-Wire transaction", false);
		trig_ui_add_label("label0", "Trigger when a master reset pulse is followed by a valid presence pulse");

	trig_ui_add_alternative("ALT_SPECIFIC_CMD", "Trigger on specific ROM command", true);

		trig_ui_add_label("label1", "Type decimal value (51) or Hex value (0x33) of the ROM command to be used for trigger");
		trig_ui_add_free_text("trig_rom_cmd","ROM Command:");
}

/*
*/
function trig_seq_gen()
{
    flexitrig_set_async_mode(true);
	get_ui_vals();

	if (uiSpeed == SPEED.REGULAR)
	{
		oWDelays = REGULAR_DELAYS;

		if ((1 / get_srate()) > (1e-6))
		{
			add_to_err_log("Sample rate too low for the 1-Wire protocol trigger");
		}
	}
	else
	{	
		oWDelays = OVERDRIVE_DELAYS;

		if ((1 / get_srate()) > (0.1e-6))
		{
			add_to_err_log("Sample rate too low for the 1-Wire protocol trigger");
		}
	}

	ow_trig_steps.length = 0;
	flexitrig_clear();

	if (ALT_ANY_FRAME == true)
	{
		flexitrig_set_summary_text("1-Wire presence pulse");

		flexitrig_append(build_step("F"), -1, -1);
		flexitrig_append(build_step("R"), us_to_s(oWDelays.RSTL_MIN), us_to_s(oWDelays.RSTL_STD * 2));
		flexitrig_append(build_step("F"), us_to_s(oWDelays.PDH_MIN), us_to_s(oWDelays.PDH_MAX * 2));
	}
	else if (ALT_SPECIFIC_CMD == true)
	{
		flexitrig_set_summary_text("1-Wire ROM: " + trig_rom_cmd);
		trig_rom_cmd = Number(trig_rom_cmd);

		flexitrig_append(build_step("F"), -1, -1);
		flexitrig_append(build_step("R"), us_to_s(oWDelays.RSTL_MIN), us_to_s(oWDelays.RSTL_STD * 2));
		flexitrig_append(build_step("F"), us_to_s(oWDelays.PDH_MIN), us_to_s(oWDelays.PDH_MAX * 2));
		flexitrig_append(build_step("R"), us_to_s(oWDelays.PDL_MIN), us_to_s(oWDelays.PDL_MIN * 2));

		build_trig_byte(trig_rom_cmd);
	}

	// flexitrig_print_steps();
}

/*
*/
function build_trig_byte (data)
{
	if ((data & 0x1) == 0)
	{
		flexitrig_append(build_step("F"), -1, -1);
		flexitrig_append(build_step("R"), us_to_s(oWDelays.LOW0_MIN), us_to_s(oWDelays.LOW0_MAX));
	}
	else
	{
		flexitrig_append(build_step("F"), -1, -1);
		flexitrig_append(build_step("R"), us_to_s(oWDelays.REC_MIN), -1);
	}

	for (var bit = 0; bit < 7; bit++)
	{
		if (((data >> bit) & 0x1) == 0)
		{
			flexitrig_append(build_step("F"), -1, -1);
			flexitrig_append(build_step("R"), -1, -1);
		}
		else
		{
			flexitrig_append(build_step("F"), -1, -1);
			flexitrig_append(build_step("R"), -1, -1);
		}
	}
}

/*
*/
function build_step (step_ch_desc)
{
	var i;
	var step = "";

	for (i = 0; i < get_device_max_channels(); i++)
	{
		if (i == uiCh)
		{
			step = step_ch_desc + step;
		}
		else
		{
			step = "X" + step;
		}
	}

	return step;
}

/*
*************************************************************************************
							        UTILS
*************************************************************************************
*/

/*
*/
function pkt_add_packet (ok)
{
	var obj;
	var desc = "";
	var objCnt = 0;
	var pktDataPerLine = 7;

	if (pktObjects.length < 1)
	{
		return;
	}

	for (var i = 0; i < pktObjects.length; i++)
	{
		obj = pktObjects[i];

		if (obj.title.localeCompare("ROM CMD") == 0) 
		{
			desc += obj.data.replace("ROM", "");
		}

		if (obj.title.localeCompare("FAMILY") == 0) 
		{
			var substr = obj.data.substring(obj.data.lastIndexOf("(") + 1, obj.data.lastIndexOf(")"));
			desc += substr + " ";
		}

		if (obj.title.localeCompare("DATA") == 0) 
		{			
			desc += " DATA[" + obj.dataObjArr.length + "]";
		}
	}

	desc = desc.replace(/  +/g, ' ');

	var pktStart = pktObjects[0].start;
	var pktEnd = pktObjects[pktObjects.length - 1].end;

	pkt_start("1-WIRE");

	if (ok)
	{
		pkt_add_item(pktStart, pktEnd, "1-WIRE FRAME", desc, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true, uiCh);
	}
	else
	{
		pkt_add_item(pktStart, pktEnd, "1-WIRE FRAME", desc, PKT_COLOR_INVALID, PKT_COLOR_DATA, true, uiCh);
	}

	pkt_start("NEW FRAME");

	while (pktObjects.length > objCnt)
	{
		obj = pktObjects[objCnt];
		objCnt++;

		if (obj.title.localeCompare("DATA") == 0)
		{
			if (obj.dataLen > pktDataPerLine)
			{
				var dataLine = "";
				var lineStart = false, lineEnd;
				var dataCnt = 0, lineCnt = 0;

				while (obj.dataObjArr.length > dataCnt)
				{
					if (lineCnt <= pktDataPerLine)
					{
						if (!lineStart)
						{
							lineStart = obj.dataObjArr[dataCnt].start;
						}

						lineEnd = obj.dataObjArr[dataCnt].end;
						dataLine = dataLine + obj.dataObjArr[dataCnt].value + " ";
						lineCnt++;
						dataCnt++;
					}
					else
					{
						pkt_add_item(lineStart, lineEnd, obj.title, dataLine, obj.titleColor, obj.dataColor, true, uiCh);
						lineStart = false;
						dataLine = "";
						lineCnt = 0;
					}
				}

				if (lineCnt > 0)
				{
					pkt_add_item(lineStart, lineEnd, obj.title, dataLine, obj.titleColor, obj.dataColor, true, uiCh);
				}
			}
			else
			{
				pkt_add_item(obj.start, obj.end, obj.title, obj.data, obj.titleColor, obj.dataColor, true, uiCh);
			}
		}
		else
		{
			if (obj.title.localeCompare("RESET") != 0)
			{
				if ((obj.title.localeCompare("PRESENCE")) != 0 || (obj.data.localeCompare("PRESENCE MISSING") == 0))
				{
					pkt_add_item(obj.start, obj.end, obj.title, obj.data, obj.titleColor, obj.dataColor, true, uiCh);
				}
			}
		}
	}

	pkt_end();
	pkt_end();

	pktObjects.length = 0;
	pktObjects = [];
}

/*
*/
function int_to_str_hex (num) 
{
	var temp = "";

	if (num < 0x10)
	{
		temp += "0";
	}

	temp += num.toString(16).toUpperCase();

	return temp;
}

/*
*/
function get_ch_light_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
	chColor.g = (chColor.g * 1 + 255 * 3) / 4;
	chColor.b = (chColor.b * 1 + 255 * 3) / 4;

	return chColor;
}

/* ScanaStudio 2.3 compatibility function
*/
function get_srate()
{
	if (typeof get_sample_rate === "function")
	{
		return get_sample_rate();
	}
	else
	{
		return sample_rate;
	}
}

/*
*/
function us_to_s (us)
{
	return (us * 1e-6);
}

/* Get time difference in microseconds between two transitions
*/
function get_timediff_us (tr1, tr2)
{
	return (((tr2.sample - tr1.sample) * 1000000) / get_srate());
}

/*  Get number of samples for the specified duration in microseconds
*/
function get_num_samples_for_us (us)
{
	return ((us * get_srate()) / 1000000);
}

/*  CRC8 algorithm for one byte
*/
function compute_crc8 (data, seed)
{
    var temp;

    for (var i = 8; i > 0; i--)
    {
        temp = ((seed ^ data) & 0x01);

        if(temp == 0)
        {
            seed >>= 1;
        }
        else
        {
            seed ^= 0x18;
            seed >>= 1;
            seed |= 0x80;
        }
        data >>= 1;
    }

    return seed;
}

/*	Get 8-byte crc
*/
function get_crc8 (romCode)
{
	var crc;
	
	for (var i = 0; i < 7; i++)
	{
		crc = compute_crc8(romCode[i].value, crc);
	}
	
	return crc;
}

function get_crc8_from_array (a)
{
	var crc;
	
	for (var i = 0; i < 7; i++)
	{
		crc = compute_crc8(a[i], crc);
	}
	
	return crc;
}

/* Get next transition with falling edge
*/
function get_next_falling_edge (ch, trStart)
{
	var tr = trStart;
	
	while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);	// Get the next transition
	}

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}

/*	Get next transition with rising edge
*/
function get_next_rising_edge (ch, trStart)
{
	var tr = trStart;
	
	while ((tr.val != RISING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);	// Get the next transition
	}

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}




