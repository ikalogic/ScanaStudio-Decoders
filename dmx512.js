
/*
*************************************************************************************

						 SCANASTUDIO 2 DMX-512 DECODER

The following commented block allows some related information to be displayed online

<DESCRIPTION>

	DMX-512 Protocol Decoder.
	A standart decoder of unidirectional DMX-512 differential interface commonly used to control stage lighting and effects. 

</DESCRIPTION>

<RELEASE_NOTES>

	V1.10: Reworked PacketView.
	V1.08: New Packet View layout.
	V1.07: Decoding bytes after Start Code fixed. Thanks to Paul Hughes.
	V1.06: Now the decoding can be aborted
	V1.05: Fixed several timings related bugs.
	V1.00: First release.

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

/* The decoder name as it will appear to the users of this script
*/
function get_dec_name()
{
	return "DMX-512"; 
}


/* The decoder version
*/
function get_dec_ver()
{
	return "1.10";
}


/* Author
*/
function get_dec_auth()
{
	return "IKALOGIC, PRH";
}


/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
	ui_add_ch_selector("ch", "Channel to decode", "DMX-512");

	ui_add_separator();
	ui_add_info_label("Packet View options:", 1);

	ui_add_txt_combo("packetViewOpt", "Show in Packet View:");
		ui_add_item_to_txt_combo("Data value only", 1);
		ui_add_item_to_txt_combo("Data index and value", 0);
}

/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/

var DMXOBJECT_TYPE =
{
	BREAK : 0x01,
	MAB   : 0x02,
	BYTE  : 0x03
};

var ERR_CODES = 
{
	OK         : 0x01,
	NO_SIGNAL  : 0x02,
	ERR_SIGNAL : 0x04
};

var DMX_DELAY = 
{
	BREAK_MIN       : 88,
	AFTER_BREAK_MIN : 8,
	AFTER_BREAK_MAX : 1000000,
	BIT_MIN         : 3.5,
	BIT_MAX         : 4.5,
	BYTE_MAX        : 44,
	FRAME_MIN       : 1204,
	FRAME_MAX       : 1000000,
	INTER_FRAME     : 1000000
};

function DmxObject (type, value, info, start, end, count)
{
	this.type = type;
	this.value = value;
	this.info = info;
	this.start = start;
	this.end = end;
	this.count = count;
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

var DMX512_PACKET_SIZE = 512;
var DMX512_BAUD_RATE = 250000;

var PKT_COLOR_DATA;
var PKT_COLOR_INVALID;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_MAB_TITLE;
var PKT_COLOR_BREAK_TITLE;
var PKT_COLOR_START_TITLE;

var dmxObjectsArr, breakObjectsArr, mabObjectsArr;
var pktObjects;

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/*
*/
function decode()
{
	if (!util_check_scanastudio_support)
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return false;
    }

	get_ui_vals();		  // Update the content of all user interface related variables
	clear_dec_items();	  // Clears all the the decoder items and its content

	PKT_COLOR_DATA        = util_get_ch_color(ch);
	PKT_COLOR_INVALID     = dark_colors.red;
	PKT_COLOR_DATA_TITLE  = dark_colors.gray;
	PKT_COLOR_MAB_TITLE   = dark_colors.yellow;
	PKT_COLOR_BREAK_TITLE = dark_colors.orange;
	PKT_COLOR_START_TITLE = dark_colors.green;

	var errSig = test_signal();

	if (errSig == ERR_CODES.ERR_SIGNAL)
	{
		add_to_err_log("Error. Selected channel doesn't have any valid dmx signal");
		return false;
	}
	else if (errSig == ERR_CODES.NO_SIGNAL)
	{
		return false;
	}

	var dmxObj = 0;
	var dmxObjCnt = 0;
	var pktOk = true;
	var pktObj = new PktObject();

	pktObj.title = "DATA";
	pktObj.data = "";
	pktObj.titleColor = PKT_COLOR_DATA_TITLE;
	pktObj.dataColor = PKT_COLOR_DATA;
	pktObj.dataObjArr = [];
	pktObj.start = false;
	pktObj.dataLen = 0;

	dmxObjectsArr   = [];
	breakObjectsArr = [];
	mabObjectsArr   = [];
	pktObjects      = [];

	decode_signal();

	while (dmxObjectsArr.length > dmxObjCnt)
	{
	    if (abort_requested() == true)	// Allow the user to abort this script
		{
			return false;
		}

		if (abort_requested())
		{
			return false;
		}

		dmxObj = dmxObjectsArr[dmxObjCnt];
		dmxObjCnt++;

		switch (dmxObj.type)
		{
			case DMXOBJECT_TYPE.BREAK:

					dec_item_new(ch, dmxObj.start, dmxObj.end);
					dec_item_add_pre_text("BREAK");
					dec_item_add_pre_text("BR");
					dec_item_add_comment("BREAK");

					if (pktObj.dataLen > 0)
					{
						pktObjects.push(pktObj);
						pkt_add_packet(pktOk);
						pktOk = true;
						
						pktObj.dataObjArr = [];
						pktObj.data = "";
						pktObj.start = false;
						pktObj.dataLen = 0;
					}

					pktObjects.push(new PktObject("BREAK", PKT_COLOR_BREAK_TITLE, "", 0, 0, PKT_COLOR_DATA, dmxObj.start, dmxObj.end));
			break;

			case DMXOBJECT_TYPE.MAB:

					dec_item_new(ch, dmxObj.start, dmxObj.end);
					dec_item_add_pre_text("MARK AFTER BREAK");
					dec_item_add_pre_text("MAB");
					dec_item_add_comment("MARK AFTER BREAK");

					pktObjects.push(new PktObject("MAB", PKT_COLOR_MAB_TITLE, "", 0, 0, PKT_COLOR_DATA, dmxObj.start, dmxObj.end));
			break;

			case DMXOBJECT_TYPE.BYTE:

					dec_item_new(ch, dmxObj.start, dmxObj.end);
					hex_add_byte(ch, -1, -1, dmxObj.value);
					dec_item_add_data(dmxObj.value);

					var dataColor;

					if (dmxObj.info.length > 0)
					{
						dataColor = PKT_COLOR_INVALID;
						pktOk = false;
					}
					else
					{
						dataColor = PKT_COLOR_DATA;
					}

					if (dmxObj.count < 1)
					{
						dec_item_add_comment("START CODE");
						dec_item_add_pre_text("START CODE: ");
						dec_item_add_pre_text("SC:");
						dec_item_add_post_text(" " + dmxObj.info);

						if (pktObj.dataLen > 0)
						{
							pktObjects.push(pktObj);
						}

						pktObjects.push(new PktObject("START CODE", PKT_COLOR_START_TITLE, "" + util_dec2hex(dmxObj.value), 0, 0, dataColor, dmxObj.start, dmxObj.end));
					}
					else
					{
						dec_item_add_comment("DATA " + dmxObj.count);
						dec_item_add_pre_text("DATA " + dmxObj.count + ": ");
						dec_item_add_pre_text("D" + dmxObj.count + ":");
						dec_item_add_post_text(" " + dmxObj.info);

						if (packetViewOpt > 0)
						{
							var temp = dmxObj.count + " : " + util_dec2hex(dmxObj.value);
							dmxObj.value = temp;
						}
						else
						{
							dmxObj.value = util_dec2hex(dmxObj.value);
						}

						pktObj.data += dmxObj.value + " ";
						pktObj.dataObjArr.push(dmxObj);
						pktObj.dataLen++;

						if (!pktObj.start)
						{
							pktObj.start = dmxObj.start;
						}

						pktObj.end = dmxObj.end;
					}
			break;
		}
	}

	if (pktObj.dataLen > 0)
	{
		pktObjects.push(pktObj);
		pkt_add_packet(pktOk);
	}
}

/*
*/
function decode_signal()
{
	var bitStep = (sample_rate / DMX512_BAUD_RATE);
	var byteCnt, breakStart, endOfFrame, breakObj;

	if (!find_all_breaks(DMX_DELAY.BREAK_MIN))				// Get all BREAK fields on channel
	{
		return false;
	}

	var tr = trs_get_first(ch);

	if (breakObjectsArr.length > 0)
	{
		breakObj = breakObjectsArr.shift();					// Get first BREAK
		breakStart = breakObj.start;
		dmxObjectsArr.push(breakObj);
		dmxObjectsArr.push(mabObjectsArr.shift());
		tr = trs_go_after(ch, breakObj.start);				// Set position just before first BREAK
	}														// If there is no BREAK's at all -> try to decode something we can

	while (trs_is_not_last(ch) != false)					// For all transitions on this channel
	{
		if (abort_requested())
		{
			return false;
		}

		set_progress(100 * tr.sample / n_samples);	 		// Give feedback to ScanaStudio about decoding progress

		if (breakObjectsArr.length > 0)
		{
			breakObj = breakObjectsArr.shift();				// Get next BREAK condition - this will be an end of current frame
			breakStart = breakObj.start;
			endOfFrame = breakStart;
		}
		else
		{
			dmxObjectsArr.push(breakObj);
			if (mabObjectsArr.length > 0) dmxObjectsArr.push(mabObjectsArr.shift());
			endOfFrame = n_samples - 1;
		}

		byteCnt = 0;

		while (byteCnt < (DMX512_PACKET_SIZE + 1))			// 512 data bytes + 1 START CODE
		{
			tr = util_get_next_falling(ch, tr);				// Skip the delay after BREAK and reach the very first start bit
			var byteStart = tr.sample;

			var bit, dataByte = 0;
			var midSample = tr.sample + (bitStep / 2);
			var byteInfo = "";

			for (var i = 0; i < 11; i++)
			{
				bit = sample_val(ch, midSample);

				if (i < 1)									// Start bit
				{
					dec_item_add_sample_point(ch, midSample, DRAW_POINT);
				}

				if (i > 8) 									// Stop bits
				{
					dec_item_add_sample_point(ch, midSample, bit ? DRAW_POINT : DRAW_CROSS);
					if (bit != 1) byteInfo = " STOP BIT(S) MISSING";
				}

				if (i > 0 && i < 9)
				{
					dec_item_add_sample_point(ch, midSample, bit ? DRAW_1 : DRAW_0);

					if (bit)
					{
						dataByte |= (1 << (i - 1));			// Store all 8 data bits
					}
				}

				midSample += bitStep;
			}

			var byteEnd = byteStart + (bitStep * 11);
			dmxObjectsArr.push(new DmxObject(DMXOBJECT_TYPE.BYTE, dataByte, byteInfo, byteStart, byteEnd, byteCnt));
			byteCnt++;

			tr = trs_go_after(ch, tr.sample + (bitStep * 11) - (bitStep / 2));		// Go to next byte	

			if (tr.sample >= endOfFrame)											// if we've reached the end of frame before 512 + 1 bytes -> stop
			{
				if (tr.sample < n_samples - 1)
				{
					tr = trs_go_after(ch, endOfFrame);								// Go to start of next BREAK
					break;
				}
			}

			if (trs_is_not_last(ch) != true)
			{
				return false;
			}
		}

		if (breakObjectsArr.length > 0)
		{
			dmxObjectsArr.push(breakObj);
			if (mabObjectsArr.length > 0) dmxObjectsArr.push(mabObjectsArr.shift());
		}
	}

	return true;
}

/*
*/
function find_all_breaks (break_duration)
{
	var found_breaks = false;
	var tr = trs_get_first(ch);

	while (trs_is_not_last(ch) != false)				// For all transitons on this channel
	{
		tr = util_get_next_falling(ch, tr);				// Find start of BREAK field first
		var breakStart = tr;

		if (trs_is_not_last(ch) != true) 
		{
			return found_breaks;
		}

		tr = util_get_next_rising(ch, tr);

		var breakEnd = tr;
		var breakDuration = util_get_diff_us(breakStart.sample, breakEnd.sample);

		if (breakDuration >= break_duration)			// A valid BREAK condition must be a low 88-200us pulse
		{
			if ((breakStart.sample < n_samples - 1) && (breakEnd.sample < n_samples - 1))
			{
				breakObjectsArr.push(new DmxObject(DMXOBJECT_TYPE.BREAK, true, "", breakStart.sample, breakEnd.sample, 0));

				tr = util_get_next_falling(ch, tr);		// End of Mark After Break
				mabObjectsArr.push(new DmxObject(DMXOBJECT_TYPE.MAB, true, "", breakEnd.sample, tr.sample, 0));
				
				found_breaks = true;
			}
		}
	}

	return found_breaks;
}

/*
*/
function test_signal()
{
	return ERR_CODES.OK;
}

/*
*************************************************************************************	
									   UTILS
/************************************************************************************
*/	

/*
*/
function pkt_add_packet (ok)
{
	var obj;
	var desc = "";
	var objCnt = 0;
	var pktDataPerLine = 8;

	if (packetViewOpt > 0)
	{
		pktDataPerLine = 0;
	}

	if (pktObjects.length < 1)
	{
		return;
	}

	for (var i = 0; i < pktObjects.length; i++)
	{
		obj = pktObjects[i];

		if (obj.title.localeCompare("START CODE") == 0) 
		{
			desc += "START " + obj.data;
		}

		if (obj.title.localeCompare("DATA") == 0)
		{
			desc += " DATA[" + obj.dataLen + "]";
		}
	}

	var pktStart = pktObjects[0].start;
	var pktEnd = pktObjects[pktObjects.length - 1].end;

	pkt_start("DMX-512");

	if (ok)
	{
		pkt_add_item(pktStart, pktEnd, "DMX-512 FRAME", desc, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA);
	}
	else
	{
		pkt_add_item(pktStart, pktEnd, "DMX-512 FRAME", desc, PKT_COLOR_INVALID, PKT_COLOR_DATA);
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
					if (lineCnt < pktDataPerLine)
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
						pkt_add_item(lineStart, lineEnd, obj.title, dataLine, obj.titleColor, obj.dataColor);
						lineStart = false;
						dataLine = "";
						lineCnt = 0;
					}
				}

				if (lineCnt > 0)
				{
					pkt_add_item(lineStart, lineEnd, obj.title, dataLine, obj.titleColor, obj.dataColor);
				}
			}
			else
			{
				pkt_add_item(obj.start, obj.end, obj.title, obj.data, obj.titleColor, obj.dataColor);
			}
		}
		else if (obj.title.localeCompare("START CODE") == 0)
		{
			pkt_add_item(obj.start, obj.end, obj.title, obj.data, obj.titleColor, obj.dataColor);
		}
	}

	pkt_end();
	pkt_end();

	pktObjects.length = 0;
	pktObjects = [];
}

/*
*/
function util_check_scanastudio_support()
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

/* Decimal integer to hexadecimal string
*/
function util_dec2hex (num) 
{
	var temp = "";

	if (num < 0x10)
	{
		temp += "0";
	}

	temp += num.toString(16).toUpperCase();

	return temp;
}

/* Get channel color
*/
function util_get_ch_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
	chColor.g = (chColor.g * 1 + 255 * 3) / 4;
	chColor.b = (chColor.b * 1 + 255 * 3) / 4;

	return chColor;
}

/* Get time difference in microseconds between two transitions
*/
function util_get_diff_us (tr1, tr2)
{
	return (((tr2 - tr1) * 1000000) / sample_rate);
}

/*  Get number of samples for the specified duration in microseconds
*/
function util_get_sample_us (us)
{
	return ((us * sample_rate) / 1000000);
}

/*	Get transition of next falling edge
*/
function util_get_next_falling (ch, trStart)
{
	var tr = trStart;
	
	while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);	// Get the next transition
	}

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}

/*	Get transition of next rising edge
*/
function util_get_next_rising (ch, trStart)
{
	var tr = trStart;
	
	while ((tr.val != RISING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);	// Get the next transition
	}

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}
