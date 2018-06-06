/*
*************************************************************************************
							SCANASTUDIO 2 SSI DECODER

<DESCRIPTION>

	Synchronous Serial Interface is a widely used serial interface standard for 
	industrial applications between a master and a slave

</DESCRIPTION>

<RELEASE_NOTES>

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
	return "SSI";
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
	return "IKALOGIC";
}

/*
*************************************************************************************
							    GLOBAL VARIABLES
*************************************************************************************
*/

var SSI_TP_MIN_US = 25

var samples_per_us;
var samples_per_bit;
var ssi_trig_steps = [];
var gen_bit_rate;
var gen_bit_word;

function SsiTrigStep (data, clk)
{
	this.data = data;
	this.clk  = clk;
};

function SsiObject (value, start, end)
{
	this.value = value;
	this.start = start;
	this.end = end;
};

/*
*************************************************************************************
								   DECODER
*************************************************************************************
*/

function gui()
{
	ui_clear();

	ui_add_ch_selector("ch_data", "DATA Line", "DATA");
	ui_add_ch_selector("ch_clk", "CLOCK Line", "CLK");

	ui_add_txt_combo("words_to_decode", "Decode");
		ui_add_item_to_txt_combo("Only first 500 data words");
		ui_add_item_to_txt_combo("Only first 1000 data words");
		ui_add_item_to_txt_combo("Only first 5000 data words", true);
		ui_add_item_to_txt_combo("Only first 10000 data words");
		ui_add_item_to_txt_combo("Everything");

	ui_add_separator();

	ui_add_info_label("PacketView Options", true);

	ui_add_txt_combo("pkt_view_mode", "View mode:");
		ui_add_item_to_txt_combo("Group data of the same transaction", true);
		ui_add_item_to_txt_combo("Present each byte separately"); 
}

function decode()
{
	get_ui_vals();

	switch (words_to_decode)
	{
		case 0:  words_to_decode = 500;   break;
		case 1:  words_to_decode = 1000;  break;
		case 2:  words_to_decode = 5000;  break;
		case 3:  words_to_decode = 10000; break;
		default: words_to_decode = n_samples; break;
	}

	var stop = false;
	var t_data = trs_get_first(ch_data);
	var t_clk  = trs_get_first(ch_clk);
	var t_clk_prev = t_clk;
	var words_decoded = 0;
	var last_bit   = false;
	var data_bits  = [];
	var data_start = false;
	var data_end   = false;
	var data_byte = 0;

	t_clk = trs_get_next(ch_clk);

	if (t_clk.val != FALLING)
	{
		t_clk = trs_get_next(ch_clk);
	}

	while (trs_is_not_last(ch_clk) && stop != true)
	{
		if (abort_requested())
		{
			stop = true;
		}

		last_bit = false;
		data_start = false;
		data_end = false;
		data_bits.length = 0;
		data_byte = 0;

		t_clk = trs_get_next(ch_clk);
		data_start = t_clk.sample;
		t_clk = trs_get_next(ch_clk);

		while (last_bit != true && stop != true)
		{
			if (t_clk.val == FALLING)
			{
				var bit = sample_val(ch_data, t_clk.sample);
				data_bits.unshift(bit);
				dec_item_add_sample_point(ch_data, t_clk.sample, bit);
			}

			t_clk_prev = t_clk;
			t_clk = trs_get_next(ch_clk);

			if (get_tr_diff_us(t_clk_prev, t_clk) >= SSI_TP_MIN_US)
			{
				var data_word = 0;

				last_bit = true;
				data_end = t_clk_prev.sample;

				for (i = 0; i < data_bits.length; i++)
				{
					if (data_bits[i])
					{
						data_word |= (1 << i);
					}
				}

				dec_item_new(ch_data, data_start, data_end);
				dec_item_add_data(data_word);

				pkt_start("SSI");
				pkt_add_item(data_start, data_end, "SSI DATA", int_to_str_hex(data_word), get_ch_color(ch_data), get_ch_light_color(ch_data), true, ch_data);
				pkt_end();

				for (i = 0; i < (data_bits.length / 8); i++)
				{
					data_byte = (data_word & 0xFF);						
					hex_add_byte(ch_data, -1, -1, data_byte);
					data_byte = data_byte << 8;
				}

				words_decoded++;

				if (words_decoded > words_to_decode)
				{	
					stop = true;
				}
			}

			if (!trs_is_not_last(ch_clk))
			{
				stop = true;
				data_end = n_samples;

				dec_item_new(ch_data, data_start, data_end);
				dec_item_add_data(data_word);

				pkt_start("SSI");
				pkt_add_item(data_start, data_end, "SSI DATA", int_to_str_hex(data_word), get_ch_color(ch_data), dark_colors.red, true, ch_data);
				pkt_end();

				var data_byte = 0;

				for (i = 0; i < (data_bits.length / 8); i++)
				{
					data_byte = (data_word & 0xFF);						
					hex_add_byte(ch_data, -1, -1, data_byte);
					data_byte = data_byte << 8;
				}
			}
		}
	}
}

/*
*************************************************************************************
							    SIGNAL GENERATOR
*************************************************************************************
*/

function generator_template()
{
	//	Configuration part : !! Configure this part !!
	//	Do not change variables names

	ch_data = 0; 				// DATA on CH1
	ch_clk  = 1;				// CLK on CH2

	gen_bit_word = 8; 	    	// Bits per word
	gen_bit_rate = 1000000; 	// Bit rate in Hz

	ssi_gen_init();

	// Signal generation part !! Change this part according to your application !!

	gen_add_delay(get_samples_for_us(50));

	for (var i = 0; i < 10; i++)
	{
		gen_add_word(i);
		gen_add_delay(get_samples_for_us(50));
	}
}

/*
*************************************************************************************
							     DEMO BUILDER
*************************************************************************************
*/

function build_demo_signals()
{
	var demo_cnt = 0;
	var scanastudio_version_maj = Number(get_scanastudio_version().split(".")[0]) + (get_scanastudio_version().split(".")[1] / 1000);
	var tp = get_samples_for_us(50);

	gen_bit_rate = 100000;   // Hz

	ssi_gen_init();
	gen_add_delay(tp);

	while (get_samples_acc(ch_clk) < n_samples)
	{
		if (scanastudio_version_maj > 2.4)
		{
			set_progress(get_samples_acc(ch_clk) * 100 / n_samples);
		}

		gen_add_word(demo_cnt);
		gen_add_delay(tp);

		demo_cnt++;

		if (demo_cnt > 0xFF)
		{
			demo_cnt = 0;
		}
	}
}

function ssi_gen_init()
{
	gen_bit_word = 8;
	samples_per_bit = get_srate() / gen_bit_rate;

	if (samples_per_bit < 2)
	{
		add_to_err_log("SSI generator Bit rate too high compared to device sampling rate");
	}
}

function gen_add_word (value)
{
	var bit = 0;
	var bit_arr = [];

	for (i = 0; i < gen_bit_word; i++)
	{
		bit = ((value >> i) & 1);
		bit_arr.unshift(bit);
	}

	add_samples(ch_clk,  0, samples_per_bit);
	add_samples(ch_data, 1, samples_per_bit);
	add_samples(ch_clk,  1, samples_per_bit);
	add_samples(ch_data, 1, samples_per_bit);

	for (i = 0; i < bit_arr.length; i++)
	{
		bit = bit_arr[i];

		add_samples(ch_clk, 0, samples_per_bit);
		add_samples(ch_data, bit, samples_per_bit);

		add_samples(ch_clk, 1, samples_per_bit);
		add_samples(ch_data, bit, samples_per_bit);
	}
}

function gen_add_delay (value)
{
	add_samples(ch_data, 1, value);
	add_samples(ch_clk,  1, value);
}

/*
*************************************************************************************
							       TRIGGER
*************************************************************************************
*/

function trig_gui()
{
	trig_ui_clear();

	trig_ui_add_alternative("alt_any_word", "Trigger on a any word", true);
		trig_ui_add_label("lab2", "All text fields can accept decimal value (65), hex value (0x41) or ASCII character ('A')<br> Number of bits per word must be greater than or equal to 1<br>");
		trig_ui_add_label("lab0", "Trigger on any SSI byte");
		trig_ui_add_free_text("bits_word", "Bits per word: ");

	trig_ui_add_alternative("alt_specific_word", "Trigger on word value", false);
		trig_ui_add_label("lab2", "All text fields can accept decimal value (65), hex value (0x41) or ASCII character ('A')<br> Bits per word must be greater than or equal to 1<br>");
		trig_ui_add_free_text("trig_word", "Trigger byte value: ");
		trig_ui_add_free_text("bits_word", "Bits per word: ");
}

function trig_seq_gen()
{
	var i, k;
	var ssi_step = {data: "X", clk: "X"};
	var summary_text = "";

	flexitrig_set_async_mode(false);
	get_ui_vals();

	if (bits_word <= 0)
	{
		return;
	}

	ssi_trig_steps.length = 0;

	if (alt_any_word)
	{
		summary_text = "Trig on any SSI byte"
	}
	else if (alt_specific_word)
	{
		trig_word = Number(trig_word);
		summary_text = "Trig on SSI byte: 0x" + trig_word.toString(16);
	}

	if (alt_any_word || alt_specific_word)
	{
		spi_step.clk  = "F";
		spi_step.clk  = "R";

		for (i = bits_word; i >= 0; i--)
		{
			if (alt_specific_word)
			{
				spi_step.data = ((trig_word >> i) & 0x1).toString();
			}

			ssi_trig_steps.push(new SpiTrigStep(spi_step.data, spi_step.clk));
		}
	}

	flexitrig_clear();

	for (i = 0; i < ssi_trig_steps.length; i++)
	{
		flexitrig_append(trig_build_step(ssi_trig_steps[i]), -1, -1);
	}

	flexitrig_set_summary_text(summary_text);
	// flexitrig_print_steps();
}

function trig_build_step (step_desc)
{
	var step = "";

	for (i = 0; i < get_device_max_channels(); i++)
	{
		switch (i)
		{
			case ch_data: step = step_desc.data + step; 
			break;

			case ch_clk: step = step_desc.clk + step; 
			break;

			default: step = "X" + step; 
			break;
		}
	}

	return step;
}

/*
*************************************************************************************
							        UTILS
*************************************************************************************
*/

function int_to_str_hex (num)
{
	var result = "";
	var prefix = ""
	var nibbles = 0;

	if (num <= 0xFF)
	{
		nibbles = 2;
	}
	else
	{
		nibbles = 4;
	}

	for (i = 0; i < nibbles; i++)
	{
		prefix += "0";
	}

	result = (prefix + num.toString(16).toUpperCase()).substr((-1 * nibbles));
	return result;
}

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

/*  Get number of samples for the specified duration in microseconds
*/
function get_samples_for_us (us)
{
	return ((us * get_srate()) / 1000000);
}

/* Get time difference in microseconds between two transitions
*/
function get_tr_diff_us (tr1, tr2)
{
	var diff;

	if (tr1.sample > tr2.sample)
	{
		diff = (((tr1.sample - tr2.sample) * 1000000) / sample_rate);
	}
	else
	{
		diff = (((tr2.sample - tr1.sample) * 1000000) / sample_rate);
	}

	return diff
}

/* Get next transition with falling edge
*/
function get_next_falling_edge (ch, trSt)
{
	var tr = trSt;

	while ((tr.val != FALLING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);
	}

	if (trs_is_not_last(ch) == false)
	{		
		tr = false;
	}

	return tr;
}

/*	Get next transition with rising edge
*/
function get_next_rising_edge (ch, trSt)
{
	var tr = trSt;

	while ((tr.val != RISING) && (trs_is_not_last(ch) == true))
	{
		tr = trs_get_next(ch);
	}

	if (trs_is_not_last(ch) == false)
	{		
		tr = false;
	}

	return tr;
}
