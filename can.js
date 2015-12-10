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

	V1.30: Added decoder trigger & demo signal builder
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

*************************************************************************************
*/

/*
*************************************************************************************
								      INFO
*************************************************************************************
*/

/* The decoder name at it will apear to the users of this script
*/
function get_dec_name()
{
	return "CAN"; 
}


/* The decoder version
*/
function get_dec_ver()
{
	return "1.30";
}


/* The decoder version
*/
function get_dec_auth()
{
	return "IKALOGIC"; 
}

/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/

var	GET_SOF  = 0;
var	GET_ID 	 = 10;
var	GET_DATA = 40;
var	GET_CRC  = 50;
var	GET_ACK	 = 60;

var spb; 				//samples per bit
var m; 					//margin between blocks
var state = GET_SOF; 	//initialise CAN decoder state machine
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

var trigBitArr = [];
var demoBitSeqArr = [];

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* Graphical user interface
*/
function gui() 
{
	ui_clear();

	ui_add_ch_selector("ch", "Channel to decode", "CAN");
	ui_add_baud_selector("rate", "Bit rate", 500000);

	ui_add_separator();
	ui_add_info_label("<b>Hex view options:</b>");

	ui_add_txt_combo("hex_opt", "Include in HEX view:");
	ui_add_item_to_txt_combo("DATA fields only", true);
	ui_add_item_to_txt_combo("ID and DATA Fields", false);
	ui_add_item_to_txt_combo("Everything", false);
}


/* This is the function that will be called from ScanaStudio
   to update the decoded items
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

	spb = sample_rate / rate; 		// Calculate the number of Samples Per Bit.
	m = spb / 10; 					// Margin = 1 tenth of a bit time (expresed in number of samples)

	var t = trs_get_first(ch);

	channel_color = get_ch_light_color(ch);

	while (trs_is_not_last(ch) && (stop == false))
	{
	    if (abort_requested() == true)		// Allow the user to abort this script
		{
			return false;
		}

		switch (state)
		{
			case GET_SOF:

				while ((t.val != 0) && trs_is_not_last(ch))		// Search for SOF
				{
					t = trs_get_next(ch);
				}

				s = t.sample + (spb * 0.5); 		// Position our reader on the middle of first bit
				bit_sampler_ini(ch,spb / 2, spb); 	// Initialize the bit sampler (to be able tu use "bit_sampler_next()")
				bit_sampler_next(ch); 				// Read and skip the start bit

				dec_item_new(ch,t.sample,t.sample + spb - m); 	// Add the start bit item
				dec_item_add_pre_text("Start of Frame"); 
				dec_item_add_pre_text("Start"); 
				dec_item_add_pre_text("SOF"); 
				dec_item_add_pre_text("S");

				pkt_start("CAN");
				pkt_add_item(-1, -1, "SOF", "", dark_colors.blue, channel_color);

				bits = [];
				rb = 0;
				b = 0; sb = 0; 
				bit_pos = [];
				ide_mode = false;
				data_size = 0;
				bits.push(0);  		// Add the start bit to the bits table
				bit_pos.push(s); 	// Add its position
				b++;
				rb++;
				last_bit = 0;
				state = GET_ID;
				rtr_mode = false;
				ide_mode = false;
				potential_overload = true; 	// This *may* be the beginning of an overload frame

			break;

			case GET_ID:

				while (true) 	// Read bits until we break
				{
					if (abort_requested() == true)	// Allow the user to abort this script
					{
						return false;
					}

					if (sb == 4)
					{
						
						stuffing_ok = check_stuffing();		// Stuffed bit
						if (stuffing_ok == false) break; 	// Break on the first stuffing error
						sb = 0;
					}
					else
					{
						bits[b] = bit_sampler_next(ch);		// Regular bit
						dec_item_add_sample_point(ch, s + (rb * spb), DRAW_POINT);
						bit_pos.push(s + (rb * spb)); 		// Store the position of that bit 

						if (bits[b] == last_bit)
						{
							sb++;
						}
						else
						{
							sb = 0;
						}

						last_bit = bits[b];
						b++;
					}

					rb++;

					if ((b == 14) && (bits[13] == 1)) 
					{
						ide_mode = true;
						rtr_mode = false; 	// Reset rtr, will be checked at bit 32
					}

					if (ide_mode)
					{
						if ((b == 33) && (bits[32] == 1))
						{
							rtr_mode = true;
						}
					}
					else
					{
						if ((b == 13) && (bits[12] == 1))
						{
							rtr_mode = true;
						}
					}

					if ((ide_mode == true) && (b == 39))
					{
						break;
					}

					if ((ide_mode == false) && (b == 19))
					{
						break;
					}
				}

				if (stuffing_ok == false)
				{
					t = trs_go_after(ch, bit_pos[b - 1] + (10.5 * spb));
					set_progress(100 * t.sample / n_samples);
					state = GET_SOF;
					break;
				}

				// Check if we are in normal or extended ID mode
				if (ide_mode == false)	 	// Normal frame
				{
					val = 0;				// Calculate the value of the ID

					for (c = 1; c < 12; c++)
					{
						val = (val * 2) + bits[c];
					}

					dec_item_new(ch,bit_pos[1] - (0.5 * spb) + m, bit_pos[11] + (0.5 * spb) - m); 		// Add the ID item
					dec_item_add_pre_text("IDENTIFIER: "); 
					dec_item_add_pre_text("ID: "); 
					dec_item_add_pre_text("ID");
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
					
					dec_item_new(ch,bit_pos[12] - (0.5 * spb) + m, bit_pos[12] + (0.5 * spb) - m);  	// Add the RTR bit

					if (rtr_mode == true)
					{
						dec_item_add_pre_text("RTR FRAME"); 
						dec_item_add_pre_text("RTR"); 
						dec_item_add_pre_text("R");
						pkt_add_item(-1, -1, "RTR = 1", "RTR FRAME", dark_colors.green, channel_color, true);
					}
					else
					{
						dec_item_add_pre_text("DATA FRAME"); 
						dec_item_add_pre_text("DATA"); 
						dec_item_add_pre_text("D");
						pkt_add_item(-1, -1, "RTR = 0", "DATA FRAME", dark_colors.green, channel_color, true);
					}

					dec_item_new(ch, bit_pos[13] - (0.5 * spb) + m, bit_pos[13] + (0.5 * spb) - m); 	// Add the IDE bit
					dec_item_add_pre_text("BASE FRAME FORMAT");
					dec_item_add_pre_text("BASE FRAME"); 
					dec_item_add_pre_text("BASE"); 
					dec_item_add_pre_text("B");
					pkt_add_item(-1, -1, "IDE = 0","BASE FRAME FORMAT", dark_colors.green, channel_color, true);
					pkt_end();

					val = 0;

					for (c = 15; c < 19; c++)
					{
						val = (val * 2) + bits[c];
					}

					data_size = val;

					dec_item_new(ch,bit_pos[15] - (0.5 * spb) + m, bit_pos[18] + (0.5 * spb) - m); 	// Add the ID item
					dec_item_add_pre_text("DATA LENGTH CODE: "); 
					dec_item_add_pre_text("DATA LENGTH: ");
					dec_item_add_pre_text("DATA LEN: ");
					dec_item_add_pre_text("DLC: ");
					dec_item_add_pre_text("L:");
					dec_item_add_data(val);

					if (hex_opt > 1)
					{
						hex_add_byte(ch, -1, -1, val);
					}
	
					pkt_add_item(-1, -1, "DLC", int_to_str_hex(val), dark_colors.orange, channel_color, true);
				}
				else
				{
					val = 0;

					for (c = 1; c < 12; c++)
					{
						val = (val * 2) + bits[c];
					}

					for (c = 14; c < 32; c++)
					{
						val = (val * 2) + bits[c];
					}

					dec_item_new(ch,bit_pos[1] - (0.5 * spb) + m, bit_pos[31] + (0.5 * spb) - m); 	// Add the ID item
					dec_item_add_pre_text("EXTENDED IDENTIFIER: "); 
					dec_item_add_pre_text("EID: ");
					dec_item_add_data(val);

					if (hex_opt > 0) 
					{
						var tmp_val = val;
						
						for (var i = 0; i < 4; i++)
						{
							var tmp_byte = (tmp_val & 0xFF);
							hex_add_byte(ch, -1, -1, tmp_byte);
							tmp_val = (tmp_val - tmp_byte) / 256;
						}
					}

					pkt_add_item(-1, -1, "EID", int_to_str_hex(val), dark_colors.violet, channel_color);
					pkt_start("Frame Type");
					dec_item_new(ch, bit_pos[32] - (0.5 * spb) + m, bit_pos[32] + (0.5 * spb) - m);  // Add the RTR bit

					if (rtr_mode == true)
					{
						dec_item_add_pre_text("RTR FRAME"); 
						dec_item_add_pre_text("RTR"); 
						dec_item_add_pre_text("R");
						pkt_add_item(-1, -1, "RTR = 1", "RTR FRAME", dark_colors.violet, channel_color, true);
					}
					else
					{
						dec_item_add_pre_text("DATA FRAME"); 
						dec_item_add_pre_text("DATA"); 
						dec_item_add_pre_text("D");
						pkt_add_item(-1, -1, "RTR = 0", "DATA FRAME", dark_colors.violet, channel_color, true);
					}

					pkt_add_item(0, 0, "IDE = 1", "EXTENDED FRAME FORMAT", dark_colors.violet, channel_color, true);
					pkt_end();

					val = 0;

					for (c = 35; c < 39; c++)
					{
						val = (val * 2) + bits[c];
					}

					data_size = val;

					dec_item_new(ch, bit_pos[35] - (0.5 * spb) + m, bit_pos[38] + (0.5 * spb) - m); 	// Add the ID item				
					dec_item_add_pre_text("DATA LENGTH CODE: "); 
					dec_item_add_pre_text("DATA LENGTH: ");
					dec_item_add_pre_text("DATA LEN: ");
					dec_item_add_pre_text("DLC: ");
					dec_item_add_pre_text("L:");
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
				else	// Skip the data in case of RTR frame
				{
					state = GET_CRC; 
				}

				break;

			case GET_DATA:

				db = 0;

				while (db < (data_size * 8)) 	// Read data bits
				{
					if (sb == 4)
					{
						stuffing_ok = check_stuffing();		// Stuffed bit

						if (stuffing_ok == false) 
						{
							break;
						}

						sb = 0;
					}
					else
					{
						bits[b] = bit_sampler_next(ch);		// Regular bit
						dec_item_add_sample_point(ch, s + (rb * spb), DRAW_POINT);
						
						bit_pos.push(s + (rb * spb)); 	// Store the position of that bit

						if (bits[b] == last_bit)
						{
							sb++;
						}
						else
						{
							sb = 0;
						}

						last_bit = bits[b];
						b++;
						db++;
					}

					rb++;
				}

				if (stuffing_ok == false)
				{
					t = trs_go_after(ch,bit_pos[b - 1] + (10.5 * spb));
					set_progress(100 * t.sample / n_samples);
					state = GET_SOF;
					break;
				}

				b -= (data_size * 8);	// Now interpret those bits as bytes
				pkt_data = "";

				for (i = 0; i < data_size; i++)
				{
					val = 0;

					for (c = 0; c < 8; c++)
					{
						val = (val * 2) + bits[b + (i * 8) + c];
					}

					dec_item_new(ch, bit_pos[b + (i * 8)] - (0.5 * spb) + m, bit_pos[b + (i * 8) + 7] + (0.5 * spb) - m); 	// Add the ID item
					dec_item_add_pre_text("DATA: ");
					dec_item_add_pre_text("D: ");
					dec_item_add_pre_text("D "); 
					dec_item_add_data(val);
					hex_add_byte(ch, -1, -1, val);

					pkt_data += int_to_str_hex(val) + " ";
				}

				pkt_add_item(bit_pos[b] - (0.5 * spb), bit_pos[b + ((data_size - 1) * 8) + 7] + (0.5 * spb), "DATA", pkt_data, dark_colors.gray, channel_color);

				b += (data_size * 8);
				state = GET_CRC;

				// TO DO:
				// correct all start and end samples
				// add packet for CRC, and error frames
				// add the packet stop
			break;

			case GET_CRC:

				db = 0;

				while (db < 15) //read crc bits
				{
					if (sb == 4)
					{
						stuffing_ok = check_stuffing();		// Stuffed bit

						if (stuffing_ok == false) 
						{
							break;
						}

						sb = 0;
					}
					else
					{
						bits[b] = bit_sampler_next(ch);	 // Regular bit
						dec_item_add_sample_point(ch, s + (rb * spb), DRAW_POINT);
						bit_pos.push(s + (rb * spb)); 	 // Store the position of that bit (for later usage)

						if (bits[b] == last_bit)
						{
							sb++;
						}
						else
						{
							sb = 0;
						}

						last_bit = bits[b];
						b++;
						db++;
					}

					rb++;
				}

				if (stuffing_ok == false)
				{
					t = trs_go_after(ch, bit_pos[b - 1] + (10.5 * spb));
					set_progress(100 * t.sample / n_samples);
					state = GET_SOF;

					break;
				}

				val = 0;
				b -= 15;

				for (c = 0; c < 15; c++)
				{
					val = (val * 2) + bits[b + c];
				}

				crc_rg = 0;		// Now calculate our own crc to compare

				for (c = 0; c < b; c++)
				{
					crc_nxt = bits[c] ^ ((crc_rg >> 14) & 0x1);
					crc_rg = crc_rg << 1;

					if (crc_nxt == 1)
					{ 
						crc_rg ^= 0x4599;
					}

					crc_rg &= 0x7fff;
				}

				dec_item_new(ch, bit_pos[b] - (0.5 * spb) + m, bit_pos[b + 14] + (0.5 * spb) - m); 	// Add the ID item
				dec_item_add_pre_text("CRC : "); 
				dec_item_add_pre_text("CRC ");
				dec_item_add_pre_text("CRC"); 
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

					pkt_add_item(-1, -1, "CRC", int_to_str_hex(val) + "(WRONG)", dark_colors.red, channel_color);

					pkt_start("CRC ERROR");
					pkt_add_item(0, 0, "CRC (captured)",int_to_str_hex(val), dark_colors.red, channel_color);
					pkt_add_item(0, 0, "CRC (calculated)", int_to_str_hex(crc_rg), dark_colors.red, channel_color);
					pkt_end();

					dec_item_add_post_text("!");
				}

				b += 14;
				state = GET_ACK;

			break;

			case GET_ACK: 	// and the EOF too.

				bit_sampler_next(ch); 	// CRC delimiter
				ack_chk = bit_sampler_next(ch);
				bit_sampler_next(ch); 	// ACK delimiter

				dec_item_new(ch,bit_pos[b] + (1.5 * spb) + m, bit_pos[b] + (2.5 * spb) - m); 	// Add the ACK item
				dec_item_add_pre_text("ACK");
				dec_item_add_pre_text("ACK");
				dec_item_add_pre_text("A");
				pkt_add_item(-1, -1, "ACK", ack_chk.toString(10), dark_colors.black, channel_color);
				eof_chk = 0;

				for (c = 0; c < 7; c++)
				{
					eof_chk += bit_sampler_next(ch);
				}

				dec_item_new(ch, bit_pos[b] + (3.5 * spb) + m, bit_pos[b] + (10.5 * spb) - m); 	// Add the EOF item

				if (eof_chk == 7)
				{
					dec_item_add_pre_text("END OF FRAME OK");
					dec_item_add_pre_text("EOF OK");
					dec_item_add_pre_text("EOF");
					dec_item_add_pre_text("E");
					pkt_add_item(-1, -1, "EOF", "", dark_colors.blue, channel_color);
				}
				else
				{
					dec_item_add_pre_text("END OF FRAME ERR");
					dec_item_add_pre_text("EOF ERR!");
					dec_item_add_pre_text("!EOF!");
					dec_item_add_pre_text("!E!");
					dec_item_add_pre_text("!");
					pkt_add_item(-1, -1, "EOF","MISSING!", dark_colors.red, channel_color);
				}

				pkt_end();

				t = trs_go_after(ch, bit_pos[b] + (10.5 * spb));
				set_progress(100 * t.sample / n_samples);
				state = GET_SOF;

			break;
		}
	}
}


/* Check if the CAN bit stuffing is correct
*/
function check_stuffing() 
{
	var tmp_bit = bit_sampler_next(ch); 	// Read stuffed bit and advance to next bit

	if (last_bit == tmp_bit) 				// Check for stuffing error 
	{
		dec_item_new(ch, s + (rb * spb) - (0.5 * spb), s + (rb * spb) + (0.5 * spb)); 	// Add a stuffing error item

		if (potential_overload == true)
		{
			dec_item_add_pre_text("Overload frame"); 
			dec_item_add_pre_text("OVERLOAD"); 
			dec_item_add_pre_text("OL"); 
			dec_item_add_pre_text("O"); 
			dec_item_add_pre_text("!");
			pkt_add_item(-1, -1, "OVERLOAD", "", dark_colors.red, channel_color, true);
		}
		else
		{
			dec_item_add_pre_text("ERROR: bit Stuffing missing or Error frame"); 
			dec_item_add_pre_text("ERROR FRAME"); 
			dec_item_add_pre_text("ERROR"); 
			dec_item_add_pre_text("E!"); 
			dec_item_add_pre_text("!");
			pkt_add_item(-1, -1, "STUFFING ERROR", "", dark_colors.red, channel_color, true);
		}

		last_bit = tmp_bit;
		pkt_end();

		return false;
	}
	else
	{
		potential_overload = false; 	// if we got at least one stuffed bit, then it's no more possible to have an overload frame
		dec_item_add_sample_point(ch, s + (rb * spb), DRAW_CROSS);
		last_bit = tmp_bit;

		return true;
	}
}

/*
*************************************************************************************
							     DEMO BUILDER
*************************************************************************************
*/

/*
*/
function build_demo_signals()
{
	var i = 0, k = 0;

	spb = (get_sample_rate() / rate); 		// Calculate the number of samples per bit

	while (get_samples_acc(ch) < (n_samples - (spb * 200)))
	{
		add_samples(ch, 1, (spb * 100));
		demo_add_base_arbit(k, 0x08);
		demo_add_data(i, 8);
		demo_add_crc();
		demo_generate();

		i += 8;
		k++;
	}
}


/*
*/
function demo_generate()
{
	var i = 0;
	var temp = 0;
	var currBit = 0;
	var lastBit = 0;
	var sameBitCnt = 0;
	var stuffedBitArr = [];

	lastBit = demoBitSeqArr[0];
	stuffedBitArr.push(lastBit);

	for (i = 1; i < demoBitSeqArr.length; i++)		// Bit stuffing check
	{
		lastBit = demoBitSeqArr[i - 1];
		currBit = demoBitSeqArr[i];

		stuffedBitArr.push(currBit);

		if (currBit == lastBit)
		{
			sameBitCnt++;
		}
		else
		{
			sameBitCnt = 0;
		}

		if (sameBitCnt >= 4)
		{
			if (lastBit !== 0)
			{
				stuffedBitArr.push(0);
			}
			else
			{
				stuffedBitArr.push(1);		
			}

			sameBitCnt = -1;
		}
	}

	stuffedBitArr.push(1);		// CRC delimiter
	stuffedBitArr.push(0);		// ACK
	stuffedBitArr.push(1);      // ACK delimiter

	for (i = 0; i < 10; i++)	// EOF
	{
		stuffedBitArr.push(1);
	}

	for (i = 0; i < stuffedBitArr.length; i++)		// Generation
	{
		if (stuffedBitArr[i] !== 0)
		{
			add_samples(ch, 1, spb);
		}
		else
		{
			add_samples(ch, 0, spb);
		}
	}

	demoBitSeqArr = [];
	stuffedBitArr = [];
}


/*
*/
function demo_add_base_arbit (id, dlc)
{
	var i = 0;

	demoBitSeqArr.push(0);			// SOF

	for (i = 10; i >= 0; i--)		// Identifier
	{
		if ((id >> i) & 0x1)
		{
			demoBitSeqArr.push(1);
		}
		else
		{
			demoBitSeqArr.push(0);
		}
	}

	demoBitSeqArr.push(0);			// RTR: Data
	demoBitSeqArr.push(0);	        // IDE: Base format
	demoBitSeqArr.push(0);          // Reserved bit

	for (i = 3; i >= 0; i--)		// DLC
	{
		if ((dlc >> i) & 0x1)
		{
			demoBitSeqArr.push(1);
		}
		else
		{
			demoBitSeqArr.push(0);
		}
	}
}


/*
*/
function demo_add_data (offset, len)
{
	var i = 0;
	var k = 0;
	var dataArr = [];

	for (i = offset; i < (offset + len); i++)
	{
		dataArr.push(i);
	}

	for (i = 0; i < dataArr.length; i++)
	{
		for (k = 7; k >= 0; k--)
		{
			if ((dataArr[i] >> k) & 0x1)
			{
				demoBitSeqArr.push(1);
			}
			else
			{
				demoBitSeqArr.push(0);
			}
		}
	}
}


/*
*/
function demo_add_crc()
{
	var i = 0;
	var crc = 0;
	var currBit = 0;

	for (i = 0; i < demoBitSeqArr.length; i++)
	{
		currBit = demoBitSeqArr[i] ^ ((crc >> 14) & 0x1);
		crc = crc << 1;

		if (currBit == 1)
		{ 
			crc ^= 0x4599;
		}

		crc &= 0x7fff;
	}

	for (i = 14; i >= 0; i--)
	{
		if ((crc >> i) & 0x1)
		{
			demoBitSeqArr.push(1);
		}
		else
		{
			demoBitSeqArr.push(0);
		}
	}
}

/*
*************************************************************************************
							       TRIGGER
*************************************************************************************
*/

/* Graphical user interface for the trigger configuration
*/
function trig_gui()
{
	trig_ui_add_alternative("alt_specific_ident", "Trigger on a specific identifier", true);

		trig_ui_add_combo("trig_ident_format", "Message Format:");
		trig_ui_add_item_to_combo("Base Format (11 identifier bits)", true);
		trig_ui_add_item_to_combo("Extended Format (29 identifier bits)");

		trig_ui_add_combo("trig_frame_type", "Frame type:");
		trig_ui_add_item_to_combo("Any Frame", true);
		trig_ui_add_item_to_combo("Data Frame (RTR = 0)");
		trig_ui_add_item_to_combo("Remote Frame (RTR = 1)");

		trig_ui_add_label("lab1", "<br>Type decimal value (65) or Hex value (0x41)");
		trig_ui_add_free_text("trig_ident", "Trigger Identifier: ");

	trig_ui_add_alternative("alt_stuffing_err", "Trigger on bit stuffing error", false);

		trig_ui_add_combo("trig_stuffing_bit", "Error Bit Value:");
		trig_ui_add_item_to_combo("0", true);
		trig_ui_add_item_to_combo("1");
}


/*
*/
function trig_seq_gen()
{
	flexitrig_clear();
	get_ui_vals();

	var i = 0;
	var identBitNum = 0;
	var bitArr = [];
	var tBitS = (1 / rate);
	var tBitSTolerance = ((tBitS / 100) * 5);		// 5% of bit time tolerance
	var tBitSMin = tBitS - tBitSTolerance;
	var tBitSMax = tBitS + tBitSTolerance;

	if (alt_specific_ident)
	{
		flexitrig_set_async_mode(false);

		trig_ident = Number(trig_ident);
		flexitrig_set_summary_text("Trig on CAN Identifer: 0x" + trig_ident.toString(16));

		bitArr.push(0);		// SOF

		if (trig_ident_format !== 0)
		{
			identBitNum = 29;
		}
		else
		{
			identBitNum = 11;
		}

		for (i = (identBitNum - 1); i >= 0; i--)
		{
			if ((trig_ident >> i) & 0x01)
			{
				bitArr.push(1);
			}
			else
			{
				bitArr.push(0);
			}

			if (trig_ident_format != 0)
			{
				if (i == 10)
				{
					bitArr.push(1);		// SRR
					bitArr.push(1);		// IDE
				}
			}
		}

		switch (trig_frame_type)
		{
			case 0: break;				// RTR = X
			case 1: bitArr.push(0);		// RTR = 0
		 	case 2: bitArr.push(1); 	// RTR = 1		
		}

		trig_add_stuffing_bits(bitArr);

		flexitrig_append(trig_build_step(0), (tBitSMin * 10), -1);	// SOF, must be preceded by 7 bits EOF + 3 Interframe spacing bits

		var lastBit = trigBitArr[0];
		var lastIndex = 0;
		var step = 0;

		for (i = 0; i < trigBitArr.length; i++)
		{
			if (trigBitArr[i] != lastBit)
			{
				if ((trig_frame_type == 1) && (i == trigBitArr.length - 1))
				{
					tBitSMax *= 2; 
				}

				step = trig_build_step(trigBitArr[i]);
				flexitrig_append(step, (tBitSMin * (i - lastIndex)), (tBitSMax * (i - lastIndex)));
				lastBit = trigBitArr[i];
				lastIndex = i;
			}
		}
	}
	else if (alt_stuffing_err)
	{
		flexitrig_set_async_mode(true);
		flexitrig_set_summary_text("Trig on CAN bit " + trig_stuffing_bit + " stuffing error");

		if (trig_stuffing_bit)
		{
			flexitrig_append(trig_build_step(0), (tBitSMin * 7), -1);
		}
		else
		{
			flexitrig_append(trig_build_step(1), (tBitSMin * 7), -1);
		}
	}

	// flexitrig_print_steps();
}


/*
*/
function trig_build_step (step_desc)
{
	var step = "";

	for (var i = 0; i < get_device_max_channels(); i++)
	{
		if (i == ch)
		{
			if (step_desc !== 0)
			{
				step = "R" + step;
			}
			else
			{
				step = "F" + step;
			}
		}
		else
		{
			step = "X" + step;
		}
	}

	return step;
}


/*
*/
function trig_add_stuffing_bits (bitArr)
{
	var i = 0;
	var lastBit = 0;
	var currBit = 0;
	var sameBitCnt = 0;

	trigBitArr = [];
	lastBit = bitArr[0];
	trigBitArr.push(lastBit);

	for (i = 1; i < bitArr.length; i++)
	{
		lastBit = bitArr[i - 1];
		currBit = bitArr[i];

		trigBitArr.push(currBit);

		if (currBit == lastBit)
		{
			sameBitCnt++;
		}
		else
		{
			sameBitCnt = 0;
		}

		if (sameBitCnt >= 4)
		{
			if (lastBit !== 0)
			{
				trigBitArr.push(0);
			}
			else
			{
				trigBitArr.push(1);		
			}

			sameBitCnt = -1;
		}
	}
}


/*
*************************************************************************************
							        UTILS
*************************************************************************************
*/

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