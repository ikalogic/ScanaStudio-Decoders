
/*
*************************************************************************************

							SCANASTUDIO 2 UART DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	Serial UART (Universal asynchronous receiver/transmitter) Protocol Decoder.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.36: Added definition of ASYNC mode (required by ScanaStudio V2.4).
	V1.36: Added more decoder trigger functions
	V1.35: Added decoder trigger functions
	V1.34: Increased decoders speed, specially for long captures
	V1.33: Added support for demo signals generation
	V1.32: Added channel information to the Packet View.
	V1.31: Corrected bug related to partity bit in iverted data mode.
	V1.30: Added to option to invert only data part of the signal (used for iso7816 communication).
	V1.22: Corrected a bug related to the parity bit.
	V1.20: Added Packet/Hex View support.
	V1.17: Fixed bug with inverted logic. UI improvements.
	V1.11: Added description and release notes
	V1.10: Used the "bit_sampler" function for faster decoding
	V1.00: Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>
						
*************************************************************************************
*/


/*
	UART demo builder global vars
*/
var inverted ;
var hi,lo;
var samples_per_bit;
var trig_bit_sequence = [];

/* The decoder name as it will apear to the users of this script
*/
function get_dec_name()
{
	return "UART";
}


/* The decoder version
*/
function get_dec_ver()
{
	return "1.37";
}


/* The decoder version
*/
function get_dec_auth()
{
	return "IKALOGIC";
}


/* graphical user interface
*/
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch", "Channel to decode", "UART" );
	ui_add_baud_selector( "baud", "BAUD rate", 9600 );
	ui_add_txt_combo( "nbits", "Bits per transfer" );
		ui_add_item_to_txt_combo( "5" );
		ui_add_item_to_txt_combo( "6" );
		ui_add_item_to_txt_combo( "7" );
		ui_add_item_to_txt_combo( "8", true );
		ui_add_item_to_txt_combo( "9" );
		ui_add_item_to_txt_combo( "10" );
		ui_add_item_to_txt_combo( "11" );
		ui_add_item_to_txt_combo( "12" );
		ui_add_item_to_txt_combo( "13" );
		ui_add_item_to_txt_combo( "14" );
		ui_add_item_to_txt_combo( "15" );
		ui_add_item_to_txt_combo( "16" );
	ui_add_txt_combo( "parity", "Parity bit" );
		ui_add_item_to_txt_combo( "No parity bit", true );
		ui_add_item_to_txt_combo( "Odd parity bit" );
		ui_add_item_to_txt_combo( "Even parity bit" );
	ui_add_txt_combo( "stop", "Stop bits bit" );
		ui_add_item_to_txt_combo( "1 stop bit", true );
		ui_add_item_to_txt_combo( "1.5 stop bits" );
		ui_add_item_to_txt_combo( "2 stop bits" );
	ui_add_txt_combo( "order", "Bit order" );
		ui_add_item_to_txt_combo( "LSB First", true );
		ui_add_item_to_txt_combo( "MSB First" );
	ui_add_txt_combo( "invert", "Inverted logic" );
		ui_add_item_to_txt_combo( "Non inverted logic (default)", true );
		ui_add_item_to_txt_combo( "Inverted logic: All signals inverted" );
		ui_add_item_to_txt_combo( "Inverted logic: Only data inverted" );
}



/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
    var s_pos, p_pos, b, s, val;
	var par;
	var spb; 				// samples per bit
	var m; 					// margin between blocks
	var logic1, logic0;
	var bit;

	
	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	var PKT_COLOR_DATA         = get_ch_light_color(ch);
	var PKT_COLOR_DATA_TITLE   = dark_colors.gray;
	var PKT_COLOR_START_TITLE  = dark_colors.blue;
	var PKT_COLOR_PARITY_TITLE = dark_colors.orange;
	var PKT_COLOR_STOP_TITLE   = dark_colors.green;
	get_ui_vals();
	var t = trs_get_first(ch);

	nbits += 5; 			// readjust the number of bits to start counting from 5 instead of 0.

	if (stop == 0) 			// readjust number of stop bits
	{
		stop = 1;
	}
	else if (stop == 1)
	{
		stop = 1.5;
	}
	else
	{
		stop = 2;
	}

	if (baud == 0)
	{
		return;
	}

	spb = sample_rate / baud; 		// calculate the number of Samples Per Bit.
	m = spb / 10; 					// margin = 1 tenth of a bit time (expresed in number of samples)

	if (invert == 0)
	{
		logic1 = 1;
		logic0 = 0;
	}
	else if (invert == 1)
	{
		logic1 = 0;
		logic0 = 1;
	}
	else
	{
		logic1 = 1;
		logic0 = 0;
	}

	
	while (trs_is_not_last(ch))
	{
 	
		if (abort_requested() == true)
		{
			pkt_end();
			return false;
		}
		
		if (invert == 1)							// search first falling or rising edge - this is a first start
		{
			t = get_next_rising_edge (ch, t);		
		}
		else
		{
			t = get_next_falling_edge (ch, t);		
		}
		
		if (t == false)
		{
			return;
		}
		
		//debug("t.sample(START) = " + t.sample);
		
		bit_sampler_ini(ch, spb / 2, spb);
		bit_sampler_next(ch);

		if (trs_is_not_last(ch) == false)
		{
			break;
		}
		
		pkt_start("UART (CH " + (ch+1) + ")");
		dec_item_new(ch, t.sample,t.sample + spb - m); 		// add the start bit item
		dec_item_add_pre_text("Start");	
		dec_item_add_pre_text("S");
		dec_item_add_comment("Start");

		pkt_add_item(-1, -1, "START", " ", PKT_COLOR_START_TITLE, PKT_COLOR_DATA, true);

		dec_item_new(ch, t.sample + spb + m, t.sample + (spb * (nbits + 1)) - m);
		
		if (invert > 0) //if signals are inverted (1) or data only is inverted (2)
		{
			par = 1;
		}
		else
		{
			par = 0;			
		}
		val = 0;
		var midSample = t.sample + (spb * 3 / 2);			// position our reader on the middle of first bit

		if (order == 0)
		{
			for (b = 0; b < nbits; b++)
			{
				bit = bit_sampler_next(ch);

				if (invert > 0)
				{
					bit = bit ^ 1;
				}
				
				val += Math.pow(2, b) * bit;
				par = par ^ bit;
				dec_item_add_sample_point(ch, midSample, bit ? DRAW_1 : DRAW_0);
				midSample += spb;
			}
		}
		else
		{
			for (b = 0; b < nbits; b++)
			{
				bit = bit_sampler_next(ch);

				if (invert > 0)
				{
					bit = bit ^ 1;
				}

				val = (val * 2) + bit;
				par = par ^ bit;
				dec_item_add_sample_point(ch, midSample, bit ? DRAW_1 : DRAW_0);
				midSample += spb;
			}
		}

		var asciiChar = String.fromCharCode(val);
		var strHexData = int_to_str_hex(val);

		if (val >= 0x20)
		{
			strHexData += " '" + asciiChar + "'";
		}

		dec_item_add_data(val);
		dec_item_add_comment(strHexData);

		pkt_add_item(-1, -1, "DATA", strHexData, PKT_COLOR_DATA_TITLE, PKT_COLOR_DATA, true);
		
		if (nbits <= 8)
		{
			hex_add_byte(ch, -1, -1, val);
		}
		else
		{
			hex_add_byte(ch, -1, -1, (val & 0xFF));
			hex_add_byte(ch, -1, -1, (val >> 8));
		}
		
		if (parity > 0)		// add parity bit
		{
			
			par = par ^ bit_sampler_next(ch);
			dec_item_new(ch, t.sample + (spb * (nbits + 1)) + m, t.sample + (spb * (nbits + 2)) - m);

			if (	((parity == 1 ) && (par == 1))	||	((parity == 2 ) && (par == 0))	)
			{
				dec_item_add_pre_text("Parity OK");
				dec_item_add_pre_text("Par. OK");
				dec_item_add_pre_text("p.OK");
				dec_item_add_pre_text("p");
				dec_item_add_comment("Parity OK");

				pkt_add_item(-1, -1, "PARITY", "OK", PKT_COLOR_PARITY_TITLE, PKT_COLOR_DATA, true);
			}
			else
			{
				dec_item_add_pre_text("Parity ERROR");
				dec_item_add_pre_text("Par. Err");
				dec_item_add_pre_text("Err");
				dec_item_add_pre_text("!");
				dec_item_add_comment("Parity ERROR");

				pkt_add_item(-1, -1, "PARITY", "ERROR", PKT_COLOR_PARITY_TITLE, PKT_COLOR_DATA, true);
			}

			t.sample += (spb * (nbits + 2));
		}
		else
		{
			t.sample += (spb * (nbits + 1));
		}

		dec_item_new(ch, t.sample + m, t.sample + (spb * stop) - m);	// add stop bit

		if (bit_sampler_next(ch) == logic1) 							// verify stop bit
		{
			dec_item_add_pre_text("Stop");
			dec_item_add_pre_text("P");
			dec_item_add_comment("Stop");

			pkt_add_item(-1, -1, "STOP", " ", PKT_COLOR_STOP_TITLE, PKT_COLOR_DATA, true);
		}
		else
		{
			dec_item_add_pre_text("Stop bit Missing!");
			dec_item_add_pre_text("No Stop!");
			dec_item_add_pre_text("No P!");
			dec_item_add_pre_text("P!");
			dec_item_add_comment("Stop bit Missing!");

			pkt_add_item(-1, -1, "MISSING STOP", " ", PKT_COLOR_STOP_TITLE, PKT_COLOR_DATA, true);
		}

		pkt_end();

		if (typeof(pkt_start) != "undefined") //if older ScanaStudio version
		{
			t = trs_go_after(ch,t.sample + (spb * stop * 0.5));
		}
		else	//much faster :
		{
			//get last navigator position from the bit sampler.
			t = bit_sampler_get_last_trans(ch);	
		}
		//t = trs_go_after(ch,t.sample + (spb * stop * 0.5));
		
		//debug("t.sample = " + t.sample);
		//t = trs_get_next(ch);
		/*var tmp = (t.sample + (spb * stop * 0.5));
		while(t.sample < tmp)
		{
			if (trs_is_not_last(ch))
			{
				t = trs_get_next(ch);
			}
			else
			{
				break;
			}
		}*/
		set_progress(100 * t.sample / n_samples);
	}
}

function build_demo_signals()
{
	if (invert > 0)
	{
		inverted = true;
	}
	else
	{
		inverted = false; 
	}

	if (stop == 0) 			// readjust number of stop bits
	{
		stop = 1;
	}
	else if (stop == 1)
	{
		stop = 1.5;
	}
	else
	{
		stop = 2;
	}

	ini_uart_generator();
	//generate demo signals to fill samples 0 to n_samples; 
	//get_ui_vals();
	
	/*add_to_err_log("generate demo on ch:" + ch + "\n");
	add_to_err_log("n_samples: " + n_samples + "\n");
	add_to_err_log("sample_rate: " + get_sample_rate() + "\n");
	add_to_err_log("baud: " + baud + "\n");
	add_to_err_log("samples_per_bit: " + samples_per_bit + "\n");
	add_to_err_log("parity: " + parity + "\n");*/
	
	
	delay(5);	//5 bits delay
	put_str("Hello ScanaStudio tester!");	
	var demo_cnt = 0;
	while(get_samples_acc(ch) < n_samples)
	{
		//add_to_err_log("Generating: " + demo_cnt + "\n");
		put_str("demo " + demo_cnt );	
		demo_cnt++;
		delay(5);
		//add_to_err_log("accumulated samples: " + get_samples_acc(ch) + "\n");
	}
	//add_cycle(ch,0.5,100);
	//add_cycle(ch,0.5,100);	
	//add_to_err_log("accumulated samples: " + get_samples_acc(ch) + "\n");
	//add_cycle(1,0.5,(sample_rate/1000));
	//add_samples(0,0,10);
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
function get_ch_light_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
    chColor.g = (chColor.g * 1 + 255 * 3) / 4;
    chColor.b = (chColor.b * 1 + 255 * 3) / 4;

    return chColor;
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
	UART demo builder helper functions
*/



function put_str(str)
{
    var i;
    add_samples(ch,hi,samples_per_bit*stop); //add 1 stop first
    for (i = 0; i < str.length; i++)
    {
        put_c(str.charCodeAt(i));
    }
}

function put_c(code)
{
    var i;
    var b;
    var lvl;
	var par;
	
	//add start bit, depending on data inversion mode:
	switch (invert)
	{
		case 0:	//default UART, no inversion
			add_samples(ch,0,samples_per_bit); 
		break;
		case 1: //inverted logic
			add_samples(ch,1,samples_per_bit); 
		break;
		case 2: //inverted data
			add_samples(ch,0,samples_per_bit); 
		break;
	}
	
	if (invert > 0) //if signals are inverted (1) or data only is inverted (2)
	{
		par = 1;
	}
	else
	{
		par = 0;			
	}

    if (order == 1) //msb first
    {
        for (i = 7; i >= 0; i--)
        {
            b = ((code >> i) & 0x1)
            if (b == 1)
            {
                lvl = hi;
            }
            elsep
            {
                lvl = lo;
            }
            add_samples(ch,lvl,samples_per_bit);
			par = par ^ lvl;
        }
    }
    else
    {
        for (i = 0; i < 8; i++)
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
            add_samples(ch,lvl,samples_per_bit);
			par = par ^ lvl;
        }
    }
	
	if (parity > 0)
	{
		switch(parity) //to be tested!
		{
			case 1:
				par = par ^ 1;
			break;
			case 2:
				par = par ^ 0;		
			break;
		}
		add_samples(ch,par,samples_per_bit);
	}	
    add_samples(ch,hi,samples_per_bit*stop); //add stop bits
}

/*
	adds a delay expressed in number of bits
*/
function delay(n_bits)
{
    var i;
    for (i=0; i < n_bits; i++)
    {
        add_samples(ch,hi,samples_per_bit);
    }
}

function ini_uart_generator()
{
    if (inverted == false)
    {
        hi = 1;
        lo = 0;
    }
    else
    {
        hi = 0;
        lo = 1;
    }
	var sample_r = get_sample_rate();
    samples_per_bit = sample_r / baud;
}

/* Graphical user interface for the trigger configuration
*/
function trig_gui()
{
	trig_ui_clear();
	trig_ui_add_alternative("ALT_ANY_FRAME","Trigger on a any frame",false);
		trig_ui_add_label("lab0","Trigger on any UART Frame. In other words, this alternative will trigger on any start bit");
	trig_ui_add_alternative("ALT_SPECIFIC","Trigger on byte value",true);
		trig_ui_add_label("lab1","Type decimal value (65), Hex value (0x41) or ASCII code ('A')");
		trig_ui_add_free_text("trig_byte","Trigger byte: ");
}

function trig_seq_gen()
{
	flexitrig_set_async_mode(true);
	get_ui_vals();
	nbits += 5; 			// readjust the number of bits to start counting from 5 instead of 0.
	if (stop == 0) 			// readjust number of stop bits
	{
		stop = 1;
	}
	else if (stop == 1)
	{
		stop = 1.5;
	}
	else
	{
		stop = 2;
	}
	
	

	if (trig_byte.charAt(0) == "'")
	{
		trig_byte = trig_byte.charCodeAt(1);
	}
	else
	{
		trig_byte = Number(trig_byte);
	}
	//add_to_err_log("trig_byte=" + trig_byte);


	var i;
	var b;
	var lvl = [];
	var par;
	var step;
	var bit_time = 1/baud;	// [s]
	//allow 5% margin on bit time <-- this may be configurable later.
	var bt_max = bit_time * 1.05;
	var bt_min = bit_time * 0.95;
	if (bt_max == bt_min)
	{
		if (bt_min > 0) bt_min--;
		else bt_max++;
	}
	
	if (ALT_ANY_FRAME == true)
	{
		flexitrig_clear();
		step = build_start_bit_step();
		flexitrig_append(step,-1,-1); //start edge
		flexitrig_set_summary_text("Trig on Start bit");
	}
	else if (ALT_SPECIFIC == true)
	{
		flexitrig_set_summary_text("Trig on UART byte: 0x" + trig_byte.toString(16) + " ('" + String.fromCharCode(trig_byte) + "')");
		//first, build trigger bit sequence
		switch (invert)
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
			case 2:
				par = 1;
				lvl[1] = 0;
				lvl[0] = 1;
				trig_bit_sequence[0] = 0;
			break;
		}
		for (i = 0; i < nbits; i++)
		{
			
			if (order == 0) //LSB first
			{
				trig_bit_sequence.push(lvl[((trig_byte >> i) & 0x1)]);
			}
			else
			{
				trig_bit_sequence.push(lvl[((trig_byte >> nbits - i - 1) & 0x1)]);
			}
			par = par ^ lvl[((trig_byte >> i) & 0x1)];
		}
		if (parity > 0)
		{
			switch(parity) //to be tested!
			{
				case 1:
					par = par ^ 1;
				break;
				case 2:
					par = par ^ 0;		
				break;
			}
			trig_bit_sequence.push(par);
		}
		//add stop bit
		trig_bit_sequence.push((~trig_bit_sequence[0])&0x1);
		
		//now build trigger step
		flexitrig_clear();
		//Start bit
		step = build_step(0);
		flexitrig_append(step,-1,-1); //start edge
		//helper vars
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
			}
		}
		
	}
}

function build_step(step_index)
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

function build_start_bit_step()
{
	var step = "";
	var i;
	var start_bit_desc;
	switch (invert)
	{
		case 0:
		case 2:
			start_bit_desc = "F";
		break;
		case 1:
			start_bit_desc = "R";
		break;
	}		
	for (i = 0; i < get_device_max_channels(); i++)
	{	
		if (i == ch)
		{
			step = start_bit_desc + step;
		}
		else
		{
			step = "X" + step;
		}	
	}
	return step;
}



















