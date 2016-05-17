/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	simple description for decoder

</DESCRIPTION>

<RELEASE_NOTES>

	V1.0:  Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:www.site.com

</AUTHOR_URL>

<HELP_URL>



</HELP_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "my_test_protocol";
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
	return "me";
}

/* Graphical user interface for this decoder 
*/
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch", "Channel to decode:", "" );
	ui_add_txt_combo( "polarity", "Pulse polarity" );
		ui_add_item_to_txt_combo( "Logic High", true );
		ui_add_item_to_txt_combo( "Logic Low" );
}

function decode()
{
	get_ui_vals();                // Update the content of user interface variables
	clear_dec_items();            // Clears all the the decoder items and its content
	
	var last  = trs_get_first(ch);
	var transition = trs_get_first(ch);
	var width_us;
	
	while (trs_is_not_last(ch))
	{
		width_us = 1e6*(transition.sample - last.sample) / get_sample_rate();
		
		if (transition.val == polarity)
		{
			dec_item_new(ch,last.sample,transition.sample);
			dec_item_add_pre_text(width_us + "(us)");			
		}	
	
		set_progress(transition.sample/get_n_samples());	
		
		last = transition;
		transition = trs_get_next();
	}
}




