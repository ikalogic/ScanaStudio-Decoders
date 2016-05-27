/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	MODBUS Protocol is a messaging structure, widely used to establish master-slave communication between intelligent devices. A MODBUS message sent from a master to a slave contains the address of the slave, the 'command' (e.g. 'read register' or 'write register'), the data, and a check sum (LRC or CRC).  Since Modbus protocol is just a messaging structure, it is independent of the underlying physical layer. It is traditionally implemented using RS232, RS422, or RS485

</DESCRIPTION>

<RELEASE_NOTES>

	V1.21: Correct function recognisation
	V1.2:   Add inverting capability
	V1.1:   Add generator, demo and trigger capability
	V1.0:   Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:n.bastit@ikalogic.com

</AUTHOR_URL>

<HELP_URL>



</HELP_URL>

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
	return "MODBUS";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.21";
}

/* Author 
*/
function get_dec_auth()
{
	return "Nicolas BASTIT";
}

/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/

var channel_color;
var PARITY_NONE = 0;
var PARITY_ODD = 1;
var PARITY_EVEN = 2;

var ch;
var baud;
var parity;
var nbits;
var invert;
var samples_per_bit;

var trig_bit_sequence = [];

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* Graphical user interface for this decoder 
*/
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "CH_SELECTOR", "Channel to decode:", "" );
	ui_add_baud_selector( "BAUD_SELECTOR", "BAUD rate:", 9600 );
	ui_add_txt_combo( "PARITY_SELECTOR", "Parity bit:" );
		ui_add_item_to_txt_combo( "No parity bit", true );
		ui_add_item_to_txt_combo( "Odd parity bit" );
		ui_add_item_to_txt_combo( "Even parity bit" );
	ui_add_txt_combo( "invert", "Inverted logic" );
		ui_add_item_to_txt_combo( "Non inverted logic (default)", true );
		ui_add_item_to_txt_combo( "Inverted logic: All signals inverted" );
	ui_add_separator();
	ui_add_txt_combo( "MODE_SELECTOR", "Mode:" );
		ui_add_item_to_txt_combo( "Modbus ASCII", true );
		ui_add_item_to_txt_combo( "Modbus RTU" );
}

function decode()
{
	get_ui_vals();                // Update the content of user interface variables
	clear_dec_items();            // Clears all the the decoder items and its content
	
	channel_color = get_ch_light_color(CH_SELECTOR);
	
	if(MODE_SELECTOR == 0)
		decode_ASCII();
	else
		decode_RTU();
}

function decode_RTU()
{
	var i;
	var state = 0;
	var t;
	var t_sample;
	var t_first;
  	var buffer;
  	var buffer_temp = new Array();
	var i_fct;
	var k;
	var val;
	var spb;
	var trame = [];
	var fct;
	var crc_red;
	var crc;
  	get_ui_vals();                // Update the content of user interface variables
  	clear_dec_items();            // Clears all the the decoder items and its content
	
	var stop_bit;
	if (PARITY_SELECTOR == PARITY_NONE)
		stop_bit=2;
	else
		stop_bit=0;
  
  	buffer = pre_decode("uart.js","ch = "+ CH_SELECTOR +"; baud = "+ BAUD_SELECTOR +"; nbits = 3; parity = "+ PARITY_SELECTOR +"; stop = "+ stop_bit +"; order = 0; invert = "+ invert);
  
  	// Remove any element that do not contain data, e.g.: Start, Stop
  	for (i = 0; i < buffer.length; i++) 
	{ 
		if (buffer[i].data.length > 0)
    	{
      		buffer_temp.push(buffer[i]);
    	}
	}

  	buffer = buffer_temp;
    
	spb = sample_rate / BAUD_SELECTOR;
	t_first =  trs_get_first(CH_SELECTOR).sample;	

	for (i = 0; i < buffer.length; i++)
  	{
    	switch(state)
    	{
      	case 0: 
        	if (i < (buffer.length-1))
        	{
     			t=trs_go_before(CH_SELECTOR,buffer[i].start_s - spb);
				t_sample = t.sample;
				t = trs_get_prev(CH_SELECTOR);
				if( (t_first <= t_sample) && (t_sample - t.sample >= 28*spb) )
				{
					state = 1;
					fct = 0;
					trame = [];
					
					dec_item_new(CH_SELECTOR,buffer[i].start_s-12*spb,buffer[i].start_s-2*spb);
	              	dec_item_add_pre_text("Start of Frame "); //Maximum zoom
	              	dec_item_add_pre_text("Start frame ");
	              	dec_item_add_pre_text("SOF ");
	              	dec_item_add_pre_text("S ");//Minimum zoom
					
					pkt_start("Modbus RTU");
					pkt_add_item(buffer[i].start_s - 12*spb, buffer[i].start_s - 2*spb, "Start", "", dark_colors.blue, channel_color);
				}
				else
				{
					state = 0;
					pkt_end();
					break;
				}
        	}
			else
			{
				state = 0;
				pkt_end();
			}
      	case 1:
			if (i< buffer.length-1)
			{
				dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i].end_s);
              	dec_item_add_pre_text("Address : "); //Maximum zoom
              	dec_item_add_pre_text("Addr : ");
              	dec_item_add_pre_text("Add ");
              	dec_item_add_pre_text("@ ");//Minimum zoom
				dec_item_add_data(buffer[i].data[0]);
				
				pkt_add_item(-1, -1, "Address", buffer[i].data[0], dark_colors.green, channel_color);
				
				hex_add_byte(CH_SELECTOR, -1, -1, buffer[i].data[0]);
				
				trame[trame.length] = buffer[i].data[0];
				
				state = 2;
			}
			else
			{
        		state = 0;
				pkt_end();
			}
      		break;
		case 2:
			if (i< buffer.length-1)
			{
				hex_add_byte(CH_SELECTOR, -1, -1, buffer[i].data[0]);
				
				i_fct = i;
				fct = buffer[i].data[0];
				trame[trame.length] = buffer[i].data[0];
				
				state = 3;
			}
			else
			{
        		state = 0;
				pkt_end();
			}
      		break;
		case 3:
			if (i < buffer.length)
			{
				t=trs_go_after(CH_SELECTOR,buffer[i].end_s + spb*2);
				t_sample = t.sample;
				if( (t_sample - buffer[i].end_s >= 28*spb) || (!trs_is_not_last(CH_SELECTOR)) )
				{
					switch(fct)
					{
						case 0x01:
						case 0x02:
							if (i-i_fct==6)
							{//requete
								
								dec_item_new(CH_SELECTOR,buffer[i_fct].start_s,buffer[i_fct].end_s);
				              	dec_item_add_pre_text("Function : "); //Maximum zoom
				              	dec_item_add_pre_text("Funct : ");
				              	dec_item_add_pre_text("Fct ");
				              	dec_item_add_pre_text("F ");//Minimum zoom
								dec_item_add_data(buffer[i_fct].data[0]);
								function_to_str(buffer[i_fct].data[0], "Request");
								
								for(k=i_fct+1;k<i-1;k++)
								{
									switch(k-(i_fct+1))
									{
										case 0:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Starting Address Hi : ");
											pkt_add_item(-1, -1, "Starting Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 1:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											dec_item_add_pre_text("Coil Address Lo : ");
											pkt_add_item(-1, -1, "Starting Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 2:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(fct==0x01)
											{
							              		dec_item_add_pre_text("Quantity of Coils Hi : ");
												pkt_add_item(-1, -1, "Quantity of Coils Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
							              		dec_item_add_pre_text("Quantity of inputs Hi : ");
												pkt_add_item(-1, -1, "Quantity of inputs Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 3:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(fct==0x01)
											{
							              		dec_item_add_pre_text("Quantity of Coils Lo : ");
												pkt_add_item(-1, -1, "Quantity of Coils Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
							              		dec_item_add_pre_text("Quantity of inputs Lo : ");
												pkt_add_item(-1, -1, "Quantity of inputs Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										default :
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Data : ");
											dec_item_add_data(buffer[k].data[0]);
											pkt_add_item(-1, -1, "Data", buffer[k].data[0], light_colors.yellow, channel_color);
											break;
									}
									
									trame[trame.length] = buffer[k].data[0];
									
									
									hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
								}
							}
							else
							{//reponse
								
								dec_item_new(CH_SELECTOR,buffer[i_fct].start_s,buffer[i_fct].end_s);
				              	dec_item_add_pre_text("Function : "); //Maximum zoom
				              	dec_item_add_pre_text("Funct : ");
				              	dec_item_add_pre_text("Fct ");
				              	dec_item_add_pre_text("F ");//Minimum zoom
								dec_item_add_data(buffer[i_fct].data[0]);
								function_to_str(buffer[i_fct].data[0], "Response");
								
								
								for(k=i_fct+1;k<i-1;k++)
								{
									switch(k-(i_fct+1))
									{
										case 0:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Byte Count : ");
											pkt_add_item(-1, -1, "Byte Count", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										default :
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Data : ");
											dec_item_add_data(buffer[k].data[0]);
											pkt_add_item(-1, -1, "Data", buffer[k].data[0], light_colors.yellow, channel_color);
											break;
									}
									
									trame[trame.length] = buffer[k].data[0];
									
									
									hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
								}
							}
							break;
							
						case 0x03:
						case 0x04:
							if (i-i_fct==6)
							{//requete
								
								dec_item_new(CH_SELECTOR,buffer[i_fct].start_s,buffer[i_fct].end_s);
				              	dec_item_add_pre_text("Function : "); //Maximum zoom
				              	dec_item_add_pre_text("Funct : ");
				              	dec_item_add_pre_text("Fct ");
				              	dec_item_add_pre_text("F ");//Minimum zoom
								dec_item_add_data(buffer[i_fct].data[0]);
								function_to_str(buffer[i_fct].data[0], "Request");
								
								
								for(k=i_fct+1;k<i-1;k++)
								{
									switch(k-(i_fct+1))
									{
										case 0:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Starting Address Hi : ");
											pkt_add_item(-1, -1, "Starting Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 1:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											dec_item_add_pre_text("Starting Address Lo : ");
											pkt_add_item(-1, -1, "Starting Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 2:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Quantity of Registers Hi : ");
											pkt_add_item(-1, -1, "Quantity of Registers Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 3:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Quantity of Registers Lo : ");
											pkt_add_item(-1, -1, "Quantity of Registers Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										default :
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Data : ");
											dec_item_add_data(buffer[k].data[0]);
											pkt_add_item(-1, -1, "Data", buffer[k].data[0], light_colors.yellow, channel_color);
											break;
									}
									
									trame[trame.length] = buffer[k].data[0];
									
									
									hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
								}
							}
							else
							{//reponse
								
								dec_item_new(CH_SELECTOR,buffer[i_fct].start_s,buffer[i_fct].end_s);
				              	dec_item_add_pre_text("Function : "); //Maximum zoom
				              	dec_item_add_pre_text("Funct : ");
				              	dec_item_add_pre_text("Fct ");
				              	dec_item_add_pre_text("F ");//Minimum zoom
								dec_item_add_data(buffer[i_fct].data[0]);
								function_to_str(buffer[i_fct].data[0], "Responce");
								
								
								for(k=i_fct+1;k<i-1;k++)
								{
									switch(k-(i_fct+1))
									{
										case 0:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Byte Count : ");
											pkt_add_item(-1, -1, "Byte Count", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										default :
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(k%2)
											{
							              		dec_item_add_pre_text("Data Hi : ");
												pkt_add_item(-1, -1, "Data Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
							              		dec_item_add_pre_text("Data Lo : ");
												pkt_add_item(-1, -1, "Data Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
									}
									
									trame[trame.length] = buffer[k].data[0];
									
									
									hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
								}
							}
							break;
							
						case 0x05:
						case 0x06:
							for(k=i_fct+1;k<i-1;k++)
							{
								switch(k-(i_fct+1))
								{
									case 0:
										dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
										if (fct==0x05)
										{
						              		dec_item_add_pre_text("Coil Address Hi : ");
											pkt_add_item(-1, -1, "Coil Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
										}
										else
										{
						              		dec_item_add_pre_text("Register Address Hi : ");
											pkt_add_item(-1, -1, "Register Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
										}
										dec_item_add_data(buffer[k].data[0]);
										break;
										
									case 1:
										dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
										if (fct==0x05)
										{
						              		dec_item_add_pre_text("Coil Address Lo : ");
											pkt_add_item(-1, -1, "Coil Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
										}
										else
										{
						              		dec_item_add_pre_text("Register Address Lo : ");
											pkt_add_item(-1, -1, "Register Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
										}
										dec_item_add_data(buffer[k].data[0]);
										break;
										
									case 2:
										dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
						              	dec_item_add_pre_text("Write Data Hi : ");
										pkt_add_item(-1, -1, "Write Data Hi", buffer[k].data[0], light_colors.yellow, channel_color);
										dec_item_add_data(buffer[k].data[0]);
										break;
										
									case 3:
										dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
						              	dec_item_add_pre_text("Write Data Lo : ");
										pkt_add_item(-1, -1, "Write Data Lo", buffer[k].data[0], light_colors.yellow, channel_color);
										dec_item_add_data(buffer[k].data[0]);
										break;
										
									default :
										dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
						              	dec_item_add_pre_text("Data : ");
										dec_item_add_data(buffer[k].data[0]);
										pkt_add_item(-1, -1, "Data", buffer[k].data[0], light_colors.yellow, channel_color);
										break;
								}
								
								trame[trame.length] = buffer[k].data[0];
								
								
								hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
							}
							break;
						
						case 0x0F:
						case 0x10:
						if (i-i_fct==6)
							{//reponse
								
								dec_item_new(CH_SELECTOR,buffer[i_fct].start_s,buffer[i_fct].end_s);
				              	dec_item_add_pre_text("Function : "); //Maximum zoom
				              	dec_item_add_pre_text("Funct : ");
				              	dec_item_add_pre_text("Fct ");
				              	dec_item_add_pre_text("F ");//Minimum zoom
								dec_item_add_data(buffer[i_fct].data[0]);
								function_to_str(buffer[i_fct].data[0], "Response");
								
								
								for(k=i_fct+1;k<i-1;k++)
								{
									switch(k-(i_fct+1))
									{
										case 0:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if (fct==0x10)
											{
								              	dec_item_add_pre_text("Starting Address Hi : ");
												pkt_add_item(-1, -1, "Starting Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
								              	dec_item_add_pre_text("Coil Address Hi : ");
												pkt_add_item(-1, -1, "Coil Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 1:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if (fct==0x10)
											{
								              	dec_item_add_pre_text("Starting Address Lo : ");
												pkt_add_item(-1, -1, "Starting Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
								              	dec_item_add_pre_text("Coil Address Lo : ");
												pkt_add_item(-1, -1, "Coil Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 2:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(fct==0x0F)
											{
							              		dec_item_add_pre_text("Quantity of Coils Hi : ");
												pkt_add_item(-1, -1, "Quantity of Coils Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
							              		dec_item_add_pre_text("Quantity of Registers Hi : ");
												pkt_add_item(-1, -1, "Quantity of Registers Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 3:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(fct==0x0F)
											{
							              		dec_item_add_pre_text("Quantity of Coils Lo : ");
												pkt_add_item(-1, -1, "Quantity of Coils Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
							              		dec_item_add_pre_text("Quantity of Registers Lo : ");
												pkt_add_item(-1, -1, "Quantity of Registers Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										default :
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Data : ");
											dec_item_add_data(buffer[k].data[0]);
											pkt_add_item(-1, -1, "Data", buffer[k].data[0], light_colors.yellow, channel_color);
											break;
									}
									
									trame[trame.length] = buffer[k].data[0];
									
									
									hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
								}
							}
							else
							{//request
								
								dec_item_new(CH_SELECTOR,buffer[i_fct].start_s,buffer[i_fct].end_s);
				              	dec_item_add_pre_text("Function : "); //Maximum zoom
				              	dec_item_add_pre_text("Funct : ");
				              	dec_item_add_pre_text("Fct ");
				              	dec_item_add_pre_text("F ");//Minimum zoom
								dec_item_add_data(buffer[i_fct].data[0]);
								function_to_str(buffer[i_fct].data[0], "Request");
								
								
								for(k=i_fct+1;k<i-1;k++)
								{
									switch(k-(i_fct+1))
									{
										case 0:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if (fct==0x10)
											{
								              	dec_item_add_pre_text("Starting Address Hi : ");
												pkt_add_item(-1, -1, "Starting Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
								              	dec_item_add_pre_text("Coil Address Hi : ");
												pkt_add_item(-1, -1, "Coil Address Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 1:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if (fct==0x10)
											{
								              	dec_item_add_pre_text("Starting Address Lo : ");
												pkt_add_item(-1, -1, "Starting Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
								              	dec_item_add_pre_text("Coil Address Lo : ");
												pkt_add_item(-1, -1, "Coil Address Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 2:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(fct==0x0F)
											{
							              		dec_item_add_pre_text("Quantity of Coils Hi : ");
												pkt_add_item(-1, -1, "Quantity of Coils Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
							              		dec_item_add_pre_text("Quantity of Registers Hi : ");
												pkt_add_item(-1, -1, "Quantity of Registers Hi", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 3:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(fct==0x0F)
											{
							              		dec_item_add_pre_text("Quantity of Coils Lo : ");
												pkt_add_item(-1, -1, "Quantity of Coils Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											else
											{
							              		dec_item_add_pre_text("Quantity of Registers Lo : ");
												pkt_add_item(-1, -1, "Quantity of Registers Lo", buffer[k].data[0], light_colors.yellow, channel_color);
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										case 4:
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
							              	dec_item_add_pre_text("Byte Count : ");
											pkt_add_item(-1, -1, "Byte Count", buffer[k].data[0], light_colors.yellow, channel_color);
											dec_item_add_data(buffer[k].data[0]);
											break;
											
										default :
											dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
											if(k%2)
											{
												if(fct==0x10)
												{
								              		dec_item_add_pre_text("Data Hi : ");
													pkt_add_item(-1, -1, "Data Hi", buffer[k].data[0], light_colors.yellow, channel_color);
												}
												else
												{
								              		dec_item_add_pre_text("Write Data Hi : ");
													pkt_add_item(-1, -1, "Write Data Hi", buffer[k].data[0], light_colors.yellow, channel_color);
												}
											}
											else
											{
												if(fct==0x10)
												{
								              		dec_item_add_pre_text("Data Lo : ");
													pkt_add_item(-1, -1, "Data Lo", buffer[k].data[0], light_colors.yellow, channel_color);
												}
												else
												{
								              		dec_item_add_pre_text("Write Data Lo : ");
													pkt_add_item(-1, -1, "Write Data Lo", buffer[k].data[0], light_colors.yellow, channel_color);
												}
											}
											dec_item_add_data(buffer[k].data[0]);
											break;
									}
									
									trame[trame.length] = buffer[k].data[0];
									
									
									hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
								}
							}
							break;
							
						default:
								
							dec_item_new(CH_SELECTOR,buffer[i_fct].start_s,buffer[i_fct].end_s);
			              	dec_item_add_pre_text("Function : "); //Maximum zoom
			              	dec_item_add_pre_text("Funct : ");
			              	dec_item_add_pre_text("Fct ");
			              	dec_item_add_pre_text("F ");//Minimum zoom
							dec_item_add_data(buffer[i_fct].data[0]);
							function_to_str(buffer[i_fct].data[0], "");
								
								
							pkt_start("Data");
							for(k=i_fct+1;k<i-1;k++)
							{
								dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k].end_s);
				              	dec_item_add_pre_text("Data : ");
								dec_item_add_data(buffer[k].data[0]);
								
								trame[trame.length] = buffer[k].data[0];
								
								pkt_add_item(-1, -1, "Data", buffer[k].data[0], light_colors.yellow, channel_color);
								
								hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
							}
							pkt_end();
							break;
					}
					
				
					crc = crc_calculation(trame);
					
					crc_red = buffer[i-1].data[0]+ buffer[i].data[0]*0x100 ;
					dec_item_new(CH_SELECTOR,buffer[i-1].start_s,buffer[i].end_s);
	              	dec_item_add_pre_text("CRC "); //Maximum zoom
					dec_item_add_data(crc_red);
						
					hex_add_byte(CH_SELECTOR, -1, -1, buffer[i-1].data[0]);
					hex_add_byte(CH_SELECTOR, -1, -1, buffer[i].data[0]);
					
					if (crc==crc_red)
					{
						dec_item_add_post_text(" OK");
						pkt_add_item(-1, -1, "CRC OK", int_to_str_hex(crc_red), light_colors.orange, channel_color);
					}
					else
					{
	              		dec_item_add_post_text(" WRONG ! Should be " + int_to_str_hex(crc));
	              		dec_item_add_post_text(" ! " + int_to_str_hex(crc));
	              		dec_item_add_post_text("!");
						pkt_add_item(-1, -1, "CRC WRONG !", int_to_str_hex(crc_red), dark_colors.red, channel_color);
						pkt_start("CRC ERROR");
						pkt_add_item(-1,-1, "Should be :", int_to_str_hex(crc), dark_colors.orange, channel_color);
						pkt_end();
					}
				
					dec_item_new(CH_SELECTOR,buffer[i].end_s+spb,buffer[i].end_s+9*spb);
	              	dec_item_add_pre_text("End of Frame"); //Maximum zoom
	              	dec_item_add_pre_text("End Frame");
	              	dec_item_add_pre_text("EOF");
	              	dec_item_add_pre_text("E");
		
					pkt_add_item(-1,-1, "End of Frame", "", light_colors.blue, channel_color);
		
					state = 0;
					pkt_end();
				}
			}
			else
			{
				state = 0;
				pkt_end();
			}
			break;
		
    	}
  	}
}

function decode_ASCII()
{
	var i;
	var state = 0;
  	var buffer;
  	var buffer_temp = new Array();
	var i_fct;
	var k;
	var p=0;
	var lrc;
	var lrc_red;
	var val;
  	get_ui_vals();                // Update the content of user interface variables
  	clear_dec_items();            // Clears all the the decoder items and its content
	
	var stop_bit;
	if (PARITY_SELECTOR == PARITY_NONE)
		stop_bit=2;
	else
		stop_bit=0;
  
  	buffer = pre_decode("uart.js","ch = "+ CH_SELECTOR +"; baud = "+ BAUD_SELECTOR +"; nbits = 2; parity = "+ PARITY_SELECTOR +"; stop = "+ stop_bit +"; order = 0; invert = "+ invert);
  
  	// Remove any element that do not contain data, e.g.: Start, Stop
  	for (i = 0; i < buffer.length; i++) 
	{ 
		if (buffer[i].data.length > 0)
    	{
      		buffer_temp.push(buffer[i]);
    	}
	}

  	buffer = buffer_temp;
    
	pkt_end();
  	for (i = 0; i < buffer.length; i++)
  	{
    	switch(state)
    	{
      	case 0: //Search for start of frame sequence (:)
			lrc = 0;
			p = 0;
			pkt_end();
        	if (i < (buffer.length-1))
        	{
          
          		if (buffer[i].data[0] == ":".charCodeAt(0)) 
          		{  
            		dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i].end_s);
	              	dec_item_add_pre_text("Start of Frame "); //Maximum zoom
	              	dec_item_add_pre_text("Start frame ");
	              	dec_item_add_pre_text("SOF ");
	              	dec_item_add_pre_text("S ");//Minimum zoom
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
					dec_item_add_post_text(":");
	            	state = 1;
		
					pkt_start("Modbus ASCII");
					pkt_add_item(-1, -1, "Start", ":", dark_colors.blue, channel_color);
					
					hex_add_byte(CH_SELECTOR, -1, -1, buffer[i].data[0]);
	         	}
        	}
      		break;
      	case 1:
			if (i< buffer.length-2)
			{
				if(buffer[i].data[0] < 58)
					val= (buffer[i].data[0] - 0x30)*16;
				else
					val= (buffer[i].data[0] - 55)*16;
				if(buffer[i+1].data[0] < 58)
					val+= buffer[i+1].data[0] - 0x30;
				else
					val+= buffer[i+1].data[0] - 55;
			
            	dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i+1].end_s);
              	dec_item_add_pre_text("Address : "); //Maximum zoom
              	dec_item_add_pre_text("Addr : ");
              	dec_item_add_pre_text("Add ");
              	dec_item_add_pre_text("@ ");//Minimum zoom
				dec_item_add_data(val);
				
				pkt_add_item(-1, -1, "Address", val, dark_colors.green, channel_color);
				
				hex_add_byte(CH_SELECTOR, -1, -1, buffer[i].data[0]);
				hex_add_byte(CH_SELECTOR, -1, -1, buffer[i+1].data[0]);
				
				lrc += val;
					
            	state = 2;
				i++;
			}
			else
			{
        		state = 0; // Start fetching for start of frame again.
				pkt_end();
			}
      		break;
		case 2:
			if (i < buffer.length-2)
			{
				if(buffer[i].data[0] < 58)
					val= (buffer[i].data[0] - 0x30)*16;
				else
					val= (buffer[i].data[0] - 55)*16;
				if(buffer[i+1].data[0] < 58)
					val+= buffer[i+1].data[0] - 0x30;
				else
					val+= buffer[i+1].data[0] - 55;
					
				dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i+1].end_s);
              	dec_item_add_pre_text("Function : "); //Maximum zoom
              	dec_item_add_pre_text("Funct : ");
              	dec_item_add_pre_text("Fct ");
              	dec_item_add_pre_text("F ");//Minimum zoom
				dec_item_add_data(val);
				
				hex_add_byte(CH_SELECTOR, -1, -1, buffer[i].data[0]);
				hex_add_byte(CH_SELECTOR, -1, -1, buffer[i+1].data[0]);
				
				lrc+= val;
				
				function_to_str(val);
				
            	state = 3;
				i++;
				i_fct = i;
			}
			else
			{
        		state = 0; // Start fetching for start of frame again.
				pkt_end();
			}
      		break;
		case 3:
			if (i < buffer.length-1)
			{
				if (  (buffer[i].data[0] == "\r\n".charCodeAt(0))
					&&(buffer[i+1].data[0] == "\r\n".charCodeAt(1)) )
				{
					pkt_start("Data");
					
					for(k=i_fct+1;k<i-2;k++)
					{
						p++;
						if(p%2 == 0)
						{
							if(buffer[k].data[0] < 58)
								val+= buffer[k].data[0] - 0x30;
							else
								val+= buffer[k].data[0] - 55;
								
							lrc += val;
							
							dec_item_new(CH_SELECTOR,buffer[k-1].start_s,buffer[k].end_s);
							dec_item_add_data(val);
							
							hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
							
							pkt_add_item(-1, -1, "Data", val, light_colors.yellow, channel_color);
						}
						else
						{
							if(buffer[k].data[0] < 58)
								val= (buffer[k].data[0] - 0x30)*16;
							else
								val= (buffer[k].data[0] - 55)*16;
							hex_add_byte(CH_SELECTOR, -1, -1, buffer[k].data[0]);
						}
					}
					
					pkt_end();
					
					if (p%2)
					{
						dec_item_new(CH_SELECTOR,buffer[k].start_s,buffer[k+3].end_s);
						dec_item_add_pre_text("ERROR NUMBER OF BYTES");
						dec_item_add_pre_text("ERROR NBR BYTE");
						dec_item_add_pre_text("ERROR");
						dec_item_add_pre_text("E!");
						
						pkt_add_item(-1, -1, "ERROR", "#############", dark_colors.black, channel_color);
						
						state = 0;
						pkt_end();
						break;
					}
					
					lrc= (-lrc)%256;
					lrc = 256+lrc;
					
					if (i-2 > i_fct)
					{
						lrc_red = 0;
						
						if(buffer[i-2].data[0] < 58)
							lrc_red+= (buffer[i-2].data[0] - 0x30)*16;
						else
							lrc_red+= (buffer[i-2].data[0] - 55)*16;
						if(buffer[i-1].data[0] < 58)
							lrc_red+= buffer[i-1].data[0] - 0x30;
						else
							lrc_red+= buffer[i-1].data[0] - 55;
					
						
						dec_item_new(CH_SELECTOR,buffer[i-2].start_s,buffer[i-1].end_s);
				
		              	dec_item_add_pre_text("LRC ");
		              	dec_item_add_pre_text("LRC ");
						dec_item_add_data(lrc_red);
						
						hex_add_byte(CH_SELECTOR, -1, -1, buffer[i-2].data[0]);
						hex_add_byte(CH_SELECTOR, -1, -1, buffer[i-1].data[0]);
			
						if (lrc==lrc_red)
						{
							dec_item_add_post_text(" OK");
							pkt_add_item(-1, -1, "LRC OK", int_to_str_hex(lrc_red), light_colors.orange, channel_color);
						}
						else
						{
		              		dec_item_add_post_text(" WRONG ! Should be " + int_to_str_hex(lrc));
		              		dec_item_add_post_text(" ! " + int_to_str_hex(lrc));
		              		dec_item_add_post_text("!");
							pkt_add_item(-1, -1, "LRC WRONG !", int_to_str_hex(lrc_red), dark_colors.red, channel_color);
							pkt_start("LRC ERROR");
							pkt_add_item(-1,-1, "Should be :", int_to_str_hex(lrc), dark_colors.orange, channel_color);
							pkt_end();
						}
					}
					
					dec_item_new(CH_SELECTOR,buffer[i].start_s,buffer[i+1].end_s);
	              	dec_item_add_pre_text("End of Frame ");
	              	dec_item_add_pre_text("End frame ");
	              	dec_item_add_pre_text("EOF ");
	              	dec_item_add_pre_text("E ");
					dec_item_add_post_text("<CR><LF>");
					dec_item_add_post_text("<CR><LF>");
					
					pkt_add_item(-1, -1, "EOF", "<CR><LF>", light_colors.blue, channel_color);
					
					hex_add_byte(CH_SELECTOR, -1, -1, "\r\n".charCodeAt(0));
					hex_add_byte(CH_SELECTOR, -1, -1, "\r\n".charCodeAt(1));
		
					state = 0;
					pkt_end();
				}
			}
			else
			{
				state = 0;
				pkt_end();
			}
			break;
		
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
		Configuration part : !! Configure this part !!
		(Do not change variables names)
	*/
	
	ch = 0;	//The channel on which signal are generated
	baud = 9600;
	invert = 0; // options are 0 for no invertion, and 1 for logical invertion
	
	parity = PARITY_NONE; // options are PARITY_NONE, PARITY_ODD, PARITY_EVEN;
	/*
		Signal generation part !! Change this part according to your application !!
	*/
	
	delay(50); //Idle state for 50 bits time - This is recommended in most cases
	
	modbus_ASCII_write_data("F7031389000A");
	
	var data_rtu=[]; 
	data_rtu= [4,1,0,10,0,13];
	modbus_RTU_write_data(data_rtu);
	delay(50); 
}

function modbus_ASCII_write_data(str)
{
	var i;
	var lrc=0;
	var temp = ":";

	nbits = 7;
	samples_per_bit = get_sample_rate() / baud;
	for(i=0;i<str.length-1;i+=2)
	{
		temp += str[i] + str[i+1];
		if(str.charCodeAt(i) < 58)
			lrc+= (str.charCodeAt(i) - 0x30)*16;
		else
			lrc+= (str.charCodeAt(i) - 55)*16;
		if(str.charCodeAt(i+1) < 58)
			lrc+= str.charCodeAt(i+1) - 0x30;
		else
			lrc+= str.charCodeAt(i+1) - 55;
	}
	
	lrc = (-lrc)%256;
	lrc = 256+lrc;
	
	if (lrc < 0x10)
	{
		temp += "0";
	}

	temp += lrc.toString(16).toUpperCase() + "\r\n";
	
	put_str(temp);
}

function modbus_RTU_write_data(str)
{
	var i;
	var crc=crc_calculation(str);
	
	nbits = 8;
	samples_per_bit = get_sample_rate() / baud;
	
	delay(28);
	
	for(i=0;i<str.length;i++)
	{
		put_c(str[i]);
	}
	
	put_c(crc&0xff);
	put_c(crc>>8);
	
	delay(28);
}
/*
*/
function put_str (str)
{
    var i;
    for (i = 0; i < str.length; i++)
    {
        put_c(str.charCodeAt(i));
    }
}


/*
*/
function put_c (code)
{
    var i;
    var b;
    var lvl;
	var par;
	var hi;
	var lo;
	
	if (invert == 0)
	{
		hi = 1;
        lo = 0;
	}
	else
	{
		hi = 0;
        lo = 1;
	}

	switch (invert)		//add start bit, depending on data inversion mode:
	{
		case 0:	add_samples(ch, 0, samples_per_bit); break;   	// default UART, no inversion
		case 1: add_samples(ch, 1, samples_per_bit); break;   	// inverted logic
	}
	
	if (invert > 0) //if signals are inverted (1) or data only is inverted (2)
	{
		par = 1;
	}
	else
	{
		par = 0;			
	}

    
	for (i = 0; i < nbits; i++)
	{
		b = ((code >> i) & 0x1)

		if (b == 1)
		{
			lvl = hi;
		}
		else
		{
			lvl = lo;
		}

		add_samples(ch, lvl, samples_per_bit);
		par = par ^ lvl;
	}
    

	if (parity > 0)
	{
		switch (parity)
		{
			case 1: par = par ^ 1; break;
			case 2: par = par ^ 0; break;
		}

		add_samples(ch, par, samples_per_bit);
    	add_samples(ch, hi, samples_per_bit); 	// Add stop bits
	}
	else
    	add_samples(ch, hi, samples_per_bit * 2); 	// Add stop bits

}


/* Adds a delay expressed in number of bits
*/
function delay (n_bits)
{
    for (var i = 0; i < n_bits; i++)
    {
		if(invert == 0)
        	add_samples(ch, 1, samples_per_bit);
		else
        	add_samples(ch, 0, samples_per_bit);
    }
}


/*
*************************************************************************************
							     DEMO BUILDER
*************************************************************************************
*/

function build_demo_signals()
{
	ch = 0;
	baud = 9600;
	parity = PARITY_NONE; // options are PARITY_NONE, PARITY_ODD, PARITY_EVEN;
	invert = 0;
	
	delay(50); //Idle state for 50 bits time - This is recommended in most cases
	modbus_ASCII_write_data("F7031389000A");
	delay(50); 
	
	ch = 1;
	delay(50); 
	var data_rtu=[]; 
	data_rtu= [4,1,0,10,0,13];
	modbus_RTU_write_data(data_rtu);
	delay(50); 
}


/*
*************************************************************************************
							     Trigger
*************************************************************************************
*/


/* Graphical user interface for the trigger configuration
*/
function trig_gui()
{
	trig_ui_clear();

	trig_ui_add_alternative("ALT_ANY_FRAME", "Trigger on a any frame", true);
		trig_ui_add_label("lab0", "Trigger on any Modbus Frame. In other words, this alternative will trigger on any start bit");

	trig_ui_add_alternative("ALT_SPECIFIC_ADDR","Trigger on an address in frame");
		trig_ui_add_label("lab1", "The address to be used for trigger. E.g.: for hex: 0x1A or for dec: 26");
		trig_ui_add_free_text("trig_address", "Trigger address: ");
		
	trig_ui_add_alternative("ALT_SPECIFIC_FUNCTION","Trigger on address and function", true);
		trig_ui_add_label("lab1", "The address to be used for trigger. E.g.: for hex: 0x1A or for dec: 26");
		trig_ui_add_free_text("trig_address", "Trigger address: ");
		trig_ui_add_combo("trig_function", "Trigger function: ")
			trig_ui_add_item_to_combo( "Read Coil Status (0x01)", true );
			trig_ui_add_item_to_combo( "Read Input Status (0x02)" );
			trig_ui_add_item_to_combo( "Read Holding Register (0x03)" );
			trig_ui_add_item_to_combo( "Read Input Register (0x04)" );
			trig_ui_add_item_to_combo( "Write Single Coil (0x05)" );
			trig_ui_add_item_to_combo( "Write Single Register (0x06)" );
			trig_ui_add_item_to_combo( "Write Multiple Coils (0x15)" );
			trig_ui_add_item_to_combo( "Write Multiple Registers (0x16)" );			
}


function trig_seq_gen() //This function is called by ScanaStudio
{
	//flexitrig_clear();
	
	get_ui_vals();
	baud = BAUD_SELECTOR;
	ch = CH_SELECTOR;
	
	if (MODE_SELECTOR == 0)
		trig_modbus_ASCII();
	else
		trig_modbus_RTU();
		
	
	//flexitrig_append("XXF1",-1,-1);
}

function trig_modbus_ASCII()
{
	var temp = "";
	var fct;

	nbits = 7;
	if(PARITY_SELECTOR == PARITY_NONE)
		stop_bit=2;
	else
		stop_bit=1;
		
	if(ALT_ANY_FRAME == true)
	{
		flexitrig_set_async_mode(true);
		
		flexitrig_clear();
		build_trig_byte(0x3a,true);
	}
	else if (ALT_SPECIFIC_ADDR == true)
	{
		flexitrig_set_async_mode(false);
		
		flexitrig_clear();
		
		build_trig_byte(0x3a,true);
		
		if(trig_address.length>3)
		{
			build_trig_byte(trig_address.charCodeAt(2),false);
			build_trig_byte(trig_address.charCodeAt(3),false);
		}
		else
		{		
			if (Number(trig_address) < 0x10)
			{
				temp += "0";
			}

			temp += Number(trig_address).toString(16).toUpperCase();	
				
			//debug(temp);
			
			build_trig_byte(temp.charCodeAt(0),false);
			build_trig_byte(temp.charCodeAt(1),false);
		}
	}
	else if (ALT_SPECIFIC_FUNCTION == true)
	{
		flexitrig_set_async_mode(false);
		
		flexitrig_clear();
		
		build_trig_byte(0x3a,true);
		
		if(trig_address.length>3)
		{
			build_trig_byte(trig_address.charCodeAt(2),false);
			build_trig_byte(trig_address.charCodeAt(3),false);
		}
		else
		{		
			if (Number(trig_address) < 0x10)
			{
				temp += "0";
			}

			temp += Number(trig_address).toString(16).toUpperCase();	
				
			//debug(temp);
			
			build_trig_byte(temp.charCodeAt(0),false);
			build_trig_byte(temp.charCodeAt(1),false);
		}
		
		switch(trig_function)
		{
			case 0:
				build_trig_byte(0x30, false);
				build_trig_byte(0x31, false);
				break;
			case 1:
				build_trig_byte(0x30, false);
				build_trig_byte(0x32, false);
				break;
			case 2:
				build_trig_byte(0x30, false);
				build_trig_byte(0x33, false);
				break;
			case 3:
				build_trig_byte(0x30, false);
				build_trig_byte(0x34, false);
				break;
			case 4:
				build_trig_byte(0x30, false);
				build_trig_byte(0x35, false);
				break;
			case 5:
				build_trig_byte(0x30, false);
				build_trig_byte(0x36, false);
				break;
			case 6:
				build_trig_byte(0x31, false);
				build_trig_byte(0x35, false);
				break;
			case 7:
				build_trig_byte(0x31, false);
				build_trig_byte(0x36, false);
				break;
		}
		
	}
}

function trig_modbus_RTU()
{
	var temp=0;
	var step;
	nbits = 8;
	if(PARITY_SELECTOR == PARITY_NONE)
		stop_bit=2;
	else
		stop_bit=1;
		
	if(ALT_ANY_FRAME == true)
	{
		flexitrig_clear();
		trig_bit_sequence = [1,0];
		flexitrig_append(build_step(0), -1, -1);
		flexitrig_append(build_step(1), 28*0.95/baud, -1);
	}
	else if (ALT_SPECIFIC_ADDR == true)
	{
		flexitrig_clear();
		
		if (trig_address.length >3)
		{
			if(trig_address.charCodeAt(2) < 58)
				temp+= (trig_address.charCodeAt(2) - 0x30)*16;
			else
				temp+= (trig_address.charCodeAt(2) - 55)*16;
			if(trig_address.charCodeAt(3) < 58)
				temp+= trig_address.charCodeAt(3) - 0x30;
			else
				temp+= trig_address.charCodeAt(3) - 55;
				
			debug(temp);
			build_trig_byte(Number(temp),true);
		}
		else
		{
			debug(Number(trig_address));
			
			build_trig_byte(Number(trig_address),true);
		}
	}
	
	else if (ALT_SPECIFIC_FUNCTION == true)
	{
		flexitrig_clear();
		
		if (trig_address.length >3)
		{
			if(trig_address.charCodeAt(2) < 58)
				temp+= (trig_address.charCodeAt(2) - 0x30)*16;
			else
				temp+= (trig_address.charCodeAt(2) - 55)*16;
			if(trig_address.charCodeAt(3) < 58)
				temp+= trig_address.charCodeAt(3) - 0x30;
			else
				temp+= trig_address.charCodeAt(3) - 55;
				
			debug(temp);
			build_trig_byte(Number(temp),true);
		}
		else
		{
			debug(Number(trig_address));
			
			build_trig_byte(Number(trig_address),true);
		}
		
		switch(trig_function)
		{
			case 0:
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
				build_trig_byte(trig_function+1, false);
				break;
	
			case 6:
			case 7:
				build_trig_byte(trig_function+9, false);
				break;
		}
		
	}
}


/*
*/
function build_trig_byte (new_byte, first)
{
	var lvl = [];
	var i;
	var total_steps = 0;
	var b;
	var par;
	var step;
	var bit_time = 1/baud;	// [s]
	var bt_max = bit_time * 1.05;	// Allow 5% margin on bit time <-- this may be configurable later.
	var bt_min = bit_time * 0.95;

	trig_bit_sequence = [];

	if (bt_max == bt_min)
	{
		if (bt_min > 0) bt_min--;
		else bt_max++;
	}
	
	switch (invert)	 // First, build trigger bit sequence
	{
		case 0:
			par = 0;
			lvl[1] = 1;
			lvl[0] = 0;
			trig_bit_sequence[0] = 0;
		break;

		case 1:
			par = 1;
			lvl[1] = 0;
			lvl[0] = 1;
			trig_bit_sequence[0] = 1;
		break;
	}
	

	for (i = 0; i < nbits; i++)
	{
		trig_bit_sequence.push(lvl[((new_byte >> i) & 0x1)]);
		
		par = par ^ lvl[((new_byte >> i) & 0x1)];
	}

	if (parity > 0)
	{
		switch(parity)
		{
			case 1: par = par ^ 1; break;
			case 2: par = par ^ 0; break;
		}

		trig_bit_sequence.push(par);
	}

	trig_bit_sequence.push((~trig_bit_sequence[0]) & 0x1);	// add stop bit

	step = build_step(0);	// Start bit

	if (first) 	// For the very first byte, ignore previous stop byte
	{
		flexitrig_append(step, -1, -1); 	// Start edge		
	}
	else
	{
		flexitrig_append(step, bt_min*stop_bit, -1); 	// Start edge have to be at least "n stop bits" way from the last transition.
	}

	var last_lvl = trig_bit_sequence[0];
	var last_index = 0;

	for (i = 1; i < trig_bit_sequence.length; i++)
	{
		if (trig_bit_sequence[i] != last_lvl)
		{
			last_lvl = trig_bit_sequence[i];
			step = build_step(i);
			flexitrig_append(step,bt_min*(i-last_index),bt_max*(i-last_index));
			last_index = i;
			total_steps ++;
		}
	}

	return total_steps;
}


function build_step (step_index)
{
	var step = "";
	var i;
	var step_ch_desc;
	
	if (trig_bit_sequence[step_index] == 0)
	{
		step_ch_desc = "F";
	}
	else
	{
		step_ch_desc = "R";
	}
	
	for (i = 0; i < get_device_max_channels(); i++)
	{	
		if (i == ch)
		{
			step = step_ch_desc + step;
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
	var temp = "0x";

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
function crc_calculation(trame)
{
	var crc = 0xFFFF;
	var pos;
	var i;
 
  	for (pos = 0; pos < trame.length; pos++) 
	{
    	crc ^= trame[pos];       
 
    	for (i = 8; i != 0; i--) 
		{  
      		if ((crc & 0x0001) != 0) 
			{     
        		crc >>= 1;                   
        		crc ^= 0xA001;
      		}
      		else                          
        		crc >>= 1;
    	}
  	}
  	return crc;
}


/*
*/
function function_to_str(data, r_a)
{
	switch(data)
	{
		case 0x01:
			dec_item_add_comment("Read Coil Status");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Read Coil Status " + r_a, light_colors.green, channel_color);
			break;
		case 0x02:
			dec_item_add_comment("Read Input Status");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Read Input Status " + r_a, light_colors.green, channel_color);
			break;
		case 0x03:
			dec_item_add_comment("Read Holding Register");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Read Holding Register " + r_a, light_colors.green, channel_color);
			break;
		case 0x04:
			dec_item_add_comment("Read Input Register");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Read Input Register " + r_a, light_colors.green, channel_color);
			break;
		case 0x05:
			dec_item_add_comment("Write Single Coil");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Write Single Coil " + r_a, light_colors.green, channel_color);
			break;
		case 0x06:
			dec_item_add_comment("Write Single Register");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Write Single Register " + r_a, light_colors.green, channel_color);
			break;
		case 0x0F:
			dec_item_add_comment("Write Multiple Coils");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Write Multiple Coils " + r_a, light_colors.green, channel_color);
			break;
		case 0x10:
			dec_item_add_comment("Write Multiple Registers");
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data) + " Write Multiple Registers " + r_a, light_colors.green, channel_color);
			break;
		default :
			pkt_add_item(-1, -1, "Function", int_to_str_hex (data), light_colors.green, channel_color);
			break;
	}
}















