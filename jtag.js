/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	JTAG Protcol Decoder

</DESCRIPTION>

<RELEASE_NOTES>

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
	return "JTAG";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.01";
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
	ui_add_ch_selector( "ch_tms", "TMS", "TMS" );
	ui_add_ch_selector( "ch_tck", "TCK", "TCK" );
	ui_add_ch_selector( "ch_tdi", "TDI", "TDI" );
	ui_add_ch_selector( "ch_tdo", "TDO", "TDO" );
	ui_add_txt_combo( "order_DR", "Shift-DR bits order" );
		ui_add_item_to_txt_combo( "LSB first", true );
		ui_add_item_to_txt_combo( "MSB first" );
	ui_add_txt_combo( "order_IR", "Shift-IR bits order" );
		ui_add_item_to_txt_combo( "LSB first", true );
		ui_add_item_to_txt_combo( "MSB first" );
	ui_add_separator();
	ui_add_info_label( "<b>Data organisation</b>" );
	ui_add_txt_combo( "length_data", "Bits per data word: " );
		ui_add_item_to_txt_combo( "8 bits", true );
		ui_add_item_to_txt_combo( "16 bits" );
		ui_add_item_to_txt_combo( "32 bits" );
}

var TAP_Controller =
{
	Test_Reset	: 0x00,
	Run_Test	: 0x01,
	DR_Scan		: 0x02,
	IR_Scan		: 0x03,
	Capture		: 0x04,
	Shift		: 0x05,
	Exit1		: 0x06,
	Pause		: 0x07,
	Exit2		: 0x08,
	Update		: 0x09
}


var TMS_Transition;
var Scan_type = 0;
var start_shift = 0;
var spb;
var tab_data_tdo = new Array;
var tab_data_tdi = new Array;
var cnt_text = 0;
var data_tdo = "";
var data_tdi = "";
var data_hex_do = 0;
var data_hex_di = 0;
var length_hex;
var tab_data_do_hex = new Array;
var tab_data_di_hex = new Array;
var start_pkt_data;
var end_pkt_data;

var PKT_COLOR_DATA;
var PKT_COLOR_DATA_DO_TITLE;
var PKT_COLOR_DATA_DI_TITLE;
var PKT_COLOR_TEST_RESET_TITLE;
var PKT_COLOR_RUN_TEST_TITLE;
var PKT_COLOR_DR_SCAN_TITLE;
var PKT_COLOR_IR_SCAN_TITLE;
var PKT_COLOR_CAPTURE_TITLE;
var PKT_COLOR_SHIFT_TITLE;
var PKT_COLOR_EXIT1_TITLE;
var PKT_COLOR_PAUSE_TITLE;
var PKT_COLOR_EXIT2_TITLE;
var PKT_COLOR_UPDATE;

function decode()
{
	var TAP_state = TAP_Controller.Test_Reset;
	var TCK_Transition;
	var TDO_Transition;
	var TDI_transition;
	var trs_now,trs_next,time,baud,
	var text = "TEST RESET";
	var small_text = "RESET"
	var very_small_text = "RST";	

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	get_ui_vals();                // Update the content of user interface variables
	
	if(length_data == 0)
	{
		length_data = 8;
		length_hex = 0x10;
	}
	else if(length_data == 1)
	{
		length_data = 16;
		length_hex = 0x1000;
	}
	else
	{
		length_data = 32;
		length_hex = 0x10000000;
	}
	
	PKT_COLOR_DATA = light_colors.gray;
	PKT_COLOR_DATA_DO_TITLE = light_colors.green;
	PKT_COLOR_DATA_DI_TITLE = light_colors.orange;
	PKT_COLOR_TEST_RESET_TITLE = dark_colors.red;
	PKT_COLOR_RUN_TEST_TITLE = dark_colors.blue;
	PKT_COLOR_DR_SCAN_TITLE = dark_colors.green;
	PKT_COLOR_IR_SCAN_TITLE = dark_colors.orange;
	PKT_COLOR_CAPTURE_TITLE = dark_colors.gray;
	PKT_COLOR_SHIFT_TITLE = dark_colors.violet;
	PKT_COLOR_EXIT1_TITLE = dark_colors.brown;
	PKT_COLOR_PAUSE_TITLE = dark_colors.pink;
	PKT_COLOR_EXIT2_TITLE = dark_colors.yellow;
	PKT_COLOR_UPDATE = dark_colors.black;
	
	TCK_Transition = trs_get_first(ch_tck);
	TCK_Transition = trs_get_next(ch_tck);	
	TMS_Transition = trs_go_before(ch_tms,TCK_Transition.sample);
	
	trs_now = TCK_Transition.sample;
	TCK_Transition = trs_get_next(ch_tck);
	trs_next = TCK_Transition.sample;
	TCK_Transition = trs_get_prev(ch_tck);
	TCK_Transition = trs_get_prev(ch_tck);
	
	time = ((trs_next - trs_now)/sample_rate);
	baud = 1/time;
	spb = sample_rate/baud;
	
	pkt_start("JTAG");	
		
	trs_now = TCK_Transition.sample;
		
	while(trs_is_not_last(ch_tck))
	{
		if (abort_requested() == true)
		{
			return false;
		}

		if(TAP_state != TAP_Controller.Shift)
		{
			TCK_Transition = trs_get_next(ch_tck);

			if((TCK_Transition.sample-trs_now)>(spb*2))
				trs_now = TCK_Transition.sample;

			TCK_Transition = trs_get_next(ch_tck);
			trs_next = TCK_Transition.sample+spb;		
	
			TMS_Transition = trs_go_before(ch_tms,TCK_Transition.sample);
		}

		switch (TAP_state)
		{
			case TAP_Controller.Test_Reset:
				pkt_end();
				pkt_start("JTAG");
				
				if(TMS_Transition.val == 0)
				{
					pkt_add_item(-1,-1,"TEST RESET","",PKT_COLOR_TEST_RESET_TITLE ,PKT_COLOR_DATA ,true);
					TAP_state = TAP_Controller.Run_Test;
					text = "RUN TEST IDLE";
					small_text = "RUN TEST";
					very_small_text = "RUN";
				}	
			break;
			
			case TAP_Controller.Run_Test:
				pkt_end();
				pkt_start("JTAG");
				
				if(TMS_Transition.val == 1)
				{
					pkt_add_item(-1,-1,"RUN TEST","",PKT_COLOR_RUN_TEST_TITLE ,PKT_COLOR_DATA ,true);
					TAP_state = TAP_Controller.DR_Scan;
					text = "SELECT DR";
					small_text = "SCAN DR"
					very_small_text = "DR";
				}
			break;
			
			case TAP_Controller.DR_Scan:
				pkt_add_item(-1,-1,"DR SCAN","",PKT_COLOR_DR_SCAN_TITLE ,PKT_COLOR_DATA ,true);
				Scan_type = TAP_Controller.DR_Scan;

				if(TMS_Transition.val == 1)
				{
					TAP_state = TAP_Controller.IR_Scan;
					text = "SELECT IR";
					small_text = "SCAN IR"
					very_small_text = "IR";
				}
				else
				{
					TAP_state = TAP_Controller.Capture;
					text = "CAPTURE IR/DR";
					small_text = "CAPTURE";
					very_small_text = "CAPT";
				}	
			break;
			
			case TAP_Controller.IR_Scan:
				pkt_add_item(-1,-1,"IR SCAN","",PKT_COLOR_IR_SCAN_TITLE ,PKT_COLOR_DATA ,true);
				Scan_type = TAP_Controller.IR_Scan;

				if(TMS_Transition.val == 1)
				{
					TAP_state = TAP_Controller.Test_Reset;
					text = "TEST RESET";
					small_text = "RESET";
					very_small_text = "RST";
				}
				else
				{
					TAP_state = TAP_Controller.Capture;
					text = "CAPTURE IR/DR";
					small_text = "CAPTURE";
					very_small_text = "CAPT";
				}
			break;
			
			case TAP_Controller.Capture:
				pkt_add_item(-1,-1,"CAPTURE","",PKT_COLOR_CAPTURE_TITLE,PKT_COLOR_DATA ,true);

				if(TMS_Transition.val == 1)
				{
					TAP_state = TAP_Controller.Exit1;
					text = "EXIT1 IR/DR";
					small_text = "EXIT1";
					very_small_text = "EXT1";
					
				}
				else
				{
					TAP_state = TAP_Controller.Shift;
					text = "SHIFT IR/DR";
					small_text = "SHIFT";
					very_small_text = "SHF";
				}
			break;
			
			case TAP_Controller.Shift:
				pkt_add_item(-1,-1,"SHIFT","",PKT_COLOR_SHIFT_TITLE ,PKT_COLOR_DATA ,true);

				Decode_Data();
				TCK_Transition = trs_go_after(ch_tck,TMS_Transition.sample);
				trs_now = TCK_Transition.sample;
				TCK_Transition = trs_get_next(ch_tck);
				trs_next = TCK_Transition.sample+spb;
				TAP_state = TAP_Controller.Exit1;
				text = "EXIT1 IR/DR";
				small_text = "EXIT1";
				very_small_text = "EXT1";
			break;
			
			case TAP_Controller.Exit1:
				pkt_add_item(-1,-1,"EXIT 1","",PKT_COLOR_EXIT1_TITLE ,PKT_COLOR_DATA ,true);

				if(TMS_Transition.val == 1)
				{
					TAP_state = TAP_Controller.Update;
					text = "UPDATE IR/DR";
					small_text = "UPDATE";
					very_small_text = "UD";
				}
				else
				{
					TAP_state = TAP_Controller.Pause;
					text = "PAUSE IR/DR";
					small_text = "PAUSE";
					very_small_text = "P";
				}
			break;
			
			case TAP_Controller.Pause:
				pkt_add_item(-1,-1,"PAUSE","",PKT_COLOR_PAUSE_TITLE ,PKT_COLOR_DATA ,true);

				if(TMS_Transition.val == 1)
				{
					TAP_state = TAP_Controller.Exit2;
					text = "EXIT2 IR/DR";
					small_text = "EXIT2";
					very_small_text = "EXT2";
				}
			break;
			
			case TAP_Controller.Exit2:
				pkt_add_item(-1,-1,"EXIT 2","",PKT_COLOR_EXIT2_TITLE ,PKT_COLOR_DATA ,true);

				if(TMS_Transition.val == 1)
				{
					TAP_state = TAP_Controller.Update;
					text = "UPDATE IR/DR";
					small_text = "UPDATE";
					very_small_text = "UD";
				}
				else
				{
					TAP_state = TAP_Controller.Shift;
					text = "SHIFT IR/DR";
					small_text = "SHIFT";
					very_small_text = "SHF";
				}
			break;
			
			case TAP_Controller.Update:
				pkt_add_item(-1,-1,"UPDATE","",PKT_COLOR_UPDATE ,PKT_COLOR_DATA ,true);

				if(TMS_Transition.val == 1)
				{
					TAP_state = TAP_Controller.DR_Scan;
					text = "SELECT DR";
					small_text = "SCAN DR"
					very_small_text = "DR";
				}
				else
				{
					TAP_state = TAP_Controller.Run_Test;
					text = "RUN TEST IDLE";
					small_text = "RUN TEST";
					very_small_text = "RUN";
				}
			break;
		}
		
		if(trs_is_not_last(ch_tck) && ((trs_next-trs_now)<(spb*4)))
		{	
			if(TAP_state == TAP_Controller.Shift)
				start_shift = trs_now;
			dec_item_new(ch_tms,trs_now,trs_next);
			dec_item_add_pre_text(text);
			dec_item_add_pre_text(small_text);
			dec_item_add_pre_text(very_small_text);
		}
		trs_now = trs_next;
		
		set_progress(100 * trs_now / n_samples);
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

function Decode_Data()
{
	var first_data = true;
	var sample_data_start = 0;
	var sample_data_end = 0;
	var tmp_sample = trs_go_after(ch_tck,start_shift);
	var nav = trs_go_after(ch_tck,start_shift+(3*(spb/2)));
	var data_recovery = true;
	var cnt = 0;
	
	var end_item = 0;
	
	cnt_text = 0;
	TMS_Transition = trs_go_before(ch_tms,nav.sample);
	sample_data_start = tmp_sample.sample;
	start_pkt_data = tmp_sample.sample;
	
	while(data_recovery == true)
	{
	    if (abort_requested() == true)
		{
			return false;
		}

		if(TMS_Transition.val == 0)
		{
			TDO_Transition = trs_go_before(ch_tdo,nav.sample);
			TDI_transition = trs_go_before(ch_tdi,nav.sample);
			
			tab_data_tdo[cnt] = TDO_Transition.val;
			tab_data_tdi[cnt] = TDI_transition.val;
			
			if(first_data == true)
			{
				if(TDO_Transition.sample == 0)
				{
					tab_data_tdo[cnt] = 1;
					TDO_Transition.val = 1;
				}
				if(TDI_transition.sample == 0)
				{
					tab_data_tdi[cnt] = 1;
					TDI_transition.val = 1;
				}
					
				first_data = false;
			}
			
	/*		if(TDO_Transition.val == 0)
				dec_item_add_sample_point(ch_tdo,nav.sample,0);
			else
				dec_item_add_sample_point(ch_tdo,nav.sample,1);
				
			if(TDI_transition.val == 0)
				dec_item_add_sample_point(ch_tdi,nav.sample+(spb/2),0);	
			else
				dec_item_add_sample_point(ch_tdi,nav.sample+(spb/2),1);*/
		
			cnt++;
			
			if(cnt%length_data == 0)
			{
				Text_data();
				tmp_sample = trs_go_after(ch_tck,nav.sample);
				nav = trs_go_before(ch_tck,nav.sample);
				sample_data_end = tmp_sample.sample;
				dec_item_new(ch_tdo,sample_data_start,sample_data_end);
				dec_item_add_pre_text("DO = 0x"+data_tdo);
				hex_add_byte(ch_tdo,-1,-1,data_hex_do);
				
				tmp_sample = trs_get_next(ch_tck);
				nav = trs_get_prev(ch_tck);
				sample_data_end = tmp_sample.sample
				dec_item_new(ch_tdi,sample_data_start+(spb/2),sample_data_end+(spb/2));
				dec_item_add_pre_text("DI = 0x"+data_tdi);
				hex_add_byte(ch_tdi,-1,-1,data_hex_di);
				
				cnt_text++;
				sample_data_start = tmp_sample.sample;
			}
			
			nav = trs_get_next(ch_tck);
			nav = trs_get_next(ch_tck);
			TMS_Transition = trs_go_before(ch_tms,nav.sample);
		}
		else
		{
			if(Scan_type == TAP_Controller.DR_Scan)
			{
				TDO_Transition = trs_go_before(ch_tdo,nav.sample);
				tab_data_tdo[cnt] = TDO_Transition.val;
			/*	if(TDO_Transition.val == 0)
					dec_item_add_sample_point(ch_tdo,nav.sample-spb,0);	
				else
					dec_item_add_sample_point(ch_tdo,nav.sample-spb,1);*/
			}
		
			TDI_transition = trs_go_before(ch_tdi,nav.sample);
			tab_data_tdi[cnt] = TDI_transition.val;
		/*	if(TDI_transition.val == 0)
				dec_item_add_sample_point(ch_tdi,nav.sample+(spb/2),0);	
			else
				dec_item_add_sample_point(ch_tdi,nav.sample+(spb/2),1);*/

			data_recovery = false;
		}
	}
	
	if(Scan_type == TAP_Controller.IR_Scan)
	{
		tmp_sample = trs_get_prev(ch_tck);
		nav = trs_get_next(ch_tck);
	}
	else
	{
		nav = trs_get_prev(ch_tck);
		tmp_sample = trs_get_next(ch_tck);
	}
	
	sample_data_end = tmp_sample.sample;

	Text_data();

	if(cnt != 0)
	{
		dec_item_new(ch_tdo,sample_data_start,sample_data_end);
		dec_item_add_pre_text("DO = 0x"+data_tdo);
		dec_item_add_pre_text("0x"+data_tdo);
		hex_add_byte(ch_tdo,-1,-1,data_hex_do);
		
		tmp_sample = trs_get_next(ch_tck);
		nav = trs_get_prev(ch_tck);
		sample_data_end = tmp_sample.sample
		end_pkt_data = tmp_sample.sample;
		
		dec_item_new(ch_tdi,sample_data_start+(spb/2),sample_data_end+(spb/2));
		dec_item_add_pre_text("DI = 0x"+data_tdi);
		dec_item_add_pre_text("0x"+data_tdi);
		hex_add_byte(ch_tdi,-1,-1,data_hex_di);
	}
	else
	{
		dec_item_new(ch_tdo,sample_data_start,sample_data_end);
		dec_item_add_pre_text("DO = "+TDO_Transition.val);
		dec_item_add_pre_text(TDO_Transition.val);
		
		tmp_sample = trs_get_next(ch_tck);
		nav = trs_get_prev(ch_tck);
		sample_data_end = tmp_sample.sample;
		end_pkt_data = tmp_sample.sample+(spb/2);
		
		dec_item_new(ch_tdi,sample_data_start+(spb/2),sample_data_end+(spb/2));
		dec_item_add_pre_text("DI = "+TDI_transition.val);	
			dec_item_add_pre_text(TDI_transition.val);	
	}	
	
	pkt_data_do();	
	pkt_data_di();
		
	tab_data_tdi.length = 0;
	tab_data_tdo.length = 0;
}


/*
*/
function int_to_str_hex (num) 
{
	var temp = "";
	var test_hex = length_hex;

	if(Scan_type == TAP_Controller.DR_Scan)
	{
		while(test_hex >= 0x10)
		{
			if(num < test_hex)
				temp += "0";
				
			test_hex >>= 4;
		}		
	}
	else
	{
		if(num<0x10)
			temp += "0";
	}

	temp += num.toString(16).toUpperCase();

	return temp;
}

/*
*/
function Text_data()
{
	var i;
	var tmp_di = 0;
	var tmp_do = 0;
	var place = 0;
	var invert = false;
	
	if(Scan_type == TAP_Controller.DR_Scan)
	{
		if(order_DR == 1)
		{
			place= length_data-1;
			invert = true;
		}	
	}
	else
	{
		if(order_IR == 1)
		{
			place= length_data-1;
			invert = true;
		}
	}
	
	
	data_tdo = "";
	data_tdi = "";

	for(i=0; i<length_data; i++)
	{
		if(i<tab_data_tdo.length)
		{
			tmp_do += tab_data_tdo[i+(cnt_text*length_data)]<<place;
		}
		else
		{
			tmp_do += 0<<place;
		}
		
		if(i<tab_data_tdi.length)
		{
			tmp_di += tab_data_tdi[i+(cnt_text*length_data)]<<place;
		}
		else
		{
			tmp_di += 0<<place;
		}
		if(invert == false)
			place++;
		else
			place--;
	}
	
	data_hex_do = tmp_do;
	data_hex_di = tmp_di;

	data_tdo = int_to_str_hex(tmp_do);
	data_tdi = int_to_str_hex(tmp_di);
	
	tab_data_do_hex[cnt_text] = "0x"+data_tdo;
	tab_data_di_hex[cnt_text] = "0x"+data_tdi;
}

/*
*/
function pkt_data_do()
{	
	var data_do = "";
	var n,p,x;
	var ligne = 0;
	var data_tmp;
	
	data_do = tab_data_do_hex[0];

	pkt_add_item(start_pkt_data,end_pkt_data,"D0",data_do+"...",PKT_COLOR_DATA_DO_TITLE,PKT_COLOR_DATA,true);
	
	
	data_do = "";
	
	if (tab_data_do_hex.length % 8)
	{
		x = Math.floor(tab_data_do_hex.length/8)+1;
	}
	else
	{
		x = tab_data_do_hex.length/8;
	}
	
	for(p=0; p<x; p++)
	{
		for(n=0; n<8; n++)
		{
			if(n+ligne<(cnt_text+1))
				data_do += tab_data_do_hex[n+ligne]+" ";
		}
		
		data_do += "| ";
		
		for(n=0; n<8; n++)
		{
			if(n+ligne<(cnt_text+1))
			{
				if((tab_data_do_hex[n+ligne]>0x1F)&&(tab_data_do_hex[n+ligne] < 0x7F))
				{
					data_tmp = hex_to_ascii(tab_data_do_hex[n+ligne]);
					data_do += data_tmp;
				}
				else
				data_do +=".";
			}
			else
				data_do +=" ";
			
		}
		
		data_do += "\n\r";
		ligne += 8;
	}	
			
	pkt_start("JTAG DO");		
		pkt_add_item(start_pkt_data,end_pkt_data,"DATA DO",data_do,PKT_COLOR_DATA_DO_TITLE,PKT_COLOR_DATA,true);	
	pkt_end();
	
	tab_data_do_hex.length = 0;
}


/*
*/
function pkt_data_di()
{	
	var data_di = "";
	var n,p,x;
	var ligne = 0;
	var data_tmp;
	
	data_di = tab_data_di_hex[0];

	pkt_add_item(start_pkt_data,end_pkt_data,"D0",data_di+"...",PKT_COLOR_DATA_DI_TITLE,PKT_COLOR_DATA,true);
	
	
	data_di = "";
	
	if (tab_data_di_hex.length % 8)
	{
		x = Math.floor(tab_data_di_hex.length/8)+1;
	}
	else
	{
		x = tab_data_di_hex.length/8;
	}
	
	for(p=0; p<x; p++)
	{
		for(n=0; n<8; n++)
		{
			if(n+ligne<(cnt_text+1))
				data_di += tab_data_di_hex[n+ligne]+" ";
		}
		
		data_di += "| ";
		
		for(n=0; n<8; n++)
		{
			if(n+ligne<(cnt_text+1))
			{
				if((tab_data_di_hex[n+ligne]>0x1F)&&(tab_data_di_hex[n+ligne] < 0x7F))
				{
					data_tmp = hex_to_ascii(tab_data_di_hex[n+ligne]);
					data_di += data_tmp;
				}
				else
				data_di +=".";
			}
			else
				data_di +=" ";
			
		}
		
		data_di += "\n\r";
		ligne += 8;
	}
			
	pkt_start("JTAG DI");		
		pkt_add_item(start_pkt_data,end_pkt_data,"DATA DI",data_di,PKT_COLOR_DATA_DI_TITLE,PKT_COLOR_DATA,true);	
	pkt_end();
	
	tab_data_di_hex.length = 0;
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








