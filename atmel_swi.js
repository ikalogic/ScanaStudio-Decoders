/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Single-Wire Interface is used by Atmel chip to communicate using only one wire.
	This mode uses a single GPIO connection on the system microprocessor connected to the SDA pin on the device. It permits the fewest number of connector pins to any removable/replaceable entity. The bit rate is up to 26Kb/s and is compatible with standard UART signaling.
	
	Logical SWI 0 = 0x7D UART
	Logical SWI 1 = 0x7F UART
	
	Flag and data are always transmitted LSB First.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.0:  Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:n.bastit@ikalogic.com

</AUTHOR_URL>

<HELP_URL>



</HELP_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "ATMEL SWI";
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
	return "Nicolas BASTIT";
}
/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/
var baud = 26000;
var spb;
var inter_transaction_silence;

var UNKNOWN_STATE = 0;
var GET_COMM_TRANS = 1;
var GET_TRANS_COUNT = 20;
var GET_TRANS_DATA = 21;
var GET_TRANS_CRC = 29;
var GET_COMM_COUNT = 10;
var GET_COMM_OPCODE = 11;
var GET_COMM_PARAM = 12;
var GET_COMM_DATA = 15;
var GET_COMM_CRC = 19;
var channel_color;

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

/* Graphical user interface for this decoder 
*/
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch", "Channel to decode", "Atmel SWI" );
}

function decode()
{
	var t;					// navigator througt trnasition
	var m;
	var t_sample;			// actual sample of the transition
	var t_next_sample;
	var t_first_bit;
	var bit = [];
	var cnt_bit = 0;
	var val;
	var state = UNKNOWN_STATE;
	var trame = [];
	var nbr_data = 0;
	var nbr_param = 0;
	var crc = 0;
	var crc_cnt=0;
	var crc_begin=0;
	var param2 = 0;
	var param2_begin = 0;
						
	get_ui_vals();                // Update the content of user interface variables
	
	channel_color = get_ch_light_color(ch);
	
	spb = get_sample_rate()/baud;
	m = spb/70;
	
	clear_dec_items();            // Clears all the the decoder items and its content
	
	t = trs_get_first(ch);
	
	while (trs_is_not_last(ch))
	{
		if (abort_requested() == true)
		{
			pkt_end();
			return false;
		}
		
		if (t.val!=FALLING)
		{
			t = get_next_falling_edge (ch, t); 		// search falling edge
		}
		
		t_sample = t.sample;
		
		t = get_next_rising_edge(ch, t);
		
		if( ((t.sample - t_sample)>=(spb/7)-m)&&((t.sample - t_sample)<=(spb/7)+m) )	//find each following bits and fill bytes with it
		{
			t_next_sample = t.sample;
			t = get_next_falling_edge(ch, t);
			if( ((t.sample - t_sample)>=spb-m) || (!trs_is_not_last()) )
			{
				//bit = 0
				dec_item_add_sample_point(ch, t_sample + spb/2, DRAW_0);
				bit[cnt_bit]=0;
				if (cnt_bit==0)
					t_first_bit = t_sample;
				cnt_bit++;
			}
			else
			{
				//bit may be 1
				if( ((t.sample - t_next_sample)>=(spb/7)-m)&&((t.sample - t_next_sample)<=(spb/7)+m) )
				{
					t_next_sample = t.sample;
					t = get_next_rising_edge(ch, t);
					if( ((t.sample - t_next_sample)>=(spb/7)-m)&&((t.sample - t_next_sample)<=(spb/7)+m) )
					{	
						t_next_sample = t.sample;
						t = get_next_falling_edge(ch, t);
						if( ((t.sample - t_sample)>=spb-m) || (!trs_is_not_last()) )
						{
							//bit = 1
							dec_item_add_sample_point(ch, t_sample + spb/2, DRAW_1);
							bit[cnt_bit]=1;
							if (cnt_bit==0)
								t_first_bit = t_sample;
							cnt_bit++;
						}
					}
				}
			}
		}
		else
		{
			cnt_bit = 0;
			state = UNKNOWN_STATE;
			bit = [];
			trame = [];
			pkt_end();
		}
		if(cnt_bit==8)	//byte is fill, now decode it
		{
			val = (bit[7]<<7)|(bit[6]<<6)|(bit[5]<<5)|(bit[4]<<4)|(bit[3]<<3)|(bit[2]<<2)|(bit[1]<<1)|bit[0];
			switch(state)
			{
				case UNKNOWN_STATE: 
				{
					if(val==0)
					{
						state = GET_COMM_TRANS;
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("WAKE ");
						dec_item_add_pre_text("W ");
						dec_item_add_pre_text("W");
						dec_item_add_data(val);
						
						pkt_end();
						pkt_start("ATMEL SWI");
						pkt_add_item(-1, -1, "WAKE", "", dark_colors.blue, channel_color);
					}
					else
					{
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("Byte ");
						dec_item_add_data(val);
						
						pkt_end();
						pkt_start("ATMEL SWI");
						pkt_add_item(-1, -1, "Byte", int_to_str_hex(val), dark_colors.black, channel_color);
					}
					break;
				}
				case GET_COMM_TRANS:
				{
					if(val==0x77)
					{	//command
						state = GET_COMM_COUNT;
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("COMMAND ");
						dec_item_add_pre_text("CMD ");
						dec_item_add_pre_text("CMD");
						dec_item_add_pre_text("C");
						dec_item_add_data(val);
						
						pkt_end();
						pkt_start("MASTER COMMAND");
						pkt_add_item(-1, -1, "COMMAND", "", dark_colors.orange, channel_color);
					}
					else if(val==0x88)
					{	//transmit
						state = GET_TRANS_COUNT;
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("TRANSMIT ");
						dec_item_add_pre_text("TRS ");
						dec_item_add_pre_text("TRS");
						dec_item_add_pre_text("T");
						dec_item_add_data(val);
						
						pkt_end();
						pkt_start("MASTER REQUEST");
						pkt_add_item(-1, -1, "TRANSMIT", "", dark_colors.green, channel_color);
					}
					else if(val==0xcc)
					{	//sleep
						state = UNKNOWN_STATE;
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("SLEEP ");
						dec_item_add_pre_text("SLP ");
						dec_item_add_pre_text("SLP");
						dec_item_add_pre_text("S");
						dec_item_add_data(val);
						
						pkt_end();
						pkt_start("ATMEL SWI");
						pkt_add_item(-1, -1, "SLEEP", "", dark_colors.blue, channel_color);
					}
					else if(val==0xbb)
					{	//idle
						state = UNKNOWN_STATE;
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("IDLE ");
						dec_item_add_pre_text("IDL ");
						dec_item_add_pre_text("IDL");
						dec_item_add_pre_text("I");
						dec_item_add_data(val);
						
						pkt_end();
						pkt_start("ATMEL SWI");
						pkt_add_item(-1, -1, "IDLE", "", dark_colors.blue, channel_color);
					}
					else
					{
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("Byte ");
						dec_item_add_data(val);
						
						pkt_end();
						pkt_start("ATMEL SWI");
						pkt_add_item(-1, -1, "Byte", int_to_str_hex(val), dark_colors.black, channel_color);
					}
					break;
				}
				case GET_COMM_COUNT :
				{
					state = GET_COMM_OPCODE;
					nbr_data = val-7;
					dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
					dec_item_add_pre_text("COUNT ");
					dec_item_add_pre_text("CNT ");
					dec_item_add_pre_text("CNT");
					dec_item_add_pre_text("C");
					dec_item_add_data(val);
					
					pkt_add_item(-1, -1, "COUNT", val, light_colors.orange, channel_color);
					
					trame[0] = val;
					break;
				}
				case GET_COMM_OPCODE :
				{
					dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
					dec_item_add_data(val);
					dec_item_add_pre_text("OP");
					
					pkt_add_item(-1, -1, "OPCODE", int_to_str_hex(val), dark_colors.orange, channel_color);
					
					trame[trame.length] = val;
					state = GET_COMM_PARAM;
					switch (val)
					{
						case 0x1c: 
						{
							dec_item_add_pre_text("DeriveKey ");
							break;
						}
						case 0x30: 
						{
							dec_item_add_pre_text("DevRev ");
							break;
						}
						case 0x15: 
						{
							dec_item_add_pre_text("HMAC ");
							break;
						}
						case 0x28: 
						{
							dec_item_add_pre_text("CheckMac ");
							break;
						}
						case 0x17: 
						{
							dec_item_add_pre_text("Lock ");
							break;
						}
						case 0x08: 
						{
							dec_item_add_pre_text("MAC ");
							break;
						}
						case 0x16: 
						{
							dec_item_add_pre_text("Nonce ");
							break;
						}
						case 0x01: 
						{
							dec_item_add_pre_text("Pause ");
							break;
						}
						case 0x1b: 
						{
							dec_item_add_pre_text("Random ");
							break;
						}
						case 0x02: 
						{
							dec_item_add_pre_text("Read ");
							break;
						}
						case 0x20: 
						{
							dec_item_add_pre_text("UpdateExtra ");
							break;
						}
						case 0x12: 
						{
							dec_item_add_pre_text("Write ");
							break;
						}
						default: 
						{
							dec_item_add_pre_text("OPCODE ");
							break;
						}
					}
					break;
				}
				case GET_COMM_PARAM :
				{
					nbr_param++;
					trame[trame.length] = val;
					if(nbr_param == 1)
					{
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("PARAM1 ");
						dec_item_add_pre_text("PAR1 ");
						dec_item_add_pre_text("PAR1");
						dec_item_add_pre_text("P1");
						dec_item_add_data(val);
						
						pkt_add_item(-1, -1, "PARAM1", int_to_str_hex(val), light_colors.orange, channel_color);
					}
					else if(nbr_param == 2)
					{
						param2_begin = t_first_bit;
						param2 = val;
					}
					if(nbr_param==3)
					{
						param2 |= val<<8;
						dec_item_new(ch, param2_begin + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("PARAM2 ");
						dec_item_add_pre_text("PAR2 ");
						dec_item_add_pre_text("PAR2");
						dec_item_add_pre_text("P2");
						dec_item_add_data(param2);
						
						pkt_add_item(-1, -1, "PARAM2", int_to_str_hex(param2), dark_colors.orange, channel_color);
						
						state = GET_COMM_DATA;
						nbr_param = 0;
						param2 = 0;
						param2_begin = 0;
						
						if(nbr_data<=0)
						{
							state = GET_COMM_TRANS;
							nbr_data = 0;
						}
					}
					break;
				}
				case GET_COMM_DATA :
				{
					if(nbr_data<=0)
					{
						state = GET_COMM_TRANS;
						nbr_data = 0;
					}
					else
					{
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("Data ");
						dec_item_add_pre_text("D ");
						dec_item_add_pre_text("D");
						dec_item_add_data(val);
						
						pkt_add_item(-1, -1, "Data", int_to_str_hex(val), light_colors.yellow, channel_color);
					
						trame[trame.length] = val;
						nbr_data--;
						if(nbr_data==0)
							state = GET_COMM_CRC;
					}
					break;
				}
				case GET_COMM_CRC :
				{
					if(crc_cnt==0)
					{
						crc=val;
						crc_begin = t_first_bit;
						crc_cnt++;
					}
					else if(crc_cnt==1)
					{
						crc|=val<<8;
						crc_cnt = 0;
						
						dec_item_new(ch, crc_begin + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("CRC : ");
						dec_item_add_pre_text("CRC");
						dec_item_add_data(crc);
						
						val = crc_calculation(trame);
						
						if(val==crc)
						{
							dec_item_add_post_text(" OK");
							dec_item_add_post_text("");
							
							pkt_add_item(-1, -1, "CRC", int_to_str_hex(val), light_colors.orange, channel_color);
						}
						else
						{
							dec_item_add_post_text(" WRONG, Should be: " + val);
							dec_item_add_post_text("!");
							
							pkt_add_item(-1, -1, "CRC ERROR", int_to_str_hex(crc), dark_colors.red, channel_color);
						}
						
						crc=0;
						state = GET_COMM_TRANS;
						//pkt_end();
					}
					
					break;
				}
				case GET_TRANS_COUNT :
				{
					state = GET_TRANS_DATA;
					nbr_data = val-3;
					dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
					dec_item_add_pre_text("COUNT ");
					dec_item_add_pre_text("CNT ");
					dec_item_add_pre_text("CNT");
					dec_item_add_pre_text("C");
					dec_item_add_data(val);
					
					pkt_add_item(-1, -1, "COUNT", val, light_colors.green, channel_color);
					
					trame[0] = val;
					if(nbr_data<=0)
						{
							state = GET_TRANS_CRC;
							nbr_data = 0;
						}
					break;
				}
				case GET_TRANS_DATA :
				{
					if(nbr_data<=0)
					{
						state = GET_TRANS_CRC;
						nbr_data = 0;
					}
					else
					{
						dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("Data ");
						dec_item_add_pre_text("D ");
						dec_item_add_pre_text("D");
						dec_item_add_data(val);
						
						pkt_add_item(-1, -1, "Data", int_to_str_hex(val), light_colors.yellow, channel_color);
						
						trame[trame.length] = val;
						nbr_data--;
						if(nbr_data==0)
							state = GET_TRANS_CRC;
					}
					break;
				}
				case GET_TRANS_CRC :
				{
					if(crc_cnt==0)
					{
						crc=val;
						crc_begin = t_first_bit;
						crc_cnt++;
					}
					else if(crc_cnt==1)
					{
						crc|=val<<8;
						crc_cnt = 0;
						
						dec_item_new(ch, crc_begin + m , t_first_bit + spb*8 -m );
						dec_item_add_pre_text("CRC : ");
						dec_item_add_pre_text("CRC");
						dec_item_add_data(crc);
						
						val = crc_calculation(trame);
						
						if(val==crc)
						{
							dec_item_add_post_text(" OK");
							dec_item_add_post_text("");
							
							pkt_add_item(-1, -1, "CRC", int_to_str_hex(crc), light_colors.green, channel_color);
						}
						else
						{
							dec_item_add_post_text(" WRONG, Should be: " + val);
							dec_item_add_post_text("!");
							
							pkt_add_item(-1, -1, "CRC ERROR", int_to_str_hex(crc), dark_colors.red, channel_color);
						}
						
						crc=0;
						state = GET_COMM_TRANS;
						//pkt_end();
					}
					
					break;
				}
				default:
				{
					dec_item_new(ch, t_first_bit + m , t_first_bit + spb*8 -m );
					dec_item_add_pre_text("Byte ");
					dec_item_add_pre_text("");
					dec_item_add_data(val);
					break;
				}
			}
			
			
			bit = [];
			cnt_bit = 0;
		}
	}
}


/*
*************************************************************************************
							     DEMO BUILDER
*************************************************************************************
*/

function build_demo_signals()
{
	ch = 0; 				// The channel on wich signal are genrated
	baud = 26000;			// The baudrate of the communication
	
	inter_transaction_silence = 0.5;	//time in bit spend between two packet of the frame
	
	spb=get_sample_rate()/baud;
	standby(3);
	write_wake();
	standby(inter_transaction_silence);

	
	data_write_str_master(0x12,0x00,0x1234,"Salut !");	
	standby(inter_transaction_silence);

	data_write_str_slave("Bonjour");
	standby(inter_transaction_silence);
	
	data_write_str_master(0x02,0x05,0x6789,"Bye !");
	standby(inter_transaction_silence);
	
	data_write_str_slave("Bye");
	standby(inter_transaction_silence);
	
	write_idle();
	standby(inter_transaction_silence);
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
	
	ch = 0; 				// The channel on wich signal are genrated
	baud = 26000;			// The baudrate of the communication
	
	inter_transaction_silence = 0.5;	//time in bit spend between two packet of the frame
	
	spb=get_sample_rate()/baud;
	/* example of differents function you can use*/
	standby(3);
	write_sleep();
	
	standby(3);
	
	data_write(0x18);

	standby(3);
	write_wake();
	standby(inter_transaction_silence);

	/*
	data_write_str_master(opcode, param1, param2, string)
	opcode, param1 and param2 are defined in the datasheet
	string is the data transmitted
	you should to read it in the aim of use this function in order to be understood the right way by Atmel chip	
	*/
	data_write_str_master(0x12,0x00,0x1234,"Salut !");	
	standby(inter_transaction_silence);
	
	
	data_write(0x18);						//byte wich shouldn't be here but it shows that it is'nt included in frame
	standby(inter_transaction_silence);
	
	
	/*
	data_write_str_master(string)
	
	string is the data transmitted
	*/
	data_write_str_slave("Bonjour");
	standby(inter_transaction_silence);
	
	data_write_str_master(0x02,0x05,0x6789,"Bye !");
	standby(inter_transaction_silence);
	
	data_write_str_slave("Bye");
	standby(inter_transaction_silence);
	
	write_idle();
	standby(inter_transaction_silence);
}


/*
*************************************************************************************
							        UTILS
*************************************************************************************
*/
function standby(t)
{
	add_samples(ch,1,t*spb);
}

function data_high()
{
	add_samples(ch,0,spb/7);
	add_samples(ch,1,spb/7);
	add_samples(ch,0,spb/7);
	add_samples(ch,1,spb*4/7);
}

function data_low()
{
	add_samples(ch,0,spb/7);
	add_samples(ch,1,spb*6/7);
}

function data_write_str_slave(str)
{
	var i;
	var iterator=0;
	var trame = [];
	var crc = [];
	var tmp;
	
	write_transmit();
	standby(inter_transaction_silence);
	
	trame[iterator]=str.length;
	iterator++;
	data_write(str.length + 3);
	standby(inter_transaction_silence);
	
	for(i=0;i<str.length;i++)
	{
		trame[iterator] = str.charCodeAt(i);
		iterator++;
		
		data_write(str.charCodeAt(i));
		standby(inter_transaction_silence);
	}
	
	tmp = crc_calculation(trame);
	crc[0] = tmp & 0xff;
	crc[1] = (tmp>>8) & 0xff;
	
	data_write(crc[0]);
	standby(inter_transaction_silence);
	
	data_write(crc[1]);
	standby(inter_transaction_silence);
}

function data_write_str_master(opcode, param1, param2, str)
{
	var i;
	var iterator=0;
	var trame = [];
	var crc = [];
	var tmp;
	
	write_command();
	standby(inter_transaction_silence);
	
	trame[iterator]=str.length;
	iterator++;
	data_write(str.length + 7);
	standby(inter_transaction_silence);
	
	data_write(opcode);
	standby(inter_transaction_silence);
	
	data_write(param1);
	standby(inter_transaction_silence);
	
	data_write(param2 & 0xff);
	standby(inter_transaction_silence);
	
	data_write( (param2>>8)&0xff );
	standby(inter_transaction_silence);
	
	for(i=0;i<str.length;i++)
	{
		trame[iterator] = str.charCodeAt(i);
		iterator++;
		
		data_write(str.charCodeAt(i));
		standby(inter_transaction_silence);
	}
	
	tmp = crc_calculation(trame);
	crc[0] = tmp & 0xff;
	crc[1] = (tmp>>8) & 0xff;
	
	data_write(crc[0]);
	standby(inter_transaction_silence);
	
	data_write(crc[1]);
	standby(inter_transaction_silence);
}

function data_write(data)
{
	var i;
	for(i=0;i<8;i++)
	{
		if((data>>i)&0x1)
		{
			data_high();
		}
		else
		{
			data_low();
		}
	}
}

function crc_calculation(trame)
{
	var	bit = [];
	var c = 0;
	var i = 0;
	var crc_nxt = 0;
	var crc_rg = 0;
	var crc_len = 16;
	
	for(c=0;c<trame.length;c++)
	{
		for(i=7;i>=0;i--)
		{
			bit[i+8*c] = (trame[c] >> i) & 0x1;
		}
	}
	
	for(c=0;c<bit.length;c++)
	{
		crc_nxt = bit[c] ^ ((crc_rg >> (crc_len)) & 0x1);
		crc_rg = crc_rg << 1;

		if (crc_nxt == 1)
			crc_rg ^= 0x8005;
			
		crc_rg &= 0xffff;
	}
	return crc_rg;
}

function write_wake()
{
	data_write(0x00);
}

function write_idle()
{
	data_write(0xBB);
}

function write_sleep()
{
	data_write(0xCC);
}

function write_command()
{
	data_write(0x77);
}

function write_transmit()
{
	data_write(0x88);
}

/* Get next transition with falling edge
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

/*	Get next transition with rising edge
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




