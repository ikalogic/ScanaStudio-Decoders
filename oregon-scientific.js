
/*
*************************************************************************************
							
				  SCANASTUDIO 2 OREGON SCIENTIFIC PROTOCOL DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Oregon Scientific RF Protocol Decoder.
	This is a decoder of Oregon Scientific protocol used for wireless data transmission between  Oregon's meteo-stations and their sensors. Supported prococol versions: 2.1 and 3.0

</DESCRIPTION>

<RELEASE_NOTES>

	V1.3:  Added Packet/Hex View support.
	V1.25: OS Protocol v2.1 timing values updated.
	V1.20: Bug fixes.
	V1.15: Added logic 1 state convention option.
	V1.1:  Fixed timing values.
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
	return "Oregon Scientific";
}


/* The decoder version 
*/
function get_dec_ver()
{
	return "1.3";
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
	
	ui_add_ch_selector("chD", "OS Data Line", "OS Data");

	ui_add_txt_combo("uiLogic1Conv","Logic 1 state convention");
		ui_add_item_to_txt_combo("Auto", true);
		ui_add_item_to_txt_combo("Transition from 1 to 0");
		ui_add_item_to_txt_combo("Transition from 0 to 1");

	ui_add_txt_combo("uiOffset","Skip first n Transitions");
		ui_add_item_to_txt_combo("None", true);
		ui_add_item_to_txt_combo("1 transition");
		ui_add_item_to_txt_combo("2 transitions");
}


/* Constants
*/
var MANCHOBJECT_TYPE = 
{
	ONE_T     : 0x01,
	TWO_T     : 0x02,
	END_TRANS : 0x04,
	UNKNOWN   : 0x08
};

var OS_PROTOCOL_VER =
{
	V21 		: 0x01,
	V30 		: 0x02,
	UNSUPPORTED : 0x04
};

var OS_PROTOCOL_V21 =
{
	PREAMBLE_BITS 	 : 32,
	PREAMBLE_NIBBLES : 4,
	SYNC_NIBBLE      : 153,
	SYNC_VALUE       : 10,
	SYNC_VALUE_INV   : 5
};

var OS_PROTOCOL_V30 =
{
	PREAMBLE_BITS 	 : 24,
	PREAMBLE_NIBBLES : 6,
	SYNC_NIBBLE      : 10,
	SYNC_VALUE       : 10,
	SYNC_VALUE_INV   : 5
};

var STATE = 
{
	PREAMBLE : 0x01,
	SYNC     : 0x02,
	FAMILY   : 0x04,
	DATA     : 0x08,
	END      : 0x16
};

var LOGIC_1_CONV = 
{
	AUTO         : 0x00,
	ONE_TO_ZERO  : 0x01,
	ZERO_TO_ONE  : 0x02
};


/* Object definitions
*/
function ManchObject (type, value, start, end)
{
	this.type = type;
	this.value = value;
	this.start = start;
	this.end = end;
};

function OSNibble (value, start, end, invalid, isLast)
{
	this.value = value;
	this.start = start;
	this.end = end;
	this.invalid = invalid;
	this.isLast = isLast;
};


/* Global variables
*/
var manchObjArr;
var preambleArr;

var PKT_COLOR_PREAMBLE_TITLE;
var PKT_COLOR_SYNC_TITLE;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_DATA;


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();			// Update the content of all user interface related variables
	clear_dec_items();		// Clears all the the decoder items and its content

	manchObjArr = new Array();

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	if (decode_manchester() != true)
	{
		return false;
	}

	var state = STATE.PREAMBLE;
	var stop = false;
	var protocolVer;
	var nibbleCnt = 0;

	PKT_COLOR_PREAMBLE_TITLE = dark_colors.orange;
	PKT_COLOR_SYNC_TITLE     = dark_colors.green;
	PKT_COLOR_DATA_TITLE     = dark_colors.gray;
	PKT_COLOR_DATA           = get_ch_light_color(chD);

	var pktData;
	var pktDataSt, pktDataEnd;

	while ((stop != true) && (manchObjArr.length > 0))
	{
		switch (state)
		{
			case STATE.PREAMBLE:

					protocolVer = get_preamble();

					if (protocolVer == OS_PROTOCOL_VER.UNSUPPORTED)
					{
						add_to_err_log("Error 0x03. Unsupported protocol version");
						return false;
					}
					else if (protocolVer == false)
					{
						state = STATE.END;
						break;
					}

					pkt_start("Oregon");
					pktData = "";
					pktDataSt = false;
					pktDataEnd = false;

					var obj = preambleArr.shift();

					if (protocolVer == OS_PROTOCOL_VER.V21)
					{
						if (obj.value =! 1)		// Preamble must start by a 0, so skip first 1 value if necessary
						{
							preambleArr.unshift(obj);
						}

						dec_item_new(chD, preambleArr[0].start, preambleArr[preambleArr.length - 1].end);
						dec_item_add_post_text("OS PROTOCOL V2.1 PREAMBLE (0x0F 0x0F 0x0F 0x0F)");
						dec_item_add_post_text("OS V2.1 PREAMBLE");
						dec_item_add_post_text("PREAMBLE");
						dec_item_add_post_text("P");

						pkt_add_item(-1, -1, "PREAMBLE", "PROTOCOL V2.1", PKT_COLOR_PREAMBLE_TITLE, PKT_COLOR_DATA, true);

						while (preambleArr.length > 0)
						{
							var obj = preambleArr.shift();
							var midSample = obj.start;
							dec_item_add_sample_point(chD, midSample, obj.value ? DRAW_1 : DRAW_POINT);
						}
					}
					else if (protocolVer == OS_PROTOCOL_VER.V30)
					{
						dec_item_new(chD, preambleArr[0].start, preambleArr[preambleArr.length - 1].end);
						dec_item_add_post_text("OS PROTOCOL V3.0 PREAMBLE (0x0F 0x0F 0x0F 0x0F 0x0F 0x0F)");
						dec_item_add_post_text("OS V3.0 PREAMBLE");
						dec_item_add_post_text("PREAMBLE");
						dec_item_add_post_text("P");

						pkt_add_item(-1, -1, "PREAMBLE", "PROTOCOL V3.0", PKT_COLOR_PREAMBLE_TITLE, PKT_COLOR_DATA, true);

						while (preambleArr.length > 0)
						{
							var obj = preambleArr.shift();
							var midSample = obj.start;
							dec_item_add_sample_point(chD, midSample, obj.value ? DRAW_1 : DRAW_0);
						}
					}

					state = STATE.SYNC;

			break;

			case STATE.SYNC:

					var nibble;
					var syncOk = true;

					if (protocolVer == OS_PROTOCOL_VER.V21)
					{
						nibble = get_nibble_os_v21();
						dec_item_new(chD, nibble.start, nibble.end);

						if (nibble.value == OS_PROTOCOL_V21.SYNC_VALUE)
						{
							dec_item_add_pre_text("SYNC (");
						}
						else if (nibble.value == OS_PROTOCOL_V21.SYNC_VALUE_INV)
						{
							if (uiLogic1Conv == LOGIC_1_CONV.AUTO)
							{
								uiLogic1Conv = LOGIC_1_CONV.ZERO_TO_ONE;
								nibble.value = OS_PROTOCOL_V21.SYNC_VALUE;
								dec_item_add_pre_text("SYNC (");
							}
							else
							{
								dec_item_add_pre_text("INVALID SYNC (");
								syncOk = false;
							}
						}
						else
						{
							dec_item_add_pre_text("INVALID SYNC (");
							syncOk = false;
						}

						dec_item_add_post_text(")");
						dec_item_add_data(nibble.value);
					}
					else if (protocolVer == OS_PROTOCOL_VER.V30)
					{
						nibble = get_nibble_os_v30();
						dec_item_new(chD, nibble.start, nibble.end);

						if (nibble.value == OS_PROTOCOL_V30.SYNC_VALUE)
						{
							dec_item_add_pre_text("SYNC (");
						}
						else if (nibble.value == OS_PROTOCOL_V30.SYNC_VALUE_INV)
						{
							if (uiLogic1Conv == LOGIC_1_CONV.AUTO)
							{
								uiLogic1Conv = LOGIC_1_CONV.ZERO_TO_ONE;
								nibble.value = OS_PROTOCOL_V30.SYNC_VALUE;
								dec_item_add_pre_text("SYNC (");
							}
							else
							{
								dec_item_add_pre_text("INVALID SYNC (");
								syncOk = false;
							}
						}
						else
						{
							dec_item_add_pre_text("INVALID SYNC (");
							syncOk = false;
						}

						dec_item_add_post_text(")");
						dec_item_add_data(nibble.value);
					}

					var syncStatus;

					if (syncOk)
					{
						syncStatus = "OK (" + int_to_str_hex(nibble.value) + ")";
					}
					else
					{
						syncStatus = "INVALID SYNC";
					}

					pkt_add_item(-1, -1, "SYNC", syncStatus, PKT_COLOR_SYNC_TITLE, PKT_COLOR_DATA, true);

					state = STATE.DATA;
			break;

			case STATE.DATA:

					var nibble;
					var validOk = true;
					var data;

					if (protocolVer == OS_PROTOCOL_VER.V21)
					{
						nibble = get_nibble_os_v21();
					}
					else if (protocolVer == OS_PROTOCOL_VER.V30)
					{
						nibble = get_nibble_os_v30();
					}

					if (nibble.isLast != true)
					{
						dec_item_new(chD, nibble.start, nibble.end);

						if (nibble.invalid != true)
						{
							dec_item_add_data(nibble.value);
						}
						else
						{
							dec_item_add_pre_text("INVALID VALUE");
							dec_item_add_pre_text("INVALID");
							validOk = false;
						}

						if (validOk)
						{
							pktData += int_to_str_hex(nibble.value) + " ";
							nibbleCnt++;
						}
						else
						{
							pkt_add_item(-1, -1, "DATA", "INVALID VALUE", PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
						}

						if (!pktDataSt)
						{
							pktDataSt = nibble.start;
						}

						pktDataEnd = nibble.end;
					}
					else
					{
						// pkt_add_item(pktDataSt, pktDataEnd, "DATA", pktData, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
						add_pkt_data(pktDataSt, pktDataEnd, pktData, nibbleCnt);
						pkt_end();
						nibbleCnt = 0;

						state = STATE.PREAMBLE;
					}
			break;

			case STATE.END:

					pkt_end();
					stop = true;
			break;
		}
	}

	return true;
}


/*
*/
function get_nibble_os_v30()
{
	var bitValue;
	var byteValue = 0;
	var isLast = false;
	var invalid = false;
	var byteStart = false 
	var byteEnd;
	var i = 0;

	while ((i < 4) && (manchObjArr.length > 0))
	{
		var obj = manchObjArr.shift();
		var midSample = obj.start;
		
		if (uiLogic1Conv == LOGIC_1_CONV.ONE_TO_ZERO || uiLogic1Conv == LOGIC_1_CONV.AUTO)
		{
			bitValue = obj.value;
		}
		else if (uiLogic1Conv == LOGIC_1_CONV.ZERO_TO_ONE)
		{
			bitValue = obj.value ? 0 : 1;
		}

		if (byteStart == false)
		{
			byteStart = obj.start;
		}

		byteEnd = obj.end;

		if (obj.type == MANCHOBJECT_TYPE.END_TRANS)			// End of frame
		{
			manchObjArr.unshift(obj);

			if (i < 3)
			{
				invalid = true;
			}

			isLast = true;
			break;
		}
		else if (obj.type == MANCHOBJECT_TYPE.UNKNOWN)		// Unknown value
		{
			invalid = true;
			dec_item_add_sample_point(chD, midSample, DRAW_CROSS);
		}
		else
		{
			byteValue >>= 1;

			if (bitValue == 1)
			{
				byteValue |= 0x80;
			}

			dec_item_add_sample_point(chD, midSample, bitValue ? DRAW_1 : DRAW_0);
		}

		i++;
	}

	hex_add_byte(chD, byteStart, byteEnd, byteValue);

	return new OSNibble(byteValue, byteStart, byteEnd, invalid, isLast);
}


/*
*/
function get_nibble_os_v21()
{
	var bitValue;
	var byteValue = 0;
	var isLast = false;
	var invalid = false;
	var byteStart = false 
	var byteEnd;
	var i = 0;

	while ((i < 8) && (manchObjArr.length > 0))
	{
		var obj = manchObjArr.shift();
		var midSample = obj.start;

		if (uiLogic1Conv == LOGIC_1_CONV.ONE_TO_ZERO || uiLogic1Conv == LOGIC_1_CONV.AUTO)
		{
			bitValue = obj.value;
		}
		else if (uiLogic1Conv == LOGIC_1_CONV.ZERO_TO_ONE)
		{
			bitValue = obj.value ? 0 : 1;
		}

		if (byteStart == false)
		{
			byteStart = obj.start;
		}

		byteEnd = obj.end;

		if (obj.type == MANCHOBJECT_TYPE.END_TRANS)			// End of frame
		{
			manchObjArr.unshift(obj);

			if (i < 7)
			{
				invalid = true;
			}

			isLast = true;
			break;
		}
		else if (obj.type == MANCHOBJECT_TYPE.UNKNOWN)		// Unknown value
		{
			invalid = true;
			dec_item_add_sample_point(chD, midSample, DRAW_CROSS);
		}
		else
		{
			if (i % 2 > 0)			// Only for odd bits, even bits are just inverted copy
			{
				byteValue >>= 1;

				if (bitValue == 1)
				{
					byteValue |= 0x80;
				}
			}

			if (i % 2 > 0)
			{
				dec_item_add_sample_point(chD, midSample, bitValue ? DRAW_1 : DRAW_0);
			}
			else
			{
				dec_item_add_sample_point(chD, midSample, DRAW_POINT);
			}
		}

		i++;
	}

	byteValue >>= 4;	// Ignore first nibble

	hex_add_byte(chD, byteStart, byteEnd, byteValue);

	return new OSNibble(byteValue, byteStart, byteEnd, invalid, isLast);
}


/* Get preamble and find right protocol version
*/
function get_preamble()
{
	preambleArr = new Array();
	
	var protocolVer = false;
	var preambleDetected;
	var preambleLen = 0;
	var bit, lastBit;

	do 		// Skip all invalid start transitions
	{
		if (manchObjArr.length < 1)
		{
			return false;
		}

		var obj = manchObjArr.shift();
		bit = obj.value;

	} while (bit == false);

	preambleArr.push(obj);

	while ((preambleDetected != true) && (manchObjArr.length > 0))		// Search for preamble field length
	{
		var obj = manchObjArr.shift();
		preambleArr.push(obj);

		lastBit = bit;
		bit = obj.value;

		preambleLen++;

		if (lastBit == bit)
		{
			manchObjArr.unshift(obj);
			preambleArr.pop();
			preambleDetected = true;
		}
	}

	if (manchObjArr.length < 2 || preambleArr.length < OS_PROTOCOL_V30.PREAMBLE_BITS)
	{
		add_to_err_log("Error 0x02. Selected channel doesn't have any valid Oregon Scientific encoded signal or this protocol version is not supported");
		return false;
	}

	if ((preambleArr.length >= OS_PROTOCOL_V30.PREAMBLE_BITS - 1) && (preambleArr.length <= OS_PROTOCOL_V30.PREAMBLE_BITS + 1))
	{
		protocolVer = OS_PROTOCOL_VER.V30;
	}
	else if ((preambleArr.length >= OS_PROTOCOL_V21.PREAMBLE_BITS - 1) && (preambleArr.length <= OS_PROTOCOL_V21.PREAMBLE_BITS + 1))
	{
		protocolVer = OS_PROTOCOL_VER.V21;
	}
	else
	{
		protocolVer = OS_PROTOCOL_VER.UNSUPPORTED;
	}

	return protocolVer;
}


/*
*/
function decode_manchester()
{
	if (sync() != true)
	{
		return false;
	}

	var tempArr = new Array();

	var trD = trs_get_first(chD);
	trD = set_offset(chD, trD);
	var trDPrev;

	var tMax1TTolerance = get_max_tolerance(oneT);
	var tMax2TTolerance = get_max_tolerance(twoT);
	var bitValue = 0;

	while (trs_is_not_last(chD) != false)				// Read data for a whole transfer
	{
		if (abort_requested() == true)					// Allow the user to abort this script
		{
			return false;
		}

		set_progress(100 * trD.sample / n_samples);		// Give feedback to ScanaStudio about decoding progress

		trDPrev = trD;
		trD = trs_get_next(chD);
		var tDiff = trD.sample - trDPrev.sample;

		bitValue = trD.val;

		if (tDiff >= (twoT - tMax2TTolerance) && (tDiff <= (twoT + tMax2TTolerance)))		    	// 2T
		{
			tempArr.push(new ManchObject(MANCHOBJECT_TYPE.TWO_T, bitValue, trDPrev.sample, trD.sample));
		}
		else if ((tDiff >= oneT - tMax1TTolerance) && (tDiff <= oneT + tMax1TTolerance))			// 1T
		{
			tempArr.push(new ManchObject(MANCHOBJECT_TYPE.ONE_T, bitValue, trDPrev.sample, trD.sample));
		}
		else if (tDiff >= (twoT * 2))
		{
			tempArr.push(new ManchObject(MANCHOBJECT_TYPE.END_TRANS, false, trDPrev.sample, trD.sample));
		}
		else if (tDiff < (oneT / 10))
		{
			// SKIP
		}
		else
		{
			tempArr.push(new ManchObject(MANCHOBJECT_TYPE.UNKNOWN, false, trDPrev.sample, trD.sample));
		}
	}

	while (tempArr.length > 0)
	{
		var tempObject = tempArr.shift();

		if (tempObject.type == MANCHOBJECT_TYPE.ONE_T)
		{
			var nextObject = tempArr.shift();

			if (nextObject.type != MANCHOBJECT_TYPE.ONE_T)
			{
				tempArr.unshift(nextObject);
			}
		}
		else if (tempObject.type == MANCHOBJECT_TYPE.TWO_T)
		{
			var nextObject = tempArr.shift();

			if (nextObject.type != MANCHOBJECT_TYPE.ONE_T)
			{
				tempArr.unshift(nextObject);
			}
		}

		manchObjArr.push(tempObject);
	}

	return true;
}


/*
*/
function sync()
{
	var trD = trs_get_first(chD);
	trD = set_offset(chD, trD);
	var trDPrev = trD;

	oneT = 0;
	twoT = 0;

	var syncDone = false;

	while ((syncDone != true) && (trs_is_not_last(chD) != false))	// Sync with the signal. Find 1T and 2T pulses
	{
		trDPrev = trD;
		trD = trs_get_next(chD);
		var t1 = trD.sample - trDPrev.sample;

		trDPrev = trD;
		trD = trs_get_next(chD);
		var t2 = trD.sample - trDPrev.sample;

		if((t2 >= (t1 * 2) - get_max_tolerance(t1 * 2)) && (t2 <= (t1 * 2) + get_max_tolerance(t1 * 2)))
		{
			oneT = t1;
			twoT = t2;
			syncDone = true;
		}
		else if ((t1 >= (t2 * 2) - get_max_tolerance(t2 * 2)) && (t1 <= (t2 * 2) + get_max_tolerance(t2 * 2)))
		{
			oneT = t2;
			twoT = t1;
			syncDone = true;
		}
	}

	if (trs_is_not_last(chD) == false)					// No 1T / 2T pulses - exit
	{
		add_to_err_log("Error 0x01. Selected channel doesn't have any valid Oregon Scientific encoded signal");
		return false;
	}

	return true;
}


/*
*/
function add_pkt_data (start, end, str, strLen)
{
	var pktDataPerLine = 10;

	if (strLen > pktDataPerLine)
	{
		var strArr = str.split(" ", pktDataPerLine);
		var strTemp = strArr.toString();
		strTemp = strTemp.replace(/,/g, " ");
		strTemp += " ...";

		pkt_add_item(start, end, "DATA", strTemp, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);

		strArr = str.split(" ");

		for (var i = pktDataPerLine - 1; i < strArr.length; i += pktDataPerLine)
		{
			strArr[i] += "\n";
		}

		strTemp = strArr.toString();
		strTemp = strTemp.replace(/,/g, " ");

		pkt_start("DATA");
		pkt_add_item(start, end, "DATA", strTemp, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		pkt_end();

	}
	else
	{
		pkt_add_item(start, end, "DATA", str, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
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
function get_max_tolerance (value)
{
	return ((value / 100) * 40);		// 35% of tolerance
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
		}
	}

	return tr;
}




