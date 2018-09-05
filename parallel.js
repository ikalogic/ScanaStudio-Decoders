
/*
*************************************************************************************

				  SCANASTUDIO 2 GENERIC PARALLEL BUS DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Generic Parallel Bus Decoder.
	This decoder script will interpret 1 to 8 data lines as a 1 byte bus.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.27  Removed wrong help url
	V1.26  Prevented incompatible workspaces from using the decoder
	V1.25  Added HexView support.
	V1.21: Hotfixes.
	V1.2:  New decoder mode. Now user will be able to decode multiple lines w/o a clock / strobe signal.
	V1.1:  Option "Show Bit Values" removed due to very high CPU usage. 
	       Completely reworked UI and decoder options.
	V1.0:  Initial release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>

<HELP_URL>


</HELP_URL>


*************************************************************************************
*/


/* The decoder name as it will apear to the users of this script
*/
function get_dec_name()
{
	return "Parallel Bus"; 
}


/* The decoder version 
*/
function get_dec_ver()
{
	return "1.27";
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

	var maxNumLines = 9;

	if ((typeof(get_device_max_channels) == 'function') && (typeof(get_device_name) == 'function'))
	{
		maxNumLines = get_device_max_channels();
	}
	else
	{
		ui_add_txt_combo("error", "Please update your ScanaStudio software to use this decoder version");
		return;
	}

	for (var i = 1; i <= 8; i++)
	{
		ui_add_txt_combo("chD" + i, "Data Line " + i + " Channel");
			ui_add_item_to_txt_combo("Not Used");
			
			if( i <= maxNumLines )
			{
				ui_add_item_to_txt_combo("Always High");
				ui_add_item_to_txt_combo("Always Low");

				for (var k = 1; k <= maxNumLines; k++)
				{
					if (i == k)
					{
						ui_add_item_to_txt_combo("CH " + k, true);
					}
					else
					{
						ui_add_item_to_txt_combo("CH " + k);
					}
				}
			}
	}

	ui_add_txt_combo("uiBitOrder", "Bit Order");
		ui_add_item_to_txt_combo("MSB First", true);
		ui_add_item_to_txt_combo("LSB First");

	ui_add_txt_combo("uiClkSource", "Strobe Source");
		ui_add_item_to_txt_combo("All Data Lines", true);

	for (var i = 1; i <= maxNumLines; i++)
	{
		ui_add_item_to_txt_combo("CH " + i);
	}

	ui_add_txt_combo("uiClkEdge","Bit Sampling on");
		ui_add_item_to_txt_combo("Level Change", true);
		ui_add_item_to_txt_combo("Rising Edge");
		ui_add_item_to_txt_combo("Falling Edge");
}


/* Constants 
*/
var DATA_LINE = 
{
	NOT_USED : 0x00,
	ALWAYS_1 : 0x01,
	ALWAYS_0 : 0x02,
	CHANNEL  : 0x03,
};

var CH_OFFSET = 0x03;


/* Object definitions
*/
function TrObj (ch, sample, val)
{
	this.ch = ch;
	this.sample = sample;
	this.val = val;
};


/* Global variables
*/
var chD;


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

	chD = new Array();

	if (chD1 != DATA_LINE.NOT_USED) chD.push(chD1);
	if (chD2 != DATA_LINE.NOT_USED) chD.push(chD2);
	if (chD3 != DATA_LINE.NOT_USED) chD.push(chD3);
	if (chD4 != DATA_LINE.NOT_USED) chD.push(chD4);
	if (chD5 != DATA_LINE.NOT_USED) chD.push(chD5);
	if (chD6 != DATA_LINE.NOT_USED) chD.push(chD6);
	if (chD7 != DATA_LINE.NOT_USED) chD.push(chD7);
	if (chD8 != DATA_LINE.NOT_USED) chD.push(chD8);

	if (uiClkSource > 0)
	{
		uiClkSource--;
		decode_strobe_clk();
	}
	else
	{
		decode_strobe_data();
	}
}

/*
*/
function decode_strobe_clk()
{
	var trClk = trs_get_first(uiClkSource);
	var trClkPrev;

	for (var i = 0; i < chD.length; i++)
	{
		if (chD[i] >= DATA_LINE.CHANNEL)
		{
			trs_get_first(chD[i] - CH_OFFSET);
		}
	}

	while ((trs_is_not_last(uiClkSource) != false))		// Read data for a whole transfer
	{
		if (abort_requested() == true)					// Allow the user to abort this script
		{
			return false;
		}

		set_progress(100 * trClk.sample / n_samples);	// Give feedback to ScanaStudio about decoding progress

		var byteValue = 0;

		switch (uiClkEdge)
		{
			case 0: trClkPrev = trClk;								    // 0 - sampling on level change
					trClk = trs_get_next(uiClkSource);					
			break;

			case 1: trClk = get_next_rising_edge(uiClkSource, trClk);	// 1 - sampling on rising edge
					trClkPrev = trClk;
					trClk = get_next_falling_edge(uiClkSource, trClk);
			break;

		    case 2: trClk = get_next_falling_edge(uiClkSource, trClk);	// 2 - sampling on falling edge
			        trClkPrev = trClk;
			        trClk = get_next_rising_edge(uiClkSource, trClk);
			break;
		}

		var halfPeriod = get_trsdiff_samples(trClkPrev, trClk);
		var samplPoint = trClkPrev.sample;
		var bitValue = 0;

		for (var i = 0; i < chD.length; i++)		// For 1-8 data lines / bits in word (defined by user)
		{
			switch (chD[i])							// Read bit value on desired clock's edge
			{
				case DATA_LINE.NOT_USED: continue;
				break;

				case DATA_LINE.ALWAYS_1: bitValue = 1;
				break;

				case DATA_LINE.ALWAYS_0: bitValue = 0;
				break;

				default: bitValue = sample_val((chD[i] - CH_OFFSET), samplPoint);
				break;
			}

			if (uiBitOrder == 0)					// 0 - MSB first, 1 - LSB first
			{
				if (bitValue == 1)
				{
					byteValue |= (1 << ((chD.length - 1) - i));
				}
			}
			else
			{
				if (bitValue == 1)
				{
					byteValue |= (1 << i);
				}
			}
		}

		if (uiClkEdge != 0)
		{
			dec_item_new(uiClkSource, samplPoint - (halfPeriod / 2), samplPoint + (halfPeriod / 2));
		}
		else
		{
			dec_item_new(uiClkSource, samplPoint - (halfPeriod / 4), samplPoint + (halfPeriod / 4));
		}

		dec_item_add_data(byteValue);
		dec_item_add_comment("0x" + byteValue.toString(16).toUpperCase());
		hex_add_byte((chD1 - CH_OFFSET), -1, -1, byteValue);

		if (trClk == false)
		{
			break;
		}
	}

	return true;
}


/*
*/
function decode_strobe_data()
{
	var trArr = new Array();
	var tr = 0, rRef = 0;
	var trLast = true;
	var bitValue = 0, byteValue = 0;
	var delta = 0;
	var firstIter = true;
	var nearest_tr_ch = 0;

	for (var i = 0; i < chD.length; i++)
	{
		if (chD[i] >= DATA_LINE.CHANNEL)
		{
			tr = trs_get_first(chD[i] - CH_OFFSET);
			trArr.push(new TrObj(chD[i], tr.sample, tr.val));
		}
		else
		{
			trArr.push(new TrObj(chD[i], false, false));
		}
	}

	if (trArr.length == 0)
	{
		return false;
	}

	trRef = new TrObj(0, 0, 0);
	delta = trArr[0].sample - trRef.sample;

	while (true)
	{
		if (abort_requested() == true)		// Allow the user to abort this script
		{
			return false;
		}

		for (var i = 0; i < trArr.length; i++)
		{
			if (trArr[i].ch >= DATA_LINE.CHANNEL)
			{
				if ((trArr[i].sample - trRef.sample) <= delta)
				{
					delta = trArr[i].sample - trRef.sample;
					nearest_tr_ch = i;
				}
			}
		}

		set_progress(100 * trRef.sample / n_samples);	// Give feedback to ScanaStudio about decoding progress

		for (var i = 0; i < trArr.length; i++)
		{
			switch (trArr[i].ch)
			{
				case DATA_LINE.NOT_USED: continue;

				case DATA_LINE.ALWAYS_1: bitValue = 1;
				break;

				case DATA_LINE.ALWAYS_0: bitValue = 0;
				break;

				default: bitValue = trArr[i].val ^ 1;
				break;
			}

			if (uiBitOrder == 0)		// 0 - MSB first, 1 - LSB first
			{
				if (bitValue == 1)
				{
					byteValue |= (1 << ((chD.length - 1) - i));
				}
			}
			else
			{
				if (bitValue == 1)
				{
					byteValue |= (1 << i);
				}
			}
		}

		dec_item_new((chD1 - CH_OFFSET), trRef.sample, trArr[nearest_tr_ch].sample);
		dec_item_add_data(byteValue);
		dec_item_add_comment("0x" + byteValue.toString(16).toUpperCase());
		hex_add_byte((chD1 - CH_OFFSET), -1, -1, byteValue);

		byteValue = 0;
		trRef.sample = trArr[nearest_tr_ch].sample;
		trRef.val = trArr[nearest_tr_ch].val;

		tr = trs_get_next(nearest_tr_ch);

		trArr[nearest_tr_ch].sample = tr.sample;
		trArr[nearest_tr_ch].val = tr.val;
		delta = trArr[nearest_tr_ch].sample - trRef.sample;

		trLast = true;

		if (delta == 0)
		{
			return true;
		}
	}

	return true;
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


/* Get time difference in samples between two transitions
*/
function get_trsdiff_samples (tr1, tr2)
{
	return (tr2.sample - tr1.sample);
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

