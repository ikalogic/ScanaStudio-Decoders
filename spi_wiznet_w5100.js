/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	WIZnet W5100 SPI decoder/debugger.
	Decodes SPI traffic on the SPI bus between an MCU and the WIZnet W5100 Ethernet.
	It decodes raw bytes to human-readable OP-Codes, registers, TX-memory and RX-memory
	addresses in the PacketViewer.
	
	Copyright 2015 Bart Hijwegen.
	Licensed under the Creative Commons Attribution 4.0 license
	http://creativecommons.org/licenses/by/4.0/
	Software is distributed on an "AS IS" BASIS, WITHOUT
	WARRANTIES OF ANY KIND, either express or implied.

</DESCRIPTION>
<RELEASE_NOTES>

	V1.01: Corrected a bug that would cause a crash on unexpected data.
	V1.00: Initial release.

</RELEASE_NOTES>
<AUTHOR_URL>

	mailto:bart(at)hijwegen(dot)com

</AUTHOR_URL></AUTHOR_URL>

<HELP_URL>

	

</HELP_URL>




*************************************************************************************
*/

/* The decoder name as it will apear to the users of this script 
*/
function get_dec_name()
{
	return "SPI WIZnet W5100";
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
	return "Bart Hijwegen [sunnyhighway]";
}


/* Graphical user interface for this decoder
 */
function gui()  //graphical user interface
{
	ui_clear();  // clean up the User interface before drawing a new one.
	ui_add_ch_selector( "ch_mosi", "MOSI (Master Out)", "MOSI" );
	ui_add_ch_selector( "ch_miso", "MISO (Slave Out)", "MISO" );
	ui_add_ch_selector( "ch_clk", "SCK (Serial Clock)", "SCK" );
	ui_add_ch_selector( "ch_ss", "SS (Slave Select)", "SS" );
	ui_add_ch_selector( "ch_int", "Interrupt", "INT" );
	ui_add_ch_selector( "ch_reset", "Reset", "RESET" );
	ui_add_separator();
	ui_add_txt_combo( "opt_spi_mode", "SPI Mode" );
		ui_add_item_to_txt_combo( "Mode 0: (CPOL = 0) (CPHA = 0)", true );
		ui_add_item_to_txt_combo( "Mode 1: (CPOL = 0) (CPHA = 1) (Not supported)" );
		ui_add_item_to_txt_combo( "Mode 2: (CPOL = 1) (CPHA = 0) (Not supported)" );
		ui_add_item_to_txt_combo( "Mode 3: (CPOL = 1) (CPHA = 1)" );
	ui_add_txt_combo( "sspol", "Slave Select" );
		ui_add_item_to_txt_combo( "Is active low", true );
		ui_add_item_to_txt_combo( "Is active high" );
	ui_add_txt_combo( "intpol", "Interrupt" );
		ui_add_item_to_txt_combo( "Is active high" );
		ui_add_item_to_txt_combo( "Is active low", true );
	ui_add_separator();
	ui_add_info_label( "<b>View options:</b>" );
	ui_add_txt_combo( "n_to_decode", "Decode" );
		ui_add_item_to_txt_combo( "Only first 500 data words" );
		ui_add_item_to_txt_combo( "Only first 1000 data words" );
		ui_add_item_to_txt_combo( "Only first 5000 data words", true );
		ui_add_item_to_txt_combo( "Only first 10000 data words" );
		ui_add_item_to_txt_combo( "Only first 50000 data words" );
		ui_add_item_to_txt_combo( "Only first 100000 data words" );
		ui_add_item_to_txt_combo( "Only first 500000 data words" );
		ui_add_item_to_txt_combo( "Only first 1000000 data words" );
		ui_add_item_to_txt_combo( "Everything" );
	ui_add_txt_combo( "opt_decode_layer", "Decode SPI" );
		ui_add_item_to_txt_combo( "to HEX" );
		ui_add_item_to_txt_combo( "to commands", true );
}


/* Constants
 */
const OPT_DECODE_TO_HEX = 0;
const OPT_DECODE_TO_COMMANDS = 1;

const OPT_SPI_MODE_0 = 0;
const OPT_SPI_MODE_1 = 1;
const OPT_SPI_MODE_2 = 2;
const OPT_SPI_MODE_3 = 3;

const GET_SS = 0;
const GET_DATA = 10;

const OP_CODE_READ = 0;
const OP_CODE_WRITE = 1;
const OP_CODE_IGNORED = 2;

/* Global variables
 */
// packed header colors
var PKT_COLOR_OPCODE_READ;
var PKT_COLOR_OPCODE_WRITE;
var PKT_COLOR_OPCODE_IGNORED;
var PKT_COLOR_COMMON;
var PKT_COLOR_SOCKET;
var PKT_COLOR_TX_MEM;
var PKT_COLOR_RX_MEM;
var PKT_COLOR_INVALID;
var PKT_COLOR_INT_HEADER;

// packet data colors
var PKT_COLOR_DATA_MOSI;
var PKT_COLOR_DATA_MISO;
var PKT_COLOR_INT_DATA;


var clk_active;
var state = GET_SS;
var stop = false;
var n_words = 0;
var b;

var opt_decode_layer;
var opt_spi_mode;
var ch_mosi;
var ch_miso;
var ch_clk;
var ch_ss;
var ch_int;
var ch_reset;
var sspol;
var intpol;
var respol;

var t_ss_end;
var t_ss;
var t_clk;

var t_int_start;
var t_int_current;

var n_to_decode;

/* This is the function that will be called from ScanaStudio
 to update the decoded items
 */
function decode() {
	get_ui_vals();

	if (!check_scanastudio_support()) {
		add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
		return;
	}

	if (opt_spi_mode == OPT_SPI_MODE_0) {
		clk_active = 1;
	} else if (opt_spi_mode == OPT_SPI_MODE_1) {
		clk_active = 0;
	} else if (opt_spi_mode == OPT_SPI_MODE_2) {
		clk_active = 0;
	} else if (opt_spi_mode == OPT_SPI_MODE_3) {
		clk_active = 1;
	}

	if (n_to_decode == 0) {
		n_to_decode = 500;
	} else if (n_to_decode == 1) {
		n_to_decode = 1000;
	} else if (n_to_decode == 2) {
		n_to_decode = 5000;
	} else if (n_to_decode == 3) {
		n_to_decode = 10000;
	} else if (n_to_decode == 4) {
		n_to_decode = 50000;
	} else if (n_to_decode == 5) {
		n_to_decode = 100000;
	} else if (n_to_decode == 6) {
		n_to_decode = 50000;
	} else if (n_to_decode == 7) {
		n_to_decode = 100000;
	} else if (n_to_decode == 8) {
		n_to_decode = n_samples; // decode all the samples
	}

	decodeSPI();
	decodeReset();
	decodeInterrupt();
}

function decodeSPI() {
	var word_length = 32;

	PKT_COLOR_OPCODE_READ = dark_colors.green;
	PKT_COLOR_OPCODE_WRITE = dark_colors.orange;
	PKT_COLOR_OPCODE_IGNORED = dark_colors.red;

	PKT_COLOR_COMMON = dark_colors.black;
	PKT_COLOR_SOCKET = dark_colors.orange;
	PKT_COLOR_TX_MEM = dark_colors.blue;
	PKT_COLOR_RX_MEM = dark_colors.violet;
	PKT_COLOR_INVALID = dark_colors.red;

	PKT_COLOR_DATA_MOSI = get_ch_light_color(ch_mosi);
	PKT_COLOR_DATA_MISO = get_ch_light_color(ch_miso);

	// this initializes the iterator for that channel
	trs_get_first(ch_miso);
	trs_get_first(ch_mosi);

	t_ss_end = new transition(0, "not defined");
	t_ss = new transition(0, "not defined");
	t_clk = new transition(0, "not defined");

	do {
		if (abort_requested() == true) {
			return;
		}

		switch (state) {
			case GET_SS:
				if (t_ss.val == "not defined") {
					// HACK: to get the value of the first sample
					// set the value of sample 0 to the inverse of value of the first transition
					t_ss_end = trs_get_first(ch_ss);
					t_ss.val = (~t_ss_end.val) & 1;
				} else {
					t_ss = trs_get_next(ch_ss);
					t_ss_end = trs_get_next(ch_ss);
				}

				if( t_ss.val == sspol) {
					// add a box on the SS line
					dec_item_new(ch_ss, t_ss.sample, t_ss_end.sample);
					var clock_margin = get_clock_margin();

					// draw arrows on the SS line where the SCLK HIGH is valid.
					dec_item_add_sample_point(ch_ss, t_ss.sample + clock_margin, DRAW_ARROW_LEFT);      // becomes valid
					dec_item_add_sample_point(ch_ss, t_ss_end.sample - clock_margin, DRAW_ARROW_RIGHT); // becomes invalid
					dec_item_add_comment("valid SCLK");
				}

				// Read the CLK
				if (t_clk.val == "not defined") {
					t_clk = trs_get_first(ch_clk);
				}

				// go to the clock transition just after the start of the Slave Select signal
				while ((t_clk.sample < t_ss.sample) && trs_is_not_last(ch_clk)) {
					t_clk = trs_get_next(ch_clk);
				}

				state = GET_DATA;
				break;

			case GET_DATA:

				var data_mosi;
				var data_miso;
				var bits_read;
				data_mosi = 0;
				data_miso = 0;
				bits_read = 0;

				// Read data bits for a whole transfer
				while ((bits_read < (word_length * 2)) && (trs_is_not_last(ch_clk))) {
					if (t_clk.val != clk_active) {
						var bit_miso = sample_val(ch_miso, t_clk.sample);
						bits_read++;

						// Bits get shifted in MSB first
						data_miso = (data_miso << 1) + bit_miso;
						dec_item_add_sample_point(ch_miso, t_clk.sample, bit_miso ? DRAW_1 : DRAW_0);
					} else {
						var bit_mosi = sample_val(ch_mosi, t_clk.sample);
						bits_read++;

						// Bits get shifted in MSB first
						data_mosi = (data_mosi * 2) + bit_mosi;
						dec_item_add_sample_point(ch_mosi, t_clk.sample, bit_mosi ? DRAW_1 : DRAW_0);
					}

					t_clk = trs_get_next(ch_clk);


					// if we are out of the CS limits
					if (t_clk.sample > t_ss_end.sample) {
						break; // break out of this while loop
					}
				};
				
				//add a box on the CLK line (that's where the W5100 commands and relevant bits will be displayed)
				dec_item_new(ch_clk, t_ss.sample + clock_margin, t_ss_end.sample - clock_margin);
				dec_item_add_comment(comment(data_mosi, data_miso));

				var data_mosi_str = int_to_str_hex(data_mosi);
				var data_miso_str = int_to_str_hex(data_miso);

				// add a box on the MOSI line (that's where the W5100 MOSI bits and bytes will be displayed)
				dec_item_new(ch_mosi, t_ss.sample + clock_margin, t_ss_end.sample - clock_margin);
				dec_item_add_data(data_mosi);
				dec_item_add_comment(data_mosi_str);

				// add a box on the MISO line (that's where the W5100 MISO bits and bytes will be displayed)
				dec_item_new(ch_miso, t_ss.sample + clock_margin, t_ss_end.sample - clock_margin);
				dec_item_add_data(data_miso);
				dec_item_add_comment(data_miso_str);

				pkt_start("W5100");

				decodeW5100(data_mosi, data_miso);
				pkt_end();

				if ((n_words / n_to_decode) > (t_clk.sample / n_samples)) {
					set_progress(100 * n_words / n_to_decode);
				} else {
					set_progress(100 * t_clk.sample / n_samples);
				}

				if (t_clk.sample > t_ss_end.sample) {
					state = GET_SS;
				} else {
					state = GET_DATA;
				}

				n_words++;

				if (n_words >= n_to_decode) {
					stop = true;
				}

				break;
		}

	} while (trs_is_not_last(ch_clk) && trs_is_not_last(ch_ss) && (stop == false));
}


function decodeReset() {
	var PKT_COLOR_HEAD_RESET = get_ch_color(ch_reset);
	var PKT_COLOR_DATA_RESET = get_ch_light_color(ch_reset);
	const MICRO_SECONDS_PER_SECOND = 1000000;
	const MIN_RESET_CYCLE_TIME = 2; //microseconds

	// find the first transition
	var t_reset_start = trs_get_first(ch_reset);
	var t_reset_end = transition(0, 0);

	while (trs_is_not_last(ch_reset)) {
		if (t_reset_start.val == 0) {
			if (trs_is_not_last(ch_reset)) {
				t_reset_end = trs_get_next(ch_reset);
				dec_item_new(ch_reset, t_reset_start.sample, t_reset_end.sample);
				dec_item_add_sample_point(ch_reset, t_reset_start.sample, DRAW_ARROW_LEFT);
				dec_item_add_sample_point(ch_reset, t_reset_end.sample, DRAW_ARROW_RIGHT);

				var pulse_duration = (t_reset_end.sample - t_reset_start.sample) * (MICRO_SECONDS_PER_SECOND / sample_rate);
				var valid_reset = pulse_duration >= MIN_RESET_CYCLE_TIME;

				pkt_start("Reset");
				if (valid_reset) {
					dec_item_add_pre_text("Reset");
					dec_item_add_pre_text("Rst");
					dec_item_add_pre_text("R");
					pkt_add_item(t_reset_start.sample, t_reset_end.sample, "Reset", "Valid HW Reset (cold boot)", PKT_COLOR_HEAD_RESET, PKT_COLOR_DATA_RESET);
					// TODO: Add packet when we have a guaranteed PLOCK (20 ms after the reset pulse)
				} else {
					dec_item_add_pre_text("Ignored");
					dec_item_add_pre_text("Ign");
					dec_item_add_pre_text("I");
					// TODO: make the line below configurable or give a resume (we do not always want to show every reset button bounce)
					pkt_add_item(t_reset_start.sample, t_reset_end.sample, "Reset", "Ignored HW Reset", PKT_COLOR_HEAD_RESET, PKT_COLOR_DATA_RESET);
				}
				pkt_end();
			}
		}

		t_reset_start = trs_get_next(ch_reset);
	}
}

function decodeInterrupt() {

    PKT_COLOR_INT_HEADER = get_ch_color(ch_int);
    PKT_COLOR_INT_DATA = get_ch_light_color(ch_int);

	t_int_current = trs_get_first(ch_int);
	t_int_start = new transition(0, t_int_current.val==0?1:0);

    while ((trs_is_not_last(ch_int) != false)) {
        if (abort_requested() == true) {
            return false;
        }

        set_progress(100 * t_int_current.sample / n_samples);

		decodeInt();

		t_int_start = t_int_current;
		t_int_current = trs_get_next(ch_int);

    }

	decodeInt();
}

function comment(data_mosi, data_miso) {
	var temp = "";
	var op_code_raw = data_mosi >>> 24;
	var addr = data_mosi >>> 8 & 0xFFFF;
	var data = 0;

	switch (op_code_raw) {
		case 0x0F:
			data = data_miso & 0xFF;
			temp += "reading address: (0x" + addr.toString(16) + ") ";
			temp += "returned data: (0x" + data.toString(16) + ")";
			break;

		case 0xF0:
			data = data_mosi & 0xFF;
			temp += "writing address: (0x" + addr.toString(16) + ")  ";
			temp += "with data: (0x" + data.toString(16) + ")";
			break;

		default:
			temp += "Ignored";
			break;
	}

	return temp;
}

/*
 */
function int_to_str_hex (num) {
	var temp = "0x";

	if (num < 0x10)       {temp += "0";}
	if (num < 0x100)      {temp += "0";}
	if (num < 0x1000)     {temp += "0";}
	if (num < 0x10000)    {temp += "0";}
	if (num < 0x100000)   {temp += "0";}
	if (num < 0x1000000)  {temp += "0";}
	if (num < 0x10000000)  {temp += "0";}

	temp += num.toString(16).toUpperCase();

	return temp;
}


/*
 */
function check_scanastudio_support() {
	return typeof(pkt_start) != "undefined";
}


/*
 */
function get_ch_light_color (k) {
	var chColor = get_ch_color(k);

	chColor.r = (chColor.r + 255 * 3) / 4;
	chColor.g = (chColor.g + 255 * 3) / 4;
	chColor.b = (chColor.b + 255 * 3) / 4;

	return chColor;
}

function get_clock_margin() {
	// According to the W5100 SPI specs there must me at least a 21 ns delay between
	// the SCLK going HIGH and the a SS transition.
	var margin = 21; // nanoseconds
	const NANO_SECONDS_PER_SECOND = 1000000000;
	return ((margin * sample_rate) / NANO_SECONDS_PER_SECOND);
}

function decodeInt() {
	var state;

	if (t_int_current.val == intpol) {
		state = "Set";
		dec_item_new(ch_int, t_int_start.sample, t_int_current.sample);
		dec_item_add_pre_text("Interrupt Set");
		dec_item_add_pre_text("Interrupt");
		dec_item_add_pre_text("INT");
		dec_item_add_pre_text("I");
		var duration = (t_int_current.sample - t_int_start.sample) / 100;
		dec_item_add_comment("duration " + duration + " us");
		dec_item_add_sample_point(ch_int, t_int_current.sample, DRAW_ARROW_RIGHT);
	} else {
		state = "Cleared";
		dec_item_add_sample_point(ch_int, t_int_current.sample, DRAW_ARROW_LEFT);
	}

	pkt_start("INT");
	pkt_add_item(t_int_start.sample, t_int_current.sample, "Interrupt", state, PKT_COLOR_INT_HEADER, PKT_COLOR_INT_DATA, true);
	pkt_end();
}

/*
 */
function decodeW5100(data_mosi, data_miso) {
	var op_code_raw = data_mosi >>> 24;
	var op_code;
	var addr = data_mosi >>> 8 & 0xFFFF;
	var data = 0;

	switch (op_code_raw) {
		case 0x0F:
			op_code = OP_CODE_READ;
			data = data_miso & 0xFF;
			break;

		case 0xF0:
			op_code = OP_CODE_WRITE;
			data = data_mosi & 0xFF;
			break;

		default:
			op_code = OP_CODE_IGNORED;
			data = data_mosi & 0xFF;
			break;
	}

	switch (opt_decode_layer) {
		case OPT_DECODE_TO_HEX:
			decodeOpcodeHex(op_code_raw);
			decodeAddressHex(addr);
			decodeDataHex(op_code, data);
			break;

		case OPT_DECODE_TO_COMMANDS:
			decodeOpcode(op_code);
			decodeAddressType(op_code, addr, data);
			break;

	}
}

Number.prototype.between = function (first, last) {
	return (first < last ? this >= first && this <= last : this >= last && this <= first);
};

function printData(op_code, data, label) {
	switch (op_code) {
		case OP_CODE_READ:
			pkt_add_item(-1, -1, label, data, PKT_COLOR_OPCODE_READ, PKT_COLOR_DATA_MISO, true);
			break;
		case OP_CODE_WRITE:
			pkt_add_item(-1, -1, label, data, PKT_COLOR_OPCODE_WRITE, PKT_COLOR_DATA_MOSI, true);
			break;
	}
}

/*
*************************************************************************************
	Generic decoders
*************************************************************************************
*/

function decodeDataASCII(op_code, data){
	var temp = "";
	
	switch (data) {
		case 0:  temp = "NUL";   break;
		case 1:  temp = "SOH";   break;
		case 2:  temp = "STX";   break;
		case 3:  temp = "ETX";   break;
		case 4:  temp = "EOT";   break;
		case 5:  temp = "ENQ";   break;
		case 6:  temp = "ACK";   break;
		case 7:  temp = "BEL";   break;
		case 8:  temp = "BS";    break;
		case 9:  temp = "TAB";   break;
		case 10: temp = "LF";    break;
		case 11: temp = "VT";    break;
		case 12: temp = "FF";    break;
		case 13: temp = "CR";    break;
		case 14: temp = "SO";    break;
		case 15: temp = "SI";    break;
		case 16: temp = "DLE";   break;
		case 17: temp = "DC1";   break;
		case 18: temp = "DC2";   break;
		case 19: temp = "DC3";   break;
		case 20: temp = "DC4";   break;
		case 21: temp = "NAK";   break;
		case 22: temp = "SYN";   break;
		case 23: temp = "ETB";   break;
		case 24: temp = "CAN";   break;
		case 25: temp = "EM";    break;
		case 26: temp = "SUB";   break;
		case 27: temp = "ESC";   break;
		case 28: temp = "FS";    break;
		case 29: temp = "GS";    break;
		case 30: temp = "RS";    break;
		case 31: temp = "US";    break;
		case 32: temp = "Space"; break;
		default: temp = String.fromCharCode(data); break;
	}
	
	printData(op_code, "'" + temp + "'", "DATA");
}

function decodeOpcodeHex(op_code_raw) {
	var temp = "0x";

	if (op_code_raw < 0x10) {temp += "0";}

	temp += op_code_raw.toString(16).toUpperCase();
	pkt_add_item(-1, -1, "OP-Code", temp, PKT_COLOR_OPCODE_IGNORED, PKT_COLOR_DATA_MOSI, true);
}

function decodeDataHex(op_code, data) {
	var temp = "0x";

	if (data < 0x10) {temp += "0";}

	temp += data.toString(16).toUpperCase();
	printData(op_code, temp, "DATA");
}

function decodeAddressHex(addr) {
	var temp = "0x";

	if (addr < 0x10)   {temp += "0";}
	if (addr < 0x100)  {temp += "0";}
	if (addr < 0x1000) {temp += "0";}

	temp += addr.toString(16).toUpperCase();
	pkt_add_item(-1, -1, "ADDRESS", temp, get_ch_color(ch_mosi), PKT_COLOR_DATA_MOSI, true);
}

function decodeDataDec(op_code, data) {
	var temp = data.toString(10);
	printData(op_code, temp, "DATA");
}

function decodeDataBin(op_code, data) {
	var temp = "00000000" + data.toString(2);
	
	temp = temp.substring(temp.length - 8);
	temp = temp.substring(0, 4) + " " + temp.substring(4);
	printData(op_code, temp, "DATA");
}

function decodeDataBool(op_code, data, bit, label) {
	var mask = 1 << bit;
	var temp = ((data & mask) != 0);
	
	printData(op_code, temp.toString(), label);
}

// OpCode decoding
function decodeOpcode(op_code) {
	switch (op_code) {
		case OP_CODE_READ:
			pkt_add_item(-1, -1, "OP-Code", "READ", PKT_COLOR_OPCODE_READ, PKT_COLOR_DATA_MOSI, true);
			break;

		case OP_CODE_WRITE:
			pkt_add_item(-1, -1, "OP-Code", "WRITE", PKT_COLOR_OPCODE_WRITE, PKT_COLOR_DATA_MOSI, true);
			break;

		case OP_CODE_IGNORED:
			pkt_add_item(-1, -1, "OP-Code", "IGNORED", PKT_COLOR_OPCODE_IGNORED, PKT_COLOR_DATA_MOSI, true);
			break;
	}
}

/*
*************************************************************************************
	Common Register decoders
*************************************************************************************
*/

function decodeDataMR(op_code, data) {
	decodeDataBool(op_code, data, 7, "RST");
	decodeDataBool(op_code, data, 6, "Reserved");
	decodeDataBool(op_code, data, 5, "Reserved");
	decodeDataBool(op_code, data, 4, "PB");
	decodeDataBool(op_code, data, 3, "PPPoE");
	decodeDataBool(op_code, data, 2, "Not Used");
	decodeDataBool(op_code, data, 1, "AI");
	decodeDataBool(op_code, data, 0, "IND");
}

function decodeDataIR(op_code, data) {
	decodeDataBool(op_code, data, 7, "CONFLICT");
	decodeDataBool(op_code, data, 6, "UNREACH");
	decodeDataBool(op_code, data, 5, "PPPoE");
	decodeDataBool(op_code, data, 4, "Reserved");
	decodeDataBool(op_code, data, 3, "S3_INT");
	decodeDataBool(op_code, data, 2, "S2_INT");
	decodeDataBool(op_code, data, 1, "S1_INT");
	decodeDataBool(op_code, data, 0, "S0_INT");
}

function decodeDataIMR(op_code, data) {
	decodeDataBool(op_code, data, 7, "IM_IR7");
	decodeDataBool(op_code, data, 6, "IM_IR6");
	decodeDataBool(op_code, data, 5, "IM_IR5");
	decodeDataBool(op_code, data, 4, "Reserved");
	decodeDataBool(op_code, data, 3, "IM_IR3");
	decodeDataBool(op_code, data, 2, "IM_IR2");
	decodeDataBool(op_code, data, 1, "IM_IR1");
	decodeDataBool(op_code, data, 0, "IM_IR0");
}

function decodeDataRMSR(op_code, data) {
	const TOTAL_MEM = 8; // Max 8 KB
	var used_mem = 0;
	var s0_mem_size = 1 << ((data & 0x03) >> 0);
	var s1_mem_size = 1 << ((data & 0x0C) >> 2);
	var s2_mem_size = 1 << ((data & 0x30) >> 4);
	var s3_mem_size = 1 << ((data & 0xC0) >> 6);

	used_mem += s0_mem_size;
	s0_mem_size += " KB";
	if (used_mem > TOTAL_MEM) {
		s0_mem_size = "INVALID: " + s0_mem_size; // Will never happen in this universe.
	} else if (used_mem == TOTAL_MEM) {
		s1_mem_size = 0;
		s2_mem_size = 0;
		s3_mem_size = 0;
	}

	used_mem += s1_mem_size;
	s1_mem_size += " KB";
	if (used_mem > TOTAL_MEM) {
		s1_mem_size = "INVALID: " + s1_mem_size; // TODO: Check if this really invalid. (it could be interpreted as "all remeaning memory" or 0KB)
	} else if (used_mem == TOTAL_MEM) {
		s2_mem_size = 0;
		s3_mem_size = 0;
	}

	used_mem += s2_mem_size;
	s2_mem_size += " KB";
	if (used_mem > TOTAL_MEM) {
		s2_mem_size = "INVALID: " + s2_mem_size; // TODO: Check if this really invalid. (it could be interpreted as "all remeaning memory" or 0KB)
	} else if (used_mem == TOTAL_MEM) {
		s3_mem_size = 0;
	}

	used_mem += s3_mem_size;
	s3_mem_size += " KB";
	if (used_mem > TOTAL_MEM) {
		s3_mem_size = "INVALID: " + s3_mem_size; // TODO: Check if this really invalid. (it could be interpreted as "all remeaning memory" or 0KB)
	}

	printData(op_code, s3_mem_size, "Socket 3");
	printData(op_code, s2_mem_size, "Socket 2");
	printData(op_code, s1_mem_size, "Socket 1");
	printData(op_code, s0_mem_size, "Socket 0");
}

function decodeDataTMSR(op_code, data) {
	// Works the same as RMSR register
	decodeDataRMSR(op_code, data);
}

function decodeDataPTIMER(op_code, data) {
	const multiplier = 25; // each increment adds 25 ms
	
	printData(op_code, (data * multiplier).toString(10) + " ms", "PTIMER");
}

// Socket Register decoders
function decodeDataSn_MR(op_code, data) {
	const label = "Protocol";
	var temp = "";

	decodeDataBool(op_code, data, 7, "MULTI");
	decodeDataBool(op_code, data, 6, "MF");
	decodeDataBool(op_code, data, 5, "ND / MC");
	decodeDataBool(op_code, data, 4, "Reserved");
	
	switch (data &0x0F) {
		case 0:  temp = "Closed";   break;
		case 1:  temp = "TCP";      break;
		case 2:  temp = "UDP";      break;
		case 3:  temp = "IPRAW";    break;
		case 4:  temp = "MACRAW";   break;
		case 5:  temp = "PPPoE";    break;
		default: temp = "Reserved"; break;

	}
	
	printData(op_code, temp, label)
}

function decodeDataSn_CR(op_code, data) {
	const label = "Sn_CR";
	var temp = "";
	
	switch (data) {
		case 0x00: temp = "OK";        break;
		case 0x01: temp = "OPEN";      break;
		case 0x02: temp = "LISTEN";    break;
		case 0x04: temp = "CONNECT";   break;
		case 0x08: temp = "DISCON";    break;
		case 0x10: temp = "CLOSE";     break;
		case 0x20: temp = "SEND";      break;
		case 0x21: temp = "SEND_MAC";  break;
		case 0x22: temp = "SEND_KEEP"; break;
		case 0x40: temp = "RECV";      break;
		default:   temp = "Reserved";  break;
	}
	
	printData(op_code, temp, label);
}

function decodeDataSn_IR(op_code, data) {
	decodeDataBool(op_code, data, 7, "Reserved");
	decodeDataBool(op_code, data, 6, "Reserved");
	decodeDataBool(op_code, data, 5, "Reserved");
	decodeDataBool(op_code, data, 4, "SEND_OK");
	decodeDataBool(op_code, data, 3, "TIMEOUT");
	decodeDataBool(op_code, data, 2, "RECV");
	decodeDataBool(op_code, data, 1, "DISCON");
	decodeDataBool(op_code, data, 0, "CON");
}

function decodeDataSn_SR(op_code, data) {
	const label = "Sn_SR";
	var temp = "";
	
	switch (data) {
		case 0x00: temp = "SOCK_CLOSED";      break;
		case 0x13: temp = "SOCK_INIT";        break;
		case 0x14: temp = "SOCK_LISTEN";      break;
		case 0x17: temp = "SOCK_ESTABLISHED"; break;
		case 0x1C: temp = "SOCK_CLOSE_WAIT";  break;
		case 0x22: temp = "SOCK_UDP";         break;
		case 0x32: temp = "SOCK_IPRAW";       break;
		case 0x42: temp = "SOCK_MACRAW";      break;
		case 0x5F: temp = "SOCK_PPOE";        break;
		case 0x15: temp = "SOCK_SYNSENT";     break;
		case 0x16: temp = "SOCK_SYNRECV";     break;
		case 0x18: temp = "SOCK_FIN_WAIT";    break;
		case 0x1A: temp = "SOCK_CLOSING";     break;
		case 0x1B: temp = "SOCK_TIME_WAIT";   break;
		case 0x1D: temp = "SOCK_LAST_ACK";    break;
		case 0x01: temp = "SOCK_ARP";         break;
		default:   temp = "Reserved";         break;
	}
	
	printData(op_code, temp, label);
}

function decodeDataSn_PROTO (op_code, data) {
	// According to the IANA register
	// http://www.iana.org/assignments/protocol-numbers/protocol-numbers.xhtml
	const label = "PROTO";
	var temp;

	switch (data) {
		case 0:   temp = "HOPOPT";                        break;
		case 1:   temp = "ICMP";                          break;
		case 2:   temp = "IGMP";                          break;
		case 3:   temp = "GGP";                           break;
		case 4:   temp = "IPv4";                          break;
		case 5:   temp = "ST";                            break;
		case 6:   temp = "TCP";                           break;
		case 7:   temp = "CBT";                           break;
		case 8:   temp = "EGP";                           break;
		case 9:   temp = "IGP";                           break;
		case 10:  temp = "BBN-RCC-MON";                   break;
		case 11:  temp = "NVP-II";                        break;
		case 12:  temp = "PUP";                           break;
		case 13:  temp = "ARGUS";                         break;
		case 14:  temp = "EMCON";                         break;
		case 15:  temp = "XNET";                          break;
		case 16:  temp = "CHAOS";                         break;
		case 17:  temp = "UDP";                           break;
		case 18:  temp = "MUX";                           break;
		case 19:  temp = "DCN-MEAS";                      break;
		case 20:  temp = "HMP";                           break;
		case 21:  temp = "PRM";                           break;
		case 22:  temp = "XNS-IDP";                       break;
		case 23:  temp = "TRUNK-1";                       break;
		case 24:  temp = "TRUNK-2";                       break;
		case 25:  temp = "LEAF-1";                        break;
		case 26:  temp = "LEAF-2";                        break;
		case 27:  temp = "RDP";                           break;
		case 28:  temp = "IRTP";                          break;
		case 29:  temp = "ISO-TP4";                       break;
		case 30:  temp = "NETBLT";                        break;
		case 31:  temp = "MFE-NSP";                       break;
		case 32:  temp = "MERIT-INP";                     break;
		case 33:  temp = "DCCP";                          break;
		case 34:  temp = "3PC";                           break;
		case 35:  temp = "IDPR";                          break;
		case 36:  temp = "XTP";                           break;
		case 37:  temp = "DDP";                           break;
		case 38:  temp = "IDPR-CMTP";                     break;
		case 39:  temp = "TP++";                          break;
		case 40:  temp = "IL";                            break;
		case 41:  temp = "IPv6";                          break;
		case 42:  temp = "SDRP";                          break;
		case 43:  temp = "IPv6-Route";                    break;
		case 44:  temp = "IPv6-Frag";                     break;
		case 45:  temp = "IDRP";                          break;
		case 46:  temp = "RSVP";                          break;
		case 47:  temp = "GRE";                           break;
		case 48:  temp = "DSR";                           break;
		case 49:  temp = "BNA";                           break;
		case 50:  temp = "ESP";                           break;
		case 51:  temp = "AH";                            break;
		case 52:  temp = "I-NLSP";                        break;
		case 53:  temp = "SWIPE";                         break;
		case 54:  temp = "NARP";                          break;
		case 55:  temp = "MOBILE";                        break;
		case 56:  temp = "TLSP";                          break;
		case 57:  temp = "SKIP";                          break;
		case 58:  temp = "IPv6-ICMP";                     break;
		case 59:  temp = "IPv6-NoNxt";                    break;
		case 60:  temp = "IPv6-Opts";                     break;
		case 61:  temp = "any host internal protocol";    break;
		case 62:  temp = "CFTP";                          break;
		case 63:  temp = "any local network";             break;
		case 64:  temp = "SAT-EXPAK";                     break;
		case 65:  temp = "KRYPTOLAN";                     break;
		case 66:  temp = "RVD";                           break;
		case 67:  temp = "IPPC";                          break;
		case 68:  temp = "any distributed file system";   break;
		case 69:  temp = "SAT-MON";                       break;
		case 70:  temp = "VISA";                          break;
		case 71:  temp = "IPCV";                          break;
		case 72:  temp = "CPNX";                          break;
		case 73:  temp = "CPHB";                          break;
		case 74:  temp = "WSN";                           break;
		case 75:  temp = "PVP";                           break;
		case 76:  temp = "BR-SAT-MON";                    break;
		case 77:  temp = "SUN-ND";                        break;
		case 78:  temp = "WB-MON";                        break;
		case 79:  temp = "WB-EXPAK";                      break;
		case 80:  temp = "ISO-IP";                        break;
		case 81:  temp = "VMTP";                          break;
		case 82:  temp = "SECURE-VMTP";                   break;
		case 83:  temp = "VINES";                         break;
//		case 84:  temp = "TTP";                           break; // FIXME: The iana.org documentation is dubious here.
//		case 84:  temp = "IPTM";                          break; // FIXME: The iana.org documentation is dubious here.
		case 84:  temp = "TTP / IPTM";                    break; // FIXME: And this is what i came up with.
		case 85:  temp = "NSFNET-IGP";                    break;
		case 86:  temp = "DGP";                           break;
		case 87:  temp = "TCF";                           break;
		case 88:  temp = "EIGRP";                         break;
		case 89:  temp = "OSPFIGP";                       break;
		case 90:  temp = "Sprite-RPC";                    break;
		case 91:  temp = "LARP";                          break;
		case 92:  temp = "MTP";                           break;
		case 93:  temp = "AX.25";                         break;
		case 94:  temp = "IPIP";                          break;
		case 95:  temp = "MICP";                          break;
		case 96:  temp = "SCC-SP";                        break;
		case 97:  temp = "ETHERIP";                       break;
		case 98:  temp = "ENCAP";                         break;
		case 99:  temp = "any private encryption scheme"; break;
		case 100: temp = "GMTP";                          break;
		case 101: temp = "IFMP";                          break;
		case 102: temp = "PNNI";                          break;
		case 103: temp = "PIM";                           break;
		case 104: temp = "ARIS";                          break;
		case 105: temp = "SCPS";                          break;
		case 106: temp = "QNX";                           break;
		case 107: temp = "A/N";                           break;
		case 108: temp = "IPComp";                        break;
		case 109: temp = "SNP";                           break;
		case 110: temp = "Compaq-Peer";                   break;
		case 111: temp = "IPX-in-IP";                     break;
		case 112: temp = "VRRP";                          break;
		case 113: temp = "PGM";                           break;
		case 114: temp = "any 0-hop protocol";            break;
		case 115: temp = "L2TP";                          break;
		case 116: temp = "DDX";                           break;
		case 117: temp = "IATP";                          break;
		case 118: temp = "STP";                           break;
		case 119: temp = "SRP";                           break;
		case 120: temp = "UTI";                           break;
		case 121: temp = "SMP";                           break;
		case 122: temp = "SM";                            break;
		case 123: temp = "PTP";                           break;
		case 124: temp = "ISIS over IPv4";                break;
		case 125: temp = "FIRE";                          break;
		case 126: temp = "CRTP";                          break;
		case 127: temp = "CRUDP";                         break;
		case 128: temp = "SSCOPMCE";                      break;
		case 129: temp = "IPLT";                          break;
		case 130: temp = "SPS";                           break;
		case 131: temp = "PIPE";                          break;
		case 132: temp = "SCTP";                          break;
		case 133: temp = "FC";                            break;
		case 134: temp = "RSVP-E2E-IGNORE";               break;
		case 135: temp = "Mobility Header";               break;
		case 136: temp = "UDPLite";                       break;
		case 137: temp = "MPLS-in-IP";                    break;
		case 138: temp = "manet";                         break;
		case 139: temp = "HIP";                           break;
		case 140: temp = "Shim6";                         break;
		case 141: temp = "WESP";                          break;
		case 142: temp = "ROHC";                          break;
		case 253: temp = "Expirimental Use";              break; // Experimental[sic] Use
		case 254: temp = "Expirimental Use";              break; // Experimental[sic] Use
		case 255: temp = "Reserved";                      break;
		default:  temp = "Unassigned";                    break;
	}

	printData(op_code, temp, label);
}

function decodeData(op_code, data, dec) {
	switch (dec) {
		case "BIN":      decodeDataBin(op_code, data);      break;
		case "DEC":      decodeDataDec(op_code, data);      break;
		case "HEX":      decodeDataHex(op_code, data);      break;
		case "ASCII":    decodeDataASCII(op_code, data);    break;
		case "MR":       decodeDataMR(op_code, data);       break;
		case "IR":       decodeDataIR(op_code, data);       break;
		case "IMR":      decodeDataIMR(op_code, data);      break;
		case "RMSR":     decodeDataRMSR(op_code, data);     break;
		case "TMSR":     decodeDataTMSR(op_code, data);     break;
		case "PTIMER":   decodeDataPTIMER(op_code, data);   break;
		case "Sn_MR":    decodeDataSn_MR(op_code, data);    break;
		case "Sn_CR":    decodeDataSn_CR(op_code, data);    break;
		case "Sn_IR":    decodeDataSn_IR(op_code, data);    break;
		case "Sn_SR":    decodeDataSn_SR(op_code, data);    break;
		case "Sn_PROTO": decodeDataSn_PROTO(op_code, data); break;
	}
}

function decodeAddressType(op_code, addr, data) {
	if (addr.between(0x0000, 0x0029)) {decodeCommonRegisters(op_code, addr, data);}
	if (addr.between(0x0030, 0x03FF)) {decodeReservedMemory(op_code, addr, data);}
	if (addr.between(0x0400, 0x07FF)) {decodeSocketRegisters(op_code, addr, data);}
	if (addr.between(0x0800, 0x3FFF)) {decodeReservedMemory(op_code, addr, data);}
	if (addr.between(0x4000, 0x5FFF)) {decodeMemory(op_code, addr, data, "TX memory");}
	if (addr.between(0x6000, 0x7FFF)) {decodeMemory(op_code, addr, data, "RX memory");}
	if (addr.between(0x8000, 0xFFFF)) {decodeReservedMemory(op_code, addr, data);}
}

function decodeCommonRegisters(op_code, addr, data) {
	const type = "Common Register";
	var reg = "Reserved";
	var dec = "";
	
	switch (addr) {
		case 0x0000: reg = "MR";     dec = "MR";     break;
		case 0x0001: reg = "GAR0";   dec = "DEC";    break;
		case 0x0002: reg = "GAR1";   dec = "DEC";    break;
		case 0x0003: reg = "GAR2";   dec = "DEC";    break;
		case 0x0004: reg = "GAR3";   dec = "DEC";    break;
		case 0x0005: reg = "SUBR0";  dec = "DEC";    break;
		case 0x0006: reg = "SUBR1";  dec = "DEC";    break;
		case 0x0007: reg = "SUBR2";  dec = "DEC";    break;
		case 0x0008: reg = "SUBR3";  dec = "DEC";    break;
		case 0x0009: reg = "SHAR0";  dec = "HEX";    break;
		case 0x000A: reg = "SHAR1";  dec = "HEX";    break;
		case 0x000B: reg = "SHAR2";  dec = "HEX";    break;
		case 0x000C: reg = "SHAR3";  dec = "HEX";    break;
		case 0x000D: reg = "SHAR4";  dec = "HEX";    break;
		case 0x000E: reg = "SHAR5";  dec = "HEX";    break;
		case 0x000F: reg = "SIPR0";  dec = "DEC";    break;
		case 0x0010: reg = "SIPR1";  dec = "DEC";    break;
		case 0x0011: reg = "SIPR2";  dec = "DEC";    break;
		case 0x0012: reg = "SIPR3";  dec = "DEC";    break;
		// Reserved 0x0013 - 0x0014
		case 0x0015: reg = "IR";     dec = "IR";     break;
		case 0x0016: reg = "IMR";    dec = "IMR";    break;
		case 0x0017: reg = "RTR0";   dec = "HEX";    break;
		case 0x0018: reg = "RTR1";   dec = "HEX";    break;
		case 0x0019: reg = "RCR";    dec = "DEC";    break;
		case 0x001A: reg = "RMSR";   dec = "RMSR";   break;
		case 0x001B: reg = "TMSR";   dec = "TMSR";   break;
		case 0x001C: reg = "PATR0";  dec = "HEX";    break;
		case 0x001D: reg = "PATR1";  dec = "HEX";    break;
		// Reserved 0x001F - 0x0027
		case 0x0028: reg = "PTIMER"; dec = "PTIMER"; break;
		case 0x0029: reg = "PMAGIC"; dec = "HEX";    break;
		case 0x002A: reg = "UIPR0";  dec = "DEC";    break;
		case 0x002B: reg = "UIPR1";  dec = "DEC";    break;
		case 0x002C: reg = "UIPR2";  dec = "DEC";    break;
		case 0x002D: reg = "UIPR3";  dec = "DEC";    break;
		case 0x002E: reg = "UPORT0"; dec = "HEX";    break;
		case 0x002F: reg = "UPORT1"; dec = "HEX";    break;
	}
	
	pkt_add_item(-1, -1, type, reg, PKT_COLOR_COMMON, PKT_COLOR_DATA_MOSI, true);
	decodeData(op_code, data, dec);
}

function decodeSocketRegisters(op_code, addr, data) {
	const type = "Socket Register";
	var socket;
	var reg = "Reserved";
	var dec = "HEX";

	if (addr.between(0x0400, 0x04FF)) socket = "S0_";
	if (addr.between(0x0500, 0x05FF)) socket = "S1_";
	if (addr.between(0x0600, 0x06FF)) socket = "S2_";
	if (addr.between(0x0700, 0x07FF)) socket = "S3_";

	switch (addr & 0x3F) {
		case 0x00: reg = "MR";      dec = "Sn_MR";    break;
		case 0x01: reg = "CR";      dec = "Sn_CR";    break;
		case 0x02: reg = "IR";      dec = "Sn_IR";    break;
		case 0x03: reg = "SR";      dec = "Sn_SR";    break;
		case 0x04: reg = "PORT0";   dec = "HEX";      break;
		case 0x05: reg = "PORT1";   dec = "HEX";      break;
		case 0x06: reg = "DHARD0";  dec = "HEX";      break;
		case 0x07: reg = "DHARD1";  dec = "HEX";      break;
		case 0x08: reg = "DHARD2";  dec = "HEX";      break;
		case 0x09: reg = "DHARD3";  dec = "HEX";      break;
		case 0x0A: reg = "DHARD4";  dec = "HEX";      break;
		case 0x0B: reg = "DHARD5";  dec = "HEX";      break;
		case 0x0C: reg = "DIPR0";   dec = "DEC";      break;
		case 0x0D: reg = "DIPR1";   dec = "DEC";      break;
		case 0x0E: reg = "DIPR2";   dec = "DEC";      break;
		case 0x0F: reg = "DIPR3";   dec = "DEC";      break;
		case 0x10: reg = "DPORT0";  dec = "DEC";      break;
		case 0x11: reg = "DPORT1";  dec = "DEC";      break;
		case 0x12: reg = "MSSR0";   dec = "HEX";      break;
		case 0x13: reg = "MSSR1";   dec = "HEX";      break;
		case 0x14: reg = "PROTO";   dec = "Sn_PROTO"; break;
		case 0x15: reg = "TOS";     dec = "DEC";      break;
		case 0x16: reg = "TTL";     dec = "DEC";      break;
		// Reserved 0x417 - 0x0419, 0x0517 - 0x0519, 0x0617 - 0x0619, 0x0717 - 0x0719
		case 0x20: reg = "TX_FSR0"; dec = "HEX";      break;
		case 0x21: reg = "TX_FSR1"; dec = "HEX";      break;
		case 0x22: reg = "TX_RD0";  dec = "HEX";      break;
		case 0x23: reg = "TX_RD1";  dec = "HEX";      break;
		case 0x24: reg = "TX_WR0";  dec = "HEX";      break;
		case 0x25: reg = "TX_WR1";  dec = "HEX";      break;
		case 0x26: reg = "RX_RSR0"; dec = "HEX";      break;
		case 0x27: reg = "RX_RSR1"; dec = "HEX";      break;
		case 0x28: reg = "RX_RD0";  dec = "HEX";      break;
		case 0x29: reg = "RX_RD1";  dec = "HEX";      break;
		// Reserved 0x42A - 0x04FF, 0x052A - 0x05FF, 0x062A - 0x06FF, 0x072A - 0x07FF
	}
	
	pkt_add_item(-1, -1, type, socket + reg, PKT_COLOR_SOCKET, PKT_COLOR_DATA_MOSI, true);
	decodeData(op_code, data, dec);
}

function decodeMemory(op_code, addr, data, type) {
	var temp = "0x";

	if (addr < 0x10) {
		temp += "0";
	}
	if (addr < 0x100) {
		temp += "0";
	}
	if (addr < 0x1000) {
		temp += "0";
	}

	temp += addr.toString(16).toUpperCase();
	if (op_code == OP_CODE_READ) {
		pkt_add_item(-1, -1, type, temp, PKT_COLOR_RX_MEM, PKT_COLOR_DATA_MOSI, true);
	} else {
		pkt_add_item(-1, -1, type, temp, PKT_COLOR_TX_MEM, PKT_COLOR_DATA_MOSI, true);
	}
	
	decodeData(op_code, data, "ASCII");
}

function decodeReservedMemory(op_code, addr, data) {
	decodeAddressHex(addr);
	decodeDataHex(op_code, data);
}











