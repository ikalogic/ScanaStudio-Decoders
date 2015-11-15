/*
*************************************************************************************

							SCANASTUDIO 2 NMEA 0183 DECODER

The following commented block allows some related informations to be displayed online

<DESCRIPTION>

	NMEA 0183 Protocol Decoder.
	A standard  decoder of National Marine Electronics Association Protocol for communication between marine electronic devices such as echo sounder, 
	sonars, anemometer, gyrocompass, autopilot, GPS receivers and many other types of instruments. 

</DESCRIPTION>

<RELEASE_NOTES>

	V1.1: Added Packet/Hex View support.
	V1.0: Initial release.

</RELEASE_NOTES>

<AUTHOR_URL>

	mailto:v.kosinov@ikalogic.com

</AUTHOR_URL>
						
*************************************************************************************
*/

 /* The decoder name as it will apear to the users of this script
 */
function get_dec_name()
{
	return "NMEA 0183";
}


 /* The decoder version
 */
function get_dec_ver()
{
	return "1.1";
}


 /* The decoder version
 */
function get_dec_auth()
{
	return "IKALOGIC";
}


 /* graphical user interface
 */
function gui()
{
	ui_clear();	// clean up the User interface before drawing a new one.
	
	ui_add_ch_selector("ch", "Channel to decode", "NMEA");
	ui_add_baud_selector("baud", "BAUD rate", 9600);

	ui_add_txt_combo("invert","Inverted logic");
		ui_add_item_to_txt_combo("Non inverted logic",true);
		ui_add_item_to_txt_combo("Inverted logic");
}


var NMEA_OUT_MSG =
{
	GGA : {strId: "GPGGA"},
	GSA : {strId: "GPGSA"},
	GSV : {strId: "GPGSV"},
	RMC : {strId: "GPRMC"}
};


/* Constants 
*/
var NMEA_ST_OF_MSG  = 0x24;		// '$' character code
var NMEA_END_OF_MSG = 0x0A;		// 'LF' character code

var PKT_COLOR_DATA;
var PKT_COLOR_GENER_TITLE;
var PKT_COLOR_GPGGA_TITLE;
var PKT_COLOR_GPGSA_TITLE;
var PKT_COLOR_GPGSV_TITLE;
var PKT_COLOR_GPRMC_TITLE;


/* This is the function that will be called from ScanaStudio
   to update the decoded items
*/
function decode()
{
	var uartData;
	var uartDataCnt = 0;

	if (!check_scanastudio_support())
    {
        add_to_err_log("Please update your ScanaStudio software to the latest version to use this decoder");
        return;
    }

	PKT_COLOR_DATA        = get_ch_light_color(ch);
	PKT_COLOR_GENER_TITLE = dark_colors.gray;
	PKT_COLOR_GPGGA_TITLE = dark_colors.blue;
	PKT_COLOR_GPGSA_TITLE = dark_colors.orange;
	KT_COLOR_GPGSV_TITLE  = dark_colors.green;
	PKT_COLOR_GPRMC_TITLE = dark_colors.violet;

	get_ui_vals();

	var decBuf = pre_decode("uart.js", "ch = " + ch + ";"
                                    + "baud = " + baud + ";"
									+ "nbits = " + 3 + ";"		// 8-bit word
									+ "parity = " + 0 + ";"		// no parity
									+ "stop = " + 0 + ";"       // 1 stop
									+ "order = " + 0 + ";"      // LSB first
									+ "invert = " + 0);			// non inverted

	while (decBuf.length > uartDataCnt)
	{
		uartData = decBuf[uartDataCnt];
		uartDataCnt++;

		if (uartData.data.length > 0)
		{
			if (uartData.data == NMEA_ST_OF_MSG)
			{
				var msg = String.fromCharCode(uartData.data);
				var stOfMsg = uartData.start_s, endOfMsg;

				while (uartData.data != NMEA_END_OF_MSG)
				{
					uartData = decBuf[uartDataCnt];
					uartDataCnt++;

					endOfMsg = uartData.end_s;

					if (uartData.data.length > 0)
					{
						hex_add_byte(ch, -1, -1, uartData.data);
						msg += String.fromCharCode(uartData.data);
					}
				}

				var outMsgArr = msg.split(",");
				var msgId = outMsgArr.shift();
				msgId = msgId.slice(1);

				dec_item_new(ch, stOfMsg , endOfMsg);
				dec_item_add_pre_text(msg);
				dec_item_add_pre_text(msgId);
				dec_item_add_comment(msg);

				/*
				pkt_start("NMEA 0183");

				if (msgId == "GPGGA")
				{
					pkt_add_item(-1, -1, msgId, "", PKT_COLOR_GPGGA_TITLE, PKT_COLOR_DATA);
					pkt_start(msgId);

					var utc = outMsgArr.shift();
					utc = utc.slice(0, 2) + ":" +  utc.slice(2, 4) + ":" + utc.slice(4, 6) + "." + utc.slice(7, 10);

					pkt_add_item(-1, -1, "UTC TIME", utc, PKT_COLOR_GPGGA_TITLE, PKT_COLOR_DATA);

					var latitude = outMsgArr.shift();
					var dir = outMsgArr.shift();
					dir = "N";
					latitude = "4124.8963";
					latitude = latitude.slice(0, 2) + "°" + latitude.slice(2, 4) + "'" + latitude.slice(5, 9) + '"';

					pkt_add_item(-1, -1, "LATITUDE", latitude + dir, PKT_COLOR_GPGGA_TITLE, PKT_COLOR_DATA);

					var longitude = outMsgArr.shift();
					dir = outMsgArr.shift();
					dir = "W";
					longitude = "8151.6838";
					longitude = longitude.slice(0, 2) + "°" + longitude.slice(2, 4) + "'" + longitude.slice(5, 9) + '"';

					pkt_add_item(-1, -1, "LONGITUDE", longitude + dir, PKT_COLOR_GPGGA_TITLE, PKT_COLOR_DATA);

					pkt_end();
				}

				pkt_end();
				*/
			}
		}
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
