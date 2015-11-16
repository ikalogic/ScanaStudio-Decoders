
/*
*************************************************************************************

							SCANASTUDIO 2 MB1003 Range decoder

The following commented block allows some related information to be displayed online

<DESCRIPTION>

	Measures the distance output pulse from an HRLV-MaxSonar MB1003 ultrasonic range finder
	and calculates the distance.  
	
</DESCRIPTION>


<RELEASE_NOTES>

	V1.05: Added PacketView support.
	V1.01: Modified by Chris Mower for the HRLV-MaxSonar EZ.
	V1.00: First release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:ianmac51@gmail.com
	mailto:v.kosinov@ikalogic.com
    modifications by mailto:chris.mower@gmail.com

</AUTHOR_URL>

Full description
================
MB1003
	The MB1003 Ultrasonic Range Finder provides three range data outputs.
    1. RS232 output on pin 5 in the format Rnnnn<CR> ( example R1154 would be 1.154 meters
    2. Pulse width representation of the range on pin 2 with 1uS = 1mm
    3. Analog voltage on pin 3 with a scaling factor of (Vcc/5120) per mm.
    
    This decoder looks for a rising edge followed by a falling edge and takes the 
    time in uS between them. Since the MB1003 conveniently has 1mm to 1uS we just 
    display this data as distance. 
*************************************************************************************
*/


/* The decoder name as it will appear to the users of this script 
*/
function get_dec_name()
{
	return "MB1003"; 
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
	return "IJM/DCM";
}


/* Graphical user interface for this decoder
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
	ui_add_ch_selector("ch", "Channel to decode", "MB1003");
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
	
	var newTrans = new transition(0,0); 	// create a new variable t of type "Transition"
	var startOfPulse;						// Start of measuremet pulse
	var endOfPulse;							// End of measurement pulse
	var pulseLen;							// Pulse length
	var distance							// Distance in mm

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	var PKT_COLOR_DATA_TITLE = dark_colors.orange;
	var PKT_COLOR_DATA       = get_ch_light_color(ch);

	var pktLenCnt = 0;

	get_ui_vals();							// Get user interface options
	clear_dec_items(); 						// Clear decoder items
	newTrans = trs_get_first(ch);			// Get the first transition

	while (trs_is_not_last(ch))
	{
		newTrans = get_next_rising_edge(ch, newTrans);
	    startOfPulse = newTrans.sample; 							//the new sample length is the end of pulse
	    newTrans = get_next_falling_edge(ch, newTrans);
	    endOfPulse = newTrans.sample; 								//the new sample length is the end of pulse
	    pulseLen = tr_len_us((endOfPulse - startOfPulse)); 			// get the length of the pulse in samples & convert to uS

	    dec_item_new(ch, startOfPulse, endOfPulse); 				// decoder display along the pulse length
	    dec_item_add_pre_text("Distance = ");
	    distance = pulseLen; 										// With the MB1003 the distance in mm is equal to the pulse length in uS

	    dec_item_add_data(distance);
	    dec_item_add_post_text("mm");
	    dec_item_add_comment("Pulse Length " + pulseLen + "us");	// mouse over shows pulse length

		pkt_start("MB1003");
		pkt_add_item(-1, -1, "DISTANCE", distance.toString(10) + " mm", PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		pkt_end();
	}

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
