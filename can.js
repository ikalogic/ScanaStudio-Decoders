/*
*************************************************************************************
							
						    SCANASTUDIO 2 CAN DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	CAN Protocol Decoder.
	This a standard can bus decoder that will interpret and display normal and extended 
	CAN frames. It will also display stuffed bits, calculate checksum and compare it against the one given in the frame.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.27: Fixed Hex View wrong endianness
	V1.26: Now the decoding can be aborted
	V1.25: Added backward compatibility features (specially related to HEX view support) 
	V1.24: Corrected some spelling mistakes
	V1.23: Fixed bug with Extended frame ID value
	V1.22: Fixed bug with extended frame data field
	V1.21: Added link for online help.
	V1.20: Added Packet/Hex View support.
	V1.15: Added support for RTR frames and Overload frames.
	V1.10: Used the "bit_sampler" feature for faster decoding.
	V1.00: Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:i.kamal@ikalogic.com

</AUTHOR_URL>

<HELP_URL>

	http://www.ikalogic.com/ikalogic-products/scanastudio-2/decoders-repository/bus-decoder-online/

</HELP_URL>
						
*************************************************************************************
*/

//The decoder name at it will apear to the users of this script
function get_dec_name()
{
	return "CAN"; 
}


 //The decoder version
function get_dec_ver()
{
	return "1.27";
}


//The decoder version
function get_dec_auth()
{
	return "IKALOGIC"; 
}


//graphical user interface
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch", "Channel to decode", "CAN" );
	ui_add_baud_selector( "rate", "Bit rate", 500000 );
	ui_add_separator();
	ui_add_info_label( "<b>Hex view options:</b>" );
	ui_add_txt_combo( "hex_opt", "Include in HEX view:" );
		ui_add_item_to_txt_combo( "DATA fields only", true );
		ui_add_item_to_txt_combo( "ID and DATA Fields" );
		ui_add_item_to_txt_combo( "Everything" );
}


//some vars for easier reading the code
var	GET_SOF  = 0;
var	GET_ID 	 = 10;
var	GET_DATA = 40;
var	GET_CRC  = 50;
var	GET_ACK	 = 60;

var spb; 				//samples per bit
var m; 					//margin between blocks
var state = GET_SOF ; 	//initialise CAN decoder state machine
var c = 0; 				//general purpose counter
var i = 0; 				//general purpose counter
var val = 0; 			//general purpose value holding variable
var rb = 0; 			//real bit counter
var b = 0; 				//non stuffed bit counter
var sb = 0; 			//stuffed bit counter
var db = 0; 			//counter for data bits or crc bits
var bits = [];			//to store the values of the bits (only valid, non stuffed bits)
var last_bit; 			//used to detect stuffing errors
var data_size = 0; 		//to store the DLC field
var ide_mode = false;
var rtr_mode = false;
var stop = false;
var stuffing_ok = true;
var potential_overload = true;
var crc_rg;
var crc_nxt;
var eof_chk;
var ack_chk;
var pkt_data; 			//to accumulate all the data of a packet
var channel_color;


/* check if the CAN bit stuffing is correct
*/
function check_stuffing() 
{
	var tmp_bit = bit_sampler_next(ch); 	//read stuffed bit and advance to next bit

	if (last_bit == tmp_bit) 				// check for stuffing error 
	{
		dec_item_new(ch, s + (rb * spb) - (0.5 * spb), s + (rb * spb) + (0.5 * spb)); 	//add a stuffing error item
		
		if (potential_overload == true)
		{
			dec_item_add_pre_text("Overload frame"); dec_item_add_pre_text("OVERLOAD"); dec_item_add_pre_text("OL"); dec_item_add_pre_text("O"); dec_item_add_pre_text("!");
			pkt_add_item(-1,-1,"OVERLOAD","",dark_colors.red,channel_color,true);
		}
		else
		{
			dec_item_add_pre_text("ERROR: bit Stuffing missing or Error frame"); dec_item_add_pre_text("ERROR FRAME"); dec_item_add_pre_text("ERROR"); dec_item_add_pre_text("E!"); dec_item_add_pre_text("!");
			pkt_add_item(-1,-1,"STUFFING ERROR","",dark_colors.red,channel_color,true);
		}

		last_bit = tmp_bit;
		pkt_end();

		return false;
	}
	else
	{
		potential_overload = false; 	//if we got at least one stuffed bit, then it's no more possible to have an overload frame
		dec_item_add_sample_point(ch,s+(rb*spb),DRAW_CROSS);
		last_bit = tmp_bit;
		return true;
	}
}


/*
*/
function decode()
{
	get_ui_vals();

	if (typeof hex_opt === 'undefined') 
	{
		hex_opt = 0;
	}
	
	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	if (rate == 0)
	{
		return;
	}

	spb = sample_rate / rate; 	//calculate the number of Samples Per Bit.
	m = spb / 10; 				//margin = 1 tenth of a bit time (expresed in number of samples)

	var t = trs_get_first(ch);

	//search for a first rizing edge (because logic 1 is the idle state of CAN)
	/*while ((t.val != 1) && (trs_is_not_last(ch)))
	{
		t = trs_get_next(ch);
	}*/

	channel_color = get_ch_light_color(ch);

	while (trs_is_not_last(ch) && (stop == false))	//(trs_is_not_last(ch))
	{
	    if (abort_requested() == true)	// Allow the user to abort this script
		{
			return false;
		}

		switch(state)
		{
			case GET_SOF:

				while ((t.val != 0) && trs_is_not_last(ch))	//search for SOF
				{
					t = trs_get_next(ch);
				}
				s = t.sample + (spb*0.5); //position our reader on the middle of first bit
				bit_sampler_ini(ch,spb/2,spb); //initialize the bit sampler (to be able tu use "bit_sampler_next()")
				bit_sampler_next(ch); //read and skip the start bit
				dec_item_new(ch,t.sample,t.sample + spb - m); //add the start bit item
				dec_item_add_pre_text("Start of Frame"); dec_item_add_pre_text("Start"); dec_item_add_pre_text("SOF"); dec_item_add_pre_text("S");
				
				pkt_start("CAN");
				pkt_add_item(-1,-1,"SOF","",dark_colors.blue,channel_color);
				
				bits = [];
				rb = 0; b=0; sb=0; bit_pos = []; ide_mode = false; data_size = 0;
				bits.push(0);  //add the start bit to the bits table
				bit_pos.push(s); //add its position
				b++;
				rb++;
				last_bit = 0;
				state = GET_ID;
				rtr_mode = false;
				ide_mode = false;
				potential_overload = true; //this *may* be the beginning of an overload frame
				break;

			case GET_ID:
			
				while (true) //read bits until we break
				{
					if (abort_requested() == true)	// Allow the user to abort this script
					{
						return false;
					}
					
					if (sb == 4)
					{
						//stuffed bit
						stuffing_ok = check_stuffing();
						if (stuffing_ok == false) break; //break on the first stuffing error
						sb = 0;
					}
					else
					{
						//regular bit
						bits[b] = bit_sampler_next(ch);
						dec_item_add_sample_point(ch,s+(rb*spb),DRAW_POINT);
						bit_pos.push(s+(rb*spb)); //store the position of that bit 
						if (bits[b] == last_bit)
						{
							sb++;
						}
						else
						{
							sb=0;
						}
						last_bit = bits[b];
						b++;
					}
					rb++;
					if ((b == 14) && (bits[13] == 1)) 
					{
						ide_mode = true;
						rtr_mode = false; //reset rtr, will be checked at bit 32
					}
					if (ide_mode)
					{
						if ((b == 33) && (bits[32] == 1)) rtr_mode = true;
					}
					else
					{
						if ((b == 13) && (bits[12] == 1)) rtr_mode = true;
					}
					
					if ((ide_mode == true) && (b == 39)) break;
					if ((ide_mode == false) && (b == 19)) break;
				}

				if (stuffing_ok == false)
				{
					t = trs_go_after(ch,bit_pos[b-1] + (10.5*spb));
					set_progress(100*t.sample/n_samples);
					state = GET_SOF;
					break;
				}

				//check if we are in normal or extended ID mode
				if (ide_mode == false) //normal frame
				{
					//calculate the value of the ID
					val = 0;

					for (c=1; c < 12; c++)
					{
						val = (val * 2) + bits[c];
					}

					dec_item_new(ch,bit_pos[1]-(0.5*spb)+m, bit_pos[11] + (0.5*spb)- m); //add the ID item
					dec_item_add_pre_text("Identifier: "); dec_item_add_pre_text("ID: "); dec_item_add_pre_text("ID "); dec_item_add_pre_text("ID");
					dec_item_add_data(val);

					if (hex_opt > 0)
					{
						var tmp_val = (val >> 8);
						hex_add_byte(ch, -1, -1, tmp_val);
						tmp_val = (val & 0xFF);
						hex_add_byte(ch, -1, -1, tmp_val);
					}

					pkt_add_item(-1, -1, "ID", int_to_str_hex(val), dark_colors.green, channel_color);
					pkt_start("Frame Type");
					
					dec_item_new(ch,bit_pos[12]-(0.5*spb)+m, bit_pos[12] + (0.5*spb)- m);  //add the RTR bit
					if (rtr_mode == true)
					{
						dec_item_add_pre_text("RTR FRAME"); dec_item_add_pre_text("RTR"); dec_item_add_pre_text("R");
						pkt_add_item(-1,-1,"RTR = 1","RTR FRAME",dark_colors.green,channel_color,true);
					}
					else
					{
						dec_item_add_pre_text("DATA FRAME"); dec_item_add_pre_text("DATA"); dec_item_add_pre_text("D");
						pkt_add_item(-1,-1,"RTR = 0","DATA FRAME",dark_colors.green,channel_color,true);
					}
					
					dec_item_new(ch,bit_pos[13]-(0.5*spb)+m, bit_pos[13] + (0.5*spb)- m); //add the IDE bit
					dec_item_add_pre_text("BASE FRAME FORMAT");dec_item_add_pre_text("BASE FRAME"); dec_item_add_pre_text("BASE"); dec_item_add_pre_text("B");
					pkt_add_item(-1,-1,"IDE = 0","BASE FRAME FORMAT",dark_colors.green,channel_color,true);
					pkt_end();
					val = 0;
					for (c=15; c < 19; c++)
					{
						val = (val * 2) + bits[c];
					}
					data_size = val;
					dec_item_new(ch,bit_pos[15]-(0.5*spb)+m, bit_pos[18] + (0.5*spb)- m); //add the ID item
					dec_item_add_pre_text("Data Length code "); dec_item_add_pre_text("Data Length ");dec_item_add_pre_text("DLC ");
					dec_item_add_pre_text("L:");dec_item_add_pre_text("L"); 
					dec_item_add_data(val);

					if (hex_opt > 1) hex_add_byte(ch,-1,-1,val);
					
					pkt_add_item(-1, -1, "DLC", int_to_str_hex(val), dark_colors.orange, channel_color, true);
				}
				else
				{
					val = 0;

					for (c=1; c < 12; c++)
					{
						val = (val * 2) + bits[c];
					}
					for (c=14; c < 32; c++)
					{
						val = (val * 2) + bits[c];
					}
					dec_item_new(ch,bit_pos[1]-(0.5*spb)+m, bit_pos[31] + (0.5*spb)- m); //add the ID item
					dec_item_add_pre_text("Extended Identifier: "); dec_item_add_pre_text("EID : "); dec_item_add_pre_text("EID ");dec_item_add_pre_text("EID"); 
					dec_item_add_data(val);
					
					if (hex_opt > 0) 
					{
						var tmp_val = val;
						
						for (var i = 0; i < 4; i++)
						{
							var tmp_byte = tmp_val & 0xFF;
							hex_add_byte(ch,-1,-1,tmp_byte);
							tmp_val = (tmp_val - tmp_byte)/256;
						}
					}
					pkt_add_item(-1, -1, "EID", int_to_str_hex(val), dark_colors.violet, channel_color);
					
					pkt_start("Frame Type");
					dec_item_new(ch,bit_pos[32]-(0.5*spb)+m, bit_pos[32] + (0.5*spb)- m);  //add the RTR bit
					if (rtr_mode == true)
					{
						dec_item_add_pre_text("RTR FRAME"); dec_item_add_pre_text("RTR"); dec_item_add_pre_text("R");
						pkt_add_item(-1,-1,"RTR = 1","RTR FRAME",dark_colors.violet,channel_color,true);
					}
					else
					{
						dec_item_add_pre_text("DATA FRAME"); dec_item_add_pre_text("DATA"); dec_item_add_pre_text("D");
						pkt_add_item(-1,-1,"RTR = 0","DATA FRAME",dark_colors.violet,channel_color,true);
					}
					pkt_add_item(0,0,"IDE = 1","EXTENDED FRAME FORMAT",dark_colors.violet,channel_color,true);
					pkt_end();
					//dec_item_new(ch,bit_pos[13]-(0.5*spb)+m, bit_pos[13] + (0.5*spb)- m); //add the IDE bit
					//dec_item_add_pre_text("BASE FRAME FORMAT");dec_item_add_pre_text("BASE FRAME"); dec_item_add_pre_text("BASE"); dec_item_add_pre_text("B");

					val = 0;
					for (c=35; c < 39; c++)
					{
						val = (val * 2) + bits[c];
					}

					data_size = val;
					dec_item_new(ch,bit_pos[35]-(0.5*spb)+m, bit_pos[38] + (0.5*spb)- m); //add the ID item				
					dec_item_add_pre_text("Data Length code"); dec_item_add_pre_text("Data Length ");dec_item_add_pre_text("DLC ");
					dec_item_add_pre_text("L:");dec_item_add_pre_text("L"); 
					dec_item_add_data(val);
					
					if (hex_opt > 1)
					{
						hex_add_byte(ch, -1, -1, val);
					}
					
					pkt_add_item(t.sample, t.sample + spb - m, "DLC", int_to_str_hex(val), dark_colors.orange, channel_color,true);
				}
				if (rtr_mode == false)
				{
					state = GET_DATA;
				}
				else	//skip the data in case of RTR frame
				{
					state = GET_CRC; 
				}
				
				break;

			case GET_DATA:

				db = 0;
				while (db < (data_size*8)) //read data bits
				{
					if (sb == 4)
					{
						//stuffed bit
						stuffing_ok = check_stuffing();
						if (stuffing_ok == false) break;
						sb = 0;
					}
					else
					{
						//regular bit
						bits[b] = bit_sampler_next(ch);
						dec_item_add_sample_point(ch,s+(rb*spb),DRAW_POINT);
						bit_pos.push(s+(rb*spb)); //store the position of that bit
						if (bits[b] == last_bit)
						{
							sb++;
						}
						else
						{
							sb=0;
						}
						last_bit = bits[b];
						b++;
						db++;
					}
					rb++;
				}
				if (stuffing_ok == false)
				{
					t = trs_go_after(ch,bit_pos[b-1] + (10.5*spb));
					set_progress(100*t.sample/n_samples);
					state = GET_SOF;
					break;
				}
				//now interpret those bits as bytes
				b -= (data_size*8);
				pkt_data = "";
				for (i = 0; i < data_size; i++)
				{
					val = 0;
					for (c = 0; c < 8; c++)
					{
							val = (val*2) + bits[b+(i*8)+c];
					}
					dec_item_new(ch,bit_pos[b+(i*8)]-(0.5*spb)+m, bit_pos[b+(i*8)+7] + (0.5*spb)- m); //add the ID item
					dec_item_add_pre_text("Data Field: "); dec_item_add_pre_text("Data : "); dec_item_add_pre_text("D: ");dec_item_add_pre_text("D "); 
					dec_item_add_data(val);
					hex_add_byte(ch,-1,-1,val);

					pkt_data += int_to_str_hex(val) + " ";
				}
				
				pkt_add_item(bit_pos[b]-(0.5*spb),bit_pos[b+((data_size-1)*8)+7] + (0.5*spb),"DATA",pkt_data,dark_colors.gray,channel_color);
				
				b += (data_size*8);
				state = GET_CRC;
				
				

				//TO DO:
				//correct all start and end samples
				// add packet for CRC, and error frames
				// add the packet stop
			break;

			case GET_CRC:

				db = 0;
				while (db < 15) //read crc bits
				{
					if (sb == 4)
					{
						//stuffed bit
						stuffing_ok = check_stuffing();
						if (stuffing_ok == false) break;
						sb = 0;
						//check for stuffing errors.. TBD
					}
					else
					{
						//regular bit
						bits[b] = bit_sampler_next(ch);//get_sample_val(ch,s+(rb*spb));
						dec_item_add_sample_point(ch,s+(rb*spb),DRAW_POINT);
						bit_pos.push(s+(rb*spb)); //store the position of that bit (for later usage)
						if (bits[b] == last_bit)
						{
							sb++;
						}
						else
						{
							sb=0;
						}
						last_bit = bits[b];
						b++;
						db++;
					}
					rb++;
				}
				
				if (stuffing_ok == false)
				{
					//add_to_err_log("goto " + bit_pos[b]);
					t = trs_go_after(ch,bit_pos[b-1] + (10.5*spb));
					set_progress(100*t.sample/n_samples);
					state = GET_SOF;
					break;
					//add_to_err_log("stuff err found, value = " + stuffing_ok);
				}

				val = 0;
				b -= 15;

				for (c = 0; c < 15; c++)
				{
					val = (val*2) + bits[b+c];
				}

				//now calculate our own crc to compare
				crc_rg = 0;

				for (c = 0; c < b; c++)
				{
					crc_nxt = bits[c] ^ ((crc_rg >> 14) & 0x1);
					crc_rg = crc_rg << 1;
					if (crc_nxt == 1) crc_rg ^= 0x4599;
					crc_rg &= 0x7fff;
				}

				dec_item_new(ch,bit_pos[b]-(0.5*spb)+m, bit_pos[b+14] + (0.5*spb)- m); //add the ID item
				dec_item_add_pre_text("CRC Field: "); dec_item_add_pre_text("CRC : "); dec_item_add_pre_text("CRC ");dec_item_add_pre_text("CRC"); 
				dec_item_add_data(val);
				
				if (hex_opt > 1) 
				{
					var tmp_val = (val >> 8);
					hex_add_byte(ch, -1, -1, tmp_val);
					tmp_val = (val & 0xFF);
					hex_add_byte(ch, -1, -1, tmp_val);	
				}

				if (val == crc_rg)
				{
					dec_item_add_post_text(" OK");
					dec_item_add_post_text(" OK");
					dec_item_add_post_text("");
					pkt_add_item(-1, -1 ,"CRC", int_to_str_hex(val) + " OK", dark_colors.yellow, channel_color);
				}
				else
				{
					dec_item_add_post_text(" WRONG, Should be: 0x" + int_to_str_hex(crc_rg));
					dec_item_add_post_text(" WRONG!");
					dec_item_add_post_text("E!");

					pkt_add_item(-1,-1, "CRC", int_to_str_hex(val) + "(WRONG)",dark_colors.red,channel_color);

					pkt_start("CRC Error");
						pkt_add_item(0,0,"CRC (captured)",int_to_str_hex(val),dark_colors.red,channel_color);
						pkt_add_item(0,0,"CRC (calculated)",int_to_str_hex(crc_rg),dark_colors.red,channel_color);
					pkt_end();

					dec_item_add_post_text("!");
				}
				b += 14;
				state = GET_ACK;
			break;
			
			case GET_ACK: //and the EOF too.

				bit_sampler_next(ch); //CRC delimiter
				ack_chk = bit_sampler_next(ch);
				bit_sampler_next(ch); // ACK delimiter
				dec_item_new(ch,bit_pos[b]+(1.5*spb)+m, bit_pos[b] + (2.5*spb)- m); //add the ACK item
				dec_item_add_pre_text("ACK");dec_item_add_pre_text("ACK");dec_item_add_pre_text("A");
				pkt_add_item(-1,-1,"ACK",ack_chk.toString(10),dark_colors.black,channel_color);
				eof_chk = 0;
				for (c=0; c<7; c++)
				{
					eof_chk += bit_sampler_next(ch);
				}
				dec_item_new(ch,bit_pos[b]+(3.5*spb)+m, bit_pos[b] + (10.5*spb)- m); //add the EOF item
				if (eof_chk == 7)
				{
					dec_item_add_pre_text("End Of Frame OK");dec_item_add_pre_text("EOF OK");dec_item_add_pre_text("EOF");dec_item_add_pre_text("E");
					pkt_add_item(-1,-1,"EOF","",dark_colors.blue,channel_color);
				}
				else
				{
					dec_item_add_pre_text("End Of Frame Error");dec_item_add_pre_text("EOF Err!");dec_item_add_pre_text("!EOF!");dec_item_add_pre_text("!E!");
					dec_item_add_pre_text("!");
					pkt_add_item(-1,-1,"EOF","MISSING!",dark_colors.red,channel_color);
				}
				pkt_end();
				t = trs_go_after(ch,bit_pos[b] + (10.5*spb));
				set_progress(100*t.sample/n_samples);
				state = GET_SOF;
			break;
		}
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



function build_demo_signals()
{
	delay(3);
}

function build_demo_frame(extended_frame)
{
	
}

function delay(n_bits)
{
    var i;
    for (i=0; i < n_bits; i++)
    {
		add_bit(n_bits);
    }
}

function add_bit(b)
{
	var sample_r = get_sample_rate();
	var samples_per_bit = sample_r / rate;
	add_samples(ch,b,samples_per_bit);
}

