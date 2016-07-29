/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	USB 1.1 Protcol Decoder

</DESCRIPTION>

<RELEASE_NOTES>

	V2.0:  New version, initial release
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
/*
*************************************************************************************
								      INFO
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
	return "2.0";
}

/* Author 
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

var State_packet =
{
	SYNC	: 0x01,
	PID 	: 0x02,
	SUBP	: 0x03,
	CRC 	: 0x04,
	EOP 	: 0x05	
}

var PID_table =
{
	OUT		: 0xE1,		
	IN		: 0x69,		
	SOF		: 0xA5,		
	SETUP	: 0x2D,		
	DATA0	: 0xC3,		
	DATA1	: 0x4B,		
	ACK		: 0xD2,		
	NAK		: 0x5A,		
	STALL	: 0x1E		
}
var spb;
var channel;
var current_state=0x01;
var after_pid=0;
var val_init;
var tab_init=new Array();

var final_data;
var item;
var item_hex;
var item_ascii;

var bit=1;
var bit_eop1=1;
var bit_eop2=1;
var bit_eop3=1;
var bit1,bit2,bit3;
var eop=false;

var bit_stuffing=0;
var test_stuffing=false;
var number_stuffing=0;

var tab_packet_data=new Array();
var tab_indice=new Array();

var tab_data_crc = new Array();
var tab_data_crc_prov=new Array();
var val_CRC = 0;
var CRC5=true;

var ind=0;
var ind_end=0;

//global variables for demo
var packet =
{
	TOKEN 		: 0x01,
	DATA 		: 0x02,
	HANDSHAKE 	: 0x03
	
}
var srate;
var sample_per_bit;
var BAUD;
var last_bit=1;
var e=0;
var token=0;
var handshake=0;
var data=0;
var inc1=0;
var err_acc=0;
var epb;

//global variables for trigger
var bit_time;
var bt_max;
var bt_min;
var tab_pid=new Array();
var tab_nb_bit=new Array();
var indice=0;
var nb_trs=0;
var prev_bit=0;


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
	ui_add_ch_selector( "ch_plus", "Channel D+ ", "D+" );
	ui_add_ch_selector( "ch_moins", "Channel D- ", "D-" );
	ui_add_txt_combo( "speed", "USB bit-rate" );
		ui_add_item_to_txt_combo( "Full speed (12 Mbps)" );
		ui_add_item_to_txt_combo( "Low speed (1.5 Mbps)" );
		ui_add_item_to_txt_combo( "Auto detect", true );
	ui_add_separator();
}

/*This function follows a state machine that depends on the protocol USB :
	initial state : state of synchronization
	second state : identification of the packet
	third state : depends on the type of packet
	fourth state : check of the CRC
	last state : detection of the end of packet
*/	
function decode()		
{	
	get_ui_vals();                // Update the content of user interface variables
	clear_dec_items();            // Clears all the the decoder items and its content
	var low=1;
	var full=0;
	var baud;
	var d;

	var t;
	var crc_ok;
	
	//speed verification part:
	
	var real_spb = verify_speed();
	var real_baud = sample_rate/real_spb;
	
	if ((speed == 0) && (real_baud < 11000000)) //full speed
	{
		add_to_err_log("Captured data seem to be Low speed! (not Full speed as selected)");
		return;
	}
	if ((speed == 1) && (real_baud > 1700000)) //low speed
	{
		add_to_err_log("Captured data seem to be Full Speed! (not Low Speed as selected)");
		return;
	}
	if (speed == 2)	 //auto detect baud
	{
		if (real_baud > 1700000)
		{
			speed = full; 
		}
		else
		{
			speed = low;
		}
	}
	if(speed == low)
	{
		baud = 1500000;
	}
	else if (speed == full) //inversion of the channels for full speed
	{
		baud = 12000000;
		channel = ch_plus;
		ch_plus = ch_moins;
		ch_moins = channel;
	}
	spb = sample_rate/baud;
	var transition = trs_get_first(ch_moins);
	var transition2 = trs_get_first(ch_plus);

	while(trs_is_not_last(ch_moins))
	{
		d = 0;
		switch(current_state)
		{
			case State_packet.SYNC : 
				bit_sampler_ini(ch_moins,spb/2,spb);
				bit = 1;
				val_init = 1;
				acqui_data(8);
				test_stuffing = false;
				number_stuffing = 0;
				if(final_data == 0x80)
				{
					pkt_start("USB 1.1");
					dec_item_new(ch_moins, transition.sample , transition.sample + spb*8);
					dec_item_add_pre_text("sync: "+int_to_str_hex(final_data));
					dec_item_add_pre_text("sync");
					hex_add_byte(ch_moins,-1,-1,final_data);
					pkt_add_item(transition.sample,transition.sample+spb*8,"SYNC",int_to_str_hex(final_data),dark_colors.red,light_colors.red,1);
					current_state=State_packet.PID;					
				}
				else transition=trs_go_after(ch_moins,transition.sample); // advancing to the next transition until a SYNC field is found
			break;
			
			case State_packet.PID :
				acqui_data(8);
				detection_PID(transition.sample);
			break;
			
			case State_packet.SUBP : 
				detection_after_PID(transition);
				current_state=State_packet.CRC;
			break;
			
			case State_packet.CRC :
				if(CRC5)
				{
					acqui_data(5);
					val_CRC = final_data;
					crc_ok = CRC_Calcul(0);
					if(test_stuffing == true && number_stuffing == 0)
					{	
						number_stuffing++;
						test_stuffing = false;
						transition=trs_go_after(ch_moins,transition.sample);	
						dec_item_new(ch_moins, transition.sample+spb*(27-number_stuffing) , transition.sample + spb *(32+number_stuffing));
					}
					else
					{
						dec_item_new(ch_moins, transition.sample+spb*(27+number_stuffing) , transition.sample + spb *(32+number_stuffing));
					}
					dec_item_add_pre_text("CRC5 : "+int_to_str_hex(final_data)+" "+crc_ok);
					dec_item_add_pre_text("CRC5");
					pkt_add_item(transition.sample + spb*27 , transition.sample + spb*32,"CRC5 : "+crc_ok,int_to_str_hex(final_data),dark_colors.orange,light_colors.orange,1);
					hex_add_byte(ch_moins,-1,-1,final_data);							
				}
				current_state=State_packet.EOP; 
			break;
			
			case State_packet.EOP : //once we get a full packet, we can advance the transition of the length of this packet
				switch(after_pid)
				{
					case 1:
						detection_eop(transition);
						transition = trs_go_after(ch_moins,transition.sample+spb*32);
					break;
					
					case 2 :
						current_state=State_packet.SYNC;
						transition = trs_go_after(ch_moins,transition.sample+spb*8+spb*(8*ind-number_stuffing));
					break;
					
					case 3 :
						detection_eop(transition);
						transition = trs_go_after(ch_moins,transition.sample+spb*16);
					break;
					case 4 :
						after_pid = 1;
						detection_eop(transition);
						transition = trs_go_after(ch_moins,transition.sample+spb*(32-number_stuffing));
					break;
				}
			break;			
		}
		set_progress(transition.sample*100/get_n_samples());
	}
}	

/* This function aims to put a number (=length_data) of bits in a array.
*/
function acqui_data(length_data)
{
	for(i=0;i<length_data+1;i++)
	{
		tab_init[i] = 0;
	}
	tab_init[0] = bit_sampler_next(ch_moins);
	for (b = 0; b < length_data-1; b++)
	{
		bit = bit_sampler_next(ch_moins);
		tab_init[b+1] = bit;
	}
	final_data = decode_data(length_data+1);
}

/* This function decodes the data in NRZI codage and returns the decimal value of the
bits in tab_init. 
It also tests if there is  bit stuffing (7 consecutive bits at 1 or 0). 
Finally, it puts each necessary bit(without the bit due to stuffing) in an array to 
have the possibility to calculate the CRC. 
*/
function decode_data(length_Data)
{
	var bit_place = 0;
	var val = 0;
	var d = 1;
	var j = 0;
	var ind_tab = 0;
	var ind_tab1 = 0;
	ind_end = 0;
	
	if(tab_init[0] != val_init)
	{	
		val |= 0 << bit_place;
		tab_data_crc_prov[0] = 0;
		bit_stuffing = 0;
	}
	else
	{
		val |= 1 << bit_place;
		tab_data_crc_prov[0] = 1;
		bit_stuffing++;
		if(bit_stuffing == 6)
		{
			bit_stuffing = 0;
			bit_place--;
			length_Data++;
			test_stuffing = true;
		}
	}
	bit_place++;
	
	while(d<length_Data-1)
	{
		if(test_stuffing == true && d == length_Data-2)
		{
			tab_init[d] = bit_sampler_next(ch_moins);
			val_init = tab_init[d];
			ind_end++;
		}
		else{
			val_init = bit;
		}
		if(tab_init[d] != tab_init[d-1])
		{	
			val |= 0<<bit_place;
			bit_stuffing = 0;
			tab_data_crc_prov[d] = 0;	
		}
		else
		{
			val |= 1<<bit_place;
			bit_stuffing++;
			tab_data_crc_prov[d] = 1;	
		}
		bit_place++;
		
		if(bit_stuffing == 6)
		{
			bit_stuffing = 0;
			bit_place--;
			length_Data++;
			test_stuffing = true;
			if(ind_tab == 0)	//this part of the code allows to take care of the case where there are two stuffing bits in one byte
			{
				ind_tab = d;
			}
			else{
				ind_tab1 = d;
			}
		}
		d++;
	}
	if(test_stuffing == true)
	{
		for(j=ind_tab;j<length_Data-2;j++) //removing the stuffing bit(s) from the array for the crc calcul 
		{
			tab_data_crc_prov[j+1] = tab_data_crc_prov[j+2];
		}
		if(ind_tab1 != 0)
		{
			for(j=ind_tab1;j<length_Data-2;j++)
			{
				tab_data_crc_prov[j+1] = tab_data_crc_prov[j+2];
			}
		}
	}
	return val;	
}


/* This function detects the packet identifier. 
The global variable after_pid will allow to differentiate if the packet is a token 
packet, data packet or handshake packet
The PID SOF belongs to token packet but its protocol is different so I put it in 
another category
*/
function detection_PID(start_sample)
{
	switch(final_data)
	{
		case PID_table.OUT : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID OUT : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("OUT");
			hex_add_byte(ch_moins,-1,-1,final_data);
			pkt_add_item(-1,-1,"TOKEN PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID OUT ",int_to_str_hex(final_data),dark_colors.orange,light_colors.orange,1);
			after_pid = 1;
			current_state = State_packet.SUBP;
		break;
		
		case PID_table.IN : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID IN : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("IN");
			hex_add_byte(ch_moins,-1,-1,final_data);
			pkt_add_item(-1,-1,"TOKEN PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID IN ",int_to_str_hex(final_data),dark_colors.orange,light_colors.orange,1);
			after_pid = 1;
			current_state = State_packet.SUBP;
		break;
		
		case PID_table.SOF : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID SOF : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("SOF");
			hex_add_byte(ch_moins,-1,-1,final_data);
			pkt_add_item(-1,-1,"TOKEN PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID SOF ",int_to_str_hex(final_data),dark_colors.orange,light_colors.orange,1);
			after_pid = 4;
			current_state = State_packet.SUBP;
		break;
		
		case PID_table.SETUP : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID SETUP : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("SETUP");
			hex_add_byte(ch_moins,-1,-1,final_data);
			pkt_add_item(-1,-1,"TOKEN PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID SETUP ",int_to_str_hex(final_data),dark_colors.orange,light_colors.orange,1);
			after_pid = 1;
			current_state = State_packet.SUBP;
		break;
		
		case PID_table.DATA0 : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID DATA0 : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("DATA0");
			pkt_add_item(-1,-1,"DATA PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID DATA0 ",int_to_str_hex(final_data),dark_colors.blue,light_colors.blue,1);
			hex_add_byte(ch_moins,-1,-1,final_data);
			after_pid = 2;
			current_state = State_packet.SUBP;
		break;
		
		case PID_table.DATA1 : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID DATA1 : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("DATA1");
			pkt_add_item(-1,-1,"DATA PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID DATA1 ",int_to_str_hex(final_data),dark_colors.blue,light_colors.blue,1);
			hex_add_byte(ch_moins,-1,-1,final_data);
			after_pid = 2;
			current_state = State_packet.SUBP;
		break;
		
		case PID_table.ACK : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID ACK : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("ACK");
			hex_add_byte(ch_moins,-1,-1,final_data);
			pkt_add_item(-1,-1,"HANDSHAKE PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID ACK ",int_to_str_hex(final_data),dark_colors.green,light_colors.green,1);			
			after_pid = 3;
			current_state = State_packet.EOP;
		break;
		
		case PID_table.NAK : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID NAK : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("NAK");
			hex_add_byte(ch_moins,-1,-1,final_data);
			pkt_add_item(-1,-1,"HANDSHAKE PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID NAK ",int_to_str_hex(final_data),dark_colors.green,light_colors.green,1);
			after_pid = 3;
			current_state = State_packet.EOP;
		break;
		
		case PID_table.STALL : 
			dec_item_new(ch_moins, start_sample + spb*8 , start_sample + spb*16);
			dec_item_add_pre_text("PID STALL : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("STALL");
			pkt_add_item(-1,-1,"HANDSHAKE PACKET"," ",light_colors.gray,light_colors.white,1);
			pkt_add_item(start_sample+spb*8,start_sample+spb*16,"PID STALL ",int_to_str_hex(final_data),dark_colors.green,light_colors.green,1);
			hex_add_byte(ch_moins,-1,-1,final_data);
			after_pid = 3;
			current_state=State_packet.EOP;
		break;
	}
}

/* This function detects and analyses the bytes following the PID.
*/
function detection_after_PID(start_trs)
{	
	switch(after_pid)
	{
		/*For the token packet : detection of 7 bits for the address and 4 bits for 
		the endpoint. */
		case 1 :
			val_CRC = 0;
			CRC5 = true;
			acqui_data(7);  //addr
			for(d=0;d<7;d++)
			{
				tab_data_crc[d] = tab_data_crc_prov[d];
			}
			dec_item_new(ch_moins, start_trs.sample + spb*16 , start_trs.sample + spb*23);
			dec_item_add_pre_text("ADDR : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("ADDR");
			pkt_add_item(start_trs.sample + spb*16 , start_trs.sample + spb*23,"ADDR",int_to_str_hex(final_data),light_colors.yellow,light_colors.gray,1);
			
			acqui_data(4);	//endp
			for(d=0;d<4;d++)
			{
				tab_data_crc[d+7] = tab_data_crc_prov[d];
			}
			dec_item_new(ch_moins, start_trs.sample + spb*23 , start_trs.sample + spb*27);
			dec_item_add_pre_text("ENDP : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("ENDP");
			pkt_add_item(start_trs.sample + spb*23 , start_trs.sample + spb*27,"ENDP",int_to_str_hex(final_data),light_colors.yellow,light_colors.gray,1);	
		break;
		
		/*For the data packet : detection and storage of bytes until the EOP is found. 
		Then the two last bytes are for the CRC16, the others are the data. */
		case 2 : 
			var num_data = 0;
			val_CRC = 0;
			var z = 0;
			CRC5 = false;

			while(eop==false)
			{	
				if(test_stuffing == true)
				{	
					z++;	
					test_stuffing = false;
					for(d=0;d<ind_end;d++)
					{
						start_trs = trs_go_after(ch_moins,start_trs.sample);
						number_stuffing++;
					}
					tab_indice[z] = num_data;	
				}
				detection_eop(start_trs,num_data);
				acqui_data(8);
				tab_packet_data[num_data] = final_data;
				
				for(d=0;d<8;d++)
				{
					tab_data_crc[d+8*num_data] = tab_data_crc_prov[d];
				}			
				num_data++;
			}
			ind = num_data;
			eop = false;
		
		//data
			pkt_add_item( -1,-1,"DATA","",light_colors.blue,light_colors.white,1);
			pkt_start("DATA");
			
			switch(number_stuffing)
			{
				case 0 :
					for(d=0;d<(num_data-3);d++)
					{	
						item = tab_packet_data[d];
						item_hex = int_to_str_hex(item);
						if (item >32 && item<127)
						{
							item_ascii = hex_to_ascii(item_hex);
							pkt_add_item(start_trs.sample+16*spb+d*spb*8,start_trs.sample+spb*24+d*spb*8,"data : "+d , item_hex+" ("+item_ascii+")",light_colors.blue,light_colors.gray,1);
						}
						else
						{
							pkt_add_item(start_trs.sample+16*spb+d*spb*8,start_trs.sample+spb*24+d*spb*8,"data : "+d , item_hex,light_colors.blue,light_colors.gray,1);
						
						}
						dec_item_new(ch_moins, start_trs.sample + 16*spb + d*spb*8 , start_trs.sample + spb*24 + d*spb*8);
						dec_item_add_pre_text("data : "+item_hex);
						dec_item_add_pre_text("data");
						hex_add_byte(ch_moins,-1,-1,item);
					}
				break;
					
				case 1 :
					write_data(num_data,start_trs,1,1);
				break;
				
				case 2:

					if(z == 1)
					{
						write_data(num_data,start_trs,2,1);
					}
					else
					{
						write_data(num_data,start_trs,2,2);
					}
				break;
			}
			pkt_end();
			
		// CRC16
			val_CRC = tab_packet_data[num_data-2];
			val_CRC = val_CRC*Math.pow(2,8) + tab_packet_data[num_data-3];
			CRC5 = false;
			crc_ok = CRC_Calcul(num_data-3);
			if(tab_indice[z]-1 > num_data-4 && number_stuffing != 0)
			{
				dec_item_new(ch_moins, start_trs.sample + spb*(15+8*(num_data-3)) , start_trs.sample + spb *(16+8*(num_data-1)));
				dec_item_add_pre_text("CRC : "+int_to_str_hex(val_CRC)+" "+crc_ok);
				dec_item_add_pre_text("CRC");
				pkt_add_item(start_trs.sample+spb*(15+8*(num_data-3)),start_trs.sample+spb*(16+8*(num_data-1)),"CRC16 : "+crc_ok , int_to_str_hex(val_CRC),dark_colors.blue,light_colors.blue,1);
				//hex_add_byte(ch_moins,-1,-1,val_CRC);
			}
			else
			{
				dec_item_new(ch_moins, start_trs.sample + spb*(16+8*(num_data-3)) , start_trs.sample + spb *(16+8*(num_data-1)));
				dec_item_add_pre_text("CRC : "+int_to_str_hex(val_CRC)+" "+crc_ok);
				dec_item_add_pre_text("CRC");
				pkt_add_item(start_trs.sample+spb*(16+8*(num_data-3)),start_trs.sample+spb*(16+8*(num_data-1)),"CRC16 : "+crc_ok , int_to_str_hex(val_CRC),dark_colors.blue,light_colors.blue,1);
				//hex_add_byte(ch_moins,-1,-1,final_data);
			}	
			
		//eop
			dec_item_new(ch_moins, start_trs.sample + spb*(16+(num_data-1)*8) , start_trs.sample + spb*(19+(num_data-1)*8));
			pkt_add_item(start_trs.sample+spb*(16+(num_data-1)*8) , start_trs.sample + spb*(19+(num_data-1)*8),"EOP" , "",dark_colors.black,light_colors.white,1);
			dec_item_add_pre_text("EOP ");
			pkt_end();

		break;
		
		case 4 : //sof
			acqui_data(11);
			for(d=0;d<11;d++)
			{
				tab_data_crc[d] = tab_data_crc_prov[d];
			}
			if(test_stuffing == true)
			{	
				number_stuffing++;
				test_stuffing = false;
				start_trs = trs_go_after(ch_moins,start_trs.sample);	
			}
			dec_item_new(ch_moins, start_trs.sample + spb*(16-number_stuffing) , start_trs.sample + spb *(27+number_stuffing));
			dec_item_add_pre_text("FRAME : "+int_to_str_hex(final_data));
			dec_item_add_pre_text("FRAME");
			pkt_add_item(start_trs.sample+spb*(16-number_stuffing) , start_trs.sample + spb*(27+number_stuffing),"FRAME" , "",light_colors.orange,light_colors.gray,1);
			hex_add_byte(ch_moins,-1,-1,final_data);
			CRC5 = true;
		break;
	}
}

/*This function allows to write the data, considering the stuffing  bit(s) and if 
there are two stuffing bits in one byte. 
*/
function write_data(num_data,start_trs,number_stuffing,z)
{
	var d;
	for(d=0;d<(num_data-3);d++)
	{	
		item = tab_packet_data[d];
		item_hex = int_to_str_hex(item);

		if(d == tab_indice[1]-1)
		{
			dec_item_new(ch_moins, start_trs.sample + (16-number_stuffing)*spb + d*spb*8 , start_trs.sample + spb*(25-z) + d*spb*8);
			dec_item_add_pre_text("data : "+item_hex);
			dec_item_add_pre_text("data");
			if(item>32 && item<127)
			{
				item_ascii = hex_to_ascii(item_hex);
				pkt_add_item(start_trs.sample+(16-number_stuffing)*spb+d*spb*8,start_trs.sample+spb*(25-z)+d*spb*8,"data : "+d ,item_hex+" ("+item_ascii+")" ,light_colors.blue,light_colors.gray,1);
			}
			else
			{
				pkt_add_item(start_trs.sample+(16-number_stuffing)*spb+d*spb*8,start_trs.sample+spb*(25-z)+d*spb*8,"data : "+d , item_hex,light_colors.blue,light_colors.gray,1);
			}
			hex_add_byte(ch_moins,-1,-1,item);
		}
		else if(d>=tab_indice[1]-1)
		{
			dec_item_new(ch_moins, start_trs.sample + (16-z+1)*spb + d*spb*8 , start_trs.sample + spb*(24-z+1) + d*spb*8);
			dec_item_add_pre_text("data : "+item_hex);
			dec_item_add_pre_text("data");
			if(item>32 && item<127)
			{
				item_ascii = hex_to_ascii(item_hex);
				pkt_add_item(start_trs.sample+(16-z+1)*spb+d*spb*8,start_trs.sample+spb*(24-z+1)+d*spb*8,"data : "+d , item_hex+" ("+item_ascii+")",light_colors.blue,light_colors.gray,1);
			}
			else
			{
				pkt_add_item(start_trs.sample+(16-z+1)*spb+d*spb*8,start_trs.sample+spb*(24-z+1)+d*spb*8,"data : "+d , item_hex,light_colors.blue,light_colors.gray,1);
			}
			hex_add_byte(ch_moins,-1,-1,item);
		}
		else
		{
			dec_item_new(ch_moins, start_trs.sample + (16-number_stuffing)*spb + d*spb*8 , start_trs.sample + spb*(24-number_stuffing) + d*spb*8);
			dec_item_add_pre_text("data : "+item_hex);
			dec_item_add_pre_text("data");
			if(item>32 && item<127)
			{
				item_ascii = hex_to_ascii(item_hex);
				pkt_add_item(start_trs.sample+(16-number_stuffing)*spb+d*spb*8,start_trs.sample+spb*(24-number_stuffing)+d*spb*8,"data : "+d ,item_hex+" ("+item_ascii+")",light_colors.blue,light_colors.gray,1);
			}
			else
			{
				pkt_add_item(start_trs.sample+(16-number_stuffing)*spb+d*spb*8,start_trs.sample+spb*(24-number_stuffing)+d*spb*8,"data : "+d , item_hex,light_colors.blue,light_colors.gray,1);
			}
			hex_add_byte(ch_moins,-1,-1,item);
		}
	}
}

/*This function calculates the CRC considering the transmitted data and compares it 
with the actual CRC value. It returns true or false depending on the result of this 
comparison. 
*/ 
function CRC_Calcul(number_bytes)
{
 	var val_CRC_calcul=CRC_Calcul2(number_bytes);
	if(val_CRC_calcul == val_CRC){
		verif = true;
	}else
	{
		verif = false;
	}
	return verif;	
}

/* This second function CRC_Calcul is separated from the first one because only this
one is used for the demo part. 
*/
function CRC_Calcul2(number_bytes)
{
	var poly_data = new Array(1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1);
	var poly_token = new Array(1,0,0,1,0,1);
	var verif = false;
	var len,j;
	var nav_crc = 0;
	var remainder = false;
	var end = false;
	var crc_type;
	var val_CRC_calcul = 0;
	
	if(CRC5)
	{
		crc_type = 5;
		len = 11;
	}
	else
	{	crc_type = 16;
		len = 8*number_bytes;
	}
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
					if(CRC5)
					{
						tab_data_crc[nav_crc+j] ^= poly_token[j];
					}
					else
					{
						tab_data_crc[nav_crc+j] ^= poly_data[j];
					}
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
			val_CRC_calcul |= tab_data_crc[len+j]<<j;
		}
	}	
	else
	{
		val_CRC_calcul = 0;	
	}	
	return val_CRC_calcul;
}

/* This function allows to detect when there is an end of packet (eop). For the low
speed, on the channel D+(respectively D- for the full speed), we check if there are
three bits at 0 and on the channel D-(respectively D- for the full speed), we check 
if tere are two bits at 0 ans one bit at 1.
*/
function detection_eop(start_trs,num)
{
	var d=0;
	
	switch(after_pid)
	{
		case 1 : //token packet : the 3 bits of EOP come after 32 bits of (SYNC+PID+ADDR+ENDP+CRC5)
			bit_eop1 = sample_val(ch_plus, start_trs.sample + (32.5+number_stuffing)*spb);
			bit=bit_sampler_next(ch_moins);
			if(bit==0 && bit_eop1==0)
			{
				bit_eop2=sample_val(ch_plus, start_trs.sample + (33.5+number_stuffing)*spb);
				bit=bit_sampler_next(ch_moins);

				if(bit==0 && bit_eop2==0)
				{
					bit_eop3=sample_val(ch_plus, start_trs.sample + (34.5+number_stuffing)*spb);
					bit=bit_sampler_next(ch_moins);
					if(bit==1 && bit_eop3==0)
					{
						dec_item_new(ch_moins, start_trs.sample + spb*(32+number_stuffing) , start_trs.sample + spb*(35+number_stuffing));
						dec_item_add_pre_text("EOP ");
						pkt_add_item(start_trs.sample + spb*(32+number_stuffing) , start_trs.sample + spb*(35+number_stuffing),"EOP","",dark_colors.black,light_colors.white,1);
						pkt_end();
						current_state=State_packet.SYNC;
					}
				}
			}
		break;
		
		case 2 : //data packet : the 3 bits of EOP come after 16 bits of (SYNC+PID) and 8*number of data bytes (CRC16 included)
			bit_eop1=sample_val(ch_plus, start_trs.sample + 16.5*spb + 8*num*spb);
			bit1=sample_val(ch_moins, start_trs.sample + 16.5*spb + 8*num*spb);
			if(bit1==0 && bit_eop1==0)
			{
				bit_eop2=sample_val(ch_plus, start_trs.sample + 17.5*spb + 8*num*spb);
				bit2=sample_val(ch_moins, start_trs.sample + 17.5*spb + 8*num*spb);//bit_sampler_next(ch_moins);
				if(bit2==0 && bit_eop2==0)
				{
					bit_eop3=sample_val(ch_plus, start_trs.sample + 18.5*spb + 8*num*spb);
					bit3=sample_val(ch_moins, start_trs.sample + 18.5*spb + 8*num*spb);//bit_sampler_next(ch_moins);
					if(bit3==1 && bit_eop3==0)
					{
						eop=true;
					}
				}
			}					
		break;
		
		case 3 : //handshake packet : the 3 bits of EOP come after 16 bits of (SYNC+PID)
			bit_eop1=sample_val(ch_plus, start_trs.sample + 16.5*spb);
			bit=bit_sampler_next(ch_moins);
			if(bit==0 && bit_eop1==0)
			{
				bit_eop2=sample_val(ch_plus, start_trs.sample + 17.5*spb);
				bit=bit_sampler_next(ch_moins);
				
				if(bit==0 && bit_eop2==0)
				{
					bit_eop3=sample_val(ch_plus, start_trs.sample + 18.5*spb);
					bit=bit_sampler_next(ch_moins);
					
					if(bit==1 && bit_eop3==0)
					{
						dec_item_new(ch_moins, start_trs.sample + spb*16 , start_trs.sample + spb*19);
						dec_item_add_pre_text("EOP ");
						pkt_add_item(start_trs.sample + spb*16 , start_trs.sample + spb*19,"EOP"," ",dark_colors.black,light_colors.white,1);
						pkt_end();
						current_state=State_packet.SYNC;
					}
				}
			}
		break;
	}
}

/*This function allows to determinate the speed (low or full).
*/
function verify_speed()
{
	var trs_now = trs_get_first(ch_moins);
	var trs_prev = transition(0,0);
	var min_dt = 0x7FFFFFFF;
	if (trs_is_not_last(ch_moins)) trs_get_next(ch_moins) //skip first transition
	var i;
	trs_prev = trs_now
	
	for (i = 0; i < 250; i++) //search for the smallest pulse time (sync pulses)
	{
		if (trs_is_not_last(ch_moins))
		{
			trs_now = trs_get_next(ch_moins);
			if ((trs_now.sample - trs_prev.sample) < min_dt)
			{
				min_dt = (trs_now.sample - trs_prev.sample);
			}
			trs_prev = trs_now;
		}
	}
	return min_dt;
}

/*
*************************************************************************************
							     DEMO BUILDER
*************************************************************************************
*/

/* 	This function creates a demonstration with each PID represented. It sends data of
different sizes.
 	It also generates the CRC depending on the previous data.
*/

function build_demo_signals()
{
	var d=0;
	var f=0;
	var state=packet.TOKEN;
	var word="Ikalogic ";
	init_usb_generator();

	while (get_samples_acc(ch_moins) < n_samples)
	{
		for(f=0;f<3;f++)
		{
			delay(10);
			add_data(8,0x80);
			if(inc1==9)inc1=0;
			if(token==4) token = 0;
			if(handshake==3) handshake=0;
			if(data==2) data=0;
			
			switch(state)
			{
				case packet.TOKEN	:
					CRC5=true;
					choose_pid_token();
					e=0;
					add_data(7,0x04);
					e++;
					add_data(4,0x01);
					var result_crc=CRC_Calcul2(0);
					add_data(5,result_crc);
					token++;
					state=packet.DATA;
				break;
				
				case packet.DATA :
					e=0;
					CRC5=false;
					choose_pid_data();
					for(d=0;d<inc1;d++)
					{
						add_data(8,word.charCodeAt(d));
						e++;
					}
					add_data(16,CRC_Calcul2(inc1));
					data++;
					inc1++;
					state=packet.HANDSHAKE;
				break;
				
				case packet.HANDSHAKE :
					choose_pid_handshake();
					handshake++;
					state=packet.TOKEN;
				break;
			}
			add_eop();
		}
	}
}

/* This function allows to generate a data of the chosen size. 
*/
function add_data(length_data,data)
{
	var inv_data=0;
	var tab_init_data=new Array();
	var d;

	for(d=0;d<length_data;d++)
	{
		tab_init_data[d] = ((data>>d) & 0x01);
		if(CRC5)
		{
			tab_data_crc[d+(7)*e] = ((data>>(d)) & 0x01);
		}
		else tab_data_crc[d+(length_data)*e] = ((data>>(d)) & 0x01);
	}
	for(d=0;d<length_data;d++)
	{
		if(tab_init_data[d]==1)
		{
			if(err_acc>=1/srate)
			{
				err_acc-=1/(srate);
				add_samples(ch_moins,last_bit,Math.ceil(sample_per_bit));
				add_samples(ch_plus,1-last_bit,Math.ceil(sample_per_bit));
			}
			else
			{
			add_samples(ch_moins,last_bit,sample_per_bit);
			add_samples(ch_plus,1-last_bit,sample_per_bit);
			}
			err_acc+=epb;
		}
		else
		{
			if(err_acc>=1/srate)
			{
				err_acc-=1/(srate);
				add_samples(ch_moins,1-last_bit,Math.ceil(sample_per_bit));
				add_samples(ch_plus,last_bit,Math.ceil(sample_per_bit));
				last_bit=1-last_bit;
			}
			else
			{
			add_samples(ch_moins,1-last_bit,sample_per_bit);
			add_samples(ch_plus,last_bit,sample_per_bit);
			last_bit=1-last_bit;
			}
			err_acc+=epb;	
		}
	}	
}

/* This function will give one of the four token pid.
*/
function choose_pid_token()
{
	switch (token)
	{
		case 0 : add_data(8,PID_table.IN); break;
		case 1 : add_data(8,PID_table.OUT); break;
		case 2 : add_data(8,PID_table.SOF); break;
		case 3 : add_data(8,PID_table.SETUP); break;
	}
}

/* This function will give one of the two data pid.
*/
function choose_pid_data()
{
	switch (data)
	{
		case 0 : add_data(8,PID_table.DATA0); break;
		case 1 : add_data(8,PID_table.DATA1); break;
		
	}
}

/* This function will give one of the three handshake pid.
*/
function choose_pid_handshake()
{
	switch (handshake)
	{
		case 0 : add_data(8,PID_table.ACK); break;
		case 1 : add_data(8,PID_table.NAK); break; 
		case 2 : add_data(8,PID_table.STALL); break;
		
	}
}

/* This function will generate the eop.
*/		
function add_eop()
{
	if(err_acc>=1/srate)
	{
		err_acc-=1/(srate);
		add_samples(ch_moins,0,Math.ceil(sample_per_bit));
		add_samples(ch_plus,0,Math.ceil(sample_per_bit));
	}
	else
	{
		add_samples(ch_moins,0,sample_per_bit);
		add_samples(ch_plus,0,sample_per_bit);	
	}
	err_acc+=epb;
	if(err_acc>=1/srate)
	{
		err_acc-=1/(srate);
		add_samples(ch_moins,0,Math.ceil(sample_per_bit));
		add_samples(ch_plus,0,Math.ceil(sample_per_bit));
	}
	else
	{
		add_samples(ch_moins,0,sample_per_bit);
		add_samples(ch_plus,0,sample_per_bit);	
	}
	err_acc+=epb;
	if(err_acc>=1/srate)
	{
		err_acc-=1/(srate);
		add_samples(ch_moins,1,Math.ceil(sample_per_bit));
		add_samples(ch_plus,0,Math.ceil(sample_per_bit));
	}
	else
	{
		add_samples(ch_moins,1,sample_per_bit);
		add_samples(ch_plus,0,sample_per_bit);
	}
	err_acc+=epb;
	last_bit=1;
}

/* This function will create a delay of the decided number of bits.
*/
function delay (n_bits)
{
    for (var i = 0; i < n_bits; i++)
    {
        add_samples(ch_moins, 1, sample_per_bit);
		add_samples(ch_plus,0,sample_per_bit);
    }
}

/* This function initiates the variables and must be called at the beginning of the 
demonstration.
*/
function init_usb_generator()
{
	var Channel;
	if(speed == 0)
	{
		BAUD = 12000000;		
		channel = ch_plus;
		ch_plus = ch_moins;
		ch_moins = channel;
	}
	else if (speed == 1) //inversion of the channels for full speed
	{
		BAUD = 1500000;
	}
	else if (speed==2){	//in case of "auto detect" for the USB bit-rate, low speed is automatically selected
		BAUD =1500000;
	}
	srate=get_srate();
	sample_per_bit=srate/BAUD;
	epb=(sample_per_bit-Math.floor(sample_per_bit))/srate;
	add_samples(ch_moins,1,sample_per_bit*10);
	add_samples(ch_plus,0,sample_per_bit*10);
}

/*
*************************************************************************************
							       TRIGGER
*************************************************************************************
*/

/* Graphical user interface for the trigger configuration.
For the moment, the trigger was only tested on low speed. 
*/
function trig_gui()
{
	trig_ui_clear();
	
	trig_ui_add_alternative("ALT_SYNC_FRAME", "Trigger on a SYNC frame", true);
		trig_ui_add_label("lab0", "Trigger on any SYNC Frame. In other words, this alternative will trigger on any SYNC byte");
	
 	trig_ui_add_alternative("ALT_PID","Trigger on PID value",false);
		trig_ui_add_label("lab1", "Choose PID field . This alternative will trigger on the chosen PID field");
		trig_ui_add_combo("chosen_pid","PID : ");
			trig_ui_add_item_to_combo("OUT",true);
			trig_ui_add_item_to_combo("IN");
			trig_ui_add_item_to_combo("SOF");
			trig_ui_add_item_to_combo("SETUP");
			trig_ui_add_item_to_combo("DATA0");
			trig_ui_add_item_to_combo("DATA1");
			trig_ui_add_item_to_combo("ACK");
			trig_ui_add_item_to_combo("NAK");
			trig_ui_add_item_to_combo("STALL");
				
	//for this third alternative, I did not test it. I am not sure if it actually works.
	trig_ui_add_alternative("ALT_SPECIFIC_PHRASE","Trigger on a character string",false);
		trig_ui_add_label("lab2", "This alternative allows to trigger on the character(s) you write below. E.g.: Hello World");
		trig_ui_add_free_text("trig_phrase", "Trigger phrase: ");
		trig_ui_add_label("lab3", "Choose if you want a data from a DATA0 or DATA1 packet.");
		trig_ui_add_combo("data_pid","PID : ");
			trig_ui_add_item_to_combo("DATA0",true);
			trig_ui_add_item_to_combo("DATA1");
}

/* 
*/
function trig_seq_gen()
{
	flexitrig_clear();
	flexitrig_set_async_mode(true);
	get_ui_vals();

	BAUD =1500000;	//low speed. To work in full speed, BAUD must be equal to 12000000.
	srate=get_srate();
	sample_per_bit=srate/BAUD;
	bit_time = 1/BAUD;	// [s]
	bt_max = bit_time * 1.1;	// Allow 10% margin on bit time <-- this may be configurable later.
	bt_min = bit_time * 0.9;

	if (ALT_SYNC_FRAME == true)
	{
		build_sync_byte();
		flexitrig_set_summary_text("Trigger on SYNC BYTE");
	}	
	else if(ALT_PID == true)
	{
		build_sync_byte();
		build_pib_byte();
		flexitrig_set_summary_text("Trigger on PID BYTE");
	}
	else if(ALT_SPECIFIC_PHRASE==true)
	{
		build_sync_byte();
		if(data_pid==0)	//data0
		{
			build_hex_byte(0xC3,8);
		}
		else	//data1
		{
			build_hex_byte(0x4B,8);
		}
		
		for(var d=0;d<trig_phrase.length;d++)
		{
			build_hex_byte(trig_phrase.charCodeAt(d),8);
			
			for(var g=0;g<nb_trs;g++)
			{
				flexitrig_append(trig_build_step(tab_pid[g]),bt_min*(tab_nb_bit[g]),bt_max*(tab_nb_bit[g]));
			}
		}
		flexitrig_set_summary_text("Trigger on data ");
	}
}

/* This function recognizes the SYNC byte (0x80). 
*/
function build_sync_byte()
{
	flexitrig_append(trig_build_step("F"),-1,-1);
	flexitrig_append(trig_build_step("R"),bt_min,bt_max);
	flexitrig_append(trig_build_step("F"),bt_min,bt_max);
	flexitrig_append(trig_build_step("R"),bt_min,bt_max);
	flexitrig_append(trig_build_step("F"),bt_min,bt_max);
	flexitrig_append(trig_build_step("R"),bt_min,bt_max);
	flexitrig_append(trig_build_step("F"),bt_min,bt_max);
}

/* This function puts the trigger on the selected PID. 
*/
function build_pib_byte()
{
	switch(chosen_pid)
	{
		case 0 : //out
			build_hex_byte(0xE1,8);
		break;
		
		case 1 : //in
			build_hex_byte(0x69,8);
		break;
		
		case 2 : //sof
			build_hex_byte(0xA5,8);
		break;
		
		case 3 : //setup
			build_hex_byte(0x2D,8);
		break;
		
		case 4 : //data0
			build_hex_byte(0xC3,8);
		break;
		
		case 5 : //data1
			build_hex_byte(0x4B,8);
		break;
		
		case 6 : //ack
			build_hex_byte(0xD2,8);
		break;
		
		case 7 : //nak
			build_hex_byte(0x5A,8);
		break;
		
		case 8 : //stall
			build_hex_byte(0x1E,8);
		break;		
	}
	for(var d=0;d<nb_trs;d++)
	{
		flexitrig_append(trig_build_step(tab_pid[d]),bt_min*(tab_nb_bit[d]),bt_max*(tab_nb_bit[d]));
	}
}

/* This function completes an array in order to put the trigger on the selected data. 
The data is encoded in NRZI codage, then the array is completed with 'R' or 'F' 
depending on the bit value. 
*/
function build_hex_byte(hex_byte,length_data)
{
	var tab_init_data=new Array();
	var tab_init_data2=new Array();
	var d;
	var acc=1;
	
	for(d=0;d<length_data;d++)
	{
		tab_init_data[d] = ((hex_byte>>d) & 0x01);
	}
	
	for(d=0;d<length_data;d++)
	{
		if(tab_init_data[d]==1)
		{	
			tab_init_data2[d]=prev_bit;
		}
		else
		{
			tab_init_data2[d]=1-prev_bit;
			
		}
		prev_bit=tab_init_data2[d];
	}

	if(tab_init_data2[0]!=0)
	{
		if(tab_init_data2[0]==1)
		{
			tab_pid[0]="R";
		}
		else
		{
			tab_pid[0]="F";
		}
		tab_nb_bit[nb_trs]=1;
		nb_trs++;
	}
	else 
	{
		acc++;
	}
	for(d=1;d<length_data;d++)
	{
		if(tab_init_data2[d]!=tab_init_data2[d-1])
		{
			if(tab_init_data2[d]==1)
			{
				tab_pid[nb_trs]="R";
			}
			else
			{
				tab_pid[nb_trs]="F";
			}
			
			tab_nb_bit[nb_trs]=1+acc;
			nb_trs++;
			acc=0;
		}
		else acc++;
	}
}

/* This function describes the state of the channel ch_moins ('R', 'F', '0' or '1') 
and puts the other channels to 'X'.
*/
function trig_build_step(step_moins)
{
	var step="";
	for(var d=0;d<get_device_max_channels();d++)
	{
		if(d==ch_moins)
		{
			step=step_moins+step;
		}
		else
		{
			step="X"+step;
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
function get_srate()
{
	if (typeof get_sample_rate === "function")
	{
		return get_sample_rate();
	}
	else
	{
		return sample_rate;
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
function hex_to_ascii(hexx)
{
	var hex = hexx.toString();
	var str = "";
	
	for(var i = 0; i<hex.length; i +=2)
		str += String.fromCharCode(parseInt(hex.substr(i,2),16));
		
	return str;
}





