/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	test decoder

</DESCRIPTION>
<RELEASE_NOTES>

	V1.0:  Initial release

</RELEASE_NOTES>
<AUTHOR_URL>

	mailto:mailto:ika@ikalogic.com

</AUTHOR_URL></AUTHOR_URL></AUTHOR_URL>

<HELP_URL>



</HELP_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "test 2";
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
	return "ika";
}

/* Graphical user interface for this decoder 
*/
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_txt_combo( "COMBO", "Text combo:" );
	ui_add_baud_selector( "BAUD_SELECTOR", "BAUD rate:", 9600 );
	ui_add_ch_selector( "CH_SELECTOR", "Channel to decode:", "" );
	ui_add_separator();
	ui_add_info_label( "Info text" );
}

function decode()
{
	get_ui_vals();                // Update the content of user interface variables
	clear_dec_items();            // Clears all the the decoder items and its content
}
