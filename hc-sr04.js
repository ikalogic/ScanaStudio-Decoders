
/*
*************************************************************************************

							SCANASTUDIO 2 HC-SR04 Calibrator

The following commented block allows some related information to be displayed online

1. after a trigger pulse the sensor sends a pulse that is proportional to the distance
2. to calculate distance just divide the pulse width by 58; us/58 = distance in cm
3. maximum claimed accuracy is 3mm
4. range is given as 2 - 400cm
	
<DESCRIPTION>

	HC-SR04
	Not a decoder as such, measures the return pulse from an ultrasonic range finder
	and calculates the distance.  May help to calibrate your device or check the 
	accuracy of your code. Should work for the following: SR04, SRF05, SRF06, DYP-ME007, Parallax PING
	
</DESCRIPTION>

<RELEASE_NOTES>

	V1.05: Added PacketView support.
	V1.00: First release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:ianmac51@gmail.com
	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>

*************************************************************************************
*/


/* The decoder name as it will appear to the users of this script 
*/
function get_dec_name()
{
	return "HC-SR04"; 
}


/* The decoder version 
*/
function get_dec_ver()
{
	return "1.05";
}


/* Author 
*/
function get_dec_auth()
{
	return "IJM";
}


/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
	ui_add_ch_selector("ch", "Channel to decode", "HC-SR04");
}


/*
*/
function get_ch_color (k)
{
	return light_colors.red;
}


/*
*/
function decode()
{	
	
	var newTrans = new transition(0,0); 	//create a new variable t of type "Transition"
	var startOfPulse;						// Start of measuremet pulse
	var endOfPulse;							// End of measurement pulse
	var pulseLen;							// Pulse length
	var distance							// Distance in mm
	var cm = 58;							// constant for calculating cm value

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	var PKT_COLOR_DATA_TITLE = dark_colors.orange;
	var PKT_COLOR_DATA       = get_ch_light_color(ch);

	var pktLenCnt = 0;

	get_ui_vals();							// Get user interface options
	clear_dec_items();						// Clear decoder items
	t = trs_get_first(ch);					// Get the first transition
	pkt_start("HC-SR04");

	while (trs_is_not_last(ch))
	{	
		if (t.val == 1)						// The next transition should be a rising edge 
		{
			startOfPulse = t.sample;
			newTrans = get_next_falling_edge(ch, t);
			endOfPulse = newTrans.sample;								//the new sample length is the end of pulse
			pulseLen = tr_len_us((endOfPulse - startOfPulse));			// get the length of the pulse in samples & convert to uS

			dec_item_new(ch, startOfPulse, endOfPulse);					// decoder display along the pulse length
			dec_item_add_pre_text("Distance = ");
			distance = (pulseLen/cm)*10; 								// calculate the distance in mm

			dec_item_add_data(distance);
			dec_item_add_post_text( "mm");
			dec_item_add_comment("Pulse Length " + pulseLen + "us"); 	//mouse over shows pulse length

			if (pktLenCnt >= 8)
			{
				pkt_end();
				pkt_start("HC-SR04");
				pktLenCnt = 0;
			}

			pktLenCnt++;
			pkt_add_item(-1, -1, "DISTANCE", distance.toString(10) + " mm", PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		}
	}

	pkt_end();
	return true;
}
	

/*  Get number of samples for the specified duration in microseconds
*/
function tr_len_us (us)
{	
	us  = ((us * 1000000) / sample_rate);
	return us  
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


/*
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
