
/*
*************************************************************************************

					    SCANASTUDIO 2 CHARACTER LCD DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	LCD (4-bit mode) Decoder.
	This decoder script will interpret control and display signals sent to a standard
	Hitachi HD44780 based LCD device

</DESCRIPTION>

<RELEASE_NOTES>

	V1.09: Prevented incompatible workspaces from using the decoder
	V1.08: Now the decoding can be aborted
	V1.07: New Packet View data displaying.
	V1.05: Added Packet/Hex View support.
	V1.01: Small UI fixes.
	V1.0:  Initial release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>
						
*************************************************************************************
*/


/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "LCD 4-Bit"; 
}


/* The decoder version 
*/
function get_dec_ver()
{
	return "1.09";
}


/* Author 
*/
function get_dec_auth()
{
	return "IKALOGIC";
}


/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();		// clean up the User interface before drawing a new one.
	
	if ((typeof(get_device_max_channels) == 'function') && (typeof(get_device_name) == 'function'))
	{
		// Prevented incompatible workspaces from using the decoder
		if( get_device_max_channels() < 7 )
		{
			ui_add_info_label("This device (or workspace configuration) do not have enough channels for this decoder to operate properly");
			return;
		}
	}
	else
	{
		ui_add_info_label("error", "Please update your ScanaStudio software to use this decoder version");
		return;
	}
	
	ui_add_ch_selector("chE", "Strobe/Enable (E)", "E");
	ui_add_ch_selector("chRS", "Registers Select (RS)", "RS");
	ui_add_ch_selector("chRW", "Read/Write Selec (RW)", "RW");

	ui_add_ch_selector("chDB4", "Data Bus Bit 4 (DB4)", "DB4");
	ui_add_ch_selector("chDB5", "Data Bus Bit 5 (DB5)", "DB5");
	ui_add_ch_selector("chDB6", "Data Bus Bit 6 (DB6)", "DB6");
	ui_add_ch_selector("chDB7", "Data Bus Bit 7 (DB7)", "DB7");

	ui_add_txt_combo("uiOffset","Skip first n Strobe Periods");
		ui_add_item_to_txt_combo("None", true);
		ui_add_item_to_txt_combo("1 period");
		ui_add_item_to_txt_combo("2 periods");

	ui_add_txt_combo("uiBitShow","Show Bit Values");
		ui_add_item_to_txt_combo("Off");
		ui_add_item_to_txt_combo("On", true);
}


/* Constants 
*/
var LCDOBJECT_TYPE = 
{
	CMD  : 0x01,
	DATA : 0x02,
	EOD  : 0x04,
};

var ERR_CODES = 
{
	OK         : 0x01,
	NO_SIGNAL  : 0x02,
	ERR_SIGNAL : 0x04,
};

var LCD_CMD = 
{
    CLEAR 				: {code: 0x01, str: "CLEAR"},
    HOME 				: {code: 0x02, str: "CURSOR HOME"},
    HOME_2 				: {code: 0x03, str: "CURSOR HOME"},
	ENTRY_LEFT 			: {code: 0x04, str: "ENTRY MODE LEFT"},
	ENTRY_RIGHT 		: {code: 0x06, str: "ENTRY MODE RIGHT"},
    OFF 				: {code: 0x08, str: "LCD OFF"},
    OFF_CURSOR_ON 		: {code: 0x0A, str: "LCD OFF"},
	ON 					: {code: 0x0C, str: "LCD ON"},
	CURSOR_CHAR_ON 		: {code: 0x0D, str: "CURSOR CHAR"},
    CURSOR_ON 			: {code: 0x0E, str: "CURSOR ON"},
    CURSOR_AND_CHAR_ON 	: {code: 0x0F, str: "CURSOR AND CHAR ON"},
	SHIFT_CURSOR_LEFT 	: {code: 0x10, str: "SHIFT CURSOR LEFT"},
	SHIFT_CURSOR_RIGHT 	: {code: 0x14, str: "SHIFT CURSOR RIGHT"},
	SHIFT_DISPLAY_LEFT  : {code: 0x18, str: "SHIFT DISPLAY LEFT"},
	SHIFT_DISPLAY_RIGHT : {code: 0x1C, str: "SHIFT DISPLAY RIGHT"},
	MODE_4BIT_1LINE     : {code: 0x20, str: "MODE 4BIT 1 LINE"},
	MODE_4BIT_2LINES 	: {code: 0x28, str: "MODE 4BIT 2 LINES"},
	MODE_8_BIT_1LINE    : {code: 0x30, str: "MODE 8BIT 1 LINE"},
	MODE_8_BIT_2LINES   : {code: 0x38, str: "MODE 8BIT 2 LINES"},
	ADR_CGRAM0			: {code: 0x40, str: "WRITE TO CGRAM  AT: 0"},
	ADR_LINE1			: {code: 0x80, str: "GOTO LINE 1"},
	ADR_LINE2           : {code: 0xC0, str: "GOTO LINE 2"},
	ADR_LINE3			: {code: 0x94, str: "GOTO LINE 3"},
	ADR_LINE4           : {code: 0xD4, str: "GOTO LINE 4"},
};

var LCD_CONFIG = 
{
	MAX_LINES : 4,
	MAX_ROWS  : 40
}

var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_CMD_TITLE;
var PKT_COLOR_DATA;


/* Object definitions
*/
function LcdObject (type, value, rw, start, end)
{
	this.type = type;
	this.value = value;
	this.rw = rw;
	this.start = start;
	this.end = end;
};


/* Global variables
*/
var lcdObjectsArr;
var chDB;


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();			// Update the content of all user interface related variables
	clear_dec_items();		// Clears all the the decoder items and its content

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	PKT_COLOR_DATA_TITLE = dark_colors.gray;
	PKT_COLOR_CMD_TITLE = dark_colors.green;
	PKT_COLOR_DATA = get_ch_light_color(chE);

	lcdObjectsArr = new Array();

	chDB = new Array();
	chDB.push(chDB7);
	chDB.push(chDB6);
	chDB.push(chDB5);
	chDB.push(chDB4);

	decode_signal();

	var str1, str2, pktStr;
	var actionStr;
	var dataStrCnt = 0, dataStrSt, dataStrEnd;
	var dataArr = new Array();

	while (lcdObjectsArr.length > 0)
	{
		if (abort_requested() == true)
		{
			return false;
		}

		var lcdObject = lcdObjectsArr.shift();
		actionStr = "";
		pktStr = "";

		dec_item_new(chE, lcdObject.start, lcdObject.end);
		pkt_start("LCD");

		if (lcdObject.rw == 0)
		{
			str1 = "WRITE";
			str2 = "W";
		}
		else
		{
			str1 = "READ";
			str2 = "R";
		}

		actionStr = str1;

		switch (lcdObject.type)
		{
			case LCDOBJECT_TYPE.CMD:

					str1 += " CMD: ";
					str2 += "C: ";

					var cmd = lcdObject.value;
					var unknownCmd = true;

					for (var i in LCD_CMD)		// Find and show current LCD command
					{
						var constCmd = LCD_CMD[i];

						if (cmd == constCmd.code)
						{
							str1 += constCmd.str + " ";
							pktStr += " " + constCmd.str + " ";

							dec_item_add_pre_text(str1 + "(");
							dec_item_add_post_text(")");

							unknownCmd = false;
						}
					}

					if ((unknownCmd == true) && (cmd >= LCD_CMD.ADR_CGRAM0.code))
					{
						unknownCmd = false;
						var cmdStr;

						if (cmd > LCD_CMD.ADR_CGRAM0.code && cmd < LCD_CMD.ADR_LINE1.code)
						{
							cmdStr = "WRITE TO CGRAM AT: "; 
							cmdStr += (cmd - LCD_CMD.ADR_CGRAM0.code) + " ";
						}
						else if (cmd > LCD_CMD.ADR_LINE1.code && cmd < LCD_CMD.ADR_LINE1.code + LCD_CONFIG.MAX_ROWS)
						{
							cmdStr = LCD_CMD.ADR_LINE1.str; 
							cmdStr += " ROW " + (cmd - LCD_CMD.ADR_LINE1.code) + " ";
						}
						else if (cmd > LCD_CMD.ADR_LINE2.code && cmd < LCD_CMD.ADR_LINE2.code + LCD_CONFIG.MAX_ROWS)
						{
							cmdStr = LCD_CMD.ADR_LINE2.str; 
							cmdStr += " ROW " + (cmd - LCD_CMD.ADR_LINE2.code) + " ";
						}
						else if (cmd > LCD_CMD.ADR_LINE3.code && cmd < LCD_CMD.ADR_LINE3.code + LCD_CONFIG.MAX_ROWS) 
						{
							cmdStr = LCD_CMD.ADR_LINE3.str; 
							cmdStr += " ROW " + (cmd - LCD_CMD.ADR_LINE3.code) + " ";
						}
						else if (cmd > LCD_CMD.ADR_LINE4.code && cmd < LCD_CMD.ADR_LINE4.code +LCD_CONFIG. MAX_ROWS) 
						{
							cmdStr = LCD_CMD.ADR_LINE4.str;
							cmdStr += " ROW " + (cmd - LCD_CMD.ADR_LINE4.code) + " ";
						}
						else
						{
							str1 += "GOTO UNKNOWN ADR: ";
						}

						str1 += cmdStr;
						pktStr += cmdStr;

						dec_item_add_pre_text(str1 + "(");
						dec_item_add_post_text(")");
					}

					dec_item_add_pre_text(str1);
					dec_item_add_pre_text(str2);
					dec_item_add_data(cmd);

					if (unknownCmd)
					{
						pktStr += " " + int_to_str_hex(cmd);
					}

					hex_add_byte(chE, -1, -1, cmd);

					if (dataStrCnt > 0)
					{
						add_pkt_data(dataStrSt, dataStrEnd, dataArr, dataStrCnt);

						dataArr.length = 0;
						dataStrCnt = 0;
						dataStrSt = 0;
						dataStrEnd = 0;

						pkt_end();
						pkt_start("LCD");
					}

					pkt_add_item(-1, -1, actionStr + " COMMAND", pktStr, PKT_COLOR_CMD_TITLE, PKT_COLOR_DATA, true);
			break;

			case LCDOBJECT_TYPE.DATA:

					str1 += " DATA ";
					str2 += "D ";

					dec_item_add_pre_text(str1);
					dec_item_add_pre_text(str2);
					dec_item_add_data(lcdObject.value);

					var asciiChar = String.fromCharCode(lcdObject.value);

					if (lcdObject.value >= 0x20)
					{
						pktStr = asciiChar;
					}
					else
					{
						pktStr = int_to_str_hex(lcdObject.value);
					}

					dataArr.push(pktStr);
					dataStrCnt++;

					if (dataStrCnt == 1) dataStrSt = lcdObject.start;
					dataStrEnd = lcdObject.end;

					hex_add_byte(chE, -1, -1, lcdObject.value);
			break;

			case LCDOBJECT_TYPE.EOD:		// END OF DATA

					if (dataStrCnt > 0)
					{
						add_pkt_data(dataStrSt, dataStrEnd, dataArr, dataStrCnt);

						dataArr.length = 0;
						dataStrCnt = 0;
						dataStrSt = 0;
						dataStrEnd = 0;
					}
			break;
		}

		pkt_end();
	}

	return true;
}


/* Find all LCD bus data then put all in one storage place (global array) 
   for future bus analysing in main function - decode()
*/
function decode_signal()
{
	var trE = trs_get_first(chE);
	var trRS = trs_get_first(chRS);
	var trRW = trs_get_first(chRW);
	var trDB4 = trs_get_first(chDB4);
	var trDB5 = trs_get_first(chDB5);
	var trDB5 = trs_get_first(chDB6);
	var trDB6 = trs_get_first(chDB7);

	trE = set_offset(chE, trE);
	var avgtHigh = get_avg_thigh(chE, trE);

	trE = trs_get_first(chE);
	trE = set_offset(chE, trE);					// Set initial Offset

	while ((trs_is_not_last(chE) != false))		// Read data for a whole transfer
	{
		if (abort_requested() == true)			// Allow the user to abort this script
		{
			return false;
		}

		set_progress(100 * trE.sample / n_samples);	// Give feedback to ScanaStudio about decoding progress

		var byteStart = false, byteEnd;
		var byteValue = 0;
		var bitValue;
		var rsValue, rwValue;

		for (var n = 0; n < 2; n++)
		{
			trE = get_next_falling_edge(chE, trE);

			if (byteStart == false)
			{
				byteStart = trE.sample;
			}

			for (var i = 0; i < chDB.length; i++)
			{
				bitValue = sample_val(chDB[i], trE.sample);

				byteValue <<= 1;
				byteValue |= bitValue;

				if (uiBitShow == 1)
				{
					dec_item_new(chDB[i], trE.sample - (avgtHigh / 3), trE.sample + (avgtHigh / 3));
					dec_item_add_pre_text(bitValue);
				}
			}

			rsValue = sample_val(chRS, trE.sample);
			rwValue = sample_val(chRW, trE.sample);

			byteEnd = trE.sample;
		}

		if (rsValue == 1)
		{
			lcdObjectsArr.push(new LcdObject(LCDOBJECT_TYPE.DATA, byteValue, rwValue, byteStart, byteEnd));
		}
		else
		{
			lcdObjectsArr.push(new LcdObject(LCDOBJECT_TYPE.CMD, byteValue, rwValue, byteStart, byteEnd));
		}
	}

	lcdObjectsArr.pop();
	lcdObjectsArr.push(new LcdObject(LCDOBJECT_TYPE.EOD, 0, 0, 0, 0));

	return true;
}


/*
*/
function int_to_str_hex (num) 
{
	var temp = "0x";

	if (num < 0x10)
	{
		temp += "0";
	}

	temp += num.toString(16).toUpperCase();

	return temp;
}


/*
*/
function add_pkt_data (start, end, dataArr, strLen)
{
	var pktDataPerLine = 32;

	if (strLen > pktDataPerLine)
	{
		var strTemp = dataArr.toString();
		strTemp = strTemp.replace(/,/g, "");
		strTemp += " ...";

		pkt_add_item(start, end, "DATA", strTemp, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);

		for (var i = pktDataPerLine - 1; i < dataArr.length; i += pktDataPerLine)
		{
			dataArr[i] += "\n";
		}

		strTemp = dataArr.toString();
		strTemp = strTemp.replace(/,/g, "");

		pkt_start("DATA");
		pkt_add_item(start, end, "DATA", strTemp, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		pkt_end();
	}
	else
	{
		var strTemp = dataArr.toString();
		strTemp = strTemp.replace(/,/g, "");

		pkt_add_item(start, end, "DATA", strTemp, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
	}
}


/*
*/
function check_scanastudio_support()
{
    if (typeof(pkt_start) != "undefined")
    { 
        return true;
    }
    else
    {
        return false;
    }
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


/* Do initial offset if necessary
*/
function set_offset (ch, trSt)
{
	var tr = trSt;

	if (uiOffset > 0)
	{
		for (var i = 0; i < uiOffset; i++)
		{
			tr = trs_get_next(ch);
			tr = trs_get_next(ch);
		}
	}

	return tr;
}


/* Get next transition with falling edge
*/
function get_next_falling_edge (ch, trSt)
{
	var tr = trSt;

	do
	{
		tr = trs_get_next(ch);	// Get the next transition

	} while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}


/*	Get next transition with rising edge
*/
function get_next_rising_edge (ch, trSt)
{
	var tr = trSt;
	
	do
	{
		tr = trs_get_next(ch);	// Get the next transition

	} while ((tr.val != RISING) && (trs_is_not_last(ch) == true))

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}


/*
*/
function get_avg_thigh (ch, trSt)
{
	var trE = get_next_rising_edge(ch, trSt);
	var trEPrev = trE;
	trE = get_next_falling_edge(ch, trE);

	return (trE.sample - trEPrev.sample);
}


/* Get time difference in samples between two transitions
*/
function get_trsdiff_samples (tr1, tr2)
{
	return (tr2.sample - tr1.sample);
}

