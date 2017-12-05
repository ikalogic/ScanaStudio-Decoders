/*
*************************************************************************************
							SCANASTUDIO 2 SPI DECODER
The following commented block allows some related informations to be displayed online
<DESCRIPTION>

	SPI Protocol Decoder.
	Highly configurable SPI bus decoder.

</DESCRIPTION>

<RELEASE_NOTES>

	V1.66: Add light packet capabilities.
	V1.65: Completely reworked PacketView.
	V1.62: Better progress reporting, better demo mode generator, better PacketView
	V1.61: Upgrade PacketView
	V1.60: Fixed bug in SPI decoder and improve display
	V1.59: Fixed bug in SPI decoder when CS is not valide
	V1.58: Fixed bug in SPI generator, thanks to user Camille
	V1.57: Added ScanaStudio 2.3xx compatibility.
	V1.56: Added generator capability
	V1.55: New options for trigger part
	V1.54: Trigger fix
	V1.53: Added decoder trigger
	V1.52: Added demo signal building capability
	V1.50: Better handling of probable noize on CS line (e.g. during system power up)
	V1.49: Enhanced the way hex data is displayed in packet view (Thanks to user 0xdeadbeef)
	V1.48: Corrected a bug in the way decoded data is displayed
	V1.47: Better drawing of decoded items on the wavefrom (better alignment).
	V1.46: Fixed a bug that caused some SPI modes to be incorrectly decoded. (By I.Kamal)
	V1.45: Corrected another bug related to the option to ignore CS line. (By I.Kamal)
	V1.44: Corrected a bug related to the option to ignore CS line. (By I.Kamal)
	V1.42: Added the ability to ignore the CS line (for 2 wire SPI mode)
	V1.41: Added the ability to decode even if the first CS edge is missing
	V1.30: Added Packet/Hex View support.
	V1.26: Added the possibility (option) to ignore MOSI or MISO line
	V1.25: Single slave (w/o a cs signal) mode bug fixes. Thx to DCM
	V1.20: UI improvements
	V1.15: CPOL=1 & CPHA=1 mode bug fixes
	V1.10: Some little bug fixes
	V1.01: Added description and release notes
	V1.00: Initial release

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

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
	return "SPI";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.66";
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

var	GET_CS 	 = 0;
var	GET_DATA = 10;
var	END_FRAME = 20;
var OPT_IGNORE_NONE = 0;
var OPT_IGNORE_MOSI = 1;
var OPT_IGNORE_MISO = 2;

var clk_active;
var state = GET_CS;
var s_start;
var stop = false;
var n_words = 0;
var c_idle,c_active;
var cs_idle,cs_active;
var samples_per_us;
var samples_per_bit;
var gen_bit_rate;
var spi_trig_steps = [];
var b;

var MSB_FIRST = 0;
var LSB_FIRST = 1;
var CPOL_ACTIVE_HIGH = 0;
var CPOL_ACTIVE_LOW = 1;
var CPHA_SAMP_LEADING = 0;
var CPHA_SAMP_TRAILING = 1;
var CS_ACTIVE_LOW = 0;
var CS_ACTIVE_HIGH = 1;

function SpiTrigStep (mosi, miso, clk, cs)
{
	this.mosi = mosi;
	this.miso = miso;
	this.clk  = clk;
	this.cs   = cs;
};

var SPI_OBJECT_TYPE =
{
	MOSI : 0x01,
	MISO : 0x02,
};

function SpiObject (type, value, start, end)
{
	this.type = type;
	this.value = value;
	this.start = start;
	this.end = end;
};

function PktObject (mosiArr, misoArr, start, end)
{
	this.mosiArr = mosiArr;
	this.misoArr = misoArr;
	this.start = start;
	this.end = end;
};

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
	ui_add_ch_selector( "ch_mosi", "MOSI (Master Out) Line", "MOSI" );
	ui_add_ch_selector( "ch_miso", "MISO (Slave Out) Line", "MISO" );
	ui_add_ch_selector( "ch_clk", "CLOCK Line", "SCLK" );
	ui_add_ch_selector( "ch_cs", "Chip Select (Slave select)", "CS" );
	ui_add_txt_combo( "nbits", "Bits per word" );
		ui_add_item_to_txt_combo( "1" );
		ui_add_item_to_txt_combo( "2" );
		ui_add_item_to_txt_combo( "3" );
		ui_add_item_to_txt_combo( "4" );
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
		ui_add_item_to_txt_combo( "17" );
		ui_add_item_to_txt_combo( "18" );
		ui_add_item_to_txt_combo( "19" );
		ui_add_item_to_txt_combo( "20" );
		ui_add_item_to_txt_combo( "21" );
		ui_add_item_to_txt_combo( "22" );
		ui_add_item_to_txt_combo( "23" );
		ui_add_item_to_txt_combo( "24" );
		ui_add_item_to_txt_combo( "25" );
		ui_add_item_to_txt_combo( "26" );
		ui_add_item_to_txt_combo( "27" );
		ui_add_item_to_txt_combo( "28" );
		ui_add_item_to_txt_combo( "29" );
		ui_add_item_to_txt_combo( "30" );
		ui_add_item_to_txt_combo( "31" );
		ui_add_item_to_txt_combo( "32" );
		ui_add_item_to_txt_combo( "33" );
		ui_add_item_to_txt_combo( "34" );
		ui_add_item_to_txt_combo( "35" );
		ui_add_item_to_txt_combo( "36" );
		ui_add_item_to_txt_combo( "37" );
		ui_add_item_to_txt_combo( "38" );
		ui_add_item_to_txt_combo( "39" );
		ui_add_item_to_txt_combo( "40" );
		ui_add_item_to_txt_combo( "41" );
		ui_add_item_to_txt_combo( "42" );
		ui_add_item_to_txt_combo( "43" );
		ui_add_item_to_txt_combo( "44" );
		ui_add_item_to_txt_combo( "45" );
		ui_add_item_to_txt_combo( "46" );
		ui_add_item_to_txt_combo( "47" );
		ui_add_item_to_txt_combo( "48" );
		ui_add_item_to_txt_combo( "49" );
		ui_add_item_to_txt_combo( "50" );
		ui_add_item_to_txt_combo( "51" );
		ui_add_item_to_txt_combo( "52" );
		ui_add_item_to_txt_combo( "53" );
		ui_add_item_to_txt_combo( "54" );
		ui_add_item_to_txt_combo( "55" );
		ui_add_item_to_txt_combo( "56" );
		ui_add_item_to_txt_combo( "57" );
		ui_add_item_to_txt_combo( "58" );
		ui_add_item_to_txt_combo( "59" );
		ui_add_item_to_txt_combo( "60" );
		ui_add_item_to_txt_combo( "61" );
		ui_add_item_to_txt_combo( "62" );
		ui_add_item_to_txt_combo( "63" );
		ui_add_item_to_txt_combo( "64" );
		ui_add_item_to_txt_combo( "65" );
		ui_add_item_to_txt_combo( "66" );
		ui_add_item_to_txt_combo( "67" );
		ui_add_item_to_txt_combo( "68" );
		ui_add_item_to_txt_combo( "69" );
		ui_add_item_to_txt_combo( "70" );
		ui_add_item_to_txt_combo( "71" );
		ui_add_item_to_txt_combo( "72" );
		ui_add_item_to_txt_combo( "73" );
		ui_add_item_to_txt_combo( "74" );
		ui_add_item_to_txt_combo( "75" );
		ui_add_item_to_txt_combo( "76" );
		ui_add_item_to_txt_combo( "77" );
		ui_add_item_to_txt_combo( "78" );
		ui_add_item_to_txt_combo( "79" );
		ui_add_item_to_txt_combo( "80" );
		ui_add_item_to_txt_combo( "81" );
		ui_add_item_to_txt_combo( "82" );
		ui_add_item_to_txt_combo( "83" );
		ui_add_item_to_txt_combo( "84" );
		ui_add_item_to_txt_combo( "85" );
		ui_add_item_to_txt_combo( "86" );
		ui_add_item_to_txt_combo( "87" );
		ui_add_item_to_txt_combo( "88" );
		ui_add_item_to_txt_combo( "89" );
		ui_add_item_to_txt_combo( "90" );
		ui_add_item_to_txt_combo( "91" );
		ui_add_item_to_txt_combo( "92" );
		ui_add_item_to_txt_combo( "93" );
		ui_add_item_to_txt_combo( "94" );
		ui_add_item_to_txt_combo( "95" );
		ui_add_item_to_txt_combo( "96" );
		ui_add_item_to_txt_combo( "97" );
		ui_add_item_to_txt_combo( "98" );
		ui_add_item_to_txt_combo( "99" );
		ui_add_item_to_txt_combo( "100" );
		ui_add_item_to_txt_combo( "101" );
		ui_add_item_to_txt_combo( "102" );
		ui_add_item_to_txt_combo( "103" );
		ui_add_item_to_txt_combo( "104" );
		ui_add_item_to_txt_combo( "105" );
		ui_add_item_to_txt_combo( "106" );
		ui_add_item_to_txt_combo( "107" );
		ui_add_item_to_txt_combo( "108" );
		ui_add_item_to_txt_combo( "109" );
		ui_add_item_to_txt_combo( "110" );
		ui_add_item_to_txt_combo( "111" );
		ui_add_item_to_txt_combo( "112" );
		ui_add_item_to_txt_combo( "113" );
		ui_add_item_to_txt_combo( "114" );
		ui_add_item_to_txt_combo( "115" );
		ui_add_item_to_txt_combo( "116" );
		ui_add_item_to_txt_combo( "117" );
		ui_add_item_to_txt_combo( "118" );
		ui_add_item_to_txt_combo( "119" );
		ui_add_item_to_txt_combo( "120" );
		ui_add_item_to_txt_combo( "121" );
		ui_add_item_to_txt_combo( "122" );
		ui_add_item_to_txt_combo( "123" );
		ui_add_item_to_txt_combo( "124" );
		ui_add_item_to_txt_combo( "125" );
		ui_add_item_to_txt_combo( "126" );
		ui_add_item_to_txt_combo( "127" );
		ui_add_item_to_txt_combo( "128" );
	ui_add_txt_combo( "order", "Bit Order" );
		ui_add_item_to_txt_combo( "Most significant bit first (MSB)", true );
		ui_add_item_to_txt_combo( "Least significant bit first (LSB)" );
	ui_add_txt_combo( "cpol", "Clock polarity" );
		ui_add_item_to_txt_combo( "(CPOL = 0) clock LOW when inactive", true );
		ui_add_item_to_txt_combo( "(CPOL = 1) Clock HIGH when inactive" );
	ui_add_txt_combo( "cpha", "Clock phase" );
		ui_add_item_to_txt_combo( "(CPHA = 0) Data samples on leading edge", true );
		ui_add_item_to_txt_combo( "(CPHA = 1) Data samples on trailing edge" );
	ui_add_txt_combo( "cspol", "Chip Select" );
		ui_add_item_to_txt_combo( "Active low", true );
		ui_add_item_to_txt_combo( "Active high" );
	ui_add_txt_combo( "opt", "MOSI/MISO options" );
		ui_add_item_to_txt_combo( "None", true );
		ui_add_item_to_txt_combo( "Ignore MOSI line" );
		ui_add_item_to_txt_combo( "Ignore MISO line" );
	ui_add_txt_combo( "opt_cs", "CS options" );
		ui_add_item_to_txt_combo( "None", true );
		ui_add_item_to_txt_combo( "Ignore CS (Chip Select) line" );
	ui_add_txt_combo( "n_to_decode", "Decode" );
		ui_add_item_to_txt_combo( "Only first 500 data words" );
		ui_add_item_to_txt_combo( "Only first 1000 data words" );
		ui_add_item_to_txt_combo( "Only first 5000 data words", true );
		ui_add_item_to_txt_combo( "Only first 10000 data words" );
		ui_add_item_to_txt_combo( "Everything" );
	ui_add_separator();
	ui_add_info_label( "PacketView Options", true );
	ui_add_txt_combo( "pkt_view_mode", "View mode:" );
		ui_add_item_to_txt_combo( "Group data of the same transaction", true );
		ui_add_item_to_txt_combo( "Present each byte separately" ); 
}

/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	get_ui_vals();

	nbits = nbits + 1;														// Readjust the number of bits variable

	if (n_to_decode == 0) n_to_decode = 500;
	if (n_to_decode == 1) n_to_decode = 1000;
	if (n_to_decode == 2) n_to_decode = 5000;
	if (n_to_decode == 3) n_to_decode = 10000;
	if (n_to_decode == 4) n_to_decode = n_samples;							// Decode all the samples

	if ((cpol == 0) && (cpha == 0)) clk_active = 1;
	if ((cpol == 0) && (cpha == 1)) clk_active = 0;
	if ((cpol == 1) && (cpha == 0)) clk_active = 0;
	if ((cpol == 1) && (cpha == 1)) clk_active = 1;

	if (opt != OPT_IGNORE_MISO) 
	{
		trs_get_first(ch_miso);												// This initialize the iterator for that channel
	}

	if (opt != OPT_IGNORE_MOSI) 
	{
		trs_get_first(ch_mosi);
	}

	var disp_margin = 0;
	var t = trs_get_first(ch_cs);
	var t_end =  new transition(0, 0);
	var t_clk = trs_get_first(ch_clk);
	var t_clk_prev = t_clk;
	var bits_mosi = new Array();
	var bits_miso = new Array();
	var skip_first_cs_falling_edge = false;
	var delta_clk;

	var pktObj = new PktObject();
	pktObj.mosiArr = [];
	pktObj.misoArr = [];

	if ((t.sample > 0) && (t.val != cspol)) 								// If the CS starts low, no need to search for the falling edge
	{
		skip_first_cs_falling_edge = true;
	}

	while (trs_is_not_last(ch_clk) && (trs_is_not_last(ch_cs) || (opt_cs == 1)) && (stop == false))
	{
		if (abort_requested())
		{
			stop = true;
		}

		if (state == GET_CS)
		{			
			if (opt_cs != 0) 												// If we want to ignore the CS line
			{
				t_end.sample = n_samples;
				state = GET_DATA;
				t = t_clk;
				break;
			}
			else
			{
				if (skip_first_cs_falling_edge)
				{
					skip_first_cs_falling_edge = false;
	
					t_end.sample = t.sample;
					t_end.val = t.val;
					t.sample = 0;
					t.val = cspol;
	
					dec_item_new(ch_cs, t.sample, t_end.sample);
					dec_item_add_pre_text("Warning: The leading edge of CS (Chip Select) line is missing!");
					dec_item_add_pre_text("Warning: CS leading edge is missing!");
					dec_item_add_pre_text("Warning: CS!");
					dec_item_add_pre_text("W: CS!");
					dec_item_add_pre_text("!CS!");
					dec_item_add_pre_text("!");
					dec_item_add_comment ("Leading edge edge of CS line is missing!");
				}
				else
				{
					while ((t.val != cspol) && trs_is_not_last(ch_cs))		// Search for a new packet (an active CS state)
					{
						t = trs_get_next(ch_cs);
					}

					t_end = trs_get_next(ch_cs);
				}

				pktObj.mosiArr = [];
				pktObj.misoArr = [];
				pktObj.start = t.sample;
				pktObj.end = t_end.sample;
			}

			while (t_clk.sample < t.sample)									// Go to the clock transition just after the start of the Chip Select signal
			{
				if (trs_is_not_last(ch_clk))
				{
					t_clk = trs_get_next(ch_clk);
				}
				else
				{
					break;
				}
			}

			if (trs_is_not_last(ch_clk))
			{
				state = GET_DATA;
			}
		}
		else if (state == GET_DATA)
		{
			var data_mosi = 0;
			var data_miso = 0;

			bits_mosi.length = 0;
			bits_miso.length = 0;
			delta_clk = t_clk.sample - t_clk_prev.sample;

			while ((bits_mosi.length < nbits) && (trs_is_not_last(ch_clk))) 	// Read data bits for a whole transfer
			{
				if (t_clk.val == clk_active)
				{
					if (bits_mosi.length == 0)
					{
						s_start = t_clk.sample - get_bit_margin();
					}

					if (bits_mosi.length == nbits - 1)
					{
						disp_margin = t_clk.sample - s_start;
						disp_margin /= nbits * 1.8;
					}

					if (opt != OPT_IGNORE_MOSI)
					{
						var bit_mosi = sample_val(ch_mosi, t_clk.sample);
						dec_item_add_sample_point(ch_mosi, t_clk.sample, bit_mosi);
					}

					if (opt != OPT_IGNORE_MISO) 
					{
						var bit_miso = sample_val(ch_miso, t_clk.sample);
						dec_item_add_sample_point(ch_miso, t_clk.sample, bit_miso);
					}

					bits_miso.push(bit_miso);
					bits_mosi.push(bit_mosi);
				}

				t_clk_prev = t_clk;

				if (trs_is_not_last(ch_clk))
				{
					t_clk = trs_get_next(ch_clk);
				}
				else
				{
					break;
				}

				if (t_clk.sample > t_end.sample) 									// If we are out of the CS limits
				{
					state = END_FRAME;
					break;
				}

				if (opt_cs == 1)													// If we don't look at CS, we'll look at periodicity on sclk 
				{
					if (delta_clk >= 1.5 * (t_clk.sample - t_clk_prev.sample))
					{
						t_clk_prev = t_clk;

						if (trs_is_not_last(ch_clk))
						{
							t_clk = trs_get_next(ch_clk);
						}
						else
						{
							break;
						}

						if (delta_clk >= 1.5 * (t_clk.sample - t_clk_prev.sample))	// A long state occured on sclk
						{
							t_clk = trs_get_prev(ch_clk); 							// Back the clock up to sync correctly
							t_clk = trs_get_prev(ch_clk);
							t_clk_prev = t_clk;

							if (trs_is_not_last(ch_clk))
							{
								t_clk = trs_get_next(ch_clk);
							}
							else
							{
								break;
							}

							delta_clk = t_clk.sample - t_clk_prev.sample
							state = END_FRAME;							
							break;
						}
					}
					else
					{
						delta_clk = t_clk.sample - t_clk_prev.sample;
					}
				}
			}

			if ((bits_mosi.length < (nbits)) && (bits_miso.length < (nbits)))		// Invalid cs signal, skip it
			{
				t_clk = trs_get_prev(ch_clk); 										// Back the clock up to sync correctly
				state = END_FRAME;
				t = t_end;
				break;
			}

			if (order == 0)
			{
				if (opt != OPT_IGNORE_MISO)
				{
					for (b = 0; b < bits_mosi.length; b++)
					{
						data_miso = (data_miso * 2) + bits_miso[b];
					}
				}
				if (opt != OPT_IGNORE_MOSI)
				{
					for (b = 0; b < bits_mosi.length; b++)
					{
						data_mosi = (data_mosi * 2) + bits_mosi[b];
					}
				}
			}
			else
			{
				if (opt != OPT_IGNORE_MISO)
				{
					for (b = bits_mosi.length - 1; b >= 0; b--)
					{
						data_miso = (data_miso * 2) + bits_miso[b];
					}
				}
				if (opt != OPT_IGNORE_MOSI)
				{
					for (b = bits_mosi.length - 1; b >= 0; b--)
					{
						data_mosi = (data_mosi * 2) + bits_mosi[b];
					}
				}
			}

			s_end = t_clk_prev.sample + get_bit_margin();

			if (opt == OPT_IGNORE_MOSI)
			{
				dec_item_new(ch_miso, (s_start - disp_margin), (s_end + disp_margin));
				dec_item_add_data(data_miso);

				pktObj.misoArr.push(new SpiObject(SPI_OBJECT_TYPE.MISO, data_miso, (s_start - disp_margin), (s_end + disp_margin)));
			}
			else if (opt == OPT_IGNORE_MISO)
			{
				dec_item_new(ch_mosi, (s_start - disp_margin), (s_end + disp_margin));
				dec_item_add_data(data_mosi);

				pktObj.mosiArr.push(new SpiObject(SPI_OBJECT_TYPE.MOSI, data_mosi, (s_start - disp_margin), (s_end + disp_margin)));
			}
			else if (opt == OPT_IGNORE_NONE)
			{
				dec_item_new(ch_mosi, (s_start - disp_margin), (s_end + disp_margin));
				dec_item_add_data(data_mosi);

				dec_item_new(ch_miso, (s_start - disp_margin), (s_end + disp_margin));
				dec_item_add_data(data_miso);

				pktObj.misoArr.push(new SpiObject(SPI_OBJECT_TYPE.MISO, data_miso, (s_start - disp_margin), (s_end + disp_margin)));
				pktObj.mosiArr.push(new SpiObject(SPI_OBJECT_TYPE.MOSI, data_mosi, (s_start - disp_margin), (s_end + disp_margin)));
			}

			var byte_mosi, byte_miso;

			for (var i = 0; i < (nbits / 8); i++)
			{
				if (opt != OPT_IGNORE_MOSI)
				{
					byte_mosi = (data_mosi & 0xFF);
					hex_add_byte(ch_mosi, -1, -1, byte_mosi);
					data_mosi = data_mosi << 8;
				}
				
				if (opt != OPT_IGNORE_MISO)
				{
					byte_miso = (data_miso & 0xFF);
					hex_add_byte(ch_miso, -1, -1, byte_miso);
					data_miso = data_miso << 8;
				}
			}

			if ((n_words / n_to_decode) > (t_clk.sample / n_samples))
			{
				set_progress(100 * n_words / n_to_decode);
			}
			else
			{
				set_progress(100 * t_clk.sample / n_samples);
			}

			t = t_end;

			if (trs_is_not_last(ch_clk))
			{
				t_clk = trs_get_next(ch_clk);
			}
			else
			{
				break;
			}

			if (t_clk.sample >= t_end.sample)
			{
				state = END_FRAME;
			}
			else
			{
				state = GET_DATA;
			}

			n_words++;

			if (n_words > n_to_decode)
			{
				stop = true;
			}
		}
		else if (state == END_FRAME)
		{			
			pkt_add_packet(pktObj);
			pktObj.start = false

			state = GET_CS;
		}
	}

	if (pktObj.start != false)
	{
		pkt_add_packet(pktObj);
	}
}

/*
*************************************************************************************
							    SIGNAL GENERATOR
*************************************************************************************
*/

function generator_template()
{
	/*
		Quick Help
		~~~~~~~~~~
		Start by configuring the SPI decoder with the variables
		in the "configuration" part.
		
		Then, use the following functions to generate SPI packets:
		gen_add_delay(delay,cs_state)
		=============================
			Description
			-----------
			Adds a delay
			
			Parameters
			----------
			delay: the delay expressed in number of samples
			cs_state: either cs_active or cs_idle
			
		gen_cs(active)
		===============
			Description
			-----------
			Sets the state of CS line
			
			Parameters
			----------
			active: set to "true" for CS active state, "false" otherwise.
			
		gen_add_word(d_mosi, d_miso)
		===============
			Description
			-----------
			Sets the state of CS line
			
			Parameters
			----------
			d_mosi: data word for the mosi line
			d_miso: data word for the miso line
	*/
	
	/*
		Configuration part : !! Configure this part !!
		(Do not change variables names)
	*/

	ch_mosi = 0; 			// MOSI on CH 1
	ch_miso = -1; 			// set to -1 to inhibit generator on MISO channel
	ch_clk = 2;				// CLK on CH 3
	ch_cs = 3;				// CS on CH 4
	nbits = spi_n_bits(8); 	// bits per word
	order = MSB_FIRST;
	cpol = CPOL_ACTIVE_HIGH;
	cpha = CPHA_SAMP_LEADING;
	cspol = CS_ACTIVE_LOW;

	gen_bit_rate = 1000000; // bit rate expressed in Hz

	ini_spi_generator();

	/*
		Signal generation part !! Change this part according to your application !!
	*/
	gen_add_delay(samples_per_us * 5, cs_idle);
	gen_cs(true);

	for (var i = 0; i < 10; i++)
	{
		gen_add_word(i, 0);
		gen_add_delay(samples_per_us, cs_active);
	}

	gen_cs(false);
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
	var demo_cnt = 0;
	var offset = 0;
	var inter_transaction_silence;
	var scanastudio_version_maj = Number(get_scanastudio_version().split(".")[0]) + (get_scanastudio_version().split(".")[1]/1000);
	var scanastudio_version_minor = get_scanastudio_version().split(".")[2];

	gen_bit_rate = 1000000; 					// Bitrate in Hz

	ini_spi_generator();
	inter_transaction_silence = n_samples / (20 * samples_per_bit);

	gen_add_delay(samples_per_us * 5, cs_idle);

	while (get_samples_acc(ch_clk) < n_samples)
	{
		if (scanastudio_version_maj > 2.4) 		// SCANASTUDIO 2.5 introduced the ability to report progress from within the samples generator	
		{
			set_progress(get_samples_acc(ch_clk) * 100 / n_samples  );
		}

		gen_cs(true);

		for (var i = 0; i < 10; i++)
		{
			gen_add_word(demo_cnt, i + offset);
			gen_add_delay(samples_per_us, cs_active);
		}

		gen_cs(false);
		gen_add_delay(inter_transaction_silence,1);

		demo_cnt++;

		if  (offset < 0xF5)
		{
			offset += 10; 
		}
		else
		{
			offset = 0;
		}
	}
}

/*
*/
function ini_spi_generator()
{
	samples_per_bit = get_srate() / gen_bit_rate;

	if (samples_per_bit < 2)
	{
		add_to_err_log("SPI generator Bit rate too high compared to device sampling rate");
	}

	samples_per_us = get_srate() / 1000000;

	if (cpol == 0)
	{
		c_idle = 1;
		c_active = 0;
	}
	else
	{
		c_idle = 0;
		c_active = 1;
	}
	
	if (cspol == 0)
	{
		cs_idle = 1;
		cs_active = 0;
	}
	else
	{
		cs_idle = 0;
		cs_active = 1;
	}
}

/*
*/
function gen_cs (st_sp)
{
	add_samples(ch_mosi, 0, samples_per_bit);
	add_samples(ch_miso, 0, samples_per_bit);
	add_samples(ch_clk, c_idle, samples_per_bit);

	if (st_sp)
	{
		add_samples(ch_cs, cs_active, samples_per_bit);
			cs_state = cs_active;
	}
	else
	{
		add_samples(ch_cs, cs_idle, samples_per_bit);
		cs_state = cs_idle;
	}
}

/*
*/
function spi_n_bits(b)
{
	return b - 1;
}

/*
*/
function gen_add_word (w_mosi, w_miso)
{
	var bmosi;
	var bmiso;

	if (order == 1)
	{
		for (i = 0; i < (nbits + 1); i++)
		{
			bmosi = ((w_mosi >> i) & 0x1);
			bmiso = ((w_miso >> i) & 0x1);
			gen_add_bit(bmosi, bmiso);
		}
	}
	else
	{
		for (i = (nbits); i >= 0 ; i--)
		{
			bmosi = ((w_mosi >> i) & 0x1);
			bmiso = ((w_miso >> i) & 0x1);
			gen_add_bit(bmosi, bmiso);
		}	
	}
	
}

/*
*/
function gen_add_bit (b_mosi, b_miso)
{
	if (cpha == 0)
	{
		add_samples(ch_mosi, b_mosi, samples_per_bit);
		add_samples(ch_miso, b_miso, samples_per_bit);
		add_samples(ch_clk, c_idle, samples_per_bit);
		add_samples(ch_cs, cs_active, samples_per_bit);

		add_samples(ch_mosi, b_mosi, samples_per_bit);
		add_samples(ch_miso, b_miso, samples_per_bit);
		add_samples(ch_clk, c_active, samples_per_bit);
		add_samples(ch_cs, cs_active, samples_per_bit);
	}
	else
	{
		add_samples(ch_mosi, b_mosi, samples_per_bit);
		add_samples(ch_miso, b_miso, samples_per_bit);
		add_samples(ch_clk, c_active, samples_per_bit);
		add_samples(ch_cs, cs_active, samples_per_bit);
		
		add_samples(ch_mosi, b_mosi, samples_per_bit);
		add_samples(ch_miso, b_miso, samples_per_bit);
		add_samples(ch_clk, c_idle, samples_per_bit);
		add_samples(ch_cs, cs_active, samples_per_bit);
	}
}

/*
*/
function gen_add_delay (d, cs_state)
{
	add_samples(ch_mosi, 0, d);
	add_samples(ch_miso, 0, d);
	add_samples(ch_clk, c_idle, d);
	add_samples(ch_cs, cs_state, d);
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
	trig_ui_clear();

	trig_ui_add_alternative("alt_any_byte", "Trigger on a any byte", true);
		trig_ui_add_label("lab0", "Trigger on any SPI byte");

	trig_ui_add_alternative("alt_specific_byte", "Trigger on byte value", false);

		trig_ui_add_label("lab1", "All text fields can accept decimal value (65), hex value (0x41) or ASCII character ('A'). Byte position value begins with 1 <br>");
		trig_ui_add_free_text("trig_byte", "Trigger byte value: ");

		trig_ui_add_free_text("byte_pos", "Byte position in the frame: ");

		trig_ui_add_combo("trig_data_line", "Data Line");
		trig_ui_add_item_to_combo("MOSI", true);
		trig_ui_add_item_to_combo("MISO", false);
}

/*
*/
function trig_seq_gen()
{
	flexitrig_set_async_mode(false);
	get_ui_vals();

	var i, k;
	var spi_step = {mosi: "X", miso: "X", clk: "X", cs: "X"};
	var summary_text = "";

	spi_trig_steps.length = 0;

	if (alt_any_byte)
	{
		summary_text = "Trig on any SPI byte"
	}
	else if (alt_specific_byte)
	{
		trig_byte = Number(trig_byte);
		summary_text = "Trig on SPI byte: 0x" + trig_byte.toString(16);
	}

	if (alt_any_byte || alt_specific_byte)
	{
		if (opt_cs != 1)			// opt_cs: 0 - normal cs, 1 - ignore cs
		{
 			if (cspol == 0)			// cspol: 0 - cs active low, 1 - cs active high
 			{
				spi_step.cs = "F";
			}
			else
			{
				spi_step.cs = "R";
			}

			spi_trig_steps.push(new SpiTrigStep(spi_step.mosi, spi_step.miso, spi_step.clk, spi_step.cs));

			if (cspol == 0)			// cspol: 0 - cs active low, 1 - cs active high
			{
				spi_step.cs = "0";
			}
			else
			{
				spi_step.cs = "1";
			}
		}

		if (cpol == 0)				// cpol: 0 -  clk inactive low, 1 - clk inactive high
		{
			if (cpha == 0)			// cpha: 0 - data samples on leading edge, 1 - data samples on trailing edge
			{
				spi_step.clk  = "R";
			}
			else
			{
				spi_step.clk  = "F";
			}
		}
		else
		{
			if (cpha == 0)
			{
				spi_step.clk  = "F";
			}
			else
			{
				spi_step.clk  = "R";
			}
		}

		if (typeof byte_pos !== 'undefined')
		{
			if (+byte_pos > 1)						// Ajust an offset if nessecary
			{
				for (k = 0; k < (byte_pos - 1); k++)
				{
					for (i = 0; i <= nbits; i++)	// nbits: 1 - 128 bits in data byte
					{
						spi_trig_steps.push(new SpiTrigStep(spi_step.mosi, spi_step.miso, spi_step.clk, spi_step.cs));
					}
				}
			}
		}

		if (order == 0)							// Order: 0 - first bit is MSB, 1 - first bit is LSB
		{
			for (i = nbits; i >= 0; i--)		// nbits: 1 - 128 bits in byte
			{
			    if ( (alt_specific_byte) && (typeof byte_pos !== 'undefined') )
				{
					if (trig_data_line == 0)	// trig_data_line: 0 - MOSI, 1 - MISO
					{
						spi_step.mosi = ((trig_byte >> i) & 0x1).toString();
					}
					else
					{
						spi_step.miso = ((trig_byte >> i) & 0x1).toString();
					}
				}

				spi_trig_steps.push(new SpiTrigStep(spi_step.mosi, spi_step.miso, spi_step.clk, spi_step.cs));
			}
		}
		else
		{
			for (i = 0; i <= nbits; i++)		// nbits: 1 - 128 bits in data byte
			{
			    if (alt_specific_byte)
				{
					if (trig_data_line == 0)	// trig_data_line: 0 - MOSI, 1 - MISO
					{
						spi_step.mosi = ((trig_byte >> i) & 0x1).toString();
					}
					else
					{
						spi_step.miso = ((trig_byte >> i) & 0x1).toString();
					}
				}

				spi_trig_steps.push(new SpiTrigStep(spi_step.mosi, spi_step.miso, spi_step.clk, spi_step.cs));
			}
		}
	}

	flexitrig_clear();

	for (i = 0; i < spi_trig_steps.length; i++)
	{
		flexitrig_append(trig_build_step(spi_trig_steps[i]), -1, -1);
	}

	flexitrig_set_summary_text(summary_text);
	// flexitrig_print_steps();
}

/*
*/
function trig_build_step (step_desc)
{
	var i;
	var step = "";

	for (i = 0; i < get_device_max_channels(); i++)
	{
		switch (i)
		{
		    case ch_mosi: step = step_desc.mosi + step; break;
		    case ch_miso: step = step_desc.miso + step; break;
		    case ch_clk:  step = step_desc.clk + step; break;
		    case ch_cs:   step = step_desc.cs + step; break;
		    default:      step = "X" + step; break;
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
function pkt_add_packet (pktObj)
{
	var totalWords = (pktObj.mosiArr.length + pktObj.misoArr.length) / 2;

	if (totalWords <= 0)
	{
		return false;
	}

	var desc = "" + totalWords + " WORD";

	if (totalWords > 1)
	{
		desc += "S"
	}

	pkt_start("SPI");
	pkt_add_item(pktObj.start, pktObj.end, "SPI Frame", desc, dark_colors.gray, get_ch_light_color(ch_clk),true,ch_clk);
	pkt_start("NEW FRAME");

	if (pkt_view_mode)
	{
		var words = 0;

		while (totalWords > words)
		{
			var word = "";
			
			if (pktObj.mosiArr.length > 0)
			{
				word = int_to_str_hex(pktObj.mosiArr[words].value);
				pkt_add_item(pktObj.mosiArr[words].start, pktObj.mosiArr[words].end, "MOSI", word, get_ch_color(ch_mosi), get_ch_light_color(ch_mosi),true,ch_mosi);
			}
			
			if (pktObj.misoArr.length > 0)
			{
				word = int_to_str_hex(pktObj.misoArr[words].value);
				pkt_add_item(pktObj.misoArr[words].start, pktObj.misoArr[words].end, "MISO", word, get_ch_color(ch_miso), get_ch_light_color(ch_miso),true,ch_miso);
			}
			
			words++;
		}
	}
	else
	{
		pkt_add_data("MOSI", get_ch_color(ch_mosi), pktObj.mosiArr, get_ch_light_color(ch_mosi));	
		pkt_add_data("MISO", get_ch_color(ch_miso), pktObj.misoArr, get_ch_light_color(ch_miso));
	}

	pkt_end();
	pkt_end();

	return true;
}

/*
*/
function pkt_add_data (title, titleColor, dataArr, dataColor)
{
	if (dataArr.length <= 0)
	{
		return false;
	}

	var bytesPerLine = 8;
	var charsPerLine = Math.round(bytesPerLine * 3);			// 2 chars per bytes + 1 space between two
	var charsPerWord = Math.round((nbits / 4) + 1);				// 4 bits per character + 1 space at the end
	var wordsPerLine = Math.ceil(charsPerLine / charsPerWord);
	var linesNum     = Math.ceil((dataArr.length / wordsPerLine));

	var wordsTotal  = 0
	var wordsInLine = 0;
	var lineStart   = false; 
	var lineEnd     = 0;
	var lineNum     = 0;
	var line        = "";

	while (dataArr.length > wordsTotal)
	{
		wordsInLine = 0;
		lineStart = false;
		line = "";

		while ((dataArr.length > wordsTotal) && (wordsInLine < wordsPerLine))
		{
			if (lineStart == false)
			{
				lineStart = dataArr[wordsTotal].start;
			}

			lineEnd = dataArr[wordsTotal].end;
			line += int_to_str_hex(dataArr[wordsTotal].value) + " ";

			wordsInLine++;
			wordsTotal++;
		}

		var desc = "";
		var firstWordPos = (wordsTotal - wordsInLine);
		var lastWordPos = (wordsTotal - 1);

		if (lineNum <= 0)
		{
			desc += title + " ";
		}

		if (firstWordPos == lastWordPos)
		{
			desc += "[" + lastWordPos + "]";
		}
		else
		{
			desc += "[" + firstWordPos + ":" + lastWordPos + "]";
		}

		if (title == "MOSI")
		{
			pkt_add_item(lineStart, lineEnd, desc, line, titleColor, dataColor, true, ch_mosi);
		}
		else
		{
			pkt_add_item(lineStart, lineEnd, desc, line, titleColor, dataColor, true, ch_miso);
		}

		lineNum++;
	}

	return true;
}

/*
*/
function int_to_str_hex (num)
{
	var result = "";
	var prefix = ""
	var nibbles = (nbits / 4);

	for (i = 0; i < nibbles; i++)
	{
		prefix += "0";
	}

	result = (prefix + num.toString(16).toUpperCase()).substr((-1 * nibbles));
	return result;
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

/* ScanaStudio 2.3 compatibility function
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
function get_bit_margin()
{
	var k = 0;
	return ((k * get_srate()) / 100000000);
}
