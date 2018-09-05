
/*
*************************************************************************************
							
						SCANASTUDIO 2 MANCHESTER DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Manchester Coding (Phase Encoding) Decoder. Widely used signal encoding technique wich ensures frequent line voltage transitions, directly proportional to the clock rate

</DESCRIPTION>

<RELEASE_NOTES>

	V1.2: Removed wrong help url
	V1.1: Added offset and logic 1 state convention options.
	V1.0: Initial release.

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
	return "Manchester"; 
}


/* The decoder version 
*/
function get_dec_ver()
{
	return "1.2";
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
	
	ui_add_ch_selector("chD", "Data Line", "Data");

	ui_add_txt_combo("uiLogic1Conv","Logic 1 state convention");
		ui_add_item_to_txt_combo("Transition from 1 to 0", true);
		ui_add_item_to_txt_combo("Transition from 0 to 1");

	ui_add_txt_combo("uiOffset","Skip first n Transitions");
		ui_add_item_to_txt_combo("None", true);
		ui_add_item_to_txt_combo("1 transition");
		ui_add_item_to_txt_combo("2 transitions");
}


/* Constants 
*/
var T_TOLERANCE = 200;

var SIGOBJECT_TYPE = 
{
	ONE_T   : 0x01,
	TWO_T   : 0x02,
	UNKNOWN : 0x04,
};


/* Object definitions
*/
function SigObject (type, value, start, end)
{
	this.type = type;
	this.value = value;
	this.start = start;
	this.end = end;
};


/* Global variables
*/
var sigArr;
var oneT, twoT;


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();				// Update the content of all user interface related variables
	clear_dec_items();			// Clears all the the decoder items and its content

	sigArr = new Array();

	if (decode_manchester() != true)
	{
		return false;
	}

	while (sigArr.length > 0)	// Dsiplay all
	{
		var sigObject = sigArr.shift();

		if (sigObject.type == SIGOBJECT_TYPE.ONE_T)
		{
			var tempObject = sigArr.shift();

			if (tempObject.type != SIGOBJECT_TYPE.ONE_T)
			{
				sigArr.unshift(tempObject);
			}
		}
		else if (sigObject.type == SIGOBJECT_TYPE.TWO_T)
		{
			var tempObject = sigArr.shift();

			if (tempObject.type != SIGOBJECT_TYPE.ONE_T)
			{
				sigArr.unshift(tempObject);
			}
		}

		if (sigObject.type != SIGOBJECT_TYPE.UNKNOWN)
		{
			dec_item_new(chD, sigObject.end - (oneT / 2), sigObject.end + (oneT / 2));
			
			if (uiLogic1Conv == 0)
			{
				dec_item_add_post_text(sigObject.value ? 0 : 1);
			}
			else
			{
				dec_item_add_post_text(sigObject.value);
			}
		}
	}
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
		add_to_err_log("Error. Selected channel doesn't have any valid Manchester encoded signal");
		return false;
	}

	return true;
}


/*
*/
function decode_manchester()
{
	if (sync() != true)
	{
		return false;
	}

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
			sigArr.push(new SigObject(SIGOBJECT_TYPE.TWO_T, bitValue, trDPrev.sample, trD.sample));
		}
		else if ((tDiff >= oneT - tMax1TTolerance) && (tDiff <= oneT + tMax1TTolerance))			// 1T
		{
			sigArr.push(new SigObject(SIGOBJECT_TYPE.ONE_T, bitValue, trDPrev.sample, trD.sample));
		}
		else
		{
			sigArr.push(new SigObject(SIGOBJECT_TYPE.UNKNOWN, false, trDPrev.sample, trD.sample));
		}
	}

	return true;
} 


/*
*/
function get_max_tolerance (value)
{
	return ((value / 100) * 35);
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




