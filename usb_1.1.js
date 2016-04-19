/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	USB 1.1 Protcol Decoder

</DESCRIPTION>
<RELEASE_NOTES>

	V1.05: Added USB speed audodetection, Coorected a bug related to low speed USB.
	V1.04: More fluid progress bar
	V1.03: Corrected a bug that caused "false" CRC errors.
	V1.02: Corrected a bug that caused a hanging. 
	V1.01: Now the decoding can be aborted
	V1.0:  Initial release

</RELEASE_NOTES>
<AUTHOR_URL>

	mailto:i.kamal@ikalogic.com

</AUTHOR_URL>

*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "USB 1.1";
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
	return "IKALOGIC";
}

/* Graphical user interface for this decoder 
*/
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch_plus", "Channel D+ ", "D+" );
	ui_add_ch_selector( "ch_moins", "Channel D- ", "D-" );
	ui_add_txt_combo( "speed", "USB bit-rate" );
		ui_add_item_to_txt_combo( "Full speed (12 Mbps)" );
		ui_add_item_to_txt_combo( "Low speed (1.5 Mbps)" );
		ui_add_item_to_txt_combo( "Auto detect", true );
	ui_add_separator();
	ui_add_info_label( "<b>Packet view options:</b>" );
	ui_add_txt_combo( "PacketView", "Include in Packet view:" );
		ui_add_item_to_txt_combo( "transfer of non-empty data", true );
		ui_add_item_to_txt_combo( "all data transfer" );
}

var Status_table =
{
	SOF		: 0x01,
	DATA	: 0x02,
	EOF		: 0x03
}

var Status_packet_table =
{
	PID 				: 0x01,
	ADDR_ENDPOINT 		: 0x02,
	FRAME_NBR			: 0x03,
	DATA				: 0x04,
    CRC					: 0x05
}

var PID_table =
{
	OUT		: 0x01,
	IN		: 0x09,
	SOF		: 0x05,
	SETUP	: 0x0D,
	DATA0	: 0x03,
	DATA1	: 0x0B,
	ACK		: 0x02,
	NACK	: 0x0A,
	STALL	: 0x0E,
	PRE		: 0x0C
}

var state_packet_analyse = Status_packet_table.PID;
var last_state_packet_analyse;

var spb;
var midSample;
var baud;

var transition_now_Dmoins,transition_next_Dmoins;
var transition_now_Dplus,transition_next_Dplus;

var tab_Dplus = new Array();
var tab_Dmoins = new Array();
var tab_data = new Array();
var cnt_data = 0;
var tab_sample_start_packet = new Array();
var cnt_tab_packet = 0;
var tab_data_crc = new Array();
var cnt_data_crc = 0;

var val_CRC = 0;
var val_CRC_calul = 0;
var length_nbr_to_divide;
var nav_tab = 0;
var new_value = 0;

var test_stuffing = false;
var bit_stuffing = 0;

var low = 1;
var full = 0;
var non_empty = 0;
var empty_also = 1;

var text_pid = "";
var val_addr_endpoint = 0;
var val_crc_data_first;
var data_empty = true;
var data_type;
var zero_data = false;

var PKT_COLOR_DATA;
var PKT_COLOR_CRC_TITLE;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_FRAME_TITLE;
var PKT_COLOR_ADDR_TITLE;
var PKT_COLOR_ENDPONT_TITLE;

var PKT_COLOR_OUT_TITLE;
var PKT_COLOR_IN_TITLE;
var PKT_COLOR_SOF_TITLE;
var PKT_COLOR_SETUP_TITLE;
var PKT_COLOR_PID_DATA_TITLE;
var PKT_COLOR_ACK_TITLE;
var PKT_COLOR_NACK_TITLE;
var PKT_COLOR_STALL_TITLE;
var PKT_COLOR_PRE_TITLE;

var start_sample_pid,end_sample_pid;
var start_sample_pid_data,end_sample_pid_data;
var start_sample_data,end_sample_data;
var start_sample_addr,end_sample_addr;
var start_sample_crc_first,end_sample_crc_first;
var start_sample_crc,end_sample_crc;
var start_sample_ack,end_sample_ack;

function decode()		//ATTENTION POUR LE MOMENT J'AI TRATTER QUE DU FULL, LE LOW INERSE D+ ET D-
{	
	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	get_ui_vals();                // Update the content of user interface variables


	//speed verification part:
	var real_spb = verify_speed();
	var real_baud = sample_rate/real_spb;
	
	if ((speed == 0) && (real_baud < 11000000)) //high
	{
		add_to_err_log("Captured data seems to be Low speed! (not High speed as selected");
		return;
	}
	
	if ((speed == 1) && (real_baud > 1700000)) //low speed
	{
		add_to_err_log("Captured data seems to be High Speed! (not Low Speed as selected");
		return;
	}
	
	if (speed == 2)	 //auto detect baud
	{
		if (real_baud > 1700000)
		{
			speed = 0; //high
		}
		else
		{
			speed = 1; //low
		}
	}
		
	if(speed == low)
	{
		baud = 1500000;
	}
	else if (speed == 0) //high
	{
		baud = 12000000;
	}


	spb = sample_rate/baud;
	
	//add_to_err_log("spb = " + spb);
	//return;
	
	PKT_COLOR_DATA = light_colors.gray;
	PKT_COLOR_CRC_TITLE = dark_colors.blue;
	PKT_COLOR_DATA_TITLE = dark_colors.black;
	PKT_COLOR_FRAME_TITLE = dark_colors.gray ;
	PKT_COLOR_ADDR_TITLE = dark_colors.orange;
	PKT_COLOR_ENDPONT_TITLE = dark_colors.violet;
	
	PKT_COLOR_OUT_TITLE = dark_colors.brown;
	PKT_COLOR_IN_TITLE = dark_colors.green;
	PKT_COLOR_SOF_TITLE = dark_colors.red;
	PKT_COLOR_SETUP_TITLE = dark_colors.pink;
	PKT_COLOR_PID_DATA_TITLE = dark_colors.yellow;
	PKT_COLOR_ACK_TITLE = light_colors.blue; 
	PKT_COLOR_NACK_TITLE = light_colors.pink;
	PKT_COLOR_STALL_TITLE = light_colors.yellow; 
	PKT_COLOR_PRE_TITLE = light_colors.orange; 
	
	
	transition_now_Dplus = trs_get_first(ch_plus);
	transition_now_Dmoins = trs_get_first(ch_moins);
	transition_next_Dplus = trs_get_next(ch_plus);
	transition_next_Dmoins = trs_get_next(ch_moins);

	Data_Recover();
	
	set_progress(50);

	transition_now_Dplus = trs_get_first(ch_plus);
	transition_now_Dmoins = trs_get_first(ch_moins);
	transition_next_Dplus = trs_get_next(ch_plus);
	transition_next_Dmoins = trs_get_next(ch_moins);
	
	Data_Analyse();
	
	set_progress(100);
	
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

function verify_speed()
{
	var trs_now = trs_get_first(ch_plus);
	var trs_prev = transition(0,0);
	var min_dt = 0x7FFFFFFF;
	var min_prev;
	if (trs_is_not_last(ch_plus)) trs_get_next(ch_plus) //skip first transition
	var i;
	trs_prev = trs_now
	for (i = 0; i < 250; i++) //search for the smallest pulse time (sync pulses)
	{
		if (trs_is_not_last(ch_plus))
		{
			trs_now = trs_get_next(ch_plus);
			if ((trs_now.sample - trs_prev.sample) < min_dt)
			{
				min_prev = min_dt;
				min_dt = (trs_now.sample - trs_prev.sample);
			}
			trs_prev = trs_now;
		}
	}
	return min_prev;
}

/*
*/
function Data_Recover()
{
	var state_recover = Status_table.SOF;
	var last_state_recover;
	var bit_Dmoins,bit_Dplus;
	var time;
	var cnt_bit = 0;
	var cnt_tab_sampl = 0;
	var next_transition = true;
	var val1,val2;
	var overflow = 0;
			
	if(speed == low)
	{
		val1 = 0;
		val2 = 1;
	}
	else
	{
		val1 = 1;
		val2 = 0;
	}	
	
	while(trs_is_not_last(ch_plus))
	{
		if (abort_requested() == true)
		{
			return false;
		}
		set_progress(transition_next_Dplus.sample * 50 / n_samples);
		switch (state_recover)
		{
			case Status_table.SOF:
				next_transition = true;	//move to next transition on next loop
				
				if((transition_now_Dplus.val == val1)&&(transition_next_Dplus.val == val2)) //new packet? (SOF))
				{
					//debug("SOF");
					if(speed == low)
						transition_now_Dmoins = trs_go_after(ch_moins, transition_next_Dplus.sample-20);
					else
						transition_now_Dmoins = trs_go_after(ch_moins, transition_next_Dplus.sample-20);	//"now" should be pointing to the very closest edge of the D+'s sof.
					
					
					
					time = transition_now_Dmoins.sample - transition_next_Dplus.sample;
					time = Math.abs(time);
					
					
					if(time < 45)
					{
						transition_now_Dmoins = trs_get_prev(ch_moins);
						transition_next_Dmoins = trs_get_next(ch_moins);
						
						transition_now_Dplus = transition_next_Dplus;
						transition_next_Dplus = trs_get_next(ch_plus);
						transition_now_Dmoins = transition_next_Dmoins;
						transition_next_Dmoins = trs_get_next(ch_moins);

						if((trs_is_not_last(ch_plus) || trs_is_not_last(ch_moins))&& ((transition_now_Dplus.val == val2)&&(transition_next_Dplus.val == val1)))
						{	
							last_state_recover = state_recover;
							state_recover = Status_table.DATA;
						}
						next_transition = false;
						
					}
					else
					{
						last_state_recover = state_recover;
						state_recover = Status_table.EOF;
					}
				}
				else
				{
					last_state_recover = state_recover;
					//state_recover = Status_table.EOF; //continue searching for SOF
				}
			break;
			
			case Status_table.DATA:		
				
				tab_sample_start_packet[cnt_tab_sampl] = transition_now_Dplus.sample;
				cnt_tab_sampl++;
				
				
				
				bit_sampler_ini(ch_plus, spb / 2, spb);
				bit_sampler_ini(ch_moins, spb / 2, spb);
				cnt_bit =0;
				
				bit_Dmoins = bit_sampler_next(ch_moins);
				bit_Dplus = bit_sampler_next(ch_plus);
				
				tab_Dplus[cnt_tab_packet] = new Array();
				tab_Dmoins[cnt_tab_packet] = new Array();
				

				overflow = 0;
				while ((bit_Dplus != bit_Dmoins) && trs_is_not_last(ch_moins) && trs_is_not_last(ch_plus))
				{
					tab_Dplus[cnt_tab_packet][cnt_bit]=bit_Dplus;
					tab_Dmoins[cnt_tab_packet][cnt_bit]=bit_Dmoins;
					cnt_bit++;
					bit_Dplus = bit_sampler_next(ch_plus);
					bit_Dmoins = bit_sampler_next(ch_moins);
					if (overflow++ > 150)
					{
						break;
					}
				}
				
				cnt_tab_packet++;
				last_state_recover = state_recover;
				state_recover = Status_table.EOF; 
			break;
			
			case Status_table.EOF:
				if(last_state_recover == Status_table.SOF)
				{
					next_transition = true;
					if((transition_now_Dplus.val == val2)&&(transition_next_Dplus.val == val1))
					{
						transition_now_Dmoins = trs_go_before(ch_moins, transition_next_Dplus.sample-5);
						if((transition_now_Dplus.val == transition_now_Dmoins.val))
						{
							last_state_recover = state_recover;
							state_recover = Status_table.SOF;
						}
					}	
				}
				else if (last_state_recover == Status_table.DATA)
				{
					while(bit_Dplus == bit_Dmoins)
					{
						//nothing
						bit_Dplus = bit_sampler_next(ch_plus);
						bit_Dmoins = bit_sampler_next(ch_moins);
						cnt_bit++;
					}
				
					cnt_bit -=1;
					
					if(speed == low)
						transition_now_Dplus = trs_go_before(ch_plus,transition_next_Dplus.sample+(spb*cnt_bit));
					else
						transition_now_Dplus = trs_go_after(ch_plus,transition_next_Dplus.sample+(spb*cnt_bit));
						
					transition_next_Dplus = trs_get_next(ch_plus);
					
					last_state_recover = state_recover;
					state_recover = Status_table.SOF; 
				}
			break;
		}
		
		if(next_transition == true)
		{
			transition_now_Dplus = transition_next_Dplus;
			transition_next_Dplus = trs_get_next(ch_plus);
		}
	}	
}


/*
*/
function Data_Analyse()
{
	var start_packet;
	var end_decode = false;
	var nbr_packet;
	var packet_length;
	var CRC_valid = false;
	var val_packet = 0;
	var text_packet_PID = "PID ";
	var text_crc = ""
	var text_packet = ""
	var end = false;
	var pid = "";
	var color = PKT_COLOR_DATA;
	var first = true;

	for(nbr_packet=0; nbr_packet < cnt_tab_packet; nbr_packet++)
	{
		//if(nbr_packet == cnt_tab_packet/2)
		//	set_progress(75);
		set_progress(50 + (nbr_packet * 50 / cnt_tab_packet));	
		
		while(end_decode == false)
		{
			if (abort_requested() == true)
			{
				return false;
			}
			//debug("packet:" + nbr_packet + "/" + cnt_tab_packet + ", state_packet_analyse = " + state_packet_analyse);
			
			switch(state_packet_analyse)
			{
				case Status_packet_table.PID:
					start_packet = transition_now_Dplus.sample+tab_sample_start_packet[nbr_packet]+(spb*8);
					
					packet_length = 8;
					bit_stuffing = 0;	
					
					if((pid != "OUT")&&(pid!="IN")&&(pid != "DATA"))
						pkt_start("USB 1.1");
						
					text_packet_PID = "PID : ";
					
					val_packet = Decode_packet(start_packet,8,nbr_packet,packet_length);
					hex_add_byte(ch_plus,-1,-1,val_packet);
					
					if(test_stuffing == true)
					{
						test_stuffing = false;
						packet_length++;
					}
					
					nav_tab = 8+packet_length;
					
					dec_item_new(ch_plus, start_packet-(spb*8), start_packet);
					dec_item_add_pre_text("SYNC");
					dec_item_add_pre_text("S");
					
					dec_item_new(ch_plus, start_packet, start_packet+(spb*packet_length));
					//debug("val_packet = " + val_packet);
					
					switch (val_packet)
					{
						case PID_table.OUT:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.ADDR_ENDPOINT;
							text_packet = "OUT";
							text_pid = "OUT";
							pid = "OUT";
							first = false;
							start_sample_pid = start_packet-(spb*8);
							end_sample_pid = start_packet+(spb*packet_length);
						break;
						case PID_table.IN:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.ADDR_ENDPOINT;
							text_packet = "IN";
							text_pid = "IN";
							pid = "IN";
							first = false;
							start_sample_pid = start_packet-(spb*8);
							end_sample_pid = start_packet+(spb*packet_length);
						break;
						case PID_table.SOF:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.FRAME_NBR;
							text_packet = "SOF";
							color = PKT_COLOR_SOF_TITLE;
							pid = "";
						break;
						case PID_table.SETUP:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.ADDR_ENDPOINT;
							text_packet = "SETUP";
							text_pid = "SETUP";
							pid = "SETUP";
							first = false;
							start_sample_pid = start_packet-(spb*8);
							end_sample_pid = start_packet+(spb*packet_length);
						break;
						case PID_table.DATA0:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.DATA;
							text_packet = "DATA0";
							data_empty = false;
							pid = "DATA";
							start_sample_pid_data = start_packet-(spb*8);
							end_sample_pid_data = start_packet+(spb*packet_length);
							data_type = 0;
						break;
						case PID_table.DATA1:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.DATA;
							text_packet = "DATA1";
							data_empty = false;
							pid = "DATA";
							start_sample_pid_data = start_packet-(spb*8);
							end_sample_pid_data = start_packet+(spb*packet_length);
							data_type = 1;
						break;
						case PID_table.ACK:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.PID;
							text_packet = "ACK";
							color = PKT_COLOR_ACK_TITLE;
							
							start_sample_ack = start_packet-(spb*8);
							end_sample_ack = start_packet+(spb*packet_length);
							
							if(first == false)
								//pkt_data_view(text_packet,color); 

							pid = "";
							end = true;
							end_decode = true;
						break;
						case PID_table.NACK:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.PID;
							text_packet = "NACK";
							color = PKT_COLOR_NACK_TITLE;
							
							start_sample_ack = start_packet-(spb*8);
							end_sample_ack = start_packet+(spb*packet_length);
							
							if(first == false)
								pkt_data_view(text_packet,color);
								
							pid = "";
							end = true;
							end_decode = true;
						break;
						case PID_table.STALL:
							
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.PID;
							text_packet = "STALL";
							color = PKT_COLOR_STALL_TITLE;
							
							start_sample_ack = start_packet-(spb*8);
							end_sample_ack = start_packet+(spb*packet_length);
							
							if(first == false)
							{
								
								pkt_data_view(text_packet,color);
							}
							
							pid = "";
							end = true;
							end_decode = true;
						break;
						case PID_table.PRE:
							last_state_packet_analyse = state_packet_analyse;
							state_packet_analyse = Status_packet_table.PID;
							text_packet = "PRE";
							color = PKT_COLOR_PRE_TITLE;
							pid = "";
							end = true;
							end_decode = true;
						break;
					}

					dec_item_add_pre_text(text_packet_PID+text_packet);
					dec_item_add_pre_text(text_packet);
					
					if((text_packet == "SOF") || (text_packet == "PRE") || (first == true))
						pkt_add_item(-1,-1,text_packet_PID+text_packet,"",color,PKT_COLOR_DATA,true);
					
					if(end == true)
					{
						pkt_end();
						end = false;
					}
					
				break;
				
				case Status_packet_table.ADDR_ENDPOINT:
					start_packet = transition_now_Dplus.sample+tab_sample_start_packet[nbr_packet]+(spb*nav_tab);
					
					packet_length = 11;
					
					val_addr_endpoint = Decode_packet(start_packet,nav_tab,nbr_packet,packet_length);
					hex_add_byte(ch_plus,-1,-1,val_addr_endpoint);
					
					if(test_stuffing == true)
					{
						test_stuffing = false;
						packet_length++;
					}
					
					start_sample_addr = start_packet;
					end_sample_addr = start_packet+(spb*packet_length);
					
					length_nbr_to_divide = packet_length;
					nav_tab += packet_length;
					
					dec_item_new(ch_plus, start_packet, start_packet+(spb*packet_length));
					dec_item_add_pre_text("ADDR + ENDPOINT");
					dec_item_add_pre_text("ADDR+...");
					dec_item_add_pre_text("...");
				
					last_state_packet_analyse = state_packet_analyse;
					state_packet_analyse = Status_packet_table.CRC;
				break;
				
				case Status_packet_table.FRAME_NBR:
					start_packet = transition_now_Dplus.sample+tab_sample_start_packet[nbr_packet]+(spb*nav_tab);
					
					packet_length = 11;
					
					val_packet = Decode_packet(start_packet,nav_tab,nbr_packet,packet_length);
					hex_add_byte(ch_plus,-1,-1,val_packet);
					
					if(test_stuffing == true)
					{
						test_stuffing = false;
						packet_length++;
					}
					
					length_nbr_to_divide = packet_length;
					nav_tab += packet_length;
					
					dec_item_new(ch_plus, start_packet, start_packet+(spb*packet_length));
					dec_item_add_pre_text("FRAME NUMBER");
					dec_item_add_pre_text("FRAME NBR");
					dec_item_add_pre_text("FRAME");
					dec_item_add_pre_text("...");
					
					pkt_add_item(-1,-1,"FRAME_NBR",val_packet,PKT_COLOR_FRAME_TITLE,PKT_COLOR_DATA,true);
					
					last_state_packet_analyse = state_packet_analyse;
					state_packet_analyse = Status_packet_table.CRC;
				break;
				
				case Status_packet_table.DATA:
					start_packet = transition_now_Dplus.sample+tab_sample_start_packet[nbr_packet]+(spb*nav_tab);
					start_sample_data = start_packet;
					
					if(((tab_Dplus[nbr_packet].length+1) - nav_tab) > 23)
					{
						zero_data = false;
						
						packet_length = 8;
						
						val_packet = Decode_packet(start_packet,nav_tab,nbr_packet,packet_length);
						hex_add_byte(ch_plus,-1,-1,val_packet);
						
						tab_data[cnt_data] = int_to_str_hex(val_packet);
						cnt_data++;
						
						if(test_stuffing == true)
						{
							test_stuffing = false;
							packet_length++;
						}
							
						length_nbr_to_divide = packet_length;
						nav_tab += packet_length;
						
						dec_item_new(ch_plus, start_packet, start_packet+(spb*packet_length));
						dec_item_add_pre_text("DATA : "+tab_data[cnt_data-1]);
						dec_item_add_pre_text(tab_data[cnt_data-1]);
				
						Decode_data(nbr_packet);
					}
					else	
						zero_data = true;
							
					last_state_packet_analyse = state_packet_analyse;
					state_packet_analyse = Status_packet_table.CRC;
				break;
				
				case Status_packet_table.CRC:
					start_packet = transition_now_Dplus.sample+tab_sample_start_packet[nbr_packet]+(spb*nav_tab);
					
					if(last_state_packet_analyse != Status_packet_table.DATA)
					{
						packet_length = 5;
					}
					else
					{	
						packet_length = 16;
					}
					text_packet = "CRC ";
					
					val_CRC = Decode_packet(start_packet,nav_tab,nbr_packet,packet_length);
					hex_add_byte(ch_plus,-1,-1,val_CRC);
					
					if(test_stuffing == true)
					{
						test_stuffing = false;
						packet_length++;
					}
					
					nav_tab += packet_length;
					
					dec_item_new(ch_plus, start_packet, start_packet+(spb*packet_length));
					
					CRC_valid = CRC_Calcul();
					
					if(CRC_valid == true)
					{
						text_crc = "OK";
					}
					else
					{
						text_crc = "ERROR";
					}

					dec_item_add_pre_text(text_packet+text_crc);
					dec_item_add_pre_text(text_crc);
					dec_item_add_pre_text(text_packet);
					
					if(last_state_packet_analyse == Status_packet_table.FRAME_NBR)
						pkt_add_item(-1,-1,"CRC",new_value,PKT_COLOR_CRC_TITLE,PKT_COLOR_DATA,true);
					else if ((pid == "OUT") || (pid == "IN"))
					{
						val_crc_data_first = new_value;
						start_sample_crc_first = start_packet;
						end_sample_crc_first = start_packet+(spb*packet_length);
					}
					
					start_sample_crc = start_packet;
					end_sample_crc = start_packet+(spb*packet_length);
					
					if((pid != "OUT")&&(pid!="IN")&&(pid != "DATA"))
						pkt_end();
					
					last_state_packet_analyse = state_packet_analyse;
					state_packet_analyse = Status_packet_table.PID;
					end_decode = true;
				break;
			}
			
		}
		end_decode = false;	
		first = false;
	}	
}


/*
*/
function Decode_packet(start_sample,start_tab,packet,length_packet) 
{
	var bit_place = 0;
	var val=0;
	var i;

	midSample = start_sample+(spb/2);
	
	for(i=(start_tab-1); i<(start_tab-1+length_packet); i++)
	{	
		if(tab_Dplus[packet][i] != tab_Dplus[packet][i-1])
		{
			dec_item_add_sample_point(ch_plus, midSample, DRAW_0);
			val |= 0<<bit_place;
			if((state_packet_analyse != Status_packet_table.PID)&&(state_packet_analyse != Status_packet_table.CRC))
			{
				tab_data_crc[cnt_data_crc] = 0;
				cnt_data_crc++;
			}		
			bit_stuffing = 0;
		}
		else
		{
			dec_item_add_sample_point(ch_plus, midSample, DRAW_1);
			val|= 1<<bit_place;
			if((state_packet_analyse != Status_packet_table.PID)&&(state_packet_analyse != Status_packet_table.CRC))
			{
				tab_data_crc[cnt_data_crc] = 1;
				cnt_data_crc++;
			}
			bit_stuffing++;
		}		
			
		midSample += spb;
		bit_place++;
		
		if(bit_stuffing == 6)
		{
			length_packet++;
			test_stuffing = true;
			bit_stuffing = 0;
			bit_place--;
		}
	}
	
	if(state_packet_analyse == Status_packet_table.PID)
		val &= 0x0F;
		
	return(val);
}


/*
*/
function Decode_data(packet)
{
	var bit_restan = (tab_Dplus[packet].length+1) -(16+length_nbr_to_divide); 
	
	while(bit_restan >= 24)
	{
		start_packet = transition_now_Dplus.sample+tab_sample_start_packet[packet]+(spb*nav_tab);
					
		packet_length = 8;
			
		val_packet = Decode_packet(start_packet,nav_tab,packet,packet_length);
		hex_add_byte(ch_plus,-1,-1,val_packet);
		tab_data[cnt_data] = int_to_str_hex(val_packet);
		cnt_data++;
		
		if(test_stuffing == true)
		{
			test_stuffing = false;
			packet_length++;
		}	
			
		nav_tab += packet_length;
		bit_restan -= packet_length;
		
		dec_item_new(ch_plus, start_packet, start_packet+(spb*packet_length));
		dec_item_add_pre_text("DATA : "+tab_data[cnt_data-1]);
		dec_item_add_pre_text(tab_data[cnt_data-1]);
	}
	
	end_sample_data = start_packet+(spb*packet_length);
}


/*
*/
function CRC_Calcul()
{
	var poly_data = new Array(1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1);
	var poly_token = new Array(1,0,0,1,0,1);
	var verif = false;
	var len,j;
	var nav_crc = 0;
	var remainder = false;
	var end = false;
	var crc_type;
	val_CRC_calul = 0;

	if(last_state_packet_analyse == Status_packet_table.DATA)
		crc_type = 16;
	else
		crc_type = 5;
	
	len = tab_data_crc.length;
	
	if(len != 0)	
	{
		for(j=0; j<crc_type; j++)
		{
			tab_data_crc[j] ^= 1;
			tab_data_crc[j+len] = 0;
		}		
		
		while (remainder == false)
		{
			while((tab_data_crc[nav_crc] == 0) && (end == false))
			{
				nav_crc++;
				if (nav_crc == len)
				{
					end = true;
					remainder = true;
				}
					
			}
	
			if(nav_crc < len)
			{	
				for(j=0; j<(crc_type+1); j++)
				{
					if(last_state_packet_analyse == Status_packet_table.DATA)
						tab_data_crc[nav_crc+j] ^= poly_data[j];
					else
						tab_data_crc[nav_crc+j] ^= poly_token[j];
				}
				nav_crc++;
			}
			else
			{
				remainder = true;
			}
		}
		for (j=0; j<crc_type; j++)
		{
			tab_data_crc[len+j] ^= 1;	
			val_CRC_calul |= tab_data_crc[len+j]<<j;
		}
	}	
	else
		val_CRC_calul = 0;	

	if(val_CRC_calul == val_CRC)
		verif = true;
	else
	{
		verif = false;
		//debug("CRC shold be" + val_CRC_calul + " but is " + val_CRC)		;
	}

		
	new_value = val_CRC_calul;
	
	if(zero_data == true)

	val_CRC_calul = 0;
	cnt_data_crc=0;
	tab_data_crc.length = 0;
		
	return verif;	
}

/*
*/
function pkt_data()
{	
	var data = "";
	var n,p,x;
	var ligne = 0;
	var data_tmp;
	
	data = tab_data[0]+" "+tab_data[1];
	
	if(tab_data.length > 2)
		data += " ...";
	
	pkt_add_item(Math.round(start_sample_data),Math.round(end_sample_data),"DATA",data,PKT_COLOR_DATA_TITLE,PKT_COLOR_DATA,true);
	
	data = "";
	
	if (tab_data.length % 8)
	{
		x = Math.floor(tab_data.length/8)+1;
	}
	else
	{
		x = tab_data.length/8;
	}
	
	for (p=0; p<x; p++)
	{
		for(n=0; n<8; n++)
		{
			if(n+ligne<cnt_data)
				data += tab_data[n+ligne]+" ";
		}
		
		data += "| ";
		
		for (n=0; n<8; n++)
		{
			if (n+ligne<cnt_data)
			{
				if ((tab_data[n+ligne]>0x1F)&&(tab_data[n+ligne] < 0x7F))
				{
					data_tmp = hex_to_ascii(tab_data[n+ligne]);
					data += data_tmp;
				}
				else
				data +=".";
			}
			else
				data +=" ";
		}
		
		data += "\n\r";
		ligne += 8;
	}	

	pkt_start("USB DATA");		
		pkt_add_item(Math.round(start_sample_data),Math.round(end_sample_data),"DATA",data,PKT_COLOR_DATA_TITLE,PKT_COLOR_DATA,true);	
	pkt_end();

	cnt_data = 0;
	tab_data.length = 0;
}


/*
*/
function hex_to_ascii(hexx)
{
	var hex = hexx.toString();
	var str = "";
	
	for(var i = 0; i<hex.length; i +=2)
		str += String.fromCharCode(parseInt(hex.substr(i,2),16));
		
	return str;
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
function pkt_data_view(text,colo)
{
	var color_pid;
	var text_data = "";
	
	if(text_pid =="IN")
		color_pid = PKT_COLOR_IN_TITLE;
	else if (text_pid == "OUT")
		color_pid = PKT_COLOR_OUT_TITLE;
	else if (text_pid == "SETUP")
		color_pid = PKT_COLOR_SETUP_TITLE;
		
	if(data_type == 0)
		text_data = "PID : DATA0";
	else
		text_data = "PID : DATA1";
	
	if(PacketView == 0)
	{	
		if(data_empty == false)
		{
			pkt_add_item(Math.round(start_sample_pid),Math.round(end_sample_pid),"PID : "+text_pid,"",color_pid,PKT_COLOR_DATA,true);
			pkt_add_item(Math.round(start_sample_addr),Math.round(end_sample_addr),"ADDR",(val_addr_endpoint&0x1F),PKT_COLOR_ADDR_TITLE,PKT_COLOR_DATA,true);
			pkt_add_item(Math.round(start_sample_addr),Math.round(end_sample_addr),"ENDPOINT",((val_addr_endpoint&0x1E0)>>7),PKT_COLOR_ENDPONT_TITLE,PKT_COLOR_DATA,true);
			pkt_add_item(Math.round(start_sample_crc_first),Math.round(end_sample_crc_first),"CRC",val_crc_data_first,PKT_COLOR_CRC_TITLE,PKT_COLOR_DATA,true);
			
			pkt_add_item(Math.round(start_sample_pid_data),Math.round(end_sample_pid_data),text_data,"",PKT_COLOR_PID_DATA_TITLE,PKT_COLOR_DATA,true);
			if(zero_data == false)
			{
				pkt_data();
			}
			else
			{
				pkt_add_item(Math.round(start_sample_pid_data),Math.round(end_sample_crc),"DATA","0 data",PKT_COLOR_DATA_TITLE,PKT_COLOR_DATA,true);
				zero_data = false;
			}
			
			pkt_add_item(Math.round(start_sample_crc),Math.round(end_sample_crc),"CRC",new_value,PKT_COLOR_CRC_TITLE,PKT_COLOR_DATA,true);
			
			pkt_add_item(Math.round(start_sample_ack),Math.round(end_sample_ack),text,"",colo,PKT_COLOR_DATA,true);
			
			data_empty = true;
		}
	}
	else
	{
		pkt_add_item(Math.round(start_sample_pid),Math.round(end_sample_pid),"PID : "+text_pid,"",color_pid,PKT_COLOR_DATA,true);
		pkt_add_item(Math.round(start_sample_addr),Math.round(end_sample_addr),"ADDR",(val_addr_endpoint&0x1F),PKT_COLOR_ADDR_TITLE,PKT_COLOR_DATA,true);
		pkt_add_item(Math.round(start_sample_addr),Math.round(end_sample_addr),"ENDPOINT",((val_addr_endpoint&0x1E0)>>7),PKT_COLOR_ENDPONT_TITLE,PKT_COLOR_DATA,true);
		pkt_add_item(Math.round(start_sample_crc_first),Math.round(end_sample_crc_first),"CRC",val_crc_data_first,PKT_COLOR_CRC_TITLE,PKT_COLOR_DATA,true);
		
		if(data_empty == false)
		{
			data_empty = true;
			pkt_add_item(Math.round(start_sample_pid_data),Math.round(end_sample_pid_data),"PID : DATA","",PKT_COLOR_PID_DATA_TITLE,PKT_COLOR_DATA,true);
			pkt_data();
			pkt_add_item(Math.round(start_sample_crc),Math.round(end_sample_crc),"CRC",new_value,PKT_COLOR_CRC_TITLE,PKT_COLOR_DATA,true);
		}
		
		pkt_add_item(Math.round(start_sample_ack),Math.round(end_sample_ack),text,"",colo,PKT_COLOR_DATA,true);
	}

}
