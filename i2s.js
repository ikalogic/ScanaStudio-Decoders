
/*
*************************************************************************************

						   SCANASTUDIO 2 I2S DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	I2S Protocol Decoder.
	This decoder will display the value of stereo audio signals transmitted by Philips (NXP)
	Integrated Interchip Sound bus

</DESCRIPTION>

<RELEASE_NOTES>

	V1.28: 
	V1.27: Prevented incompatible workspaces from using the decoder
	V1.26: Now the decoding can be aborted
	V1.25: A few minor fixes. New initial offset control.
	V1.2:  Added HexView support.
	V1.15: UI improvements.
	V1.1:  Added support of 16 / 24 / 32-bit word size. Bug fixes.
	V1.0:  Initial release

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
	return "I2S";
}


/* The decoder version 
*/
function get_dec_ver()
{
	return "1.28";
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

function I2sObject (type, value, ws, start, end)
{
	this.type = type;
	this.value = value;
	this.ws = ws;
	this.start = start;
	this.end = end;
};

var i2sObjectsArr;
var bitsInWord;
var avgtHigh;

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
	
	if ((typeof(get_device_max_channels) == 'function') && (typeof(get_device_name) == 'function'))
	{
		// Prevented incompatible workspaces from using the decoder
		if( get_device_max_channels() < 3 )
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

	ui_add_ch_selector("chSd", "(SD) Serial Data", "SD");
	ui_add_ch_selector("chSck", "(SCK) Serial Clock", "SCK");
	ui_add_ch_selector("chWs", "(WS) Word Select", "WS");

	ui_add_txt_combo("uiBitsInWord","Bits per Word");
		ui_add_item_to_txt_combo("8", true);
		ui_add_item_to_txt_combo("16");
		ui_add_item_to_txt_combo("24");
		ui_add_item_to_txt_combo("32");

	ui_add_txt_combo("uiDecodeWords", "Decode");
		ui_add_item_to_txt_combo("Only first 50 data words");
		ui_add_item_to_txt_combo("Only first 100 data words");
		ui_add_item_to_txt_combo("Only first 500 data words");
		ui_add_item_to_txt_combo("Only first 1000 data words");
		ui_add_item_to_txt_combo("Everything", true);
}


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();			// Update the content of all user interface related variables
	clear_dec_items();		// Clears all the the decoder items and its content

	if (uiDecodeWords == 0) uiDecodeWords = 50;
	if (uiDecodeWords == 1) uiDecodeWords = 100;
	if (uiDecodeWords == 2) uiDecodeWords = 500;
	if (uiDecodeWords == 3) uiDecodeWords = 1000;
	if (uiDecodeWords == 4) uiDecodeWords = 0;

	bitsInWord = (uiBitsInWord + 1) * 8;

	i2sObjectsArr = new Array();
	var i2sObjectCnt = 0;

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	decode_signal();

	while (i2sObjectsArr.length > i2sObjectCnt)
	{
		if (abort_requested() == true)
		{
			return false;
		}

		var i2sObject = i2sObjectsArr[i2sObjectCnt];
		i2sObjectCnt++;

		dec_item_new(chSd, i2sObject.start - get_bit_margin(), i2sObject.end + get_bit_margin());

		if (i2sObject.ws == 0)
		{
			dec_item_add_pre_text("LEFT CHANNEL: ");
			dec_item_add_pre_text("LEFT: ");
			dec_item_add_pre_text("LC: ");
		}
		else
		{
			dec_item_add_pre_text("RIGHT CHANNEL: ");
			dec_item_add_pre_text("RIGHT: ");
			dec_item_add_pre_text("RC: ");
		}

		dec_item_add_data(i2sObject.value);

		var tempValue = i2sObject.value;
		var hexValue = 0;

		for (var i = (bitsInWord / 8); i > 0 ; i--)
		{
			hexValue = (tempValue >> ((i - 1) * 8));
			hex_add_byte(chSd, -1, -1, hexValue);
		}
	}

	return true;
}


/* Find all I2S bus data then put all in one storage place (global array)
   for future bus analysing in main function - decode()
*/
function decode_signal()
{
	var trSck, trSd, trWs;
	var words = 0;

	trSck = trs_get_first(chSck);
	avgtHigh = get_avg_thigh(chSck, trSck);								// Get average high time of SCK signal (1/2 of period)
	trSck = trs_get_first(chSck);
	trSd = trs_get_first(chSd);											// Position the navigator for sda/scl channels at the first transition

	trWs = get_ws_offset();
	trSck = trs_go_after(chSck, trWs.sample + 1);
	
	while (trs_is_not_last(chSck) != false)								// Read data for a whole transfer
	{
		if (abort_requested() == true)									// Allow the user to abort this script
		{
			return false;
		}

		set_progress(100 * trSck.sample / n_samples);					// Give feedback to ScanaStudio about decoding progress

		var wordValue = 0;
		var wordStart = 0, wordEnd = 0;

		trSck = trs_get_next(chSck);									// Skip fisrt transition, MSB of new word begins on 2nd rising edge of SCK

		for (var i = 0; i < bitsInWord; i++)							//  For 8/16/24/32 bits in word (defined by user)
		{
			trSck = get_next_rising_edge(chSck, trSck);
			var trSckPrev = trSck;
			trSck = get_next_falling_edge(chSck, trSck);

			if (trSck != false)											// trSck == false if this is the last transition
			{
				var newtHigh = get_trsdiff_samples(trSckPrev, trSck);
				var bitStart = trSckPrev.sample;
				var bitEnd;
				var bitValue = sample_val(chSd, bitStart);				// Read bit value on SCK rising edge

				if ((avgtHigh * 2) >= newtHigh)							// If High pulse duration on SCL is longer than usually - end of transmisson
				{
					bitEnd = trSck.sample;
				}
				else
				{
					bitEnd = bitStart + (avgtHigh / 2);
				}

				wordValue <<= 1;

				if (bitValue == 1)
				{
					wordValue |= 0x01;
				}

				if (i == (bitsInWord / 2))
				{
					var wsValue = sample_val(chWs, bitStart);
				}

				if (i == 0)
				{
					wordStart = (bitStart + (avgtHigh * 2)) - 1;
				}

				wordEnd = (bitEnd - (avgtHigh * 2)) + 1;

				var midSample = ((bitStart + bitEnd) / 2);
				dec_item_add_sample_point(chSd, midSample, bitValue ? DRAW_1 : DRAW_0);
			}
			else
			{
				break;
			}
		}

		i2sObjectsArr.push(new I2sObject(true, wordValue, wsValue, wordStart, wordEnd));

		words += 1;

		if ((uiDecodeWords > 0) && (words >= uiDecodeWords))
		{
			return true;
		}
	}

	return true;
}

/*
*************************************************************************************
							    SIGNAL GENERATOR
*************************************************************************************
*/

/*
*/
function generator_template()
{
	
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
	
}

/*
*************************************************************************************
							        UTILS
*************************************************************************************
*/

/*
*/
function get_ws_offset()
{
	var trWsFirstPrev = trs_get_first(chWs);
	var trWsFirst = trs_get_next(chWs);
	
	var trWsSecPrev = trs_get_next(chWs);
	var trWsSec = trs_get_next(chWs);

	if (get_trsdiff_samples(trWsSecPrev, trWsSec) > get_trsdiff_samples(trWsFirstPrev, trWsFirst))
	{
		trs_get_first(chWs);
		return trs_get_next(chWs);
	}
	else
	{
		return trs_get_first(chWs);
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
function get_avg_thigh (ch, trSt)
{
	var trSck = get_next_rising_edge(ch, trSt);
	var trSckPrev = trSck;
	trSck = get_next_falling_edge(ch, trSck);

	return (trSck.sample - trSckPrev.sample);
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


/* Get time difference in samples between two transitions
*/
function get_trsdiff_samples (tr1, tr2)
{
	return (tr2.sample - tr1.sample);
}


/* Get time difference in microseconds between two transitions
*/
function get_timediff_us (tr1, tr2)
{
	return (((tr2.sample - tr1.sample) * 1000000) / sample_rate);
}


/*  Get number of samples for the specified duration in microseconds
*/
function get_num_samples_for_us (us)
{
	return ((us * sample_rate) / 1000000 );
}

/*
*/
function get_bit_margin()
{
	return ((5 * sample_rate) / 10000000);
}

