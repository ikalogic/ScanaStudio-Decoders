/*
*************************************************************************************

							SCANASTUDIO 2 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	I2C Temperature Sensors and Humidity Sensors decoder. Supported sensors : SHT20, SHT21, SHT25, STS21, HTU21A, HTU20D, HTU21D, HTU_3800, Si7006_A10, Si7020_A10, Si7021_A10, Si7013_A10

</DESCRIPTION>

<RELEASE_NOTES>

	V1.36: Fix SHT2X temp and hum values calculation. Fix PacketView.
	V1.35: Fix missing PacketView vars initialization
	V1.34: Add light packet capabilities
	V1.33: Prevented incompatible workspaces from using the decoder
	V1.32: Now the decoding can be aborted
	V1.31: Corrected some spelling mistakes
	V1.3:  Bug correction when SDA and SCL are inverted
	V1.2:  Bug correction
	V1.1:  Correction PacketView
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
	return "I2C Temperature and Humidity Sensors";
}

/* The decoder version 
*/
function get_dec_ver()
{
	return "1.36";
}

/* Author 
*/
function get_dec_auth()
{
	return "IKALOGIC";
}

/* Graphical user interface for this decoder 
*/
function gui()
{
	ui_clear();
			
	if ((typeof(get_device_max_channels) == 'function') && (typeof(get_device_name) == 'function'))
	{
		if( get_device_max_channels() < 2 )
		{
			ui_add_info_label("This device (or workspace configuration) do not have enough channels for this decoder to operate properly");
			return;
		}
	}
	else
	{
		ui_add_info_label("error", "Please update your ScanaStudio software to use this decoder version");
		return;
	}

	ui_add_ch_selector("chSda", "(SDA) Serial Data", "SDA");
	ui_add_ch_selector("chScl", "(SCL) Serial Clock", "SCL");

	ui_add_txt_combo("res", "Bit resolution")
		ui_add_item_to_txt_combo("RH : 12 and T : 14"),
		ui_add_item_to_txt_combo("RH : 11 and T : 11"),
		ui_add_item_to_txt_combo("RH : 10 and T : 13"),
		ui_add_item_to_txt_combo("RH : 8 and T : 12"),

	ui_add_txt_combo("uiDevice", "Device");

	for (var k in DEVICE_TABLE)
    {
        var dev = DEVICE_TABLE[k];

        if (k == 0)
        {
            ui_add_item_to_txt_combo(dev.str, true);
        }
        else
        {
            ui_add_item_to_txt_combo(dev.str);
        }
    }
}

var DEVICE_TABLE =
{
	SHT20	    :	{uiId: 0,  code: 0x40,  grp: 1,  str: "SHT20"},
	SHT21	    :	{uiId: 1,  code: 0x40,  grp: 1,  str: "SHT21"},
	SHT25	    :	{uiId: 2,  code: 0x40,  grp: 1,  str: "SHT25"},
	STS21	    :	{uiId: 3,  code: 0x4A,  grp: 1,  str: "STS21"},
	HTU21A      :	{uiId: 4,  code: 0x40,  grp: 1,  str: "HTU21A"},
	HTU20D      :	{uiId: 5,  code: 0x40,  grp: 1,  str: "HTU20D"},
	HTU21D      :	{uiId: 6,  code: 0x40,  grp: 1,  str: "HTU21D"},
	HTU_3800	:	{uiId: 7,  code: 0x40,  grp: 1,  str: "HTU_3800"},
	Si7006_A10 	:	{uiId: 8,  code: 0x40,  grp: 1,  str: "Si7006"},
	Si7020_A10 	:	{uiId: 9,  code: 0x40,  grp: 1,  str: "Si7020"},
	Si7021_A10 	:	{uiId: 10, code: 0x40,  grp: 1,  str: "Si7021"},
	Si7013_A10  :   {uiId: 11, code: 0x40,  grp: 2,  str: "Si7013"}
}

var I2C_CMD = 
{
	T_MEASURE_HM 	: 0xE3,
	RH_MEASURE_HM 	: 0xE5,
	T_MEASURE_noHM 	: 0xF3,
	RH_MEASURE_noHM :0xF5,
	WRITE_REGISTER 	: 0xE6,
	READ_REGISTER 	: 0XE7,
	SOFT_RESET 		: 0xFE,
	MEASURE_ANOLOG_VOLTAGE_OR_THERMISTOR_TEMERATURE 	: 0xEE,
	READ_TEMPERATURE_VALUE_FROM_PREVIOUS_RH_MEASUREMENT : 0xE0,
	WRITE_VOLTAGE_MEASUREMENT_SETUP : 0x50,
	READ_VOLTAGE_MEASUREMENT_SETUP	: 0x10,
	WRITE_HEATER_SETUP : 0x51,
	READ_HEATER_SETUP  : 0x11,
	WRITE_THERMISTOR_CORREC_COEF	: 0xC5,
	READ_THERMISTOR_CORREC_COEF		: 0x84,
	READ_ELECTRONIC_ID_1ST_BYTE_MSB : 0xFA,
	READ_ELECTRONIC_ID_1ST_BYTE_LSB : 0x0F,
	READ_ELECTRONIC_ID_2ND_BYTE_MSB : 0xFC,
	READ_ELECTRONIC_ID_2ND_BYTE_LSB : 0xC9,
	READ_FIRMWARE_REVISION_MSB		: 0x84,
	READ_FIRMWARE_REVISION_LSB		: 0xB8,
};

var device_write;
var device_read;
var objCnt;
var decBuf;
var I2Cdata;
var Device;
var noACK = false;
var start_packet = true;
var last_end_state = false;
var tmp_int = 0;
var before_data = false;
var RH = false;
var T = false;
var Register = false;
var temp_1st_byte = true;
var Temp_MSB;
var Temp_LSB;

var PKT_COLOR_DATA;
var PKT_COLOR_DATA_TITLE;
var PKT_COLOR_START_TITLE;
var PKT_COLOR_ADR_TITLE;
var PKT_COLOR_ACK_TITLE;
var PKT_COLOR_NACK_TITLE;
var PKT_COLOR_STOP_TITLE;
var PKT_COLOR_NOISE_TITLE;
var PKT_COLOR_COMMAND_TITLE;

function decode()
{
	get_ui_vals();			// Update the content of all user interface related variables
	clear_dec_items();		// Clears all the the decoder items and its content

	PKT_COLOR_DATA          = get_ch_light_color(chSda);
	PKT_COLOR_DATA_TITLE    = dark_colors.gray;
	PKT_COLOR_START_TITLE   = dark_colors.orange;
	PKT_COLOR_ADR_TITLE     = dark_colors.yellow;
	PKT_COLOR_ACK_TITLE     = dark_colors.green;
	PKT_COLOR_NACK_TITLE    = dark_colors.red;
	PKT_COLOR_STOP_TITLE    = dark_colors.blue;
	PKT_COLOR_NOISE_TITLE   = dark_colors.black;
	PKT_COLOR_COMMAND_TITLE = dark_colors.pink;

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	for (var k in DEVICE_TABLE)
    {
        var dev = DEVICE_TABLE[k];

        if (dev.uiId == uiDevice)
        {
            Device = dev;
			device_write = Device.code;
			device_read  = Device.code + 1;
        }
    }

	decBuf = pre_decode("i2c.js", "chSda = " + chSda + ";" + "chScl = " + chScl + ";" + "adrShow = 0;" + "hexView = 3");

	var byteValue = 0;
	var trScl = trs_get_first(chScl);
	var avgtHigh;

	objCnt = 0;
	avgtHigh = get_avg_thigh(trScl);

	while (decBuf.length > objCnt)
	{
		if (abort_requested() == true)
		{
			return false;
		}

		I2Cdata = decBuf[objCnt];
		objCnt++;

		if ((I2Cdata.pre_text == "MASTER START CONDITION") && (noACK == true))
		{
			dec_item_new(chSda, (I2Cdata.start_s + avgtHigh), I2Cdata.start_s + (avgtHigh * 2));
		}
		else if ((I2Cdata.pre_text == "NOISE ON SDA") || (I2Cdata.pre_text == "NOISE ON SCL"))
		{
			dec_item_new(chScl, (I2Cdata.start_s - (avgtHigh / 2)), I2Cdata.start_s + (avgtHigh / 2));
		}
		else
		{
			dec_item_new(chSda, I2Cdata.start_s, I2Cdata.end_s);
		}
		
		hex_add_byte(chSda, -1, -1, I2Cdata.data);
		add_text(Device.grp);
	}
}

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

function get_ch_light_color (k)
{
    var chColor = get_ch_color(k);

    chColor.r = (chColor.r * 1 + 255 * 3) / 4;
	chColor.g = (chColor.g * 1 + 255 * 3) / 4;
	chColor.b = (chColor.b * 1 + 255 * 3) / 4;

	return chColor;
}

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

function add_text (grp)
{
	var color = PKT_COLOR_DATA;
	var title = "";
	var data = "";	
	var write_packet = false;
	var end_packt = false;
	var I2Cdata_next;
	var data_measure;
	var registre_packet = false;
	var data_status_bat = "";

	if (I2Cdata.data == I2C_CMD.T_MEASURE_HM)
	{		
		dec_item_add_pre_text("TEMP MEASURE HOLD MASTER");
		dec_item_add_pre_text("TEMP HM");
		dec_item_add_pre_text("T HM");
		dec_item_add_comment("TEMPERATURE MEASURE HOLD MASTER");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "TEMP MEASURE HOLD MASTER";

		write_packet = true;
		before_data = false;
		T = true;
	}
	else if (I2Cdata.data == I2C_CMD.RH_MEASURE_HM)
	{
		dec_item_add_pre_text("HUM MEASURE HOLD MASTER");
		dec_item_add_pre_text("HUM HM");
		dec_item_add_pre_text("H HM");
		dec_item_add_comment("HUMIDITY MEASURE HOLD MASTER");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "HUM MEASURE HOLD MASTER";
		write_packet = true;
		before_data = false;
		RH = true;
	}
	else if (I2Cdata.data == I2C_CMD.T_MEASURE_noHM)
	{		
		dec_item_add_pre_text("TEMP MEASURE NO HOLD MASTER");
		dec_item_add_pre_text("TEMP !HM");
		dec_item_add_pre_text("T !HM");
		dec_item_add_comment("TEMPERATURE MEASURE NO HOLD MASTER");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "TEMP MEASURE NO HOLD MASTER";
		write_packet = true;
		before_data = false;
		T = true;
	}
	else if (I2Cdata.data == I2C_CMD.RH_MEASURE_noHM)
	{
		dec_item_add_pre_text("HUMIDITY MEASURE NO HOLD MASTER");
		dec_item_add_pre_text("HUM MEASURE !HOLD MASTER");
		dec_item_add_pre_text("HUM !HM");
		dec_item_add_pre_text("H !HM");
		dec_item_add_comment("HUMIDITY MEASURE NO HOLD MASTER");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "HUM MEASURE NO HOLD MASTER";
		write_packet = true;
		before_data = false;
		RH = true;
	}
	else if (I2Cdata.data == I2C_CMD.WRITE_REGISTER)
	{	
		dec_item_add_pre_text("WRITE IN REGISTER");
		dec_item_add_pre_text("WR R");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "WRITE IN REGISTER";
		write_packet = true;
		before_data = false;
		Register = true;
	}
	else if (I2Cdata.data == I2C_CMD.READ_REGISTER)
	{		
		dec_item_add_pre_text("READ IN REGISTER");
		dec_item_add_pre_text("RD R");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ REGISTER FROM: " + Device.str;
		write_packet = true;
		before_data = false;
		Register = true;
	}
	else if (I2Cdata.data == I2C_CMD.SOFT_RESET)
	{		
		dec_item_add_pre_text("RESET");
		dec_item_add_pre_text("RST");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "RESET";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.MEASURE_ANOLOG_VOLTAGE_OR_THERMISTOR_TEMERATURE)
	{	
		dec_item_add_pre_text("MEASURE ANOLOG VOLTAGE OR THERMISTOR TEMERATURE");
		dec_item_add_pre_text("MEASURE AN VOLT OR THERMIS TEMP");
		dec_item_add_pre_text("MEAS AN V OR THER TEMP");
		dec_item_add_pre_text("...");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "MEASURE AN VALUE";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_TEMPERATURE_VALUE_FROM_PREVIOUS_RH_MEASUREMENT)
	{		
		dec_item_add_pre_text("READ TEMPERATURE VALUE FROM PREVIOUS RH MEASUREMENT");
		dec_item_add_pre_text("READ TEMP VAL FROM PREVIOUS RH MEASUREMENT");
		dec_item_add_pre_text("R TEMP VAL FROM PREVIOUS RH");
		dec_item_add_pre_text("R TEMP FROM PREV RH");
		dec_item_add_pre_text("...");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ PREV TEMP VALUE";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.WRITE_VOLTAGE_MEASUREMENT_SETUP)
	{
		dec_item_add_pre_text("WRITE VOLTAGE MEASUREMENT SETUP");
		dec_item_add_pre_text("W VOLT MEAS SETUP");
		dec_item_add_pre_text("W VOLT MEAS");
		dec_item_add_pre_text("...");

		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "WRITE VOLTAGE SETUP";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_VOLTAGE_MEASUREMENT_SETUP)
	{	
		dec_item_add_pre_text("READ VOLTAGE MEASUREMENT SETUP");
		dec_item_add_pre_text("R VOLT MEAS SETUP");
		dec_item_add_pre_text("R VOLT MEAS");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ VOLTAGE SETUP";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.WRITE_HEATER_SETUP)
	{	
		dec_item_add_pre_text("WRITE HEATER SETUP");
		dec_item_add_pre_text("W HEATER");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "WRITE HEATER SETUP";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_HEATER_SETUP)
	{		
		dec_item_add_pre_text("READ HEATER SETUP");
		dec_item_add_pre_text("R HEATER");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ HEATER SETUP";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.WRITE_THERMISTOR_CORREC_COEF)
	{		
		dec_item_add_pre_text("WRITE THERMISTOR CORREC COEF");
		dec_item_add_pre_text("W THERM CORREC COEF");
		dec_item_add_pre_text("W THERM COEF");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "WRITE THERM CORR COEF";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_THERMISTOR_CORREC_COEF)
	{		
		dec_item_add_pre_text("READ THERMISTOR CORREC COEF");
		dec_item_add_pre_text("R THERM CORREC COEF");
		dec_item_add_pre_text("R THERM COEF");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ THERM CORR COEF";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_ELECTRONIC_ID_1ST_BYTE_MSB)
	{		
		dec_item_add_pre_text("READ ELECTRONIC ID 1ST BYTE MSB");
		dec_item_add_pre_text("R ELEC ID 1ST BYTE MSB");
		dec_item_add_pre_text("R ELEC ID 1ST BYTE");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ ID 1ST BYTE MSB";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_ELECTRONIC_ID_1ST_BYTE_LSB)
	{		
		dec_item_add_pre_text("READ ELECTRONIC ID 1ST BYTE LSB");
		dec_item_add_pre_text("R ELEC ID 1ST BYTE LSB");
		dec_item_add_pre_text("R ELEC ID 1ST BYTE");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ ID 1ST BYTE LSB";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_ELECTRONIC_ID_2ND_BYTE_MSB)
	{		
		dec_item_add_pre_text("READ ELECTRONIC ID 2ND BYTE MSB");
		dec_item_add_pre_text("R ELEC ID 2ND BYTE MSB");
		dec_item_add_pre_text("R ELEC ID 2ND BYTE");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ ID 2ND BYTE MSB";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_ELECTRONIC_ID_2ND_BYTE_LSB)
	{		
		dec_item_add_pre_text("READ ELECTRONIC ID 2ND BYTE LSB");
		dec_item_add_pre_text("R ELEC ID 2ND BYTE LSB");
		dec_item_add_pre_text("R ELEC ID 2ND BYTE");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ ID 2ND BYTE LSB";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_FIRMWARE_REVISION_MSB)
	{		
		dec_item_add_pre_text("READ FIRMWARE REVISION MSB");
		dec_item_add_pre_text("READ FIRMWARE MSB");
		dec_item_add_pre_text("R FIRMWARE");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ FW REVISION MSB";
		write_packet = true;
		before_data = false;
	}
	else if (I2Cdata.data == I2C_CMD.READ_FIRMWARE_REVISION_LSB)
	{		
		dec_item_add_pre_text("READ FIRMWARE REVISION LSB");
		dec_item_add_pre_text("READ FIRMWARE LSB");
		dec_item_add_pre_text("R FIRMWARE");
		dec_item_add_pre_text("...");
		
		color = PKT_COLOR_COMMAND_TITLE;
		title = "COMMAND";
		data = "READ FW REVISION LSB";
		write_packet = true;
		before_data = false;
	}
	else if ((I2Cdata.pre_text == "WRITE TO: ") || (I2Cdata.pre_text == "READ FROM: "))
	{		
		if(grp == 1)
		{
			rw_grp1();
		}
		else
		{
			rw_grp2();
		}	

		before_data = false;
	}
	else if (I2Cdata.pre_text == "GENERAL CALL ")
	{
		dec_item_add_pre_text("GENERAL CALL");
		dec_item_add_pre_text("GEN");

		before_data = false;
	}
	else if (I2Cdata.pre_text == "START BYTE")
	{
		dec_item_add_pre_text("START BYTE");
		dec_item_add_pre_text("STBYTE");

		before_data = false;
	}
	else if(I2Cdata.pre_text == "NOISE ON SDA")
	{
		dec_item_add_pre_text("NOISE ON SDA");
		dec_item_add_pre_text("!");
		dec_item_add_comment("NOISE ON SDA");

		before_data = false;
	}
	else if (I2Cdata.pre_text == "NOISE ON SCL")
	{
		dec_item_add_pre_text("NOISE ON SCL");
		dec_item_add_pre_text("!");
		dec_item_add_comment("NOISE ON SCL");
		
		before_data = false;
	}
	else if (I2Cdata.pre_text == "CBUS ADDRESS ")
	{
		dec_item_add_pre_text("CBUS ADDRESS (");
		dec_item_add_pre_text("CBUS ");
		dec_item_add_data(I2Cdata.data);
		dec_item_add_post_text(I2Cdata.post_text);

		before_data = false;
	}
	else if (I2Cdata.pre_text == "MASTER START CONDITION")
	{		
		if (noACK == false)
		{
			if (before_data == true)
			{
				pkt_end();
				start_packet = true;
			}

			if (start_packet == true)
			{
				pkt_start("I2C");
				start_packet = false;
			}

			dec_item_add_pre_text("MASTER START CONDITION");
			dec_item_add_pre_text("START CONDITION");
			dec_item_add_pre_text("START");
			dec_item_add_pre_text("ST");
			dec_item_add_comment("MASTER START CONDITION");

			before_data = false;
		}
		else
		{
			dec_item_add_pre_text("MASTER STOP CONDITION");
			dec_item_add_pre_text("STOP CONDITION");
			dec_item_add_pre_text("STOP");
			dec_item_add_pre_text("SP");
			dec_item_add_comment("MASTER STOP CONDITION");

			write_packet = true;
			end_packt = true;
			before_data = false;
			noACK = false;
		}
	}
	else if (I2Cdata.pre_text == "MASTER STOP CONDITION")
	{
		dec_item_add_pre_text("MASTER STOP CONDITION");
		dec_item_add_pre_text("STOP CONDITION");
		dec_item_add_pre_text("STOP");
		dec_item_add_pre_text("SP");
		dec_item_add_comment("MASTER STOP CONDITION");

		write_packet = true;
		end_packt = true;
		before_data = false;
		noACK = false;
	}
	else if (I2Cdata.pre_text == "ACKNOWLEDGE")
	{
		dec_item_add_pre_text("SLAVE ACKNOWLEDGE");
		dec_item_add_pre_text("ACKNOWLEDGE");
		dec_item_add_pre_text("ACK");
		dec_item_add_pre_text("A");
		dec_item_add_comment("SLAVE ACKNOWLEDGE");
	}
	else if (I2Cdata.pre_text == "NO ACKNOWLEDGE")
	{		
		noACK = true;

		dec_item_add_pre_text("SLAVE NO ACKNOWLEDGE");
		dec_item_add_pre_text("NO ACKNOWLEDGE");
		dec_item_add_pre_text("NACK");
		dec_item_add_pre_text("N");
		dec_item_add_comment("SLAVE NO ACKNOWLEDGE");
	}
	else if (I2Cdata.pre_text == "WARNING: NO ACKNOWLEDGE")
	{
		dec_item_add_pre_text("WARNING: NO ACKNOWLEDGE");
		dec_item_add_pre_text("WARN: NO ACK");
		dec_item_add_pre_text("WARN");
		dec_item_add_comment("WARNING: NO ACKNOWLEDGE");
	}
	else
	{
		if ((res == 3) && ((T == true) || (RH == true)))
		{			
			data_measure = get_value(I2Cdata.data);
			// data_measure = Math.round(data_measure);
			data_measure = Math.round(data_measure * 100) / 100;

			if (T == true)
			{
				dec_item_add_pre_text(data_measure + "°C");

				T = false;
				data = data_measure + "°C";
				title = "TEMPERATURE";
			}
			else if (RH == true)
			{	
				dec_item_add_pre_text(data_measure + "%");

				RH = false;
				data = data_measure + "%";
				title = "HUMIDITY";
			}

			color = PKT_COLOR_DATA_TITLE;
		}
		else if ((T == true) || (RH == true))
		{			
			if (temp_1st_byte == true)
			{
				dec_item_add_pre_text("MSB: ");
				dec_item_add_data(I2Cdata.data);

				Temp_MSB = I2Cdata.data;
				temp_1st_byte = false;
			}
			else
			{
				dec_item_add_pre_text("LSB: ");
				dec_item_add_data(I2Cdata.data);

				Temp_LSB = (I2Cdata.data & 0xFC);
				temp_1st_byte = true;
				tmp_int = (Temp_MSB << 8) + Temp_LSB;

				data_measure = get_value(tmp_int);
				data_measure = Math.round(data_measure * 100) / 100;
				// data_measure = Math.round(data_measure);

				if (T == true)
				{
					dec_item_add_post_text(" [" + data_measure + "°C]");
					T = false;
					data = data_measure + "C";
					title = "TEMPERATURE";
				}
				else if (RH == true)
				{	
					dec_item_add_post_text(" [" + data_measure + "%]");
					RH = false;
					data = data_measure + "%";
					title = "HUMIDITY";
				}

				color = PKT_COLOR_DATA_TITLE
			}
		}
		else if (Register == true)
		{		
			dec_item_add_data(I2Cdata.data);
			Register == false;

			title = "DATA";
			color = PKT_COLOR_DATA_TITLE
			data = I2Cdata.data;

			registre_packet = true;
		}

		write_packet = true;

		if (decBuf.length < objCnt)
		{
			I2Cdata_next = decBuf[objCnt + 1];
			
			if ((I2Cdata_next.pre_text == "MASTER START CONDITION") || (I2Cdata_next.pre_text == "MASTER STOP CONDITION"))
			{
				before_data = true;
			}
		}
	}

	if ((write_packet == true) && (start_packet == false))
	{
		if (registre_packet == true)
		{
			pkt_add_item(-1, -1, "REGISTER", data, color, PKT_COLOR_DATA, true);
			registre_packet = false;

			pkt_start("REG BITS DESC");
			pkt_add_item(-1, -1, "DISABLE OTP RELOAD", ((data & 0x02) >> 1), color, PKT_COLOR_DATA, true, chSda);
			pkt_add_item(-1, -1, "ENABLE HEATER", ((data & 0x04) >> 2), color, PKT_COLOR_DATA, true, chSda);

			data_status_bat = (data & 0x40) >> 6;

			if (data_status_bat == 0)
			{
				data_status_bat += " -> VDD > 2.25V";
			}
			else if (data_status_bat == 1)
			{
				data_status_bat += " -> VDD < 2.25V";
			}

			pkt_add_item(-1, -1, "END OF BAT", data_status_bat, color, PKT_COLOR_DATA, true, chSda);

			tmp_int = (data & 0x80) >> 6;
			data = (data & 0x01);
			data |= tmp_int;

			if (data == 0)
			{
				data += " -> RH:12bit  T:14bit";
			}
			else if (data == 1)
			{
				data += " -> RH:8bit  T:12bit";
			}
			else if (data == 2)
			{
				data += " -> RH:10bit  T:13bit";
			}
			else if (data == 3)
			{
				data += " -> RH:11bit  T:11bit";
			}

			pkt_add_item(-1, -1, "RESOLUTION", data, color, PKT_COLOR_DATA, true, chSda);
			pkt_end();	
		}
		else if (end_packt == false)
		{
			if (data || title)
			{
				pkt_add_item(-1, -1, title, data, color, PKT_COLOR_DATA, true, chSda);
			}
		}

		if ((end_packt == true) && (last_end_state == false))
		{
			pkt_end();
			start_packet = true;
		}

		last_end_state = end_packt;
	}
}

function rw_grp1()
{
	if (I2Cdata.pre_text == "WRITE TO: ")
	{
		if (I2Cdata.data == device_write)
		{
			dec_item_add_pre_text(I2Cdata.pre_text + Device.str);
			dec_item_add_pre_text("WR ");
			dec_item_add_post_text(I2Cdata.post_text);
			tmp_int = +I2Cdata.data ;
			dec_item_add_comment("WRITE TO : " + int_to_str_hex(tmp_int));

			color = PKT_COLOR_ADR_TITLE;
			title = "ADRESS";
			data = "WRITE TO "+Device.str;	
			write_packet = true;
		}
		else
		{
			dec_item_add_pre_text(I2Cdata.pre_text + " invalid adress");
			dec_item_add_pre_text("WR : invalid adress");
			dec_item_add_pre_text("WR !");
			dec_item_add_post_text(I2Cdata.post_text);
		}
	}
	else if (I2Cdata.pre_text == "READ FROM: ")
	{
		tmp_int = +I2Cdata.data;
		tmp_int++;

		if (tmp_int == device_read)
		{
			dec_item_add_pre_text(I2Cdata.pre_text+Device.str);
			dec_item_add_pre_text("RD ");
			dec_item_add_post_text(I2Cdata.post_text);
			tmp_int = +I2Cdata.data ;
			dec_item_add_comment("READ FROM : "+int_to_str_hex(tmp_int));
			
			color = PKT_COLOR_ADR_TITLE;
			title = "ADRESS";
			data = "READ FROM "+Device.str;	
			write_packet = true;
		}
		else
		{
			dec_item_add_pre_text(I2Cdata.pre_text+" invalid adress");
			dec_item_add_pre_text("RD : invalid adress");
			dec_item_add_pre_text("RD !");
			dec_item_add_post_text(I2Cdata.post_text);
		}
	}
}

function rw_grp2()
{
	if (I2Cdata.pre_text == "WRITE TO: ")
	{
		if (I2Cdata.data == device_write)
		{
			dec_item_add_pre_text(I2Cdata.pre_text + Device.str);
			dec_item_add_pre_text("WR ");
			dec_item_add_post_text(I2Cdata.post_text);
			tmp_int = +I2Cdata.data ;
			dec_item_add_comment("WRITE TO : " + int_to_str_hex(tmp_int));
			
			color = PKT_COLOR_ADR_TITLE;
			title = "ADRESS";
			data = "WRITE TO "+Device.str;	
			write_packet = true;
		}
		else if (I2Cdata.data == (device_write + 1))
		{
			dec_item_add_pre_text(I2Cdata.pre_text+Device.str);
			dec_item_add_pre_text("WR ");
			dec_item_add_post_text(I2Cdata.post_text);
			tmp_int = +I2Cdata.data ;
			dec_item_add_comment("WRITE TO : " + int_to_str_hex(tmp_int));

			color = PKT_COLOR_ADR_TITLE;
			title = "ADRESS";
			data = "WRITE TO " + Device.str;	
			write_packet = true;
		}
		else
		{
			dec_item_add_pre_text(I2Cdata.pre_text + " invalid adress");
			dec_item_add_pre_text("WR : invalid adress");
			dec_item_add_pre_text("WR !");
			dec_item_add_post_text(I2Cdata.post_text);
		}
	}
	else if(I2Cdata.pre_text == "READ FROM: ")
	{
		tmp_int = +I2Cdata.data ;
		tmp_int++;

		if (tmp_int == device_read)
		{
			dec_item_add_pre_text(I2Cdata.pre_text + Device.str);
			dec_item_add_pre_text("RD ");
			dec_item_add_post_text(I2Cdata.post_text);
			tmp_int = +I2Cdata.data ;
			dec_item_add_comment("READ FROM : " + int_to_str_hex(tmp_int));
			
			color = PKT_COLOR_ADR_TITLE;
			title = "ADRESS";
			data = "READ FROM " + Device.str;	
			write_packet = true;
		}
		else if (tmp_int == (device_read + 1))
		{
			dec_item_add_pre_text(I2Cdata.pre_text+Device.str);
			dec_item_add_pre_text("RD ");
			dec_item_add_post_text(I2Cdata.post_text);
			tmp_int = +I2Cdata.data;
			dec_item_add_comment("READ FROM : " + int_to_str_hex(tmp_int));

			color = PKT_COLOR_ADR_TITLE;
			title = "ADRESS";
			data = "READ FROM " + Device.str;	
			write_packet = true;
		}
		else
		{
			dec_item_add_pre_text(I2Cdata.pre_text + " invalid adress");
			dec_item_add_pre_text("RD : invalid adress");
			dec_item_add_pre_text("RD !");
			dec_item_add_post_text(I2Cdata.post_text);
		}
	}
}

function get_avg_thigh (trSt)
{
	var tr = trSt;
	var trPrev = tr;

	var tHighArr = new Array();
	var avgtHigh = 0;

	while (trs_is_not_last(chScl) != false)
	{
		trPrev = tr;
		tr = trs_get_next(chScl);
		tHighArr.push((tr.sample - trPrev.sample));
	
		if (tHighArr.length > 100)
		{
			break;
		}
	}

	tHighArr.sort(function(a, b){return a - b;});
	avgtHigh = tHighArr[Math.round(tHighArr.length / 2)];

	return avgtHigh;
}

function get_value (value)
{
	var result = 0;
	var tmp = 0;

	if (T == true)
	{
		tmp = value / (Math.pow(2, 16));
		tmp *= 175.72;
		result = tmp - 46.85;
	}
	else if (RH = true)
	{
		tmp = value / (Math.pow(2, 16));
		tmp *= 125;
		result = tmp - 6;
	}

	return result
}
