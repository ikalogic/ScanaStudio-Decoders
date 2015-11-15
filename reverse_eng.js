/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	A decoder to help uderstanding the communication protocol between a micro controller and an unknown SOIC16 chip

</DESCRIPTION>
<RELEASE_NOTES>

		V1.0:  Initial release

</RELEASE_NOTES>
<AUTHOR_URL>

	mailto:

</AUTHOR_URL></AUTHOR_URL>

<HELP_URL>



</HELP_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "reverse_eng";
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
	return "John";
}

/* Graphical user interface for this decoder 
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
}

function decode()
{
	get_ui_vals();                // Update the content of user interface variables
	clear_dec_items();            // Clears all the the decoder items and its content
	
	/*
	*	Your decoder script goes here
	*/
}

