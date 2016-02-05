/*
*************************************************************************************
						
							SCANASTUDIO 2 LIN DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

    LIN Protocol Decoder.
	This is a standard Local Interconnect Network bus decoder supporting 1.x and 2.x
	protocol versions

</DESCRIPTION>

<RELEASE_NOTES>

	V1.31: Fixed bug with first BREAK field detection.
	       Added ScanaStudio 2.3xx compatibility.
		   New Packet View layout.
	V1.30: Added decoder trigger & demo signal builder
	V1.27: Added LIN WakeUp conditions and baudrate detection.
	V1.25: Added signal noise handling. Added automatic LIN protocol version detection.
	V1.22: Variable frame length bug fixed.
    V1.2:  New BREAK & SYNC validation algorithm. Some minor fixes.
    V1.15: Added Packet/Hex View support.
	V1.1:  Timing calculation fix. Stability improvements.
	V1.0:  Initial release.
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
	return "LIN"; 
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

var ERR_CODES = 
{
	OK         : 0x01,
	NO_SIGNAL  : 0x02,
	ERR_SIGNAL : 0x04,
	BRK_SHORT  : 0x08
};

var LIN_SPEC = 
{
	LIN_1X : 0x00,
	LIN_2X : 0x01
};

var LINOBJECT_TYPE = 
{
	BREAK : 0x01,
	SYNC  : 0x02,
	START : 0x04,
	STOP  : 0x08,
	BYTE  : 0x10,
	WAKE  : 0x20
};

var ID_FIELD_MASK =
{
	PARITY   : 0xC0,
	PARITY_0 : 0x40,
	PARITY_1 : 0x80,
	ID       : 0x3F
};

var FRAME_ID = 
{
	CONFIG_0   : 0x3C,
	CONFIG_1   : 0x3D,
	RESERVED_0 : 0x3E,
	RESERVED_1 : 0x3F
};

var HEXVIEW_OPT = 
{
	DATA    : 0x00,
	DATA_ID : 0x01,
	ALL     : 0x02
};

var START_BIT           = 0x00;
var STOP_BIT            = 0x01;
var T_WAKEUP_MIN        = 250;
var T_WAKEUP_MAX        = 5000;
var T_MAX_BETWEEN_BYTES = 25;	
var T_MIN_BREAK_BITS    = 10;
var BIT_RATE_TOLERANCE  = 14;		// in % before synchronization
var SYNC_FIELD_VALUE    = 0x55;
var MAX_DATA_LENGTH     = 0x08;
var GOTO_SLEEP_CMD      = 0x00;
var LIN_MAX_FREQ_KHZ    = 50;
var LIN_MAX_FREQ_HZ     = (LIN_MAX_FREQ_KHZ * 1000);
var LIN_MIN_T           = (1 / LIN_MAX_FREQ_HZ);

function LinObject (type, value, start, end)
{
	this.type = type;
	this.value = value;
	this.start = start;
	this.end = end;
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

var linObjectsArr;
var pktObjects;

var nData = 8;
var tBit, tBfs, tEbs, tLbs, tBs;
var tHeaderNom, tRespNom, tFrameNom;
var tSyncDelimMax, tHeaderMax, tRespMax, tFrameMax;

var PKT_COLOR_DATA;
var PKT_COLOR_INVALID;
var PKT_COLOR_WAKE_TITLE;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_BREAK_TITLE;
var PKT_COLOR_SYNC_TITLE;
var PKT_COLOR_ID_TITLE;
var PKT_COLOR_CHECK_TITLE;

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();		// clean up the User interface before drawing a new one.
	ui_add_ch_selector("chLin", "LIN", "LIN");

	ui_add_info_label("<br>");
	ui_add_separator();
	ui_add_info_label("<br><b>Hex view options:</b>");

	ui_add_txt_combo("hexView", "Include in HEX view:");
	ui_add_item_to_txt_combo("DATA fields only", true);
	ui_add_item_to_txt_combo("DATA and ID fields only", false);
	ui_add_item_to_txt_combo("Everything", false);
}


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();			// Update the content of all user interface related variables
	clear_dec_items();		// Clears all the the decoder items and its content

	PKT_COLOR_DATA        = get_ch_light_color(chLin);
	PKT_COLOR_INVALID     = dark_colors.red;
	PKT_COLOR_WAKE_TITLE  = dark_colors.yellow;
	PKT_COLOR_DATA_TITLE  = dark_colors.gray;
	PKT_COLOR_BREAK_TITLE = dark_colors.orange;
	PKT_COLOR_SYNC_TITLE  = dark_colors.violet;
	PKT_COLOR_ID_TITLE    = dark_colors.green;
	PKT_COLOR_CHECK_TITLE = dark_colors.blue;

	pktObjects = [];

	var pktOk = true;
	var errSig = test_signal();

	if (errSig == ERR_CODES.ERR_SIGNAL)
	{
		add_to_err_log("Error. Selected channel doesn't have any valid LIN signal");
		return false;
	}
	else if (errSig == ERR_CODES.NO_SIGNAL)
	{
		return false;
	}

	decode_signal();

	while (linObjectsArr.length > 0)
	{
		if (abort_requested())
		{
			return false;
		}

		linObject = linObjectsArr.shift();
		dec_item_new(chLin, linObject.start, linObject.end);

		switch (linObject.type)
		{
			case LINOBJECT_TYPE.BREAK:
			
					if (pktObjects.length > 0)
					{
						pkt_add_packet(pktOk);
					}

					if (linObject.value != false)
					{
						dec_item_add_pre_text("BREAK");
						dec_item_add_pre_text("BR");
						dec_item_add_comment("BREAK");

						pktObjects.push(new PktObject("BREAK", PKT_COLOR_BREAK_TITLE, "", 0, 0, PKT_COLOR_DATA, linObject.start, linObject.end));
					}
					else
					{
						dec_item_add_pre_text("INVALID BREAK");
						dec_item_add_pre_text("BAD BR");
						dec_item_add_comment("INVALID BREAK");

						pktObjects.push(new PktObject("INVALID BREAK", PKT_COLOR_INVALID, "", 0, 0, PKT_COLOR_DATA, linObject.start, linObject.end));
						pktOk = false;
					}
			break;

			case LINOBJECT_TYPE.WAKE:

					dec_item_add_pre_text("WAKE UP");
					dec_item_add_pre_text("WAKE");
					dec_item_add_pre_text("W");
					dec_item_add_comment("WAKE UP");

					pktObjects.push(new PktObject("WAKE UP", PKT_COLOR_WAKE_TITLE, "", 0, 0, PKT_COLOR_DATA, linObject.start, linObject.end));
					pkt_add_packet(true);
					pktOk = true;
			break;

			case LINOBJECT_TYPE.SYNC:

					if (linObject.value != false)
					{
						var baudrateStr = linObject.value.toString(10) + " Kbps";

						dec_item_add_pre_text("SYNC " + "(" + baudrateStr + ")");
						dec_item_add_pre_text("SYNC");
						dec_item_add_pre_text("SY");
						dec_item_add_comment("SYNC");

						pktObjects.push(new PktObject("SYNC", PKT_COLOR_SYNC_TITLE, baudrateStr, 0, 0, PKT_COLOR_DATA, linObject.start, linObject.end));
					}
					else
					{
						dec_item_add_pre_text("INVALID SYNC");
						dec_item_add_pre_text("INVALID SYNC");
						dec_item_add_comment("INVALID SYNC");

						pktObjects.push(new PktObject("INVALID SYNC", PKT_COLOR_INVALID, "", 0, 0, PKT_COLOR_DATA, linObject.start, linObject.end));
						pktOk = false;
					}
			break;

			case LINOBJECT_TYPE.BYTE:

					var dataArr = new Array();

					while ((linObject.type == LINOBJECT_TYPE.BYTE) && (linObjectsArr.length > 0))
					{
						if (linObject.type == LINOBJECT_TYPE.BYTE)
						{
							dataArr.push(linObject);		// Store all data for the next cheksum verification
						}
						else
						{
							linObjectsArr.push(linObject);
						}

						linObject = linObjectsArr.shift();
					}

					if (linObjectsArr.length > 0)
					{
						linObjectsArr.unshift(linObject);
					}

					if (dataArr.length < 1)
					{
						if (pktObjects.length > 0)
						{
							pkt_add_packet(false);
						}

						return;
					}

					// Display ID
					var idField = dataArr[0];
					var id = (idField.value & ~ID_FIELD_MASK.PARITY);

					var idCompleteStr = "ID: " + "0x"  + id.toString(16).toUpperCase() + " PARITY: ";
					var parStr;

					// Check and display parity
					var parityOk = check_parity(idField.value);

					if (parityOk == true)
					{
						parStr = "OK";
						idCompleteStr += "OK";
					}
					else
					{
						parStr = "ERR";
						idCompleteStr += "ERR";
						pktOk = false;
					}

					dec_item_add_data(idField.value);
					dec_item_add_post_text(" (" + idCompleteStr + ")");
					dec_item_add_comment(idCompleteStr);

					var pidStart = dataArr[0].start;
					var pidEnd = dataArr[0].end;
					var pidStr = "ID:" + int_to_str_hex(id) + " PARITY:" + parStr;

					pktObjects.push(new PktObject("PID", PKT_COLOR_ID_TITLE, pidStr, 0, int_to_str_hex(id), PKT_COLOR_DATA, pidStart, pidEnd));

					if (hexView != HEXVIEW_OPT.DATA)
					{
						hex_add_byte(chLin, -1, -1, idField.value);
					}

					var pktDataStart = false, pktDataEnd = 0;
					var pktDataStr = "";
					var pktDataCnt = 0;

					// Display normal data
					for (var i = 1; i < (dataArr.length - 1); i++)
					{
						dec_item_new(chLin, dataArr[i].start, dataArr[i].end);
						dec_item_add_data(dataArr[i].value);
						dec_item_add_comment(int_to_str_hex(dataArr[i].value));
						hex_add_byte(chLin, -1, -1, dataArr[i].value);

						pktDataStr += " " + int_to_str_hex(dataArr[i].value);

						if (pktDataStart == false)
						{
							pktDataStart = dataArr[i].start;
						}

						pktDataEnd = dataArr[i].end;
						pktDataCnt++;
					}

					if (dataArr.length > 1)
					{
						var dataPktArr = dataArr;
						pktObjects.push(new PktObject("DATA", PKT_COLOR_DATA_TITLE, pktDataStr.trim(), (dataPktArr.length - 2), dataPktArr, PKT_COLOR_DATA, dataArr[1].start, dataPktArr[dataPktArr.length - 2].end));

						// Check and display Checksum
						var checksum = dataArr[dataArr.length - 1];		// Last byte in the frame is always checksum
						var checkResultStr = int_to_str_hex(checksum.value);
						var checkResult = "";
						var checkStart = dataArr[dataArr.length - 1].start;
						var checkEnd = dataArr[dataArr.length - 1].end;
						var checkOk = true;

						if (compute_checksum(dataArr))
						{
							checkResultStr += "(OK)";
							checkResult += "OK";
						}
						else
						{
							checkResultStr += "(WRONG)";
							checkResult += "WRONG";
							checkOk = false;
							pktOk = false;
						}

						dec_item_new(chLin, checksum.start, checksum.end);
						dec_item_add_pre_text("CHECKSUM ");
						dec_item_add_pre_text("CHK ");
						dec_item_add_data(checksum.value);
						dec_item_add_post_text(" (" + checkResult + ")");
						dec_item_add_comment("CHECKSUM: " + checkResultStr);

						if (checkOk)
						{
							pktObjects.push(new PktObject("CHECKSUM", PKT_COLOR_CHECK_TITLE, checkResultStr, 0, 0, PKT_COLOR_DATA, checkStart, checkEnd));
						}
						else
						{
							pktObjects.push(new PktObject("CHECKSUM", PKT_COLOR_INVALID, checkResultStr, 0, 0, PKT_COLOR_DATA, checkStart, checkEnd));
						}
						
						pkt_add_packet(pktOk);
						pktOk = true

						if (hexView == HEXVIEW_OPT.ALL)
						{
							hex_add_byte(chLin, -1, -1, checksum.value);
						}

						dataArr.length = 0;
					}
			break;
		}
	}

	if (pktObjects.length > 0)
	{
		pkt_add_packet(false);
	}
}


/*
*/
function decode_signal()
{
	linObjectsArr = [];

	var trLin = get_first_break_start();

	while (trs_is_not_last(chLin) != false)				// For all transitons on this channel
	{
	    if (abort_requested())
		{
			return false;
		}

		set_progress(100 * trLin.sample / n_samples);	// Give feedback to ScanaStudio about decoding progress

		var breakFound = false;
		var stBitStart = false;

		while (breakFound != true)
		{
			trLin = get_next_falling_edge(chLin, trLin);	// Find start of BREAK field

			var trLinPrev = trLin;
			var tBreakSt = trLinPrev.sample;

			trLin = get_next_rising_edge(chLin, trLin);     // Find end of BREAK field
			var tBreakEnd = trLin.sample;

			if (trs_is_not_last(chLin) != true)
			{
				return;
			}

			trLin = get_next_edge(chLin, trLin);
			stBitStart = trLin.sample;

			// If the high period between a break and sync is superior than 4 * tBit - it is a wake up signal or just an invalid break condition
			if ((stBitStart - tBreakEnd) <= tSyncDelimMax)
			{
				breakFound = true;
			}
			else
			{
				// Wakeup signal is 250us - 5ms low state
				if ((get_sample_diff_us(tBreakSt, tBreakEnd) >= T_WAKEUP_MIN) && (get_sample_diff_us(tBreakSt, tBreakEnd) <= T_WAKEUP_MAX))
				{
					linObjectsArr.push(new LinObject(LINOBJECT_TYPE.WAKE, true, tBreakSt, tBreakEnd));
				}
				else
				{
					linObjectsArr.push(new LinObject(LINOBJECT_TYPE.BREAK, false, tBreakSt, tBreakEnd));
				}
			}
		}

		var sof = tBreakSt, eof = 0;			// start of frame & end of frame
		var t1, t0 = trLin.sample;
		stBitStart = t0;
		var stBitEnd = false;
		var breakOk = true;
		var syncBitDeltaArr = [];				// Array of all sync bits duration
		var syncDurationOk = true;
		var syncVal = 0;						// Sync field value

		for (var i = 0; i < 9; i++) 			// Search for all 9 edges of SYNC field, (8 bits + start and stop bits)
		{
			var tTemp = trLin.sample;

			trLin = get_next_edge(chLin, trLin);
			t1 = trLin.sample;

			if (i < 8)
			{
				if (trLin.val == 1)
				{
					syncVal |= (1 << i);
				}

				syncBitDeltaArr[i] = t1 - tTemp;
			}

			if (stBitEnd == false)
			{
				stBitEnd = trLin.sample;	
			}
		}

		tBit = ((t1 - t0) / 9);		// Calc average bit duration
		update_t_variales();		// Update all others time variables with this new tBit value

		for (var i = 0; i < 8; i++)
		{
			if (syncBitDeltaArr[i] > (2 * tBit))
			{
				syncDurationOk = false;
			}
		}

		var tBreak = tBreakEnd - tBreakSt;

		if (tBreak < (T_MIN_BREAK_BITS * tBit))
		{
			breakOk = false;
		}

		linObjectsArr.push(new LinObject(LINOBJECT_TYPE.BREAK, breakOk, tBreakSt, tBreakEnd));

		trLin = get_next_edge(chLin, trLin);	// Get the last edge of stop bit

		if (stBitEnd != t1)
		{
			if ((syncVal == SYNC_FIELD_VALUE) && (syncDurationOk != false))
			{
				linObjectsArr.push(new LinObject(LINOBJECT_TYPE.SYNC, get_curr_baudrate(), stBitEnd, t1));
			}
			else
			{
				linObjectsArr.push(new LinObject(LINOBJECT_TYPE.SYNC, false, stBitEnd, t1));
			}
		}

		if (trs_is_not_last(chLin) == false)
		{
			return;
		}

		var i = 0;

		do				// 3-10 bytes to receive: 1 id field, 1-8 data bytes and 1 checksum byte
		{
			var byteEnd = false;
			var byteValue = 0;
			stBitEnd = trLin.sample + tBit;
			stBitStart = trLin.sample;

			var tSample = trLin.sample + tEbs;

			for (var k = 0; k < 10; k++) 		// Get one byte from LIN bus (8 bits + start and stop bits)
			{
				if (k > 0 && k < 10)
				{
					byteValue >>= 1;
						
					if (bitValue == 1)
					{
						byteValue |= 0x80;
					}
				}

				var bitValue = sample_val(chLin, tSample);
				dec_item_add_sample_point(chLin, tSample, bitValue ? DRAW_1 : DRAW_0);

				byteEnd = tSample;
				tSample += tBit;
			}

			linObjectsArr.push(new LinObject(LINOBJECT_TYPE.BYTE, byteValue, stBitEnd, (byteEnd - tBs)));

			trLinPrev = trLin;
			trLin = trs_go_after(chLin, byteEnd);		// Get the last edge (falling edge of the next start bit)
			eof = trLin.sample;

			if (trs_is_not_last(chLin) == false)
			{
				return;
			}

			i++;

		} while ((i < 10) && ((trLin.sample - trLinPrev.sample) <= (tBit * T_MAX_BETWEEN_BYTES)));
	}

	return true;
}


/*
*/
function get_first_break_start()
{
	var trLin = trs_get_first(chLin);
	var trFirst = trLin;
	var firstRun = true;

	while (trs_is_not_last(chLin) != false)					// For all transitons on this channel
	{
	    if (abort_requested())
		{
			return false;
		}

		var breakFound = false;

		while ((breakFound != true))
		{
			trFirst = trLin;

			if (firstRun)
			{
				firstRun = false;

				if (trFirst.val != FALLING)
				{
					trLin = trs_get_next(chLin);
				}
			}
			else
			{
				trLin = trs_get_next(chLin);
			}

			if (trLin.val == FALLING)						// Get BREAK start
			{
				var tBreakSt = trLin.sample;
				trLin = trs_get_next(chLin);				// Get BREAK end

				var tBreakEnd = trLin.sample;
				var tBreak = tBreakEnd - tBreakSt;

				if (tBreak >= (T_MIN_BREAK_BITS * tBit))	// A valid break field must be at least 13 nominal bit times
				{
					breakFound = true;
				}
			}

			if (trs_is_not_last(chLin) != true)
			{
				return;
			}
		}

		trLin = get_next_edge(chLin, trLin);
		var t0 = trLin.sample;
		var syncVal = 0;

		for (var i = 0; i < 9; i++) 						// Search for all 9 edges of SYNC field, (8 bits + start and stop bits)
		{
			trLin = get_next_edge(chLin, trLin);
			var t1 = trLin.sample;

			if (i < 8)
			{
				if (trLin.val == 1)
				{
					syncVal |= (1 << i);
				}
			}
		}

		tBit = ((t1 - t0) / 9);							// Find average bit duration
		var tBreak = tBreakEnd - tBreakSt;

		if (tBreak >= (T_MIN_BREAK_BITS * tBit))		// First BREAK found
		{
			if (syncVal == SYNC_FIELD_VALUE)
			{
				trLin = trs_go_before(chLin, trFirst.sample);
				return trFirst;
			}
		}
	}
}


/*
*/
function test_signal()
{
	var trLin = trs_get_first(chLin);
	var syncVal;
	var iters;

	while (trs_is_not_last(chLin) != false)				// For all transitons on this channel
	{
	    if (abort_requested())
		{
			return false;
		}

		trLin = get_next_falling_edge(chLin, trLin);	// Find start of BREAK field
		var tBreakSt = trLin.sample;

		trLin = get_next_rising_edge(chLin, trLin);     // Find end of BREAK field
		var tBreakEnd = trLin.sample;

		trLin = get_next_edge(chLin, trLin);
		var t0 = trLin.sample;

		syncVal = 0;

		for (var i = 0; i < 9; i++) 					// Search for all 9 edges of SYNC field, (8 bits + start and stop bits)
		{
			trLin = get_next_edge(chLin, trLin);
			var t1 = trLin.sample;

			if (i < 8)
			{
				if (trLin.val == 1)
				{
					syncVal |= (1 << i);
				}
			}
		}

		tBit = ((t1 - t0) / 9);							// Find average bit duration

		var tBreak = tBreakEnd - tBreakSt;

		if (tBreak >= (T_MIN_BREAK_BITS * tBit))		// A break field must be at least 13 nominal bit times
		{
			if (syncVal == SYNC_FIELD_VALUE)
			{
				update_t_variales();					// Update all others time variables with this new tBit value
				return ERR_CODES.OK;
			}
		}

		iters++;
	}

	if (iters > 5)
	{
		return ERR_CODES.ERR_SIGNAL;					// No valid BREAK
	}

	return ERR_CODES.NO_SIGNAL;							// Any BREAK found, no valid signal
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
	var linBaudRateKbps = 20;	// Common value for LIN bus
	var tBitUs = ((1 / linBaudRateKbps) * 1000);
	var i = 0;

	tBit = get_num_samples_for_us(tBitUs);	// Update all others time variables with this new tBit value
	update_t_variales();

	while (get_samples_acc(chLin) < n_samples)
	{
		demo_gen_frame(i);
		i += 8;
	}
}


/*
*/
function demo_gen_frame (data_offset)
{
	var ident = 0x30;
	var demoDataArr = new Array();

	add_samples(chLin, 1, (n_samples / 100));					// Idle state

	add_samples(chLin, 0, (((T_MIN_BREAK_BITS + 3) * tBit)));	// Break
	add_samples(chLin, 1, (get_num_samples_for_us(100)));		// Delay

	demo_gen_byte(SYNC_FIELD_VALUE);							// Sync
	ident = demo_gen_ident(ident)								// Identifer
	demoDataArr.push(ident);

	for (i = 0; i < 8; i++)				// 8 bytes of data + 1 CRC byte
	{
		demo_gen_byte((data_offset + i));
		demoDataArr.push((data_offset + i));
	}

	demo_gen_crc(demoDataArr);
}


/*
*/
function demo_gen_ident (id)
{
	var parity;

	if (id > 0x3F)
	{
		id = 0x3F;
	}

	parity = get_parity(id);
	id |= (parity << 6);

	demo_gen_byte(id);

	return id;
}


/*
*/
function demo_gen_crc (demoData)
{
	var checksum = 0;
	var idField = demoData.shift();
	var id = (idField.value & ~ID_FIELD_MASK.PARITY);

	if((id != FRAME_ID.CONFIG_0) && (id != FRAME_ID.CONFIG_1))
	{
		checksum = idField;
	}

	while (demoData.length > 0)
	{
		var nextByte = demoData.shift();

		checksum += nextByte;

		if (checksum > 0xFF)
		{
			checksum -= 0xFF;
		}
	}

	checksum = (0xFF - checksum);
	demo_gen_byte(checksum);
}


/*
*/
function demo_gen_byte (data_byte)
{
	var i;
	var bit;

	add_samples(chLin, 0, tBit);		// start bit

	for (i = 0; i < 8; i++)				// 8 bits of data
	{
		if ((data_byte & (1 << i)))
		{
			bit = 1;
		}
		else
		{
			bit = 0;
		}

		add_samples(chLin, bit, tBit);
	}

	add_samples(chLin, 1, tBit);		// stop bit
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

	trig_ui_add_alternative("alt_any_break", "Trigger on a any BREAK field", true);

		trig_ui_add_label("lab1", "Due to the nature of LIN protocol you need to specify a bitrate of measured line in range between 1 and 20 kBits/s <br>");
		trig_ui_add_free_text("trig_baudrate", "Bitrate (kBits/s): ");

	trig_ui_add_alternative("alt_specific_ident", "Trigger on Identifier field value", false);

		trig_ui_add_label("lab2", "Due to the nature of LIN protocol you need to specify a baudrate of measured line in range between 1 and 20 kBits/s <br>");
		trig_ui_add_free_text("trig_baudrate", "Baudrate (kBits/s): ");
	
		trig_ui_add_label("lab3", "<br>Type decimal value (65) or Hex value (0x41) with or without the parity part <br>");
		trig_ui_add_free_text("trig_ident", "Trigger Identifier: ");
}


/*
*/
function trig_seq_gen()
{
    flexitrig_set_async_mode(true);
	get_ui_vals();

	if (trig_baudrate < 1)
	{
		trig_baudrate = 1;
	}

	if (trig_baudrate > 20)
	{
		trig_baudrate = 20;
	}

	var tBitS = (1 / (trig_baudrate * 1000));
	var tBitSTolerance = ((tBitS / 100) * BIT_RATE_TOLERANCE);
	var tBitSMin = tBitS - tBitSTolerance;
	var tBitSMax = tBitS + tBitSTolerance;
	var tBreakSMin = ((T_MIN_BREAK_BITS + 3) * tBitSMin);

	flexitrig_clear();

	if (alt_any_break)
	{
		flexitrig_set_summary_text("Trig on LIN Break condition");
		flexitrig_append(trig_build_step("F"), -1, -1);
		flexitrig_append(trig_build_step("R"), tBreakSMin, -1);
	}
	else if (alt_specific_ident)
	{
		trig_ident = Number(trig_ident);
		flexitrig_set_summary_text("Trig on LIN Identifer: 0x" + trig_ident.toString(16));

		flexitrig_append(trig_build_step("F"), -1, -1);
		flexitrig_append(trig_build_step("R"), tBreakSMin, -1);

		for (var i = 0; i < 5; i++)		// Sync, 10 bits
		{
			flexitrig_append(trig_build_step("F"), tBitSMin, tBitSMax);
			flexitrig_append(trig_build_step("R"), tBitSMin, tBitSMax);
		}

		var bitSeqArr = new Array();
		var identParity = get_parity(trig_ident);
		var step;

		trig_ident &= ~(0xC0);
		trig_ident |= (identParity << 6);

		flexitrig_append(trig_build_step(0), tBitSMin, tBitSMax);		// Start bit

		for (var i = 0; i < 8; i++)
		{
			if ((trig_ident >> i) & 0x01)
			{
				bitSeqArr.push(1);
			}
			else
			{
				bitSeqArr.push(0);
			}
		}

		bitSeqArr.push(1);		// Stop bit

		var lastBit = bitSeqArr[0];
		var lastIndex = 0;

		for (var i = 0; i < bitSeqArr.length; i++)
		{
			if (bitSeqArr[i] != lastBit)
			{
				var step = trig_build_step(bitSeqArr[i]);
				flexitrig_append(step, (tBitSMin * (i - lastIndex)), (tBitSMax * (i - lastIndex)));
				lastBit = bitSeqArr[i];
				lastIndex = i;
			}
		}
	}

	// flexitrig_print_steps();
}


/*
*/
function trig_build_step (step_desc)
{
	var step = "";

	for (var i = 0; i < get_device_max_channels(); i++)
	{
		if (i == chLin)
		{
			step = step_desc + step;
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

/* Get the checksum of all data bytes
*/
function compute_checksum (dataArr)
{
	var idField = dataArr.shift().value;
	var id = (idField.value & ~ID_FIELD_MASK.PARITY);
	var checksumV1xCalc = 0;
	var checksumV2xCalc = 0;

	if((id != FRAME_ID.CONFIG_0) && (id != FRAME_ID.CONFIG_1))	// Config frame identifiers shall always use classic checksum w/o id field
	{
		checksumV2xCalc = idField;
	}

	while (dataArr.length > 1)
	{
		var nextByte = dataArr.shift().value;

		checksumV1xCalc += nextByte;

		if (checksumV1xCalc > 0xFF)
		{
			checksumV1xCalc -= 0xFF;
		}
		
		checksumV2xCalc += nextByte;
		
		if (checksumV2xCalc > 0xFF)
		{
			checksumV2xCalc -= 0xFF;
		}
	}

	var checksum = dataArr.shift().value; 	// Get checksum transmitted by a slave

	if (checksumV1xCalc + checksum == 0xFF)
	{
		return true;
	}

	if (checksumV2xCalc + checksum == 0xFF)
	{
		return true;
	}

	return false;
}


/* Verify parity of frame identifier bits
*/
function check_parity (id)
{
	var id0 = (id & 0x01) ? 1 : 0;
	var id1 = (id & 0x02) ? 1 : 0;
	var id2 = (id & 0x04) ? 1 : 0;
	var id3 = (id & 0x08) ? 1 : 0;
	var id4 = (id & 0x10) ? 1 : 0;
	var id5 = (id & 0x20) ? 1 : 0;

	var p0 = (id & ID_FIELD_MASK.PARITY_0) ? 1 : 0;
	var p1 = (id & ID_FIELD_MASK.PARITY_1) ? 1 : 0;

	var p0Calc = (id0 ^ id1 ^ id2  ^ id4);	// XOR of bits ID0, ID1, ID2 and ID4
	var p1Calc = !(id1 ^ id3 ^ id4 ^ id5);  // NOT of XOR of bits ID1, ID3, ID4 and ID5

	if ((p0 == p0Calc) && (p1 == p1Calc))
	{
		return true;
	}

	return false;
}


/*
*/
function get_parity (id)
{
	var parity;

	var id0 = (id & 0x01) ? 1 : 0;
	var id1 = (id & 0x02) ? 1 : 0;
	var id2 = (id & 0x04) ? 1 : 0;
	var id3 = (id & 0x08) ? 1 : 0;
	var id4 = (id & 0x10) ? 1 : 0;
	var id5 = (id & 0x20) ? 1 : 0;

	var p0 = (id0 ^ id1 ^ id2  ^ id4);
	var p1 = !(id1 ^ id3 ^ id4 ^ id5);

	parity = (p1 << 1) | p0;
	return parity;
}


/*
*/
function pkt_add_packet (ok)
{
	var obj;
	var desc = "";
	var objCnt = 0;
	var pktDataPerLine = 100;

	if (pktObjects.length < 1)
	{
		return;
	}

	for (var i = 0; i < pktObjects.length; i++)
	{
		obj = pktObjects[i];
		
		if (obj.title.localeCompare("WAKE UP") == 0)
		{
			desc += "WAKE ";
		}

		if (obj.title.localeCompare("PID") == 0)
		{
			desc += "ID:" + obj.dataObjArr + " ";
		}

		if (obj.title.localeCompare("DATA") == 0)
		{
			desc += "DATA[" + obj.dataLen + "]";
		}
	}

	var pktStart = pktObjects[0].start;
	var pktEnd = pktObjects[pktObjects.length - 1].end;

	pkt_start("LIN");

	if (ok)
	{
		pkt_add_item(pktStart, pktEnd, "LIN FRAME", desc, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA);
	}
	else
	{
		pkt_add_item(pktStart, pktEnd, "LIN FRAME", desc, PKT_COLOR_INVALID, PKT_COLOR_DATA);
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
		else
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
function get_curr_baudrate()
{
	var tBitUs = get_sample_diff_us(0, tBit) / 1000;
	var baudrate = (1 / tBitUs);

	return baudrate.toPrecision(4);
}


/* Update all timing variables with new tBit value
*/
function update_t_variales()
{
	tBfs = (1 / 16 * tBit);
	tEbs = (tBit * (7 / 16));
	tLbs = (tBit - tBfs * (10 / 16));
	tBs = ((tLbs + tEbs) / 2);

	tHeaderNom = (34 * tBit);
	tRespNom = (10 * (nData + 1) * tBit);
	tFrameNom = (tHeaderNom + tRespNom);

	tSyncDelimMax = (tBit * 4);
	tHeaderMax = (14 * tHeaderNom);
	tRespMax = (1.4 * tRespNom);
	tFrameMax = (tHeaderMax + tRespMax);
}


/*
*/
function check_noise (tr1, tr2)
{
	var diff = tr2.sample - tr1.sample;
	var t = diff * (1 / get_srate());

	if (t <= LIN_MIN_T)
	{
		return true;
	}

	return false;
}


/* Get next transition
*/
function get_next_edge (ch, trSt)
{
	var ok = false;
	var tr = trSt;

	while ((ok != true) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);

		if (check_noise(trSt, tr) == true)
		{
			ok = false;
		}
		else
		{
			ok = true;
		}
	}

	if (trs_is_not_last(ch) == false) 
	{
		tr = false;
	}

	return tr;
}


/* Get next transition with falling edge
*/
function get_next_falling_edge (ch, trSt)
{
	var tr = trSt;

	while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);
	}

	if (trs_is_not_last(ch) == false) 
	{
		tr = false;
	}

	return tr;
}


/*	Get next transition with rising edge
*/
function get_next_rising_edge (ch, trSt)
{
	var tr = trSt;
	var ok = false;

	while (((tr.val != RISING) || (ok != true)) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);

		if (check_noise(trSt, tr) == true)
		{
			ok = false;
		}
		else
		{
			ok = true;
		}
	}

	if (trs_is_not_last(ch) == false)
	{	
		tr = false;
	}

	return tr;
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


/* Get time difference in microseconds between two transitions
*/
function get_trsdiff_us (tr1, tr2)
{
	return (((tr2.sample - tr1.sample) * 1000000) / get_srate());
}


/* Get time difference in microseconds between two samples
*/
function get_sample_diff_us (sp1, sp2)
{
	return (((sp2 - sp1) * 1000000) / get_srate());
}


/* Get time difference in samples between two transitions
*/
function get_trsdiff_samples (tr1, tr2)
{
	return (tr2.sample - tr1.sample);
}


/*  Get number of samples for the specified duration in microseconds
*/
function get_num_samples_for_us (us)
{
	return ((us * get_srate()) / 1000000);
}
