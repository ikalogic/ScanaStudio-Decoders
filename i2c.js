
/*
*************************************************************************************

						     SCANASTUDIO 2 I2C DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	I2C Protocol Decoder.
	A standard  decoder of Phillips (NXP) multi-master serial single-ended computer bus.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.70: Reworked PacketView.
	V1.69: Show packet frames event if there is no data available.
	V1.68: More stable I2C trigger.
	V1.67: Fixed 10-bit address error.
	New Packet View layout.
	V1.66: Fixed (N)ACK display error.
	V1.65: Added ScanaStudio 2.3xx compatibility.
	V1.64: Fix for slow decoding speed, progress report
	and demo generator overflow.
	V1.63: Added generator capability.
	V1.62: Fixed (N)ACK display error.
	V1.61: Fixed a ScanaQuad compatibility issue.
	V1.60: More realistic demo signals generation.
	V1.59: Added more decoder trigger options.
	V1.58: Added decoder trigger.
	V1.57: Added demo signal builder.
	V1.56: Fixed ACK missing display bug.
	V1.55: Solved major decoding bug.
	V1.54: Prevented incompatible workspaces from using this decoder.
	V1.53: Now the decoding can be aborted.
	V1.52: Removed Deprecated parts. Fixed bug with very slow i2c signals.
	V1.50: Added new error messages. Bug fixes.
	V1.45: A lot of bugs fixes. Performance improvements.
	V1.40: UI improvements. New scl frequency option.
	V1.35: Added Packet/Hex View support.
	V1.30: Performance optimizations. Decoding time decreased by half.
	V1.25: Visual improvements. Added signal noise handling.
	V1.20: Some user error messages removed.
	V1.15: Bug fixes.
	V1.10: A bunch of small compatibility fixes.
	V1.00: Initial release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL></AUTHOR_URL>
						
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
	return "I2C";
}


/* The decoder version 
*/
function get_dec_ver()
{
	return "1.70";
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

var I2COBJECT_TYPE =
{
	START : 0x01,
	STOP  : 0x02,
	BYTE  : 0x04,
	ACK   : 0x08,
	NOISE : 0x10
};

var I2C_ADDRESS =
{
	GENERAL_CALL : 0x00,
	START  		 : 0x00,
	CBUS  	     : 0x01,
	TENBITS      : 0x78
};

var I2C_ERR_CODES = 
{
	OK         : 0x01,
	NO_SIGNAL  : 0x02,
	ERR_SIGNAL : 0x04,
};

var I2C_NOISE = 
{
	SDA : 0x01,
	SCL : 0x02
};

var HEXVIEW_OPT = 
{
	DATA : 0x00,
	ADR  : 0x01,
	ALL  : 0x02
}; 

var I2C_RW_BIT_MASK = 0x01;

var I2C_MAX_FREQ_MHZ = 5;
var I2C_MAX_FREQ_HZ = (I2C_MAX_FREQ_MHZ * 1000) * 1000;
var I2C_MIN_T = 1 / I2C_MAX_FREQ_HZ;

function I2cObject (type, value, ack, count, start, end)
{
	this.type = type;
	this.value = value;
	this.ack = ack;
	this.count = count;
	this.start = start;
	this.end = end;
};

function AckObject (value, start, end)
{
	this.value = value;
	this.start = start;
	this.end = end;
};

function i2c_trig_step_t (sda, scl)
{
	this.sda = sda;
	this.scl = scl;
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

var i2cObjectsArr;
var pktObjects;
var AvgtHigh;
var i2c_trig_steps = [];
var samples_per_scl_cycle;
var gen_bit_rate;
var last_sda_lvl;
var last_scl_lvl;

var PKT_COLOR_DATA;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_START_TITLE;
var PKT_COLOR_ADR_TITLE;
var PKT_COLOR_ACK_TITLE;
var PKT_COLOR_INVALID;
var PKT_COLOR_STOP_TITLE;
var PKT_COLOR_NOISE_TITLE;

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();

	if ((typeof(get_device_max_channels) == 'function') && (typeof(get_device_name) == 'function'))
	{
		// Prevented incompatible workspaces from using the decoder
		if (get_device_max_channels() < 2)
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

	ui_add_ch_selector("chSda", "(SDA) Serial Data", "SDA");
	ui_add_ch_selector("chScl", "(SCL) Serial Clock", "SCL");

	ui_add_txt_combo("adrShow", "Show slave address as");
		ui_add_item_to_txt_combo("Address and separate R/W flag", true);
		ui_add_item_to_txt_combo("Address including R/W flag");

	ui_add_separator();
	ui_add_info_label("Hex view options:", true);
	
	ui_add_txt_combo("hexView", "Include in HEX view:");
		ui_add_item_to_txt_combo("DATA fields only", true);
		ui_add_item_to_txt_combo("ADDRESS fields only", false);
		ui_add_item_to_txt_combo("Everything", false);
}

/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();			// Update the content of all user interface related variables
	clear_dec_items();		// Clears all the the decoder items and its content

	i2cObjectsArr = [];
	pktObjects = [];

	PKT_COLOR_DATA        = get_ch_light_color(chSda);
	PKT_COLOR_DATA_TITLE  = dark_colors.gray;
	PKT_COLOR_START_TITLE = dark_colors.orange;
	PKT_COLOR_ADR_TITLE   = dark_colors.orange;
	PKT_COLOR_ACK_TITLE   = dark_colors.green;
	PKT_COLOR_INVALID     = dark_colors.red;
	PKT_COLOR_STOP_TITLE  = dark_colors.blue;
	PKT_COLOR_NOISE_TITLE = dark_colors.black;

	var errSig = test_signal();

	if (errSig == I2C_ERR_CODES.ERR_SIGNAL)
	{
		add_to_err_log("Error. Selected channels doesn't have any valid I2C signal");
		return false;
	}
	else if (errSig == I2C_ERR_CODES.NO_SIGNAL)
	{
		return false;
	}

	decode_signal();

	var i2cObjCnt = 0;
	var i2cObject = 0;
	var firstIter = true;
	var rwBit = 0;
	var ackValue = 2;
	var addrStr = "";

	var pktOk = true;
	var pktObj = new PktObject();
	pktObj.title = "DATA";
	pktObj.data = "";
	pktObj.titleColor = PKT_COLOR_DATA_TITLE;
	pktObj.dataColor = PKT_COLOR_DATA;
	pktObj.dataObjArr = [];
	pktObj.start = false;
	pktObj.dataLen = 0;

	while (i2cObjectsArr.length > i2cObjCnt)
	{
		i2cObject = i2cObjectsArr[i2cObjCnt];
		i2cObjCnt++;

		set_progress(50 * i2cObjCnt / i2cObjectsArr.length);

	    if (abort_requested() == true)
		{
			return false;
		}

		switch (i2cObject.type)
		{
			case I2COBJECT_TYPE.START:

					var condSt, condEnd;

					if (i2cObject.start > (AvgtHigh / 2))
					{
						condSt = (i2cObject.start - (AvgtHigh / 2));
						condEnd = i2cObject.start + (AvgtHigh / 2);
					}
					else
					{
						condSt = (i2cObject.start - (AvgtHigh / 6));
						condEnd = i2cObject.start + (AvgtHigh / 6);
					}

					dec_item_new(chSda, condSt, condEnd);
					dec_item_add_comment("MASTER START CONDITION");
					dec_item_add_pre_text("MASTER START CONDITION");
					dec_item_add_pre_text("START CONDITION");
					dec_item_add_pre_text("START");
					dec_item_add_pre_text("ST");
					dec_item_add_pre_text("S");

					if (!firstIter)
					{						
						pktObjects.push(pktObj);
						pkt_add_packet(pktOk);

						pktOk = true;
						pktObj.data = "";
						pktObj.dataObjArr = [];
						pktObj.start = false;
						pktObj.dataLen = 0;
					}

					pktObjects.push(new PktObject("START", PKT_COLOR_START_TITLE, "", 0, 0, PKT_COLOR_DATA, condSt, condEnd));
					firstIter = false;
			break;

			case I2COBJECT_TYPE.STOP:

					dec_item_new(chSda, (i2cObject.start - (AvgtHigh / 2)), i2cObject.start + (AvgtHigh / 2));
					dec_item_add_pre_text("MASTER STOP CONDITION");
					dec_item_add_comment("MASTER STOP CONDITION");
					dec_item_add_pre_text("STOP CONDITION");
					dec_item_add_pre_text("STOP");
					dec_item_add_pre_text("SP");
					dec_item_add_pre_text("P");

					pktObjects.push(new PktObject("STOP", PKT_COLOR_STOP_TITLE, "", 0, 0, PKT_COLOR_DATA, (i2cObject.start - (AvgtHigh / 2)), i2cObject.start + (AvgtHigh / 2)));
			break;

			case I2COBJECT_TYPE.BYTE:

					if (i2cObject.count == 1)						// First byte after START condition - slave address
					{						
						var slaveAdr1 = i2cObject.value;			// Store slave address
						var condSt = i2cObject.start, condEnd = i2cObject.end;

						if (hexView != HEXVIEW_OPT.DATA)
						{
							hex_add_byte(chSda, i2cObject.start, i2cObject.end, slaveAdr1);
						}

						rwBit = (slaveAdr1 & I2C_RW_BIT_MASK);      // 1 - READ, 0 - WRITE
						slaveAdr1 >>= 1;							// Don't need R/W bit anymore
						var slaveAdrStr = "";						// String with slave address and/or his family code
						var slaveAdrStrShort = "";					// Shortened version

						if (rwBit == 0)
						{
							slaveAdrStr += "WRITE TO: ";
							slaveAdrStrShort += "WR ";
						}
						else
						{
							slaveAdrStr += "READ FROM: ";
							slaveAdrStrShort += "RD ";
						}

						if (slaveAdr1 == I2C_ADDRESS.GENERAL_CALL)
						{
							if (rwBit == 0)
							{
								slaveAdrStr = "GENERAL CALL ";
								slaveAdrStrShort = "GEN";
							}
							else
							{
								slaveAdrStr = "START BYTE";
								slaveAdrStrShort = "STBYTE";
							}

							dec_item_new(chSda, i2cObject.start, i2cObject.end);
							dec_item_add_pre_text(slaveAdrStr);
							dec_item_add_pre_text(slaveAdrStrShort);

							display_ack(i2cObject.ack);
							ackValue = i2cObject.ack.value;
						}
						else if (slaveAdr1 == I2C_ADDRESS.CBUS)
						{						
							slaveAdrStr += "CBUS ADDRESS ";
							slaveAdrStrShort += "CBUS ";

							dec_item_new(chSda, i2cObject.start, i2cObject.end);
							dec_item_add_pre_text(slaveAdrStr + "(");
							dec_item_add_pre_text(slaveAdrStrShort);

							if (adrShow == 0)
							{
								dec_item_add_data(slaveAdr1);
								dec_item_add_post_text(" + R/W=" + rwBit + ")");
							}
							else
							{
								slaveAdr1 <<= 1;
								slaveAdr1 |= rwBit;
								dec_item_add_data(slaveAdr1);
								dec_item_add_post_text(")");
							}
							
							display_ack(i2cObject.ack);
							ackValue = i2cObject.ack.value;
						}
						else if ((slaveAdr1 & I2C_ADDRESS.TENBITS) >= I2C_ADDRESS.TENBITS)		// Slave 10 bits address
						{
							var i2cObject2 = i2cObjectsArr[i2cObjCnt];							// Get second address byte
							i2cObjCnt++;

							var slaveAdr2 = i2cObject2.value;

							if (hexView != HEXVIEW_OPT.DATA)
							{
								hex_add_byte(chSda, i2cObject2.start, i2cObject2.end, slaveAdr2);
							}
	
							slaveAdr1 &= ~0x7C;								// Wipe undesired bits.
							var slaveAdr = slaveAdr2 | (slaveAdr1 << 8);	// Construct full 10 bits slave address

							dec_item_new(chSda, i2cObject.start, i2cObject.end);
							dec_item_add_pre_text(slaveAdrStr);

							if (adrShow == 0)
							{
								dec_item_add_data(slaveAdr);
								dec_item_add_post_text(" + R/W=" + rwBit + " (1st BYTE)");
							}
							else
							{
								slaveAdr <<= 1;
								slaveAdr |= rwBit;
								dec_item_add_data(slaveAdr);
								dec_item_add_post_text(" (1st BYTE)");
							}		

							display_ack(i2cObject.ack);

							dec_item_new(chSda, i2cObject2.start, i2cObject2.end);
							dec_item_add_pre_text(slaveAdrStr);

							if (adrShow == 0)
							{
								dec_item_add_data(slaveAdr);
								dec_item_add_post_text(" + R/W=" + rwBit + " (2nd BYTE)");
							}
							else
							{
								dec_item_add_data(slaveAdr);
								dec_item_add_post_text(" (2nd BYTE)");
							}
							
							display_ack(i2cObject2.ack);
							ackValue = (i2cObject.ack.value | i2cObject2.ack.value);

							slaveAdr1 = slaveAdr;
							condSt = i2cObject.start;
							condEnd = i2cObject2.end;							
						}
						else	// Classic 7-bits address
						{
							dec_item_new(chSda, i2cObject.start, i2cObject.end);
							dec_item_add_pre_text(slaveAdrStr);
							dec_item_add_pre_text(slaveAdrStrShort);

							if (adrShow == 0)
							{
								dec_item_add_data(slaveAdr1);
								dec_item_add_post_text(" + R/W=" + rwBit);
							}
							else
							{
								slaveAdr1 <<= 1;
								slaveAdr1 |= rwBit;
								dec_item_add_data(slaveAdr1);
							}

							display_ack(i2cObject.ack);
							ackValue = i2cObject.ack.value;
						}

						addrStr = "";

						if (slaveAdr1 != I2C_ADDRESS.GENERAL_CALL && slaveAdr1 != I2C_ADDRESS.CBUS)
						{
							addrStr = int_to_str_hex(slaveAdr1);
						}

						var ackStr = " (A)";
						var pktColor = PKT_COLOR_DATA;

						if (ackValue == 1)
						{
							pktOk = false;
							pktColor = PKT_COLOR_INVALID;
							ackStr = " (N)";
						}
						else if (ackValue != 0)
						{
							pktOk = false;
							pktColor = PKT_COLOR_INVALID;
							ackStr = " (!)";
						}

						pktObjects.push(new PktObject("ADDRESS", PKT_COLOR_ADR_TITLE, (slaveAdrStrShort + addrStr + ackStr), 0, 0, pktColor, condSt, condEnd));
					}
					else		// Display normal data
					{
						var dataStr = int_to_str_hex(i2cObject.value);

						dec_item_new(chSda, i2cObject.start, i2cObject.end);
						dec_item_add_data(i2cObject.value);
						dec_item_add_comment(dataStr);

						display_ack(i2cObject.ack);

						if (hexView != HEXVIEW_OPT.ADR)
						{
							hex_add_byte(chSda, -1, -1, i2cObject.value);
						}

						pktObj.data += dataStr + " ";
						i2cObject.value = dataStr;
						pktObj.dataObjArr.push(i2cObject);
						pktObj.dataLen++;

						if (!pktObj.start)
						{
							pktObj.start = i2cObject.start;
						}

						pktObj.end = i2cObject.end;
					}
			break;

			case I2COBJECT_TYPE.NOISE:

					dec_item_new(chScl, (i2cObject.start - (AvgtHigh / 2)), i2cObject.start + (AvgtHigh / 2));

					if (i2cObject.value == I2C_NOISE.SDA)
					{
						dec_item_add_pre_text("NOISE ON SDA");
						dec_item_add_pre_text("!");
						dec_item_add_comment("NOISE ON SDA");
					}
					else
					{
						dec_item_add_pre_text("NOISE ON SCL");
						dec_item_add_pre_text("!");
						dec_item_add_comment("NOISE ON SCL");
					}
			break;
		}
	}

	if (pktObj.dataLen > 0)
	{
		pktObjects.push(pktObj);
		pkt_add_packet(pktOk);

		pktOk = true;
		pktObj.data = "";
		pktObj.dataObjArr = [];
		pktObj.start = false;
		pktObj.dataLen = 0;
	}

	return true;
}

/* Find all I2C bus data then put all in one storage place (global array) 
   for future bus analysing in main function - decode()
*/
function decode_signal()
{
	var type;
	var valSclBefore, valSclAfter;
	var trSda = trs_get_first(chSda);						// Position the navigator for sda/scl channels at the first transition
	var trScl = trs_get_first(chScl);
	var trSdaPrev = trSda;
	var noiseSda = false, noiseScl = false;
	var sclSemiPeriod = 0;
	var startStopArr = [];									// Array of START / STOP conditions in chronological order

	AvgtHigh = get_avg_thigh(trScl);						// Get average high time of SCL signal (1/2 of period)

	trSda = trs_get_first(chSda);
	trScl = trs_get_first(chScl);

	while (trs_is_not_last(chSda) != false)					// Find all START and STOP conditions
	{
		if (abort_requested() == true)						// Allow the user to abort this script
		{
			return false;
		}

		valSclBefore = sample_val(chScl, (trSda.sample - (get_num_samples_for_us(1) / 4)));		// - 250ns
		valSclAfter  = sample_val(chScl, (trSda.sample + (get_num_samples_for_us(1) / 4)));		// + 250ns

		if (valSclBefore == 1 && valSclAfter == 1)
		{
			if (trSda.val == FALLING)
			{
				type = I2COBJECT_TYPE.START;
			}
			else
			{
				type = I2COBJECT_TYPE.STOP;
			}

			startStopArr.push(new I2cObject(type, true, false, false, trSda.sample, false));
		}

		trSdaPrev = trSda;
		trSda = trs_get_next(chSda);
		noiseSda = check_noise(trSdaPrev, trSda);

		if (noiseSda == true)
		{	
			i2cObjectsArr.push(new I2cObject(I2COBJECT_TYPE.NOISE, I2C_NOISE.SDA, false, false, trSda.sample, false));

			var trSdaTemp = trSda;

			do
			{
				trSda = trSdaTemp;
				trSdaTemp = trs_get_next(chSda);
			}
			while ((check_noise(trSda, trSdaTemp) == true) && (trs_is_not_last(chSda) != false));

			trSda = trSdaTemp;
		}
	}

	if (startStopArr.length < 1)	// No start / stop conditions?
	{
		return;
	}

	// Find each bit of all data
	trSda = trs_get_first(chSda);
	trScl = trs_get_first(chScl);

	var startStop;
	var nextStartStopPos = 0;
	var byteEndLast = 0;

	do
	{
		startStop = startStopArr.shift();				// Get first START condition
	}
	while (startStop.type != I2COBJECT_TYPE.START);

	nextStartStopPos = startStop.start;

	while ((trs_is_not_last(chScl) != false))			// Read data for a whole transfer
	{
		if (abort_requested() == true)					// Allow the user to abort this script
		{
			return false;
		}

		set_progress(50 * trScl.sample / n_samples);	// Give feedback to ScanaStudio about decoding progress

		trScl = trs_go_after(chScl, nextStartStopPos);	// We must begin right after the START / STOP condition

		i2cObjectsArr.push(startStop);					// Push all in the global array we'll decode all of this in the main decode function
		
		if (startStopArr.length > 0)
		{
			startStop = startStopArr.shift();			// Get next START / STOP condition
			nextStartStopPos = startStop.start;
		}
		else
		{
			startStop = 0;
			nextStartStopPos = n_samples;
		}

		var byteCount = 0;								// Num of bytes received between START / STOP two conditions

		do 												// Read all bits between two START / STOP conditions
		{
			var byteValue = 0;
			var ack = new AckObject(2, false, false);
			var byteStart = false;
			var byteEnd;

			sclSemiPeriod = 0;

			// Interpret those bits as bytes
			for (var i = 0; i < 9; i++)					// For 8 bits data and one ACK bit
			{
				trScl = get_next_rising_edge(chScl, trScl);
				var trSclPrev = trScl;
				trScl = trs_get_next(chScl);

				noiseScl = check_noise(trSclPrev, trScl);

				if (noiseScl == true)
				{
					var trSclTemp = trScl;

					do
					{
						trScl = trSclTemp;
						trSclTemp = trs_get_next(chScl);
					}
					while ((check_noise(trScl, trSclTemp) == true) && (trs_is_not_last(chScl) != false));

					trScl = trSclTemp;
					i2cObjectsArr.push(new I2cObject(I2COBJECT_TYPE.NOISE, I2C_NOISE.SCL, false, false, trSclPrev.sample, false));
				}

				var newtHigh = trScl.sample - trSclPrev.sample;

				if (trScl != false)												// trScl == false if this is the last transition
				{
					if (nextStartStopPos > trScl.sample)						// While current tr < start/stop tr	
					{
						var bitStart = trSclPrev.sample;
						var bitEnd;

						if ((AvgtHigh * 2) >= newtHigh)							// If High pulse duration on SCL is longer than usually - end of transmisson
						{
							bitEnd = trScl.sample;
						}
						else
						{
							bitEnd = bitStart + (AvgtHigh / 2);
						}

						var midSample = ((bitStart + bitEnd) / 2);
						var bitValue = sample_val(chSda, midSample);			// Read bit value on SCL rising edge

						if (i < 8)												// Only for 8 bits data
						{
							byteValue <<= 1;

							if (bitValue == 1)
							{
								byteValue |= 0x01;
							}

							if (byteStart == false)
							{
								byteStart = bitStart;
							}

							byteEnd = bitEnd;
							dec_item_add_sample_point(chSda, midSample, bitValue ? DRAW_1 : DRAW_0);
						}
						else	// ACK bit
						{
							ack.value = bitValue;
							ack.start = bitStart;
							ack.end = bitEnd;
							byteEnd = bitEnd;
						}
					}
					else
					{
						break;
					}
				}
				else
				{
					break;
				}
			}

			if (byteEnd > byteEndLast)
			{
				if (ack.value == 2)
				{
					ack.start = (byteEnd + (AvgtHigh / 2));
					ack.end = ack.start + AvgtHigh;
				}

				byteCount++;
				i2cObjectsArr.push(new I2cObject(I2COBJECT_TYPE.BYTE, byteValue, ack, byteCount, byteStart, byteEnd));
				byteEndLast = byteEnd;
			}

		} while (nextStartStopPos > trScl.sample);
	}

	if (startStop.start < n_samples)
	{
		i2cObjectsArr.push(startStop);
	}

	decode_invalid_data();
	return true;
}

/*
*/
function display_ack (ack)
{
	if (ack.value == 0)
	{
		dec_item_new(chSda, ack.start, ack.end);

		dec_item_add_pre_text("ACKNOWLEDGE");
		dec_item_add_pre_text("ACKNOWLEDGE");
		dec_item_add_pre_text("ACK");
		dec_item_add_pre_text("A");
		dec_item_add_comment("ACKNOWLEDGE");
	}
	else if (ack.value == 1)
	{
		dec_item_new(chSda, ack.start, ack.end);

		dec_item_add_pre_text("NO ACKNOWLEDGE");
		dec_item_add_pre_text("NO ACKNOWLEDGE");
		dec_item_add_pre_text("NACK");
		dec_item_add_pre_text("N");
		dec_item_add_comment("NO ACKNOWLEDGE");
	}
	else
	{
		dec_item_new(chSda, ack.start, ack.end);
		dec_item_add_pre_text("WARNING: NO ACKNOWLEDGE");
		dec_item_add_pre_text("WARN: NO ACK");
		dec_item_add_pre_text("!");
		dec_item_add_comment("WARNING: NO ACKNOWLEDGE");
	}
}

/*
*/
function decode_invalid_data()
{
	var trSda = trs_get_first(chSda);
	var trCnt = 0;
	var startCnt = 0;
	var stopCnt = 0;
	var endInvalidData = n_samples;
	var showInvalidData = false;
	var i2cObjCnt = 0;

	if (i2cObjectsArr.length > 0)
	{
		while (i2cObjectsArr.length > i2cObjCnt)
		{
			if ((i2cObjectsArr[i2cObjCnt].type == I2COBJECT_TYPE.START) || 
			    (i2cObjectsArr[i2cObjCnt].type == I2COBJECT_TYPE.STOP))
			{
				endInvalidData = (i2cObjectsArr[i2cObjCnt].start - (AvgtHigh * 2));
				break;
			}

			i2cObjCnt++;
		}
	}

	while ((trs_is_not_last(chSda)) && (trSda.sample < endInvalidData))
	{
		trSda = trs_get_next(chSda);
		trCnt++;

		if (trCnt > 2)
		{
			showInvalidData = true;
			break;
		}
	}

	if (showInvalidData)
	{
		dec_item_new(chSda, 0, endInvalidData);
		dec_item_add_pre_text("NO START - INVALID DATA");
		dec_item_add_pre_text("INVALID DATA");
		dec_item_add_pre_text("INVALID");
	}
}

/* Test if there is a I2C signal
*/
function test_signal()
{
	var trSda = trs_get_first(chSda);
	var trScl = trs_get_first(chScl);
	var valScl;

	var trCnt = 0;
	var startCnt = 0;
	var stopCnt = 0;
	var maxTrCnt = 100000;

	if (n_samples > 100000000)
	{
		maxTrCnt = maxTrCnt / 2;

		if (n_samples > 10000000000)
		{
			maxTrCnt = maxTrCnt / 2;
		}
	}

	while (trs_is_not_last(chSda) != false)
	{
		valScl = sample_val(chScl, trSda.sample);

		if (valScl == 1)
		{
			if (trSda.val == FALLING)
			{
				startCnt++;
			}
			else
			{
				stopCnt++;
			}
		}

		trSda = trs_get_next(chSda);
		trCnt++;

		if (trCnt > maxTrCnt)
		{
			break;
		}
	}

	if (trCnt < 5)
	{
		return I2C_ERR_CODES.NO_SIGNAL;
	}
	else
	{
		if (startCnt >= 1)
		{
			return I2C_ERR_CODES.OK;
		}
		else
		{
			return I2C_ERR_CODES.ERR_SIGNAL;	
		}
	}
}

/*
*************************************************************************************
							     Signal Generator
*************************************************************************************
*/

function generator_template()
{
	/*
		Quick Help
		~~~~~~~~~~
		Start by configuring the protocol with the variables
		in the "configuration" part.
		
		Then, use the following functions to generate packets:

		gen_add_delay(delay)
		====================
			Description
			-----------
			Adds a delay, keeping SCL and SDA at their last known level
			
			Parameters
			----------
			delay: the delay expressed in number of samples. 
			
		put_c(data,start,ack,stop)
		===============
			Description
			-----------
			Builds an I2C data word. this can either be an address or a regular data byte. If it's an address, the R/W bit must be inluded
			in the data byte.
			
			Parameters
			----------
			data: Value of the I2C byte to be generated
			start: Set to true to generate a start condition
			ack: Set to true to force ACK bit to an active state (i.e. 0 level)
			stop: Set to true to generate a stop condition
	*/

	/*
		Configuration part : !! Configure this part !!
		(Do not change variables names)
	*/
	chSda = 0; 	// SDA on CH 1
	chScl = 1; 	// SCL on ch 2

	gen_bit_rate = 100000; 	// Bit rate expressed in Hz
	
	var samples_per_us = get_srate() / 1000000;
	
	ini_i2c_generator();

	/*
		Signal generation part !! Change this part according to your application !!
	*/
	gen_add_delay(samples_per_us * 15);

	put_c(0xA2,true, true, false);
	put_c(0x55,false, true, false);

	gen_add_delay(samples_per_us * 15);

	put_c(0xA2,true, false, false);
	put_c(0x55,false, false, true);

	gen_add_delay(samples_per_us * 15);

	put_c(0xA2,true, false, false);
	put_c(0x55,false, false, true);	
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
	var last_samples_acc = 0;
	var demo_cnt = 0;
	var inter_transaction_silence = n_samples / 100;
	var samples_per_us = get_srate() / 1000000;
	gen_bit_rate = 100000;

	ini_i2c_generator();

	while ((get_samples_acc(chSda) < n_samples) && (get_samples_acc(chScl) < n_samples))
	{
		put_c(0xA2,true, true, false);
		put_c(demo_cnt, false, true, false);
		put_c(0xA3, true, true, false);

		var test_data;

		for (test_data = 0; test_data < 10; test_data++)
		{
			put_c(test_data, false, true, false);
		}

		put_c(test_data, false, false, true);
		demo_cnt++;

		add_samples(chScl, 1, inter_transaction_silence);
		add_samples(chSda, 1, inter_transaction_silence);

		if (get_samples_acc() < last_samples_acc)	 			// Overflow condition (only for very large captures)
		{
			break;
		}

		last_samples_acc = get_samples_acc();
	}
}


/*
*/
function ini_i2c_generator()
{
	samples_per_scl_cycle = (get_srate() / gen_bit_rate) / 2; 	// Samples per half SCL cycle

	add_samples(chScl, 1, samples_per_scl_cycle * 10);
	add_samples(chSda, 1, samples_per_scl_cycle * 10);
	add_samples(chSda, 1, samples_per_scl_cycle * 5 / 10); 		// Delay chSda wrt chScl by 2/10 of scl cycle.		

	last_scl_lvl = 1;
	last_sda_lvl = 1;
}

/*
*/
function gen_add_delay(s)
{
	add_samples(chScl, last_scl_lvl, s);
	add_samples(chSda, last_sda_lvl, s);
}

/*
*/
function put_c (data, start, gen_ack, stop)
{
	var i = 0, b = 0;

	if (start == true)
	{
		if (last_sda_lvl != 1)
		{
			add_samples(chScl, 0, samples_per_scl_cycle);
			add_samples(chSda, last_sda_lvl, samples_per_scl_cycle);
			add_samples(chScl, 0, samples_per_scl_cycle);
			add_samples(chSda, 1, samples_per_scl_cycle);
		}
		
		add_samples(chScl, 1, samples_per_scl_cycle);
		add_samples(chSda, 1, samples_per_scl_cycle);
		
		add_samples(chScl, 1, samples_per_scl_cycle);
		add_samples(chSda, 0, samples_per_scl_cycle);
	}

	for (i = 0; i < 8; i++)
	{
		b = ((data >> (7 - i)) & 0x1);

		add_samples(chScl, 0, samples_per_scl_cycle);
		add_samples(chSda, b, samples_per_scl_cycle);
		add_samples(chScl, 1, samples_per_scl_cycle);
		add_samples(chSda, b, samples_per_scl_cycle);
	}

	if (gen_ack == true)
	{		
		add_samples(chScl, 0, samples_per_scl_cycle);
		add_samples(chSda, 0, samples_per_scl_cycle);
		add_samples(chScl, 1, samples_per_scl_cycle);
		add_samples(chSda, 0, samples_per_scl_cycle);
		add_samples(chScl, 0, samples_per_scl_cycle);
		add_samples(chSda, 1, samples_per_scl_cycle);				
	}
	else
	{
		add_samples(chScl, 0, samples_per_scl_cycle);
		add_samples(chSda, 1, samples_per_scl_cycle);
		add_samples(chScl, 1, samples_per_scl_cycle);
		add_samples(chSda, 1, samples_per_scl_cycle);
		add_samples(chScl, 0, samples_per_scl_cycle);
		add_samples(chSda, 1, samples_per_scl_cycle);
	}

	last_scl_lvl = 0;
	last_sda_lvl = 1;

	if (stop == true)
	{		
		if (last_sda_lvl != 0)
		{
			add_samples(chScl, 0, samples_per_scl_cycle);
			add_samples(chSda, last_sda_lvl, samples_per_scl_cycle);
			add_samples(chScl, 0, samples_per_scl_cycle);
			add_samples(chSda, 0, samples_per_scl_cycle);			
			add_samples(chScl, 1, samples_per_scl_cycle);
			add_samples(chSda, 0, samples_per_scl_cycle);
		}

		add_samples(chScl, 1, samples_per_scl_cycle);
		add_samples(chSda, 1, samples_per_scl_cycle);

		last_scl_lvl = 1;
		last_sda_lvl = 1;			
	}
}

/*
*************************************************************************************
							       TRIGGER
*************************************************************************************
*/

/*
*/
function trig_gui()
{
	trig_ui_clear();

	trig_ui_add_alternative("ALT_ANY_FRAME", "Trigger on a any frame", false);
		
		trig_ui_add_combo("trig_frame_type", "Trigger on:");
		trig_ui_add_item_to_combo("Valid Start condition", true);
		trig_ui_add_item_to_combo("Valid Stop condition");
		trig_ui_add_item_to_combo("Any UnAcknowledged address");
		trig_ui_add_item_to_combo("Any Acknowledged address");

	trig_ui_add_alternative("ALT_SPECIFIC_ADD", "Trigger on I2C address", true);
	
		trig_ui_add_label("lab1", "Type Decimal value (65) or HEX value (0x41). Address is an 8 bit field containing the R/W Flag");
		trig_ui_add_free_text("trig_add", "Slave Address: ");
		trig_ui_add_check_box("ack_needed_a", "Address must be aknowledged by a slave", false);
}

/*
*/
function trig_seq_gen()
{
	var i = 0;
	var i2c_step = {sda: "", scl:""};

	get_ui_vals();

	i2c_trig_steps.length = 0;

	if (ALT_ANY_FRAME == true)
	{
		switch (trig_frame_type)
		{
			case 0: 	// Trig on start

				flexitrig_set_summary_text("Trig on I2C start condition");

				i2c_step.sda = "F";
				i2c_step.scl = "1";

				i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));

				break;

			case 1: 	// Trig on stop

				flexitrig_set_summary_text("Trig on I2C start condition");

				i2c_step.sda = "R";
				i2c_step.scl = "1";
				i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));	

				break;

			case 2: 	// Trig on NACK

				flexitrig_set_summary_text("Trig on I2C NACK condition");
				
				i2c_step.sda = "F";
				i2c_step.scl = "1";

				i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));

				for (i = 7; i >= 0; i--)	// Add address and R/W field
				{
					i2c_step.sda = "X"; 	// Any address read or write!
					i2c_step.scl = "R";

					i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));
				}

				i2c_step.sda = "1"; 		// NACK
				i2c_step.scl = "R";

				i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));

			break;

			case 3: 	// Trig on ACK

				flexitrig_set_summary_text("Trig on I2C ACK condition");

				i2c_step.sda = "F";
				i2c_step.scl = "1";

				i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));

				for (i = 7; i >= 0; i--)	// Add address and R/W field
				{
					i2c_step.sda = "X"; 	// Any address read or write!
					i2c_step.scl = "R";

					i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));
				}

				i2c_step.sda = "0"; 		// ACK
				i2c_step.scl = "R";

				i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda, i2c_step.scl));
			
			break;					
		}
	}
	else if (ALT_SPECIFIC_ADD == true)
	{
		trig_add = Number(trig_add);

		i2c_step.sda = "F";		// Add the start condition
		i2c_step.scl = "1";
		
		i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda,i2c_step.scl));

		for (i = 7; i >= 0; i--)	// Add address and R/W field
		{
			i2c_step.sda = ((trig_add >> i) & 0x1).toString();
			i2c_step.scl = "R";

			i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda,i2c_step.scl));
		}
		if (ack_needed_a == true)	// Add ACK field (if needed)
		{
		
			i2c_step.sda = "0";
			i2c_step.scl = "R";
			i2c_trig_steps.push(new i2c_trig_step_t(i2c_step.sda,i2c_step.scl));
		}

		flexitrig_set_summary_text("Trig on I2C Add: 0x" + trig_add.toString(16));
	}

	flexitrig_set_async_mode(false);
	flexitrig_clear();

	for (i = 0; i < i2c_trig_steps.length; i++)		// Now actualy build flexitrig array
	{
		flexitrig_append(trig_build_step(i2c_trig_steps[i]),-1,-1);
	}
}

/*
*/
function trig_build_step (i2c_s)
{
	var step = "";
	var step_ch_desc;
	
	for (var i = 0; i < get_device_max_channels(); i++)
	{	
		if (i == chSda)
		{
			step = i2c_s.sda + step;
		}
		else if (i == chScl)
		{
			step = i2c_s.scl + step;
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

		if (obj.title.localeCompare("ADDRESS") == 0)
		{
			obj.data = obj.data.replace(/  +/g, ' ');
			desc += obj.data;
		}

		if (obj.title.localeCompare("DATA") == 0)
		{
			desc += " DATA " + obj.dataLen + " BYTE";

			if (obj.dataLen != 1)
			{
				desc += "S";
			}
		}
	}

	for (var i = 0; i < pktObjects.length; i++)
	{
		obj = pktObjects[i];

		if (obj.title.localeCompare("STOP") == 0)
		{
			if (i < (pktObjects.length - 1))
			{
				pktObjects.splice(i, 1);
				pktObjects.push(obj);
			}
		}
	}

	var pktStart = pktObjects[0].start;
	var pktEnd = pktObjects[pktObjects.length - 1].end;

	pkt_start("I2C");

	if (ok)
	{
		pkt_add_item(pktStart, pktEnd, "I2C FRAME", desc, get_ch_color(chSda), PKT_COLOR_DATA);
	}
	else
	{
		pkt_add_item(pktStart, pktEnd, "I2C FRAME", desc, PKT_COLOR_INVALID, PKT_COLOR_DATA);
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

						if (obj.dataObjArr[dataCnt].ack)
						{
							var ackValue = obj.dataObjArr[dataCnt].ack.value;

							if (ackValue == 1)
							{
								dataLine += "(N) ";
							}
							else if (ackValue != 0)
							{
								dataLine += "(!) ";
							}
						}

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
		else if (obj.title.localeCompare("ADDRESS") == 0)
		{
			pkt_add_item(obj.start, obj.end, obj.title, obj.data, obj.titleColor, obj.dataColor);
		}
	}

	pkt_end();
	pkt_end();

	pktObjects.length = 0;
	pktObjects = [];
}

/* Get next transition with falling edge
*/
function get_next_falling_edge (ch, trSt)
{
	var tr = trSt;

	while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);	// Get the next transition
	}

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}

/*	Get next transition with rising edge
*/
function get_next_rising_edge (ch, trSt)
{
	var tr = trSt;

	while ((tr.val != RISING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);	// Get the next transition
	}

	if (trs_is_not_last(ch) == false) tr = false;

	return tr;
}

/*
*/
function get_avg_thigh (trSt)
{
	var tr = trSt;
	var trPrev = tr;

	var tHighArr = [];
	var avgtHigh = 0;

	while (trs_is_not_last(chScl) != false)
	{
		trPrev = tr;
		tr = trs_get_next(chScl);

		if (check_noise(trPrev, tr) != true)
		{
			tHighArr.push((tr.sample - trPrev.sample));
		}

		if (tHighArr.length > 100)
		{
			break;
		}
	}

	tHighArr.sort(function(a, b){return a - b;});
	avgtHigh = tHighArr[Math.round(tHighArr.length / 2)];

	return avgtHigh;
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

/*  Get number of samples for the specified duration in microseconds
*/
function get_num_samples_for_us (us)
{
	return ((us * get_srate()) / 1000000);
}

/* Get time difference in microseconds between two transitions
*/
function get_tr_diff_us (tr1, tr2)
{
	var diff;

	if (tr1.sample > tr2.sample)
	{
		diff = (((tr1.sample - tr2.sample) * 1000000) / sample_rate);
	}
	else
	{
		diff = (((tr2.sample - tr1.sample) * 1000000) / sample_rate);
	}

	return diff
}

/*
*/
function check_noise (tr1, tr2)
{
	var diff;
	var t;

	if (tr1.sample > tr2.sample)
	{
		diff = tr1.sample - tr2.sample;
	}
	else
	{
		diff = tr2.sample - tr1.sample;
	}

	t = diff * (1 / sample_rate);

	if (t <= I2C_MIN_T)
	{
		return true;
	}

	return false;
}
