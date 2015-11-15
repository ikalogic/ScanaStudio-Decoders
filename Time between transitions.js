/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Protocol to see the time between transitions.

</DESCRIPTION>
<RELEASE_NOTES>

		V1.0:  Initial release

</RELEASE_NOTES>
<AUTHOR_URL>

	mailto:a.a.debien@ikalogic.com

</AUTHOR_URL></AUTHOR_URL>

<HELP_URL>



</HELP_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "Time between transitions";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.0";
}

/* Author 
*/
function get_dec_auth()
{
	return "IKALOGIC";
}

/* Graphical user interface for this decoder 
*/
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch", "Channel to decode", "" );
}

function decode()
{
	var spb;	//samples per bit
	var m;		//margin between blocks
	var transition_next,transition;
	var time;
	var unity = ""

	get_ui_vals();                // Update the content of user interface variables
	
	var t = trs_get_first(ch);	
	transition = t.sample;
	t = trs_get_next(ch);
	transition_next = t.sample;
	
	while (trs_is_not_last(ch))
	{
		dec_item_new(ch, transition, transition_next);
		time = (transition_next - transition) / sample_rate;
		time *= 1000000;
			
		dec_item_add_pre_text(time.toFixed(2)+" us");
		
		transition = transition_next;
		t = trs_get_next(ch);
		transition_next = t.sample;
	}
}



